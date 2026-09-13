export interface QuickAccessService {
  name: string;
  subtitle: string;
  icon: string;
  route: string;
  badge?: string;
}

/**
 * 18 Preserved Quick Access Services
 * Structured in an intuitive visual hierarchy:
 * 1. Learning & Academics
 * 2. Islamic Guidance & Resources
 * 3. Daily Practice & Tools
 * 4. Academy Administration & Directory
 */
export const ALL_QUICK_ACCESS_SERVICES: QuickAccessService[] = [
  // ── Learning & Academics ──
  { name: 'My Courses', subtitle: 'Your Learning', icon: 'school-outline', route: '/(tabs)/courses' },
  { name: 'Live Classes', subtitle: 'Join a Class', icon: 'videocam-outline', route: '/live-class' },
  { name: 'Dars Audio', subtitle: 'Class Recordings', icon: 'headset-outline', route: '/recordings' },
  { name: 'Quiz', subtitle: 'Test Knowledge', icon: 'help-circle-outline', route: '/(tabs)/quiz' },
  { name: 'Flashcards', subtitle: 'Revise & Memorize', icon: 'layers-outline', route: '/flashcards' },

  // ── Islamic Guidance & Resources ──
  { name: 'Quran Karim', subtitle: 'Read & Listen', icon: 'book-outline', route: '/quran' },
  { name: 'Library', subtitle: 'Islamic Resources', icon: 'library-outline', route: '/(tabs)/library' },
  { name: 'Dar-ul-Iftaa', subtitle: 'Islamic Guidance', icon: 'shield-checkmark-outline', route: '/fatawa' },
  { name: 'AI Sabaq Tutor', subtitle: '24/7 Study Partner', icon: 'sparkles-outline', route: '/ai-assistant' },

  // ── Daily Practice & Tools ──
  { name: 'Prayer Times', subtitle: 'Daily Prayers', icon: 'time-outline', route: '/prayer-times' },
  { name: 'Qibla Finder', subtitle: 'Find Direction', icon: 'compass-outline', route: '/qibla' },
  { name: 'Smart Tasbeeh', subtitle: 'Digital Dhikr', icon: 'finger-print-outline', route: '/tasbeeh' },
  { name: 'Taharat Tracker', subtitle: 'Private Purity Log', icon: 'water-outline', route: '/taharat-tracker' },
  { name: 'Hijri Calendar', subtitle: 'Islamic Dates', icon: 'calendar-outline', route: '/islamic-calendar' },

  // ── Academy Administration & Services ──
  { name: 'Sanad / Cert', subtitle: 'Your Records', icon: 'ribbon-outline', route: '/(tabs)/certificate' },
  { name: 'Pay Fees', subtitle: 'Manage Payments', icon: 'wallet-outline', route: '/payment' },
  { name: 'Referral Rewards', subtitle: 'Invite & Earn', icon: 'gift-outline', route: '/referral' },
  { name: 'All Services', subtitle: 'Complete Directory', icon: 'grid-outline', route: '/more' },
];
