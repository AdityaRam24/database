import logging
import os
import httpx
from openai import AsyncOpenAI
from app.core.config import settings

# For local mode
try:
    from llama_cpp import Llama
except ImportError:
    Llama = None

logger = logging.getLogger(__name__)

# Global singleton for the LLM to avoid reloading 3GB on every request
_LOCAL_LLM_INSTANCE = None

class AIService:
    def __init__(self):
        self.ai_mode = getattr(settings, "AI_MODE", "JAN").upper()
        self.local_model_path = settings.LOCAL_MODEL_PATH
        
        # OLLAMA uses its own native API or OpenAI compat
        # JAN uses OpenAI protocol
        if self.ai_mode in ["JAN", "OLLAMA"]:
            base_url = settings.JAN_API_URL
            api_key = settings.OPENAI_API_KEY or "ollama"
            
            # Default fallbacks if env didn't update yet
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
            
            # Resolve relative path
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
        """
        Generic helper for JAN, OLLAMA, or LOCAL_LLAMA_CPP.
        """
        try:
            if self.ai_mode == "OLLAMA":
                # NATIVE OLLAMA API CALL (Maximum Speed)
                # Note: self.client.base_url is something like http://127.0.0.1:11434/v1
                # We need http://127.0.0.1:11434/api/chat
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
                # llama-cpp-python path
                llm = self._get_local_llm()
                
                prompt = ""
                for msg in messages:
                    role = msg["role"]
                    content = msg["content"]
                    prompt += f"<|im_start|>{role}\n{content}<|im_end|>\n"
                prompt += "<|im_start|>assistant\n"

                output = llm(
                    prompt,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    stop=["<|im_end|>", "<|im_start|>", "assistant"],
                    echo=False
                )
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
            # Native Ollama usually adds some markdown text even if asked not to, we'll strip it
            content = await self._call_ai(messages, max_tokens=2000, temperature=0.1)
            
            # Cleanup markdown
            for tag in ["```sql", "```"]:
                if content.startswith(tag): content = content[len(tag):]
            if content.endswith("```"): content = content[:-3]
            return content.strip()
        except Exception as e:
            logger.error(f"AI schema generation failed: {e}")
            raise e

    async def answer_database_question(self, question: str, schema_context: str) -> str:
        try:
            prompt = f"""Database Schema:
{schema_context}

User Question: {question}

Instructions:
1. Provide a clear, concise answer.
2. If the user wants to make a change (like adding a column or table), provide the SQL command in this exact format at the end of your response: [EXECUTE: <SQL_COMMAND>]
Example: "I can add that column for you. [EXECUTE: ALTER TABLE users ADD COLUMN age INT;]"
3. If it's just a question, answer normally."""
            
            messages = [
                {"role": "system", "content": "You are a helpful database assistant. You can suggest schema changes using the [EXECUTE: SQL] format."},
                {"role": "user", "content": prompt}
            ]
            return await self._call_ai(messages, max_tokens=1000)
        except Exception as e:
            logger.warning(f"AI error: {e}. Using offline fallback.")
            if "table" in question.lower():
                return f"I can confirm your database has the following schema context loaded:\n\n{schema_context}"
            return f"The AI system ({self.ai_mode}) is having trouble responding: {str(e)[:100]}. Please check your model or connection."
