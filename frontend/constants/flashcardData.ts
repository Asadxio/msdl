export interface IslamicFlashcard {
  id: string;
  category: 'duas' | 'hadith' | 'fiqh' | 'tajweed';
  categoryTitle: string;
  topic: string;
  frontText: string;
  frontSubtitle?: string;
  backTranslation: string;
  backEnglish?: string;
  backRoman?: string;
  backExplanation?: string;
  reference: string;
}

export const FLASHCARD_CATEGORIES = [
  { id: 'duas', label: 'Masnoon Duas (دعائیں)', icon: 'heart', color: '#10B981' },
  { id: 'hadith', label: '40 Hadiths (احادیث)', icon: 'book', color: '#3B82F6' },
  { id: 'fiqh', label: 'Fiqh Rules (مسائل)', icon: 'shield-checkmark', color: '#F59E0B' },
  { id: 'tajweed', label: 'Tajweed Rules (تجوید)', icon: 'sparkles', color: '#8B5CF6' },
] as const;

export const ISLAMIC_FLASHCARDS: IslamicFlashcard[] = [
  // ─── 1. MASNOON DUAS ───
  {
    id: 'dua_sleep',
    category: 'duas',
    categoryTitle: 'مسنون دعائیں',
    topic: 'سوتے وقت کی مسنون دعا',
    frontText: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
    frontSubtitle: 'جب بستر پر لیٹنے لگیں تو یہ مسنون دعا پڑھیں',
    backTranslation: 'اے اللہ! میں تیرے ہی نام کے ساتھ مرتا (سوتا) ہوں اور جیتا (جاگتا) ہوں۔',
    backEnglish: 'O Allah, in Your name I die and I live.',
    backRoman: 'Bismika Allahumma amootu wa ahya.',
    backExplanation: 'نیند موت کی بہن ہے، اس دعا کے ذریعے بندہ اپنی روح اللہ کے سپرد کرتا ہے۔',
    reference: 'صحیح بخاری: ۶۳۲۴',
  },
  {
    id: 'dua_wake',
    category: 'duas',
    categoryTitle: 'مسنون دعائیں',
    topic: 'نیند سے بیدار ہونے کی دعا',
    frontText: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ',
    frontSubtitle: 'صبح آنکھ کھلتے ہی شکرانے کے طور پر پڑھیں',
    backTranslation: 'تمام تعریفیں اللہ کے لیے ہیں جس نے ہمیں مارنے کے بعد زندہ کیا اور اسی کی طرف اٹھنا ہے۔',
    backEnglish: 'All praise is for Allah who gave us life after having caused us to die and unto Him is the resurrection.',
    backRoman: 'Alhamdu lillahilladhi ahyana ba\'da ma amatana wa ilayhin-nushoor.',
    backExplanation: 'صبح بیدار ہونے پر نئی زندگی ملنے پر اللہ تعالیٰ کا شکر ادا کرنے کی دعا ہے۔',
    reference: 'صحیح بخاری: ۶۳۱۲',
  },
  {
    id: 'dua_travel',
    category: 'duas',
    categoryTitle: 'مسنون دعائیں',
    topic: 'سفر اور سواری کی دعا',
    frontText: 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ وَإِنَّا إِلَى رَبِّنَا لَمُنْقَلِبُونَ',
    frontSubtitle: 'کسی بھی سواری یا سفر کے آغاز پر پڑھیں',
    backTranslation: 'پاک ہے وہ ذات جس نے اس کو ہمارے تابع کر دیا، ورنہ ہم اسے قابو میں لانے والے نہ تھے، اور یقیناً ہم اپنے رب ہی کی طرف لوٹنے والے ہیں۔',
    backEnglish: 'Glory be to Him Who has subjected this to us, whereas we were unable to subdue it by ourselves, and indeed unto our Lord we shall return.',
    backRoman: 'Subhanalladhi sakh-khara lana hadha wa ma kunna lahu muqrineen, wa inna ila rabbina lamun-qaliboon.',
    backExplanation: 'سفر کے دوران اللہ کی حفاظت اور آخرت کے حقیقی سفر کی یاد دہانی۔',
    reference: 'سورۃ الزخرف: ۱۳-۱۴ / جامع ترمذی',
  },
  {
    id: 'dua_wudu_after',
    category: 'duas',
    categoryTitle: 'مسنون دعائیں',
    topic: 'وضو کے بعد کی فضیلت والی دعا',
    frontText: 'أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ، اللَّهُمَّ اجْعَلْنِي مِنَ التَّوَّابِينَ وَاجْعَلْنِي مِنَ الْمُتَطَهِّرِينَ',
    frontSubtitle: 'وضو مکمل کرنے کے بعد آسمان کی طرف نگاہ کر کے پڑھیں',
    backTranslation: 'میں گواہی دیتی ہوں کہ اللہ کے سوا کوئی معبود نہیں وہ اکیلا ہے، اور محمد ﷺ اس کے بندے اور رسول ہیں۔ اے اللہ! مجھے توبہ کرنے والوں اور خوب پاکیزہ رہنے والوں میں بنا دے۔',
    backEnglish: 'I testify that there is no deity except Allah alone with no partner, and I testify that Muhammad is His slave and Messenger. O Allah, make me of those who repent and make me of those who purify themselves.',
    backRoman: 'Ashhadu alla ilaha illallahu wahdahu la shareeka lah... Allahummaj-alni minat-tawwabeen waj-alni minal-mutatahhireen.',
    backExplanation: 'اس دعا کے پڑھنے والے کے لیے جنت کے آٹھوں دروازے کھول دیے جاتے ہیں۔',
    reference: 'جامع ترمذی: ۵۵',
  },

  // ─── 2. 40 HADITHS ───
  {
    id: 'hadith_niyyah',
    category: 'hadith',
    categoryTitle: '۴۰ احادیثِ مبارکہ',
    topic: 'حدیثِ نیت (اعمال کا دارومدار)',
    frontText: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى',
    frontSubtitle: 'تمام دینی و دنیوی اعمال کی قبولیت کی بنیادی شرط',
    backTranslation: 'اعمال کا دارومدار صرف نیتوں پر ہے، اور ہر انسان کے لیے وہی ہے جس کی اس نے نیت کی۔',
    backEnglish: 'Actions are judged strictly by intentions, and every person will have only what they intended.',
    backRoman: 'Innamal a\'maalu bin-niyyaat, wa innama likullim-ri\'in ma nawa.',
    backExplanation: 'یہ حدیث اسلام کی بنیاد ہے۔ اخلاصِ نیت کے بغیر کوئی نیک عمل اللہ کے ہاں قبول نہیں ہوتا۔',
    reference: 'صحیح بخاری: ۱ / صحیح مسلم: ۱۹۰۷',
  },
  {
    id: 'hadith_muslim',
    category: 'hadith',
    categoryTitle: '۴۰ احادیثِ مبارکہ',
    topic: 'حقیقی مسلمان کی پہچان',
    frontText: 'الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ',
    frontSubtitle: 'اخلاقِ حسنہ اور دوسروں کو تکلیف نہ پہنچانے کا حکم',
    backTranslation: 'کامل مسلمان وہ ہے جس کی زبان اور ہاتھ (کی تکلیف) سے دوسرے مسلمان محفوظ رہیں۔',
    backEnglish: 'A true Muslim is the one from whose tongue and hand other Muslims are safe.',
    backRoman: 'Al-Muslimu man salimal-Muslimoona min lisanihi wa yadih.',
    backExplanation: 'غیبت، طعنہ زنی، اور ہاتھ کی زیادتی سے بچنا کامل ایمان کی علامت ہے۔',
    reference: 'صحیح بخاری: ۱۰ / صحیح مسلم: ۴۰',
  },
  {
    id: 'hadith_quran',
    category: 'hadith',
    categoryTitle: '۴۰ احادیثِ مبارکہ',
    topic: 'بہترین انسان کون؟',
    frontText: 'خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ',
    frontSubtitle: 'قرآن کریم سیکھنے اور سکھانے کی عظیم فضیلت',
    backTranslation: 'تم میں سب سے بہترین شخص وہ ہے جو قرآن سیکھے اور دوسروں کو سکھائے۔',
    backEnglish: 'The best among you are those who learn the Quran and teach it to others.',
    backRoman: 'Khayrukum man ta\'allamal-Qur\'ana wa \'allamah.',
    backExplanation: 'قرآن مجید کی تعلیم و تدریس امت میں سب سے افضل ترین عمل ہے۔',
    reference: 'صحیح بخاری: ۵۰۲۷',
  },

  // ─── 3. FIQH ESSENTIALS ───
  {
    id: 'fiqh_wudu_faraiz',
    category: 'fiqh',
    categoryTitle: 'فقہی مسائل',
    topic: 'وضو کے فرائض',
    frontText: 'وضو میں کتنے فرائض ہیں اور کون کون سے ہیں؟',
    frontSubtitle: 'فقہ حنفی کے مطابق طہارت کا بنیادی رکن',
    backTranslation: 'وضو کے ۴ فرائض ہیں:\n۱. ایک بار پورا چہرہ دھونا (پیشانی سے ٹھوڑی اور کان کی لو تک)\n۲. کہنیوں سمیت دونوں ہاتھ دھونا\n۳. چوتھائی (۱/۴) سر کا مسح کرنا\n۴. ٹخنوں سمیت دونوں پاؤں دھونا۔',
    backEnglish: 'There are 4 obligatory acts (Faraiz) of Wudu:\n1. Washing the entire face once (from top of forehead to chin, and earlobe to earlobe)\n2. Washing both arms up to and including elbows\n3. Wiping (Masah) at least one-fourth of the head\n4. Washing both feet up to and including ankles.',
    backRoman: 'Wudu ke 4 faraiz: Chehra dhona, hath kohniyon samet, 1/4 sar ka masah, aur paon takhno samet dhona.',
    backExplanation: 'اگر ان میں سے ایک بال برابر جگہ بھی سوکھی رہ جائے تو وضو نہیں ہوگا اور نماز درست نہ ہوگی۔',
    reference: 'سورۃ المائدۃ: ۶ / الہدایۃ',
  },
  {
    id: 'fiqh_namaz_sharaait',
    category: 'fiqh',
    categoryTitle: 'فقہی مسائل',
    topic: 'نماز کی بنیادی شرائط',
    frontText: 'نماز شروع کرنے سے پہلے کتنی شرطیں ضروری ہیں؟',
    frontSubtitle: 'نماز کی صحت کے لیے بیرونی شرائط',
    backTranslation: 'نماز کی ۶ شرائط ہیں:\n۱. بدن کا پاک ہونا\n۲. کپڑوں کا پاک ہونا\n۳. نماز کی جگہ کا پاک ہونا\n۴. ستر کا چھپانا (پردہ)\n۵. نماز کا وقت ہونا\n۶. قبلہ رخ ہونا اور نیت کرنا۔',
    backEnglish: 'There are 6 essential prerequisites (Sharaait) before starting prayer:\n1. Purity of body (Taharah)\n2. Purity of clothes\n3. Purity of place\n4. Covering the Satr (proper modesty/hijab)\n5. Arrival of prescribed prayer time\n6. Facing the Qiblah and forming the intention (Niyyah).',
    backRoman: 'Namaz ki 6 sharaait: Badan, kapde, jagah ki pakizgi, satr-e-aurat, waqt, aur Qibla rukh hona.',
    backExplanation: 'ان شرائط کے بغیر تکبیر تحریمہ باندھنا باطل ہے۔',
    reference: 'نور الایضاح / قدوری',
  },

  // ─── 4. TAJWEED & VOCABULARY ───
  {
    id: 'tajweed_ikhfa',
    category: 'tajweed',
    categoryTitle: 'تجوید و قواعد',
    topic: 'اخفاء کا قاعدہ اور حروف',
    frontText: 'اخفاء کسے کہتے ہیں اور اس کے کتنے حروف ہیں؟',
    frontSubtitle: 'تلاوتِ قرآن مجید کا اہم قاعدہ',
    backTranslation: 'اخفاء کا لغوی معنی "چھپانا" ہے۔\nنون ساکن یا تنوین کے بعد اگر اخفاء کے ۱۵ حروف (ت، ث، ج، د، ذ، ز، س، ش، ص، ض، ط، ظ، ف، ق، ک) میں سے کوئی حرف آئے تو نون کی آواز ناک میں چھپا کر ۱ الف کی مقدار غنہ کے ساتھ پڑھتے ہیں۔',
    backEnglish: 'Ikhfa literally means "to conceal". If any of the 15 Ikhfa letters (Ta, Tha, Jeem, Dal, Dhal, Zay, Seen, Sheen, Saad, Daad, Taa, Dhaa, Faa, Qaaf, Kaaf) follows a Noon Sakinah or Tanween, the Noon sound is concealed into the nasal passage with Ghunnah for 1 Alif duration.',
    backRoman: 'Noon sakin ya tanween ke baad 15 huroof-e-ikhfa aayein to nak me awaz chupana.',
    backExplanation: 'مثال: مِن قَبْلِكُم، أَنفُسَكُمْ۔',
    reference: 'قواعد التجوید / جزریہ',
  },
  {
    id: 'tajweed_qalqalah',
    category: 'tajweed',
    categoryTitle: 'تجوید و قواعد',
    topic: 'قلقلہ کے حروف اور اس کا طریقہ',
    frontText: 'قلقلہ کے کون سے حروف ہیں اور یہ کب ہوتا ہے؟',
    frontSubtitle: 'حروف کو ہلا کر پڑھنے کا فن',
    backTranslation: 'قلقلہ کے ۵ حروف ہیں جن کا مجموعہ «قُطْبُ جَدٍّ» (ق، ط، ب، ج، د) ہے۔\nجب یہ حروف ساکن ہوں تو مخرج میں جنبش پیدا کر کے آواز کو واپس لوٹایا جاتا ہے تاکہ واضح سنائی دے۔',
    backEnglish: 'Qalqalah comprises 5 letters grouped in «قُطْبُ جَدٍّ» (Qaaf, Twa, Baa, Jeem, Daal). When any of these letters carries a Sukoon (is quiescent), an echoing/bouncing sound is produced at its articulation point for distinct audibility.',
    backRoman: 'Huroof-e-Qalqalah 5 hain (Qaf, Twa, Baa, Jeem, Daal). Sakin hone par awaz me jumbish hoti hai.',
    backExplanation: 'مثال: قُلْ هُوَ اللَّهُ أَحَدْ، الْفَلَقْ۔',
    reference: 'مقدمۃ الجزریۃ',
  },
];
