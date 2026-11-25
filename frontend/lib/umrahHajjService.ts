import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RitualStep {
  id: string;
  stepNumber: number;
  ritual: 'Umrah' | 'Hajj' | 'Madinah';
  dayBadge?: string;
  titleEn: string;
  titleUr: string;
  arabicDua: string;
  transliteration: string;
  translationEn: string;
  translationUr: string;
  instructions: string;
}

export interface TawafSaiCounterState {
  mode: 'tawaf' | 'sai';
  completedRounds: number; // 0..7
  updatedAt: number;
}

export const TAWAF_SAI_STATE_KEY = '@suffah_tawaf_sai_state_v1';

export const RITUAL_STEPS: readonly RitualStep[] = [
  {
    id: 'umrah-1',
    stepNumber: 1,
    ritual: 'Umrah',
    titleEn: 'Ghusl, Ihram & Talbiyah at Miqat',
    titleUr: 'میقات پر غسل، احرام اور تلبیہ',
    arabicDua: 'لَبَّيْكَ اللّٰهُمَّ عُمْرَةً ۞ لَبَّيْكَ اللّٰهُمَّ لَبَّيْكَ، لَبَّيْكَ لَا شَرِيكَ لَكَ لَبَّيْكَ، إِنَّ الْحَمْدَ وَالنِّعْمَةَ لَكَ وَالْمُلْكَ لَا شَرِيكَ لَكَ',
    transliteration: 'LabbaykAllāhumma ‘Umratan. LabbaykAllāhumma labbayk, labbayka lā sharīka laka labbayk, innal-ḥamda wan-ni‘mata laka wal-mulk, lā sharīka lak.',
    translationEn: 'Here I am, O Allah, for Umrah. Here I am, You have no partner; truly all praise, grace, and sovereignty belong to You.',
    translationUr: 'اے اللہ! میں عمرہ کے لیے حاضر ہوں۔ میں حاضر ہوں تیرا کوئی شریک نہیں، تمام تعریفیں، نعمتیں اور بادشاہی تیرے ہی لیے ہے۔',
    instructions: 'Men wear two unstitched white sheets; women wear modest regular clothing. Avoid perfume, cutting nails/hair, or hunting until exiting Ihram.',
  },
  {
    id: 'umrah-2',
    stepNumber: 2,
    ritual: 'Umrah',
    titleEn: 'Tawaf Around the Holy Kaaba (7 Circuits)',
    titleUr: 'بیت اللہ شریف کے 7 طواف',
    arabicDua: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ',
    transliteration: 'Rabbanā ātinā fid-dunyā ḥasanatan wa fil-ākhirati ḥasanatan wa qinā ‘adhāban-nār.',
    translationEn: 'Our Lord! Grant us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.',
    translationUr: 'اے ہمارے رب! ہمیں دنیا میں بھی بھلائی عطا فرما اور آخرت میں بھی بھلائی، اور ہمیں آگ کے عذاب سے بچا۔',
    instructions: 'Begin at Hajar al-Aswad ("Bismillahi Allahu Akbar"). Keep Kaaba on your left. Men perform Idtiba & Raml in first 3 circuits. Recite Rabbanā Ātinā between Rukn al-Yamani and Black Stone.',
  },
  {
    id: 'umrah-3',
    stepNumber: 3,
    ritual: 'Umrah',
    titleEn: 'Two Rakaat Behind Maqam Ibrahim & Zamzam',
    titleUr: 'مقامِ ابراہیم پر دو رکعت نماز اور آبِ زمزم',
    arabicDua: 'اللّٰهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا وَرِزْقًا وَاسِعًا وَشِفَاءً مِنْ كُلِّ دَاءٍ',
    transliteration: 'Allāhumma innī as’aluka ‘ilman nāfi‘an wa rizqan wāsi‘an wa shifā’an min kulli dā’.',
    translationEn: 'O Allah, I ask You for beneficial knowledge, abundant sustenance, and healing from every ailment.',
    translationUr: 'اے اللہ! میں تجھ سے نفع بخش علم، کشادہ رزق اور ہر بیماری سے شفاء کا سوال کرتا ہوں۔',
    instructions: 'Offer 2 Rakaat (Surah Al-Kafirun & Al-Ikhlas). Drink Zamzam standing facing the Kaaba and make heartfelt personal Dua.',
  },
  {
    id: 'umrah-4',
    stepNumber: 4,
    ritual: 'Umrah',
    titleEn: 'Sa’i Between Safa & Marwah (7 Laps)',
    titleUr: 'صفا و مروہ کے درمیان 7 چکر (سعی)',
    arabicDua: 'إِنَّ الصَّفَا وَالْمَرْوَةَ مِنْ شَعَائِرِ اللّٰهِ ۞ لَا إِلٰهَ إِلَّا اللّٰهُ وَحْدَهُ لَا شَرِيكَ لَهُ',
    transliteration: 'Innaṣ-Ṣafā wal-Marwata min sha‘ā’irillāh... Lā ilāha illallāhu waḥdahū lā sharīka lah.',
    translationEn: 'Indeed Safa and Marwah are among the symbols of Allah... There is no deity except Allah alone.',
    translationUr: 'بے شک صفا اور مروہ اللہ کی نشانیوں میں سے ہیں۔ اللہ کے سوا کوئی معبود نہیں وہ اکیلا ہے۔',
    instructions: 'Start at Safa facing Kaaba (1st lap ends at Marwah; return to Safa = 2nd, ending 7th lap at Marwah). Men brisk-jog only between the two green lights.',
  },
  {
    id: 'umrah-5',
    stepNumber: 5,
    ritual: 'Umrah',
    titleEn: 'Halq or Taqsir (Complete Umrah)',
    titleUr: 'حلق یا قصر (عمرہ کی تکمیل)',
    arabicDua: 'الْحَمْدُ لِلّٰهِ الَّذِي بِنِعْمَتِهِ تَتِمُّ الصَّالِحَاتُ',
    transliteration: 'Al-ḥamdu lillāhil-ladhī bini‘matihī tatimmus-ṣāliḥāt.',
    translationEn: 'All praise is due to Allah by whose favor all righteous deeds are completed.',
    translationUr: 'تمام تعریفیں اللہ ہی کے لیے ہیں جس کی نعمت سے تمام نیک کام مکمل ہوتے ہیں۔',
    instructions: 'Men shave the head (Halq, higher virtue) or trim evenly (Taqsir). Women trim only a fingertip’s length from hair ends. All Ihram restrictions are now lifted.',
  },
  {
    id: 'hajj-1',
    stepNumber: 1,
    ritual: 'Hajj',
    dayBadge: '8 Dhul Hijjah',
    titleEn: 'Day of Tarwiyah — Proceeding to Mina',
    titleUr: 'یومِ ترویہ (منیٰ روانگی)',
    arabicDua: 'لَبَّيْكَ اللّٰهُمَّ حَجًّا',
    transliteration: 'LabbaykAllāhumma Ḥajjan.',
    translationEn: 'Here I am, O Allah, for Hajj.',
    translationUr: 'اے اللہ! میں حج کے لیے حاضر ہوں۔',
    instructions: 'Enter Ihram for Hajj (Tamattu’ pilgrims) and stay in Mina offering Zuhr, Asr, Maghrib, Isha (shortened, not combined) and Fajr.',
  },
  {
    id: 'hajj-2',
    stepNumber: 2,
    ritual: 'Hajj',
    dayBadge: '9 Dhul Hijjah',
    titleEn: 'Wuquf at Arafah — Heart of Hajj',
    titleUr: 'وقوفِ عرفات (حج کا رکنِ اعظم)',
    arabicDua: 'لَا إِلٰهَ إِلَّا اللّٰهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلٰى كُلِّ شَيْءٍ قَدِيرٌ',
    transliteration: 'Lā ilāha illallāhu waḥdahū lā sharīka lah, lahul-mulku wa lahul-ḥamd, wa huwa ‘alā kulli shay’in qadīr.',
    translationEn: 'None has the right to be worshipped but Allah alone. His is sovereignty and praise, and He is Omnipotent.',
    translationUr: 'اللہ کے سوا کوئی معبود نہیں، اسی کی بادشاہی اور تعریف ہے اور وہ ہر چیز پر قادر ہے۔',
    instructions: 'Pray Zuhr & Asr combined/shortened at Masjid Namirah/tents. Spend until sunset in humble Dua facing Qibla. Leave for Muzdalifah after Maghrib.',
  },
  {
    id: 'hajj-3',
    stepNumber: 3,
    ritual: 'Hajj',
    dayBadge: '10 Dhul Hijjah',
    titleEn: 'Jamarat al-Aqabah, Hady, Halq & Tawaf al-Ifadah',
    titleUr: 'رمی جمرۃ العقبة، قربانی، حلق اور طوافِ زیارت',
    arabicDua: 'بِسْمِ اللّٰهِ، اللّٰهُ أَكْبَرُ',
    transliteration: 'Bismillāh, Allāhu Akbar.',
    translationEn: 'In the Name of Allah, Allah is the Greatest.',
    translationUr: 'اللہ کے نام سے، اللہ سب سے بڑا ہے۔',
    instructions: 'Collect 7 pebbles from Muzdalifah, stone Big Jamarah (Aqabah), offer Qurbani/Hady, shave/trim hair (Tahallul Awwal), and perform Tawaf al-Ifadah.',
  },
  {
    id: 'hajj-4',
    stepNumber: 4,
    ritual: 'Hajj',
    dayBadge: '11–13 Dhul Hijjah',
    titleEn: 'Days of Tashriq & Farewell Tawaf',
    titleUr: 'ایامِ تشریق کی رمی اور طوافِ وداع',
    arabicDua: 'اللّٰهُ أَكْبَرُ، اللّٰهُ أَكْبَرُ، لَا إِلٰهَ إِلَّا اللّٰهُ وَاللّٰهُ أَكْبَرُ، اللّٰهُ أَكْبَرُ وَلِلّٰهِ الْحَمْدُ',
    transliteration: 'Allāhu Akbar, Allāhu Akbar, lā ilāha illallāhu wallāhu Akbar, Allāhu Akbar wa lillāhil-ḥamd.',
    translationEn: 'Allah is the Greatest; there is no deity except Allah, and all praise belongs to Allah.',
    translationUr: 'اللہ سب سے بڑا ہے، اللہ کے سوا کوئی معبود نہیں اور تمام تعریفیں اللہ ہی کے لیے ہیں۔',
    instructions: 'Spend nights in Mina; after Dhuhr stone all three Jamarat (Small → Middle → Big) with 7 pebbles each. Perform Tawaf al-Wada before departing Makkah.',
  },
  {
    id: 'madinah-1',
    stepNumber: 1,
    ritual: 'Madinah',
    titleEn: 'Al-Masjid an-Nabawi & Salam to Prophet (ﷺ)',
    titleUr: 'مسجدِ نبوی اور روضہِ اطہر پر صلوٰۃ و سلام',
    arabicDua: 'السَّلَامُ عَلَيْكَ يَا رَسُولَ اللّٰهِ وَرَحْمَةُ اللّٰهِ وَبَرَكَاتُهُ، جَزَاكَ اللّٰهُ عَنَّا خَيْرَ مَا جَزَى نَبِيًّا عَنْ أُمَّتِهِ',
    transliteration: 'As-salāmu ‘alayka Yā RasūlAllāh wa raḥmatullāhi wa barakātuh, jazākAllāhu ‘annā khayra mā jazā nabiyyan ‘an ummatih.',
    translationEn: 'Peace, mercy and blessings of Allah be upon you, O Messenger of Allah. May Allah reward you on our behalf with the finest reward.',
    translationUr: 'اے اللہ کے رسول ﷺ آپ پر سلام، رحمت اور برکتیں ہوں۔ اللہ ہماری طرف سے آپ کو بہترین جزا عطا فرمائے۔',
    instructions: 'Enter quietly with right foot. Offer Tahiyyatul Masjid (try Riyad al-Jannah with Nusuk slot). Lower voice in reverence, convey Salam politely to the Prophet ﷺ, Abu Bakr (RA), and Umar (RA), then face Qibla for Dua.',
  },
  {
    id: 'madinah-2',
    stepNumber: 2,
    ritual: 'Madinah',
    titleEn: 'Masjid Quba, Uhud Martyrs & Al-Baqi',
    titleUr: 'مسجد قبا، شہدائے احد اور جنت البقیع کی زیارت',
    arabicDua: 'السَّلَامُ عَلَيْكُمْ دَارَ قَوْمٍ مُؤْمِنِينَ، وَإِنَّا إِنْ شَاءَ اللّٰهُ بِكُمْ لَاحِقُونَ',
    transliteration: 'As-salāmu ‘alaykum dāra qawmin mu’minīn, wa innā in shā’Allāhu bikum lāḥiqūn.',
    translationEn: 'Peace be upon you, abode of the believing people; if Allah wills, we shall join you.',
    translationUr: 'سلام ہو تم پر اے مومن بستی والو! اور ان شاء اللہ ہم بھی تم سے ملنے والے ہیں۔',
    instructions: 'Perform Wudu at hotel and pray 2 Rakaat inside Masjid Quba (reward equal to one Umrah — Tirmidhi). Greet the martyrs of Uhud including Sayyidina Hamza (RA).',
  },
];

export const TAWAF_ROUND_LABELS = [
  '1st Round • Hajar al-Aswad start',
  '2nd Round • Keep Kaaba on left',
  '3rd Round • Last Raml circuit',
  '4th Round • Normal walking pace',
  '5th Round • Abundant Dhikr & Istighfar',
  '6th Round • Humble Dua for Ummah',
  '7th Round • Final circuit to Black Stone',
];

export const SAI_LAP_LABELS = [
  '1st Lap: Safa → Marwah',
  '2nd Lap: Marwah → Safa',
  '3rd Lap: Safa → Marwah',
  '4th Lap: Marwah → Safa',
  '5th Lap: Safa → Marwah',
  '6th Lap: Marwah → Safa',
  '7th Lap: Safa → Marwah (Sa’i Complete)',
];

export async function loadTawafSaiState(): Promise<TawafSaiCounterState> {
  try {
    const raw = await AsyncStorage.getItem(TAWAF_SAI_STATE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return { mode: 'tawaf', completedRounds: 0, updatedAt: Date.now() };
}

export async function saveTawafSaiState(state: TawafSaiCounterState): Promise<void> {
  try {
    await AsyncStorage.setItem(TAWAF_SAI_STATE_KEY, JSON.stringify(state));
  } catch {}
}
