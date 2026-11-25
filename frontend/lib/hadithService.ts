import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  HadithBook,
  HadithBookId,
  HadithBookmark,
  HadithChapter,
  HadithEntry,
} from '@/types/islamic';

/**
 * Canonical Hadith Books Catalog (The Kutub as-Sittah + Muwatta Malik)
 */
export const HADITH_BOOKS: HadithBook[] = [
  {
    id: 'bukhari',
    titleEnglish: 'Sahih al-Bukhari',
    titleArabic: 'صَحِيحُ الْبُخَارِيِّ',
    titleUrdu: 'صحیح البخاری',
    author: 'Imam Muhammad al-Bukhari',
    deathYearHijri: 256,
    totalHadith: 7563,
    totalChapters: 97,
    descriptionEn: 'The most authentic book of Hadith after the Holy Quran, containing universally accepted Sahih narrations.',
    descriptionUr: 'قرآن مجید کے بعد روئے زمین پر سب سے صحیح ترین کتاب، جس کی تمام احادیث قطعی طور پر صحیح ہیں۔',
    colorBg: '#ECFDF5',
    colorFg: '#059669',
  },
  {
    id: 'muslim',
    titleEnglish: 'Sahih Muslim',
    titleArabic: 'صَحِيحُ مُسْلِمٍ',
    titleUrdu: 'صحیح مسلم',
    author: 'Imam Muslim ibn al-Hajjaj',
    deathYearHijri: 261,
    totalHadith: 7500,
    totalChapters: 56,
    descriptionEn: 'Renowned for its rigorous arrangement, preservation of chains (Asanid), and strict Sahih criteria.',
    descriptionUr: 'حسنِ ترتیب اور سندوں کی حفاظت میں لاجواب، کتبِ حدیث میں صحیح بخاری کا ہم پلہ مجموعہ۔',
    colorBg: '#EEF2FF',
    colorFg: '#4F46E5',
  },
  {
    id: 'abudawud',
    titleEnglish: 'Sunan Abu Dawud',
    titleArabic: 'سُنَنُ أَبِي دَاوُدَ',
    titleUrdu: 'سنن ابی داؤد',
    author: 'Imam Abu Dawud as-Sijistani',
    deathYearHijri: 275,
    totalHadith: 5274,
    totalChapters: 43,
    descriptionEn: 'The foremost compilation specializing in legal rulings and Ahkam of Islamic jurisprudence.',
    descriptionUr: 'فقہی احکام اور مسائلِ شریعت پر لکھی گئی سب سے بنیادی اور جامع ترین سنن کتاب۔',
    colorBg: '#FEF3C7',
    colorFg: '#D97706',
  },
  {
    id: 'tirmidhi',
    titleEnglish: 'Jami at-Tirmidhi',
    titleArabic: 'جَامِعُ التِّرْمِذِيِّ',
    titleUrdu: 'جامع الترمذی',
    author: 'Imam Abu Isa at-Tirmidhi',
    deathYearHijri: 279,
    totalHadith: 3956,
    totalChapters: 49,
    descriptionEn: 'Famous for detailed Hadith authenticity gradings (Sahih, Hasan, Da\'if) and legal opinions of scholars.',
    descriptionUr: 'احادیث کی صحت و سقم کے تفصیلی درجات اور فقہاء کے مذاہب کے بیان میں ممتاز کتاب۔',
    colorBg: '#FFF7ED',
    colorFg: '#EA580C',
  },
  {
    id: 'nasai',
    titleEnglish: 'Sunan an-Nasa\'i',
    titleArabic: 'سُنَنُ النَّسَائِيِّ (الْمُجْتَبَى)',
    titleUrdu: 'سنن النسائی',
    author: 'Imam Ahmad an-Nasa\'i',
    deathYearHijri: 303,
    totalHadith: 5758,
    totalChapters: 52,
    descriptionEn: 'Celebrated for the highest standard of narrator scrutiny and subtle differences in chains.',
    descriptionUr: 'راویوں کی جانچ پڑتال اور عللِ حدیث کے بیان میں انتہائی کڑے معیار کی حامل سنن۔',
    colorBg: '#F0FDF4',
    colorFg: '#16A34A',
  },
  {
    id: 'ibnmajah',
    titleEnglish: 'Sunan Ibn Majah',
    titleArabic: 'سُنَنُ ابْنِ مَاجَهْ',
    titleUrdu: 'سنن ابن ماجہ',
    author: 'Imam Ibn Majah al-Qazwini',
    deathYearHijri: 273,
    totalHadith: 4341,
    totalChapters: 37,
    descriptionEn: 'Completes the Kutub as-Sittah with unique legal traditions, excellent chapter division, and brevity.',
    descriptionUr: 'صحاح ستہ کی چھٹی کتاب، جس میں نایاب فقہی روایات اور بہترین ابواب بندی موجود ہے۔',
    colorBg: '#FDF2F8',
    colorFg: '#DB2777',
  },
  {
    id: 'malik',
    titleEnglish: 'Muwatta Malik',
    titleArabic: 'مُوَطَّأُ الإِمَامِ مَالِكٍ',
    titleUrdu: 'موطأ امام مالک',
    author: 'Imam Malik ibn Anas (Imam Dar al-Hijrah)',
    deathYearHijri: 179,
    totalHadith: 1858,
    totalChapters: 61,
    descriptionEn: 'The earliest surviving code of Hadith and the legal practice of the people of Madinah.',
    descriptionUr: 'عالمِ اسلام کا سب سے قدیم اور معتبر مدنی فقہ و حدیث کا شاہکار مجموعہ۔',
    colorBg: '#F5F3FF',
    colorFg: '#7C3AED',
  },
];

export const EXTENDED_HADITH_BOOKS: HadithBook[] = [
  {
    id: 'nawawi',
    titleEnglish: '40 Hadith an-Nawawi',
    titleArabic: 'الأربعون النووية',
    titleUrdu: 'چالیس حدیثِ نبوی (امام نووی)',
    author: 'Imam Yahya ibn Sharaf an-Nawawi',
    deathYearHijri: 676,
    totalHadith: 42,
    totalChapters: 1,
    descriptionEn: 'The timeless core summary of forty-two foundational Prophetic narrations covering the essence of Islam.',
    descriptionUr: 'اسلام کے بنیادی عقائد و اخلاق پر مشتمل امام نووی کی مشہورِ زمانہ 42 جامع احادیث۔',
    colorBg: '#ECFDF5',
    colorFg: '#047857',
  },
  {
    id: 'qudsi',
    titleEnglish: '40 Hadith Qudsi',
    titleArabic: 'الأربعون القدسية',
    titleUrdu: 'چالیس احادیثِ قدسی',
    author: 'Selected Sacred Narrations',
    deathYearHijri: 0,
    totalHadith: 40,
    totalChapters: 1,
    descriptionEn: 'Forty sacred Hadiths in which the Messenger of Allah (ﷺ) relates the direct words of Allah.',
    descriptionUr: 'وہ چالیس مبارک احادیثِ قدسی جن میں اللہ رب العزت کا براہِ راست خطاب منقول ہے۔',
    colorBg: '#FEF3C7',
    colorFg: '#B45309',
  },
  {
    id: 'dehlawi',
    titleEnglish: '40 Hadith Dehlawi',
    titleArabic: 'أربعون ولي الله الدهلوي',
    titleUrdu: 'اربعین شاہ ولی اللہ دہلوی',
    author: 'Shah Waliullah Dehlawi',
    deathYearHijri: 1176,
    totalHadith: 40,
    totalChapters: 1,
    descriptionEn: 'Forty concise prophetic traditions selected with shortest chains of narration by Shah Waliullah of Delhi.',
    descriptionUr: 'حضرت شاہ ولی اللہ محدث دہلویؒ کا منتخب کردہ چالیس مختصر و جامع احادیث کا نایاب مجموعہ۔',
    colorBg: '#EFF6FF',
    colorFg: '#1D4ED8',
  },
];

export const ALL_HADITH_BOOKS: HadithBook[] = [...HADITH_BOOKS, ...EXTENDED_HADITH_BOOKS];

export function getHadithBooks(): HadithBook[] {
  return HADITH_BOOKS;
}

export function getExtendedHadithBooks(): HadithBook[] {
  return EXTENDED_HADITH_BOOKS;
}

export function getHadithBook(id: HadithBookId): HadithBook | undefined {
  return ALL_HADITH_BOOKS.find((b) => b.id === id);
}

/**
 * Storage keys
 */
const STORAGE_PREFIX = '@suffah_hadith_v1_';
const BOOKMARKS_KEY = '@suffah_hadith_bookmarks_v1';
const RECENT_KEY = '@suffah_hadith_recent_v1';

/**
 * Curated offline seed hadiths (accessible 100% offline without initial internet)
 */
export const OFFLINE_SEED_HADITHS: Record<HadithBookId, HadithEntry[]> = {
  bukhari: [
    {
      id: 'bukhari-1',
      bookId: 'bukhari',
      hadithNumber: 1,
      arabicNumber: 1,
      chapterNumber: 1,
      chapterTitleEn: 'Revelation',
      chapterTitleUr: 'کتاب وحی کا بیان',
      narrator: 'Umar bin Al-Khattab (RA)',
      arabicText: 'حَدَّثَنَا الْحُمَيْدِيُّ عَبْدُ اللَّهِ بْنُ الزُّبَيْرِ، قَالَ: حَدَّثَنَا سُفْيَانُ، قَالَ: حَدَّثَنَا يَحْيَى بْنُ سَعِيدٍ الأَنْصَارِيُّ، قَالَ: أَخْبَرَنِي مُحَمَّدُ بْنُ إِبْرَاهِيمَ التَّيْمِيُّ، أَنَّهُ سَمِعَ عَلْقَمَةَ بْنَ وَقَّاصٍ اللَّيْثِيَّ، يَقُولُ: سَمِعْتُ عُمَرَ بْنَ الْخَطَّابِ رَضِيَ اللَّهُ عَنْهُ عَلَى الْمِنْبَرِ، قَالَ: سَمِعْتُ رَسُولَ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ، يَقُولُ: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى، فَمَنْ كَانَتْ هِجْرَتُهُ إِلَى دُنْيَا يُصِيبُهَا أَوْ إِلَى امْرَأَةٍ يَنْكِحُهَا، فَهِجْرَتُهُ إِلَى مَا هَاجَرَ إِلَيْهِ".',
      urduText: 'میں نے جناب رسول اللہ صلی اللہ علیہ وسلم سے سنا آپ فرماتے تھے کہ تمام اعمال کا دارومدار نیتوں پر ہے اور ہر انسان کو وہی ملے گا جس کی اس نے نیت کی۔ پس جس کی ہجرت دنیا حاصل کرنے کے لیے ہو یا کسی عورت سے شادی کی غرض سے ہو تو اس کی ہجرت اسی مقصد کے لیے شمار ہو گی جس کے لیے اس نے ہجرت کی۔',
      englishText: 'Narrated \'Umar bin Al-Khattab: I heard Allah\'s Messenger (ﷺ) saying: "The reward of deeds depends upon the intentions and every person will get the reward according to what he has intended. So whoever emigrated for worldly benefits or for a woman to marry, his emigration was for what he emigrated for."',
      grades: [{ name: 'Ijma\' (Consensus)', grade: 'Sahih' }],
      reference: { book: 1, hadith: 1 },
    },
    {
      id: 'bukhari-2',
      bookId: 'bukhari',
      hadithNumber: 2,
      arabicNumber: 2,
      chapterNumber: 1,
      chapterTitleEn: 'Revelation',
      chapterTitleUr: 'کتاب وحی کا بیان',
      narrator: 'Aisha (RA)',
      arabicText: 'أَنَّ الْحَارِثَ بْنَ هِشَامٍ رَضِيَ اللَّهُ عَنْهُ سَأَلَ رَسُولَ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ فَقَالَ: يَا رَسُولَ اللَّهِ، كَيْفَ يَأْتِيكَ الْوَحْيُ؟ فَقَالَ رَسُولُ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ: "أَحْيَانًا يَأْتِينِي مِثْلَ صَلْصَلَةِ الْجَرَسِ وَهُوَ أَشَدُّهُ عَلَيَّ فَيَفْصِمُ عَنِّي وَقَدْ وَعَيْتُ عَنْهُ مَا قَالَ، وَأَحْيَانًا يَتَمَثَّلُ لِي الْمَلَكُ رَجُلاً فَيُكَلِّمُنِي فَأَعِي مَا يَقُولُ".',
      urduText: 'حارث بن ہشام رضی اللہ عنہ نے رسول اللہ صلی اللہ علیہ وسلم سے دریافت کیا کہ یا رسول اللہ! آپ کے پاس وحی کس طرح آتی ہے؟ تو آپ صلی اللہ علیہ وسلم نے فرمایا کہ کبھی تو مجھے گھنٹی کی جھنکار کی طرح آتی ہے اور یہ مجھ پر سب سے زیادہ سخت ہوتی ہے، پھر جب وہ کیفیت ختم ہوتی ہے تو جو کچھ فرشتے نے کہا ہوتا ہے مجھے یاد ہو چکا ہوتا ہے، اور کبھی فرشتہ میرے سامنے آدمی کی صورت میں آتا ہے اور مجھ سے کلام کرتا ہے اور میں اس کا کلام یاد کر لیتا ہوں۔',
      englishText: 'Narrated Aisha: Al-Harith bin Hisham asked Allah\'s Messenger: "O Allah\'s Messenger! How is the Divine Inspiration revealed to you?" Allah\'s Messenger replied: "Sometimes it is revealed like the ringing of a bell, this form of Inspiration is the hardest of all and then this state passes off after I have grasped what is inspired. Sometimes the Angel comes in the form of a man and talks to me and I grasp whatever he says."',
      grades: [{ name: 'Ijma\' (Consensus)', grade: 'Sahih' }],
      reference: { book: 1, hadith: 2 },
    },
    {
      id: 'bukhari-3',
      bookId: 'bukhari',
      hadithNumber: 5027,
      arabicNumber: 5027,
      chapterNumber: 66,
      chapterTitleEn: 'Virtues of the Quran',
      chapterTitleUr: 'فضائل قرآن کا بیان',
      narrator: 'Uthman bin Affan (RA)',
      arabicText: 'عَنْ عُثْمَانَ رَضِيَ اللَّهُ عَنْهُ، عَنِ النَّبِيِّ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ قَالَ: "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ".',
      urduText: 'حضرت عثمان رضی اللہ عنہ سے روایت ہے کہ نبی کریم صلی اللہ علیہ وسلم نے فرمایا: تم میں سے سب سے بہتر وہ شخص ہے جو قرآن سیکھے اور دوسروں کو سکھائے۔',
      englishText: 'Narrated Uthman: The Prophet (ﷺ) said: "The best among you (Muslims) are those who learn the Qur\'an and teach it."',
      grades: [{ name: 'Ijma\' (Consensus)', grade: 'Sahih' }],
      reference: { book: 66, hadith: 49 },
    },
  ],
  muslim: [
    {
      id: 'muslim-1',
      bookId: 'muslim',
      hadithNumber: 8,
      arabicNumber: 1,
      chapterNumber: 1,
      chapterTitleEn: 'Faith (Kitab Al-Iman)',
      chapterTitleUr: 'کتاب الایمان',
      narrator: 'Umar bin Al-Khattab (RA)',
      arabicText: 'عَنْ عُمَرَ بْنِ الْخَطَّابِ، قَالَ: بَيْنَمَا نَحْنُ عِنْدَ رَسُولِ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ ذَاتَ يَوْمٍ إِذْ طَلَعَ عَلَيْنَا رَجُلٌ شَدِيدُ بَيَاضِ الثِّيَابِ شَدِيدُ سَوَادِ الشَّعَرِ... قَالَ: يَا مُحَمَّدُ أَخْبِرْنِي عَنِ الإِسْلاَمِ. فَقَالَ رَسُولُ اللَّهِ: "الإِسْلاَمُ أَنْ تَشْهَدَ أَنْ لاَ إِلَٰهَ إِلاَّ اللَّهُ وَأَنَّ مُحَمَّدًا رَسُولُ اللَّهِ، وَتُقِيمَ الصَّلاَةَ، وَتُؤْتِيَ الزَّكَاةَ، وَتَصُومَ رَمَضَانَ، وَتَحُجَّ الْبَيْتَ إِنِ اسْتَطَعْتَ إِلَيْهِ سَبِيلاً".',
      urduText: 'حضرت عمر بن خطاب رضی اللہ عنہ نے فرمایا کہ ایک دن ہم رسول اللہ صلی اللہ علیہ وسلم کی خدمت میں حاضر تھے کہ اچانک ایک شخص ظاہر ہوا جس کے کپڑے انتہائی سفید اور بال انتہائی سیاہ تھے... اس نے کہا: اے محمد! مجھے بتائیے کہ اسلام کیا ہے؟ رسول اللہ صلی اللہ علیہ وسلم نے فرمایا: اسلام یہ ہے کہ تم گواہی دو کہ اللہ کے سوا کوئی معبود نہیں اور محمد اللہ کے رسول ہیں، اور نماز قائم کرو، زکوٰۃ ادا کرو، رمضان کے روزے رکھو اور اگر استطاعت ہو تو بیت اللہ کا حج کرو۔',
      englishText: 'It is narrated on the authority of \'Umar bin Al-Khattab: One day we were sitting in the company of Allah\'s Messenger when there appeared before us a man with exceedingly white clothes and exceedingly black hair... He said: "O Muhammad, inform me about Islam." The Messenger of Allah replied: "Islam is that you testify that there is no god but Allah and that Muhammad is the Messenger of Allah, and establish prayer, pay Zakat, observe the fast of Ramadan, and perform pilgrimage to the House if you have the means."',
      grades: [{ name: 'Sahih Muslim Standard', grade: 'Sahih' }],
      reference: { book: 1, hadith: 1 },
    },
    {
      id: 'muslim-2',
      bookId: 'muslim',
      hadithNumber: 55,
      arabicNumber: 55,
      chapterNumber: 1,
      chapterTitleEn: 'Faith (Kitab Al-Iman)',
      chapterTitleUr: 'کتاب الایمان',
      narrator: 'Tamim ad-Dari (RA)',
      arabicText: 'أَنَّ النَّبِيَّ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ قَالَ: "الدِّينُ النَّصِيحَةُ". قُلْنَا: لِمَنْ؟ قَالَ: "لِلَّهِ وَلِكِتَابِهِ وَلِرَسُولِهِ وَلأَئِمَّةِ الْمُسْلِمِينَ وَعَامَّتِهِمْ".',
      urduText: 'نبی کریم صلی اللہ علیہ وسلم نے فرمایا: دین خیر خواہی کا نام ہے۔ ہم نے عرض کیا: کس کے لیے؟ آپ نے فرمایا: اللہ کے لیے، اس کی کتاب کے لیے، اس کے رسول کے لیے، اور مسلمانوں کے حکمرانوں اور عام مسلمانوں کے لیے۔',
      englishText: 'It is narrated on the authority of Tamim ad-Dari that the Prophet (ﷺ) observed: "Religion is sincerity." We said: "To whom?" He said: "To Allah, to His Book, to His Messenger, to the leaders of the Muslims, and to their common people."',
      grades: [{ name: 'Sahih Muslim Standard', grade: 'Sahih' }],
      reference: { book: 1, hadith: 95 },
    },
  ],
  abudawud: [
    {
      id: 'abudawud-1',
      bookId: 'abudawud',
      hadithNumber: 1,
      arabicNumber: 1,
      chapterNumber: 1,
      chapterTitleEn: 'Purification (Kitab Al-Taharah)',
      chapterTitleUr: 'کتاب طہارت کے احکام',
      narrator: 'Mughira bin Shu\'bah (RA)',
      arabicText: 'عَنِ الْمُغِيرَةِ بْنِ شُعْبَةَ، أَنَّ النَّبِيَّ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ كَانَ إِذَا ذَهَبَ الْمَذْهَبَ أَبْعَدَ.',
      urduText: 'حضرت مغیرہ بن شعبہ رضی اللہ عنہ سے روایت ہے کہ نبی اکرم صلی اللہ علیہ وسلم جب قضائے حاجت کے لیے تشریف لے جاتے تو دور تشریف لے جاتے۔',
      englishText: 'Narrated Al-Mughirah ibn Shu\'bah: When the Prophet (ﷺ) went out to relieve himself, he went to a far-off place.',
      grades: [{ name: 'Al-Albani', grade: 'Sahih' }, { name: 'Zubair Ali Zai', grade: 'Sahih' }],
      reference: { book: 1, hadith: 1 },
    },
  ],
  tirmidhi: [
    {
      id: 'tirmidhi-1',
      bookId: 'tirmidhi',
      hadithNumber: 1,
      arabicNumber: 1,
      chapterNumber: 1,
      chapterTitleEn: 'The Book on Purification',
      chapterTitleUr: 'کتاب طہارت کے مسائل',
      narrator: 'Abdullah ibn Umar (RA)',
      arabicText: 'عَنِ ابْنِ عُمَرَ، عَنِ النَّبِيِّ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ قَالَ: "لاَ تُقْبَلُ صَلاَةٌ بِغَيْرِ طُهُورٍ وَلاَ صَدَقَةٌ مِنْ غُلُولٍ".',
      urduText: 'حضرت عبداللہ بن عمر رضی اللہ عنہما سے روایت ہے کہ نبی اکرم صلی اللہ علیہ وسلم نے فرمایا: بغیر طہارت کے کوئی نماز قبول نہیں ہوتی اور نہ خیانت کے مال سے کوئی صدقہ قبول ہوتا ہے۔',
      englishText: 'Ibn `Umar narrated that the Prophet (ﷺ) said: "Salat will not be accepted without purification, nor Charity from Ghulul (unlawfully acquired property)."',
      grades: [
        { name: 'Ahmad Muhammad Shakir', grade: 'Sahih' },
        { name: 'Al-Albani', grade: 'Sahih' },
        { name: 'Zubair Ali Zai', grade: 'Sahih' },
      ],
      reference: { book: 1, hadith: 1 },
    },
  ],
  nasai: [
    {
      id: 'nasai-1',
      bookId: 'nasai',
      hadithNumber: 1,
      arabicNumber: 1,
      chapterNumber: 1,
      chapterTitleEn: 'The Book of Purification',
      chapterTitleUr: 'کتاب طہارت',
      narrator: 'Abu Hurairah (RA)',
      arabicText: 'عَنْ أَبِي هُرَيْرَةَ، عَنِ النَّبِيِّ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ قَالَ: "إِذَا اسْتَيْقَظَ أَحَدُكُمْ مِنْ نَوْمِهِ فَلاَ يَغْمِسْ يَدَهُ فِي الإِنَاءِ حَتَّى يَغْسِلَهَا ثَلاَثًا، فَإِنَّهُ لاَ يَدْرِي أَيْنَ بَاتَتْ يَدُهُ".',
      urduText: 'حضرت ابوہریرہ رضی اللہ عنہ سے روایت ہے کہ نبی کریم صلی اللہ علیہ وسلم نے فرمایا: جب تم میں سے کوئی نیند سے بیدار ہو تو وہ اپنا ہاتھ برتن میں نہ ڈالے جب تک کہ اسے تین بار دھو نہ لے، کیونکہ اسے معلوم نہیں کہ رات کو اس کا ہاتھ کہاں رہا۔',
      englishText: 'It was narrated from Abu Hurairah that the Prophet (ﷺ) said: "When one of you wakes from sleep, he should not dip his hand into the vessel until he has washed it three times, for he does not know where his hand spent the night."',
      grades: [{ name: 'Al-Albani', grade: 'Sahih' }, { name: 'Zubair Ali Zai', grade: 'Sahih' }],
      reference: { book: 1, hadith: 1 },
    },
  ],
  ibnmajah: [
    {
      id: 'ibnmajah-1',
      bookId: 'ibnmajah',
      hadithNumber: 224,
      arabicNumber: 224,
      chapterNumber: 1,
      chapterTitleEn: 'The Book of the Sunnah',
      chapterTitleUr: 'کتاب السنۃ',
      narrator: 'Anas bin Malik (RA)',
      arabicText: 'عَنْ أَنَسِ بْنِ مَالِكٍ، قَالَ: قَالَ رَسُولُ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ: "طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ".',
      urduText: 'حضرت انس بن مالک رضی اللہ عنہ کہتے ہیں کہ رسول اللہ صلی اللہ علیہ وسلم نے فرمایا: علم حاصل کرنا ہر مسلمان پر فرض ہے۔',
      englishText: 'It was narrated that Anas bin Malik said: "The Messenger of Allah (ﷺ) said: \'Seeking knowledge is a duty upon every Muslim.\'"',
      grades: [{ name: 'Al-Albani', grade: 'Sahih' }, { name: 'Zubair Ali Zai', grade: 'Hasan' }],
      reference: { book: 1, hadith: 224 },
    },
  ],
  malik: [
    {
      id: 'malik-1',
      bookId: 'malik',
      hadithNumber: 1,
      arabicNumber: 1,
      chapterNumber: 1,
      chapterTitleEn: 'The Times of Prayer',
      chapterTitleUr: 'نماز کے اوقات کا بیان',
      narrator: 'Ibn Shihab az-Zuhri',
      arabicText: 'حَدَّثَنِي يَحْيَى، عَنْ مَالِكٍ، عَنِ ابْنِ شِهَابٍ، أَنَّ عُمَرَ بْنَ عَبْدِ الْعَزِيزِ أَخَّرَ الصَّلاَةَ يَوْمًا، فَدَخَلَ عَلَيْهِ عُرْوَةُ بْنُ الزُّبَيْرِ فَأَخْبَرَهُ أَنَّ الْمُغِيرَةَ بْنَ شُعْبَةَ أَخَّرَ الصَّلاَةَ يَوْمًا وَهُوَ بِالْكُوفَةِ، فَدَخَلَ عَلَيْهِ أَبُو مَسْعُودٍ الأَنْصَارِيُّ فَقَالَ: مَا هَٰذَا يَا مُغِيرَةُ، أَلَيْسَ قَدْ عَلِمْتَ أَنَّ جِبْرِيلَ نَزَلَ فَصَلَّى فَصَلَّى رَسُولُ اللَّهِ...',
      urduText: 'یحییٰ نے مجھ سے بیان کیا، انہوں نے امام مالک سے، انہوں نے ابن شہاب سے کہ عمر بن عبدالعزیز نے ایک دن نماز میں تاخیر کی تو عروہ بن زبیر ان کے پاس آئے اور بتایا کہ حضرت مغیرہ بن شعبہ نے کوفہ میں ایک دن نماز میں تاخیر کی تو ابو مسعود انصاری نے کہا: مغیرہ یہ کیا ہے؟ کیا تمہیں معلوم نہیں کہ جبرائیل علیہ السلام نے اتر کر نماز پڑھی تو رسول اللہ صلی اللہ علیہ وسلم نے بھی نماز پڑھی...',
      englishText: 'Yahya related to me from Malik from Ibn Shihab that \'Umar ibn \'Abd al-\'Aziz delayed the prayer one day. \'Urwah ibn az-Zubayr came in and told him that Al-Mughirah ibn Shu\'bah had delayed the prayer while in Kufa and Abu Mas\'ud al-Ansari entered upon him and said: "What is this, O Mughirah? Do you not know that Jibril came down and prayed, and the Messenger of Allah (ﷺ) prayed..."',
      grades: [{ name: 'Muwatta Authenticity', grade: 'Sahih' }],
      reference: { book: 1, hadith: 1 },
    },
  ],
  nawawi: [
    {
      id: 'nawawi-1',
      bookId: 'nawawi',
      hadithNumber: 1,
      arabicNumber: 1,
      chapterNumber: 1,
      chapterTitleEn: 'Forty Hadith of an-Nawawi',
      chapterTitleUr: 'اربعینِ نووی',
      narrator: 'Umar bin Al-Khattab (RA)',
      arabicText: 'عَنْ أَمِيرِ الْمُؤْمِنِينَ أَبِي حَفْصٍ عُمَرَ بْنِ الْخَطَّابِ رَضِيَ اللَّهُ عَنْهُ قَالَ: سَمِعْتُ رَسُولَ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ يَقُولُ: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى".',
      urduText: 'امیرالمومنین حضرت عمر بن خطاب رضی اللہ عنہ سے روایت ہے کہ رسول اللہ صلی اللہ علیہ وسلم نے فرمایا: اعمال کا دارومدار نیتوں پر ہے اور ہر شخص کے لیے وہی ہے جس کی اس نے نیت کی۔',
      englishText: 'Actions are judged by intentions, and every person shall have what they intended.',
      grades: [{ name: 'Agreed Upon', grade: 'Sahih' }],
      reference: { book: 1, hadith: 1 },
    },
    {
      id: 'nawawi-2',
      bookId: 'nawawi',
      hadithNumber: 13,
      arabicNumber: 13,
      chapterNumber: 1,
      chapterTitleEn: 'Forty Hadith of an-Nawawi',
      chapterTitleUr: 'اربعینِ نووی',
      narrator: 'Anas bin Malik (RA)',
      arabicText: 'عَنْ أَنَسٍ رَضِيَ اللَّهُ عَنْهُ عَنِ النَّبِيِّ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ قَالَ: "لاَ يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ".',
      urduText: 'تم میں سے کوئی شخص اس وقت تک کامل مومن نہیں ہو سکتا جب تک اپنے بھائی کے لیے بھی وہی پسند نہ کرے جو اپنے لیے پسند کرتا ہے۔',
      englishText: 'None of you truly believes until he loves for his brother what he loves for himself.',
      grades: [{ name: 'Agreed Upon', grade: 'Sahih' }],
      reference: { book: 1, hadith: 13 },
    },
  ],
  qudsi: [
    {
      id: 'qudsi-1',
      bookId: 'qudsi',
      hadithNumber: 1,
      arabicNumber: 1,
      chapterNumber: 1,
      chapterTitleEn: 'Forty Hadith Qudsi',
      chapterTitleUr: 'چالیس احادیثِ قدسی',
      narrator: 'Abu Hurairah (RA)',
      arabicText: 'عَنْ أَبِي هُرَيْرَةَ رَضِيَ اللَّهُ عَنْهُ قَالَ: قَالَ رَسُولُ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ: "لَمَّا قَضَى اللَّهُ الْخَلْقَ كَتَبَ فِي كِتَابِهِ فَهُوَ عِنْدَهُ فَوْقَ الْعَرْشِ: إِنَّ رَحْمَتِي غَلَبَتْ غَضَبِي".',
      urduText: 'جب اللہ تعالیٰ نے مخلوق کو پیدا فرمایا تو عرش پر موجود اپنی کتاب میں تحریر فرمایا کہ بے شک میری رحمت میرے غضب پر غالب ہے۔',
      englishText: 'When Allah decreed the Creation, He wrote in His Book which is with Him on His Throne: My mercy prevails over My wrath.',
      grades: [{ name: 'Sahih', grade: 'Sahih' }],
      reference: { book: 1, hadith: 1 },
    },
  ],
  dehlawi: [
    {
      id: 'dehlawi-1',
      bookId: 'dehlawi',
      hadithNumber: 1,
      arabicNumber: 1,
      chapterNumber: 1,
      chapterTitleEn: 'Forty Hadith Shah Waliullah',
      chapterTitleUr: 'اربعین شاہ ولی اللہ دہلوی',
      narrator: 'Abu Hurairah (RA)',
      arabicText: 'قَالَ النَّبِيُّ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ: "الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ".',
      urduText: 'نبی کریم صلی اللہ علیہ وسلم نے فرمایا: کامل مسلمان وہ ہے جس کی زبان اور ہاتھ سے دوسرے مسلمان محفوظ رہیں۔',
      englishText: 'A Muslim is the one from whose tongue and hands the Muslims are safe.',
      grades: [{ name: 'Shah Waliullah Musalsal', grade: 'Sahih' }],
      reference: { book: 1, hadith: 1 },
    },
  ],
};

const EXTENDED_BOOK_IDS = new Set<HadithBookId>(['nawawi', 'qudsi', 'dehlawi']);

/**
 * Fetch chapters / sections for a book
 */
export async function getHadithChapters(bookId: HadithBookId): Promise<HadithChapter[]> {
  if (EXTENDED_BOOK_IDS.has(bookId)) {
    const book = getHadithBook(bookId);
    return [
      {
        id: `${bookId}-1`,
        bookId,
        chapterNumber: 1,
        titleEnglish: book?.titleEnglish || 'Complete 40 Hadith Collection',
        titleArabic: book?.titleArabic || 'الأربعون',
        titleUrdu: book?.titleUrdu || 'مکمل چالیس احادیث',
        hadithStart: 1,
        hadithEnd: book?.totalHadith || 42,
        hadithCount: book?.totalHadith || 42,
      },
    ];
  }

  const cacheKey = `${STORAGE_PREFIX}chapters_${bookId}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {}

  // Fallback default chapters if offline
  const defaultChapters: HadithChapter[] = [
    { id: `${bookId}-1`, bookId, chapterNumber: 1, titleEnglish: 'Book 1: Faith & Revelation', titleArabic: 'كتاب الإيمان والوحي', titleUrdu: 'باب ۱: ایمان و وحی', hadithStart: 1, hadithEnd: 50, hadithCount: 50 },
    { id: `${bookId}-2`, bookId, chapterNumber: 2, titleEnglish: 'Book 2: Purification (Taharah)', titleArabic: 'كتاب الطهارة', titleUrdu: 'باب ۲: طہارت اور وضو', hadithStart: 51, hadithEnd: 150, hadithCount: 100 },
    { id: `${bookId}-3`, bookId, chapterNumber: 3, titleEnglish: 'Book 3: Prayer (Salat)', titleArabic: 'كتاب الصلاة', titleUrdu: 'باب ۳: نماز کے احکام', hadithStart: 151, hadithEnd: 350, hadithCount: 200 },
    { id: `${bookId}-4`, bookId, chapterNumber: 4, titleEnglish: 'Book 4: Zakat & Charity', titleArabic: 'كتاب الزكاة', titleUrdu: 'باب ۴: زکوٰۃ اور صدقات', hadithStart: 351, hadithEnd: 450, hadithCount: 100 },
    { id: `${bookId}-5`, bookId, chapterNumber: 5, titleEnglish: 'Book 5: Fasting (Sawm)', titleArabic: 'كتاب الصوم', titleUrdu: 'باب ۵: روزے کے فضائل و مسائل', hadithStart: 451, hadithEnd: 550, hadithCount: 100 },
  ];

  try {
    await AsyncStorage.setItem(cacheKey, JSON.stringify(defaultChapters));
  } catch {}

  return defaultChapters;
}

/**
 * Fetch hadiths for a book & chapter (or page) with offline-first transparent caching
 */
export async function getHadiths(
  bookId: HadithBookId,
  chapterNumber: number = 1,
  page: number = 1,
  pageSize: number = 10
): Promise<{ hadiths: HadithEntry[]; total: number }> {
  const cacheKey = `${STORAGE_PREFIX}items_${bookId}_ch${chapterNumber}`;

  // 1. Try local cache
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const all: HadithEntry[] = JSON.parse(cached);
      const start = (page - 1) * pageSize;
      const paginated = all.slice(start, start + pageSize);
      return { hadiths: paginated, total: all.length };
    }
  } catch {}

  // 2. Fetch from CDN / API if online
  try {
    const isExtended = EXTENDED_BOOK_IDS.has(bookId);
    const araUrl = isExtended
      ? `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-${bookId}.json`
      : `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-${bookId}/sections/${chapterNumber}.json`;
    const engUrl = isExtended
      ? `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-${bookId}.json`
      : `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-${bookId}/sections/${chapterNumber}.json`;

    const [araRes, urdRes, engRes] = await Promise.allSettled([
      fetch(araUrl),
      isExtended
        ? Promise.reject(new Error('No Urdu edition for extended book'))
        : fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/urd-${bookId}/sections/${chapterNumber}.json`),
      fetch(engUrl),
    ]);

    if (araRes.status === 'fulfilled' && araRes.value.ok) {
      const araData = await araRes.value.json();
      const urdData = urdRes.status === 'fulfilled' && urdRes.value.ok ? await urdRes.value.json() : null;
      const engData = engRes.status === 'fulfilled' && engRes.value.ok ? await engRes.value.json() : null;
      const seedByNumber = new Map(
        (OFFLINE_SEED_HADITHS[bookId] || []).map((item) => [item.hadithNumber, item])
      );

      const rawHadiths = Array.isArray(araData.hadiths) ? araData.hadiths : [];
      const entries: HadithEntry[] = rawHadiths
        .filter((h: any) => Number(h?.hadithnumber) > 0 && (h?.text || engData?.hadiths))
        .map((h: any, idx: number) => {
          const engMatch =
            engData?.hadiths?.find((e: any) => Number(e?.hadithnumber) === Number(h.hadithnumber)) ||
            engData?.hadiths?.[idx];
          const urdMatch = urdData?.hadiths?.[idx];
          const seedFallback = seedByNumber.get(Number(h.hadithnumber));
          const urdText = urdMatch?.text || seedFallback?.urduText || '';
          const engText = engMatch?.text || seedFallback?.englishText || '';
          const grades = h.grades || engMatch?.grades || urdMatch?.grades || [];

          return {
            id: `${bookId}-${h.hadithnumber}`,
            bookId,
            hadithNumber: h.hadithnumber,
            arabicNumber: h.arabicnumber,
            chapterNumber,
            chapterTitleEn: araData.metadata?.section?.[String(chapterNumber)] || araData.metadata?.name,
            arabicText: h.text || seedFallback?.arabicText || '',
            englishText: engText,
            urduText: urdText,
            grades: Array.isArray(grades) ? grades : [],
            reference: h.reference || { book: chapterNumber, hadith: h.hadithnumber },
          };
        });

      if (entries.length > 0) {
        try {
          await AsyncStorage.setItem(cacheKey, JSON.stringify(entries));
        } catch {}
        const start = (page - 1) * pageSize;
        return { hadiths: entries.slice(start, start + pageSize), total: entries.length };
      }
    }
  } catch (err) {
    // network failure, fallback to seed
  }

  // 3. Fallback to curated seed hadiths
  const seed = OFFLINE_SEED_HADITHS[bookId] || OFFLINE_SEED_HADITHS.bukhari;
  return { hadiths: seed, total: seed.length };
}

/**
 * Fetch a single hadith by number
 */
export async function getHadithByNumber(bookId: HadithBookId, hadithNumber: number): Promise<HadithEntry | null> {
  const cacheKey = `${STORAGE_PREFIX}single_${bookId}_${hadithNumber}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {}

  // Check seed
  const fromSeed = (OFFLINE_SEED_HADITHS[bookId] || []).find((h) => h.hadithNumber === hadithNumber);
  if (fromSeed) return fromSeed;

  // Attempt remote fetch
  try {
    const [araRes, urdRes, engRes] = await Promise.allSettled([
      fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-${bookId}/${hadithNumber}.json`),
      fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/urd-${bookId}/${hadithNumber}.json`),
      fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-${bookId}/${hadithNumber}.json`),
    ]);

    if (araRes.status === 'fulfilled' && araRes.value.ok) {
      const ara = await araRes.value.json();
      const urd = urdRes.status === 'fulfilled' && urdRes.value.ok ? await urdRes.value.json() : null;
      const eng = engRes.status === 'fulfilled' && engRes.value.ok ? await engRes.value.json() : null;

      const h = ara.hadiths?.[0];
      if (h) {
        const item: HadithEntry = {
          id: `${bookId}-${hadithNumber}`,
          bookId,
          hadithNumber,
          arabicNumber: h.arabicnumber,
          chapterNumber: h.reference?.book || 1,
          arabicText: h.text,
          englishText: eng?.hadiths?.[0]?.text || '',
          urduText: urd?.hadiths?.[0]?.text || '',
          grades: h.grades || eng?.hadiths?.[0]?.grades || [],
          reference: h.reference || { book: 1, hadith: hadithNumber },
        };
        try {
          await AsyncStorage.setItem(cacheKey, JSON.stringify(item));
        } catch {}
        return item;
      }
    }
  } catch {}

  return null;
}

/**
 * Search Hadiths locally and across seed collections
 */
export async function searchHadiths(
  query: string,
  bookId?: HadithBookId
): Promise<HadithEntry[]> {
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return [];

  const booksToSearch = bookId ? [bookId] : (Object.keys(OFFLINE_SEED_HADITHS) as HadithBookId[]);
  const results: HadithEntry[] = [];

  for (const b of booksToSearch) {
    const seed = OFFLINE_SEED_HADITHS[b] || [];
    for (const h of seed) {
      if (
        String(h.hadithNumber) === cleanQ ||
        h.urduText.includes(cleanQ) ||
        h.englishText.toLowerCase().includes(cleanQ) ||
        h.arabicText.includes(cleanQ) ||
        (h.narrator && h.narrator.toLowerCase().includes(cleanQ))
      ) {
        results.push(h);
      }
    }
  }

  return results;
}

/**
 * Bookmarks Management
 */
export async function getHadithBookmarks(): Promise<HadithBookmark[]> {
  try {
    const raw = await AsyncStorage.getItem(BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function isHadithBookmarked(hadithId: string): Promise<boolean> {
  const list = await getHadithBookmarks();
  return list.some((b) => b.hadithId === hadithId);
}

export async function toggleHadithBookmark(hadith: HadithEntry, bookTitle: string): Promise<boolean> {
  const list = await getHadithBookmarks();
  const exists = list.some((b) => b.hadithId === hadith.id);
  let updated: HadithBookmark[];

  if (exists) {
    updated = list.filter((b) => b.hadithId !== hadith.id);
  } else {
    const newBm: HadithBookmark = {
      id: `${hadith.id}_${Date.now()}`,
      hadithId: hadith.id,
      bookId: hadith.bookId,
      hadithNumber: hadith.hadithNumber,
      bookName: bookTitle,
      snippet: hadith.urduText.slice(0, 100) || hadith.englishText.slice(0, 100),
      timestamp: Date.now(),
    };
    updated = [newBm, ...list];
  }

  await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updated));
  return !exists;
}

/**
 * Recent History
 */
export async function addRecentHadith(hadith: HadithEntry, bookTitle: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    const list: HadithBookmark[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((item) => item.hadithId !== hadith.id);
    const item: HadithBookmark = {
      id: `recent_${hadith.id}`,
      hadithId: hadith.id,
      bookId: hadith.bookId,
      hadithNumber: hadith.hadithNumber,
      bookName: bookTitle,
      snippet: hadith.urduText.slice(0, 100) || hadith.englishText.slice(0, 100),
      timestamp: Date.now(),
    };
    const next = [item, ...filtered].slice(0, 30); // keep last 30
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

export async function getRecentHadiths(): Promise<HadithBookmark[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
