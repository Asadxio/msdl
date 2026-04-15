import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COURSES as LOCAL_COURSES, TEACHERS as LOCAL_TEACHERS } from '@/constants/theme';

export type Course = {
  id: string;
  name: string;
  teacher_name: string;
  schedule: string;
  description: string;
  class_link: string;
};

export type Teacher = {
  id: string;
  name: string;
  title: string;
  courses: string[];
};

type DataContextType = {
  courses: Course[];
  teachers: Teacher[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

const DataContext = createContext<DataContextType>({
  courses: [],
  teachers: [],
  loading: true,
  error: null,
  refetch: () => {},
});

export function useData() {
  return useContext(DataContext);
}

// Convert local data to Firebase format as fallback
function getLocalCourses(): Course[] {
  return LOCAL_COURSES.map((c) => ({
    id: c.id,
    name: c.name,
    teacher_name: c.teacher,
    schedule: c.schedule,
    description: c.description,
    class_link: '',
  }));
}

function getLocalTeachers(): Teacher[] {
  return LOCAL_TEACHERS.map((t) => ({
    id: t.id,
    name: t.name,
    title: t.title,
    courses: t.courseIds.map((cid) => {
      const course = LOCAL_COURSES.find((c) => c.id === cid);
      return course ? course.name : '';
    }).filter(Boolean),
  }));
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch courses
      const coursesSnap = await getDocs(collection(db, 'courses'));
      const coursesData: Course[] = [];
      coursesSnap.forEach((doc) => {
        const data = doc.data();
        coursesData.push({
          id: doc.id,
          name: data.name || '',
          teacher_name: data.teacherName || data.teacher_name || '',  // Firebase uses teacherName (camelCase)
          schedule: data.schedule || '',
          description: data.description || '',
          class_link: data.classLink || data.class_link || '',  // Firebase might use classLink (camelCase)
        });
      });

      // Fetch teachers
      const teachersSnap = await getDocs(collection(db, 'teachers'));
      const teachersData: Teacher[] = [];
      teachersSnap.forEach((doc) => {
        const data = doc.data();
        teachersData.push({
          id: doc.id,
          name: data.name || '',
          title: data.title || '',
          courses: Array.isArray(data.courses) ? data.courses : [],
        });
      });

      // Use Firebase data if available, otherwise fallback to local
      setCourses(coursesData.length > 0 ? coursesData : getLocalCourses());
      setTeachers(teachersData.length > 0 ? teachersData : getLocalTeachers());
    } catch (err: any) {
      console.warn('Firebase fetch failed, using local data:', err?.message);
      setError(err?.message || 'Failed to fetch data');
      // Fallback to local data
      setCourses(getLocalCourses());
      setTeachers(getLocalTeachers());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <DataContext.Provider value={{ courses, teachers, loading, error, refetch: fetchData }}>
      {children}
    </DataContext.Provider>
  );
}
