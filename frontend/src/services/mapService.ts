// mapService.ts
// Service to handle geocoding and fetching points of interest in Vietnam
// Now calls backend API instead of directly calling OSM API

const BACKEND_API_BASE = import.meta.env.VITE_BACKEND_API_BASE || "http://127.0.0.1:8000";

export interface Location {
  name: string;
  lat: number;
  lng: number;
}

export interface PointOfInterest extends Location {
  description: string;
  type: string;
}

// Geocode a place name to coordinates using backend API
export async function geocodePlaceName(placeName: string): Promise<Location | null> {
  try {
    const response = await fetch(`${BACKEND_API_BASE}/place/geocode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        place_name: placeName,
      }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("NOT_FOUND: Không tìm thấy kết quả");
      }
      if (response.status === 503 || response.status === 504) {
        throw new Error("NETWORK_ERROR: Unable to connect to the server. Please check your internet connection.");
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    console.log("Query:", placeName);
    console.log("Lat/Lon:", data.lat, data.lng);

    return {
      name: data.name,
      lat: data.lat,
      lng: data.lng,
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error("NETWORK_ERROR: Unable to connect to backend. Please ensure the backend server is running.");
    }
    throw error; // Re-throw to let App.tsx handle it
  }
}

// Fetch points of interest using backend API
export async function findPointsOfInterest(
  lat: number,
  lng: number,
  radiusM: number = 10000
): Promise<PointOfInterest[]> {
  try {
    const response = await fetch(`${BACKEND_API_BASE}/place/poi`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lat: lat,
        lng: lng,
        radius_m: radiusM,
      }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "No points of interest found in this area");
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const pois: PointOfInterest[] = await response.json();
    console.log("Found POIs:", pois);
    return pois;
  } catch (error) {
    console.error("Error fetching POIs:", error);
    // Re-throw error to let the UI handle it
    throw error;
  }
}
