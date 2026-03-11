from fastapi import APIRouter, HTTPException, Body
from app.services.schema_analysis import SchemaAnalysisService
from app.services.ai_service import AIService
from pydantic import BaseModel
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class AnalysisRequest(BaseModel):
    connection_string: str

class AskRequest(BaseModel):
    connection_string: str
    question: str

class TableDataRequest(BaseModel):
    connection_string: str
    table_name: str

@router.post("/dashboard")
async def get_dashboard_summary(request: AnalysisRequest):
    try:
        service = SchemaAnalysisService(request.connection_string)
        return await service.get_dashboard_stats(request.connection_string)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/graph")
def get_schema_graph(request: AnalysisRequest):
    try:
        service = SchemaAnalysisService(request.connection_string)
        return service.get_schema_graph_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ask")
async def ask_ai(request: AskRequest):
    try:
        service = SchemaAnalysisService(request.connection_string)
        graph_data = service.get_schema_graph_data()

        # Build schema context string
        schema_lines = []
        for node in graph_data.get("nodes", []):
            table_name = node["data"]["label"]
            columns = node["data"].get("columns", [])
            col_strs = [f"  - {c['name']} ({c['type']}{'  PK' if c['is_pk'] else ''})" for c in columns]
            schema_lines.append(f"Table: {table_name}")
            schema_lines.extend(col_strs)
        schema_context = "\n".join(schema_lines) if schema_lines else "No schema data available."

        ai_service = AIService()
        answer = await ai_service.answer_database_question(request.question, schema_context)
        
        # Parse for [EXECUTE: SQL] action
        suggested_action = None
        import re
        match = re.search(r'\[EXECUTE:\s*(.*?)\]', answer, re.DOTALL)
        if match:
            suggested_action = match.group(1).strip()
            # Remove the tag from the visible answer
            answer = re.sub(r'\[EXECUTE:.*?\]', '', answer).strip()

        return {
            "answer": answer,
            "suggested_action": suggested_action
        }

    except Exception as e:
        logger.error(f"Ask AI failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/table-data")
def get_table_data(request: TableDataRequest):
    try:
        service = SchemaAnalysisService(request.connection_string)
        return service.get_table_data(request.table_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
