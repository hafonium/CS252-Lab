// Map.tsx
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  Tooltip,
} from "react-leaflet";
import L from "leaflet";
import { useEffect, useState } from "react";
import type { PointOfInterest } from "../services/mapService";
import type { WeatherData } from "../services/openWeatherService";
import { getWeatherByCoordinates } from "../services/openWeatherService";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface MapProps {
  center: [number, number];
  pointsOfInterest: PointOfInterest[];
}

// Component to handle map centering
function MapController({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(center, 13, {
      duration: 1.5, // Animation duration in seconds
    });
    
    // Close all popups when map changes
    map.closePopup();
  }, [center, map]);

  return null;
}

export default function Map({ center, pointsOfInterest }: MapProps) {
  const [poiWeather, setPoiWeather] = useState<{ [key: string]: WeatherData | null }>({});

  // Fetch weather for each POI
  useEffect(() => {
    const fetchPoiWeather = async () => {
      const weatherMap: { [key: string]: WeatherData | null } = {};
      for (let i = 0; i < pointsOfInterest.length; i++) {
        const poi = pointsOfInterest[i];
        try {
          const data = await getWeatherByCoordinates(poi.lat, poi.lng);
          weatherMap[i.toString()] = data;
        } catch (error) {
          console.warn(`Failed to fetch weather for POI ${i}:`, error);
          weatherMap[i.toString()] = null;
        }
      }
      setPoiWeather(weatherMap);
    };

    if (pointsOfInterest.length > 0) {
      fetchPoiWeather();
    }
    
    // No need to close popups here anymore
    // MapController will handle it when center changes
  }, [pointsOfInterest]);

  // Get weather icon URL
  const getWeatherIconUrl = (iconCode: string) => {
    return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
  };

  return (
    <MapContainer center={center} zoom={13} scrollWheelZoom={true}>
      <MapController center={center} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Center marker
      <Marker position={center}>
        <Popup>
          <div>
            <h3>Selected Location</h3>
            <p>Latitude: {center[0].toFixed(4)}</p>
            <p>Longitude: {center[1].toFixed(4)}</p>
          </div>
        </Popup>
      </Marker> */}

      {pointsOfInterest.map((poi, index) => (
        <Marker key={index} position={[poi.lat, poi.lng]}>
          <Tooltip 
            permanent 
            direction="top" 
            offset={[0, -10]} 
            className="poi-label"
          >
            {poi.name} {poiWeather[index.toString()] && (
              <span className="weather-icon-label">
                <img 
                  src={`https://openweathermap.org/img/wn/${poiWeather[index.toString()]!.icon_code}.png`}
                  alt="weather"
                />
              </span>
            )}
          </Tooltip>
          <Popup autoClose={false} closeButton={true}>
            <div className="poi-popup">
              <h3>{poi.name}</h3>
              <p>
                <strong>Type:</strong> {poi.type}
              </p>
              <p>
                <strong>Description:</strong> {poi.description}
              </p>
              <p className="coordinates">
                Lat: {poi.lat.toFixed(4)}, Lng: {poi.lng.toFixed(4)}
              </p>
              
              {poiWeather[index.toString()] && (
                <div className="poi-weather">
                  <h4>Local Weather</h4>
                  <div className="weather-icon-popup">
                    <img 
                      src={getWeatherIconUrl(poiWeather[index.toString()]!.icon_code)} 
                      alt="weather"
                    />
                  </div>
                  <p><strong>Condition:</strong> {poiWeather[index.toString()]!.main}</p>
                  <p><strong>Temperature:</strong> {poiWeather[index.toString()]!.temperature}°C</p>
                  <p><strong>Description:</strong> {poiWeather[index.toString()]!.description}</p>
                  <p><strong>Humidity:</strong> {poiWeather[index.toString()]!.humidity}%</p>
                  <p><strong>Wind Speed:</strong> {poiWeather[index.toString()]!.windSpeed} m/s</p>
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
