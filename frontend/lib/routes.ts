import type { Href } from 'expo-router';

/**
 * MSLB CANONICAL ROUTES REGISTRY
 * 
 * Single source of truth for all application destinations.
 * Fully compatible with Expo Router Href types.
 */
export const ROUTES = {
  // Core workspaces
  home: '/(tabs)' as Href,
  courses: '/(tabs)/courses' as Href,
  courseDetail: (id: string): Href => `/course/${encodeURIComponent(id)}` as Href,
  teacherDetail: (id: string): Href => `/teacher/${encodeURIComponent(id)}` as Href,
  library: '/(tabs)/library' as Href,
  bookDetail: (id: string): Href => `/book/${encodeURIComponent(id)}` as Href,
  chats: '/(tabs)/chats' as Href,
  chatDetail: (id: string): Href => `/chat/${encodeURIComponent(id)}` as Href,
  call: (id: string): Href => `/call/${encodeURIComponent(id)}` as Href,
  liveClasses: '/live-class' as Href,
  liveClassDetail: (id: string): Href => `/live-class/${encodeURIComponent(id)}` as Href,
  notifications: '/(tabs)/notifications' as Href,
  profile: '/(tabs)/about' as Href,
  teachers: '/(tabs)/teachers' as Href,
  quiz: '/(tabs)/quiz' as Href,
  attendance: '/(tabs)/attendance' as Href,
  progress: '/(tabs)/progress' as Href,
  certificate: '/(tabs)/certificate' as Href,

  // App Utilities & Settings
  more: '/more' as Href,
  settings: '/settings' as Href,
  search: '/search' as Href,
  payment: '/payment' as Href,
  paymentHistory: '/payment-history' as Href,
  recordings: '/recordings' as Href,
  referral: '/referral' as Href,
  status: '/status' as Href,
  verifySanad: '/verify-sanad' as Href,

  // Islamic Utilities
  tools: {
    quran: '/quran' as Href,
    quranReader: (surah?: number): Href => (surah ? `/quran-reader?surah=${surah}` : '/quran-reader') as Href,
    prayerTimes: '/prayer-times' as Href,
    qibla: '/qibla' as Href,
    tasbeeh: '/tasbeeh' as Href,
    islamicDashboard: '/islamic-dashboard' as Href,
    islamicCalendar: '/islamic-calendar' as Href,
    taharatTracker: '/taharat-tracker' as Href,
    flashcards: '/flashcards' as Href,
    aiAssistant: '/ai-assistant' as Href,
    fatawa: '/fatawa' as Href,
    fatwaDetail: (id: string): Href => `/fatawa/${encodeURIComponent(id)}` as Href,
    fatawaManage: '/fatawa/manage' as Href,
  },

  // Admin Routes (Explicitly partitioned)
  admin: {
    organizations: '/admin/organizations' as Href, // Super admin only
    organizationSettings: '/admin/organization-settings' as Href, // Institution admin / Super admin
    academics: '/admin/manage-academics' as Href, // Institution admin / Super admin
    users: '/admin/users' as Href, // Institution admin / Super admin
    payments: '/admin/payments' as Href, // Institution admin / Super admin
    security: '/admin/security' as Href, // Analytics/Audit permission
    analytics: '/admin/analytics' as Href, // Analytics permission
    moderation: '/admin/moderation' as Href, // Moderator / Admin / Super admin
    privacyRequests: '/admin/privacy-requests' as Href,
    telemetry: '/admin/telemetry' as Href,
    aiQuizMaker: '/admin/ai-quiz-maker' as Href,
    manageQuizzes: '/admin/manage-quizzes' as Href,
    sendPush: '/admin/send-push' as Href,
    addBook: '/admin/add-book' as Href,
  },

  // Auth Routes
  auth: {
    login: '/auth/login' as Href,
    signup: '/auth/signup' as Href,
    pending: '/auth/pending' as Href,
    forgotPassword: '/auth/forgot-password' as Href,
    changeEmail: '/auth/change-email' as Href,
  },

  // Legal & Onboarding
  legal: {
    legalGate: '/legal-gate' as Href,
    terms: '/terms' as Href,
    privacy: '/privacy' as Href,
    communityGuidelines: '/community-guidelines' as Href,
    dataPrivacy: '/data-privacy' as Href,
  },
  onboarding: {
    entry: '/onboarding-entry' as Href,
    firstTime: '/onboarding-first-time' as Href,
    startMadrasa: '/onboarding/start-madrasa' as Href,
  },

  unauthorized: (requiredRole?: string): Href =>
    (requiredRole ? `/unauthorized?required=${encodeURIComponent(requiredRole)}` : '/unauthorized') as Href,
} as const;
