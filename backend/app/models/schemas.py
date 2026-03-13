from pydantic import BaseModel, Field
from typing import Optional, List

class DBConnectionRequest(BaseModel):
    connection_string: str = Field(..., description="PostgreSQL connection string")
    project_name: Optional[str] = Field("My Project", description="Name of the project")

class DBConnectionResponse(BaseModel):
    success: bool
    project_id: str
    message: str
    table_count: int
    file_path: Optional[str] = None
    connection_string: Optional[str] = None
