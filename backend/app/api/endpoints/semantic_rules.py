"""
Semantic Rules API — /api/semantic/*
Server-side persistence for business rules (replaces localStorage).
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import time

router = APIRouter()


class RuleCreate(BaseModel):
    name: str
    definition: str
    connection_string: Optional[str] = None


class RuleDelete(BaseModel):
    id: str
    connection_string: Optional[str] = None


@router.get("/rules")
def list_rules(connection_string: Optional[str] = None):
    """List all semantic business rules."""
    try:
        from app.services.mcp_server import load_semantic_rules
        rules = load_semantic_rules(connection_string)
        return {"rules": rules}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rules")
def add_rule(req: RuleCreate):
    """Add a new business rule."""
    try:
        from app.services.mcp_server import load_semantic_rules, save_semantic_rules
        rules = load_semantic_rules(req.connection_string)
        
        # Check duplicate name
        if any(r.get("name") == req.name for r in rules):
            raise HTTPException(status_code=409, detail=f"Rule '{req.name}' already exists")
        
        new_rule = {
            "id": str(int(time.time() * 1000)),
            "name": req.name,
            "definition": req.definition
        }
        rules.append(new_rule)
        save_semantic_rules(rules, req.connection_string)
        return {"success": True, "rule": new_rule}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/rules/{rule_id}")
def delete_rule(rule_id: str, connection_string: Optional[str] = None):
    """Delete a business rule by ID."""
    try:
        from app.services.mcp_server import load_semantic_rules, save_semantic_rules
        rules = load_semantic_rules(connection_string)
        original_len = len(rules)
        rules = [r for r in rules if r.get("id") != rule_id]
        
        if len(rules) == original_len:
            raise HTTPException(status_code=404, detail=f"Rule with id '{rule_id}' not found")
        
        save_semantic_rules(rules, connection_string)
        return {"success": True, "remaining": len(rules)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
