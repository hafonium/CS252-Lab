from fastapi import APIRouter
from app.api.routers import ai_router
from app.api.routers import place_router

api_router = APIRouter()

api_router.include_router(ai_router.router)
api_router.include_router(place_router.router)