const WEATHER_CACHE_DURATION = 30 * 60 * 1000;
let weatherCache = null;
let cacheTimestamp = 0;

const simulateWeatherData = () => {
  const now = new Date();
  const hour = now.getHours();
  const month = now.getMonth();
  
  const isRainySeason = month >= 5 && month <= 9;
  const isDaytime = hour >= 6 && hour <= 20;
  
  const baseRainChance = isRainySeason ? 0.3 : 0.1;
  const rainChance = baseRainChance + (Math.random() * 0.2);
  const isRaining = Math.random() < rainChance;
  
  const baseHumidity = isRainySeason ? 70 : 50;
  const humidity = baseHumidity + (Math.random() * 20) - 10;
  
  return {
    isRaining,
    humidity: Math.max(0, Math.min(100, humidity)),
    temperature: 20 + (Math.random() * 15),
    timestamp: Date.now()
  };
};

export const getWeatherData = async () => {
  const now = Date.now();
  
  if (weatherCache && (now - cacheTimestamp) < WEATHER_CACHE_DURATION) {
    return weatherCache;
  }
  
  try {
    const weather = simulateWeatherData();
    weatherCache = weather;
    cacheTimestamp = now;
    return weather;
  } catch (error) {
    return {
      isRaining: false,
      humidity: 50,
      temperature: 20,
      timestamp: Date.now()
    };
  }
};

export const getWeatherRiskBoost = (weather) => {
  let boost = 0;
  
  if (weather.isRaining) {
    boost += 15;
  }
  
  if (weather.humidity > 75) {
    boost += 8;
  } else if (weather.humidity > 60) {
    boost += 4;
  }
  
  return boost;
};

export const isWeatherCritical = (weather) => {
  return weather.isRaining || weather.humidity > 75;
};

