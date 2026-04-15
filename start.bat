@echo off
echo Starting Backend Server...
start "Backend Server" cmd /k "cd backend && call venv\scripts\activate.bat && uvicorn app.main:app --reload --port 8000"

echo Starting Frontend Server...
start "Frontend Server" cmd /k "cd frontend && npm run dev"

echo Both servers have been launched in separate windows!
