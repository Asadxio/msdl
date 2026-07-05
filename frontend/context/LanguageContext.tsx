import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Language = 'en' | 'ur' | 'ar';

const LANGUAGE_STORAGE_KEY = '@msdl_app_language';

interface TranslationDictionary {
  [key: string]: string | TranslationDictionary;
}

const translations: Record<Language, TranslationDictionary> = {
  en: {
    tabs: {
      home: 'Home',
      courses: 'Courses',
      chat: 'Chat',
      notifications: 'Notifications',
      profile: 'Profile',
      more: 'More',
      library: 'Library',
      quiz: 'Quiz',
      attendance: 'Attendance',
      progress: 'Progress',
      certificate: 'Certificate',
    },
    settings: {
      title: 'Settings',
      appearance: 'Appearance',
      language: 'Language',
      appLanguage: 'App Language',
      support: 'Support',
      notifications: 'Notifications',
      privacy: 'Privacy & Security',
      learning: 'Learning Preferences',
      account: 'Account',
      systemDefault: 'System Default',
      medium: 'Medium',
      largeText: 'Large Text Mode',
      replayTutorial: 'Replay Tutorial',
      whatsappSupport: 'WhatsApp Support',
      emailSupport: 'Email Support',
      reportBug: 'Report a Bug',
      suggestFeature: 'Suggest a Feature',
      faq: 'FAQ',
      clearCache: 'Clear App Cache',
      dataExport: 'Data Export / Deletion Requests',
    },
    common: {
      save: 'Save',
      cancel: 'Cancel',
      close: 'Close',
      selectLanguage: 'Select App Language',
      languageChanged: 'Language updated successfully!',
      comingSoon: 'Coming Soon',
      unavailable: 'Unavailable',
    },
  },
  ur: {
    tabs: {
      home: 'صفحہ اول',
      courses: 'نصاب',
      chat: 'بات چیت',
      notifications: 'اطلاعات',
      profile: 'پروفائل',
      more: 'مزید',
      library: 'کتب خانہ',
      quiz: 'سوالات',
      attendance: 'حاضری',
      progress: 'ترقی',
      certificate: 'سند',
    },
    settings: {
      title: 'ترتیبات',
      appearance: 'ظاہری شکل',
      language: 'زبان',
      appLanguage: 'ایپ کی زبان',
      support: 'مدد و تعاون',
      notifications: 'اطلاعات',
      privacy: 'رازداری اور تحفظ',
      learning: 'تعلیمی ترجیحات',
      account: 'اکاؤنٹ',
      systemDefault: 'سسٹم ڈیفالٹ',
      medium: 'درمیانہ',
      largeText: 'بڑا ٹیکسٹ موڈ',
      replayTutorial: 'ٹیوٹوریل دوبارہ دیکھیں',
      whatsappSupport: 'واٹس ایپ سپورٹ',
      emailSupport: 'ای میل سپورٹ',
      reportBug: 'مسئلہ رپورٹ کریں',
      suggestFeature: 'نئی تجویز دیں',
      faq: 'عمومی سوالات',
      clearCache: 'کیچے صاف کریں',
      dataExport: 'ڈیٹا ایکسپورٹ / ڈیلیٹ درخواستیں',
    },
    common: {
      save: 'محفوظ کریں',
      cancel: 'منسوخ کریں',
      close: 'بند کریں',
      selectLanguage: 'ایپ کی زبان منتخب کریں',
      languageChanged: 'زبان کامیابی سے تبدیل ہو گئی!',
      comingSoon: 'جلد آ رہا ہے',
      unavailable: 'دستیاب نہیں',
    },
  },
  ar: {
    tabs: {
      home: 'الرئيسية',
      courses: 'الدورات',
      chat: 'المحادثة',
      notifications: 'الإشعارات',
      profile: 'الملف الشخصي',
      more: 'المزيد',
      library: 'المكتبة',
      quiz: 'اختبارات',
      attendance: 'الحضور',
      progress: 'التقدم',
      certificate: 'الشهادة',
    },
    settings: {
      title: 'الإعدادات',
      appearance: 'المظهر',
      language: 'اللغة',
      appLanguage: 'لغة التطبيق',
      support: 'الدعم والمساعدة',
      notifications: 'الإشعارات',
      privacy: 'الخصوصية والأمان',
      learning: 'تفضيلات التعلم',
      account: 'الحساب',
      systemDefault: 'الافتراضي للنظام',
      medium: 'متوسط',
      largeText: 'وضع الخط الكبير',
      replayTutorial: 'إعادة تشغيل الدليل',
      whatsappSupport: 'دعم واتساب',
      emailSupport: 'دعم البريد الإلكتروني',
      reportBug: 'الإبلاغ عن مشكلة',
      suggestFeature: 'اقتراح ميزة',
      faq: 'الأسئلة الشائعة',
      clearCache: 'مسح التخزين المؤقت',
      dataExport: 'تصدير البيانات / طلبات الحذف',
    },
    common: {
      save: 'حفظ',
      cancel: 'إلغاء',
      close: 'إغلاق',
      selectLanguage: 'اختر لغة التطبيق',
      languageChanged: 'تم تغيير اللغة بنجاح!',
      comingSoon: 'قريباً',
      unavailable: 'غير متاح',
    },
  },
};

const languageNames: Record<Language, string> = {
  en: 'English',
  ur: 'اردو',
  ar: 'العربية',
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string, fallback?: string) => string;
  languageName: string;
  isRTL: boolean;
  loading: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: async () => {},
  t: (key, fallback) => fallback || key,
  languageName: 'English',
  isRTL: false,
  loading: true,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (stored === 'ur' || stored === 'ar' || stored === 'en') {
          setLanguageState(stored);
        }
      } catch (err) {
        console.warn('[LanguageContext] Failed to load language from storage:', err);
      } finally {
        setLoading(false);
      }
    };
    loadLanguage();
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    try {
      setLanguageState(lang);
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch (err) {
      console.warn('[LanguageContext] Failed to save language to storage:', err);
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const keys = key.split('.');
      let current: any = translations[language] || translations.en;
      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k];
        } else {
          current = undefined;
          break;
        }
      }
      if (typeof current === 'string') {
        return current;
      }
      // fallback to English if missing in selected language
      if (language !== 'en') {
        let enCurrent: any = translations.en;
        for (const k of keys) {
          if (enCurrent && typeof enCurrent === 'object' && k in enCurrent) {
            enCurrent = enCurrent[k];
          } else {
            enCurrent = undefined;
            break;
          }
        }
        if (typeof enCurrent === 'string') {
          return enCurrent;
        }
      }
      return fallback !== undefined ? fallback : key;
    },
    [language]
  );

  const languageName = languageNames[language] || 'English';
  const isRTL = language === 'ur' || language === 'ar';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languageName, isRTL, loading }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => useContext(LanguageContext);
