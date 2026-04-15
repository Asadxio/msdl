export const COLORS = {
  primary: '#0F3822',
  primaryLight: '#1A5C3A',
  secondary: '#D4AF37',
  secondaryLight: '#F0D98D',
  background: '#FDFBF7',
  surface: '#FFFFFF',
  surfaceAlt: '#F2F6F4',
  textMain: '#111827',
  textMuted: '#4B5563',
  border: '#E5E7EB',
  error: '#991B1B',
  success: '#166534',
  goldBg: '#FDF8E7',
  goldText: '#B8860B',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const SHADOWS = {
  card: {
    shadowColor: '#0F3822',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  header: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
};

export const COURSES = [
  { id: '1', name: 'Darse Nizami (Alima Course)', teacher: 'Alima Fazila Sumra Fatma Qadri' },
  { id: '2', name: 'Chahal Hadith', teacher: 'Alima Fazila Firdos Fatma' },
  { id: '3', name: 'Tajweed Course', teacher: 'Alima Fazila Afnaz Razvi' },
  { id: '4', name: 'Nazra Course', teacher: 'Alima Fazila Sumra Fatma Qadri' },
  { id: '5', name: 'Madni Qaida Course', teacher: 'Alima Fazila Firdos Fatma' },
  { id: '6', name: 'Qirat Course', teacher: 'Alima Fazila Afnaz Razvi' },
  { id: '7', name: 'Bahare Shariat Course', teacher: 'Alima Fazila Sumra Fatma Qadri' },
  { id: '8', name: 'Farze Uloom', teacher: 'Alima Fazila Firdos Fatma' },
  { id: '9', name: 'Muballigah Course', teacher: 'Alima Fazila Afnaz Razvi' },
  { id: '10', name: 'Deeniyat Course', teacher: 'Alima Fazila Sumra Fatma Qadri' },
  { id: '11', name: 'Tafseer Course', teacher: 'Alima Fazila Firdos Fatma' },
  { id: '12', name: 'Urdu Course', teacher: 'Alima Fazila Afnaz Razvi' },
  { id: '13', name: 'Sahabiyat wa Sahliyat ke Ala Ausaf', teacher: 'Alima Fazila Sumra Fatma Qadri' },
  { id: '14', name: 'Kids Deeniyat Course', teacher: 'Alima Fazila Firdos Fatma' },
];

export const TEACHERS = [
  {
    id: '1',
    name: 'Alima Fazila Sumra Fatma Qadri',
    title: 'Alima Fazila',
    bio: 'A dedicated scholar with years of experience in Islamic education. Specializes in Darse Nizami and Hadith studies, guiding students on the path of knowledge.',
  },
  {
    id: '2',
    name: 'Alima Fazila Firdos Fatma',
    title: 'Alima Fazila',
    bio: 'An accomplished teacher known for her expertise in Tajweed and Qirat. Passionate about helping students perfect their recitation of the Holy Quran.',
  },
  {
    id: '3',
    name: 'Alima Fazila Afnaz Razvi',
    title: 'Alima Fazila',
    bio: 'A knowledgeable educator with a deep understanding of Islamic jurisprudence. Inspires students through her engaging teaching of Bahare Shariat and Fiqh.',
  },
];

export const BOOKS = [
  { id: '1', title: 'Sahih Al-Bukhari', category: 'Hadith' },
  { id: '2', title: 'Tafseer Ibn Kathir', category: 'Tafseer' },
  { id: '3', title: 'Bahare Shariat', category: 'Fiqh' },
  { id: '4', title: 'Fazail-e-Amaal', category: 'Virtues' },
  { id: '5', title: 'Nurul Idah', category: 'Hanafi Fiqh' },
  { id: '6', title: 'Riyad-us-Saliheen', category: 'Hadith' },
  { id: '7', title: 'Mishkat al-Masabih', category: 'Hadith' },
  { id: '8', title: 'Ihya Ulum al-Din', category: 'Spirituality' },
];

export const MEDIA = {
  homeHeaderBg: 'https://static.prod-images.emergentagent.com/jobs/36a7bbf8-4a30-4199-91bf-2bd5ed2b328a/images/903e0b1c37fb16d675cdf7dd4e2625b8c6101fda8a82b16836b0ca6e261601b7.png',
  teacherAvatar1: 'https://static.prod-images.emergentagent.com/jobs/36a7bbf8-4a30-4199-91bf-2bd5ed2b328a/images/3d6c675cea0fd1e796a9b9c887130c6304fab0bf46817bb073faffc774a7b191.png',
  teacherAvatar2: 'https://static.prod-images.emergentagent.com/jobs/36a7bbf8-4a30-4199-91bf-2bd5ed2b328a/images/17e500d46e33c4a4953841eb2e3678c065896907cec6f145604db4f1e488e42a.png',
  lanternIcon: 'https://static.prod-images.emergentagent.com/jobs/36a7bbf8-4a30-4199-91bf-2bd5ed2b328a/images/3d7ca5f6b18e8f18adea6822ba0ef258edebebcf6023d79b04822052edd2aa5d.png',
  coursePlaceholder1: 'https://images.unsplash.com/photo-1720701574998-d68020bce2bd?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODR8MHwxfHNlYXJjaHwyfHxxdXJhbiUyMG1hbnVzY3JpcHR8ZW58MHx8fHwxNzc2MjQyNjA0fDA&ixlib=rb-4.1.0&q=85',
  coursePlaceholder2: 'https://images.unsplash.com/photo-1772368872233-4539a0b63f2a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODR8MHwxfHNlYXJjaHw0fHxxdXJhbiUyMG1hbnVzY3JpcHR8ZW58MHx8fHwxNzc2MjQyNjA0fDA&ixlib=rb-4.1.0&q=85',
};
