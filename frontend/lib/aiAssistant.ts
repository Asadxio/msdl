export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  isRedirect?: boolean;
}

export interface SuggestedPrompt {
  id: string;
  title: string;
  prompt: string;
  category: 'quran' | 'tajweed' | 'arabic' | 'history';
}

export const SUGGESTED_STUDY_PROMPTS: SuggestedPrompt[] = [
  {
    id: '1',
    title: 'قرآنی الفاظ کے معانی',
    prompt: 'سورۃ الفاتحہ کے اہم قرآنی الفاظ کے لغوی معانی سمجھائیں',
    category: 'quran',
  },
  {
    id: '2',
    title: 'تجوید کا قاعدہ (اخفاء و ادغام)',
    prompt: 'نون ساکن اور تنوین کے بعد اخفاء اور ادغام کب ہوتا ہے؟',
    category: 'tajweed',
  },
  {
    id: '3',
    title: 'سبق کا آسان خلاصہ',
    prompt: 'فرض علوم اور بنیادی اسلامی عقائد کا آسان تعارف کیا ہے؟',
    category: 'arabic',
  },
  {
    id: '4',
    title: 'سیرت النبی ﷺ کا واقعہ',
    prompt: 'غزوہِ بدر کے اسباق اور فتح کا مختصر پس منظر کیا ہے؟',
    category: 'history',
  },
];

// Sensitive fatwa keyword triggers that should politely redirect to live Ustaadha
const FATWA_TRIGGER_KEYWORDS = [
  'طلاق', 'خلع', 'نکاح کا فسخ', 'حیض کا حکم', 'میراث کا حصہ', 'فتوی',
  'حرام', 'حلال', 'کیا میری نماز ٹوٹ گئی', 'تلاق', 'talaq', 'khula',
  'fatwa', 'haram', 'halal', 'divorce',
];

export function isFatwaQuery(query: string): boolean {
  const normalized = (query || '').toLowerCase();
  return FATWA_TRIGGER_KEYWORDS.some((kw) => normalized.includes(kw));
}

export function getFatwaRedirectMessage(): string {
  return (
    'السلام علیکم و رحمۃ اللہ وبرکاتہ محترم طالبہ!\n\n' +
    '⚠️ **فتویٰ و شرعی رہنمائی برائے پردہ:**\n' +
    'یہ سوال خالص شرعی مسئلہ اور فتوے سے متعلق ہے۔ شرعی احکام و فتاویٰ کی نازکی کے پیشِ نظر، مصنوعی ذہانت (AI) کو فتوے کا اختیار نہیں ہے۔\n\n' +
    'براہِ کرم یہ سوال مدرسہ کے **دار الافتاء (Ask Ustaadha)** سیکشن میں ارسال فرمائیں جہاں سینئر مفتیہ صاحبہ و معلمات مکمل پردے کے ساتھ آپ کو مستند شریعت کے مطابق جواب عنایت فرمائیں گی۔\n\n' +
    '🔗 آپ نیچے دیے گئے بٹن پر کلک کر کے براہِ راست دار الافتاء جا سکتی ہیں۔'
  );
}

// Built-in Islamic Educational Knowledge Base for offline / rapid responses
const LOCAL_KNOWLEDGE_BASE: Record<string, string> = {
  'fatiha':
    '**سورۃ الفاتحہ کے مبارک الفاظ کے معانی:**\n\n' +
    '• **الْحَمْدُ لِلَّهِ:** تمام تعریفیں اور شکر اللہ ہی کے لیے مخصوص ہیں۔\n' +
    '• **رَبِّ الْعَالَمِينَ:** تمام جہانوں کا پالنے والا اور پرورش فرمانے والا۔\n' +
    '• **الرَّحْمَنِ الرَّحِيمِ:** بے حد رحم فرمانے والا، نہایت مہربان۔\n' +
    '• **مَالِكِ يَوْمِ الدِّينِ:** جزا اور سزا کے دن (قیامت) کا اکیلا مالک۔\n' +
    '• **إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ:** ہم تیری ہی عبادت کرتے ہیں اور تجھ ہی سے مدد مانگتے ہیں۔\n' +
    '• **الصِّرَاطَ الْمُسْتَقِيمَ:** سیدھا اور سچا راستہ۔',

  'tajweed':
    '**نون ساکن اور تنوین کے بنیادی قواعد:**\n\n' +
    '1. **اظہار (Izhar):** نون ساکن یا تنوین کے بعد حروفِ حلقی (ء، ہ، ع، ح، غ، خ) آئیں تو ظاہر کر کے پڑھا جائے گا۔\n' +
    '2. **ادغام (Idgham):** حروفِ یرملون (ی، ر، م، ل، و، ن) آئیں تو ملا کر پڑھا جائے گا۔\n' +
    '3. **اقلاب (Iqlab):** حرفِ باء (ب) آئے تو نون کو میم سے بدل کر غنہ کے ساتھ پڑھیں گے۔\n' +
    '4. **اخفاء (Ikhfa):** باقی 15 حروف میں نون کی آواز ناک میں چھپا کر (غنہ کے ساتھ) ادا کی جائے گی۔',

  'farz':
    '**فرض علوم و بنیادی اسلامی عقائد:**\n\n' +
    'ہر مسلمان پر بقدرِ ضرورت دینی احکام سیکھنا فرضِ عین ہے، جس میں:\n' +
    '1. عقائدِ صحیحہ (توحید، رسالت، آخرت، ملائکہ، کتبِ سماویہ پر ایمان)\n' +
    '2. طہارت و وضو اور غسل کے بنیادی فرائض\n' +
    '3. پانچوں وقت کی نماز اور اس کے ارکان کا صحیح علم\n' +
    '4. حلال و حرام کی تمیز اور روزمرہ اخلاقیات۔',

  'seerah':
    '**غزوہِ بدر کے اسباق (۱۷ رمضان المبارک ۲ ہجری):**\n\n' +
    '• حق و باطل کا پہلا فیصلہ کن معرکہ تھا۔\n' +
    '• مسلمانوں کی تعداد صرف ۳۱۳ تھی جبکہ کفار ۱۰۰۰ سے زائد اسلحہ بند تھے۔\n' +
    '• **اہم سبق:** کامیابی ظاہری ساز و سامان کے بجائے اللہ پر پختہ توکل، خلوصِ نیت، اور رسول اللہ ﷺ کی اطاعت سے ملتی ہے۔',
};

export async function askAiSabaqAssistant(
  question: string,
  history: ChatMessage[] = []
): Promise<{ text: string; isRedirect?: boolean }> {
  const cleanQ = (question || '').trim();
  if (!cleanQ) {
    return { text: 'برائے مہربانی اپنا تعلیمی سوال درج فرمائیں۔' };
  }

  // 1. Guardrail Check: Intercept sensitive Fiqh/Fatwa questions
  if (isFatwaQuery(cleanQ)) {
    return {
      text: getFatwaRedirectMessage(),
      isRedirect: true,
    };
  }

  // 2. Query Knowledge Resolver
  const lower = cleanQ.toLowerCase();

  if (lower.includes('فاتحہ') || lower.includes('fatiha') || lower.includes('الفاظ')) {
    return { text: LOCAL_KNOWLEDGE_BASE['fatiha'] };
  }
  if (lower.includes('تجوید') || lower.includes('tajweed') || lower.includes('اخفاء') || lower.includes('ادغام')) {
    return { text: LOCAL_KNOWLEDGE_BASE['tajweed'] };
  }
  if (lower.includes('فرض') || lower.includes('عقائد') || lower.includes('عقیدہ')) {
    return { text: LOCAL_KNOWLEDGE_BASE['farz'] };
  }
  if (lower.includes('بدر') || lower.includes('سیرت') || lower.includes('غزوہ') || lower.includes('تاریخ')) {
    return { text: LOCAL_KNOWLEDGE_BASE['seerah'] };
  }

  // 3. General Educational Guidance
  return {
    text:
      'السلام علیکم محترم طالبہ!\n\n' +
      'آپ کے سوال **« ' + cleanQ + ' »** سے متعلق علمی وضاحت:\n\n' +
      'علمِ دین میں گہرائی حاصل کرنے کے لیے بنیادی متن کو بار بار دہرائیں اور استاذہ کے بتائے ہوئے اصولوں کو پیشِ نظر رکھیں۔\n\n' +
      '💡 **مطالعہ کے لیے مشورہ:**\n' +
      '• اگر یہ کسی مخصوص کتاب (جیسے قدوری، نور الایضاح، یا تجوید) کا سبق ہے تو اپنے نوٹس میں اہم نکات درج فرمائیں۔\n' +
      '• مزید تفصیلی فہم کے لیے متعلقہ آڈیو درس کو دوبارہ سنیں۔\n\n' +
      'اللہ تعالیٰ آپ کے علم و عمل میں برکت عطا فرمائے۔ آمین!',
  };
}
