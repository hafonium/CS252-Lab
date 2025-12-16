from fastapi import APIRouter, HTTPException
from app.schemas import Location, PointOfInterest, GeocodeRequest, POIRequest
from app.util.load_env import load_env_variable
import httpx
import asyncio
import os
from typing import List

router = APIRouter(prefix="/place", tags=["place"])

# Load environment variables
try:
    EMAIL = load_env_variable("EMAIL")
except:
    EMAIL = os.getenv("EMAIL", "your-email@example.com")

# Constants
NOMINATIM_BASE = "https://nominatim.openstreetmap.org"
OVERPASS_BASE = "https://overpass.kumi.systems/api/interpreter"
USER_AGENT = f"Vietnam-Explorer/1.0 (contact: {EMAIL})"

# Amenity types to search for POIs
AMENITY_TYPES = [
    "bank", "restaurant", "cafe", "hotel", "museum", "park",
    "library", "hospital", "pharmacy", "supermarket", "shop",
    "cinema", "temple", "church", "school"
]


@router.post("/geocode", response_model=Location)
async def geocode_place(request: GeocodeRequest):
    """
    Geocode a place name to coordinates using Nominatim API
    """
    try:
        # Add delay to respect Nominatim usage policy
        await asyncio.sleep(1)
        
        params = {
            "q": f"{request.place_name}, Vietnam",
            "format": "jsonv2",
            "limit": "1",
            "addressdetails": "1"
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(
                f"{NOMINATIM_BASE}/search",
                params=params,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": "application/json",
                    "Accept-Language": "en"
                }
            )
            
            if response.status_code == 0 or response.status_code == 503 or response.status_code == 504:
                raise HTTPException(
                    status_code=503,
                    detail="Unable to connect to the server. Please check your internet connection."
                )
            
            response.raise_for_status()
            data = response.json()
            
            if not data or len(data) == 0:
                raise HTTPException(
                    status_code=404,
                    detail="Không tìm thấy kết quả"
                )
            
            item = data[0]
            print(f"Query: {request.place_name}")
            print(f"Lat/Lon: {item['lat']}, {item['lon']}")
            print(f"Display name: {item['display_name']}")
            
            return Location(
                name=request.place_name,
                lat=float(item["lat"]),
                lng=float(item["lon"])
            )
    
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Request timeout. Please try again."
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=503,
            detail="Unable to connect. Please check your internet connection."
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Geocoding error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/poi", response_model=List[PointOfInterest])
async def find_points_of_interest(request: POIRequest):
    """
    Fetch points of interest using Overpass API
    """
    try:
        pois = []
        
        # Create a single client with proper configuration for all requests
        async with httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            verify=False  # Disable SSL verification if needed
        ) as client:
            # Query different amenity types to get diverse POIs
            for amenity_type in AMENITY_TYPES:
                overpass_query = f"""
                    [out:json][timeout:30];
                    nwr(around:{request.radius_m},{request.lat},{request.lng})["amenity"="{amenity_type}"];
                    out center;
                """
                
                try:
                    response = await client.post(
                        OVERPASS_BASE,
                        content=f"data={overpass_query}",
                        headers={
                            "Content-Type": "application/x-www-form-urlencoded",
                            "User-Agent": USER_AGENT
                        }
                    )
                    
                    if response.status_code != 200:
                        continue
                    
                    data = response.json()
                    
                    if data.get("elements") and len(data["elements"]) > 0:
                        for element in data["elements"]:
                            tags = element.get("tags", {})
                            name = (
                                tags.get("name") or
                                tags.get("operator") or
                                tags.get("brand") or
                                tags.get("amenity") or
                                amenity_type
                            )
                            
                            # Get coordinates
                            if "center" in element:
                                lat = element["center"]["lat"]
                                lng = element["center"]["lon"]
                            else:
                                lat = element.get("lat")
                                lng = element.get("lon")
                            
                            if lat is None or lng is None:
                                continue
                            
                            description = (
                                tags.get("addr:full") or
                                tags.get("addr:street") or
                                tags.get("addr:housename") or
                                tags.get("description") or
                                tags.get("website") or
                                tags.get("phone") or
                                f"A {amenity_type} in the area"
                            )
                            
                            # Check for duplicates
                            is_duplicate = any(
                                abs(p.lat - lat) < 0.001 and abs(p.lng - lng) < 0.001
                                for p in pois
                            )
                            
                            if not is_duplicate and name and name != amenity_type:
                                pois.append(PointOfInterest(
                                    name=name,
                                    lat=lat,
                                    lng=lng,
                                    description=description,
                                    type=amenity_type.capitalize()
                                ))
                
                except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as e:
                    print(f"Failed to fetch {amenity_type}: {e}")
                    continue
                except Exception as e:
                    print(f"Failed to fetch {amenity_type}: {e}")
                    continue
        
        if request.query:
            pois = [poi for poi in pois if request.query.lower() in poi.name.lower() or (poi.description and request.query.lower() in poi.description.lower())]

        # Raise error if no POIs found
        if len(pois) == 0:
            raise HTTPException(
                status_code=404,
                detail="No points of interest found in this area"
            )

        print(f"Found POIs: {len(pois)}")
        return pois[:5]
                
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching POIs: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch points of interest: {str(e)}"
        )

