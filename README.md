# DB-Lighthouse AI 

**The Lighthouse for Your Database Infrastructure**

DB-Lighthouse AI is a developer tool for PostgreSQL schema optimization and visualization. It helps you reduce storage costs and improve query performance using intelligent heuristics and local AI.

## Features
- **Project Goal**: Analyze PostgreSQL schemas, suggest optimizations, and visualize relationships.
- **Tech Stack**: Next.js 15, FastAPI, PostgreSQL (Shadow DB), Jan AI (Local LLM), Firebase.

## Prerequisites
- **Node.js 18+**
- **Python 3.11+**
- **PostgreSQL** (Local or Remote)
- **Jan AI** (for AI explanations)

## 🚀 Quick Start (Docker)

The easiest way to run the full stack is with Docker Compose.

```bash
docker-compose up --build
```
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🛠️ Manual Setup (Development)

If you prefer running services individually for development:

### 1. Backend (FastAPI)

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# Mac/Linux
# source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```


### 2. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```
Access at [http://localhost:3000](http://localhost:3000).

### 3. Shadow Database
You need a local Postgres instance for the "Shadow DB".
- Create a DB named `shadow_db`.
- Update `backend/app/core/config.py` or set `SHADOW_DB_URL` env var.

---

## 🤖 AI Setup (Jan AI)

To get AI explanations for optimizations:

1. Download [Jan AI](https://jan.ai/).
2. Install a model (recommended: **Mistral Instruct 7B**).
3. Start the Local API Server (usually at `http://localhost:1337`).
4. Ensure the model name in `backend/app/core/config.py` matches what you have in Jan.

## License
MIT
