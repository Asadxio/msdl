export type TutorLanguage = 'en' | 'ur';
export type TutorMode = 'tutor' | 'quiz' | 'vocab' | 'summary';

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
  explanation: string;
}

export interface ChatQuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
  userSelectedId?: string;
  answered?: boolean;
}

export interface ChatVocabItem {
  arabic: string;
  transliteration: string;
  root: string;
  meaning: string;
  quranExample?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  isRedirect?: boolean;
  mode?: TutorMode;
  language?: TutorLanguage;
  quiz?: ChatQuizQuestion;
  vocab?: ChatVocabItem[];
  summaryPoints?: string[];
}

export interface SuggestedPrompt {
  id: string;
  title: string;
  prompt: string;
  category: 'quran' | 'tajweed' | 'arabic' | 'history' | 'fiqh' | 'aqeedah';
  language?: TutorLanguage;
}

export interface TutorContext {
  courseTitle?: string;
  lessonTitle?: string;
  language?: TutorLanguage;
  mode?: TutorMode;
}

export const SUGGESTED_STUDY_PROMPTS: SuggestedPrompt[] = [
  // English Prompts
  {
    id: 'en_1',
    title: 'Surah Al-Fatihah Breakdown',
    prompt: 'Explain the word-by-word meanings and central spiritual lessons of Surah Al-Fatihah in English.',
    category: 'quran',
    language: 'en',
  },
  {
    id: 'en_2',
    title: 'Rules of Tajweed (Nun Sakin)',
    prompt: 'Explain the rules of Nun Sakin and Tanween: Izhar, Idgham, Iqlab, and Ikhfa with clear phonetic examples.',
    category: 'tajweed',
    language: 'en',
  },
  {
    id: 'en_3',
    title: '4 Farz of Wudu (Ablution)',
    prompt: 'What are the 4 obligatory acts (Farz) of Wudu in the Hanafi school and what nullifies Wudu?',
    category: 'fiqh',
    language: 'en',
  },
  {
    id: 'en_4',
    title: 'Arkaan of Salah (Pillars)',
    prompt: 'What are the 6 internal pillars (Arkaan) and 6 prerequisites (Sharaait) of a valid Salah?',
    category: 'fiqh',
    language: 'en',
  },
  {
    id: 'en_5',
    title: 'Quiz Me on Today\'s Sabaq',
    prompt: 'Test my understanding of my lesson with an interactive 3-question multiple choice quiz.',
    category: 'aqeedah',
    language: 'en',
  },
  {
    id: 'en_6',
    title: 'Lessons from Battle of Badr',
    prompt: 'What are the historical background and spiritual lessons from the Battle of Badr (17 Ramadan, 2 AH)?',
    category: 'history',
    language: 'en',
  },

  // Urdu Prompts (Preserved authentic Madrasa curriculum)
  {
    id: 'ur_1',
    title: 'قرآنی الفاظ کے معانی',
    prompt: 'سورۃ الفاتحہ کے اہم قرآنی الفاظ کے لغوی معانی سمجھائیں',
    category: 'quran',
    language: 'ur',
  },
  {
    id: 'ur_2',
    title: 'تجوید کا قاعدہ (اخفاء و ادغام)',
    prompt: 'نون ساکن اور تنوین کے بعد اخفاء اور ادغام کب ہوتا ہے؟',
    category: 'tajweed',
    language: 'ur',
  },
  {
    id: 'ur_3',
    title: 'سبق کا آسان خلاصہ',
    prompt: 'فرض علوم اور بنیادی اسلامی عقائد کا آسان تعارف کیا ہے؟',
    category: 'arabic',
    language: 'ur',
  },
  {
    id: 'ur_4',
    title: 'سیرت النبی ﷺ کا واقعہ',
    prompt: 'غزوہِ بدر کے اسباق اور فتح کا مختصر پس منظر کیا ہے؟',
    category: 'history',
    language: 'ur',
  },
];

// Sensitive Fatwa triggers that strictly redirect to qualified live female scholars
const FATWA_TRIGGER_KEYWORDS = [
  'طلاق', 'خلع', 'نکاح کا فسخ', 'حیض کا حکم', 'میراث کا حصہ', 'فتوی',
  'حرام', 'حلال', 'کیا میری نماز ٹوٹ گئی', 'تلاق', 'talaq', 'khula',
  'fatwa', 'haram', 'halal', 'divorce', 'inheritance share',
  'is my marriage valid', 'medical ruling', 'is it permissible to abort',
  'annulment', 'fatawa',
];

export function isFatwaQuery(query: string): boolean {
  const normalized = (query || '').toLowerCase();
  return FATWA_TRIGGER_KEYWORDS.some((kw) => normalized.includes(kw));
}

export function getFatwaRedirectMessage(language: TutorLanguage = 'ur'): string {
  if (language === 'en') {
    return (
      '**Assalamu Alaykum wa Rahmatullahi wa Barakatuh, Dear Student!**\n\n' +
      '⚠️ **Shariah Guidance & Fatwa Notice:**\n' +
      'This inquiry relates to personal Islamic legal jurisprudence (Fiqh / Fatwa) and personal status rulings. ' +
      'In our sacred tradition, artificial intelligence (AI) has **no authority** to issue religious verdicts or legal rulings.\n\n' +
      'Please submit this question directly to the Madrasa\'s official **Dar-ul-Iftaa (Ask Ustaadha)** portal, ' +
      'where senior certified female scholars (Muftiyat / Asaatizah) will provide an authoritative, confidential, and Shariah-compliant response.\n\n' +
      '🔗 *Tap the button below to go directly to Dar-ul-Iftaa.*'
    );
  }

  return (
    'السلام علیکم و رحمۃ اللہ وبرکاتہ محترم طالبہ!\n\n' +
    '⚠️ **فتویٰ و شرعی رہنمائی برائے پردہ:**\n' +
    'یہ سوال خالص شرعی مسئلہ اور فتوے سے متعلق ہے۔ شرعی احکام و فتاویٰ کی نازکی کے پیشِ نظر، مصنوعی ذہانت (AI) کو فتوے کا اختیار نہیں ہے۔\n\n' +
    'براہِ کرم یہ سوال مدرسہ کے **دار الافتاء (Ask Ustaadha)** سیکشن میں ارسال فرمائیں جہاں سینئر مفتیہ صاحبہ و معلمات مکمل پردے کے ساتھ آپ کو مستند شریعت کے مطابق جواب عنایت فرمائیں گی۔\n\n' +
    '🔗 آپ نیچے دیے گئے بٹن پر کلک کر کے براہِ راست دار الافتاء جا سکتی ہیں۔'
  );
}

interface KnowledgeEntry {
  english: string;
  urdu: string;
  vocab?: ChatVocabItem[];
  quiz?: ChatQuizQuestion;
  summaryPointsEn?: string[];
  summaryPointsUr?: string[];
}

const ISLAMIC_KNOWLEDGE: Record<string, KnowledgeEntry> = {
  fatiha: {
    english:
      '### 📖 Surah Al-Fatihah (The Opening / Umm al-Kitab)\n\n' +
      '**Overview:** Revealed in Makkah, Surah Al-Fatihah comprises 7 verses and is the foundational pillar of daily Salah. No prayer is complete without its recitation.\n\n' +
      '#### Word-by-Word Meanings & Analysis:\n' +
      '1. **بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ** (*Bismillahir-Rahmanir-Rahim*)\n' +
      '   • *Meaning:* In the Name of Allah, the Entirely Merciful, the Especially Merciful.\n' +
      '   • *Lesson:* Every good deed and sacred lesson begins with invoking Allah\'s holy Name.\n\n' +
      '2. **الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ** (*Al-hamdu lillahi Rabbil-\'alamin*)\n' +
      '   • *Meaning:* All perfect praise, gratitude, and devotion belong solely to Allah, the Sustainer, Cherisher, and Nourisher of all creation and universes.\n\n' +
      '3. **الرَّحْمَٰنِ الرَّحِيمِ** (*Ar-Rahmanir-Rahim*)\n' +
      '   • *Meaning:* The Most Compassionate (all-encompassing mercy for all creation) and the Most Merciful (specific mercy for believers).\n\n' +
      '4. **مَالِكِ يَوْمِ الدِّينِ** (*Maliki Yawmid-Din*)\n' +
      '   • *Meaning:* Sovereign Master and Sole Judge of the Day of Recompense (Judgment Day).\n\n' +
      '5. **إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ** (*Iyyaka na\'budu wa iyyaka nasta\'in*)\n' +
      '   • *Meaning:* You alone we worship, and from You alone we ask for help.\n' +
      '   • *Spiritual Secret:* This verse sits at the exact center of Surah Al-Fatihah—representing pure Tawheed (Monotheism).\n\n' +
      '6. **اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ** (*Ihdinas-Siratal-Mustaqim*)\n' +
      '   • *Meaning:* Guide us steadily upon the Straight Path.\n\n' +
      '7. **صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ**\n' +
      '   • *Meaning:* The path of those upon whom You have bestowed Your grace (the Prophets, truthful, martyrs, and righteous), not of those who evoked anger or went astray.\n\n' +
      '💡 **Actionable Study Tip:** When reciting in Salah, pause slightly after each ayah to reflect on Allah\'s direct response to you in this divine dialogue.',
    urdu:
      '**سورۃ الفاتحہ کے مبارک الفاظ کے معانی:**\n\n' +
      '• **الْحَمْدُ لِلَّهِ:** تمام تعریفیں اور شکر اللہ ہی کے لیے مخصوص ہیں۔\n' +
      '• **رَبِّ الْعَالَمِينَ:** تمام جہانوں کا پالنے والا اور پرورش فرمانے والا۔\n' +
      '• **الرَّحْمَنِ الرَّحِيمِ:** بے حد رحم فرمانے والا، نہایت مہربان۔\n' +
      '• **مَالِكِ يَوْمِ الدِّينِ:** جزا اور سزا کے دن (قیامت) کا اکیلا مالک۔\n' +
      '• **إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ:** ہم تیری ہی عبادت کرتے ہیں اور تجھ ہی سے مدد مانگتے ہیں۔\n' +
      '• **الصِّرَاطَ الْمُسْتَقِيمَ:** سیدھا اور سچا راستہ۔',
    vocab: [
      { arabic: 'الْحَمْدُ', transliteration: 'Al-Hamd', root: 'ح-م-د (H-M-D)', meaning: 'All Praise and Gratitude', quranExample: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ' },
      { arabic: 'رَبِّ', transliteration: 'Rabb', root: 'ر-ب-ب (R-B-B)', meaning: 'Lord, Sustainer, Educator, Nourisher', quranExample: 'رَبِّ الْعَالَمِينَ' },
      { arabic: 'نَسْتَعِينُ', transliteration: 'Nasta\'in', root: 'ع-و-ن (\'A-W-N)', meaning: 'We seek help and divine aid', quranExample: 'وَإِيَّاكَ نَسْتَعِينُ' },
      { arabic: 'الصِّرَاطَ', transliteration: 'As-Sirat', root: 'ص-ر-ط (S-R-T)', meaning: 'The wide, straight highway of truth', quranExample: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ' },
    ],
    summaryPointsEn: [
      'Surah Al-Fatihah is the foundational pillar of the Quran and prayer.',
      'It divides into two halves: Praise of Allah and a supplication for guidance.',
      'It safeguards the heart against arrogance, doubt, and misguidance.',
    ],
    summaryPointsUr: [
      'سورۃ الفاتحہ قرآن مجید کی ام الکتاب اور ہر نماز کا لازمی رکن ہے۔',
      'اس کے دو حصے ہیں: نصف اللہ کی حمد اور نصف بندے کی دعا پر مشتمل ہے۔',
      'یہ صراط مستقیم پر استقامت کی سب سے عظیم دعا ہے۔',
    ],
    quiz: {
      id: 'quiz_fatiha',
      question: 'In Surah Al-Fatihah, what is the profound meaning of "الرَّبُّ" (Ar-Rabb)?',
      options: [
        { id: 'opt_1', text: 'The Creator only', isCorrect: false, explanation: 'Al-Khaliq means Creator, whereas Ar-Rabb includes creation, sustenance, nurture, and preservation.' },
        { id: 'opt_2', text: 'The Sustainer, Cherisher, and Nourisher of all realms', isCorrect: true, explanation: 'Correct! Ar-Rabb signifies the One who nurtures every soul step-by-step toward perfection.' },
        { id: 'opt_3', text: 'The Mighty Avenger', isCorrect: false, explanation: 'That is Al-Muntaqim.' },
        { id: 'opt_4', text: 'The First and the Last', isCorrect: false, explanation: 'That is Al-Awwal and Al-Akhir.' },
      ],
    },
  },

  tajweed: {
    english:
      '### 🎙️ The Science of Tajweed: Rules of Nun Sakin & Tanween\n\n' +
      '**Definition:** When a stationary Nun (*Nun Sakinah* نْ) or Tanween (ً ٍ ٌ) occurs in the Quran, it has **4 mandatory rules** depending on the letter that immediately follows it:\n\n' +
      '---\n' +
      '#### 1. الإظهار (Al-Izhar - Clear Pronunciation)\n' +
      '• **Letters (6 Throat Letters / الحلق):** ء (Hamzah), هـ (Haa), ع (\'Ayn), ح (Haa), غ (Ghayn), خ (Khaa).\n' +
      '• **Rule:** Pronounce the Nun clearly from its articulation point without any extra nasalization (Ghunnah).\n' +
      '• **Example:** *مَنْ آمَنَ* (Man Aamana), *عَذَابٌ أَلِيمٌ* (\'Adhabun Aleem).\n\n' +
      '#### 2. الإدغام (Al-Idgham - Merging / Assimilation)\n' +
      '• **Letters (6 letters in the mnemonic يَرْمَلُون - Yarmaloon):** ي (Yaa), ر (Raa), م (Meem), ل (Laam), و (Waaw), ن (Nun).\n' +
      '• **Sub-Types:**\n' +
      '  a) *With Ghunnah (4 letters: ي، ن، م، و - Yanmoo):* Merge the Nun with a 2-count nasal humming (e.g. *مَن يَقُولُ* -> *May-yaqool*).\n' +
      '  b) *Without Ghunnah (2 letters: ل، ر):* Completely assimilate the Nun with zero nasalization (e.g. *مِن رَّبِّهِمْ* -> *Mir-rabbihim*).\n\n' +
      '#### 3. الإقلاب (Al-Iqlab - Conversion / Turning)\n' +
      '• **Letter (1 letter):** ب (Baa).\n' +
      '• **Rule:** Change the sound of the Nun into a hidden Meem (م) accompanied by a 2-count Ghunnah.\n' +
      '• **Example:** *مِن بَعْدِ* -> pronounced *Mim-ba\'di* (with soft lip contact).\n\n' +
      '#### 4. الإخفاء (Al-Ikhfa - Concealment / Soft Hiding)\n' +
      '• **Letters (Remaining 15 Arabic letters):** ت، ث، ج، د، ذ، ز، س، ش، ص، ض، ط، ظ، ف، ق، ك.\n' +
      '• **Rule:** Conceal the tongue\'s tip behind the upper teeth and let the sound resonate through the nasal cavity for 2 counts with Ghunnah.\n' +
      '• **Heavy vs Light Ikhfa:** If the following letter is heavy (ص، ض، ط، ظ، ق), the Ghunnah sound is pronounced with full mouth (Tafkheem); otherwise light (Tarqeeq).\n\n' +
      '💡 **Recitation Tip:** Practice keeping your tongue slightly detached from the palate during Ikhfa so the air flows purely through the nose.',
    urdu:
      '**نون ساکن اور تنوین کے بنیادی قواعد:**\n\n' +
      '1. **اظہار (Izhar):** نون ساکن یا تنوین کے بعد حروفِ حلقی (ء، ہ، ع، ح، غ، خ) آئیں تو ظاہر کر کے پڑھا جائے گا۔\n' +
      '2. **ادغام (Idgham):** حروفِ یرملون (ی، ر، م، ل، و، ن) آئیں تو ملا کر پڑھا جائے گا۔ یرملون کے حروف میں غنہ کے ساتھ اور بغیر غنہ کے دو اقسام ہیں۔\n' +
      '3. **اقلاب (Iqlab):** حرفِ باء (ب) آئے تو نون کو میم سے بدل کر غنہ کے ساتھ پڑھیں گے۔\n' +
      '4. **اخفاء (Ikhfa):** باقی 15 حروف میں نون کی آواز ناک میں چھپا کر (غنہ کے ساتھ) ادا کی جائے گی۔',
    vocab: [
      { arabic: 'إِظْهَار', transliteration: 'Izhar', root: 'ظ-ه-ر (Z-H-R)', meaning: 'To make evident and clear', quranExample: 'مَنْ آمَنَ' },
      { arabic: 'إِدْغَام', transliteration: 'Idgham', root: 'د-غ-م (D-Gh-M)', meaning: 'To insert or merge one letter into another', quranExample: 'مَن يَقُولُ' },
      { arabic: 'إِقْلَاب', transliteration: 'Iqlab', root: 'ق-ل-ب (Q-L-B)', meaning: 'To convert/flip sound into Meem', quranExample: 'مِن بَعْدِ' },
      { arabic: 'إِخْفَاء', transliteration: 'Ikhfa', root: 'خ-ف-ی (Kh-F-Y)', meaning: 'To conceal or softly mask the sound', quranExample: 'أَنزَلْنَا' },
    ],
    summaryPointsEn: [
      'Nun Sakinah & Tanween have 4 distinct Tajweed rules: Izhar, Idgham, Iqlab, Ikhfa.',
      'Izhar is applied before the 6 throat letters without Ghunnah.',
      'Idgham merges with Yarmaloon (with or without Ghunnah).',
      'Iqlab turns Nun into Meem before Baa; Ikhfa conceals with Ghunnah before 15 letters.',
    ],
    summaryPointsUr: [
      'نون ساکن اور تنوین کے 4 بنیادی قواعد ہیں: اظہار، ادغام، اقلاب اور اخفاء۔',
      'حروف حلقی پر اظہار ہوتا ہے، یرملون پر ادغام۔',
      'حرف باء پر اقلاب، اور باقی 15 حروف پر اخفاء کیا جاتا ہے۔',
    ],
    quiz: {
      id: 'quiz_tajweed',
      question: 'Which of the following contains an example of Iqlab (الإقلاب)?',
      options: [
        { id: 'opt_1', text: 'مِنْ خَوْفٍ (Min Khawf)', isCorrect: false, explanation: 'This is Izhar because Khaa (خ) is a throat letter.' },
        { id: 'opt_2', text: 'مِن بَعْدِ (Mim-ba\'di)', isCorrect: true, explanation: 'Correct! Nun Sakin followed by Baa (ب) converts the sound to Meem with Ghunnah.' },
        { id: 'opt_3', text: 'مَن يَعْمَلْ (May-ya\'mal)', isCorrect: false, explanation: 'This is Idgham with Ghunnah because of Yaa (ي).' },
        { id: 'opt_4', text: 'أَنْتُمْ (Antum)', isCorrect: false, explanation: 'This is Ikhfa because Taa (ت) is an Ikhfa letter.' },
      ],
    },
  },

  wudu: {
    english:
      '### 💧 Fiqh of Purity: The 4 Farz (Obligatory Acts) of Wudu\n\n' +
      'In accordance with Surah Al-Ma\'idah (Ayah 6) and Hanafi jurisprudence, there are **4 essential Farz** without which Wudu is completely invalid:\n\n' +
      '---\n' +
      '#### The 4 Essential Farz:\n' +
      '1. **Washing the Entire Face Once:**\n' +
      '   • From the top of the forehead down to the bottom of the chin.\n' +
      '   • From earlobe to earlobe horizontally. Every millimeter must be wet.\n\n' +
      '2. **Washing Both Arms Including the Elbows Once:**\n' +
      '   • From fingertips all the way over and including the elbows.\n\n' +
      '3. **Masah (Wiping) of One-Fourth (1/4th) of the Head Once:**\n' +
      '   • Wiping at least a quarter of the head with wet hands is Farz. (Wiping the entire head once is Sunnah Mu\'akkadah).\n\n' +
      '4. **Washing Both Feet Including the Ankles Once:**\n' +
      '   • Washing thoroughly up to and including the protruding ankle bones on both sides.\n\n' +
      '---\n' +
      '#### Crucial Sunnah Practices of Wudu:\n' +
      '• Making intention (Niyyah) and reciting *Bismillah* before starting.\n' +
      '• Using the Miswak to cleanse the teeth.\n' +
      '• Washing hands up to the wrists 3 times at the beginning.\n' +
      '• Rinsing mouth and sniffing water into nostrils 3 times.\n' +
      '• Performing each washing 3 times (the first is Farz, the 2nd & 3rd are Sunnah).\n' +
      '• Maintaining Tartib (order) and Muwalat (washing successively without letting parts dry).\n\n' +
      '#### What Breaks (Nullifies) Wudu (Nawaqid-e-Wudu):\n' +
      '1. Anything discharged from the private passages (urine, stool, gas).\n' +
      '2. Flowing blood or pus that leaves a wound and flows to a place required to be cleaned.\n' +
      '3. Mouthful vomit (food or yellow bile).\n' +
      '4. Sleeping reclining on a side or leaning against a support.\n' +
      '5. Loss of consciousness, fainting, or severe intoxication.\n' +
      '6. Laughing aloud (Qahqaha) in any prayer with Ruku and Sujood (adult worshipper).\n\n' +
      '*(Note: Cutting nails, hair, or clipping beard does NOT break Wudu).*',
    urdu:
      '**وضو کے چار فرائض اور احکام (فقہ حنفی):**\n\n' +
      'قرآن کریم (سورۃ المائدہ، آیت ۶) کے مطابق وضو میں ۴ فرائض ہیں جن کے بغیر وضو نہیں ہوتا:\n' +
      '۱. **ایک مرتبہ پورا چہرہ دھونا:** پیشانی کے بالوں سے ٹھوڑی کے نیچے تک، اور ایک کان کی لو سے دوسرے کان کی لو تک۔\n' +
      '۲. **دونوں ہاتھ کہنیوں سمیت ایک مرتبہ دھونا۔**\n' +
      '۳. **چوتھائی (1/4) سر کا مسح کرنا۔** (پورے سر کا مسح سنت ہے)۔\n' +
      '۴. **دونوں پاؤں ٹخنوں سمیت ایک مرتبہ دھونا۔**\n\n' +
      '**نواقضِ وضو (جن سے وضو ٹوٹ جاتا ہے):**\n' +
      'پیشاب، پاخانہ، ہوا کا خارج ہونا، جسم سے خون یا پیپ بہہ نکلنا، منہ بھر کر قے آنا، ٹیک لگا کر سو جانا، بے ہوشی، اور رکوع و سجدے والی نماز میں قہقہہ مار کر ہنسنا۔',
    vocab: [
      { arabic: 'فَرْض', transliteration: 'Farz', root: 'ف-ر-ض (F-R-D)', meaning: 'Absolute decisive obligation proven by definitive text', quranExample: 'فَرِيضَةً مِّنَ اللَّهِ' },
      { arabic: 'مَسْح', transliteration: 'Masah', root: 'م-س-ح (M-S-H)', meaning: 'Passing wet hands gently over a surface', quranExample: 'وَامْسَحُوا بِرُءُوسِكُمْ' },
      { arabic: 'نَوَاقِض', transliteration: 'Nawaqid', root: 'ن-ق-ض (N-Q-D)', meaning: 'Nullifiers that break ritual purity', quranExample: 'نواقض الوضوء' },
    ],
    summaryPointsEn: [
      'Wudu has 4 obligatory (Farz) acts: Entire face, both arms with elbows, 1/4th head wipe, and feet with ankles.',
      'Washing 3 times, Miswak, and proper order are confirmed Sunnahs.',
      'Blood flowing from wound, gas, and deep sleep break Wudu, but cutting hair or nails does not.',
    ],
    summaryPointsUr: [
      'وضو کے ۴ فرائض ہیں: پورا چہرہ، کہنیوں سمیت ہاتھ، چوتھائی سر کا مسح، اور ٹخنوں سمیت پاؤں۔',
      'مسواک اور تین تین بار دھونا سنت مؤکدہ ہے۔',
      'بہتا ہوا خون، گیس، اور ٹیک لگا کر سونا وضو توڑ دیتے ہیں۔',
    ],
    quiz: {
      id: 'quiz_wudu',
      question: 'Which of the following acts does NOT break (nullify) Wudu according to Hanafi Fiqh?',
      options: [
        { id: 'opt_1', text: 'Blood flowing from a finger wound', isCorrect: false, explanation: 'Flowing blood breaks Wudu in the Hanafi school.' },
        { id: 'opt_2', text: 'Cutting fingernails or trimming hair', isCorrect: true, explanation: 'Correct! Trimming hair or clipping nails does not affect the state of Wudu at all.' },
        { id: 'opt_3', text: 'Mouthful vomiting of bile', isCorrect: false, explanation: 'Mouthful vomit is an established nullifier of Wudu.' },
        { id: 'opt_4', text: 'Deep sleep while reclining on a pillow', isCorrect: false, explanation: 'Sleeping with support that releases bodily muscles breaks Wudu.' },
      ],
    },
  },

  salah: {
    english:
      '### 🕌 Fiqh of Salah: Sharaait (Prerequisites) and Arkaan (Internal Pillars)\n\n' +
      'For Salah (Prayer) to be valid, two sets of conditions must be met: 6 external conditions before starting, and 6 internal pillars within the prayer.\n\n' +
      '---\n' +
      '#### Part A: The 6 External Conditions (Sharaait-e-Namaz):\n' +
      '1. **Taharat (Cleanliness):** Body, clothes, and prayer spot free from major/minor ritual impurity.\n' +
      '2. **Satr-e-Aurat (Proper Covering):** For women, entire body must be covered except face, hands up to wrists, and feet.\n' +
      '3. **Istaqbal-e-Qiblah:** Facing the direction of the Holy Ka\'bah in Makkah.\n' +
      '4. **Waqt (Proper Time):** Ensuring the designated prayer time has commenced.\n' +
      '5. **Niyyah (Intention):** Clear intention in the heart for the specific prayer.\n' +
      '6. **Takbeer-e-Tehreema:** Commencing with *Allahu Akbar* while lifting hands.\n\n' +
      '#### Part B: The 6 Internal Pillars (Arkaan-e-Namaz):\n' +
      '1. **Takbeer-e-Tehreema (The opening Takbeer)**\n' +
      '2. **Qiyam (Standing):** Upright posture in obligatory prayers (if able).\n' +
      '3. **Qira\'at (Recitation):** Reciting at least 1 long ayah or 3 short ayahs of the Quran.\n' +
      '4. **Ruku (Bowing):** Bowing until hands comfortably reach the knees.\n' +
      '5. **Sujood (Prostrations):** Two prostrations on forehead and nose on firm ground.\n' +
      '6. **Qa\'dah Akheerah (Final Sitting):** Sitting for the duration of reciting the full Tashahhud (*At-Tahiyyat*).\n\n' +
      '💡 **Important Note on Sajda Sahw:** If an obligatory (Wajib) act is unintentionally delayed or missed, two prostrations of forgetfulness (Sajda Sahw) before the final Salam correct the prayer.',
    urdu:
      '**نماز کے شرائط و ارکان (فقہ حنفی):**\n\n' +
      'نماز کی درستگی کے لیے ۶ شرائط (نماز سے باہر) اور ۶ ارکان (نماز کے اندر) لازم ہیں:\n' +
      '**شرائط:** ۱. طہارت (بدن، کپڑے، جگہ کی پاکی)، ۲. سترِ عورت (پردہ)، ۳. استقبالِ قبلہ، ۴. وقت کا ہونا، ۵. نیت، ۶. تکبیرِ تحریمہ۔\n\n' +
      '**ارکان:** ۱. تکبیرِ تحریمہ، ۲. قیام، ۳. قراءت، ۴. رکوع، ۵. سجود (دو سجدے)، ۶. قعدہ اخیرہ (التحیات کی مقدار بیٹھنا)۔',
    vocab: [
      { arabic: 'أَرْكَان', transliteration: 'Arkaan', root: 'ر-ک-ن (R-K-N)', meaning: 'Essential internal pillars without which the structure collapses', quranExample: 'أركان الصلاة' },
      { arabic: 'شَرَائِط', transliteration: 'Sharaait', root: 'ش-ر-ط (Sh-R-T)', meaning: 'External prerequisite conditions', quranExample: 'شرائط الصلاة' },
      { arabic: 'سَجْدَةُ السَّهْو', transliteration: 'Sajda Sahw', root: 'س-ہ-و (S-H-W)', meaning: 'Prostration to compensate for accidental omission of Wajib', quranExample: 'سجدة السهو' },
    ],
    summaryPointsEn: [
      'Salah requires 6 external preconditions (Sharaait) before starting, including Satr, Taharat, and Qibla.',
      'Salah has 6 internal pillars (Arkaan): Takbeer, Qiyam, Qiraat, Ruku, Sujood, and Qa\'dah Akheerah.',
      'Sajda Sahw compensates for accidental omission of Wajib acts.',
    ],
    summaryPointsUr: [
      'نماز کی ۶ خارجی شرائط ہیں (طہارت، ستر، قبلہ، وقت، نیت، تحریمہ)۔',
      'نماز کے ۶ داخلی ارکان ہیں (قیام، قراءت، رکوع، سجود، قعدہ اخیرہ)۔',
      'واجب چھوٹنے پر سجدہ سہو سے نماز کی تلافی ہوتی ہے۔',
    ],
    quiz: {
      id: 'quiz_salah',
      question: 'How long is it Farz to sit in the Qa\'dah Akheerah (Final Sitting) of Salah?',
      options: [
        { id: 'opt_1', text: 'For at least 3 minutes', isCorrect: false, explanation: 'Time duration is measured by recitation, not minutes.' },
        { id: 'opt_2', text: 'The time required to recite Tashahhud (At-Tahiyyat)', isCorrect: true, explanation: 'Correct! Sitting for the duration of At-Tahiyyat is an internal Farz pillar.' },
        { id: 'opt_3', text: 'The time required to recite Surah Al-Baqarah', isCorrect: false, explanation: 'That is not required for the sitting obligation.' },
        { id: 'opt_4', text: 'Until the Imam makes Salam only', isCorrect: false, explanation: 'The worshipper must complete the Tashahhud measure.' },
      ],
    },
  },

  aqeedah: {
    english:
      '### 💎 Pillars of Islamic Faith (Usul-ul-Iman)\n\n' +
      'In the famous Hadith of Jibril (peace be upon him), the Prophet Muhammad ﷺ outlined the **6 Essential Pillars of Iman (Faith)**:\n\n' +
      '1. **Belief in Allah:** Affirming His Oneness (Tawheed), His Divine Essence, His Unique Attributes, and that nothing is like unto Him (*Laysa kamithlihi shay\'*).\n' +
      '2. **Belief in His Angels (Mala\'ikah):** Created from pure light, obeying Allah without hesitation (e.g. Jibril, Mika\'il, Israfil, Izra\'il).\n' +
      '3. **Belief in His Revealed Scriptures (Kutub):** The Tawrat (Moses), Zabur (David), Injil (Jesus), and the final uncorrupted Miracle, the Holy Quran.\n' +
      '4. **Belief in His Messengers (Rusul):** From Adam (AS) to the Seal of the Prophets, Muhammad ﷺ.\n' +
      '5. **Belief in the Last Day (Yawm al-Akhir):** Resurrection, Reckoning (Hisab), the Balance (Mizan), the Bridge (Sirat), Jannah, and Jahannam.\n' +
      '6. **Belief in Divine Decree (Al-Qadar):** That all good and hardship occur under Allah\'s all-encompassing knowledge, wisdom, and sovereign will.',
    urdu:
      '**ایمان کے چھ بنیادی ارکان (حدیثِ جبریل):**\n\n' +
      '۱. **اللہ تعالیٰ پر ایمان:** اس کی ذات، صفات اور توحیدِ کامل کا اقرار۔\n' +
      '۲. **فرشتوں پر ایمان:** جو نور سے پیدا کیے گئے اور اللہ کے حکم کے پابند ہیں۔\n' +
      '۳. **آسمانی کتابوں پر ایمان:** تورات، زبور، انجیل، اور سب سے آخری و محفوظ کتاب قرآن مجید۔\n' +
      '۴. **تمام انبیاء و رسل پر ایمان:** حضرت آدم علیہ السلام سے لے کر خاتم النبیین حضرت محمد ﷺ تک۔\n' +
      '۵. **آخرت کے دن پر ایمان:** مرنے کے بعد دوبارہ اٹھنے، حساب و کتاب، اور جنت و دوزخ پر یقین۔\n' +
      '۶. **تقدیر پر ایمان:** خیر و شر کے تمام فیصلے اللہ کے علم و مشیت کے تحت ہونے پر ایمان۔',
    vocab: [
      { arabic: 'تَوْحِيد', transliteration: 'Tawheed', root: 'و-ح-د (W-H-D)', meaning: 'Uncompromising belief in the absolute Oneness of Allah', quranExample: 'قُلْ هُوَ اللَّهُ أَحَدٌ' },
      { arabic: 'قَدَر', transliteration: 'Qadar', root: 'ق-د-ر (Q-D-R)', meaning: 'Divine foreordainment and supreme decree', quranExample: 'إِنَّا كُلَّ شَيْءٍ خَلَقْنَاهُ بِقَدَرٍ' },
    ],
    summaryPointsEn: [
      'Iman consists of 6 foundational pillars established in the Hadith of Jibril.',
      'Tawheed is the cornerstone of every Islamic belief and action.',
      'True belief in Qadar combines personal responsibility with complete reliance on Allah.',
    ],
    summaryPointsUr: [
      'ایمان کے ۶ ستون ہیں جن پر مسلمان کا عقیدہ استوار ہے۔',
      'توحید تمام اسلامی عقائد اور اعمال کی روح ہے۔',
      'تقدیر پر ایمان کا مطلب اللہ کی حکمت پر مکمل بھروسہ ہے۔',
    ],
    quiz: {
      id: 'quiz_aqeedah',
      question: 'Which of the following is NOT one of the 6 Articles of Iman in the Hadith of Jibril?',
      options: [
        { id: 'opt_1', text: 'Belief in the Angels', isCorrect: false, explanation: 'Belief in the Angels is the 2nd article of Iman.' },
        { id: 'opt_2', text: 'Giving Annual Zakat to the Poor', isCorrect: true, explanation: 'Correct! Zakat is an act of Islam (5 Pillars of Islam), not one of the 6 Articles of Iman (Beliefs).' },
        { id: 'opt_3', text: 'Belief in Divine Decree (Al-Qadar)', isCorrect: false, explanation: 'Qadar is the 6th article of Iman.' },
        { id: 'opt_4', text: 'Belief in the Last Day (Hereafter)', isCorrect: false, explanation: 'The Last Day is the 5th article of Iman.' },
      ],
    },
  },

  farz: {
    english:
      '### 📚 Essential Sacred Knowledge (Farz \'Ayn)\n\n' +
      'Every Muslim woman is obligated to acquire personal mastery of **Farz \'Ayn** (individual obligations):\n\n' +
      '1. **Sound Aqeedah (Faith):** Free from shirk, innovation, or superstition.\n' +
      '2. **Taharat (Ritual Purity):** Rules of Wudu, Ghusl, Tayammum, and purification from impurities.\n' +
      '3. **Daily Salah:** Valid conditions, pillars, timings, and correction of prayer mistakes.\n' +
      '4. **Halal & Haram in Daily Life:** Lawful transactions, modesty, guarding the tongue, and honoring family ties.',
    urdu:
      '**فرض علوم و بنیادی اسلامی عقائد:**\n\n' +
      'ہر مسلمان پر بقدرِ ضرورت دینی احکام سیکھنا فرضِ عین ہے، جس میں:\n' +
      '1. عقائدِ صحیحہ (توحید، رسالت، آخرت، ملائکہ، کتبِ سماویہ پر ایمان)\n' +
      '2. طہارت و وضو اور غسل کے بنیادی فرائض\n' +
      '3. پانچوں وقت کی نماز اور اس کے ارکان کا صحیح علم\n' +
      '4. حلال و حرام کی تمیز اور روزمرہ اخلاقیات۔',
    summaryPointsEn: [
      'Farz \'Ayn includes correct Aqeedah, Taharat, daily Salah, and lawful living.',
      'Seeking mandatory knowledge is incumbent upon every Muslim woman.',
    ],
    summaryPointsUr: [
      'فرض عین میں عقائد، طہارت، نماز اور حلال و حرام کی تمیز شامل ہے۔',
      'ضروری دینی علم حاصل کرنا ہر مسلمان پر فرض ہے۔',
    ],
  },

  seerah: {
    english:
      '### 📜 Seerah & Islamic History: Lessons from the Battle of Badr\n\n' +
      '**Date & Occasion:** 17th of Ramadan, 2 AH (624 CE) at the wells of Badr.\n\n' +
      '#### Historical Context & Divine Victory:\n' +
      '• **The Disparity:** 313 ill-equipped Muslim companions faced over 1,000 heavily armored warriors of Quraysh led by Abu Jahl.\n' +
      '• **The Turning Point:** The Prophet Muhammad ﷺ spent the entire preceding night in tears and intense Du\'a in his tent (*Ar-Rishah*), imploring: *"O Allah, if this small band of Muslims is destroyed, You will not be worshipped on this earth."*\n' +
      '• **Divine Assistance:** Allah sent down 1,000 angels led by Angel Jibril (AS) rank upon rank to assist the believers.\n' +
      '• **Outcome:** Decisive Muslim victory; 70 Quraysh chieftains were slain and 70 taken captive.\n\n' +
      '#### Enduring Spiritual Lessons for Students of Sacred Knowledge:\n' +
      '1. **Victory is from Allah alone:** Numbers and worldly resources are secondary to sincerity, Taqwa, and obedience.\n' +
      '2. **Power of Sincere Du\'a:** Even with preparations, supplication to Allah remains the ultimate shield.\n' +
      '3. **Exemplary Adab in Captivity:** The Prophet ﷺ instructed his companions to feed the prisoners of war bread while they themselves ate simple dates.',
    urdu:
      '**غزوہِ بدر کے اسباق (۱۷ رمضان المبارک ۲ ہجری):**\n\n' +
      '• حق و باطل کا پہلا فیصلہ کن معرکہ تھا۔\n' +
      '• مسلمانوں کی تعداد صرف ۳۱۳ تھی جبکہ کفار ۱۰۰۰ سے زائد اسلحہ بند تھے۔\n' +
      '• **اہم سبق:** کامیابی ظاہری ساز و سامان کے بجائے اللہ پر پختہ توکل، خلوصِ نیت، اور رسول اللہ ﷺ کی اطاعت سے ملتی ہے۔\n' +
      '• نبی کریم ﷺ کی رات بھر کی گریہ و زاری اور دعائیں ہمارے لیے درس ہیں کہ سب تدابیر کے بعد بھی اصل سہارا دعا ہے۔',
    vocab: [
      { arabic: 'فُرْقَان', transliteration: 'Furqan', root: 'ف-ر-ق (F-R-Q)', meaning: 'The criterion separating truth from falsehood (Day of Badr)', quranExample: 'يَوْمَ الْفُرْقَانِ يَوْمَ الْتَقَى الْجَمْعَانِ' },
      { arabic: 'تَوَكُّل', transliteration: 'Tawakkul', root: 'و-ک-ل (W-K-L)', meaning: 'Utmost reliance on Allah after taking reasonable means', quranExample: 'وَعَلَى اللَّهِ فَتَوَكَّلُوا' },
    ],
    summaryPointsEn: [
      'Battle of Badr took place on 17 Ramadan 2 AH: 313 Muslims against 1000 Quraysh.',
      'Allah sent 1000 angels to grant decisive victory to the believers.',
      'Key lesson: Sincerity, sincere Du\'a, and reliance on Allah outweigh numerical odds.',
    ],
    summaryPointsUr: [
      'غزوہ بدر ۱۷ رمضان ۲ ہجری کو ۳۱۳ مسلمانوں اور ۱۰۰۰ کافروں کے درمیان ہوا۔',
      'اللہ نے فرشتوں کے نزول سے مسلمانوں کو فتح مبین عطا فرمائی۔',
      'سبق: خلوص، دعا اور توکل ہر ساز و سامان سے بڑھ کر ہے۔',
    ],
    quiz: {
      id: 'quiz_seerah',
      question: 'On what Islamic date did the decisive Battle of Badr take place?',
      options: [
        { id: 'opt_1', text: '1st of Shawwal, 3 AH', isCorrect: false, explanation: 'That is the day of Eid al-Fitr.' },
        { id: 'opt_2', text: '17th of Ramadan, 2 AH', isCorrect: true, explanation: 'Correct! The Day of Criterion (Yawm al-Furqan) occurred on 17 Ramadan 2 AH.' },
        { id: 'opt_3', text: '10th of Muharram, 1 AH', isCorrect: false, explanation: 'That is the Day of Ashura.' },
        { id: 'opt_4', text: '27th of Rajab, 5 AH', isCorrect: false, explanation: 'That is Isra and Mi\'raj.' },
      ],
    },
  },
};

export interface TutorResponse {
  text: string;
  isRedirect?: boolean;
  quiz?: ChatQuizQuestion;
  vocab?: ChatVocabItem[];
  summaryPoints?: string[];
  mode?: TutorMode;
  language?: TutorLanguage;
}

export async function askAiSabaqAssistant(
  question: string,
  history: ChatMessage[] = [],
  context: TutorContext = {}
): Promise<TutorResponse> {
  const cleanQ = (question || '').trim();
  const language: TutorLanguage = context.language || (/[a-zA-Z]/.test(cleanQ) ? 'en' : 'ur');
  const mode: TutorMode = context.mode || 'tutor';

  if (!cleanQ) {
    return {
      text: language === 'en'
        ? 'Please enter your question about your sabaq or lesson topic.'
        : 'برائے مہربانی اپنا تعلیمی سوال درج فرمائیں۔',
      language,
    };
  }

  // 1. Strict Shariah Guardrail Check: Intercept sensitive Fiqh/Fatwa questions
  if (isFatwaQuery(cleanQ)) {
    return {
      text: getFatwaRedirectMessage(language),
      isRedirect: true,
      language,
    };
  }

  const lower = cleanQ.toLowerCase();

  // 2. Resolve Topic Entry
  let matchedKey: string | null = null;
  if (lower.includes('فاتحہ') || lower.includes('fatiha') || lower.includes('opening') || lower.includes('الفاظ')) {
    matchedKey = 'fatiha';
  } else if (lower.includes('تجوید') || lower.includes('tajweed') || lower.includes('اخفاء') || lower.includes('ادغام') || lower.includes('noon') || lower.includes('nun')) {
    matchedKey = 'tajweed';
  } else if (lower.includes('وضو') || lower.includes('wudu') || lower.includes('ablution') || lower.includes('غسل')) {
    matchedKey = 'wudu';
  } else if (lower.includes('نماز') || lower.includes('salah') || lower.includes('namaz') || lower.includes('ارکان') || lower.includes('prayer')) {
    matchedKey = 'salah';
  } else if (lower.includes('عقائد') || lower.includes('عقیدہ') || lower.includes('aqeedah') || lower.includes('iman') || lower.includes('faith') || lower.includes('pillar')) {
    matchedKey = 'aqeedah';
  } else if (lower.includes('فرض') || lower.includes('farz')) {
    matchedKey = 'farz';
  } else if (lower.includes('بدر') || lower.includes('سیرت') || lower.includes('غزوہ') || lower.includes('تاریخ') || lower.includes('badr') || lower.includes('seerah')) {
    matchedKey = 'seerah';
  }

  // 3. Handle Explicit Pedagogical Modes
  if (matchedKey && ISLAMIC_KNOWLEDGE[matchedKey]) {
    const entry = ISLAMIC_KNOWLEDGE[matchedKey];

    // MODE: QUIZ ME
    if (mode === 'quiz' || lower.includes('quiz') || lower.includes('test me') || lower.includes('امتحان')) {
      const quiz = entry.quiz;
      if (quiz) {
        const introText = language === 'en'
          ? `🧠 **Interactive Sabaq Quiz: ${matchedKey.toUpperCase()}**\n\nTest your understanding with the question below. Tap your answer to check whether you have mastered this concept!`
          : `🧠 **سبق کا خود تشخیصی امتحان:**\n\nنیچے دیے گئے سوال میں درست جواب کا انتخاب کریں اور اپنی تیاری چیک فرمائیں!`;
        return {
          text: introText,
          quiz,
          mode: 'quiz',
          language,
        };
      }
    }

    // MODE: VOCABULARY (MUFRADAT)
    if (mode === 'vocab' || lower.includes('vocabulary') || lower.includes('مفردات') || lower.includes('root analysis')) {
      const vocab = entry.vocab || [];
      const list = vocab.map((v) => `• **${v.arabic}** (${v.transliteration}): ${v.meaning} [Root: ${v.root}]`).join('\n');
      const text = language === 'en'
        ? `🔤 **Key Arabic Vocabulary & Root Analysis:**\n\n${list}`
        : `🔤 **قرآنی و علمی مفردات کا لغوی تجزیہ:**\n\n${list}`;
      return {
        text,
        vocab,
        mode: 'vocab',
        language,
      };
    }

    // MODE: SUMMARY (KHULASA)
    if (mode === 'summary' || lower.includes('summary') || lower.includes('خلاصہ') || lower.includes('recap')) {
      const summaryPoints = language === 'en' ? entry.summaryPointsEn : entry.summaryPointsUr;
      const text = language === 'en'
        ? `⚡ **Executive Sabaq Summary (Quick Revision):**\n\n` + (summaryPoints?.map((p) => `• ${p}`).join('\n') || '')
        : `⚡ **سبق کا فوری خلاصہ (امتحانی دہرائی):**\n\n` + (summaryPoints?.map((p) => `• ${p}`).join('\n') || '');
      return {
        text,
        summaryPoints,
        mode: 'summary',
        language,
      };
    }

    // DEFAULT MODE: TUTOR (FULL EXPLANATION)
    return {
      text: language === 'en' ? entry.english : entry.urdu,
      vocab: entry.vocab,
      quiz: entry.quiz,
      summaryPoints: language === 'en' ? entry.summaryPointsEn : entry.summaryPointsUr,
      mode: 'tutor',
      language,
    };
  }

  // 4. Dynamic Contextual Educational Answer (fallback / general tutor guidance)
  if (language === 'en') {
    const courseContextNote = context.lessonTitle
      ? `\n\n📚 **Regarding your current lesson:** *"${context.lessonTitle}"* (${context.courseTitle || 'Madrasa Course'})`
      : '';

    return {
      text:
        `**Assalamu Alaykum wa Rahmatullahi wa Barakatuh, Dear Student!**\n\n` +
        `Regarding your sabaq question: **"${cleanQ}"**${courseContextNote}\n\n` +
        `Here is the academic guidance to help you master this concept:\n\n` +
        `1. **Core Concept:** In the study of sacred knowledge, every rule is grounded in classical texts (such as *Nur al-Idah*, *Quduri*, or classical Tajweed treatises).\n` +
        `2. **Method of Study:**\n` +
        `   • Repeat the original Arabic definition 3 times aloud to memorize with proper articulation.\n` +
        `   • Take notes of the exceptions (*Istithna*) and conditions (*Shuroot*).\n` +
        `   • Listen to the teacher's explanation in your course audio recording.\n\n` +
        `💡 *Tip: You can switch to **Quiz Me** mode to test yourself on this concept or tap **Vocabulary** to examine the Arabic roots!*`,
      mode,
      language,
    };
  }

  // Urdu Fallback
  return {
    text:
      'السلام علیکم محترم طالبہ!\n\n' +
      'آپ کے سوال **« ' + cleanQ + ' »** سے متعلق علمی وضاحت:\n\n' +
      'علمِ دین میں گہرائی حاصل کرنے کے لیے بنیادی متن کو بار بار دہرائیں اور استاذہ کے بتائے ہوئے اصولوں کو پیشِ نظر رکھیں۔\n\n' +
      '💡 **مطالعہ کے لیے مشورہ:**\n' +
      '• اگر یہ کسی مخصوص کتاب (جیسے قدوری، نور الایضاح، یا تجوید) کا سبق ہے تو اپنے نوٹس میں اہم نکات درج فرمائیں۔\n' +
      '• مزید تفصیلی فہم کے لیے متعلقہ آڈیو درس کو دوبارہ سنیں۔\n\n' +
      'اللہ تعالیٰ آپ کے علم و عمل میں برکت عطا فرمائے۔ آمین!',
    mode,
    language,
  };
}

// ─── Chat History Persistence ───────────────────────────────────────────────
export const STORAGE_KEY_AI_CHAT = '@mslb_ai_chat_history_v1';

export async function loadSavedAiChat(): Promise<ChatMessage[]> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const raw = await AsyncStorage.getItem(STORAGE_KEY_AI_CHAT);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[AiAssistant] Failed to load saved chat history:', err);
    return [];
  }
}

export async function saveAiChat(messages: ChatMessage[]): Promise<void> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    // Persist up to the latest 50 messages to keep storage light and fast
    const slice = messages.slice(-50);
    await AsyncStorage.setItem(STORAGE_KEY_AI_CHAT, JSON.stringify(slice));
  } catch (err) {
    console.warn('[AiAssistant] Failed to save chat history:', err);
  }
}

export async function clearSavedAiChat(): Promise<void> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.removeItem(STORAGE_KEY_AI_CHAT);
  } catch (err) {
    console.warn('[AiAssistant] Failed to clear chat history:', err);
  }
}
