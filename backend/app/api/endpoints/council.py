from fastapi import APIRouter, HTTPException, Body, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.services.council_service import CouncilService
from app.services.schema_analysis import SchemaAnalysisService
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
council_service = CouncilService()

class CouncilRequest(BaseModel):
    request: str
    connection_string: str
    
class DeliberationResponse(BaseModel):
    transcript: List[Dict[str, str]]
    final_sql: str

@router.post("/deliberate", response_model=DeliberationResponse)
async def deliberate_on_request(payload: CouncilRequest):
    """
    Triggers the multi-agent council debate for a given database request.
    """
    if not payload.request or not payload.connection_string:
        raise HTTPException(status_code=400, detail="request and connection_string are required.")
        
    try:
        # Build schema context for AI
        try:
            svc = SchemaAnalysisService(payload.connection_string)
            graph = svc.get_schema_graph_data()
            schema_lines = []
            for node in graph.get('nodes', []):
                t = node['data']['label']
                cols = node['data'].get('columns', [])
                schema_lines.append(f'Table: {t}')
                schema_lines += [f"  - {c['name']} ({c['type']})" for c in cols]
            schema_context = '\n'.join(schema_lines) or 'No schema available.'
        except Exception as e:
            schema_context = ''
            logger.warning(f'Schema fetch failed: {e}')

        result = await council_service.deliberate(
            request=payload.request,
            schema_context=schema_context
        )
        return DeliberationResponse(
            transcript=result["transcript"],
            final_sql=result["final_sql"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
