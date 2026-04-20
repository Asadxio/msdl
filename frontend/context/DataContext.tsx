import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  collection, getDocs, addDoc, serverTimestamp, doc, updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COURSES as LOCAL_COURSES, TEACHERS as LOCAL_TEACHERS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export type Course = {
  id: string;
  name: string;
  teacher_name: string;
  schedule: string;
  time?: string;
  class_time?: string;
  description: string;
  class_link: string;
  meet_link?: string;
};

export type Teacher = {
  id: string;
  name: string;
  title: string;
  courses: string[];
};

export type Book = {
  id: string;
  title: string;
  pdf_url: string;
  category: string;
  category_id?: string;
  deleted?: boolean;
};

type DataContextType = {
  courses: Course[];
  teachers: Teacher[];
  books: Book[];
  loading: boolean;
  booksLoading: boolean;
  error: string | null;
  refetch: () => void;
  refetchBooks: () => Promise<void>;
  addBook: (title: string, pdf_url: string, category: string, category_id?: string) => Promise<boolean>;
  deleteBook: (bookId: string) => Promise<boolean>;
};

const DataContext = createContext<DataContextType>({
  courses: [],
  teachers: [],
  books: [],
  loading: true,
  booksLoading: true,
  error: null,
  refetch: () => {},
  refetchBooks: async () => {},
  addBook: async () => false,
  deleteBook: async () => false,
});

export function useData() {
  return useContext(DataContext);
}

function getLocalCourses(): Course[] {
  return LOCAL_COURSES.map((c) => ({
    id: c.id,
    name: c.name,
    teacher_name: c.teacher,
    schedule: c.schedule,
    time: '',
    class_time: '',
    description: c.description,
    class_link: '',
    meet_link: '',
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
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [booksLoading, setBooksLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBooks = useCallback(async () => {
    setBooksLoading(true);
    try {
      const booksSnap = await getDocs(collection(db, 'library'));
      const booksData: Book[] = [];
      booksSnap.forEach((doc) => {
        const data = doc.data();
        if (data.deleted) return;
        booksData.push({
          id: doc.id,
          title: data.title || '',
          pdf_url: data.pdf_url || data.pdfUrl || '',
          category: data.category || '',
          category_id: data.category_id || '',
        });
      });
      setBooks(booksData);
    } catch (err: any) {
      console.warn('Failed to fetch books:', err?.message);
      setBooks([]);
    } finally {
      setBooksLoading(false);
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const coursesSnap = await getDocs(collection(db, 'courses'));
      const coursesData: Course[] = [];
      coursesSnap.forEach((doc) => {
        const data = doc.data();
        coursesData.push({
          id: doc.id,
          name: data.name || '',
          teacher_name: data.teacherName || data.teacher_name || '',
          schedule: data.schedule || '',
          time: data.time || '',
          class_time: data.class_time || data.time || '',
          description: data.description || '',
          class_link: data.classLink || data.class_link || data.meet_link || '',
          meet_link: data.meet_link || data.class_link || data.classLink || '',
        });
      });

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

      setCourses(coursesData.length > 0 ? coursesData : getLocalCourses());
      setTeachers(teachersData.length > 0 ? teachersData : getLocalTeachers());
    } catch (err: any) {
      console.warn('Firebase fetch failed, using local data:', err?.message);
      setError(err?.message || 'Failed to fetch data');
      setCourses(getLocalCourses());
      setTeachers(getLocalTeachers());
    } finally {
      setLoading(false);
    }
  };

  const addBook = async (title: string, pdf_url: string, category: string, category_id?: string): Promise<boolean> => {
    if (profile?.role !== 'admin') {
      console.warn('Unauthorized: only admin can add books');
      return false;
    }
    try {
      await addDoc(collection(db, 'library'), {
        title,
        pdf_url,
        category,
        category_id: category_id || '',
        created_at: serverTimestamp(),
      });
      await fetchBooks();
      return true;
    } catch (err: any) {
      console.warn('Failed to add book:', err?.message);
      return false;
    }
  };

  const deleteBook = async (bookId: string): Promise<boolean> => {
    if (profile?.role !== 'admin') {
      console.warn('Unauthorized: only admin can delete books');
      return false;
    }
    try {
      await updateDoc(doc(db, 'library', bookId), {
        deleted: true,
        deleted_at: serverTimestamp(),
      });
      await fetchBooks();
      return true;
    } catch (err: any) {
      console.warn('Failed to delete book:', err?.message);
      return false;
    }
  };

  useEffect(() => {
    fetchData();
    fetchBooks();
  }, [fetchBooks]);

  return (
    <DataContext.Provider value={{
      courses, teachers, books, loading, booksLoading, error,
      refetch: fetchData, refetchBooks: fetchBooks, addBook, deleteBook,
    }}>
      {children}
    </DataContext.Provider>
  );
}
