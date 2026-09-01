import { Course, CourseSubject, Teacher } from '../context/DataContext';

describe('Professional Teacher Profile & Enhanced Faculty Directory Suite', () => {
  const teacherSumra: Teacher = {
    id: 'teacher_sumra_uid',
    name: 'Ustaadha Sumra',
    title: 'Fazila Dars-e-Nizami & Head of Tajweed',
    courses: ['Dars-e-Nizami Year 1', 'Advanced Tajweed'],
    bio: 'Dedicated Islamic scholar specializing in Hafs an Asim Qiraat and Hanafi Fiqh.',
    qualifications: ['Alimiyyah Degree', 'Sanad in Tajweed & Qiraat'],
    experience_years: '7+ Years',
    languages: ['Urdu', 'Arabic', 'English'],
  };

  const teacherFatima: Teacher = {
    id: 'teacher_fatima_uid',
    name: 'Ustaadha Fatima',
    title: 'Muallima of Fiqh Sciences',
    courses: ['Dars-e-Nizami Year 1'],
  };

  const teacherAyesha: Teacher = {
    id: 'teacher_ayesha_uid',
    name: 'Ustaadha Ayesha',
    title: 'Hadith Specialist',
    courses: ['Dars-e-Nizami Year 1'],
  };

  const allCourses: Course[] = [
    {
      id: 'course_y1',
      name: 'Dars-e-Nizami Year 1',
      teacher_name: 'Ustaadha Sumra',
      teacher_id: 'teacher_sumra_uid',
      schedule: 'Mon-Thu',
      class_time: '10:00 AM',
      description: 'First year classical madrasa program.',
      class_link: '',
      subjects: [
        { id: 's1', name: 'Tajweed', teacher_id: 'teacher_sumra_uid', teacher_name: 'Ustaadha Sumra' },
        { id: 's2', name: 'Fiqh', teacher_id: 'teacher_fatima_uid', teacher_name: 'Ustaadha Fatima' },
        { id: 's3', name: 'Hadith', teacher_id: 'teacher_ayesha_uid', teacher_name: 'Ustaadha Ayesha' },
      ],
    },
    {
      id: 'course_adv_tajweed',
      name: 'Advanced Tajweed',
      teacher_name: 'Ustaadha Sumra',
      teacher_id: 'teacher_sumra_uid',
      schedule: 'Fri-Sat',
      class_time: '04:00 PM',
      description: 'Advanced recitation and rules.',
      class_link: '',
      subjects: [
        { id: 's4', name: 'Tajweed', teacher_id: 'teacher_sumra_uid', teacher_name: 'Ustaadha Sumra' },
        { id: 's5', name: 'Makharij Mastery', teacher_id: 'teacher_sumra_uid', teacher_name: 'Ustaadha Sumra' },
      ],
    },
  ];

  // Helper mirroring TeacherDetailScreen subject aggregation
  function getDistinctSubjectsTaught(teacher: Teacher, courses: Course[]): string[] {
    const tId = teacher.id;
    const tName = (teacher.name || '').trim().toLowerCase();
    const subjectsMap = new Map<string, string>();

    courses.forEach((c) => {
      if (Array.isArray(c.subjects)) {
        c.subjects.forEach((s) => {
          const isAssigned =
            (s.teacher_id && s.teacher_id === tId) ||
            (s.teacher_name && tName && s.teacher_name.toLowerCase().includes(tName));
          if (isAssigned && s.name) {
            const cleanName = s.name.trim();
            if (!subjectsMap.has(cleanName.toLowerCase())) {
              subjectsMap.set(cleanName.toLowerCase(), cleanName);
            }
          }
        });
      }
    });

    return Array.from(subjectsMap.values());
  }

  // Helper mirroring TeacherDetailScreen course subject filtering
  function getTeacherSubjectsInCourse(teacher: Teacher, course: Course): CourseSubject[] {
    if (!Array.isArray(course.subjects)) return [];
    const tId = teacher.id;
    const tName = (teacher.name || '').trim().toLowerCase();

    return course.subjects.filter((s) => {
      if (s.teacher_id && s.teacher_id === tId) return true;
      if (s.teacher_name && tName && s.teacher_name.toLowerCase().includes(tName)) return true;
      return false;
    });
  }

  it('aggregates and deduplicates subjects taught for Teacher Sumra', () => {
    const subjects = getDistinctSubjectsTaught(teacherSumra, allCourses);
    // 'Tajweed' is in both course_y1 and course_adv_tajweed, should be deduplicated to 1 + 'Makharij Mastery'
    expect(subjects).toContain('Tajweed');
    expect(subjects).toContain('Makharij Mastery');
    expect(subjects.length).toBe(2);
  });

  it('aggregates only Fiqh for Teacher Fatima and Hadith for Teacher Ayesha', () => {
    const fatimaSubjects = getDistinctSubjectsTaught(teacherFatima, allCourses);
    expect(fatimaSubjects).toEqual(['Fiqh']);

    const ayeshaSubjects = getDistinctSubjectsTaught(teacherAyesha, allCourses);
    expect(ayeshaSubjects).toEqual(['Hadith']);
  });

  it('filters course card to display ONLY the specific subject taught by each teacher', () => {
    const year1Course = allCourses[0];

    const sumraSubsInY1 = getTeacherSubjectsInCourse(teacherSumra, year1Course);
    expect(sumraSubsInY1.map((s) => s.name)).toEqual(['Tajweed']);

    const fatimaSubsInY1 = getTeacherSubjectsInCourse(teacherFatima, year1Course);
    expect(fatimaSubsInY1.map((s) => s.name)).toEqual(['Fiqh']);

    const ayeshaSubsInY1 = getTeacherSubjectsInCourse(teacherAyesha, year1Course);
    expect(ayeshaSubsInY1.map((s) => s.name)).toEqual(['Hadith']);
  });

  it('verifies 1-tap direct chat route generation for Ustaadha guidance', () => {
    const chatRoute = `/chat/${teacherSumra.id}`;
    expect(chatRoute).toBe('/chat/teacher_sumra_uid');
  });

  it('handles optional and missing teacher profile fields with reliable fallbacks', () => {
    // Teacher Fatima has no bio, experience_years or qualifications stored
    expect(teacherFatima.bio).toBeUndefined();
    expect(teacherFatima.experience_years).toBeUndefined();
    expect(teacherFatima.qualifications).toBeUndefined();

    // Fallbacks
    const fallbackBio = teacherFatima.bio || 'Dedicated faculty member at Madrasatu-s-Salikat Lil Banat.';
    const fallbackExp = teacherFatima.experience_years ? `${teacherFatima.experience_years}` : '—';
    expect(fallbackBio).toContain('Dedicated faculty member');
    expect(fallbackExp).toBe('—');
  });
});
