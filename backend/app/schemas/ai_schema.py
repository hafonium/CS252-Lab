from pydantic import BaseModel
from typing import Optional, List


class ChatMessage(BaseModel):
    """Schema for chat messages"""
    role: str  # 'user' or 'assistant'
    content: str


class ChatRequest(BaseModel):
    """Request schema for chatbot"""
    message: str
    conversation_history: Optional[List[ChatMessage]] = []
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None


class ExtractedEntities(BaseModel):
    """Extracted entities from user message"""
    location_name: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    radius_km: Optional[float] = None
    query: Optional[str] = None
    missing_fields: List[str] = []


class ChatResponse(BaseModel):
    """Response schema for chatbot"""
    message: str
    extracted_entities: Optional[ExtractedEntities] = None
    needs_clarification: bool = False
    search_results: Optional[List[dict]] = None
