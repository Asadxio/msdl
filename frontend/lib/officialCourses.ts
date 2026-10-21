/**
 * Authoritative Master Catalog of Madrasatu-s-Salikat Lil Banat Courses.
 *
 * Guarantees that ALL 12 official madrasa courses are consistently available
 * across the entire app (LMS Courses feed, Admin User Management, Free Course Enrollment,
 * and Payment flows), even before/if explicit documents are created in Firestore.
 */

export interface OfficialCourseItem {
  id: string;
  name: string;
  category: string;
  teacher_name: string;
  schedule: string;
  class_time: string;
  admission_fee: number;
  course_fee: number;
  fee: number;
  description: string;
  organization_id: string;
}

export const OFFICIAL_COURSES_CATALOG: OfficialCourseItem[] = [
  {
    id: 'course_rabiya',
    name: 'Rabiya',
    category: 'Alimah Foundation',
    teacher_name: 'Sumra Fatma',
    schedule: 'Mon to Thu',
    class_time: '10:00 AM',
    admission_fee: 100,
    course_fee: 500,
    fee: 500,
    description: 'Is level mein students ko basic Islamic knowledge, zaroori masail aur achhi Islami aadaton ki buniyad sikhayi jayegi.',
    organization_id: 'mslb-main',
  },
  {
    id: 'course_ula',
    name: 'Ula',
    category: 'Alimah Year 1',
    teacher_name: 'Sumra Fatma',
    schedule: 'Mon to Thu',
    class_time: '11:00 AM',
    admission_fee: 100,
    course_fee: 500,
    fee: 500,
    description: 'Is class mein students apni Islami maloomat ko mazboot karenge aur deen ki buniyadi taleem ko behtar samjhenge.',
    organization_id: 'mslb-main',
  },
  {
    id: 'course_aidadiya',
    name: 'Aidadiya',
    category: 'Alimah Year 2',
    teacher_name: 'Sumra Fatma',
    schedule: 'Mon to Fri',
    class_time: '02:00 PM',
    admission_fee: 100,
    course_fee: 500,
    fee: 500,
    description: 'Is level mein students ki Islami maloomat aur samajh ko mazeed mazboot kiya jayega aur unki taleem ko behtar direction di jayegi.',
    organization_id: 'mslb-main',
  },
  {
    id: 'course_salisa',
    name: 'Salisa',
    category: 'Alimah Year 3',
    teacher_name: 'Firdouse Banu',
    schedule: 'Mon to Fri',
    class_time: '03:30 PM',
    admission_fee: 100,
    course_fee: 500,
    fee: 500,
    description: 'Is class mein students ko Islami taleem ki mazeed gehrai se samajh di jayegi aur pehle seekhe hue ilm ko mazboot kiya jayega.',
    organization_id: 'mslb-main',
  },
  {
    id: 'course_khamsa',
    name: 'Khamsa',
    category: 'Alimah Year 4',
    teacher_name: 'Firdouse Banu',
    schedule: 'Mon to Fri',
    class_time: '04:30 PM',
    admission_fee: 100,
    course_fee: 500,
    fee: 500,
    description: 'Uloom-e-Islamia ki aala satah ki taleem, Tafseer, wa Hadees-e-Mubaraka ke muta\'laa par mushtamil darja.',
    organization_id: 'mslb-main',
  },
  {
    id: 'course_mubaligha',
    name: 'Mubaligha',
    category: 'Dawat wa Tableegh',
    teacher_name: 'Sumra Fatma',
    schedule: 'Tue to Sat',
    class_time: '09:00 AM',
    admission_fee: 100,
    course_fee: 300,
    fee: 300,
    description: 'Dawat-o-Tableegh, Islami Akhlaq, aur Taleem-o-Tarbiyat ki tarbiyati class.',
    organization_id: 'mslb-main',
  },
  {
    id: 'course_qaida',
    name: 'Madani Qaida',
    category: 'Quran Fundamentals',
    teacher_name: 'Afnaz Razviya',
    schedule: 'Mon to Fri',
    class_time: '07:30 AM',
    admission_fee: 100,
    course_fee: 200,
    fee: 200,
    description: 'Quran-e-Majeed seekhne ki pehli buniyadi seedhi, huroof ki pehchan aur makharij ka ibtidai sabaq.',
    organization_id: 'mslb-main',
  },
  {
    id: 'course_urdu',
    name: 'Urdu Course',
    category: 'Language',
    teacher_name: 'Anjum Razviya',
    schedule: 'Mon to Wed',
    class_time: '12:00 PM',
    admission_fee: 100,
    course_fee: 100,
    fee: 100,
    description: 'Urdu zaban parhney, likhne aur samajhne ki sahulat ke liye aasan taleemi nizam.',
    organization_id: 'mslb-main',
  },
  {
    id: 'course_short',
    name: 'Short Courses',
    category: 'Short Courses (Free)',
    teacher_name: 'Sumra Fatma',
    schedule: 'Weekend Sessions',
    class_time: '11:00 AM',
    admission_fee: 0,
    course_fee: 0,
    fee: 0,
    description: 'Mukhtasar arsay ke mufeed deeni courses (Namazi Course, Ramazan Tarbiyat, etc.) bila kisi fees ke.',
    organization_id: 'mslb-main',
  },
  {
    id: 'course_nazara',
    name: 'Nazara',
    category: 'Quran Tilawat',
    teacher_name: 'Afnaz Razviya',
    schedule: 'Mon to Fri',
    class_time: '08:30 AM',
    admission_fee: 100,
    course_fee: 300,
    fee: 300,
    description: 'Quran-e-Kareem ko dekh kar rawani aur makharij ke sath parhne ka intizam.',
    organization_id: 'mslb-main',
  },
  {
    id: 'course_grammar',
    name: 'Arabic Grammar',
    category: 'Arabic Language',
    teacher_name: 'Anjum Razviya',
    schedule: 'Mon to Thu',
    class_time: '01:00 PM',
    admission_fee: 100,
    course_fee: 400,
    fee: 400,
    description: 'Arbi zaban ki sarf wa nahw, qawaid aur Quran fahmi ke asool.',
    organization_id: 'mslb-main',
  },
  {
    id: 'course_qirat',
    name: 'Qirat Course',
    category: 'Tajweed wa Qirat',
    teacher_name: 'Afnaz Razviya',
    schedule: 'Daily (Morning & Evening)',
    class_time: '08:00 AM',
    admission_fee: 100,
    course_fee: 500,
    fee: 500,
    description: 'Quran-e-Kareem ki sahi tilawat, makharij, pronunciation aur behtar fluency par tawajjoh di jayegi.',
    organization_id: 'mslb-main',
  },
];

/**
 * Merge an array of existing courses from Firestore with the official master catalog
 * ensuring every official course is represented without duplicates.
 */
export function mergeWithOfficialCourses<T extends { id: string; name?: string }>(existingCourses: T[]): T[] {
  const result: T[] = [...existingCourses];
  const seenNames = new Set(existingCourses.map((c) => String(c.name || '').trim().toLowerCase()));
  const seenIds = new Set(existingCourses.map((c) => c.id));

  for (const off of OFFICIAL_COURSES_CATALOG) {
    const key = off.name.trim().toLowerCase();
    if (!seenNames.has(key) && !seenIds.has(off.id)) {
      result.push({
        ...off,
      } as unknown as T);
      seenNames.add(key);
      seenIds.add(off.id);
    }
  }

  return result;
}

/**
 * Authoritatively determines whether a course is free.
 * Fails safely: missing, null, empty string, or malformed prices are NOT treated as free.
 * Returns true ONLY if explicitly confirmed zero (0 or "0") or confirmed Short Courses.
 */
export const AUTHORITATIVE_FREE_COURSE_IDS: ReadonlySet<string> = new Set([
  'course_short',
]);

/**
 * Authoritatively determines whether a course is free.
 *
 * CRITICAL SECURITY INVARIANTS:
 * 1. Title alone is NEVER trusted to determine free status.
 * 2. Any positive fee (> 0) in course_fee, fee, or admission_fee strictly blocks free enrollment,
 *    even if the title is "Short Courses" or is_free is claimed.
 * 3. Conflicting fees (e.g. course_fee: 500, fee: 0) fail safely to NOT FREE.
 * 4. Malformed values (NaN, 'invalid') fail safely to NOT FREE.
 * 5. Missing, null, or empty string fees do NOT grant free enrollment.
 * 6. Free status requires EITHER an explicit numeric/string zero fee (0 or "0"),
 *    OR an explicit authoritative indicator (is_free === true) with no positive fee,
 *    OR an approved course ID under administrative control ('course_short').
 */
export function isAuthoritativelyFreeCourse(course: {
  id?: string;
  name?: string;
  course_fee?: any;
  fee?: any;
  admission_fee?: any;
  is_free?: any;
  isFree?: any;
} | null | undefined): boolean {
  if (!course) return false;

  const parseFee = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string' && val.trim() !== '') return Number(val.trim());
    return NaN;
  };

  const isMalformed = (val: any): boolean => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed === '') return false;
      return isNaN(Number(trimmed));
    }
    if (typeof val === 'number') {
      return isNaN(val);
    }
    return true;
  };

  // 1. Any malformed fee field fails safely to NOT FREE
  if (isMalformed(course.course_fee) || isMalformed(course.fee) || isMalformed(course.admission_fee)) {
    return false;
  }

  const numCourseFee = parseFee(course.course_fee);
  const numFee = parseFee(course.fee);
  const numAdmissionFee = parseFee(course.admission_fee);

  // 2. A positive fee strictly prevents free enrollment
  const hasPositiveFee =
    (!isNaN(numCourseFee) && numCourseFee > 0) ||
    (!isNaN(numFee) && numFee > 0) ||
    (!isNaN(numAdmissionFee) && numAdmissionFee > 0);

  if (hasPositiveFee) {
    return false;
  }

  // 3. Explicit zero fee
  const isExplicitZero = (val: any): boolean => {
    if (val === 0) return true;
    if (typeof val === 'string' && val.trim() === '0') return true;
    return false;
  };

  const hasExplicitZeroFee = isExplicitZero(course.course_fee) || isExplicitZero(course.fee);
  if (hasExplicitZeroFee) {
    return true;
  }

  // 4. Explicit authoritative free indicator or approved free course ID (only if no positive fee)
  const isExplicitlyMarkedFree = course.is_free === true || course.isFree === true;
  const isApprovedFreeId = typeof course.id === 'string' && AUTHORITATIVE_FREE_COURSE_IDS.has(course.id.trim());

  if (isExplicitlyMarkedFree || isApprovedFreeId) {
    return true;
  }

  // 5. Title alone is NEVER trusted if fees are missing, null, or undefined
  return false;
}
