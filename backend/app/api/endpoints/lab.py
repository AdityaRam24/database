from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging
from app.services.schema_analysis import SchemaAnalysisService

router = APIRouter()
logger = logging.getLogger(__name__)

class LabRequest(BaseModel):
    connection_string: str
    query: str

@router.post("/experiment")
async def run_lab_experiment(request: LabRequest):
    """
    Simulates executing a structural query (CREATE INDEX, ALTER TABLE) by passing it to the Shadow DB, 
    evaluating performance improvement, and reversing it (or rolling it back).
    For this prototype/demo, it simulates an 'index created' success response and returns mocked 
    cost improvements.
    """
    sql = request.query.strip().upper()
    
    # We will simulate the impact to avoid actually breaking the shadow DB in this demo API
    if sql.startswith("CREATE INDEX"):
        return {
            "status": "success",
            "message": "Index successfully simulated on Shadow DB.",
            "metrics": {
                "before_cost": 2550.0,
                "after_cost": 45.2,
                "improvement_pct": 98.2
            }
        }
    elif sql.startswith("ALTER TABLE"):
        return {
            "status": "success",
            "message": "Table structure modified in sandbox.",
            "metrics": {
                "before_cost": 120.0,
                "after_cost": 120.0,
                "improvement_pct": 0
            }
        }
    elif sql.startswith("DROP"):
        return {
            "status": "success",
            "message": "Object dropped in sandbox.",
            "metrics": {
                "before_cost": 500.0,
                "after_cost": 650.0,
                "improvement_pct": -30.0
            }
        }
    else:
        return {
            "status": "error",
            "message": "Lab only supports CREATE INDEX, ALTER TABLE, or DROP statements for structural testing.",
            "metrics": None
        }
