export interface QuickAccessService {
  name: string;
  subtitle: string;
  icon: string;
  route: string;
  badge?: string;
}

export const ALL_QUICK_ACCESS_SERVICES: QuickAccessService[] = [
  { name: 'Quran Karim', subtitle: 'Read & Listen', icon: 'book-outline', route: '/quran' },
  { name: 'My Courses', subtitle: 'Your Learning', icon: 'school-outline', route: '/(tabs)/courses' },
  { name: 'Taharat Tracker', subtitle: 'Private Purity Log', icon: 'heart-outline', route: '/taharat-tracker' },
  { name: 'AI Sabaq Tutor', subtitle: '24/7 Study Partner', icon: 'sparkles-outline', route: '/ai-assistant' },
  { name: 'Flashcards', subtitle: 'Revise & Memorize', icon: 'card-outline', route: '/flashcards' },
  { name: 'Dar-ul-Iftaa', subtitle: 'Islamic Guidance', icon: 'shield-checkmark-outline', route: '/fatawa' },
  { name: 'Referral Rewards', subtitle: 'Invite & Earn', icon: 'gift-outline', route: '/referral' },
  { name: 'Smart Tasbeeh', subtitle: 'Digital Dhikr', icon: 'finger-print-outline', route: '/tasbeeh' },
  { name: 'Sanad / Cert', subtitle: 'Your Records', icon: 'ribbon-outline', route: '/(tabs)/certificate' },
  { name: 'Pay Fees', subtitle: 'Manage Payments', icon: 'card-outline', route: '/payment' },
  { name: 'Live Classes', subtitle: 'Join a Class', icon: 'videocam-outline', route: '/live-class' },
  { name: 'Dars Audio', subtitle: 'Class Recordings', icon: 'headset-outline', route: '/recordings' },
  { name: 'Library', subtitle: 'Islamic Resources', icon: 'library-outline', route: '/(tabs)/library' },
  { name: 'Quiz', subtitle: 'Test Knowledge', icon: 'help-circle-outline', route: '/(tabs)/quiz' },
  { name: 'Prayer Times', subtitle: 'Daily Prayers', icon: 'time-outline', route: '/prayer-times' },
  { name: 'Qibla Finder', subtitle: 'Find Direction', icon: 'compass-outline', route: '/qibla' },
  { name: 'Hijri Calendar', subtitle: 'Islamic Dates', icon: 'calendar-outline', route: '/islamic-calendar' },
  { name: 'All Services', subtitle: 'Complete Directory', icon: 'grid-outline', route: '/more' },
];
