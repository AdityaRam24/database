from pydantic import BaseModel
from typing import Optional, List

class OptimizationRecommendation(BaseModel):
    table: str
    column: Optional[str] = None
    type: str  # "resize", "not_null", "index"
    description: str
    explanation: Optional[str] = None # AI-generated explanation
    impact: str # "High", "Medium", "Low"
    sql_command: str

class OptimizationResponse(BaseModel):
    recommendations: List[OptimizationRecommendation]
