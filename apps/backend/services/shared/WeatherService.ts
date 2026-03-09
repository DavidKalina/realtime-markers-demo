import type { RedisService } from "./RedisService";

export interface HourlyForecast {
  hour: number; // 0-23
  tempF: number;
  feelsLikeF: number;
  precipProbability: number; // 0-100
  precipMm: number;
  windSpeedMph: number;
  windGustsMph: number;
  uvIndex: number;
  weatherCode: number;
  condition: string; // human-readable
}

export interface DayForecast {
  date: string; // YYYY-MM-DD
  sunrise: string; // HH:MM
  sunset: string; // HH:MM
  tempHighF: number;
  tempLowF: number;
  precipProbabilityMax: number;
  uvIndexMax: number;
  dominantCondition: string;
  hourly: HourlyForecast[];
}

export interface WeatherService {
  getForecast(
    lat: number,
    lng: number,
    date: string,
  ): Promise<DayForecast | null>;
}

interface WeatherServiceDeps {
  redisService: RedisService;
}

const CACHE_TTL = 3 * 60 * 60; // 3 hours
const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

// WMO weather codes → human-readable conditions
const WMO_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

class WeatherServiceImpl implements WeatherService {
  private redisService: RedisService;

  constructor(deps: WeatherServiceDeps) {
    this.redisService = deps.redisService;
  }

  async getForecast(
    lat: number,
    lng: number,
    date: string,
  ): Promise<DayForecast | null> {
    const cacheKey = `weather:${lat.toFixed(2)}:${lng.toFixed(2)}:${date}`;
    const client = this.redisService.getClient();

    // Check cache
    const cached = await client.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Corrupted cache, refetch
      }
    }

    try {
      const params = new URLSearchParams({
        latitude: lat.toFixed(4),
        longitude: lng.toFixed(4),
        start_date: date,
        end_date: date,
        hourly: [
          "temperature_2m",
          "apparent_temperature",
          "precipitation_probability",
          "precipitation",
          "weather_code",
          "wind_speed_10m",
          "wind_gusts_10m",
          "uv_index",
        ].join(","),
        daily: [
          "temperature_2m_max",
          "temperature_2m_min",
          "precipitation_probability_max",
          "uv_index_max",
          "sunrise",
          "sunset",
          "weather_code",
        ].join(","),
        temperature_unit: "fahrenheit",
        wind_speed_unit: "mph",
        precipitation_unit: "mm",
        timezone: "auto",
      });

      const response = await fetch(`${OPEN_METEO_URL}?${params}`, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        console.error(
          `[WeatherService] Open-Meteo returned ${response.status}`,
        );
        return null;
      }

      const data = (await response.json()) as OpenMeteoResponse;

      if (!data.hourly || !data.daily) {
        console.warn("[WeatherService] No forecast data returned");
        return null;
      }

      const hourly: HourlyForecast[] = data.hourly.time.map(
        (time: string, i: number) => {
          const hour = new Date(time).getHours();
          const code = data.hourly.weather_code[i] ?? 0;
          return {
            hour,
            tempF: Math.round(data.hourly.temperature_2m[i] ?? 0),
            feelsLikeF: Math.round(data.hourly.apparent_temperature[i] ?? 0),
            precipProbability: data.hourly.precipitation_probability[i] ?? 0,
            precipMm: data.hourly.precipitation[i] ?? 0,
            windSpeedMph: Math.round(data.hourly.wind_speed_10m[i] ?? 0),
            windGustsMph: Math.round(data.hourly.wind_gusts_10m[i] ?? 0),
            uvIndex: data.hourly.uv_index[i] ?? 0,
            weatherCode: code,
            condition: WMO_CODES[code] || "Unknown",
          };
        },
      );

      const dailyCode = data.daily.weather_code?.[0] ?? 0;
      const sunrise = data.daily.sunrise?.[0] ?? "";
      const sunset = data.daily.sunset?.[0] ?? "";

      const forecast: DayForecast = {
        date,
        sunrise: sunrise ? sunrise.split("T")[1]?.slice(0, 5) : "06:00",
        sunset: sunset ? sunset.split("T")[1]?.slice(0, 5) : "18:00",
        tempHighF: Math.round(data.daily.temperature_2m_max?.[0] ?? 0),
        tempLowF: Math.round(data.daily.temperature_2m_min?.[0] ?? 0),
        precipProbabilityMax:
          data.daily.precipitation_probability_max?.[0] ?? 0,
        uvIndexMax: data.daily.uv_index_max?.[0] ?? 0,
        dominantCondition: WMO_CODES[dailyCode] || "Unknown",
        hourly,
      };

      // Cache
      await client.setex(cacheKey, CACHE_TTL, JSON.stringify(forecast));

      console.log(
        `[WeatherService] Forecast for ${date}: ${forecast.tempLowF}-${forecast.tempHighF}°F, ${forecast.dominantCondition}`,
      );

      return forecast;
    } catch (err) {
      console.error("[WeatherService] Fetch failed:", err);
      return null;
    }
  }
}

interface OpenMeteoResponse {
  hourly: {
    time: string[];
    temperature_2m: number[];
    apparent_temperature: number[];
    precipitation_probability: number[];
    precipitation: number[];
    weather_code: number[];
    wind_speed_10m: number[];
    wind_gusts_10m: number[];
    uv_index: number[];
  };
  daily: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    uv_index_max: number[];
    sunrise: string[];
    sunset: string[];
    weather_code: number[];
  };
}

export function createWeatherService(deps: WeatherServiceDeps): WeatherService {
  return new WeatherServiceImpl(deps);
}
