import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  StatusBar,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  useColorScheme,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import {
  COLORS,
  SPACING,
  RADIUS,
  SHADOWS,
  MEDIA,
  getCourseImage,
  getTeacherAvatar,
} from "@/constants/theme";
import { useData } from "@/context/DataContext";
import { db } from "@/lib/firebase";
import { EmptyState, ScalePressable, SkeletonCard } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { normalizeGoogleDriveFileUrl } from "@/lib/links";

const DEFAULT_ANNOUNCEMENT_TITLE = "Enrollment Open for 2025";
const DEFAULT_ANNOUNCEMENT_DESC =
  "Admissions are now open for all courses. Register today and begin your journey of Islamic knowledge.";

type PrayerName = "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";
type PrayerTime = { name: PrayerName; time: Date; label: string };
type PrayerCalculationSettings = {
  method: string;
  fajrAngle: number;
  ishaAngle: number;
  asrFactor: 1 | 2;
};
type LocationDetails = {
  city: string;
  state: string;
  country: string;
  timezone: string;
  gmt: string;
  elevation: string;
  latitude: number;
  longitude: number;
  permission: "idle" | "requesting" | "granted" | "denied" | "unavailable";
};
type DevicePosition = {
  coords: {
    latitude: number;
    longitude: number;
    altitude?: number | null;
  };
};
type ReverseGeocodePlace = {
  city?: string | null;
  district?: string | null;
  subregion?: string | null;
  region?: string | null;
  country?: string | null;
  isoCountryCode?: string | null;
};

declare const require: ((moduleName: string) => any) | undefined;
type IslamicTheme = {
  id: string;
  name: string;
  accent: string;
  secondary: string;
};

const PRAYER_METHODS: Record<string, PrayerCalculationSettings> = {
  muslimWorldLeague: {
    method: "Muslim World League",
    fajrAngle: 18,
    ishaAngle: 17,
    asrFactor: 1,
  },
  egyptian: {
    method: "Egyptian General Authority",
    fajrAngle: 19.5,
    ishaAngle: 17.5,
    asrFactor: 1,
  },
  karachi: {
    method: "University of Islamic Sciences, Karachi",
    fajrAngle: 18,
    ishaAngle: 18,
    asrFactor: 2,
  },
  ummAlQura: {
    method: "Umm al-Qura, Makkah",
    fajrAngle: 18.5,
    ishaAngle: 90 / 60,
    asrFactor: 1,
  },
  northAmerica: {
    method: "ISNA / North America",
    fajrAngle: 15,
    ishaAngle: 15,
    asrFactor: 1,
  },
};

const ISLAMIC_THEMES: IslamicTheme[] = [
  {
    id: "emerald",
    name: "Emerald Mosque",
    image:
      "https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=1200&q=85",
    tint: "rgba(4,47,46,0.78)",
    accent: "#D4AF37",
    secondary: "#34D399",
  },
  {
    id: "noor",
    name: "Noor Nights",
    image:
      "https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&w=1200&q=85",
    tint: "rgba(15,23,42,0.76)",
    accent: "#F8D77A",
    secondary: "#93C5FD",
  },
  {
    id: "safa",
    name: "Safa Dawn",
    image:
      "https://images.unsplash.com/photo-1564769625905-50e93615e769?auto=format&fit=crop&w=1200&q=85",
    tint: "rgba(120,53,15,0.64)",
    accent: "#FDE68A",
    secondary: "#FED7AA",
  },
];

const FALLBACK_LOCATION: LocationDetails = {
  city: "Location unavailable",
  state: "Permission needed",
  country: "Using device timezone",
  timezone:
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Local timezone",
  gmt: formatGmtOffset(new Date()),
  elevation: "—",
  latitude: 21.4225,
  longitude: 39.8262,
  permission: "idle",
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}
function normalizeHour(value: number) {
  return ((value % 24) + 24) % 24;
}
function dayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}
function getPrayerCalculationSettings(
  country?: string,
): PrayerCalculationSettings {
  const normalizedCountry = (country || "").toLowerCase();
  if (/(pakistan|india|bangladesh|afghanistan)/.test(normalizedCountry)) {
    return PRAYER_METHODS.karachi;
  }
  if (/(saudi|arabia|makkah|mecca)/.test(normalizedCountry)) {
    return PRAYER_METHODS.ummAlQura;
  }
  if (/(egypt|sudan)/.test(normalizedCountry)) {
    return PRAYER_METHODS.egyptian;
  }
  if (/(united states|usa|canada|america)/.test(normalizedCountry)) {
    return PRAYER_METHODS.northAmerica;
  }
  return PRAYER_METHODS.muslimWorldLeague;
}
function solarDeclination(date: Date) {
  return 23.45 * Math.sin(toRadians((360 / 365) * (284 + dayOfYear(date))));
}
function asrZenith(date: Date, latitude: number, asrFactor: 1 | 2) {
  const declination = solarDeclination(date);
  const angle = toDegrees(
    Math.atan(
      1 / (asrFactor + Math.tan(toRadians(Math.abs(latitude - declination)))),
    ),
  );
  return 90 - angle;
}
function formatClock(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function formatGmtOffset(date: Date) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  return `GMT${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}
function decimalToDate(base: Date, decimalHour: number) {
  const date = new Date(base);
  date.setHours(0, 0, 0, 0);
  date.setMinutes(Math.round(normalizeHour(decimalHour) * 60));
  return date;
}
function solarTime(
  date: Date,
  latitude: number,
  longitude: number,
  zenith: number,
  afterNoon: boolean,
) {
  const n = dayOfYear(date);
  const lngHour = longitude / 15;
  const t = n + ((afterNoon ? 18 : 6) - lngHour) / 24;
  const m = 0.9856 * t - 3.289;
  let l =
    m +
    1.916 * Math.sin(toRadians(m)) +
    0.02 * Math.sin(toRadians(2 * m)) +
    282.634;
  l = ((l % 360) + 360) % 360;
  let ra = toDegrees(Math.atan(0.91764 * Math.tan(toRadians(l))));
  ra = ((ra % 360) + 360) % 360;
  const lQuadrant = Math.floor(l / 90) * 90;
  const raQuadrant = Math.floor(ra / 90) * 90;
  ra = (ra + (lQuadrant - raQuadrant)) / 15;
  const sinDec = 0.39782 * Math.sin(toRadians(l));
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH =
    (Math.cos(toRadians(zenith)) - sinDec * Math.sin(toRadians(latitude))) /
    (cosDec * Math.cos(toRadians(latitude)));
  if (cosH > 1 || cosH < -1) return afterNoon ? 18 : 6;
  const h =
    (afterNoon
      ? toDegrees(Math.acos(cosH))
      : 360 - toDegrees(Math.acos(cosH))) / 15;
  const localMean = h + ra - 0.06571 * t - 6.622;
  const utc = localMean - lngHour;
  return normalizeHour(utc + -date.getTimezoneOffset() / 60);
}
function calculatePrayerTimes(
  date: Date,
  latitude: number,
  longitude: number,
  settings: PrayerCalculationSettings = PRAYER_METHODS.muslimWorldLeague,
): PrayerTime[] {
  const sunrise = solarTime(date, latitude, longitude, 90.833, false);
  const sunset = solarTime(date, latitude, longitude, 90.833, true);
  const dhuhr = normalizeHour((sunrise + sunset) / 2 + 0.05);
  const ishaTime =
    settings.method === PRAYER_METHODS.ummAlQura.method
      ? normalizeHour(sunset + settings.ishaAngle)
      : solarTime(date, latitude, longitude, 90 + settings.ishaAngle, true);
  const times: PrayerTime[] = [
    {
      name: "Fajr",
      time: decimalToDate(
        date,
        solarTime(date, latitude, longitude, 90 + settings.fajrAngle, false),
      ),
      label: "",
    },
    { name: "Dhuhr", time: decimalToDate(date, dhuhr), label: "" },
    {
      name: "Asr",
      time: decimalToDate(
        date,
        solarTime(
          date,
          latitude,
          longitude,
          asrZenith(date, latitude, settings.asrFactor),
          true,
        ),
      ),
      label: "",
    },
    { name: "Maghrib", time: decimalToDate(date, sunset + 0.03), label: "" },
    {
      name: "Isha",
      time: decimalToDate(date, ishaTime),
      label: "",
    },
  ];
  return times.map((item) => ({ ...item, label: formatClock(item.time) }));
}
function getPrayerWindow(
  prayers: PrayerTime[],
  now: Date,
  latitude: number,
  longitude: number,
  settings: PrayerCalculationSettings,
) {
  const today = prayers;
  const tomorrow = calculatePrayerTimes(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
    latitude,
    longitude,
    settings,
  );
  const previous =
    [...today].reverse().find((item) => item.time <= now) ||
    today[today.length - 1];
  const next = today.find((item) => item.time > now) || tomorrow[0];
  const prevTime =
    previous.time <= now
      ? previous.time
      : new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 1,
          previous.time.getHours(),
          previous.time.getMinutes(),
        );
  const duration = Math.max(1, next.time.getTime() - prevTime.getTime());
  const elapsed = Math.max(0, now.getTime() - prevTime.getTime());
  return { current: previous, next, progress: Math.min(1, elapsed / duration) };
}
function getHijriDate(date: Date) {
  try {
    return new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-u-ca-islamic", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }
}
function getExpoLocationModule() {
  if (Platform.OS === "web" || typeof require !== "function") return null;
  try {
    return require("expo-location");
  } catch {
    return null;
  }
}
function requestBrowserLocation(): Promise<DevicePosition | null> {
  const geolocation = (globalThis.navigator as any)?.geolocation;
  if (!geolocation?.getCurrentPosition) return Promise.resolve(null);
  return new Promise((resolve) => {
    geolocation.getCurrentPosition(resolve, () => resolve(null), {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 300000,
    });
  });
}
async function requestDeviceLocation(): Promise<{
  position: DevicePosition | null;
  place: ReverseGeocodePlace | null;
  permission: LocationDetails["permission"];
}> {
  const Location = getExpoLocationModule();
  if (!Location) {
    const browserPosition = await requestBrowserLocation();
    return {
      position: browserPosition,
      place: null,
      permission: browserPosition
        ? "granted"
        : Platform.OS === "web"
          ? "denied"
          : "unavailable",
    };
  }

  const existingPermission = await Location.getForegroundPermissionsAsync();
  const permission =
    existingPermission?.status === "granted"
      ? existingPermission
      : await Location.requestForegroundPermissionsAsync();
  if (permission?.status !== "granted") {
    return { position: null, place: null, permission: "denied" };
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy?.Balanced ?? 3,
    mayShowUserSettingsDialog: true,
    timeInterval: 60000,
  });
  let place: ReverseGeocodePlace | null = null;
  try {
    const reverse = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    place = reverse?.[0] ?? null;
  } catch {
    place = null;
  }
  return { position, place, permission: "granted" };
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { courses, teachers, loading, getResumeLearning, getCourseProgress } =
    useData();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const safeCourses = Array.isArray(courses) ? courses : [];
  const safeTeachers = Array.isArray(teachers) ? teachers : [];
  const featuredCourses = safeCourses.slice(0, 5);
  const [announcementTitle, setAnnouncementTitle] = useState(
    DEFAULT_ANNOUNCEMENT_TITLE,
  );
  const [announcementMessage, setAnnouncementMessage] = useState(
    DEFAULT_ANNOUNCEMENT_DESC,
  );
  const [noticeModalVisible, setNoticeModalVisible] = useState(false);
  const [noticeDraftTitle, setNoticeDraftTitle] = useState("");
  const [noticeDraftMessage, setNoticeDraftMessage] = useState("");
  const [savingNotice, setSavingNotice] = useState(false);
  const [useCustomNotice, setUseCustomNotice] = useState(false);
  const colorScheme = useColorScheme();
  const [now, setNow] = useState(() => new Date());
  const [themeIndex, setThemeIndex] = useState(0);
  const [locationDetails, setLocationDetails] =
    useState<LocationDetails>(FALLBACK_LOCATION);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const locationRequestRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  const requestLocation = async () => {
    if (locationRequestRef.current) return;
    locationRequestRef.current = true;
    setLocationDetails((current) => ({ ...current, permission: "requesting" }));
    try {
      const { position, place, permission } = await requestDeviceLocation();
      if (!position) {
        setLocationDetails((current) => ({
          ...current,
          permission,
        }));
        return;
      }

      const { latitude, longitude, altitude } = position.coords;
      let resolvedPlace = {
        city:
          place?.city ||
          place?.district ||
          place?.subregion ||
          "Detected location",
        state: place?.region || place?.subregion || "State unavailable",
        country:
          place?.country || place?.isoCountryCode || "Prayer times localized",
      };

      if (!place && Platform.OS === "web") {
        try {
          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
          );
          const data = await response.json();
          resolvedPlace = {
            city:
              data.city ||
              data.locality ||
              data.principalSubdivision ||
              "Detected location",
            state:
              data.principalSubdivision ||
              data.localityInfo?.administrative?.[1]?.name ||
              "State unavailable",
            country:
              data.countryName || data.countryCode || "Country unavailable",
          };
        } catch {
          // Keep coordinate-based prayer times even if reverse geocoding is unavailable.
        }
      }

      setLocationDetails({
        city: resolvedPlace.city,
        state: resolvedPlace.state,
        country: resolvedPlace.country,
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || "Local timezone",
        gmt: formatGmtOffset(new Date()),
        elevation:
          typeof altitude === "number" ? `${Math.round(altitude)} m` : "—",
        latitude,
        longitude,
        permission: "granted",
      });
    } finally {
      locationRequestRef.current = false;
    }
  };

  useEffect(() => {
    requestLocation().catch(() => {
      setLocationDetails((current) => ({
        ...current,
        permission: "unavailable",
      }));
    });
  }, []);

  useEffect(() => {
    const loadNotice = async () => {
      try {
        const snap = await getDoc(doc(db, "app_settings", "platform"));
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const title = String(data.notice_title || "").trim();
        const message = String(data.notice_message || "").trim();
        if (title || message) {
          setAnnouncementTitle(title || DEFAULT_ANNOUNCEMENT_TITLE);
          setAnnouncementMessage(message || DEFAULT_ANNOUNCEMENT_DESC);
          setUseCustomNotice(true);
        }
      } catch {
        // ignore and fallback to announcement stream
      }
    };
    loadNotice().catch(() => {});
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "notifications"),
      where("user_id", "==", "all"),
      orderBy("created_at", "desc"),
      limit(20),
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const latestAnnouncement = snapshot.docs
        .map(
          (docItem) =>
            docItem.data() as {
              title?: string;
              message?: string;
              category?: string;
            },
        )
        .find(
          (item) =>
            item.category === "announcement" ||
            item.title?.toLowerCase().includes("announcement"),
        );

      if (!useCustomNotice) {
        setAnnouncementTitle(
          latestAnnouncement?.title?.trim() || DEFAULT_ANNOUNCEMENT_TITLE,
        );
        setAnnouncementMessage(
          latestAnnouncement?.message?.trim() || DEFAULT_ANNOUNCEMENT_DESC,
        );
      }
    });
    return unsub;
  }, [useCustomNotice]);

  const isDefaultAnnouncement = useMemo(
    () =>
      announcementTitle === DEFAULT_ANNOUNCEMENT_TITLE &&
      announcementMessage === DEFAULT_ANNOUNCEMENT_DESC,
    [announcementMessage, announcementTitle],
  );
  const selectedIslamicTheme =
    ISLAMIC_THEMES[themeIndex % ISLAMIC_THEMES.length];
  const prayerSettings = useMemo(
    () => getPrayerCalculationSettings(locationDetails.country),
    [locationDetails.country],
  );
  const prayerTimes = calculatePrayerTimes(
    now,
    locationDetails.latitude,
    locationDetails.longitude,
    prayerSettings,
  );
  const prayerWindow = getPrayerWindow(
    prayerTimes,
    now,
    locationDetails.latitude,
    locationDetails.longitude,
    prayerSettings,
  );
  const hijriDate = getHijriDate(now);
  const gregorianDate = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const countdown = formatDuration(
    prayerWindow.next.time.getTime() - now.getTime(),
  );
  const progressDegrees = Math.round(prayerWindow.progress * 360);
  const isDarkMode = colorScheme === "dark";
  const resumeLearning = useMemo(
    () => getResumeLearning(),
    [getResumeLearning],
  );
  const openNoticeEditor = () => {
    setNoticeDraftTitle(announcementTitle);
    setNoticeDraftMessage(announcementMessage);
    setNoticeModalVisible(true);
  };

  const saveNotice = async () => {
    if (!isAdmin) return;
    if (!noticeDraftTitle.trim() || !noticeDraftMessage.trim()) {
      Alert.alert("Missing fields", "Notice title and message are required.");
      return;
    }
    setSavingNotice(true);
    try {
      await setDoc(
        doc(db, "app_settings", "platform"),
        {
          notice_title: noticeDraftTitle.trim(),
          notice_message: noticeDraftMessage.trim(),
          updated_at: serverTimestamp(),
        },
        { merge: true },
      );
      setAnnouncementTitle(noticeDraftTitle.trim());
      setAnnouncementMessage(noticeDraftMessage.trim());
      setUseCustomNotice(true);
      setNoticeModalVisible(false);
    } catch {
      Alert.alert("Save failed", "Could not update notice.");
    } finally {
      setSavingNotice(false);
    }
  };
  const safePush = (path: string) => {
    try {
      if (!path || typeof path !== "string") return;
      router.push(path as any);
    } catch {
      // no-op: navigation safety guard
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        {/* Header Section */}
        <View style={styles.headerWrapper}>
          <Image
            source={{ uri: MEDIA.homeHeaderBg }}
            style={styles.headerBgImage}
          />
          <View style={[styles.headerOverlay, { paddingTop: insets.top + 20 }]}>
            <Text style={styles.greeting} testID="greeting-text">
              السلام عليكم
            </Text>
            <Text style={styles.welcomeText}>Welcome to</Text>
            <Text style={styles.madrasaName} testID="madrasa-name">
              Madars tus salikat Lilbanat{"\n"}مدرسۃ السالکات للبنات
            </Text>
            <View style={styles.taglineRow}>
              <View style={styles.goldLine} />
              <Text style={styles.tagline}>Nurturing Knowledge & Faith</Text>
              <View style={styles.goldLine} />
            </View>
          </View>
        </View>

                {/* Loading State */}
        {loading ? (
          <View style={styles.loadingBlock} testID="home-loading">
            <SkeletonCard lines={2} />
          </View>
        ) : null}

        {/* Featured Courses */}
        {resumeLearning ? (
          <View style={[styles.section, { paddingHorizontal: SPACING.lg }]}>
            <Text style={[styles.sectionTitle, { marginBottom: SPACING.md }]}>
              Resume Learning
            </Text>
            <ScalePressable
              style={styles.resumeCard}
              onPress={() => {
                if (!resumeLearning?.courseId) return;
                safePush(`/course/${resumeLearning.courseId}`);
              }}
              testID="resume-learning-card"
            >
              <Ionicons
                name="play-circle-outline"
                size={26}
                color={COLORS.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.resumeCourse}>
                  {resumeLearning.courseName}
                </Text>
                <Text style={styles.resumeLesson}>
                  {resumeLearning.moduleTitle} • {resumeLearning.lessonTitle}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={COLORS.textMuted}
              />
            </ScalePressable>
          </View>
        ) : null}

        {/* Featured Courses */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Courses</Text>
            <TouchableOpacity
              testID="view-all-courses-btn"
              onPress={() => safePush("/courses")}
            >
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          {featuredCourses.length === 0 ? (
            <EmptyState
              icon="book-outline"
              message="No featured courses available."
            />
          ) : (
            <View style={styles.verticalList}>
              {featuredCourses.map((item, index) => {
                const progress = getCourseProgress(item.id);
                return (
                  <ScalePressable
                    key={item.id}
                    style={styles.courseCard}
                    testID={`featured-course-card-${item.id}`}
                    onPress={() => {
                      if (!item?.id) return;
                      safePush(`/course/${item.id}`);
                    }}
                  >
                    <Image
                      source={{ uri: getCourseImage(index) }}
                      style={styles.courseCardImage}
                    />
                    <View style={styles.courseCardContent}>
                      <Text style={styles.courseCardName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text style={styles.courseCardTeacher} numberOfLines={1}>
                        {item.teacher_name}
                      </Text>
                      <View style={styles.courseProgressRow}>
                        <Text style={styles.courseProgressLabel}>
                          Progress {progress.completionPercent}%
                        </Text>
                      </View>
                      <View style={styles.courseProgressTrack}>
                        <View
                          style={[
                            styles.courseProgressFill,
                            {
                              width: `${Math.min(100, Math.max(0, progress.completionPercent))}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </ScalePressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Teachers Preview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Our Teachers</Text>
            <TouchableOpacity
              testID="view-all-teachers-btn"
              onPress={() => safePush("/teachers")}
            >
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          {safeTeachers.length === 0 ? (
            <EmptyState
              icon="people-outline"
              message="No teachers available."
            />
          ) : (
            <FlatList
              horizontal
              data={safeTeachers}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              testID="teachers-preview-scroll"
              initialNumToRender={6}
              maxToRenderPerBatch={8}
              windowSize={5}
              renderItem={({ item }) => (
                <ScalePressable
                  style={styles.teacherPreviewCard}
                  testID={`teacher-preview-${item.id}`}
                  onPress={() => {
                    if (!item?.id) return;
                    safePush(`/teacher/${item.id}`);
                  }}
                >
                  <Image
                    source={{
                      uri: item.photo_url
                        ? normalizeGoogleDriveFileUrl(item.photo_url)
                        : getTeacherAvatar(item.id),
                    }}
                    style={styles.teacherAvatar}
                  />
                  <Text style={styles.teacherPreviewName} numberOfLines={1}>
                    {item.name.split(" ").slice(-2).join(" ")}
                  </Text>
                  <View style={styles.teacherTitleBadge}>
                    <Text style={styles.teacherTitleText}>{item.title}</Text>
                  </View>
                </ScalePressable>
              )}
            />
          )}
        </View>

        {/* Announcements */}
        <View style={[styles.section, { paddingHorizontal: SPACING.lg }]}>
          <View style={[styles.sectionHeader, { marginBottom: SPACING.md }]}>
            <Text style={styles.sectionTitle}>Announcements</Text>
            {isAdmin ? (
              <TouchableOpacity onPress={openNoticeEditor}>
                <Text style={styles.viewAllText}>Edit Notice</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.announcementCard} testID="announcement-card">
            <View style={styles.announcementContent}>
              <View style={styles.announcementBadge}>
                <Ionicons name="megaphone" size={14} color={COLORS.goldText} />
                <Text style={styles.announcementBadgeText}>
                  {isDefaultAnnouncement ? "New" : "Live"}
                </Text>
              </View>
              <Text style={styles.announcementTitle}>{announcementTitle}</Text>
              <Text style={styles.announcementDesc}>{announcementMessage}</Text>
              <TouchableOpacity
                style={styles.announcementBtn}
                testID="learn-more-btn"
                onPress={() => safePush("/notifications")}
              >
                <Text style={styles.announcementBtnText}>
                  Open Announcements
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={COLORS.goldText}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <Modal
          visible={noticeModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setNoticeModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Edit Home Notice</Text>
              <TextInput
                style={styles.modalInput}
                value={noticeDraftTitle}
                onChangeText={setNoticeDraftTitle}
                placeholder="Notice title"
                placeholderTextColor={COLORS.textMuted}
              />
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={noticeDraftMessage}
                onChangeText={setNoticeDraftMessage}
                placeholder="Notice message"
                placeholderTextColor={COLORS.textMuted}
                multiline
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalBtnGhost}
                  onPress={() => setNoticeModalVisible(false)}
                >
                  <Text style={styles.modalBtnGhostText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalBtnPrimary}
                  onPress={saveNotice}
                  disabled={savingNotice}
                >
                  {savingNotice ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalBtnPrimaryText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Quick Stats */}
        <View style={[styles.section, { paddingHorizontal: SPACING.lg }]}>
          <View style={styles.statsRow}>
            <View style={styles.statCard} testID="stat-courses">
              <Text style={styles.statNumber}>{safeCourses.length}</Text>
              <Text style={styles.statLabel}>Courses</Text>
            </View>
            <View style={styles.statCard} testID="stat-teachers">
              <Text style={styles.statNumber}>{safeTeachers.length}</Text>
              <Text style={styles.statLabel}>Teachers</Text>
            </View>
            <View style={styles.statCard} testID="stat-students">
              <Text style={styles.statNumber}>100+</Text>
              <Text style={styles.statLabel}>Students</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerWrapper: { height: 284, position: "relative" },
  headerBgImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 24,
    backgroundColor: "rgba(6,78,59,0.82)",
  },
  greeting: {
    fontSize: 28,
    color: COLORS.secondary,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  welcomeText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  madrasaName: {
    fontSize: 22,
    color: "#FFFFFF",
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 30,
    marginTop: 4,
  },
  taglineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 10,
  },
  goldLine: { width: 30, height: 1.5, backgroundColor: COLORS.secondary },
  tagline: {
    color: COLORS.secondary,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: SPACING.md,
  },
  loadingBlock: { paddingHorizontal: SPACING.lg },
  loadingText: { fontSize: 13, color: COLORS.textMuted, fontWeight: "500" },
  section: { marginTop: SPACING.lg },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: COLORS.textMain },
  viewAllText: { fontSize: 14, fontWeight: "600", color: COLORS.secondary },
  horizontalList: {
    paddingLeft: SPACING.lg,
    paddingRight: SPACING.sm,
    gap: SPACING.md,
  },
  verticalList: { paddingHorizontal: SPACING.lg, gap: SPACING.md },
  courseCard: {
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    ...SHADOWS.card,
    backgroundColor: COLORS.surface,
  },
  courseCardImage: { width: "100%", height: 118 },
  courseCardContent: { padding: SPACING.md, gap: 4 },
  courseCardName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textMain,
    marginBottom: 2,
  },
  courseCardTeacher: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  courseProgressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  courseProgressLabel: {
    fontSize: 11,
    color: COLORS.textMain,
    fontWeight: "700",
  },
  courseProgressTrack: {
    height: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceAlt,
    marginTop: 4,
    overflow: "hidden",
  },
  courseProgressFill: {
    height: "100%",
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
  },
  teacherPreviewCard: { alignItems: "center", width: 110, gap: 8 },
  teacherAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: COLORS.secondary,
  },
  teacherPreviewName: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMain,
    textAlign: "center",
  },
  teacherTitleBadge: {
    backgroundColor: COLORS.goldBg,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  teacherTitleText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.goldText,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  announcementCard: {
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  lanternIcon: {
    position: "absolute",
    right: -10,
    top: -10,
    width: 110,
    height: 110,
    opacity: 0.12,
    zIndex: 1,
  },
  announcementContent: { padding: SPACING.lg },
  announcementBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.goldBg,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    marginBottom: 12,
  },
  announcementBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.goldText,
  },
  announcementTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: COLORS.textMain,
    marginBottom: 8,
  },
  announcementDesc: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 22,
    marginBottom: 16,
  },
  announcementBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  announcementBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.goldText,
  },
  statsRow: { flexDirection: "row", gap: SPACING.md },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: "center",
    ...SHADOWS.card,
  },
  statNumber: { fontSize: 24, fontWeight: "800", color: COLORS.primary },
  statLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.textMuted,
    marginTop: 2,
  },
  dashboardOuter: {
    marginHorizontal: SPACING.lg,
    marginTop: -22,
    borderRadius: 28,
    overflow: "hidden",
    minHeight: 430,
    backgroundColor: COLORS.primary,
    ...SHADOWS.card,
  },
  dashboardBgImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  dashboardTint: { ...StyleSheet.absoluteFillObject },
  dashboardContent: { padding: SPACING.md, gap: SPACING.md },
  dashboardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  dashboardEyebrow: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  dashboardTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4,
    lineHeight: 24,
  },
  dashboardSubtitle: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  themeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  themeButtonText: { fontSize: 11, fontWeight: "800" },
  prayerHeroRow: {
    flexDirection: "row",
    gap: SPACING.md,
    alignItems: "stretch",
  },
  countdownMeter: {
    width: 152,
    height: 152,
    borderRadius: 76,
    borderWidth: 4,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  meterProgressHint: {
    position: "absolute",
    top: -8,
    width: 10,
    height: 46,
    borderRadius: RADIUS.full,
    opacity: 0.86,
  },
  currentPrayerLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  currentPrayerName: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 1,
  },
  nextPrayerText: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  countdownText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  glassPanel: {
    flex: 1,
    borderRadius: 24,
    padding: SPACING.md,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    justifyContent: "center",
  },
  glassPanelDark: { backgroundColor: "rgba(15,23,42,0.30)" },
  panelLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  locationTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 5,
  },
  locationSubtitle: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  locationMetaGrid: { marginTop: SPACING.sm, gap: 3 },
  locationMeta: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 11,
    fontWeight: "700",
  },
  locationButton: {
    marginTop: SPACING.sm,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(6,78,59,0.86)",
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  locationButtonText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  prayerTimesRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  prayerPill: {
    flexGrow: 1,
    minWidth: "30%",
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  prayerPillName: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  prayerPillTime: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: SPACING.md,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: COLORS.textMain },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: COLORS.textMain,
    backgroundColor: COLORS.surfaceAlt,
  },
  modalTextArea: { minHeight: 90, textAlignVertical: "top" },
  modalActions: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  modalBtnGhost: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalBtnGhostText: { color: COLORS.textMain, fontWeight: "700" },
  modalBtnPrimary: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalBtnPrimaryText: { color: "#fff", fontWeight: "700" },
  resumeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  resumeCourse: { fontSize: 15, fontWeight: "700", color: COLORS.textMain },
  resumeLesson: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
});
