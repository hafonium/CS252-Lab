from fastapi import APIRouter, HTTPException
from app.schemas.ai_schema import ChatRequest, ChatResponse, ExtractedEntities
from app.schemas.place_schema import POIRequest, PointOfInterest
from app.api.routers.place_router import find_points_of_interest, geocode_place
from app.schemas.place_schema import GeocodeRequest
from app.util.load_env import load_env_variable
import httpx
import re
import os
from typing import List, Optional

router = APIRouter(prefix="/ai", tags=["ai"])

# Load HuggingFace token
try:
    HF_TOKEN = load_env_variable("HF_TOKEN")
except:
    HF_TOKEN = os.getenv("HF_TOKEN", "")

# Updated HuggingFace API endpoint (using new router endpoint)
HF_API_URL = "https://router.huggingface.co/models/urchade/gliner_small-v2.1"


async def extract_entities_with_gliner(text: str) -> dict:
    """
    Extract entities from text using Gliner model from HuggingFace
    """
    headers = {"Authorization": f"Bearer {HF_TOKEN}"}
    
    # Define entity labels we want to extract
    payload = {
        "inputs": text,
        "parameters": {
            "labels": ["location", "place", "distance", "radius", "food", "service", "amenity"]
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(HF_API_URL, headers=headers, json=payload)
            
            if response.status_code == 503:
                # Model is loading, wait and retry
                await client.post(HF_API_URL, headers=headers, json=payload)
                import asyncio
                await asyncio.sleep(2)
                response = await client.post(HF_API_URL, headers=headers, json=payload)
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Gliner API error: {response.status_code} - {response.text}")
                return []
    except Exception as e:
        print(f"Error calling Gliner API: {e}")
        return []


def parse_vietnamese_query(text: str, gliner_entities: list) -> dict:
    """
    Parse Vietnamese query to extract location, radius, and search terms
    """
    result = {
        "location_name": None,
        "radius_km": None,
        "query": None
    }
    
    # Extract radius from text (support both km and m)
    radius_patterns = [
        (r'(\d+)\s*m(?:et)?(?:er)?(?!\s*k)', 0.001),  # meters to km (500m -> 0.5km)
        (r'(\d+)\s*km', 1),  # kilometers
        (r'trong\s+(?:khoảng\s+)?(\d+)\s*m(?:et)?(?:er)?(?!\s*k)', 0.001),  # trong khoảng 500m
        (r'trong\s+(?:khoảng\s+)?(\d+)\s*km', 1),  # trong khoảng 5km
        (r'bán\s+kính\s+(\d+)\s*m(?:et)?(?:er)?(?!\s*k)', 0.001),  # bán kính 500m
        (r'bán\s+kính\s+(\d+)\s*km', 1),  # bán kính 5km
        (r'khoảng\s+(\d+)\s*m(?:et)?(?:er)?(?!\s*k)', 0.001),  # khoảng 500m
        (r'khoảng\s+(\d+)\s*km', 1),  # khoảng 5km
        (r'(\d+)\s*ki[lô]?[oô]?met', 1)  # kilometer
    ]
    
    for pattern, multiplier in radius_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result["radius_km"] = float(match.group(1)) * multiplier
            break
    
    # Extract location from text
    location_patterns = [
        r'(?:ở|tại|gần)\s+([^,]+?)(?:\s*,|\s+tìm|\s+có)',
        r'(?:đang|hiện)\s+ở\s+([^,]+?)(?:\s*,|\s+tìm)',
    ]
    
    for pattern in location_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            location = match.group(1).strip()
            # Clean up proximity words from location name
            location = re.sub(r'^(quanh|gần|xung quanh|ở)\s+', '', location, flags=re.IGNORECASE)
            location = location.strip()
            # Filter out proximity phrases that are not actual locations
            if location and location.lower() not in ['gần đó', 'gần đây', 'xung quanh', 'quanh đây', 'ở gần', 'đây', 'đó', 'quanh', 'gần', 'ở']:
                result["location_name"] = location
            break
    
    # Use Gliner entities if available
    if gliner_entities:
        for entity in gliner_entities:
            if isinstance(entity, dict):
                label = entity.get("entity_group") or entity.get("label", "")
                word = entity.get("word", "")
                
                if label in ["location", "place"] and not result["location_name"]:
                    result["location_name"] = word
                elif label in ["food", "service", "amenity"] and not result["query"]:
                    result["query"] = word
    
    # Extract query/search term (what user is looking for)
    # Remove location and radius parts to get the search term
    search_text = text
    if result["location_name"]:
        search_text = search_text.replace(result["location_name"], "")
    if result["radius_km"]:
        search_text = re.sub(r'\d+\s*km', '', search_text, flags=re.IGNORECASE)
    
    # Extract search terms
    search_patterns = [
        r'tìm\s+(?:quán|chỗ|nơi|địa điểm|tiệm)?\s*([^,\.\?]+)',
        r'(?:muốn|cần|có)\s+([^,\.\?]+)',
        r'([^,\.\?]+?)\s+(?:gần|trong|quanh)',
    ]
    
    for pattern in search_patterns:
        match = re.search(pattern, search_text, re.IGNORECASE)
        if match and not result["query"]:
            query = match.group(1).strip()
            # Clean up common words and proximity indicators (from both start and end)
            query = re.sub(r'^(quán|chỗ|nơi|tiệm|địa điểm|ở|tại|gần|ăn|uống|dịch vụ)\s+', '', query, flags=re.IGNORECASE)
            # Remove proximity words from the end - match with optional space or required space
            query = re.sub(r'\s*(gần đây|gần đó|ở đây|ở gần|quanh đây|xung quanh)\s*$', '', query, flags=re.IGNORECASE)
            query = re.sub(r'\s+(gần|ở|trong|quanh|tại)\s*$', '', query, flags=re.IGNORECASE)
            query = query.strip()
            
            # Check if query is actually a current location phrase (should not be treated as search query)
            current_location_phrases = [
                'hiện tại', 'địa chỉ hiện', 'vị trí hiện', 'đang ở đây', 
                'chỗ này', 'chỗ mình', 'của mình', 'địa chỉ của mình',
                'nơi này', 'nơi mình', 'chỗ tôi', 'ở đây'
            ]
            is_location_phrase = any(phrase in query.lower() for phrase in current_location_phrases)
            
            # Only set query if it's not empty, not just proximity words, and not a location phrase
            if query and not is_location_phrase and query.lower() not in ['gần đây', 'gần đó', 'gần', 'ở đây', 'ở gần', 'ở', 'trong', 'quanh', 'xung quanh', 'tại', 'quanh đây']:
                result["query"] = query
            break
    
    return result


@router.post("/chat", response_model=ChatResponse)
async def chat_with_bot(request: ChatRequest):
    """
    Chatbot endpoint that extracts location, radius, and query from user message
    """
    try:
        message = request.message.strip()
        
        # Extract entities using Gliner
        gliner_entities = await extract_entities_with_gliner(message)
        
        # Parse the current query
        parsed = parse_vietnamese_query(message, gliner_entities)
        
        # Check conversation history ONLY if current message doesn't provide the value
        # This allows new queries/locations to override old ones
        historical_lat, historical_lng = None, None
        
        if request.conversation_history:
            # Only look for radius from history if current message doesn't have it
            if parsed["radius_km"] is None:
                for msg in reversed(request.conversation_history):
                    if msg.role == "user":
                        prev_parsed = parse_vietnamese_query(msg.content, [])
                        if prev_parsed["radius_km"] is not None:
                            parsed["radius_km"] = prev_parsed["radius_km"]
                            break
            
            # Only look for query from history if current message doesn't have it
            if parsed["query"] is None:
                for msg in reversed(request.conversation_history):
                    if msg.role == "user":
                        prev_parsed = parse_vietnamese_query(msg.content, [])
                        if prev_parsed["query"] is not None:
                            parsed["query"] = prev_parsed["query"]
                            break
            
            # Only look for location from history if current message doesn't have it
            # Also try to get lat/lng from the assistant's previous response
            if parsed["location_name"] is None:
                for i in range(len(request.conversation_history) - 1, -1, -1):
                    msg = request.conversation_history[i]
                    if msg.role == "user":
                        prev_parsed = parse_vietnamese_query(msg.content, [])
                        if prev_parsed["location_name"] is not None:
                            parsed["location_name"] = prev_parsed["location_name"]
                            # Check if the next message (assistant's response) has lat/lng
                            if i + 1 < len(request.conversation_history):
                                # Look for lat/lng in the assistant's metadata if available
                                # For now, we'll geocode it again below
                                pass
                            break
        
        # DEBUG: Print parsed values
        print(f"\n=== DEBUG PARSED VALUES ===")
        print(f"Location: {parsed['location_name']}")
        print(f"Radius: {parsed['radius_km']} km")
        print(f"Query: {parsed['query']}")
        print(f"===========================\n")
        
        # Determine what's missing
        missing_fields = []
        lat, lng = None, None
        
        # Try to geocode location if provided
        if parsed["location_name"]:
            try:
                geocode_req = GeocodeRequest(place_name=parsed["location_name"])
                location = await geocode_place(geocode_req)
                lat = location.lat
                lng = location.lng
            except:
                # If geocoding fails but we have current location, use it as fallback
                if request.current_lat and request.current_lng:
                    lat = request.current_lat
                    lng = request.current_lng
                else:
                    missing_fields.append("location")
        else:
            # No location name extracted, check if we should use current location
            # First check if message indicates "current location"
            current_location_patterns = [
                r'hiện tại',
                r'đang ở đây',
                r'vị trí hiện tại',
                r'chỗ này',
                r'chỗ mình',
                r'địa chỉ hiện tại',
                r'của mình',
                r'địa chỉ của mình',
                r'nơi này',
                r'nơi mình đang',
                r'chỗ tôi',
                r'ở đây',
            ]
            
            uses_current_location = any(re.search(pattern, message, re.IGNORECASE) for pattern in current_location_patterns)
            
            if uses_current_location:
                if request.current_lat and request.current_lng:
                    lat = request.current_lat
                    lng = request.current_lng
                    parsed["location_name"] = "vị trí hiện tại"
                else:
                    missing_fields.append("current_location")
            # If we have current location available, use it as default
            elif request.current_lat and request.current_lng:
                lat = request.current_lat
                lng = request.current_lng
                parsed["location_name"] = "vị trí hiện tại"
            else:
                missing_fields.append("location")
        
        if parsed["radius_km"] is None:
            missing_fields.append("radius")
        
        # DEBUG: Print final values before search
        print(f"\n=== DEBUG FINAL VALUES ===")
        print(f"Lat: {lat}, Lng: {lng}")
        print(f"Radius: {parsed['radius_km']} km")
        print(f"Query: {parsed['query']}")
        print(f"Missing fields: {missing_fields}")
        print(f"==========================\n")
        
        # Build response
        extracted = ExtractedEntities(
            location_name=parsed["location_name"],
            lat=lat,
            lng=lng,
            radius_km=parsed["radius_km"],
            query=parsed["query"],
            missing_fields=missing_fields
        )
        
        # If we have all needed info, search for POIs
        if lat and lng and parsed["radius_km"]:
            try:
                poi_request = POIRequest(
                    lat=lat,
                    lng=lng,
                    radius_m=int(parsed["radius_km"] * 1000),
                    query=parsed["query"]
                )
                pois = await find_points_of_interest(poi_request)
                
                # Format response message
                if pois:
                    poi_list = [{"name": poi.name, "type": poi.type, "lat": poi.lat, "lng": poi.lng, "description": poi.description} for poi in pois]
                    response_msg = f"Mình đã tìm thấy {len(pois)} địa điểm"
                    if parsed["query"]:
                        response_msg += f" về '{parsed['query']}'"
                    if parsed["location_name"]:
                        response_msg += f" gần {parsed['location_name']}"
                    response_msg += f" trong bán kính {parsed['radius_km']}km!"
                    
                    return ChatResponse(
                        message=response_msg,
                        extracted_entities=extracted,
                        needs_clarification=False,
                        search_results=poi_list
                    )
                else:
                    return ChatResponse(
                        message="Xin lỗi, mình không tìm thấy địa điểm nào phù hợp với yêu cầu của bạn.",
                        extracted_entities=extracted,
                        needs_clarification=False,
                        search_results=[]
                    )
            except HTTPException as e:
                if e.status_code == 404:
                    return ChatResponse(
                        message="Xin lỗi, mình không tìm thấy địa điểm nào phù hợp với yêu cầu của bạn.",
                        extracted_entities=extracted,
                        needs_clarification=False,
                        search_results=[]
                    )
                raise
        
        # Ask for missing information
        clarification_msg = ""
        if "location" in missing_fields:
            clarification_msg = "Bạn có muốn gần chỗ nào không hay là địa chỉ hiện tại của bạn? Vui lòng cho Mình biết tên địa điểm (ví dụ: HCMUS, Quận 5, TP.HCM)"
        elif "current_location" in missing_fields:
            clarification_msg = "Mình cần biết vị trí hiện tại của bạn. Bạn có thể cho mình biết tên địa điểm không?"
        elif "radius" in missing_fields:
            clarification_msg = "Bạn muốn tìm trong bán kính bao nhiêu? (ví dụ: 5km hoặc 500m)"
            if parsed["query"]:
                clarification_msg += f" để tìm {parsed['query']}"
        
        # Check if user explicitly said "anything is fine" or similar
        anything_fine_patterns = [
            r'cái nào cũng được',
            r'gì cũng được',
            r'tất cả',
            r'bất kỳ',
            r'không có yêu cầu',
            r'không yêu cầu gì'
        ]
        
        user_accepts_any = any(re.search(pattern, message, re.IGNORECASE) for pattern in anything_fine_patterns)
        
        if not parsed["query"] and not clarification_msg:
            if user_accepts_any:
                # User is okay with any place, proceed without specific query
                clarification_msg = "Bạn không có yêu cầu cụ thể về loại địa điểm thì mình sẽ tìm tất cả các điểm đáng chú ý trong khu vực."
            else:
                # Ask for query specification
                clarification_msg = "Bạn có yêu cầu gì về địa điểm không hay cái nào cũng được?"
        
        return ChatResponse(
            message=clarification_msg,
            extracted_entities=extracted,
            needs_clarification=True,
            search_results=None
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in chatbot: {e}")
        raise HTTPException(status_code=500, detail=str(e))