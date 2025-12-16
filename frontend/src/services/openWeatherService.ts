const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
const URL = "https://api.openweathermap.org/data/2.5/weather";

if (!API_KEY) {
  throw new Error("Please add your OpenWeather API key in the environment variables.");
}

export interface WeatherData {
  main: string;
  temperature: number;
  description: string;
  humidity: number;
  windSpeed: number;
  icon_code: string;
}

export async function getWeatherByCoordinates(lat: number, lon: number): Promise<any> {
  const params = {
    "lat": lat.toString(),
    "lon": lon.toString(),
    "appid": API_KEY,
    "units": "metric"
  }

  try {
    const response = await fetch(`${URL}?${new URLSearchParams(params)}`);
    
    if (!response.ok) {
      if (response.status === 503 || response.status === 504) {
        throw new Error("NETWORK_ERROR: Weather service temporarily unavailable. Please check your internet connection.");
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      main: data.weather[0].main,
      temperature: data.main.temp,
      description: data.weather[0].description,
      humidity: data.main.humidity,
      windSpeed: data.wind.speed,
      icon_code: data.weather[0].icon,
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      console.error("Network error:", error);
      throw new Error("NETWORK_ERROR: Unable to connect to weather service. Please check your internet connection.");
    }
    console.error("Error fetching weather data:", error);
    throw error;
  }
}