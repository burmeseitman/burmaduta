import { NewsItem, WeatherData } from './types';

// Always use production API for testing since backend is on a remote server
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.burmaduta.com';

const API_KEY = process.env.EXPO_PUBLIC_API_KEY || '';

const WEATHER_API_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=16.8661&longitude=96.1951&current=temperature_2m,weather_code,is_day';

const weatherCodeMap: Record<number, { icon: string; night: string; label: string }> = {
  0: { icon: '☀️', night: '🌙', label: 'Clear' },
  1: { icon: '🌤️', night: '🌙', label: 'Mainly Clear' },
  2: { icon: '⛅', night: '☁️', label: 'Partly Cloudy' },
  3: { icon: '☁️', night: '☁️', label: 'Overcast' },
  45: { icon: '🌫️', night: '🌫️', label: 'Fog' },
  48: { icon: '🌫️', night: '🌫️', label: 'Fog' },
  51: { icon: '🌦️', night: '🌧️', label: 'Drizzle' },
  53: { icon: '🌦️', night: '🌧️', label: 'Drizzle' },
  55: { icon: '🌦️', night: '🌧️', label: 'Drizzle' },
  61: { icon: '🌧️', night: '🌧️', label: 'Rain' },
  63: { icon: '🌧️', night: '🌧️', label: 'Rain' },
  65: { icon: '🌧️', night: '🌧️', label: 'Heavy Rain' },
  80: { icon: '🌦️', night: '🌧️', label: 'Showers' },
  81: { icon: '🌦️', night: '🌧️', label: 'Showers' },
  82: { icon: '🌧️', night: '🌧️', label: 'Violent Showers' },
  95: { icon: '⛈️', night: '⛈️', label: 'Thunderstorm' },
};

function normalizeCategory(rawType: string): string {
  const t = (rawType || 'အထွေထွေ').trim();
  if (t.includes('စစ်ရေး') || t === 'တိုက်ပွဲသတင်း') return 'စစ်ရေးသတင်း';
  if (t.includes('မှုခင်း')) return 'မှုခင်းသတင်း';
  if (t.includes('မတော်တဆ') || t.includes('ယာဉ်တိုက်မှု')) return 'မတော်တဆဖြစ်မှု';
  if (t.includes('သဘာဝဘေး')) return 'သဘာဝဘေးအန္တရာယ်';
  return 'အထွေထွေ';
}

export async function fetchNews(days: number = 90): Promise<NewsItem[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/news?days=${days}`, {
      headers: {
        'X-API-Key': API_KEY
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.map((item: any) => ({
      ...item,
      crime_type: normalizeCategory(item.crime_type),
    }));
  } catch (error) {
    console.error('Error fetching news:', error);
    throw error;
  }
}

export async function fetchWeather(): Promise<WeatherData> {
  try {
    const response = await fetch(WEATHER_API_URL);
    const data = await response.json();
    const temp = Math.round(data.current.temperature_2m);
    const code = data.current.weather_code;
    const isDay = data.current.is_day;
    const weather = weatherCodeMap[code] || { icon: '🌡️', night: '🌡️', label: 'Unknown' };
    return {
      temp,
      icon: isDay === 1 ? weather.icon : weather.night,
      label: weather.label,
    };
  } catch (error) {
    console.error('Error fetching weather:', error);
    return { temp: 0, icon: '🌡️', label: 'Unknown' };
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      headers: {
        'X-API-Key': API_KEY
      }
    });
    const data = await response.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}
