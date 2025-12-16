import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Map from "../components/Map";
import ChatBot from "../components/ChatBot";
import type { PointOfInterest } from "../services/mapService";
import { geocodePlaceName, findPointsOfInterest } from "../services/mapService";
import { getWeatherByCoordinates } from "../services/openWeatherService";
import type { WeatherData } from "../services/openWeatherService";
import { translateToVietnamese } from "../services/googleTranslateService";
import { logOut, getUserProfile, getCurrentUser } from "../services/firebaseService";
import type { UserProfile } from "../services/firebaseService";

export default function MapPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getCurrentUser());
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [center, setCenter] = useState<[number, number]>([21.0285, 105.8542]);
  const [pointsOfInterest, setPointsOfInterest] = useState<PointOfInterest[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [poiWeatherList, setPoiWeatherList] = useState<{ [key: string]: WeatherData | null }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [translateInput, setTranslateInput] = useState("");
  const [translateResult, setTranslateResult] = useState("");
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState("");

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      navigate('/login');
      return;
    }

    if (!currentUser.emailVerified) {
      navigate('/verify-email');
      return;
    }

    setUser(currentUser);
    
    // Load user profile
    getUserProfile(currentUser.uid).then(profile => {
      setUserProfile(profile);
    });
  }, [navigate]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim()) {
      setError("Please enter a place name");
      return;
    }

    setLoading(true);
    setError("");
    // Clear old data when starting a new search
    setPointsOfInterest([]);
    setWeather(null);
    setPoiWeatherList({});

    try {
      const location = await geocodePlaceName(inputValue);

      if (location) {
        const newCenter: [number, number] = [location.lat, location.lng];
        setCenter(newCenter);

        const pois = await findPointsOfInterest(location.lat, location.lng, 500);
        console.log("Found POIs:", pois);
        setPointsOfInterest(pois);
        const weatherData = await getWeatherByCoordinates(location.lat, location.lng);
        console.log("Current weather:", weatherData);
        setWeather(weatherData);
      } else {
        setError(`Could not find "${inputValue}" in Vietnam`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      if (errorMessage.includes("NETWORK_ERROR")) {
        setError("Network Error: Please check your internet connection and try again.");
      } else if (errorMessage.includes("NOT_FOUND")) {
        setError(`Place not found: "${inputValue}" could not be found in Vietnam. Please try another location.`);
      } else if (errorMessage.includes("AbortError") || errorMessage.includes("timeout")) {
        setError("Request timeout: The server took too long to respond. Please check your internet connection.");
      } else {
        setError("An error occurred while searching. Please try again.");
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTranslate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!translateInput.trim()) {
      setTranslateError("Please enter some text to translate");
      return;
    }

    setTranslating(true);
    setTranslateError("");
    setTranslateResult("");

    try {
      const result = await translateToVietnamese(translateInput);
      setTranslateResult(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setTranslateError(errorMessage);
      console.error("[Google Translate Error]", err);
    } finally {
      setTranslating(false);
    }
  };

  useEffect(() => {
    const fetchPoiWeatherList = async () => {
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
      setPoiWeatherList(weatherMap);
    };

    if (pointsOfInterest.length > 0) {
      fetchPoiWeatherList();
    }
  }, [pointsOfInterest]);

  const handleLogout = async () => {
    try {
      await logOut();
      navigate('/login');
    } catch (err) {
      console.error('[Logout Error]', err);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="App">
      <div className="container">
        <div className="sidebar">
          <div className="sidebar-header">
            <h1>Vietnam Explorer</h1>
            <div className="user-info">
              <button 
                className="username-button" 
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                {userProfile?.username || 'User'}
                <span className="dropdown-arrow">▼</span>
              </button>
              {showUserMenu && (
                <div className="user-menu-dropdown">
                  <div className="user-menu-item">
                    <strong>Username:</strong> {userProfile?.username || 'N/A'}
                  </div>
                  <div className="user-menu-item">
                    <strong>Full Name:</strong> {userProfile?.fullName || user.displayName || 'N/A'}
                  </div>
                  <div className="user-menu-item">
                    <strong>Email:</strong> {user.email}
                  </div>
                  <div className="user-menu-item">
                    <strong>Date of Birth:</strong> {userProfile?.dateOfBirth || 'N/A'}
                  </div>
                  <div className="user-menu-item">
                    <strong>Member Since:</strong> {userProfile?.createdAt ? new Date(userProfile.createdAt).toLocaleDateString() : 'N/A'}
                  </div>
                  <button onClick={handleLogout} className="logout-button-menu">
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              placeholder="Enter a place in Vietnam (e.g., Hanoi, Da Nang, Ho Chi Minh City)"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="search-input"
              disabled={loading}
            />
            <button type="submit" className="search-button" disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </button>
          </form>

          {error && <div className="error-message">{error}</div>}

          {weather && (
            <div className="weather-info">
              <h2>Current Weather</h2>
              <div className="weather-icon-display">
                <img 
                  src={`https://openweathermap.org/img/wn/${weather.icon_code}@2x.png`} 
                  alt="weather"
                />
              </div>
              <div className="weather-details">
                <p><strong>Condition:</strong> {weather.main}</p>
                <p><strong>Temperature:</strong> {weather.temperature}°C</p>
                <p><strong>Description:</strong> {weather.description}</p>
                <p><strong>Humidity:</strong> {weather.humidity}%</p>
                <p><strong>Wind Speed:</strong> {weather.windSpeed} m/s</p>
              </div>
            </div>
          )}

          <div className="translate-box">
            <h2>English to Vietnamese</h2>
            <form onSubmit={handleTranslate} className="translate-form">
              <textarea
                placeholder="Enter English text here..."
                value={translateInput}
                onChange={(e) => setTranslateInput(e.target.value)}
                className="translate-input"
                disabled={translating}
                rows={3}
              />
              <button type="submit" className="translate-button" disabled={translating}>
                {translating ? "Translating..." : "Translate"}
              </button>
            </form>

            {translateError && <div className="error-message">{translateError}</div>}

            {translateResult && (
              <div className="translate-result">
                <h3>Vietnamese Translation:</h3>
                <p>{translateResult}</p>
              </div>
            )}
          </div>

          {loading && (
            <div className="loading-message">
              <p>🔍 Searching for location...</p>
              <p className="loading-subtext">Please wait, fetching POIs...</p>
            </div>
          )}

          {pointsOfInterest.length > 0 && (
            <div className="poi-list">
              <h2>Points of Interest</h2>
              <ul>
                {pointsOfInterest.map((poi, index) => (
                  <li key={index} className="poi-item">
                    <div className="poi-header">
                      <h4>{poi.name}</h4>
                      {poiWeatherList[index.toString()] && (
                        <img 
                          src={`https://openweathermap.org/img/wn/${poiWeatherList[index.toString()]!.icon_code}.png`}
                          alt="weather"
                          className="poi-weather-icon"
                        />
                      )}
                    </div>
                    <p className="poi-type">{poi.type}</p>
                    <p className="poi-description">{poi.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <Map center={center} pointsOfInterest={pointsOfInterest} />
        
        <ChatBot 
          currentCenter={center}
          onSearchResults={(results, lat, lng) => {
            // Convert search results to PointOfInterest format
            const pois: PointOfInterest[] = results.map(r => ({
              name: r.name,
              lat: r.lat,
              lng: r.lng,
              description: r.description,
              type: r.type
            }));
            
            // Update map center and POIs
            setCenter([lat, lng]);
            setPointsOfInterest(pois);
            setError("");
            
            // Fetch weather for the location
            getWeatherByCoordinates(lat, lng).then(weatherData => {
              setWeather(weatherData);
            }).catch(err => {
              console.warn("Failed to fetch weather:", err);
            });
          }}
        />
      </div>
    </div>
  );
}
