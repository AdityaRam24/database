from pydantic import BaseModel

class ApplyOptimizationRequest(BaseModel):
    connection_string: str
    sql_command: str
    project_id: str = "default"
