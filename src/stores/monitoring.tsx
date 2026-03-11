import { create } from "zustand";

import { getAllUsers } from "@/api/api";
type MonitoringState = {
  temperature: number | null;
  humidity: number | null;
  weatherCode: number | null; // weather condition code from Open-Meteo
  waveHeight: number | null;
  loading: boolean;
  fetchMonitoringData: () => Promise<void>;
};

type UserStatsState = {
  totalUsers: number;
  loading: boolean;
  fetchUserStats: () => Promise<void>;
};

export const useUserStats = create<UserStatsState>((set) => ({
  totalUsers: 0,
  loading: false,

  fetchUserStats: async () => {
    set({ loading: true });
    try {
      const users = await getAllUsers();
      if (users && Array.isArray(users)) {
        set({ totalUsers: users.length });
      }
    } catch (error) {
      console.error("Failed to fetch user stats:", error);
    } finally {
      set({ loading: false });
    }
  },
}));

export const Monitoring = create<MonitoringState>((set) => ({
  temperature: null,
  humidity: null,
  weatherCode: null,
  waveHeight: null,
  loading: false,

  fetchMonitoringData: async () => {
    set({ loading: true });
    try {
      const latitude = 11.2043;
      const longitude = 123.7409;

      // Fetch weather data
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,relative_humidity_2m,weathercode&current_weather=true`;
      const weatherRes = await fetch(weatherUrl);
      if (!weatherRes.ok) throw new Error("Failed to fetch weather data");
      const weatherData = await weatherRes.json();

      // Fetch marine data
      const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&hourly=wave_height`;
      const marineRes = await fetch(marineUrl);
      if (!marineRes.ok) throw new Error("Failed to fetch marine data");
      const marineData = await marineRes.json();

      const temperature = weatherData.current_weather?.temperature ?? null;
      const weatherCode = weatherData.current_weather?.weathercode ?? null;

      // For humidity take first hourly value
      const humidity = weatherData.hourly?.relative_humidity_2m?.[0] ?? null;

      // For wave height take first hourly value
      const waveHeight = marineData.hourly?.wave_height?.[0] ?? null;

      set({
        temperature,
        humidity,
        weatherCode,
        waveHeight,
      });
    } catch (error) {
      console.error("Failed to fetch monitoring data:", error);
      set({
        temperature: null,
        humidity: null,
        weatherCode: null,
        waveHeight: null,
      });
    } finally {
      set({ loading: false });
    }
  },
}));
