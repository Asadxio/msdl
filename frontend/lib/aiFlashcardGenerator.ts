import { IslamicFlashcard } from '@/constants/flashcardData';

export interface AiCardGenerationParams {
  topic: string;
  count: number;
}

const ISLAMIC_TOPIC_FLASHCARD_VAULT: Record<string, Omit<IslamicFlashcard, 'id'>[]> = {
  'Salah / Namaz': [
    {
      category: 'fiqh',
      categoryTitle: 'فقہی مسائل و نماز',
      topic: 'تکبیرِ تحریمہ کا حکم',
      frontText: 'اللهُ أَكْبَرُ',
      frontSubtitle: 'نماز شروع کرتے وقت دونوں ہاتھ اٹھا کر کہنا',
      backTranslation: 'اللہ سب سے بڑا ہے۔ تکبیرِ تحریمہ نماز کا بنیادی رکن (فرض) ہے جس کے بغیر نماز شروع نہیں ہوتی۔',
      backEnglish: 'Allah is the Greatest. Takbeer-e-Tahreeimah is an obligatory pillar of Salah without which prayer does not commence.',
      backRoman: 'Allahu Akbar',
      backExplanation: 'تکبیر تحریمہ کہتے وقت مرد کانوں کی لو تک اور خواتین سینے / کندھوں تک ہاتھ اٹھاتی ہیں۔',
      reference: 'صحیح بخاری و صحیح مسلم',
    },
    {
      category: 'fiqh',
      categoryTitle: 'فقہی مسائل و نماز',
      topic: 'دعائے قنوت (وتر کی نماز)',
      frontText: 'اللَّهُمَّ إِنَّا نَسْتَعِينُكَ وَنَسْتَغْفِرُكَ وَنُؤْمِنُ بِكَ وَنَتَوَكَّلُ عَلَيْكَ...',
      frontSubtitle: 'نمازِ وتر کی تیسری رکعت میں رکوع سے پہلے پڑھیں',
      backTranslation: 'اے اللہ! ہم تجھ ہی سے مدد مانگتے ہیں، اور تجھ ہی سے مغفرت طلب کرتے ہیں اور تجھ پر ایمان لاتے ہیں۔',
      backEnglish: 'O Allah, we seek Your help, we ask for Your forgiveness, we believe in You and put our trust in You.',
      backRoman: "Allahumma inna nasta'eenuka wa nastaghfiruka...",
      backExplanation: 'نمازِ وتر میں دعائے قنوت پڑھنا فقہ حنفی میں واجب ہے۔ بھول جانے پر سجدہ سہو لازم ہے۔',
      reference: 'مصنف ابن ابی شیبہ / سنن بیہقی',
    },
    {
      category: 'fiqh',
      categoryTitle: 'فقہی مسائل و نماز',
      topic: 'سجدہ سہو کا طریقہ و اصول',
      frontText: 'سَجْدَةُ السَّهْوِ',
      frontSubtitle: 'نماز میں واجب چھوٹنے پر تلافی کا طریقہ',
      backTranslation: 'نماز میں کوئی واجب بھولے سے چھوٹ جائے تو آخری قعدہ میں التحیات کے بعد دائیں طرف سلام پھیر کر دو سجدے کرنا۔',
      backEnglish: 'Sajdah as-Sahw is performing two prostrations after turning the face to the right in the final sitting, to compensate for an unintentionally omitted Wajib act in Salah.',
      backRoman: 'Sajdat-us-Sahw',
      backExplanation: 'سجدہ سہو کرنے سے نماز کی کمی پوری ہو جاتی ہے اور نماز درست ہو جاتی ہے۔',
      reference: 'صحیح بخاری: ۱۲۲۴',
    },
  ],
  'Fasting / Roza': [
    {
      category: 'duas',
      categoryTitle: 'مسائل و دعائیں',
      topic: 'افطار کے وقت کی مسنون دعا',
      frontText: 'ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ وَثَبَتَ الأَجْرُ إِنْ شَاءَ اللَّهُ',
      frontSubtitle: 'روزہ افطار کرتے وقت پڑھیں',
      backTranslation: 'پیاس چلی گئی، رگیں تر ہو گئیں اور ان شاء اللہ ثواب پکا ہو گیا۔',
      backEnglish: 'The thirst is gone, the veins are moistened, and the reward is confirmed, if Allah wills.',
      backRoman: "Dhahabadh-dhama'u wab-tallatil-'urooqu wa thabatal-ajru in sha Allah.",
      backExplanation: 'نبی کریم ﷺ روزہ افطار فرماتے وقت یہ دعا کثرت سے پڑھا کرتے تھے۔',
      reference: 'سنن ابی داؤد: ۲۳۵۷',
    },
    {
      category: 'fiqh',
      categoryTitle: 'فقہی مسائل و روزہ',
      topic: 'روزہ توڑنے والی اور نہ توڑنے والی چیزیں',
      frontText: 'مُفْطِرَاتُ الصَّوْمِ',
      frontSubtitle: 'روزے کے شرعی احکام و فقہ',
      backTranslation: 'جان بوجھ کر کھانا پینا روزہ توڑ دیتا ہے، جبکہ بھول کر کھانے پینے، مسواک کرنے یا آنکھ میں سرمہ ڈالنے سے روزہ نہیں ٹوٹتا۔',
      backEnglish: 'Deliberate eating or drinking breaks the fast. In contrast, eating or drinking forgetfully, using a Miswak, or applying kohl does not invalidate the fast.',
      backRoman: 'Muftirat-us-Sawm',
      backExplanation: 'اگر کوئی شخص بھول کر کھا پی لے تو یاد آتے ہی فوراً رک جائے، اس کا روزہ درست ہے۔',
      reference: 'صحیح بخاری: ۱۹۳۳',
    },
  ],
  'Zakat & Charity': [
    {
      category: 'fiqh',
      categoryTitle: 'احکامِ زکوٰۃ',
      topic: 'نصابِ زکوٰۃ (سونے اور چاندی کا نصاب)',
      frontText: 'نِصَابُ الزَّكَاةِ',
      frontSubtitle: 'زکوٰۃ فرض ہونے کی کم از کم شرعی حد',
      backTranslation: 'ساڑھے سات تولہ سونا یا ساڑھے باون تولہ چاندی یا اس کی مالیت کے برابر نقدی یا مالِ تجارت پر سال گزرنے کے بعد اڑھائی فیصد (2.5%) زکوٰۃ فرض ہے۔',
      backEnglish: 'Nisab is the minimum threshold of wealth requiring Zakat (7.5 tola gold or 52.5 tola silver or equivalent commercial merchandise held for a full lunar year, assessed at 2.5%).',
      backRoman: 'Nisab-uz-Zakat (7.5 Tola Gold / 52.5 Tola Silver)',
      backExplanation: 'زکوٰۃ اسلام کا تیسرا اہم ستون ہے جو غریبوں اور ناداروں کی فلاح کے لیے مقرر کیا گیا ہے۔',
      reference: 'سنن ابی داؤد / درمختار',
    },
    {
      category: 'hadith',
      categoryTitle: 'فضائلِ صدقہ',
      topic: 'صدقہ مال میں کمی نہیں کرتا',
      frontText: 'مَا نَقَصَتْ صَدَقَةٌ مِنْ مَالٍ',
      frontSubtitle: 'اللہ کی راہ میں خرچ کرنے کی برکت',
      backTranslation: 'صدقہ دینے سے مال میں کبھی کمی واقع نہیں ہوتی، بلکہ اللہ تعالیٰ اس میں برکت عطا فرماتا ہے۔',
      backEnglish: 'Charity does not in any way decrease wealth; rather Allah increases it in abundance and blessings.',
      backRoman: 'Ma naqasat sadaqatun min maal.',
      backExplanation: 'صدقہ بلاؤں کو ٹالتا ہے اور اللہ کے غضب کو ٹھنڈا کرتا ہے۔',
      reference: 'صحیح مسلم: ۲۵۸۸',
    },
  ],
  'Tajweed Rules': [
    {
      category: 'tajweed',
      categoryTitle: 'قواعدِ تجوید',
      topic: 'قلقلہ کے حروف (Huruf-e-Qalqalah)',
      frontText: 'قُطْبُ جَدٍّ (ق ، ط ، ب ، ج ، د)',
      frontSubtitle: 'حروف میں جھٹکا یا آواز کا پلٹنا',
      backTranslation: 'قلقلہ کے ۵ حروف ہیں: ق، ط، ب، ج، د۔ جب یہ حروف ساکن ہوں تو ان کی ادائیگی میں مخرج پر آواز ہلکی سی پلٹتی اور گونجتی ہے۔',
      backEnglish: 'The 5 Qalqalah letters are (Qaf, Twa, Baa, Jeem, Daal). When quiescent (sakin), they produce an echoing sound off their articulation point.',
      backRoman: 'Qaf, Ta, Ba, Jeem, Dal',
      backExplanation: 'مثال: الفلق، قل هو الله أحد، تبّت یدا، محبط۔',
      reference: 'المقدمة الجزرية في علم التجويد',
    },
    {
      category: 'tajweed',
      categoryTitle: 'قواعدِ تجوید',
      topic: 'حروفِ حلقی اور اظہار کا قاعدہ',
      frontText: 'حُرُوفُ الْحَلْقِ (ء ، هـ ، ع ، ح ، غ ، خ)',
      frontSubtitle: 'حلق سے ادا ہونے والے ۶ حروف',
      backTranslation: 'نون ساکن یا تنوین کے بعد ان ۶ حروف میں سے کوئی حرف آئے تو نون کو بغیر غنہ کے واضح پڑھا جائے گا، جسے اظہار کہتے ہیں۔',
      backEnglish: 'Throat letters (Huroof-e-Halqi) are 6 (Hamzah, Haa, Ain, Haa, Ghain, Khaa). If any follows Noon Sakinah or Tanween, it is pronounced clearly without nasalization (Izhar).',
      backRoman: 'Hamza, Ha, Ain, Haa, Ghain, Kha',
      backExplanation: 'مثال: مَنْ آمَنَ ، مِنْ حَكِيمٍ ، أَنْعَمْتَ۔',
      reference: 'تحفة الأطفال / قواعد التجويد',
    },
  ],
  'Taharat & Purity': [
    {
      category: 'fiqh',
      categoryTitle: 'طہارت و پاکی کے احکام',
      topic: 'وضو کے فرائض (۴ فرائض)',
      frontText: 'فَاغْسِلُوا وُجُوهَكُمْ وَأَيْدِيَكُمْ إِلَى الْمَرَافِقِ...',
      frontSubtitle: 'سورۃ المائدہ آیت ۶ کے مطابق وضو کے فرائض',
      backTranslation: 'اپنے چہرے دھوؤ، اور کہنیوں تک ہاتھ، اور سر کا مسح کرو اور ٹخنوں تک پاؤں دھوؤ۔',
      backEnglish: 'Wash your faces, and your forearms to the elbows, wipe over your heads, and wash your feet up to the ankles.',
      backRoman: 'Fa-ghsiloo wujoohakum wa aydiyakum ilal maraafiq...',
      backExplanation: 'وضو میں یہ چار اعضاء دھونا فرض ہے، اگر بال برابر جگہ بھی سوکھی رہ جائے تو وضو نہیں ہوگا۔',
      reference: 'قرآن مجید: سورۃ المائدہ (۵:۶)',
    },
    {
      category: 'fiqh',
      categoryTitle: 'طہارت و پاکی کے احکام',
      topic: 'غسل کے فرائض (۳ فرائض)',
      frontText: 'فَرَائِضُ الْغُسْلِ',
      frontSubtitle: 'جسمانی پاکی حاصل کرنے کا شرعی طریقہ',
      backTranslation: 'غسل میں تین فرائض ہیں: ۱. کلی کرنا، ۲. ناک کی نرم ہڈی تک پانی پہنچانا، ۳. پورے جسم پر اس طرح پانی بہانا کہ بال برابر جگہ سوکھی نہ رہے۔',
      backEnglish: 'Ghusl has 3 obligations: 1. Thorough mouth rinsing, 2. Cleansing the nasal passage up to soft bone, 3. Flowing water over every single part of the body.',
      backRoman: 'Faraaid-ul-Ghusl (Kulli, Naak me paani, Poore jism par paani)',
      backExplanation: 'ناپاکی کی حالت سے پاکی حاصل کرنے کے لیے غسل کے ان فرائض کو پورا کرنا لازمی ہے۔',
      reference: 'فتاویٰ ہندیہ / نور الایضاح',
    },
  ],
  'Daily Duas': [
    {
      category: 'duas',
      categoryTitle: 'صبح و شام کی مسنون دعائیں',
      topic: 'سونے اور جاگنے کی مسنون دعا',
      frontText: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ',
      frontSubtitle: 'صبح بیدار ہونے پر پڑھیں',
      backTranslation: 'تمام تعریفیں اللہ کے لیے ہیں جس نے ہمیں مارنے کے بعد زندہ کیا اور اسی کی طرف لوٹ کر جانا ہے۔',
      backEnglish: 'All praise is for Allah Who gave us life after having taken it from us and unto Him is the resurrection.',
      backRoman: 'Alhamdu lillahil-ladhee ahyana ba’da ma amatana wa ilayhin-nushoor.',
      backExplanation: 'نیند کو موت کی بہن قرار دیا گیا ہے، بیدار ہو کر اللہ کی نعمتِ حیات کا شکر ادا کرنا مسنون ہے۔',
      reference: 'صحیح بخاری: ۶۳۱۲',
    },
    {
      category: 'duas',
      categoryTitle: 'صبح و شام کی مسنون دعائیں',
      topic: 'بیت الخلاء میں داخل ہونے کی دعا',
      frontText: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْخُبُثِ وَالْخَبَائِثِ',
      frontSubtitle: 'بایاں پاؤں اندر رکھتے ہوئے پڑھیں',
      backTranslation: 'اے اللہ! میں خبیث جنات (نر اور مادہ) کے شر سے تیری پناہ مانگتا ہوں۔',
      backEnglish: 'O Allah, I seek refuge in You from the evil male and female devils.',
      backRoman: 'Allahumma inni a’oodhu bika minal-khubuthi wal-khabaa’ith.',
      backExplanation: 'یہ دعا گندگی اور شیاطین کے وسوسوں سے روحانی حفاظت فراہم کرتی ہے۔',
      reference: 'صحیح بخاری: ۱۴۲',
    },
  ],
  'Seerah & Akhlaq': [
    {
      category: 'hadith',
      categoryTitle: 'سیرت و اخلاقِ نبوی ﷺ',
      topic: 'حسنِ خلق اور مسکراہٹ کی فضیلت',
      frontText: 'تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ لَكَ صَدَقَةٌ',
      frontSubtitle: 'اسلام میں خوش اخلاقی کی قدر',
      backTranslation: 'اپنے مسلمان بھائی (یا بہن) کے سامنے مسکرا کر ملنا بھی تمہارے لیے صدقہ کا ثواب رکھتا ہے۔',
      backEnglish: 'Your smiling in the face of your brother (or sister) is counted as an act of charity for you.',
      backRoman: 'Tabassumuka fee wajhi akheeka laka sadaqah.',
      backExplanation: 'دینِ اسلام صرف عبادات کا نام نہیں بلکہ اچھے اخلاق اور نرم برتاؤ کی بھی سخت تاکید کرتا ہے۔',
      reference: 'جامع ترمذی: ۱۹۵۶',
    },
  ],
};

function generateDynamicCardsForTopic(topic: string, count: number): Omit<IslamicFlashcard, 'id'>[] {
  return [
    {
      category: 'fiqh',
      categoryTitle: `${topic} - مطالعہ و دہرائی`,
      topic: `${topic} - بنیادی شرعی اصول`,
      frontText: `أَحْكَامُ ${topic.toUpperCase()}`,
      frontSubtitle: `${topic} کی شرعی اہمیت اور احکام`,
      backTranslation: `${topic} کے اسلامی احکام کو سنتِ نبوی ﷺ کے مطابق سیکھنا ہر مسلمان کے لیے ضروری ہے۔`,
      backEnglish: `Mastering the core Islamic rulings of ${topic} ensures our worship and daily conduct align with the Sunnah.`,
      backRoman: `Ahkaam-ut-${topic}`,
      backExplanation: `اس سبق کے نوٹس تیار کریں اور استاذہ کے بتائے ہوئے اہم نکات کو بار بار دہرائیں۔`,
      reference: 'مدارسِ سلفیہ نصابِ تعلیم',
    },
    {
      category: 'hadith',
      categoryTitle: `${topic} - احادیثِ مبارکہ`,
      topic: `${topic} کی فضیلت`,
      frontText: 'طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ',
      frontSubtitle: 'علمِ دین حاصل کرنے کی فرضیت',
      backTranslation: 'علمِ دین حاصل کرنا ہر مسلمان (مرد اور عورت) پر فرض ہے۔',
      backEnglish: 'Seeking sacred knowledge is an obligatory duty upon every Muslim.',
      backRoman: 'Talabul-ilmi fareedatun ‘ala kulli Muslim.',
      backExplanation: `${topic} کا علم حاصل کرنا اسی فرضِ عین کے دائرے میں آتا ہے۔`,
      reference: 'سنن ابن ماجہ: ۲۲۴',
    },
  ];
}

export async function generateAiFlashcards(params: AiCardGenerationParams): Promise<IslamicFlashcard[]> {
  const { topic, count } = params;

  // 1. Server-side Gemini via Firebase Callable Function (P0.1 Security Fix)
  // GEMINI_API_KEY lives in Firebase Secret Manager — NOT in APK.
  try {
    const { callGenerateAIFlashcards } = await import('@/lib/aiGatewayClient');
    const result = await callGenerateAIFlashcards({ topic, count: Math.min(Math.max(count, 1), 10) });
    if (result.cards && result.cards.length > 0) {
      return result.cards as IslamicFlashcard[];
    }
  } catch (err) {
    console.warn('[AiFlashcards] Server generation failed, falling back to static vault:', err);
  }

  // 2. Offline fallback: static vault
  return _staticVaultFallback(topic, count);
}



function _staticVaultFallback(topic: string, count: number): IslamicFlashcard[] {
  let pool: Omit<IslamicFlashcard, 'id'>[] = [];
  if (ISLAMIC_TOPIC_FLASHCARD_VAULT[topic]) {
    pool = [...ISLAMIC_TOPIC_FLASHCARD_VAULT[topic]];
  } else {
    const matchingKey = Object.keys(ISLAMIC_TOPIC_FLASHCARD_VAULT).find(
      (k) => k.toLowerCase().includes(topic.toLowerCase()) || topic.toLowerCase().includes(k.toLowerCase())
    );
    if (matchingKey) {
      pool = [...ISLAMIC_TOPIC_FLASHCARD_VAULT[matchingKey]];
    } else {
      pool = generateDynamicCardsForTopic(topic, count);
    }
  }

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.max(1, Math.min(count, pool.length)));

  return selected.map((card, idx) => ({
    ...card,
    id: 'ai_gen_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).slice(2, 6),
  }));
}