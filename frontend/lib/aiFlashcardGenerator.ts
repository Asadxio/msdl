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
      backRoman: 'Hamza, Ha, Ain, Haa, Ghain, Kha',
      backExplanation: 'مثال: مَنْ آمَنَ ، مِنْ حَكِيمٍ ، أَنْعَمْتَ۔',
      reference: 'تحفة الأطفال / قواعد التجويد',
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
      backRoman: 'Tabassumuka fee wajhi akheeka laka sadaqah.',
      backExplanation: 'دینِ اسلام صرف عبادات کا نام نہیں بلکہ اچھے اخلاق اور نرم برتاؤ کی بھی سخت تاکید کرتا ہے۔',
      reference: 'جامع ترمذی: ۱۹۵۶',
    },
  ],
};

export async function generateAiFlashcards(params: AiCardGenerationParams): Promise<IslamicFlashcard[]> {
  const { topic, count } = params;

  // Simulate ultra-fast AI generation response (300ms)
  await new Promise((resolve) => setTimeout(resolve, 300));

  let pool: Omit<IslamicFlashcard, 'id'>[] = [];
  if (ISLAMIC_TOPIC_FLASHCARD_VAULT[topic]) {
    pool = [...ISLAMIC_TOPIC_FLASHCARD_VAULT[topic]];
  } else {
    // Collect from all topic pools if custom topic
    Object.values(ISLAMIC_TOPIC_FLASHCARD_VAULT).forEach((cards) => {
      pool.push(...cards);
    });
  }

  // Shuffle and pick desired count
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.max(1, Math.min(count, pool.length)));

  return selected.map((card, idx) => ({
    ...card,
    id: 'ai_gen_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).slice(2, 6),
  }));
}