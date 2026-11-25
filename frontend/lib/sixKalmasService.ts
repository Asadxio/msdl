// ─────────────────────────────────────────────────────────────────────────────
// SUFFAH — Six Kalmas (Kalimat) Service & Authentic Multilingual Texts
// Includes fully diacritized Arabic, transliteration, English, Urdu & Hadith context.
// ─────────────────────────────────────────────────────────────────────────────

export interface KalmaEntry {
  id: string;
  number: number;
  badge: string;
  title: string;
  shortName: string;
  arabicTitle: string;
  urduTitle: string;
  arabicText: string;
  transliteration: string;
  englishTranslation: string;
  urduTranslation: string;
  significance: string;
}

export const SIX_KALMAS: readonly KalmaEntry[] = [
  {
    id: 'kalma-1',
    number: 1,
    badge: 'Kalma 1',
    title: 'First Kalma: Tayyab',
    shortName: 'Tayyab (Word of Purity)',
    arabicTitle: 'كَلِمَةُ الطَّيِّبَة',
    urduTitle: 'پہلا کلمہ طیب',
    arabicText: 'لَا إِلٰهَ إِلَّا اللّٰهُ مُحَمَّدٌ رَّسُولُ اللّٰهِ',
    transliteration: 'Lā ilāha illallāhu Muḥammadur Rasūlullāh.',
    englishTranslation:
      'There is no deity worthy of worship except Allah, Muhammad is the Messenger of Allah.',
    urduTranslation: 'اللہ کے سوا کوئی معبود نہیں، محمد (ﷺ) اللہ کے رسول ہیں۔',
    significance:
      'The foundational declaration of Islamic faith (Kalimat al-Tayyibah), uniting absolute monotheism (Tawheed) with acceptance of the final Prophethood of Muhammad (ﷺ).',
  },
  {
    id: 'kalma-2',
    number: 2,
    badge: 'Kalma 2',
    title: 'Second Kalma: Shahadat',
    shortName: 'Shahadat (Word of Testimony)',
    arabicTitle: 'كَلِمَةُ الشَّهَادَة',
    urduTitle: 'دوسرا کلمہ شہادت',
    arabicText:
      'أَشْهَدُ أَنْ لَّا إِلٰهَ إِلَّا اللّٰهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ',
    transliteration:
      'Ash-hadu al-lā ilāha illallāhu waḥdahū lā sharīka lahū, wa ash-hadu anna Muḥammadan ‘abduhū wa rasūluh.',
    englishTranslation:
      'I bear witness that there is no deity worthy of worship except Allah, alone without partner, and I bear witness that Muhammad is His servant and Messenger.',
    urduTranslation:
      'میں گواہی دیتا/دیتی ہوں کہ اللہ کے سوا کوئی معبود نہیں، وہ اکیلا ہے اس کا کوئی شریک نہیں، اور میں گواہی دیتا/دیتی ہوں کہ محمد (ﷺ) اس کے بندے اور رسول ہیں۔',
    significance:
      'The explicit testimony of faith recited in every Tashahhud of daily prayer and upon embracing Islam, affirmed in Sahih al-Bukhari and Sahih Muslim.',
  },
  {
    id: 'kalma-3',
    number: 3,
    badge: 'Kalma 3',
    title: 'Third Kalma: Tamjeed',
    shortName: 'Tamjeed (Word of Glorification)',
    arabicTitle: 'كَلِمَةُ التَّمْجِيد',
    urduTitle: 'تیسرا کلمہ تمجید',
    arabicText:
      'سُبْحَانَ اللّٰهِ، وَالْحَمْدُ لِلّٰهِ، وَلَا إِلٰهَ إِلَّا اللّٰهُ، وَاللّٰهُ أَكْبَرُ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللّٰهِ الْعَلِيِّ الْعَظِيمِ',
    transliteration:
      'Subḥānallāhi wal-ḥamdu lillāhi wa lā ilāha illallāhu wallāhu akbar, wa lā ḥawla wa lā quwwata illā billāhil-‘Aliyyil-‘Aẓīm.',
    englishTranslation:
      'Glory be to Allah, and all praise is for Allah, and there is no deity worthy of worship except Allah, and Allah is the Greatest. And there is no power nor strength except through Allah, the Most High, the Most Great.',
    urduTranslation:
      'اللہ پاک ہے، اور تمام تعریفیں اللہ ہی کے لیے ہیں، اور اللہ کے سوا کوئی معبود نہیں، اور اللہ سب سے بڑا ہے، اور گناہ سے بچنے کی طاقت اور نیکی کرنے کی قوت صرف اللہ ہی کی طرف سے ہے جو بلند و عظیم ہے۔',
    significance:
      'Combines the four most beloved phrases to Allah (SubhanAllah, Alhamdulillah, La ilaha illallah, Allahu Akbar) with Hawqalah—a treasure from the treasures of Paradise (Sahih al-Bukhari & Muslim).',
  },
  {
    id: 'kalma-4',
    number: 4,
    badge: 'Kalma 4',
    title: 'Fourth Kalma: Tawheed',
    shortName: 'Tawheed (Word of Oneness)',
    arabicTitle: 'كَلِمَةُ التَّوْحِيد',
    urduTitle: 'چوتھا کلمہ توحید',
    arabicText:
      'لَا إِلٰهَ إِلَّا اللّٰهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، يُحْيِي وَيُمِيتُ، وَهُوَ حَيٌّ لَّا يَمُوتُ أَبَدًا أَبَدًا، ذُو الْجَلَالِ وَالْإِكْرَامِ، بِيَدِهِ الْخَيْرُ، وَهُوَ عَلٰى كُلِّ شَيْءٍ قَدِيرٌ',
    transliteration:
      'Lā ilāha illallāhu waḥdahū lā sharīka lahū, lahul-mulku wa lahul-ḥamdu, yuḥyī wa yumītu, wa huwa ḥayyul-lā yamūtu abadan abadā, dhul-jalāli wal-ikrām, biyadihil-khayru, wa huwa ‘alā kulli shay’in qadīr.',
    englishTranslation:
      'There is no deity worthy of worship except Allah, He is One, He has no partner. To Him belongs all sovereignty and all praise. He gives life and causes death, and He is Ever-Living who never dies, ever and forever. Possessor of Majesty and Honor; in His Hand is all goodness, and He has power over all things.',
    urduTranslation:
      'اللہ کے سوا کوئی معبود نہیں، وہ اکیلا ہے اس کا کوئی شریک نہیں، اسی کی بادشاہی ہے اور اسی کے لیے تمام تعریفیں ہیں، وہی زندہ کرتا ہے اور وہی مارتا ہے، اور وہ ہمیشہ زندہ رہنے والا ہے جسے کبھی موت نہیں آئے گی، عظمت اور بزرگی والا ہے، اسی کے ہاتھ میں تمام بھلائی ہے، اور وہ ہر چیز پر قادر ہے۔',
    significance:
      'Affirms Allah’s absolute sovereignty over life, death, creation, and every good. Narrations in Jami’ al-Tirmidhi highlight immense reward for reciting phrases of Tawheed upon entering markets or morning/evening remembrance.',
  },
  {
    id: 'kalma-5',
    number: 5,
    badge: 'Kalma 5',
    title: 'Fifth Kalma: Astaghfar',
    shortName: 'Astaghfar (Word of Penitence)',
    arabicTitle: 'كَلِمَةُ الِاسْتِغْفَار',
    urduTitle: 'پانچواں کلمہ استغفار',
    arabicText:
      'أَسْتَغْفِرُ اللّٰهَ رَبِّي مِنْ كُلِّ ذَنْبٍ أَذْنَبْتُهُ عَمْدًا أَوْ خَطَأً، سِرًّا أَوْ عَلَانِيَةً، وَأَتُوبُ إِلَيْهِ مِنَ الذَّنْبِ الَّذِي أَعْلَمُ، وَمِنَ الذَّنْبِ الَّذِي لَا أَعْلَمُ، إِنَّكَ أَنْتَ عَلَّامُ الْغُيُوبِ، وَسَتَّارُ الْعُيُوبِ، وَغَفَّارُ الذُّنُوبِ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللّٰهِ الْعَلِيِّ الْعَظِيمِ',
    transliteration:
      'Astaghfirullāha rabbī min kulli dhanbin adhnabtuhū ‘amdan aw khaṭa’an, sirran aw ‘alāniyatan, wa atūbu ilayhi minadh-dhanbil-ladhī a‘lamu wa minadh-dhanbil-ladhī lā a‘lamu, innaka anta ‘allāmul-ghuyūbi wa sattārul-‘uyūbi wa ghaffārudh-dhunūbi, wa lā ḥawla wa lā quwwata illā billāhil-‘Aliyyil-‘Aẓīm.',
    englishTranslation:
      'I seek forgiveness from Allah, my Lord, from every sin I committed knowingly or unknowingly, secretly or openly, and I turn to Him in repentance from the sin I know and from the sin I do not know. Truly, You are the Knower of the unseen, the Concealer of faults, and the Forgiver of sins. And there is no power nor strength except through Allah, the Most High, the Most Great.',
    urduTranslation:
      'میں اپنے رب اللہ سے ہر اس گناہ کی معافی مانگتا/مانگتی ہوں جو میں نے جان بوجھ کر یا بھول چوک سے، چھپ کر یا کھلم کھلا کیا ہو، اور میں اس کی بارگاہ میں توبہ کرتا/کرتی ہوں اس گناہ سے جسے میں جانتا/جانتی ہوں اور اس گناہ سے بھی جسے میں نہیں جانتا/جانتی۔ بے شک تو غیبوں کا خوب جاننے والا، عیبوں کا چھپانے والا اور گناہوں کو بخشنے والا ہے، اور گناہ سے بچنے کی طاقت اور نیکی کرنے کی قوت صرف اللہ ہی کی طرف سے ہے جو بلند و عظیم ہے۔',
    significance:
      'A comprehensive supplication of Tawbah (repentance), seeking forgiveness for intentional, unintentional, hidden, and public shortcomings while recognizing Allah as Al-Ghaffar and As-Sattar.',
  },
  {
    id: 'kalma-6',
    number: 6,
    badge: 'Kalma 6',
    title: 'Sixth Kalma: Radde Kufr',
    shortName: 'Radde Kufr (Rejection of Disbelief)',
    arabicTitle: 'كَلِمَةُ رَدِّ الْكُفْر',
    urduTitle: 'چھٹا کلمہ ردِّ کفر',
    arabicText:
      'اللّٰهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ أَنْ أُشْرِكَ بِكَ شَيْئًا وَّأَنَا أَعْلَمُ بِهِ، وَأَسْتَغْفِرُكَ لِمَا لَا أَعْلَمُ بِهِ، تُبْتُ عَنْهُ وَتَبَرَّأْتُ مِنَ الْكُفْرِ وَالشِّرْكِ وَالْكِذْبِ وَالْغِيبَةِ وَالْبِدْعَةِ وَالنَّمِيمَةِ وَالْفَوَاحِشِ وَالْبُهْتَانِ وَالْمَعَاصِي كُلِّهَا، وَأَسْلَمْتُ وَأَقُولُ: لَا إِلٰهَ إِلَّا اللّٰهُ مُحَمَّدٌ رَّسُولُ اللّٰهِ',
    transliteration:
      'Allāhumma innī a‘ūdhu bika min an ushrika bika shay’an wa ana a‘lamu bihī, wa astaghfiruka limā lā a‘lamu bihī, tubtu ‘anhu wa tabarra’tu minal-kufri wash-shirki wal-kidhbi wal-ghībati wal-bid‘ati wan-namīmati wal-fawāḥishi wal-buhtāni wal-ma‘āṣī kullihā, wa aslamtu wa aqūlu lā ilāha illallāhu Muḥammadur Rasūlullāh.',
    englishTranslation:
      'O Allah! I seek refuge in You from knowingly associating any partner with You, and I seek Your forgiveness for what I do not know. I repent from it and disassociate myself from disbelief, polytheism, falsehood, backbiting, religious innovation, tale-bearing, indecencies, slander, and all sins. I submit in Islam and declare: There is no deity worthy of worship except Allah, Muhammad is the Messenger of Allah.',
    urduTranslation:
      'اے اللہ! میں تیری پناہ مانگتا/مانگتی ہوں اس بات سے کہ میں جانتے بوجھتے تیرے ساتھ کسی چیز کو شریک ٹھہراؤں، اور میں تجھ سے معافی مانگتا/مانگتی ہوں اس سے جسے میں نہیں جانتا/جانتی۔ میں نے اس سے توبہ کی اور میں بیزار ہوا/ہوئی کفر، شرک، جھوٹ، غیبت، بدعت، چغل خوری، بے حیائی، بہتان اور تمام گناہوں سے، اور میں اسلام لایا/لائی اور کہتا/کہتی ہوں: اللہ کے سوا کوئی معبود نہیں، محمد (ﷺ) اللہ کے رسول ہیں۔',
    significance:
      'Opens with the prophetic refuge prayer against conscious and hidden Shirk (Al-Adab al-Mufrad / Musnad Ahmad), followed by an explicit pledge renewing devotion to sincerity and upright conduct.',
  },
];

export function getSixKalmas(): KalmaEntry[] {
  return [...SIX_KALMAS];
}

export function searchKalmas(query: string): KalmaEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...SIX_KALMAS];
  return SIX_KALMAS.filter(
    (k) =>
      k.title.toLowerCase().includes(q) ||
      k.shortName.toLowerCase().includes(q) ||
      k.badge.toLowerCase().includes(q) ||
      k.transliteration.toLowerCase().includes(q) ||
      k.englishTranslation.toLowerCase().includes(q) ||
      k.urduTranslation.includes(query.trim()) ||
      k.urduTitle.includes(query.trim()) ||
      k.arabicText.includes(query.trim())
  );
}
