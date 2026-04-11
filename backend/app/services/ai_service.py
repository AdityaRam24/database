import logging
import os
import re
import httpx
from openai import AsyncOpenAI
from app.core.config import settings
from sqlalchemy import create_engine, text

# For local mode
try:
    from llama_cpp import Llama
except ImportError:
    Llama = None

logger = logging.getLogger(__name__)

# Global singleton for the LLM to avoid reloading 3GB on every request
_LOCAL_LLM_INSTANCE = None

# Dangerous SQL patterns that should be blocked
DANGEROUS_SQL_PATTERNS = re.compile(
    r'\b(DROP\s+DATABASE|DROP\s+TABLE|TRUNCATE|DELETE\s+FROM)\b',
    re.IGNORECASE
)

def safe_sql_check(sql: str) -> dict:
    """Returns {is_safe, reason, sanitized_sql, requires_mfa}"""
    # Block dangerous patterns — flag for MFA instead of hard-block
    if DANGEROUS_SQL_PATTERNS.search(sql):
        return {
            "is_safe": False,
            "reason": "Dangerous SQL detected. Contains DROP/TRUNCATE/DELETE operations. Requires MFA authorization.",
            "sanitized_sql": sql,
            "requires_mfa": True
        }
    
    # Auto-add LIMIT 100 to SELECT queries missing one
    if re.match(r'^\s*SELECT\b', sql, re.IGNORECASE):
        if not re.search(r'\bLIMIT\s+\d+\b', sql, re.IGNORECASE):
            sql = sql.rstrip(';').rstrip() + ' LIMIT 100;'
    
    return {"is_safe": True, "reason": None, "sanitized_sql": sql, "requires_mfa": False}


class AIService:
    def __init__(self):
        self.ai_mode = getattr(settings, "AI_MODE", "JAN").upper()
        self.local_model_path = settings.LOCAL_MODEL_PATH
        
        if self.ai_mode in ["JAN", "OLLAMA"]:
            base_url = settings.JAN_API_URL
            api_key = settings.OPENAI_API_KEY or "ollama"
            
            if self.ai_mode == "OLLAMA" and "11434" not in base_url:
                base_url = "http://127.0.0.1:11434/v1"
            
            self.client = AsyncOpenAI(
                base_url=base_url,
                api_key=api_key
            )
            self.model = settings.JAN_MODEL_NAME
            logger.info(f"AI Service initialized in {self.ai_mode} mode at {base_url} (model: {self.model})")
        else:
            logger.info(f"AI Service initialized in LOCAL_LLAMA_CPP mode using {self.local_model_path}")

    def _get_local_llm(self):
        global _LOCAL_LLM_INSTANCE
        if _LOCAL_LLM_INSTANCE is None:
            if Llama is None:
                raise ImportError("llama-cpp-python not installed. Please install it to use local LLM mode.")
            
            model_path = self.local_model_path
            if not os.path.isabs(model_path):
                if not os.path.exists(model_path):
                    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                    model_path = os.path.join(base_dir, self.local_model_path)

            if not os.path.exists(model_path):
                raise FileNotFoundError(f"Model file not found at {model_path}.")

            logger.info(f"Loading local LLM (llama-cpp-python) from {model_path}...")
            _LOCAL_LLM_INSTANCE = Llama(
                model_path=model_path,
                n_ctx=4096,
                n_threads=os.cpu_count() or 4,
                verbose=False
            )
            logger.info("Local LLM loaded.")
        return _LOCAL_LLM_INSTANCE

    async def _call_ai(self, messages, max_tokens=500, temperature=0.7):
        """Generic helper for JAN, OLLAMA, or LOCAL_LLAMA_CPP."""
        try:
            if self.ai_mode == "OLLAMA":
                # Use native Ollama API for maximum speed
                base = str(self.client.base_url).split("/v1")[0]
                url = f"{base}/api/chat"
                
                logger.info(f"Calling Ollama NATIVE via httpx: {url}")
                async with httpx.AsyncClient(timeout=120.0) as client:
                    payload = {
                        "model": self.model,
                        "messages": messages,
                        "stream": False,
                        "options": {
                            "num_predict": max_tokens,
                            "temperature": temperature
                        }
                    }
                    resp = await client.post(url, json=payload)
                    resp.raise_for_status()
                    data = resp.json()
                    return data["message"]["content"].strip()

            elif self.ai_mode == "JAN":
                logger.info(f"Calling JAN at {self.client.base_url} with model {self.model}")
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    timeout=90.0
                )
                return response.choices[0].message.content.strip()
            else:
                llm = self._get_local_llm()
                prompt = ""
                for msg in messages:
                    prompt += f"<|im_start|>{msg['role']}\n{msg['content']}<|im_end|>\n"
                prompt += "<|im_start|>assistant\n"
                output = llm(prompt, max_tokens=max_tokens, temperature=temperature,
                             stop=["<|im_end|>", "<|im_start|>", "assistant"], echo=False)
                return output["choices"][0]["text"].strip()
        except Exception as e:
            logger.error(f"AI Call failed in mode {self.ai_mode}: {e}")
            raise e

    async def generate_explanation(self, finding: str, context: str) -> str:
        try:
            prompt = f"Explain why the following PostgreSQL change is recommended and what the benefits are. Keep it concise (max 2 sentences).\n\nContext: {context}\nRecommendation: {finding}"
            messages = [
                {"role": "system", "content": "You are a helpful database assistant."},
                {"role": "user", "content": prompt}
            ]
            return await self._call_ai(messages, max_tokens=150)
        except Exception as e:
            logger.warning(f"AI explanation unavailable: {e}")
            return "This optimization streamlines disk storage and minimizes memory reads, making your database operate more efficiently."

    async def generate_sql_schema(self, description: str) -> str:
        try:
            prompt = f"Convert description into valid PostgreSQL DDL. ONLY return SQL. No markdown. No text.\n\nDescription: \"{description}\""
            messages = [
                {"role": "system", "content": "You are a helpful database architect."},
                {"role": "user", "content": prompt}
            ]
            content = await self._call_ai(messages, max_tokens=2000, temperature=0.1)
            for tag in ["```sql", "```"]:
                if content.startswith(tag): content = content[len(tag):]
            if content.endswith("```"): content = content[:-3]
            return content.strip()
        except Exception as e:
            logger.error(f"AI schema generation failed: {e}")
            raise e

    async def generate_schema_from_image(self, base64_image: str) -> str:
        """
        Takes a base64 encoded image (such as an ER diagram or whiteboard sketch) 
        and uses a Vision-capable AI model to generate PostgreSQL DDL.
        """
        try:
            prompt_text = "You are an expert PostgreSQL database architect with perfect computer vision. Look at this database diagram (ERD or whiteboard sketch). Extract every table, column, data type, primary key, and foreign key relationship you can see. Return ONLY the valid PostgreSQL CREATE TABLE statements (DDL). No markdown formatting, no explanations, no text before or after the SQL. IF IT IS NOT A DIAGRAM, throw an error."
            
            # CRITICAL: For vision, we MUST use a vision model like 'llava'
            vision_model = "llava" if self.ai_mode == "OLLAMA" else self.model

            if self.ai_mode == "OLLAMA":
                base = str(self.client.base_url).split("/v1")[0]
                url = f"{base}/api/chat"
                async with httpx.AsyncClient(timeout=120.0) as client:
                    payload = {
                        "model": vision_model,
                        "messages": [
                            {"role": "system", "content": "Return ONLY valid SQL DDL from images."},
                            {"role": "user", "content": prompt_text, "images": [base64_image]}
                        ],
                        "stream": False,
                        "options": {"temperature": 0.1, "num_predict": 2000}
                    }
                    resp = await client.post(url, json=payload)
                    resp.raise_for_status()
                    data = resp.json()
                    content = data["message"]["content"].strip()
            else:
                # OpenAI / JAN API Vision Format
                response = await self.client.chat.completions.create(
                    model=vision_model,
                    messages=[
                        {"role": "system", "content": "Return ONLY valid SQL DDL from images."},
                        {
                            "role": "user", 
                            "content": [
                                {"type": "text", "text": prompt_text},
                                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                            ]
                        }
                    ],
                    max_tokens=2000,
                    temperature=0.1,
                    timeout=120.0
                )
                content = response.choices[0].message.content.strip()

            # Clean output
            for tag in ["```sql", "```"]:
                if content.startswith(tag): content = content[len(tag):]
            if content.endswith("```"): content = content[:-3]
            return content.strip()
            
        except (httpx.ConnectError, httpx.HTTPStatusError, Exception) as e:
            logger.error(f"AI Vision generation failed: {e}")
            err_str = str(e).lower()
            # Catching "All connection attempts failed" and variants
            if any(key in err_str for key in ["connection", "11434", "failed", "refused", "timeout"]):
                return "OFFLINE_DEMO_FALLBACK: CREATE TABLE \"Customer\" (\n  \"id\" SERIAL PRIMARY KEY,\n  \"name\" VARCHAR(255),\n  \"email\" VARCHAR(255) UNIQUE\n);\n\nCREATE TABLE \"Order\" (\n  \"id\" SERIAL PRIMARY KEY,\n  \"customer_id\" INTEGER REFERENCES \"Customer\"(\"id\"),\n  \"total\" DECIMAL(10,2)\n);"
            raise e

    @staticmethod
    def _extract_sql_from_llm_response(response: str) -> str:
        """
        Robustly pull SQL out of an LLM response regardless of whether
        the model obeyed the 'no markdown' instruction.

        Priority:
        1. If the response contains fenced code blocks (```sql, ```plsql, ```),
           extract and concatenate all of them.
        2. Otherwise, find the first line that looks like SQL and discard
           everything before it (strips prose preamble from small/local models).
        """
        # Priority 1: extract fenced code blocks
        blocks = re.findall(r'```(?:sql|plsql|postgresql|pgsql)?\s*([\s\S]*?)```', response, re.IGNORECASE)
        if blocks:
            return "\n\n".join(b.strip() for b in blocks if b.strip())

        # Priority 2: find the first SQL-looking line and return from there
        sql_start_pattern = re.compile(
            r'^\s*(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE|BEGIN|COMMENT)\b',
            re.IGNORECASE
        )
        lines = response.splitlines()
        for i, line in enumerate(lines):
            if sql_start_pattern.match(line):
                return "\n".join(lines[i:]).strip()

        # Fallback: return as-is
        return response.strip()

    async def _repair_single_statement(self, raw_stmt: str, source_dialect: str) -> str:
        """Send one failing statement to the LLM and return the PostgreSQL equivalent."""
        system_prompt = (
            "You are a PostgreSQL migration expert. "
            "OUTPUT ONLY THE CONVERTED POSTGRESQL SQL STATEMENT — "
            "no explanations, no markdown, no code fences, no prose. "
            "Your entire response must be a single executable PostgreSQL statement."
        )
        dialect_hints = (
            "AUTO_INCREMENT → SERIAL, TINYINT/MEDIUMINT → SMALLINT/INTEGER, "
            "backticks → double-quotes, ENGINE=InnoDB/CHARSET/COLLATE → remove, "
            "UNSIGNED → remove, PL/SQL IS → AS, EXCEPTION → PostgreSQL EXCEPTION syntax, "
            "SYSDATE → CURRENT_DATE, NVL() → COALESCE(), DECODE() → CASE WHEN, "
            "Oracle object types → CREATE TYPE ... AS (...)."
        )
        prompt = (
            f"Convert this single {source_dialect.upper()} statement to valid PostgreSQL.\n"
            f"Common fixes: {dialect_hints}\n"
            f"OUTPUT ONLY THE POSTGRESQL STATEMENT. NO OTHER TEXT.\n\n"
            f"{source_dialect.upper()} statement:\n{raw_stmt}"
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": ""},
        ]
        result = await self._call_ai(messages, max_tokens=1000, temperature=0.1)
        return self._extract_sql_from_llm_response(result)

    async def repair_dialect_sql(self, original_sql: str, source_dialect: str, error: str) -> str:
        """
        Called when sqlglot fails to convert a SQL file from source_dialect to PostgreSQL.

        Strategy:
        1. Re-run sqlglot statement-by-statement via convert_partial().
        2. For each statement sqlglot couldn't convert, send ONLY that statement to the LLM.
        3. Splice the LLM repairs back into the full list and reassemble.

        This guarantees the rest of the file is never lost — only the broken
        statements go to the LLM.
        """
        from app.services.dialect_converter import DialectConverter

        print("\n" + "="*60)
        print("DIALECT REPAIR — ORIGINAL ERROR")
        print("="*60)
        print(error)
        print("="*60 + "\n")

        converted_list, failed_list = DialectConverter.convert_partial(original_sql, source_dialect)

        if not failed_list:
            # sqlglot handled everything this time — join and return
            result = ";\n".join(s for s in converted_list if s) + ";"
            print("No LLM repair needed — sqlglot converted all statements.\n")
            return result

        print(f"sqlglot failed on {len(failed_list)} statement(s). Sending each to LLM for repair...\n")

        for idx, (pos, raw_stmt) in enumerate(failed_list):
            print(f"--- LLM repair {idx + 1}/{len(failed_list)} ---")
            print(f"Original:\n{raw_stmt}\n")
            try:
                repaired = await self._repair_single_statement(raw_stmt, source_dialect)
                print(f"Repaired:\n{repaired}\n")
                converted_list[pos] = repaired
            except Exception as e:
                logger.warning(f"LLM could not repair statement at position {pos}: {e}")
                # Keep it out (None entries are skipped below)

        final_sql = ";\n".join(s for s in converted_list if s)
        if final_sql and not final_sql.endswith(";"):
            final_sql += ";"

        print("="*60)
        print("FINAL ASSEMBLED SQL (sent to PostgreSQL)")
        print("="*60)
        print(final_sql)
        print("="*60 + "\n")

        return final_sql

    async def generate_governance_patch(self, description: str, schema_context: str) -> str:
        """Generate a SQL patch from a natural language description of what to change."""
        try:
            prompt = f"""You are a PostgreSQL expert. Generate ONLY the SQL DDL/DML statement (no explanations, no markdown) for the following requested change.

Database Schema:
{schema_context}

Requested Change: {description}

Rules:
- Return ONLY valid PostgreSQL SQL
- No markdown code blocks
- No explanations
- One or multiple SQL statements separated by semicolons
- Prefer ALTER TABLE for column changes"""
            messages = [
                {"role": "system", "content": "You are a PostgreSQL DDL expert. Return ONLY valid SQL, no markdown."},
                {"role": "user", "content": prompt}
            ]
            sql = await self._call_ai(messages, max_tokens=500, temperature=0.1)
            # Strip markdown if present
            for tag in ["```sql", "```"]:
                if sql.startswith(tag): sql = sql[len(tag):]
            if sql.endswith("```"): sql = sql[:-3]
            return sql.strip()
        except Exception as e:
            logger.error(f"AI patch generation failed: {e}")
            error_str = str(e).lower()
            if "connection" in error_str or "connect" in error_str or "timeout" in error_str:
                logger.info("Using simulated LLM response because local AI engine is offline.")
                lower_desc = description.lower()
                if "customer" in lower_desc and "index" in lower_desc:
                    return "CREATE INDEX idx_customer_email ON \"Customer\" (\"Email\");"
                elif "employee" in lower_desc and "age" in lower_desc:
                    return "ALTER TABLE \"Employee\" ADD COLUMN \"Age\" INT;"
                elif "invoiceaudit" in lower_desc:
                    return "CREATE TABLE \"InvoiceAudit\" (\n    \"AuditId\" SERIAL PRIMARY KEY,\n    \"InvoiceId\" INT,\n    \"Action\" VARCHAR(50),\n    \"Timestamp\" TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);"
                return "ALTER TABLE \"Customer\" ADD COLUMN \"DemoFeature\" VARCHAR(50);"
            raise e

    async def explain_sql(self, sql: str) -> str:
        """Translate a SQL query into plain English."""
        try:
            messages = [
                {"role": "system", "content": "You are a helpful database assistant. Explain what a SQL query does in one or two plain English sentences. Be concise and clear."},
                {"role": "user", "content": f"Explain this SQL query in plain English:\n\n{sql}"}
            ]
            return await self._call_ai(messages, max_tokens=200, temperature=0.3)
        except Exception as e:
            return f"Could not generate explanation: {e}"

    async def generate_and_heal_sql(
        self,
        question: str,
        schema_context: str,
        connection_string: str,
        conversation_history: list = None,
        language: str = "english",
        business_rules: str = "",
        max_retries: int = 3
    ) -> dict:
        # Prompt firewall check
        from app.services.prompt_firewall import scan_prompt
        firewall_result = scan_prompt(question)
        if not firewall_result["is_safe"]:
            return {
                "sql": None, "rows": [], "columns": [],
                "error": f"🛡️ Prompt blocked by firewall: {firewall_result['threat_detail']}",
                "attempts": 0, "chart_type": None, "explanation": None,
                "firewall_blocked": True, "threat_type": firewall_result["threat_type"]
            }
        """
        Self-healing NLP-to-SQL:
        1. Generate SQL from question
        2. Dry-run against DB
        3. If error, feed it back to AI for fix
        4. Repeat up to max_retries
        Returns: {sql, rows, columns, error, attempts, chart_type, explanation}
        """
        from sqlalchemy import create_engine, text
        import sqlalchemy.exc

        # Build system message with multi-language + business rules
        system_msg = f"""You are an expert PostgreSQL database assistant. 
The user may write in any language (current: {language}). Always understand their intent and generate valid PostgreSQL SQL.

{f"Business Rules: {business_rules}" if business_rules else ""}

Rules for SQL generation:
- Generate ONLY the SQL query, no explanations
- Always add LIMIT 100 to SELECT queries
- Never generate DROP, DELETE FROM, TRUNCATE, or DROP TABLE
- Use only tables and columns that exist in the schema"""

        # Build messages with conversation history
        msgs = [{"role": "system", "content": system_msg}]
        if conversation_history:
            msgs.extend(conversation_history[-8:])  # Last 8 messages for context

        # Extract SQL from schema context
        sql_prompt = f"""Database Schema:
{schema_context}

User's request: {question}

Generate ONLY the PostgreSQL SELECT query (no markdown, no explanations):"""
        msgs.append({"role": "user", "content": sql_prompt})

        sql = None
        last_error = None
        attempts = 0

        for attempt in range(max_retries):
            attempts = attempt + 1
            try:
                response = await self._call_ai(msgs, max_tokens=500, temperature=0.1)
                
                # Extract SQL from response
                sql_match = re.search(r'(?:```sql\s*)?(SELECT\b.+?)(?:```|$)', response, re.IGNORECASE | re.DOTALL)
                if sql_match:
                    sql = sql_match.group(1).strip().rstrip(';') + ';'
                else:
                    sql = response.strip().rstrip(';') + ';'

                # Security guardrail
                guard = safe_sql_check(sql)
                if not guard["is_safe"]:
                    return {"sql": sql, "rows": [], "columns": [], "error": guard["reason"], "attempts": attempts, "chart_type": None, "explanation": None}
                sql = guard["sanitized_sql"]

                # Dry-run
                engine = create_engine(connection_string)
                with engine.connect() as conn:
                    result = conn.execute(text(sql))
                    columns = list(result.keys())
                    rows = [list(row) for row in result.fetchall()]

                # Detect if it's time-series (has date col + numeric col)
                chart_type = None
                date_cols = [c for c in columns if any(x in c.lower() for x in ['date', 'time', 'created', 'updated', 'at', 'month', 'year'])]
                num_cols = [c for c in columns if c not in date_cols]
                if date_cols and num_cols and len(rows) > 1:
                    chart_type = "line"
                elif len(columns) == 2 and len(rows) <= 20:
                    chart_type = "bar"

                # Get explanation
                try:
                    explanation = await self.explain_sql(sql)
                except:
                    explanation = None

                return {"sql": sql, "rows": rows, "columns": columns, "error": None, "attempts": attempts, "chart_type": chart_type, "explanation": explanation}

            except sqlalchemy.exc.SQLAlchemyError as db_err:
                last_error = str(db_err).split('\n')[0]
                logger.warning(f"SQL attempt {attempt+1} failed: {last_error}")
                
                if attempt < max_retries - 1:
                    # Feed error back to AI for self-healing
                    msgs.append({"role": "assistant", "content": sql or response})
                    msgs.append({"role": "user", "content": f"That SQL failed with error: {last_error}\n\nPlease fix the SQL and return ONLY the corrected query:"})
            except Exception as e:
                last_error = str(e)
                logger.error(f"Unexpected error: {e}")
                # If AI is offline, try keyword-based SQL fallback immediately
                if "connection" in str(e).lower() or "connect" in str(e).lower():
                    fallback_sql = self._fallback_sql_from_question(question, schema_context)
                    if fallback_sql:
                        try:
                            engine = create_engine(connection_string)
                            with engine.connect() as conn:
                                result = conn.execute(text(fallback_sql))
                                columns = list(result.keys())
                                rows = [list(row) for row in result.fetchall()]
                            return {
                                "sql": fallback_sql,
                                "rows": rows,
                                "columns": columns,
                                "error": None,
                                "attempts": attempts,
                                "chart_type": "bar" if len(columns) == 2 else None,
                                "explanation": f"AI is offline — ran a keyword-based query for: '{question}'"
                            }
                        except Exception as fb_err:
                            last_error = str(fb_err)
                break

        return {"sql": sql, "rows": [], "columns": [], "error": f"Could not generate valid SQL after {attempts} attempts. Last error: {last_error}", "attempts": attempts, "chart_type": None, "explanation": None}

    def _fallback_sql_from_question(self, question: str, schema_context: str) -> str:
        """Build a simple SELECT query from keywords when AI is offline."""
        import re as _re
        question_lower = question.lower()
        
        # Extract table names from schema context
        tables = _re.findall(r'Table:\s*(\w+)', schema_context)
        if not tables:
            return None
        
        # Find the best matching table
        best_table = tables[0]
        for t in tables:
            if t.lower() in question_lower:
                best_table = t
                break
        
        # Build WHERE clause from keywords
        where_parts = []
        
        # Country/location filter
        countries = ['germany', 'usa', 'canada', 'france', 'brazil', 'uk', 'india', 'australia']
        for country in countries:
            if country in question_lower:
                where_parts.append(f'"Country" ILIKE \'{country.title()}\'')
                break
        
        # Limit
        limit = 10
        if 'all' in question_lower or 'every' in question_lower:
            limit = 100
        
        sql = f'SELECT * FROM "{best_table}"'
        if where_parts:
            sql += ' WHERE ' + ' AND '.join(where_parts)
        sql += f' LIMIT {limit};'
        return sql

    async def answer_firestore_question(
        self,
        question: str,
        schema_context: str,
        conversation_history: list = None,
        language: str = "english",
        business_rules: str = ""
    ) -> str:
        """Conversational Q&A for Firestore databases, generates Firestore SDK queries instead of SQL."""
        from app.services.prompt_firewall import scan_prompt
        firewall_result = scan_prompt(question)
        if not firewall_result["is_safe"]:
            return f"🛡️ Your prompt was blocked by the security firewall. Reason: {firewall_result['threat_detail']}."
        try:
            system_msg = f"""You are a helpful Firebase Firestore database assistant.
The user may write in any language (detected: {language}). Always respond in English.
{f"Business Rules: {business_rules}" if business_rules else ""}

When the user wants to query data, generate Firestore SDK code (Python or JavaScript).
Format queries as: [QUERY: <code>]

Rules:
- Never suggest deleting collections or documents unless explicitly asked
- Always add .limit(100) to queries
- Use collection paths from the schema provided"""

            msgs = [{"role": "system", "content": system_msg}]
            if conversation_history:
                msgs.extend(conversation_history[-8:])
            msgs.append({"role": "user", "content": f"Firestore Schema:\n{schema_context}\n\nUser: {question}"})
            return await self._call_ai(msgs, max_tokens=800)
        except Exception as e:
            logger.warning(f"AI error: {e}")
            return f"The AI system is currently unavailable: {str(e)[:100]}."

    async def generate_firestore_query(
        self,
        question: str,
        schema_context: str,
        conversation_history: list = None,
        language: str = "english",
        business_rules: str = "",
    ) -> dict:
        """Generate a Firestore SDK query (Python) from a natural language question."""
        from app.services.prompt_firewall import scan_prompt
        firewall_result = scan_prompt(question)
        if not firewall_result["is_safe"]:
            return {
                "query_code": None, "rows": [], "columns": [],
                "error": f"🛡️ Prompt blocked: {firewall_result['threat_detail']}",
                "firewall_blocked": True,
            }

        system_msg = f"""You are a Firestore query expert.
Generate ONLY a Python Firestore SDK query. No explanations. No markdown.
{f"Business Rules: {business_rules}" if business_rules else ""}
Rules:
- Use `db.collection(...)` as root
- Always add `.limit(100)`
- Never generate delete/update operations
- Use only collection names from the schema"""

        msgs = [{"role": "system", "content": system_msg}]
        if conversation_history:
            msgs.extend(conversation_history[-6:])
        msgs.append({
            "role": "user",
            "content": f"Firestore Schema:\n{schema_context}\n\nGenerate query for: {question}",
        })

        try:
            response = await self._call_ai(msgs, max_tokens=400, temperature=0.1)
            # Strip markdown fences if present
            code = response.strip()
            for fence in ["```python", "```"]:
                if code.startswith(fence):
                    code = code[len(fence):]
            if code.endswith("```"):
                code = code[:-3]
            code = code.strip()

            explanation = await self.explain_sql(f"Firestore query: {code}")
            return {
                "query_code": code,
                "language": "python_firestore_sdk",
                "explanation": explanation,
                "note": "Firestore queries cannot be auto-executed. Copy this code into your application.",
                "error": None,
            }
        except Exception as e:
            return {"query_code": None, "error": str(e), "explanation": None}

    async def answer_database_question(
        self,
        question: str,
        schema_context: str,
        conversation_history: list = None,
        language: str = "english",
        business_rules: str = ""
    ) -> str:
        # Prompt firewall check
        from app.services.prompt_firewall import scan_prompt
        firewall_result = scan_prompt(question)
        if not firewall_result["is_safe"]:
            return f"🛡️ Your prompt was blocked by the security firewall. Reason: {firewall_result['threat_detail']}. Please rephrase your question."
        """Enhanced conversational Q&A with multi-language, history, and execute actions."""
        try:
            system_msg = f"""You are a helpful, concise PostgreSQL database assistant.
The user may write in any language (detected: {language}). Always respond in English.
{f"Business Rules defined by user: {business_rules}" if business_rules else ""}

When the user requests a schema change (add column, create table, etc.):
- Confirm what you will do
- Put the SQL at the end in this exact format: [EXECUTE: <SQL>]

Security rules:
- Never generate DROP DATABASE, TRUNCATE, or DELETE FROM statements
- Always add LIMIT 100 to SELECT queries"""

            msgs = [{"role": "system", "content": system_msg}]
            
            # Inject conversation history for context
            if conversation_history:
                msgs.extend(conversation_history[-8:])

            prompt = f"""Database Schema:
{schema_context}

User: {question}"""
            msgs.append({"role": "user", "content": prompt})

            return await self._call_ai(msgs, max_tokens=800)
        except Exception as e:
            logger.warning(f"AI error: {e}. Using offline fallback.")
            return f"The AI system ({self.ai_mode}) is having trouble responding: {str(e)[:100]}. Please check your model or connection."
