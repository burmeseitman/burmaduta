import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fetchWeather } from '../services/api';
import { WeatherData } from '../services/types';

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    fetchWeather().then(setWeather);
    const interval = setInterval(() => {
      fetchWeather().then(setWeather);
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!weather) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{weather.icon}</Text>
      <Text style={styles.temp}>{weather.temp}°C</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(20, 20, 25, 0.85)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  icon: {
    fontSize: 16,
  },
  temp: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600',
  },
});
