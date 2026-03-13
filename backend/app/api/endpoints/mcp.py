"""
MCP (Model Context Protocol) API — /api/mcp/*
Endpoints for exposing the database as an MCP-compatible server.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class MCPRequest(BaseModel):
    connection_string: str


@router.post("/manifest")
def get_manifest(req: MCPRequest):
    """Generate and return the full MCP-compatible manifest."""
    try:
        from app.services.mcp_server import MCPServer
        server = MCPServer(req.connection_string)
        return server.generate_manifest()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refresh")
def refresh_manifest(req: MCPRequest):
    """Regenerate the MCP manifest from current DB state."""
    try:
        from app.services.mcp_server import MCPServer
        server = MCPServer(req.connection_string)
        manifest = server.generate_manifest()
        return {"success": True, "manifest": manifest}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
