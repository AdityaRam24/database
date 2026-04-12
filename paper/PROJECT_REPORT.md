# DB-Lighthouse: Project Report

Based on the `db_lighthouse_ieee.tex` paper, here is the comprehensive generated content for your project covering all requested sections.

## 1. Abstract
Most modern web applications rely on relational databases (RDBMS), yet maintaining schema health—spanning query performance, storage efficiency, security posture, and structural integrity—usually requires deep database administration (DBA) expertise. DB-Lighthouse is an AI-augmented, full-stack PostgreSQL schema analysis and optimization platform. It enables developers to connect a live database, automate schema analysis, visualize table relationships, and receive plain-language optimization recommendations. Crucially, the platform employs a **shadow database pattern** which clones only the schema (without row data) into an isolated local instance, ensuring zero risk of production data modification or unauthorized read-access. The system includes modules for query performance, index recommendations, PII scanning, schema drift, and semantic rule enforcement. By embedding a local Large Language Model (LLM), findings are translated into plain-English summaries accessible to non-experts. Testing on real-world schemas showcased up to 20–25% storage reductions and significant query latency improvements.

## 2. Introduction
While cloud-hosted PostgreSQL services like Amazon RDS, Supabase, and Neon have democratized database hosting, the observability tooling necessary for tuning indexes, auditing PII, and checking normalization has not kept pace. Thus, startups and small engineering teams often run databases that accrue technical debt in the form of bloated schemas, redundant indexes, or security risks. Existing enterprise tools are often cost-prohibitive or produce outputs requiring a high level of SQL expertise. DB-Lighthouse addresses this gap by combining a risk-free shadow database architecture with a unified multi-domain analysis engine and an NLP interface. It serves as an intuitive platform for developers, product managers, and founders to glean actionable database optimizations and track structural drift over time.

## 3. Motivation
Small to medium engineering teams operate under significant time constraints and often lack dedicated DBAs. Consequently, databases accumulate inefficiencies silently. Although natural language querying (Text-to-SQL) has seen academic breakthroughs, existing tools fail to merge these AI capabilities with live, actionable schema introspection inside a single framework that is completely safe for production use. The motivation behind DB-Lighthouse is to democratize database observability by translating complex database metrics into intelligible, actionable advice (with DDL patches) while structurally guaranteeing that the user's production data cannot be accidentally modified or breached.

## 4. Objectives
*   **Production Safety:** Implement a shadow database architecture that isolates analysis entirely from live production data.
*   **Comprehensive Analysis:** Provide a multi-domain analysis engine spanning storage optimization, anomaly detection, index recommendations, security/PII detection, and migration validation.
*   **Accessibility:** Utilize a locally-hosted LLM to offer a natural-language Q&A interface, interpreting complex heuristic outputs into plain-English rationales.
*   **Schema Visualization:** Build interactive, force-directed graphs capable of visually highlighting schema topologies, bottlenecks, and storage heatmaps.
*   **Actionable Remediation:** Directly provide developers with risk-graded DDL patches and clear impact estimates (e.g., precise storage megabytes saved) to act upon.

## 5. Problem Statement
Backend developers and small engineering teams need a way to introspect, optimize, and secure their production PostgreSQL schemas without needing deep DBA expertise. Direct execution of complex analytical queries on live databases introduces the risk of locking tables, dropping data, or exposing sensitive information. Existing observability solutions are either read-only diagram generators lacking optimization heuristics, enterprise tools with steep learning curves, or Text-to-SQL generators lacking production guardrails. Thus, there is a critical need for an automated, zero-risk schema assessment platform augmented by generative AI that outputs direct, understandable DDL patches.

## 6. Literature Survey
*   **Natural Language to SQL:** Research spanning LUNAR to modern LLM-based approaches (Spider benchmark, Llama 2, DIN-SQL) highlights the progression of Text-to-SQL, though few solutions handle live introspection.
*   **Automated Indexing:** Classical tools like AutoAdmin (Microsoft) and modern lightweight tools like PgHero provide heuristic index recommendations, but lack narrative reasoning for novice developers.
*   **Anomaly detection:** Systems like OtterTune optimize internal DB configuration via ML but generally focus on workload and throughput rather than schema-level structural drift.
*   **Visualization & Governance:** Tools like SchemaSpy or DBeaver generate static read-only ER diagrams, while enterprise tools like Apache Atlas and AWS Macie handle lineage and PII detection but are heavily locked into specific cloud vendors.

## 7. Technology Stack (Hardware/Software)
*   **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Radix UI/Shadcn.
*   **Visualization:** React Flow, D3-force (physics simulation), Dagre (hierarchical layout), React Three Fiber / WebGL (3D components).
*   **Backend:** FastAPI (Python), SQLAlchemy (ORM), `psycopg2` (PostgreSQL driver).
*   **Database Infrastructure:** PostgreSQL, managed entirely via Docker containers for extreme isolation.
*   **AI Layer:** Jan AI (local inference server) running a 4-bit quantized Mistral 7B model (`mistral-ins-7b-q4`), featuring a prompt firewall.
*   **Authentication:** Firebase Auth (with extensible support for enterprise SSO/SAML).
*   **Deployment:** Docker Compose for single-command full-stack provisioning.

## 8. Implementation
*   **Shadow Database Pattern:** DB-Lighthouse probes the source DB, extracts Data Definition Language (DDL) statements via `pg_dump --schema-only` (excluding row data), and populates a closed-off, local PostgreSQL container. All metrics are gathered from this shadow environment.
*   **Storage Optimization:** Computes local statistical variations (mean lengths, standard deviations, null rates) to suggest down-sizing `TEXT` to tighter `VARCHAR`, removing redundant indexes, and applying `NOT NULL` constraints.
*   **AI Firewall Validation:** A rules-based gateway that intercepts the generated SQL from the LLM, neutralizing destructive commands (like `DROP` or `TRUNCATE` without `WHERE`) and injecting limits (`LIMIT 100`) to block accidental table scans.
*   **Security & PII Scanning:** Scans column names (`email`, `ssn`) and uses regex heuristics to detect data exposure and prompt remediation actions like obfuscation or encryption.
*   **Semantic Rules Engine:** Allows developers to pass business logic (e.g., "Order values must be positive") turning them into parsed DDL assertions evaluated on the shadow DB.

## 9. Results and Discussions
The platform's efficacy was tested across four diverse real-world schemas (E-commerce, Healthcare, SaaS Analytics, Logistics). 
*   **Storage Reductions:** Achieved a mean storage space reduction of 19.4% strictly through optimizing data types and dropping unused index replicas.
*   **Index Precision:** Attained an index recommendation accuracy (precision) of 0.81 relative to choices manually vetted by expert DBAs.
*   **Latency:** Utilizing Mistral 7B without dedicated GPU acceleration yielded acceptable offline workflow speeds: mean first-token appearances in 1.3 seconds and complete generation within ~4.8 seconds.
*   **Usability:** Target persona developers connected schemas and deciphered complex indexing logs natively within 5 minutes.

## 10. Conclusion and Future Scope
*   **Conclusion:** DB-Lighthouse successfully abstracts DBA-level database observability for general developers. By synthesizing system catalog heuristics, an isolated shadow database pattern, and an LLM-driven explanation engine, it establishes a novel, zero-risk approach for modern schema lifecycle management.
*   **Future Scope:** Future developments involve adaptive statistical sampling (dynamically varying from N=1000 based on column skewness), populating the shadow DB automatically with synthetically generated semantic test data to perform true physical `EXPLAIN ANALYZE` readouts, and extending catalog compatibility to RDBMS like MySQL and SQLite.

## 11. References
1. **Li et al. (2023):** "Can LLM Already Serve as A Database Interface? A Big Bench for Text-to-SQLs" (NeurIPS).
2. **Pourreza & Rafiei (2023):** "DIN-SQL: Decomposed In-Context Learning of Text-to-SQL" (NeurIPS).
3. **Chaudhuri & Narasayya (1997):** "An Efficient Cost-Driven Index Selection Tool for Microsoft SQL Server" (VLDB).
4. **Kane, A. (2022):** "PgHero: A Performance Dashboard for PostgreSQL".
5. **Jiang et al. (2023):** "Mistral 7B" (arXiv). 

## 12. Project Achievements
*   **Zero-risk Production Guarantee:** Created a foolproof security environment by discarding 100% of row level data upon extraction to prevent cloud data leaks.
*   **Cost-Free Implementation:** Engineered the LLM functionality via a locally hosted Mistral 7B setup that retains data privacy and avoids cloud API expenses.
*   **High Recommendation Precision:** Reached 81% accuracy on index formulation matching senior database engineers.
*   **Immediate ROI Display:** The app proved the capability to slash database hosting volumes by practically 20% on established models completely out-of-the-box.
