from fastapi import APIRouter
from app.api.endpoints import db_connection, analysis, optimization, performance, governance
from app.api.endpoints import anomaly, security, mcp, semantic_rules, incidents, projects, voice, github, council, vision, lab
from app.api.endpoints import snapshots
from app.api.endpoints import collaboration

api_router = APIRouter()

api_router.include_router(db_connection.router, prefix="/connect-db", tags=["connection"])
api_router.include_router(analysis.router, prefix="/analysis", tags=["analysis"])
api_router.include_router(optimization.router, prefix="/optimization", tags=["optimization"])
api_router.include_router(performance.router, prefix="/performance", tags=["performance"])
api_router.include_router(governance.router, prefix="/governance", tags=["governance"])
api_router.include_router(anomaly.router, prefix="/anomaly", tags=["anomaly"])
api_router.include_router(security.router, prefix="/security", tags=["security"])
api_router.include_router(mcp.router, prefix="/mcp", tags=["mcp"])
api_router.include_router(semantic_rules.router, prefix="/semantic", tags=["semantic"])
api_router.include_router(incidents.router, prefix="/incidents", tags=["incidents"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(voice.router, prefix="/voice", tags=["voice"])
api_router.include_router(github.router, prefix="/github", tags=["github"])
api_router.include_router(council.router, prefix="/council", tags=["council"])
api_router.include_router(vision.router, prefix="/vision", tags=["vision"])
api_router.include_router(lab.router, prefix="/lab", tags=["lab"])
api_router.include_router(snapshots.router, prefix="/snapshots", tags=["snapshots"])
api_router.include_router(collaboration.router, prefix="/collaboration", tags=["collaboration"])

