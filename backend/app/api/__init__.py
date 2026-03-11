from fastapi import APIRouter
from app.api.endpoints import db_connection, analysis, optimization, performance, governance

api_router = APIRouter()

api_router.include_router(db_connection.router, prefix="/connect-db", tags=["connection"])
api_router.include_router(analysis.router, prefix="/analysis", tags=["analysis"])
api_router.include_router(optimization.router, prefix="/optimization", tags=["optimization"])
api_router.include_router(performance.router, prefix="/performance", tags=["performance"])
api_router.include_router(governance.router, prefix="/governance", tags=["governance"])



