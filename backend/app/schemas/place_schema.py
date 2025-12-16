from pydantic import BaseModel
from typing import Optional


class Location(BaseModel):
    """Schema for location with coordinates"""
    name: str
    lat: float
    lng: float


class PointOfInterest(Location):
    """Schema for Point of Interest extending Location"""
    description: str
    type: str


class GeocodeRequest(BaseModel):
    """Request schema for geocoding"""
    place_name: str


class POIRequest(BaseModel):
    """Request schema for finding POIs"""
    lat: float
    lng: float
    radius_m: Optional[int] = 10000
    query: Optional[str] = None
