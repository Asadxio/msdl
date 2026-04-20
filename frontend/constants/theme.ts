export const COLORS = {
  primary: '#0FA958',
  background: '#F6FAF8',
  surface: '#FFFFFF',
  text: '#132018',
  textMain: '#132018',
  textMuted: '#5F7065',
  border: '#D8E4DC',
  error: '#B42318',
  success: '#0FA958',
  // Backward-compat aliases to keep existing screens functional.
  primaryLight: '#3ABB7A',
  secondary: '#0FA958',
  secondaryLight: '#E6F7EE',
  surfaceAlt: '#F1F6F3',
  goldBg: '#E6F7EE',
  goldText: '#0C8A49',
};

export const SPACING = {
  xs: 8,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 24,
  xxl: 32,
};

export const RADIUS = {
  sm: 12,
  md: 12,
  lg: 16,
  xl: 16,
  xxl: 16,
  full: 999,
};

export const TYPOGRAPHY = {
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 30,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700' as const,
    lineHeight: 26,
  },
  body: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 18,
  },
};

export const SHADOWS = {
  card: {
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  header: {
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
};

export const COURSES = [
  {
    id: '1',
    name: 'Darse Nizami (Alima Course)',
    teacherId: '1',
    teacher: 'Alima Fazila Sumra Fatma Qadri',
    description: 'A comprehensive 8-year Islamic scholarship program covering Quran, Hadith, Fiqh, Arabic grammar, logic, and Islamic philosophy. This course prepares students to become qualified Islamic scholars.',
    schedule: 'Mon–Fri, 9:00 AM – 12:00 PM',
  },
  {
    id: '2',
    name: 'Chahal Hadith',
    teacherId: '1',
    teacher: 'Alima Fazila Sumra Fatma Qadri',
    description: 'Study of the 40 essential Hadith (Chahal Hadith) that form the foundation of Islamic practice and belief. Students learn the chain of narration, meaning, and practical application.',
    schedule: 'Tue & Thu, 4:00 PM – 5:30 PM',
  },
  {
    id: '3',
    name: 'Tajweed Course',
    teacherId: '2',
    teacher: 'Alima Fazila Firdos Fatma',
    description: 'Master the rules of Quranic recitation (Tajweed) including proper pronunciation, articulation points, and characteristics of letters. Perfect your Quran recitation.',
    schedule: 'Mon–Wed–Fri, 3:00 PM – 4:30 PM',
  },
  {
    id: '4',
    name: 'Nazra Course',
    teacherId: '2',
    teacher: 'Alima Fazila Firdos Fatma',
    description: 'Learn to read the Holy Quran fluently with correct pronunciation. This foundational course covers basic Arabic reading skills and Quranic recitation practice.',
    schedule: 'Mon–Fri, 2:00 PM – 3:00 PM',
  },
  {
    id: '5',
    name: 'Madni Qaida Course',
    teacherId: '2',
    teacher: 'Alima Fazila Firdos Fatma',
    description: 'A beginner-friendly course using the Madni Qaida method to teach Arabic alphabets, vowels, and basic Quran reading skills from scratch.',
    schedule: 'Mon–Fri, 10:00 AM – 11:00 AM',
  },
  {
    id: '6',
    name: 'Qirat Course',
    teacherId: '2',
    teacher: 'Alima Fazila Firdos Fatma',
    description: 'Advanced Quranic recitation course focusing on the different styles of Quran reading. Students learn melodious and proper recitation techniques.',
    schedule: 'Sat & Sun, 10:00 AM – 12:00 PM',
  },
  {
    id: '7',
    name: 'Bahare Shariat Course',
    teacherId: '1',
    teacher: 'Alima Fazila Sumra Fatma Qadri',
    description: 'Comprehensive study of Islamic jurisprudence (Fiqh) based on the Bahare Shariat text. Covers worship, transactions, family law, and daily Islamic rulings.',
    schedule: 'Mon–Wed–Fri, 5:00 PM – 6:30 PM',
  },
  {
    id: '8',
    name: 'Farze Uloom',
    teacherId: '3',
    teacher: 'Alima Fazila Afnaz Razvi',
    description: 'Essential Islamic knowledge that every Muslim must learn. Covers obligatory acts of worship, basic beliefs, and fundamental Islamic rulings.',
    schedule: 'Tue & Thu, 11:00 AM – 12:30 PM',
  },
  {
    id: '9',
    name: 'Muballigah Course',
    teacherId: '3',
    teacher: 'Alima Fazila Afnaz Razvi',
    description: 'Training course for Islamic preachers and educators. Learn effective methods of Islamic teaching, public speaking, and community guidance.',
    schedule: 'Sat, 2:00 PM – 5:00 PM',
  },
  {
    id: '10',
    name: 'Deeniyat Course',
    teacherId: '3',
    teacher: 'Alima Fazila Afnaz Razvi',
    description: 'A structured Islamic studies program covering daily prayers, Islamic etiquette, moral values, and essential religious knowledge for everyday life.',
    schedule: 'Mon–Fri, 4:00 PM – 5:00 PM',
  },
  {
    id: '11',
    name: 'Tafseer Course',
    teacherId: '1',
    teacher: 'Alima Fazila Sumra Fatma Qadri',
    description: 'In-depth study of Quranic interpretation (Tafseer). Understand the meaning, context, and wisdom behind the verses of the Holy Quran.',
    schedule: 'Tue & Thu, 5:30 PM – 7:00 PM',
  },
  {
    id: '12',
    name: 'Urdu Course',
    teacherId: '3',
    teacher: 'Alima Fazila Afnaz Razvi',
    description: 'Learn to read, write, and speak Urdu fluently. Essential for understanding Islamic texts, poetry, and literature written in the Urdu language.',
    schedule: 'Mon–Wed–Fri, 1:00 PM – 2:00 PM',
  },
  {
    id: '13',
    name: 'Sahabiyat wa Sahliyat ke Ala Ausaf',
    teacherId: '1',
    teacher: 'Alima Fazila Sumra Fatma Qadri',
    description: 'Study the noble qualities and inspiring lives of the female companions (Sahabiyat) and pious women of Islam. Draw inspiration from their exemplary character.',
    schedule: 'Sat, 10:00 AM – 12:00 PM',
  },
  {
    id: '14',
    name: 'Kids Deeniyat Course',
    teacherId: '3',
    teacher: 'Alima Fazila Afnaz Razvi',
    description: 'A fun and engaging Islamic studies program designed for children. Covers basic duas, Islamic stories, good manners, and love for Allah and His Prophet ﷺ.',
    schedule: 'Mon–Fri, 3:30 PM – 4:30 PM',
  },
];

export const TEACHERS = [
  {
    id: '1',
    name: 'Alima Fazila Sumra Fatma Qadri',
    title: 'Alima Fazila',
    bio: 'A dedicated scholar with years of experience in Islamic education. Specializes in Darse Nizami, Tafseer, and Hadith studies. She has guided hundreds of students on the path of knowledge and has a deep passion for nurturing the next generation of Islamic scholars.',
    courseIds: ['1', '2', '7', '11', '13'],
  },
  {
    id: '2',
    name: 'Alima Fazila Firdos Fatma',
    title: 'Alima Fazila',
    bio: 'An accomplished teacher known for her expertise in Tajweed and Qirat. Passionate about helping students perfect their recitation of the Holy Quran. Her melodious recitation and patient teaching style have earned her great respect among students and peers.',
    courseIds: ['3', '4', '5', '6'],
  },
  {
    id: '3',
    name: 'Alima Fazila Afnaz Razvi',
    title: 'Alima Fazila',
    bio: 'A knowledgeable educator with a deep understanding of Islamic jurisprudence and community education. She inspires students through her engaging teaching of Deeniyat, Fiqh, and practical Islamic knowledge. Known for her warm and approachable teaching style.',
    courseIds: ['8', '9', '10', '12', '14'],
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

// Helper to get teacher avatar by index
export function getTeacherAvatar(teacherId: string): string {
  return teacherId === '2' ? MEDIA.teacherAvatar2 : MEDIA.teacherAvatar1;
}

// Helper to get courses for a teacher
export function getCoursesForTeacher(teacherId: string) {
  return COURSES.filter((c) => c.teacherId === teacherId);
}

// Helper to get course image
export function getCourseImage(index: number): string {
  return index % 2 === 0 ? MEDIA.coursePlaceholder1 : MEDIA.coursePlaceholder2;
}
