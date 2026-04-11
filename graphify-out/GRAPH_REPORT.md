# Graph Report - backend + frontend  (2026-04-10)

## Corpus Check
- 211 files · ~177,159 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 606 nodes · 986 edges · 77 communities detected
- Extraction: 73% EXTRACTED · 27% INFERRED · 0% AMBIGUOUS · INFERRED: 269 edges (avg confidence: 0.51)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `AIService` - 65 edges
2. `FirebaseService` - 61 edges
3. `SchemaAnalysisService` - 36 edges
4. `MongoDBService` - 32 edges
5. `DialectConverter` - 23 edges
6. `DBService` - 18 edges
7. `DriftDetector` - 18 edges
8. `SyntheticDataService` - 13 edges
9. `DBConnectionRequest` - 12 edges
10. `DBConnectionResponse` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Accepts an image file (e.g. whiteboard sketch, ER diagram) and uses Vision AI` --uses--> `AIService`  [INFERRED]
  C:\Users\Tikole\OneDrive\Documents\Database-lighthouse\database\backend\app\api\endpoints\vision.py -> C:\Users\Tikole\OneDrive\Documents\Database-lighthouse\database\backend\app\services\ai_service.py
- `Simulates a council debate between 'The Architect' and 'The Guardian' to ensure` --uses--> `AIService`  [INFERRED]
  C:\Users\Tikole\OneDrive\Documents\Database-lighthouse\database\backend\app\services\council_service.py -> C:\Users\Tikole\OneDrive\Documents\Database-lighthouse\database\backend\app\services\ai_service.py
- `Calculates a score from 0 to 100 based on recommendations.         - High impac` --uses--> `AIService`  [INFERRED]
  C:\Users\Tikole\OneDrive\Documents\Database-lighthouse\database\backend\app\services\optimization_service.py -> C:\Users\Tikole\OneDrive\Documents\Database-lighthouse\database\backend\app\services\ai_service.py
- `AnalysisRequest` --uses--> `AIService`  [INFERRED]
  C:\Users\Tikole\OneDrive\Documents\Database-lighthouse\database\backend\app\api\endpoints\analysis.py -> C:\Users\Tikole\OneDrive\Documents\Database-lighthouse\database\backend\app\services\ai_service.py
- `AskRequest` --uses--> `AIService`  [INFERRED]
  C:\Users\Tikole\OneDrive\Documents\Database-lighthouse\database\backend\app\api\endpoints\analysis.py -> C:\Users\Tikole\OneDrive\Documents\Database-lighthouse\database\backend\app\services\ai_service.py

## Hyperedges (group relationships)
- **DB Connection and Shadow Clone Creation Flow** -- db_connection_endpoint, db_service_DBService, shadow_db_pattern [EXTRACTED 1.00]
- **Voice NLP-to-SQL Execution Pipeline** -- voice_query, AIService, voice_buildkeywordsql, get_schema [EXTRACTED 0.95]
- **Security Guardrail System** -- scan_prompt, prompt_firewall_scan_prompt, security_guardrailconfig [EXTRACTED 0.90]
- **Multi-Layer SQL Safety** -- prompt_firewall_scan_prompt, safe_sql_check, migration_analyzer_blocked_patterns [INFERRED 0.90]
- **Observability Triad: Anomaly + Incident + Drift** -- AnomalyDetector, IncidentEngine, DriftDetector [INFERRED 0.88]
- **Multi-DB Schema Graph Adapters** -- SchemaAnalysisService, MongoDBService, FirebaseService [INFERRED 0.87]

## Communities

### Community 0 - "Query Analysis & Schema Introspection"
Cohesion: 0.05
Nodes (55): AnalysisRequest, ask_ai(), AskRequest, DriftScanRequest, estimate_query_cost(), explain_sql(), ExplainRequest, generate_lab_sql() (+47 more)

### Community 1 - "AI / LLM Engine"
Cohesion: 0.07
Nodes (43): AIService, _extract_sql_from_llm_response(), Takes a base64 encoded image (such as an ER diagram or whiteboard sketch), Robustly pull SQL out of an LLM response regardless of whether         the mode, Send one failing statement to the LLM and return the PostgreSQL equivalent., Returns {is_safe, reason, sanitized_sql, requires_mfa}, Called when sqlglot fails to convert a SQL file from source_dialect to PostgreSQ, Generate a SQL patch from a natural language description of what to change. (+35 more)

### Community 2 - "Frontend UI Components"
Cohesion: 0.05
Nodes (2): fetchProjects(), handleSync()

### Community 3 - "Connect & Dashboard Pages"
Cohesion: 0.05
Nodes (20): addMessage(), clearChat(), doCollect(), doDetect(), genId(), getHistory(), handleAdd(), handleAddExample() (+12 more)

### Community 4 - "Anomaly Detection"
Cohesion: 0.12
Nodes (22): AnomalyRequest, collect_metrics(), detect_anomalies(), AnomalyDetector, _ensure_data_dir(), _load_baselines(), _prune_old_snapshots(), Anomaly Detector -- Z-Score-based statistical baseline engine.  Collects metric (+14 more)

### Community 5 - "Incident Engine"
Cohesion: 0.12
Nodes (21): _ensure_data_dir(), IncidentEngine, _load_baselines(), _prune_old_incidents(), _prune_old_snapshots(), Incident Engine -- Real-time AI-driven database incident detection.  Detects da, Analyze latest metrics against baselines to produce Incidents., Calculates severity using the specific formula and creates the incident object. (+13 more)

### Community 6 - "Index Analysis"
Cohesion: 0.14
Nodes (25): analyze_query_stats(), BottleneckColumn, detect_missing_indexes(), detect_zombie_indexes(), _engine(), _existing_indexes(), get_bottleneck_map(), get_full_analysis() (+17 more)

### Community 7 - "Security & PII Guardrails"
Cohesion: 0.12
Nodes (18): detect_pii(), generate_synthetic(), guardrail_status(), _is_firebase(), PromptScanRequest, Security API -- /api/security/* Endpoints for synthetic data generation, prompt, Generate a synthetic mirror of the database with PII replaced., Scan the database and identify columns/fields likely containing PII. (+10 more)

### Community 8 - "Optimization Apply Flow"
Cohesion: 0.11
Nodes (13): ApplyOptimizationRequest, apply_optimization(), _is_firebase(), OptimizationRecommendation, OptimizationResponse, run_optimization_scan(), ScanRequest, OptimizationService (+5 more)

### Community 9 - "Optimization Report Frontend"
Cohesion: 0.12
Nodes (3): fetchStats(), handleFixApplied(), handleProjectLoad()

### Community 10 - "Ask AI Feature (Frontend)"
Cohesion: 0.2
Nodes (17): Ask AI Page, AskAIPanel Component, AuthContext (Firebase Auth), Backend: POST /analysis/ask, Backend: POST /analysis/query, Backend: POST /connect-db/, Backend: POST /council/deliberate, Backend: POST /voice/query (+9 more)

### Community 11 - "MCP Protocol Layer"
Cohesion: 0.17
Nodes (10): get_manifest(), MCPRequest, MCP (Model Context Protocol) API -- /api/mcp/* Endpoints for exposing the databa, Generate and return the full MCP-compatible manifest., Regenerate the MCP manifest from current DB state., refresh_manifest(), load_semantic_rules(), MCPServer (+2 more)

### Community 12 - "Migration Governance"
Cohesion: 0.26
Nodes (11): _check_dependent_functions(), _check_dependent_indexes(), _check_dependent_views(), _check_fk_constraints(), _engine(), parse_sql_patch(), Migration Safety Analysis Service -- Module 2 (Governance)  Before any SQL patc, Full safety analysis pipeline.     Returns:     {         is_safe: bool, (+3 more)

### Community 13 - "Project Management (Backend)"
Cohesion: 0.27
Nodes (9): delete_project(), _firebase_configured(), get_projects(), ProjectIn, Check if Firebase credentials are available without throwing., Save a database project to Firestore using Admin SDK., Get all database projects for a user from Firestore using Admin SDK., Delete a database project from Firestore using Admin SDK. (+1 more)

### Community 14 - "Semantic Rules"
Cohesion: 0.2
Nodes (9): add_rule(), delete_rule(), list_rules(), Semantic Rules API -- /api/semantic/* Server-side persistence for business rules, List all semantic business rules., Add a new business rule., Delete a business rule by ID., RuleCreate (+1 more)

### Community 15 - "Multi-Agent Council"
Cohesion: 0.27
Nodes (6): CouncilRequest, deliberate_on_request(), DeliberationResponse, Triggers the multi-agent council debate for a given database request., CouncilService, Simulates a council debate between 'The Architect' and 'The Guardian' to ensure

### Community 16 - "Projects Sidebar (Frontend)"
Cohesion: 0.33
Nodes (6): deleteProject(), getLocalProjects(), getUserProjects(), notifyProjectsChanged(), saveLocalProject(), saveProject()

### Community 17 - "DB Service & Shadow Clone"
Cohesion: 0.32
Nodes (3): create_shadow_from_sql(), _ensure_shadow_db_exists(), get_table_count()

### Community 18 - "UI Decorative Components"
Cohesion: 0.25
Nodes (0): 

### Community 19 - "Voice SQL Endpoint"
Cohesion: 0.4
Nodes (5): build_keyword_sql(), Voice SQL endpoint -- takes a natural language question and executes against the, NLP -> SQL -> Execute pipeline for the Voice Orb.     Falls back to keyword SQL i, Build a sophisticated SQL query from keywords when AI is offline., voice_query()

### Community 20 - "Supporting Module 20"
Cohesion: 0.4
Nodes (4): _load_distributions(), Semantic Drift Detector -- Monitor column value distributions for logical anomali, Scan all columns and compute distribution stats.         Compare against previo, _save_distributions()

### Community 21 - "Supporting Module 21"
Cohesion: 0.47
Nodes (4): createProgram(), createShader(), hexToRgba(), render()

### Community 22 - "Supporting Module 22"
Cohesion: 0.5
Nodes (3): create_pr(), CreatePRRequest, Creates a pull request on GitHub with the AI-generated SQL migration.     If GI

### Community 23 - "Supporting Module 23"
Cohesion: 0.67
Nodes (3): Accepts an image file (e.g. whiteboard sketch, ER diagram) and uses Vision AI, upload_schema_vision(), VisionResponse

### Community 24 - "Supporting Module 24"
Cohesion: 0.5
Nodes (1): dialect_converter.py Converts SQL from various dialects (MySQL, SQLite, MSSQL,

### Community 25 - "Supporting Module 25"
Cohesion: 0.5
Nodes (3): Prompt-Injection Firewall -- Heuristic scanner for NL prompt jailbreak attempts., Scan a natural language prompt for injection/jailbreak attempts.          Retu, scan_prompt()

### Community 26 - "Supporting Module 26"
Cohesion: 0.67
Nodes (0): 

### Community 27 - "Supporting Module 27"
Cohesion: 0.67
Nodes (2): BaseSettings, Settings

### Community 28 - "Supporting Module 28"
Cohesion: 1.0
Nodes (2): get_firestore_client(), Returns an initialized Firestore Admin client, initializing once on first call.

### Community 29 - "Supporting Module 29"
Cohesion: 1.0
Nodes (3): The Architect Agent, Multi-Agent Deliberation Pattern, The Guardian Agent

### Community 30 - "Supporting Module 30"
Cohesion: 0.67
Nodes (3): Z-Score Baseline (7-day rolling), scan_distributions (Column Distribution Drift), Incident Severity Formula

### Community 31 - "Supporting Module 31"
Cohesion: 0.67
Nodes (0): 

### Community 32 - "Supporting Module 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Supporting Module 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Supporting Module 34"
Cohesion: 1.0
Nodes (2): Migration Blocked Patterns, Prompt Injection Pattern Categories

### Community 35 - "Supporting Module 35"
Cohesion: 1.0
Nodes (2): Semantic Rules Layer (MCP), Guardrail Configuration

### Community 36 - "Supporting Module 36"
Cohesion: 1.0
Nodes (2): SHADOW_DB_URL Setting, Shadow Database Pattern

### Community 37 - "Supporting Module 37"
Cohesion: 1.0
Nodes (2): FirebaseService.detect_pii_fields, PII Column Patterns

### Community 38 - "Supporting Module 38"
Cohesion: 1.0
Nodes (2): build_keyword_sql Function, Keyword Pattern Matching

### Community 39 - "Supporting Module 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Supporting Module 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Supporting Module 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Supporting Module 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Supporting Module 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Supporting Module 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Supporting Module 45"
Cohesion: 1.0
Nodes (2): Backend: POST /vision/upload-schema, VisionUploader Component

### Community 46 - "Supporting Module 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Supporting Module 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Supporting Module 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Supporting Module 49"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Supporting Module 50"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Supporting Module 51"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Supporting Module 52"
Cohesion: 1.0
Nodes (1): Verifies if the provided connection string can connect to the database.

### Community 53 - "Supporting Module 53"
Cohesion: 1.0
Nodes (1): Dumps schema from source and restores it to shadow DB.         Uses pg_dump (sc

### Community 54 - "Supporting Module 54"
Cohesion: 1.0
Nodes (1): Populates the shadow DB from a provided SQL string.

### Community 55 - "Supporting Module 55"
Cohesion: 1.0
Nodes (1): Creates a new, isolated PostgreSQL database for a specific project         and

### Community 56 - "Supporting Module 56"
Cohesion: 1.0
Nodes (1): Ensures the shadow_db database exists. If not, it creates it.

### Community 57 - "Supporting Module 57"
Cohesion: 1.0
Nodes (1): Applies a SQL command to the specified database (defaulting to Shadow DB).

### Community 58 - "Supporting Module 58"
Cohesion: 1.0
Nodes (1): Applies a SQL command to the specified database (defaulting to Shadow DB).

### Community 59 - "Supporting Module 59"
Cohesion: 1.0
Nodes (1): Like convert(), but processes each statement individually.         Returns (con

### Community 60 - "Supporting Module 60"
Cohesion: 1.0
Nodes (1): Multi-DB Dispatch Pattern

### Community 61 - "Supporting Module 61"
Cohesion: 1.0
Nodes (1): Dialect Conversion with LLM Fallback

### Community 62 - "Supporting Module 62"
Cohesion: 1.0
Nodes (1): Safety Gate Before Patch Apply

### Community 63 - "Supporting Module 63"
Cohesion: 1.0
Nodes (1): Three-Phase Index Analysis Pattern

### Community 64 - "Supporting Module 64"
Cohesion: 1.0
Nodes (1): sqlglot

### Community 65 - "Supporting Module 65"
Cohesion: 1.0
Nodes (1): faker

### Community 66 - "Supporting Module 66"
Cohesion: 1.0
Nodes (1): llama-cpp-python

### Community 67 - "Supporting Module 67"
Cohesion: 1.0
Nodes (1): AI_MODE Setting

### Community 68 - "Supporting Module 68"
Cohesion: 1.0
Nodes (0): 

### Community 69 - "Supporting Module 69"
Cohesion: 1.0
Nodes (0): 

### Community 70 - "Supporting Module 70"
Cohesion: 1.0
Nodes (0): 

### Community 71 - "Supporting Module 71"
Cohesion: 1.0
Nodes (0): 

### Community 72 - "Supporting Module 72"
Cohesion: 1.0
Nodes (0): 

### Community 73 - "Supporting Module 73"
Cohesion: 1.0
Nodes (0): 

### Community 74 - "Supporting Module 74"
Cohesion: 1.0
Nodes (0): 

### Community 75 - "Supporting Module 75"
Cohesion: 1.0
Nodes (0): 

### Community 76 - "Supporting Module 76"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **92 isolated node(s):** `Creates a pull request on GitHub with the AI-generated SQL migration.     If GI`, `Check if Firebase credentials are available without throwing.`, `Save a database project to Firestore using Admin SDK.`, `Get all database projects for a user from Firestore using Admin SDK.`, `Delete a database project from Firestore using Admin SDK.` (+87 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Supporting Module 32`** (2 nodes): `test_ai_connection.py`, `test_ai()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 33`** (2 nodes): `test_upload.py`, `test_upload()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 34`** (2 nodes): `Migration Blocked Patterns`, `Prompt Injection Pattern Categories`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 35`** (2 nodes): `Semantic Rules Layer (MCP)`, `Guardrail Configuration`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 36`** (2 nodes): `SHADOW_DB_URL Setting`, `Shadow Database Pattern`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 37`** (2 nodes): `FirebaseService.detect_pii_fields`, `PII Column Patterns`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 38`** (2 nodes): `build_keyword_sql Function`, `Keyword Pattern Matching`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 39`** (2 nodes): `SchemaAssemblyHero.tsx`, `getPos()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 40`** (2 nodes): `CursorGlow.tsx`, `CursorGlow()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 41`** (2 nodes): `cybernetic-bento-grid.tsx`, `CyberneticBentoGrid()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 42`** (2 nodes): `ParticleField.tsx`, `ParticleField()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 43`** (2 nodes): `ScrollReveal.tsx`, `ScrollReveal()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 44`** (2 nodes): `spotlight-card.tsx`, `GlowCard()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 45`** (2 nodes): `Backend: POST /vision/upload-schema`, `VisionUploader Component`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 46`** (1 nodes): `check_db.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 47`** (1 nodes): `repro_db_issue.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 48`** (1 nodes): `test_backticks.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 49`** (1 nodes): `test_db_creation.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 50`** (1 nodes): `test_incidents.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 51`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 52`** (1 nodes): `Verifies if the provided connection string can connect to the database.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 53`** (1 nodes): `Dumps schema from source and restores it to shadow DB.         Uses pg_dump (sc`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 54`** (1 nodes): `Populates the shadow DB from a provided SQL string.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 55`** (1 nodes): `Creates a new, isolated PostgreSQL database for a specific project         and`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 56`** (1 nodes): `Ensures the shadow_db database exists. If not, it creates it.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 57`** (1 nodes): `Applies a SQL command to the specified database (defaulting to Shadow DB).`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 58`** (1 nodes): `Applies a SQL command to the specified database (defaulting to Shadow DB).`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 59`** (1 nodes): `Like convert(), but processes each statement individually.         Returns (con`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 60`** (1 nodes): `Multi-DB Dispatch Pattern`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 61`** (1 nodes): `Dialect Conversion with LLM Fallback`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 62`** (1 nodes): `Safety Gate Before Patch Apply`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 63`** (1 nodes): `Three-Phase Index Analysis Pattern`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 64`** (1 nodes): `sqlglot`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 65`** (1 nodes): `faker`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 66`** (1 nodes): `llama-cpp-python`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 67`** (1 nodes): `AI_MODE Setting`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 68`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 69`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 70`** (1 nodes): `page_old.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 71`** (1 nodes): `HeroScene3D.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 72`** (1 nodes): `QueryStreamParallax.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 73`** (1 nodes): `RelationshipPulseSection.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 74`** (1 nodes): `SelfHealingScrubber.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 75`** (1 nodes): `StorageHeatmapSection.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supporting Module 76`** (1 nodes): `background-paths.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `FirebaseService` connect `Query Analysis & Schema Introspection` to `AI / LLM Engine`, `Anomaly Detection`, `Incident Engine`, `Security & PII Guardrails`, `Optimization Apply Flow`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **Why does `AIService` connect `AI / LLM Engine` to `Query Analysis & Schema Introspection`, `Optimization Apply Flow`, `Multi-Agent Council`, `Voice SQL Endpoint`, `Supporting Module 23`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Are the 49 inferred relationships involving `AIService` (e.g. with `AnalysisRequest` and `AskRequest`) actually correct?**
  _`AIService` has 49 INFERRED edges - model-reasoned connections that need verification._
- **Are the 49 inferred relationships involving `FirebaseService` (e.g. with `AnalysisRequest` and `AskRequest`) actually correct?**
  _`FirebaseService` has 49 INFERRED edges - model-reasoned connections that need verification._
- **Are the 31 inferred relationships involving `SchemaAnalysisService` (e.g. with `AnalysisRequest` and `AskRequest`) actually correct?**
  _`SchemaAnalysisService` has 31 INFERRED edges - model-reasoned connections that need verification._
- **Are the 25 inferred relationships involving `MongoDBService` (e.g. with `AnalysisRequest` and `AskRequest`) actually correct?**
  _`MongoDBService` has 25 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Creates a pull request on GitHub with the AI-generated SQL migration.     If GI`, `Check if Firebase credentials are available without throwing.`, `Save a database project to Firestore using Admin SDK.` to the rest of the system?**
  _92 weakly-connected nodes found - possible documentation gaps or missing edges._