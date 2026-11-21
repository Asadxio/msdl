import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CourseSubject } from '@/context/DataContext';

export interface CurriculumTemplateCourse {
  name: string;
  schedule: string;
  class_time: string;
  description: string;
  fee: number;
  course_fee: number;
  admission_fee: number;
  subjects: CourseSubject[];
}

export interface CurriculumTemplate {
  id: string;
  title: string;
  titleArabic: string;
  category: 'dars_e_nizami' | 'hifz_tajweed' | 'maktab_essentials';
  description: string;
  badge: string;
  courses: CurriculumTemplateCourse[];
}

export const CURRICULUM_TEMPLATES: CurriculumTemplate[] = [
  {
    id: 'darse_nizami_5yr',
    title: 'Dars-e-Nizami (Aalima Track - 5 Years)',
    titleArabic: 'منهاج درس نظامي (عالمہ کورس - ٥ سالہ)',
    category: 'dars_e_nizami',
    badge: '👑 Comprehensive 5-Year Alimah Track',
    description: 'Complete classical syllabus covering Arabic Grammar (Sarf & Nahw), Fiqh, Hadith, Tafseer, and Islamic Creed across 5 academic years.',
    courses: [
      {
        name: 'Darjah Idadiyya (الدرجة الإعدادية)',
        schedule: 'Mon - Fri',
        class_time: '09:00 AM - 12:00 PM',
        description: 'Preparatory foundation: Urdu reading, Basic Fiqh (Taharat/Salah), and Seerat.',
        fee: 300,
        course_fee: 300,
        admission_fee: 100,
        subjects: [
          { id: 'sub_idad_1', name: 'Madani Qaida & Tajweed Basics', schedule: '09:00 AM' },
          { id: 'sub_idad_2', name: 'Zubaan-e-Urdu & Grammar', schedule: '10:00 AM' },
          { id: 'sub_idad_3', name: 'Namaz & Masaile Taharat', schedule: '11:00 AM' },
        ],
      },
      {
        name: 'Darjah Ula (الدرجة الأولى)',
        schedule: 'Mon - Fri',
        class_time: '08:30 AM - 12:30 PM',
        description: 'First year Dars-e-Nizami: Classical Arabic morphology and syntax.',
        fee: 500,
        course_fee: 500,
        admission_fee: 100,
        subjects: [
          { id: 'sub_ula_1', name: 'Meezan-us-Sarf & Munshaib', schedule: '08:30 AM' },
          { id: 'sub_ula_2', name: 'Nahw Meer (Syntax Foundations)', schedule: '09:30 AM' },
          { id: 'sub_ula_3', name: 'Mukhtasar Al-Quduri (Taharah & Salah)', schedule: '10:30 AM' },
          { id: 'sub_ula_4', name: 'Tareekh-e-Islam & Seerat', schedule: '11:30 AM' },
        ],
      },
      {
        name: 'Darjah Saniya (الدرجة الثانية)',
        schedule: 'Mon - Fri',
        class_time: '08:30 AM - 12:30 PM',
        description: 'Second year Dars-e-Nizami: Intermediate Sarf, Nahw, and Fiqh texts.',
        fee: 500,
        course_fee: 500,
        admission_fee: 100,
        subjects: [
          { id: 'sub_san_1', name: 'Ilm-us-Seeghah (Arabic Morphology)', schedule: '08:30 AM' },
          { id: 'sub_san_2', name: 'Al-Kafiyah fi An-Nahw', schedule: '09:30 AM' },
          { id: 'sub_san_3', name: 'Noor-ul-Idah & Maraqi al-Falah', schedule: '10:30 AM' },
          { id: 'sub_san_4', name: 'Tafseer Surah Yusuf & Amma', schedule: '11:30 AM' },
        ],
      },
      {
        name: 'Darjah Salisa (الدرجة الثالثة)',
        schedule: 'Mon - Fri',
        class_time: '08:00 AM - 01:00 PM',
        description: 'Third year: Advanced Hanafi jurisprudence and Hadith sciences.',
        fee: 500,
        course_fee: 500,
        admission_fee: 100,
        subjects: [
          { id: 'sub_sal_1', name: 'Al-Hidayah (Awwalayn)', schedule: '08:00 AM' },
          { id: 'sub_sal_2', name: 'Sharh Wiqayah', schedule: '09:15 AM' },
          { id: 'sub_sal_3', name: 'Usool ash-Shashi (Jurisprudence Principles)', schedule: '10:30 AM' },
          { id: 'sub_sal_4', name: 'Riyad-us-Saliheen (Imam Nawawi)', schedule: '11:45 AM' },
        ],
      },
      {
        name: 'Darjah Khamsa & Alimah Sanad (الدرجة الخامسة والتخرج)',
        schedule: 'Mon - Fri',
        class_time: '08:00 AM - 01:30 PM',
        description: 'Final graduating year: Mishkat Sharif, Jalalayn, and Aqeedah leading to graduation.',
        fee: 500,
        course_fee: 500,
        admission_fee: 100,
        subjects: [
          { id: 'sub_kham_1', name: 'Mishkat-ul-Masabih (Kutub al-Hadith)', schedule: '08:00 AM' },
          { id: 'sub_kham_2', name: 'Tafseer Al-Jalalayn', schedule: '09:30 AM' },
          { id: 'sub_kham_3', name: 'Al-Aqeedah At-Tahawiyyah', schedule: '11:00 AM' },
          { id: 'sub_kham_4', name: 'As-Sirajiyyah (Inheritance Laws)', schedule: '12:15 PM' },
        ],
      },
    ],
  },
  {
    id: 'hifz_tajweed_track',
    title: 'Hifz-ul-Quran & Tajweed Mastery Track',
    titleArabic: 'مساق تحفيظ القرآن الكريم وإتقان التجويد',
    category: 'hifz_tajweed',
    badge: '📖 Memorization & Tajweed Specialization',
    description: 'Structured 4-stage track from Noorani Qaida and phonetic Makharij to 30-Para Hifz and Qirat.',
    courses: [
      {
        name: 'Noorani Qaida & Phonetic Makharij (قاعدة نورانية ومخارج)',
        schedule: 'Mon - Sat',
        class_time: '04:00 PM - 05:30 PM',
        description: 'Step-by-step Tajweed articulation for beginners, children, and foundational students.',
        fee: 250,
        course_fee: 250,
        admission_fee: 50,
        subjects: [
          { id: 'sub_qai_1', name: 'Huroof-e-Mufradat & Makharij', schedule: '04:00 PM' },
          { id: 'sub_qai_2', name: 'Harakaat & Tanween Drills', schedule: '04:45 PM' },
        ],
      },
      {
        name: 'Nazara Quran & Tartil (ناظرہ قرآن کریم وترتیل)',
        schedule: 'Mon - Sat',
        class_time: '07:00 AM - 08:30 AM',
        description: 'Fluent reading of the entire Mushaf with full application of Tajweed rules.',
        fee: 300,
        course_fee: 300,
        admission_fee: 50,
        subjects: [
          { id: 'sub_naz_1', name: 'Daily Tilawat & Ahkam-e-Noon Sakin', schedule: '07:00 AM' },
          { id: 'sub_naz_2', name: 'Maddat, Ghunnah & Waqf Rules', schedule: '07:45 AM' },
        ],
      },
      {
        name: 'Hifz-ul-Quran 30-Para (تحفيظ القرآن الكريم)',
        schedule: 'Mon - Sat (Two Sessions)',
        class_time: '06:30 AM - 08:30 AM / 04:30 PM - 06:30 PM',
        description: 'Rigorous daily memorization system: Sabaq (new), Sabaqi (recent), and Manzil (revision).',
        fee: 500,
        course_fee: 500,
        admission_fee: 100,
        subjects: [
          { id: 'sub_hfz_1', name: 'Sabaq (New Daily Memorization)', schedule: '06:30 AM' },
          { id: 'sub_hfz_2', name: 'Sabaqi (Quarter-Juz Revision)', schedule: '07:30 AM' },
          { id: 'sub_hfz_3', name: 'Daur / Manzil (Full Revision)', schedule: '04:30 PM' },
        ],
      },
      {
        name: 'Husn-e-Qirat & Sifat-ul-Huroof (حسن القراءة والصفات)',
        schedule: 'Fri - Sun',
        class_time: '05:00 PM - 06:30 PM',
        description: 'Advanced vocal training in classical maqamaat and precision letter attributes.',
        fee: 350,
        course_fee: 350,
        admission_fee: 50,
        subjects: [
          { id: 'sub_qir_1', name: 'Sifat-e-Lazimah & Aarizah', schedule: '05:00 PM' },
          { id: 'sub_qir_2', name: 'Tarteel & Performance Recitation', schedule: '05:45 PM' },
        ],
      },
    ],
  },
  {
    id: 'maktab_essentials',
    title: 'Basic Islamic Maktab & Youth Essentials',
    titleArabic: 'منهاج مکتب تعلیم البالغین والأطفال',
    category: 'maktab_essentials',
    badge: '🌸 Daily Deen & Moral Character',
    description: 'Essential afternoon/weekend curriculum covering practical Fiqh, Duas, Hadith, and Seerat.',
    courses: [
      {
        name: 'Practical Fiqh & Namaz (فقہِ نماز و طہارت)',
        schedule: 'Mon - Thu',
        class_time: '05:00 PM - 06:00 PM',
        description: 'Complete hands-on guidance on Wudu, Ghusl, 5 daily prayers, and cleanliness.',
        fee: 150,
        course_fee: 150,
        admission_fee: 50,
        subjects: [
          { id: 'sub_mkt_1', name: 'Farz, Wajib & Sunan of Salah', schedule: '05:00 PM' },
          { id: 'sub_mkt_2', name: 'Sajda Sahw & Practical Demonstrations', schedule: '05:30 PM' },
        ],
      },
      {
        name: 'Masnoon Duas & Daily Adab (مسنون دعائیں و اسلامی آداب)',
        schedule: 'Mon - Thu',
        class_time: '06:00 PM - 07:00 PM',
        description: 'Memorization of daily authentic supplications and Islamic etiquette for daily life.',
        fee: 150,
        course_fee: 150,
        admission_fee: 50,
        subjects: [
          { id: 'sub_dua_1', name: 'Daily Living Supplications', schedule: '06:00 PM' },
          { id: 'sub_dua_2', name: 'Akhlaq & Respectful Living', schedule: '06:30 PM' },
        ],
      },
      {
        name: 'Stories of the Prophets & Seerat (قصص الأنبیاء وسیرت)',
        schedule: 'Friday & Saturday',
        class_time: '10:00 AM - 11:30 AM',
        description: 'Inspiring biographical studies of Prophet Muhammad ﷺ and the blessed Sahabah.',
        fee: 200,
        course_fee: 200,
        admission_fee: 50,
        subjects: [
          { id: 'sub_ser_1', name: 'Makkan & Madinan Life of the Prophet ﷺ', schedule: '10:00 AM' },
          { id: 'sub_ser_2', name: 'Exemplary Lives of the Sahabiyaat', schedule: '10:45 AM' },
        ],
      },
    ],
  },
];

export async function importCurriculumTemplateToOrg(
  orgId: string,
  templateId: string,
  institutionName?: string
): Promise<{ success: boolean; courseCount: number; message: string }> {
  if (!orgId) {
    throw new Error('Organization ID is required to import curriculum.');
  }

  const template = CURRICULUM_TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    throw new Error('Curriculum template not found.');
  }

  const batch = writeBatch(db);
  const coursesCol = collection(db, 'courses');

  for (const c of template.courses) {
    const courseRef = doc(coursesCol);
    batch.set(courseRef, {
      name: c.name,
      title: c.name,
      schedule: c.schedule,
      class_time: c.class_time,
      description: c.description,
      fee: c.fee,
      course_fee: c.course_fee,
      admission_fee: c.admission_fee,
      subjects: c.subjects,
      teacher_name: 'Academic Faculty (اساتذہ کرام)',
      teacher_id: '',
      meet_link: '',
      status: 'active',
      organization_id: orgId,
      institution_name: institutionName || 'Madrasa',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  }

  await batch.commit();

  return {
    success: true,
    courseCount: template.courses.length,
    message: `Successfully imported "${template.title}" with ${template.courses.length} courses and structured subjects!`,
  };
}
