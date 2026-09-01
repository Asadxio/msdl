import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Language = 'en' | 'ur' | 'roman_ur' | 'ar';

export const LANGUAGE_STORAGE_KEY = '@msdl_app_language';

interface TranslationDictionary {
  [key: string]: string | TranslationDictionary;
}

export const translations: Record<Language, TranslationDictionary> = {
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
      dawat: 'Dawat & Sadqah',
      fatawa: 'Dar-ul-Iftaa',
    },
    home: {
      madrasaName: 'Madrasatu-s-Salikat Lil Banat',
      welcome: 'Welcome to Islamic Learning',
      hadithTitle: 'Hadith of the Day',
      quickAccess: 'Quick Access',
      liveClass: 'Live Classroom',
      myCourses: 'My Enrolled Courses',
      dailyTasbeeh: 'Smart Tasbeeh',
      prayerTimes: 'Prayer Times',
      verifySanad: 'Verify Sanad Online',
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
      courses: 'نصاب و اسباق',
      chat: 'پیغامات',
      notifications: 'اطلاعات',
      profile: 'پروفائل',
      more: 'مزید خدمات',
      library: 'کتب خانہ',
      quiz: 'امتحانات',
      attendance: 'حاضری',
      progress: 'تعلیمی ترقی',
      certificate: 'اسناد و سرٹیفکیٹ',
      dawat: 'دعوت و ثواب',
      fatawa: 'دار الافتاء',
    },
    home: {
      madrasaName: 'مدرسۃ السالکات للبنات',
      welcome: 'اسلامی تعلیم و تربیت میں خوش آمدید',
      hadithTitle: 'آج کی حدیثِ مبارکہ',
      quickAccess: 'فوری رسائی',
      liveClass: 'لائیو کلاس روم',
      myCourses: 'میرے زیرِ تعلیم کورسز',
      dailyTasbeeh: 'تسبیحِ فاطمی و اذکار',
      prayerTimes: 'اوقاتِ نماز',
      verifySanad: 'سند کی لائیو تصدیق',
    },
    settings: {
      title: 'ترتیبات و سیٹنگز',
      appearance: 'ظاہری شکل و تھیم',
      language: 'زبان کی تبدیلی',
      appLanguage: 'ایپ کی زبان',
      support: 'مدد و رابطہ',
      notifications: 'اطلاعات و الرٹس',
      privacy: 'پردہ اور رازداری',
      learning: 'تعلیمی ترجیحات',
      account: 'میرا اکاؤنٹ',
      systemDefault: 'سسٹم ڈیفالٹ',
      medium: 'درمیانہ',
      largeText: 'بڑا فونٹ موڈ',
      replayTutorial: 'ٹیوٹوریل دوبارہ دیکھیں',
      whatsappSupport: 'واٹس ایپ ہیلپ لائن',
      emailSupport: 'ای میل رابطہ',
      reportBug: 'مسئلہ رپورٹ کریں',
      suggestFeature: 'نئی تجویز بھیجیں',
      faq: 'عمومی سوالات و جوابات',
      clearCache: 'کیچے صاف کریں',
      dataExport: 'ڈیٹا ایکسپورٹ و تصدیق',
    },
    common: {
      save: 'محفوظ کریں',
      cancel: 'منسوخ',
      close: 'بند کریں',
      selectLanguage: 'ایپ کی زبان منتخب فرمائیں',
      languageChanged: 'زبان کامیابی سے تبدیل ہو گئی!',
      comingSoon: 'جلد دستیاب ہوگا',
      unavailable: 'فی الحال دستیاب نہیں',
    },
  },
  roman_ur: {
    tabs: {
      home: 'Home',
      courses: 'Sabaq & Courses',
      chat: 'Rabta / Chat',
      notifications: 'Notifications',
      profile: 'Profile',
      more: 'Mazeed Services',
      library: 'Kitab Khana',
      quiz: 'Imtihan / Quiz',
      attendance: 'Haziri (Attendance)',
      progress: 'Taleemi Progress',
      certificate: 'Sanad / Certificate',
      dawat: 'Dawat & Sadqah',
      fatawa: 'Dar-ul-Iftaa',
    },
    home: {
      madrasaName: 'Madrasatu-s-Salikat Lil Banat',
      welcome: 'Islami Taleem me Khush Aamdeed',
      hadithTitle: 'Aaj ki Hadith-e-Mubarak',
      quickAccess: 'Quick Access',
      liveClass: 'Live Sabaq Room',
      myCourses: 'Mere Courses',
      dailyTasbeeh: 'Smart Tasbeeh',
      prayerTimes: 'Namaz ke Auqaat',
      verifySanad: 'Sanad Verify Karein',
    },
    settings: {
      title: 'Settings',
      appearance: 'Theme & Appearance',
      language: 'Zuban (Language)',
      appLanguage: 'App ki Zuban',
      support: 'Madad & Support',
      notifications: 'Notifications',
      privacy: 'Purdah & Security',
      learning: 'Sabaq Preferences',
      account: 'Account',
      systemDefault: 'System Default',
      medium: 'Normal',
      largeText: 'Bada Text Mode',
      replayTutorial: 'Tutorial Dobara Dekhein',
      whatsappSupport: 'WhatsApp Helpline',
      emailSupport: 'Email Support',
      reportBug: 'Kharabi Report Karein',
      suggestFeature: 'Nayi Tajweez Dein',
      faq: 'Aam Sawalat (FAQ)',
      clearCache: 'Cache Saaf Karein',
      dataExport: 'Data Export / Requests',
    },
    common: {
      save: 'Save Karein',
      cancel: 'Cancel',
      close: 'Band Karein',
      selectLanguage: 'App ki Zuban Chunein',
      languageChanged: 'Zuban kamyabi se tabdeel ho gayi!',
      comingSoon: 'Jald aayega',
      unavailable: 'Dastyab nahi',
    },
  },
  ar: {
    tabs: {
      home: 'الرئيسية',
      courses: 'الدورات والمناهج',
      chat: 'المحادثة',
      notifications: 'الإشعارات',
      profile: 'الملف الشخصي',
      more: 'المزيد من الخدمات',
      library: 'المكتبة',
      quiz: 'الاختبارات',
      attendance: 'الحضور والغياب',
      progress: 'التقدم الدراسي',
      certificate: 'الشهادات والأسناد',
      dawat: 'الدعوة والصدقة الجارية',
      fatawa: 'دار الإفتاء',
    },
    home: {
      madrasaName: 'مدرسة السالكات للبنات',
      welcome: 'أهلاً بكم في التعليم الشرعي',
      hadithTitle: 'حديث اليوم المبارك',
      quickAccess: 'الوصول السريع',
      liveClass: 'الفصل الافتراضي المباشر',
      myCourses: 'دوراتي التعليمية',
      dailyTasbeeh: 'المسبحة الذكية والأذكار',
      prayerTimes: 'مواقيت الصلاة',
      verifySanad: 'التحقق من صحة السند',
    },
    settings: {
      title: 'الإعدادات',
      appearance: 'المظهر والسمات',
      language: 'اللغة',
      appLanguage: 'لغة التطبيق',
      support: 'الدعم والمساعدة',
      notifications: 'الإشعارات والتنبيهات',
      privacy: 'الخصوصية والأمان',
      learning: 'تفضيلات التعلم',
      account: 'الحساب',
      systemDefault: 'الافتراضي للنظام',
      medium: 'متوسط',
      largeText: 'وضع الخط الكبير',
      replayTutorial: 'إعادة تشغيل الدليل',
      whatsappSupport: 'دعم واتساب المباشر',
      emailSupport: 'دعم البريد الإلكتروني',
      reportBug: 'الإبلاغ عن مشكلة',
      suggestFeature: 'اقتراح ميزة جديدة',
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
      comingSoon: 'قريباً إن شاء الله',
      unavailable: 'غير متاح حالياً',
    },
  },
};

export interface LanguageOption {
  code: Language;
  name: string;
  nativeName: string;
  flag: string;
  subtitle: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    code: 'ur',
    name: 'Urdu',
    nativeName: 'اردو (نستعلیق)',
    flag: '🇵🇰',
    subtitle: 'دینی علوم، قرآن و فقہ اردو نستعلیق میں',
  },
  {
    code: 'roman_ur',
    name: 'Roman Urdu',
    nativeName: 'Roman Urdu',
    flag: '📝',
    subtitle: 'Aasan Roman Urdu me sabaq aur masail',
  },
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
    subtitle: 'Full English interface',
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    subtitle: 'الواجهة باللغة العربية الفصحى',
  },
];

export function getUrduFontFamily(): string {
  return 'serif';
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string, fallback?: string) => string;
  languageName: string;
  isRTL: boolean;
  isNastaliq: boolean;
  fontFamily: string;
  loading: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: async () => {},
  t: (key, fallback) => fallback || key,
  languageName: 'English',
  isRTL: false,
  isNastaliq: false,
  fontFamily: 'System',
  loading: true,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('ur');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (stored === 'ur' || stored === 'roman_ur' || stored === 'ar' || stored === 'en') {
          setLanguageState(stored as Language);
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

  const matchedOption = LANGUAGE_OPTIONS.find((o) => o.code === language);
  const languageName = matchedOption?.nativeName || 'اردو';
  const isRTL = language === 'ur' || language === 'ar';
  const isNastaliq = language === 'ur';
  const fontFamily = isNastaliq ? getUrduFontFamily() : 'System';

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        languageName,
        isRTL,
        isNastaliq,
        fontFamily,
        loading,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => useContext(LanguageContext);
