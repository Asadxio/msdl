import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, Easing, Alert } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, RADIUS, SPACING, SHADOWS } from "@/constants/theme";
import * as Location from "expo-location";
import { calculatePrayerTimes, getPrayerCalculationSettings, PRAYER_METHODS } from "@/lib/prayerTimes";
import {
  loadPrayerSettings,
  subscribeToPrayerSettings,
  savePrayerSettings,
  PrayerSettings,
  DEFAULT_PRAYER_SETTINGS,
} from "@/lib/prayerStorage";

const THEMES = [
  { accent: "#D4AF37", secondary: "#34D399", bg: "#0f3d35" },
  { accent: "#F8D77A", secondary: "#93C5FD", bg: "#1e293b" },
  { accent: "#FDE68A", secondary: "#FED7AA", bg: "#7c2d12" },
];

const hijri = (d: Date) =>
  new Intl.DateTimeFormat("en-TN-u-ca-islamic", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);

export default function IslamicDashboardWidget() {
  const [now, setNow] = useState(new Date());
  const [themeIndex, setThemeIndex] = useState(0);
  const [settings, setSettings] = useState<PrayerSettings>(DEFAULT_PRAYER_SETTINGS);
  const [requesting, setRequesting] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;

  // Sync clock every second
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Soft animation for widget
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [pulse]);

  // Load and subscribe to central prayer settings
  useEffect(() => {
    let active = true;
    const load = async () => {
      const stored = await loadPrayerSettings();
      if (active) setSettings(stored);
    };
    load();

    const unsubscribe = subscribeToPrayerSettings((newSettings) => {
      if (active) setSettings(newSettings);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const theme = THEMES[themeIndex % THEMES.length];

  // Calculate times based on centralized settings
  const { prayers, current, next } = useMemo(() => {
    let calcSettings = PRAYER_METHODS.muslimWorldLeague;
    if (settings.method === 'auto') {
      calcSettings = getPrayerCalculationSettings(settings.country);
    } else if (PRAYER_METHODS[settings.method]) {
      calcSettings = PRAYER_METHODS[settings.method];
    }

    const times = calculatePrayerTimes(now, settings.latitude, settings.longitude, calcSettings, settings.altitude)
      .filter((p) => ["Fajr", "Zuhr", "Asr", "Maghrib", "Isha"].includes(p.name))
      .map((p) => (p.name === "Zuhr" ? { ...p, name: "Dhuhr" } : p));

    const tomorrow = calculatePrayerTimes(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
      settings.latitude,
      settings.longitude,
      calcSettings,
      settings.altitude
    )
      .filter((p) => ["Fajr", "Zuhr", "Asr", "Maghrib", "Isha"].includes(p.name))
      .map((p) => (p.name === "Zuhr" ? { ...p, name: "Dhuhr" } : p));

    const previous = [...times].reverse().find((item) => item.time <= now) || times[times.length - 1];
    const upcoming = times.find((item) => item.time > now) || tomorrow[0];

    return { prayers: times, current: previous, next: upcoming };
  }, [now, settings]);

  const requestLocation = async () => {
    setRequesting(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission Denied", "GPS location permission is required.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const { latitude, longitude, altitude } = pos.coords;
      const rev = await Location.reverseGeocodeAsync({ latitude, longitude });
      const r = rev?.[0] || {};
      
      const city = r.city || r.district || r.subregion || "Unknown city";
      const state = r.region || "Unknown state";
      const country = r.country || "Unknown country";

      const newSettings: PrayerSettings = {
        locationMode: "auto",
        latitude,
        longitude,
        altitude: altitude || 0,
        city,
        state,
        country,
        method: settings.method,
      };

      await savePrayerSettings(newSettings);
    } catch (e) {
      Alert.alert("Error", "Could not resolve location. Please configure it manually in settings.");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: theme.bg }]} testID="islamic-dashboard-widget">
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Islamic Dashboard</Text>
          <Text style={styles.title}>{hijri(now)}</Text>
        </View>
        <TouchableOpacity style={[styles.theme, { borderColor: theme.accent }]} onPress={() => setThemeIndex((i) => i + 1)}>
          <Ionicons name="color-palette-outline" size={16} color={theme.accent} />
          <Text style={[styles.themeTxt, { color: theme.accent }]}>Change Theme</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <Animated.View
          style={[
            styles.meter,
            {
              borderColor: theme.accent,
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) }],
            },
          ]}
        >
          <MaterialCommunityIcons name="mosque" size={30} color={theme.accent} />
          <Text style={styles.current}>{current.name}</Text>
          <Text style={styles.next}>Next {next.name}</Text>
        </Animated.View>
        <View style={styles.panel}>
          <Text style={styles.loc}>{settings.city}</Text>
          <Text style={styles.meta}>
            {settings.state} • {settings.country}
          </Text>
          {settings.locationMode === "auto" && settings.city === "Location unavailable" ? (
            <TouchableOpacity style={styles.locBtn} onPress={requestLocation}>
              {requesting ? <ActivityIndicator color="#fff" /> : <Text style={styles.locBtnTxt}>Enable location</Text>}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      <View style={styles.pills}>
        {prayers.map((p: any) => (
          <View key={p.name} style={[styles.pill, { borderColor: theme.accent }]}>
            <Text style={[styles.pn, { color: theme.accent }]}>{p.name}</Text>
            <Text style={styles.pt}>{p.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12, borderRadius: 24, padding: SPACING.md, ...SHADOWS.card },
  top: { flexDirection: "row", gap: 8 },
  eyebrow: { color: "#ffffffb3", fontSize: 11, fontWeight: "800" },
  title: { color: "#fff", fontSize: 16, fontWeight: "800" },
  theme: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 8, flexDirection: "row", gap: 4, alignItems: "center" },
  themeTxt: { fontSize: 11, fontWeight: "700" },
  row: { marginTop: 12, flexDirection: "row", gap: 10 },
  meter: { width: 130, height: 130, borderRadius: 65, borderWidth: 3, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
  current: { color: "#fff", fontWeight: "800" },
  next: { color: "#ffffffcc", fontSize: 11 },
  panel: { flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 16, padding: 10 },
  loc: { color: "#fff", fontWeight: "700" },
  meta: { color: "#ffffffcc", fontSize: 12, marginTop: 4 },
  locBtn: { marginTop: 8, backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingVertical: 8, alignItems: "center" },
  locBtnTxt: { color: "#fff", fontWeight: "700" },
  pills: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.12)" },
  pn: { fontSize: 11, fontWeight: "700" },
  pt: { color: "#fff", fontSize: 11 },
});
