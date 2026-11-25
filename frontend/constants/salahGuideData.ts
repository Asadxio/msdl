import { SalahStep } from '@/types/islamic';

/**
 * Authentic Step-by-Step Salah Guide Data
 * With dual Fiqh guidance (Hanafi & Shafi'i / General Sunnah),
 * full Arabic recitation, transliteration, English & Urdu translations.
 */
export const SALAH_STEPS: SalahStep[] = [
  {
    stepNumber: 1,
    id: 'takbir-tahrima',
    stepNameEn: 'Takbir-e-Tahrima (Commencement)',
    stepNameUr: 'تکبیرِ تحریمہ (نماز کا آغاز)',
    stepNameAr: 'تَكْبِيرَةُ الإِحْرَامِ',
    posture: 'standing',
    arabicText: 'اللَّهُ أَكْبَرُ',
    transliteration: 'Allahu Akbar',
    englishTranslation: 'Allah is the Greatest.',
    urduTranslation: 'اللہ سب سے بڑا ہے۔',
    instructionsEn: 'Stand facing the Qibla with sincere intention in the heart. Raise both hands and utter the Takbir.',
    instructionsUr: 'قبلہ رخ باوضو کھڑے ہوں، دل میں نماز کی نیت کریں، دونوں ہاتھ کانوں یا کندھوں تک اٹھائیں اور تکبیر کہیں۔',
    fiqhGuidance: {
      hanafi: 'Men raise hands up to the earlobes (thumbs touching lobes). Women raise hands up to shoulder level.',
      shafii: 'Both men and women raise hands up to shoulder level, fingers naturally unclasped facing Qibla.',
      general: 'Raising hands at the opening Takbir is an established Sunnah across all recognized schools.'
    },
    audioUrl: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3'
  },
  {
    stepNumber: 2,
    id: 'qiyam-hands',
    stepNameEn: 'Qiyam (Standing & Hand Placement)',
    stepNameUr: 'قیام اور ہاتھ باندھنا',
    stepNameAr: 'الْقِيَامُ وَوَضْعُ الْيَدَيْنِ',
    posture: 'standing',
    arabicText: 'قِيَامٌ لِلَّهِ تَعَالَى',
    transliteration: 'Qiyamun lillahi Ta\'ala',
    englishTranslation: 'Standing in humble devotion before Allah the Exalted.',
    urduTranslation: 'اللہ تعالیٰ کے حضور عاجزی و خشوع کے ساتھ باادب کھڑے ہونا۔',
    instructionsEn: 'Keep gaze focused on the place of prostration (Sajdah). Stand with composure and clasp hands respectfully.',
    instructionsUr: 'نگاہ سجدہ کی جگہ پر مرکوز رکھیں، باوقار کھڑے ہوں اور ادب کے ساتھ ہاتھ باندھیں۔',
    fiqhGuidance: {
      hanafi: 'Men place the right hand over the left below the navel (little finger and thumb forming a ring around the wrist). Women place hands on the chest.',
      shafii: 'Both men and women place the right hand over the left wrist above the navel and below the chest, slightly toward the left side.',
      general: 'Keeping eyes focused on the place of prostration instills Khushu\' (devout concentration).'
    }
  },
  {
    stepNumber: 3,
    id: 'sana',
    stepNameEn: 'Sana / Thana (Opening Glorification)',
    stepNameUr: 'ثناء (اللہ تعالیٰ کی پاکیزگی و حمد)',
    stepNameAr: 'دُعَاءُ الاِسْتِفْتَاحِ (الثَّنَاءُ)',
    posture: 'standing',
    arabicText: 'سُبْحَانَكَ اللَّهُمَّ وَبِحَمْدِكَ، وَتَبَارَكَ اسْمُكَ، وَتَعَالَىٰ جَدُّكَ، وَلَا إِلَٰهَ غَيْرُكَ',
    transliteration: 'Subhanakallahumma wa bihamdika, wa tabarakasmuka, wa ta\'ala jadduka, wa la ilaha ghayruk.',
    englishTranslation: 'Glory be to You, O Allah, and all praise is Yours. Blessed is Your Name, exalted is Your Majesty, and there is no deity besides You.',
    urduTranslation: 'پاک ہے تو اے اللہ! اپنی تعریفوں کے ساتھ، اور بڑا بابرکت ہے تیرا نام، اور بہت بلند ہے تیری شان، اور تیرے سوا کوئی معبود نہیں۔',
    instructionsEn: 'Recite quietly to yourself immediately after folding hands in the first Rak\'ah.',
    instructionsUr: 'پہلی رکعت میں ہاتھ باندھنے کے بعد آہستہ آواز میں ثناء پڑھیں۔',
    fiqhGuidance: {
      hanafi: 'Recited in the first Rak\'ah of every Fard, Sunnah, and Nafl prayer after Takbir.',
      shafii: 'Shafi\'i jurisprudence primarily recommends the "Wajjahtu Wajhiya..." opening invocation, though "Subhanakallahumma..." is also recognized in authentic Sunnah.',
      general: 'Both forms of Istiftah are firmly established in Sahih Hadith (Abu Dawud and Muslim).'
    }
  },
  {
    stepNumber: 4,
    id: 'taawwuz-tasmiyah',
    stepNameEn: 'Ta\'awwuz & Tasmiyah',
    stepNameUr: 'تعوذ اور تسمیہ',
    stepNameAr: 'التَّعَوُّذُ وَالتَّسْمِيَةُ',
    posture: 'standing',
    arabicText: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ ۝ بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    transliteration: 'A\'udhu billahi minash-shaytanir-rajeem. Bismillahir-Rahmanir-Raheem.',
    englishTranslation: 'I seek refuge in Allah from the accursed Satan. In the Name of Allah, the Entirely Merciful, the Especially Merciful.',
    urduTranslation: 'میں شیطان مردود سے اللہ کی پناہ مانگتا ہوں۔ شروع اللہ کے نام سے جو بڑا مہربان نہایت رحم فرمانے والا ہے۔',
    instructionsEn: 'Recited quietly before recitation of the Holy Quran in every prayer.',
    instructionsUr: 'تلاوتِ قرآن شروع کرنے سے قبل آہستہ آواز میں تعوذ اور تسمیہ پڑھیں۔',
    fiqhGuidance: {
      hanafi: 'Both Ta\'awwuz and Tasmiyah are recited silently by the praying person in the first Rak\'ah; Tasmiyah is repeated before every Surah.',
      shafii: 'Bismillah is considered the first ayah of Surah Al-Fatihah and is recited aloud in loud prayers (Jahri) and silently in quiet prayers (Sirri).',
      general: 'Seeking refuge in Allah protects the prayer from Satanic whispers (Waswasah).'
    }
  },
  {
    stepNumber: 5,
    id: 'surah-fatiha',
    stepNameEn: 'Surah Al-Fatihah (The Opening Chapter)',
    stepNameUr: 'سورۃ الفاتحہ (نماز کا رکنِ اعظم)',
    stepNameAr: 'سُورَةُ الْفَاتِحَةِ',
    posture: 'standing',
    arabicText: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ ۝ الرَّحْمَٰنِ الرَّحِيمِ ۝ مَالِكِ يَوْمِ الدِّينِ ۝ إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ ۝ اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ ۝ صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ',
    transliteration: 'Alhamdu lillahi Rabbil-\'alameen. Ar-Rahmanir-Raheem. Maliki Yawmid-Deen. Iyyaka na\'budu wa iyyaka nasta\'een. Ihdinas-siratal-mustaqeem. Siratal-ladheena an\'amta \'alayhim ghayril-maghdoobi \'alayhim wa lad-daalleen. (Ameen)',
    englishTranslation: '[All] praise is [due] to Allah, Lord of the worlds. The Entirely Merciful, the Especially Merciful. Sovereign of the Day of Recompense. It is You we worship and You we ask for help. Guide us to the straight path. The path of those upon whom You have bestowed favor, not of those who have evoked [Your] anger or of those who are astray. (Ameen)',
    urduTranslation: 'سب تعریفیں اللہ ہی کے لیے ہیں جو تمام جہانوں کا رب ہے۔ بڑا مہربان نہایت رحم فرمانے والا ہے۔ روزِ جزا کا مالک ہے۔ ہم صرف تیری ہی عبادت کرتے ہیں اور صرف تجھ ہی سے مدد مانگتے ہیں۔ ہمیں سیدھے راستے کی ہدایت فرما۔ ان لوگوں کے راستے کی جن پر تو نے انعام فرمایا، نہ کہ ان کے راستے کی جن پر تیرا غضب ہوا اور نہ گمراہوں کے۔ (آمین)',
    instructionsEn: 'Mandatory in every single unit (Rak\'ah) of prayer. Conclude with saying "Ameen".',
    instructionsUr: 'ہر رکعت میں سورۃ الفاتحہ کی تلاوت لازمی ہے۔ سورۃ ختم ہونے پر دل یا زبان سے آمین کہیں۔',
    fiqhGuidance: {
      hanafi: 'Reciting Fatihah is Wajib. When praying behind an Imam, the congregation remains silent during the Imam\'s recitation.',
      shafii: 'Reciting Fatihah is an indispensable pillar (Fard/Rukn) for every praying individual, even behind an Imam in silent intervals.',
      general: 'Saying Ameen after Fatihah is agreed upon; Hanafi jurisprudence recommends saying it silently, while Shafi\'i recommends saying it aloud in Jahri prayers.'
    },
    audioUrl: 'https://everyayah.com/data/Alafasy_128kbps/001001.mp3'
  },
  {
    stepNumber: 6,
    id: 'additional-surah',
    stepNameEn: 'Additional Surah (e.g. Surah Al-Ikhlas)',
    stepNameUr: 'ضمِ سورۃ (مثلاً سورۃ الاخلاص)',
    stepNameAr: 'قِرَاءَةُ سُورَةٍ بَعْدَ الْفَاتِحَةِ',
    posture: 'standing',
    arabicText: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ۝ قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ',
    transliteration: 'Qul Huwallahu Ahad. Allahus-Samad. Lam yalid wa lam yoolad. Wa lam yakun lahu kufuwan ahad.',
    englishTranslation: 'Say, "He is Allah, [who is] One. Allah, the Eternal Refuge. He neither begets nor is born, nor is there to Him any equivalent."',
    urduTranslation: 'کہہ دیجیے کہ وہ اللہ ایک ہے۔ اللہ بے نیاز ہے۔ نہ اس کی کوئی اولاد ہے اور نہ وہ کسی کی اولاد ہے۔ اور نہ کوئی اس کا ہمسر ہے۔',
    instructionsEn: 'Recite a Surah or at least three short verses in the first two Rak\'ahs of Fard prayer and all Rak\'ahs of Sunnah/Nafl.',
    instructionsUr: 'فرض کی پہلی دو رکعتوں میں اور سنت و نفل کی تمام رکعتوں میں سورۃ الفاتحہ کے بعد کوئی سورت ملائیں۔',
    fiqhGuidance: {
      hanafi: 'Joining a Surah (at least one long ayah or three short ayahs) is Wajib in the first two Rak\'ahs of Fard and all units of Sunnah/Nafl/Witr.',
      shafii: 'Reciting an additional Surah after Fatihah is a confirmed Sunnah in the first two Rak\'ahs.',
      general: 'Reciting any portion of the Holy Quran with contemplation earns immense divine reward.'
    },
    audioUrl: 'https://everyayah.com/data/Alafasy_128kbps/112001.mp3'
  },
  {
    stepNumber: 7,
    id: 'ruku',
    stepNameEn: 'Ruku (Bowing & Tasbeeh)',
    stepNameUr: 'رکوع اور تسبیح',
    stepNameAr: 'الرُّكُوعُ وَتَسْبِيحُهُ',
    posture: 'bowing',
    arabicText: 'سُبْحَانَ رَبِّيَ الْعَظِيمِ',
    transliteration: 'Subhana Rabbiyal-\'Azeem',
    englishTranslation: 'Glory be to my Lord, the Tremendous.',
    urduTranslation: 'پاک ہے میرا رب جو بڑی عظمت والا ہے۔',
    instructionsEn: 'Say "Allahu Akbar" and bow down until back is horizontal and hands grasp knees. Repeat the Tasbeeh at least 3 times.',
    instructionsUr: 'اللہ اکبر کہتے ہوئے جھکیں، کمر کو بالکل سیدھا رکھیں، ہاتھوں سے گھٹنوں کو مضبوطی سے تھامیں اور کم از کم ۳ بار تسبیح کہیں۔',
    fiqhGuidance: {
      hanafi: 'Spread fingers across knees. Keep back level such that if water were placed on it, it would not spill.',
      shafii: 'Raising hands (Rafa\' al-Yadayn) upon going into Ruku is a confirmed Sunnah. Clasp knees with fingers separated.',
      general: 'Bow with absolute serenity and stillness (Ta\'deel al-Arkan).'
    },
    repeatTimes: 3
  },
  {
    stepNumber: 8,
    id: 'qawmah',
    stepNameEn: 'Qawmah (Standing Up from Bowing & Tahmeed)',
    stepNameUr: 'قومہ (رکوع سے سیدھا کھڑا ہونا اور تحمید)',
    stepNameAr: 'الْقَوْمَةُ وَالتَّحْمِيدُ',
    posture: 'standing',
    arabicText: 'سَمِعَ اللَّهُ لِمَنْ حَمِدَهُ ۝ رَبَّنَا لَكَ الْحَمْدُ، حَمْدًا كَثِيرًا طَيِّبًا مُبَارَكًا فِيهِ',
    transliteration: 'Sami\'Allahu liman hamidah. Rabbana lakal-hamd, hamdan katheeran tayyiban mubarakan feeh.',
    englishTranslation: 'Allah hears whoever praises Him. Our Lord, to You belongs all praise, abundant, pure, and blessed praise.',
    urduTranslation: 'اللہ نے اس کی سن لی جس نے اس کی تعریف کی۔ اے ہمارے رب! تیرے ہی لیے تمام تعریفیں ہیں، بہت زیادہ، پاکیزہ اور برکت والی تعریفیں۔',
    instructionsEn: 'Rise back to a completely upright standing posture, arms resting at sides, with full tranquility before prostrating.',
    instructionsUr: 'رکوع سے سیدھے بالکل کھڑے ہو جائیں، دونوں ہاتھ پہلوؤں میں آزاد چھوڑ دیں اور کامل اطمینان سے تحمید پڑھیں۔',
    fiqhGuidance: {
      hanafi: 'Imam says "Sami Allahu Liman Hamidah", follower responds with "Rabbana Lakal Hamd", while person praying alone says both.',
      shafii: 'Both Imam and follower recite both "Sami Allahu..." and "Rabbana Lakal Hamd". Rafa\' al-Yadayn is performed.',
      general: 'Standing completely straight for at least one breath is an obligatory pillar across all schools.'
    }
  },
  {
    stepNumber: 9,
    id: 'sajdah-one',
    stepNameEn: 'Sajdah (First Prostration & Tasbeeh)',
    stepNameUr: 'پہلا سجدہ اور تسبیح',
    stepNameAr: 'السُّجُودُ الأَوَّلُ وَتَسْبِيحُهُ',
    posture: 'prostrating',
    arabicText: 'سُبْحَانَ رَبِّيَ الأَعْلَىٰ',
    transliteration: 'Subhana Rabbiyal-A\'la',
    englishTranslation: 'Glory be to my Lord, the Most High.',
    urduTranslation: 'پاک ہے میرا رب جو سب سے بلند و بالا ہے۔',
    instructionsEn: 'Say "Allahu Akbar" and prostrate. Ensure seven points touch the ground: forehead & nose, both palms, both knees, and toes of both feet.',
    instructionsUr: 'اللہ اکبر کہتے ہوئے سجدے میں جائیں۔ پیشانی، ناک، دونوں ہتھیلیاں، دونوں گھٹنے اور دونوں پاؤں کی انگلیاں زمین پر جمائیں اور ۳ بار تسبیح کہیں۔',
    fiqhGuidance: {
      hanafi: 'Men keep elbows lifted off the floor and away from sides, abdomen away from thighs. Women prostrate close to the ground, keeping limbs together.',
      shafii: 'Men separate arms from sides and stomach from thighs; women keep limbs contracted for modesty.',
      general: 'The servant is closest to his Lord while in prostration (Sahih Muslim).'
    },
    repeatTimes: 3
  },
  {
    stepNumber: 10,
    id: 'jalsa',
    stepNameEn: 'Jalsa (Sitting Between Two Prostrations)',
    stepNameUr: 'جلسہ (دو سجدوں کے درمیان بیٹھنا اور دعا)',
    stepNameAr: 'الْجِلْسَةُ بَيْنَ السَّجْدَتَيْنِ',
    posture: 'sitting',
    arabicText: 'رَبِّ اغْفِرْ لِي، رَبِّ اغْفِرْ لِي، وَارْحَمْنِي، وَعَافِنِي، وَاهْدِنِي، وَارْزُقْنِي',
    transliteration: 'Rabbighfir li, Rabbighfir li, warhamni, wa \'afini, wahdini, warzuqni.',
    englishTranslation: 'My Lord forgive me, my Lord forgive me, have mercy on me, grant me health, guide me, and provide for me.',
    urduTranslation: 'اے میرے رب! مجھے بخش دے، اے میرے رب! مجھے بخش دے، مجھ پر رحم فرما، مجھے عافیت دے، مجھے ہدایت دے اور مجھے رزق عطا فرما۔',
    instructionsEn: 'Rise saying "Allahu Akbar" and sit up straight calmly. Rest hands on thighs and supplicate before second prostration.',
    instructionsUr: 'اللہ اکبر کہتے ہوئے سجدے سے اٹھ کر اطمینان سے بیٹھیں، دونوں ہاتھ رانوں پر رکھیں اور بخشش کی دعا مانگیں۔',
    fiqhGuidance: {
      hanafi: 'Sit in Iftirash: unfold left foot and sit upon it, while keeping right foot upright with toes pointing toward Qibla.',
      shafii: 'Sit in Iftirash between two sajdahs. Recite the comprehensive forgiveness supplication.',
      general: 'Achieving calmness (Tum\'aneenah) in Jalsa is a required pillar.'
    }
  },
  {
    stepNumber: 11,
    id: 'sajdah-two',
    stepNameEn: 'Second Sajdah (Second Prostration)',
    stepNameUr: 'دوسرا سجدہ',
    stepNameAr: 'السُّجُودُ الثَّانِي',
    posture: 'prostrating',
    arabicText: 'سُبْحَانَ رَبِّيَ الأَعْلَىٰ',
    transliteration: 'Subhana Rabbiyal-A\'la',
    englishTranslation: 'Glory be to my Lord, the Most High.',
    urduTranslation: 'پاک ہے میرا رب جو سب سے بلند و بالا ہے۔',
    instructionsEn: 'Say "Allahu Akbar" and perform the second prostration identical to the first. Repeat Tasbeeh 3 times.',
    instructionsUr: 'اللہ اکبر کہتے ہوئے دوسرا سجدہ پہلے سجدے کی طرح ادا کریں اور کم از کم ۳ بار تسبیح کہیں۔',
    fiqhGuidance: {
      hanafi: 'Rise directly from the second sajdah to standing for the next Rak\'ah without a pause.',
      shafii: 'Briefly pause in a sitting posture (Jalsat al-Istirahah) before rising to the next Rak\'ah.',
      general: 'Both methods are documented in Sunnah narrations.'
    },
    repeatTimes: 3
  },
  {
    stepNumber: 12,
    id: 'tashahhud',
    stepNameEn: 'Tashahhud / Qa\'dah (Attahiyyat)',
    stepNameUr: 'تشہد / التحیات (قعدہ میں بیٹھنا)',
    stepNameAr: 'التَّشَهُّدُ (التَّحِيَّاتُ لِلَّهِ)',
    posture: 'sitting',
    arabicText: 'التَّحِيَّاتُ لِلَّهِ وَالصَّلَوَاتُ وَالطَّيِّبَاتُ، السَّلاَمُ عَلَيْكَ أَيُّهَا النَّبِيُّ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ، السَّلاَمُ عَلَيْنَا وَعَلَىٰ عِبَادِ اللَّهِ الصَّالِحِينَ، أَشْهَدُ أَنْ لاَ إِلَٰهَ إِلاَّ اللَّهُ وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ',
    transliteration: 'Attahiyyatu lillahi was-salawatu wat-tayyibat. Assalamu \'alayka ayyuhan-Nabiyyu wa rahmatullahi wa barakatuh. Assalamu \'alayna wa \'ala \'ibadillahis-saliheen. Ash-hadu alla ilaha illallahu wa ash-hadu anna Muhammadan \'abduhu wa Rasooluh.',
    englishTranslation: 'All compliments, prayers, and pure words are due to Allah. Peace be upon you, O Prophet, and the mercy of Allah and His blessings. Peace be upon us and upon the righteous servants of Allah. I bear witness that there is no deity worthy of worship except Allah, and I bear witness that Muhammad is His servant and Messenger.',
    urduTranslation: 'تمام قولی، بدنی اور مالی عبادتیں اللہ ہی کے لیے ہیں۔ اے نبی! آپ پر سلامتی ہو اور اللہ کی رحمت اور اس کی برکتیں ہوں۔ سلامتی ہو ہم پر اور اللہ کے تمام نیک بندوں پر۔ میں گواہی دیتا ہوں کہ اللہ کے سوا کوئی معبود نہیں اور میں گواہی دیتا ہوں کہ محمد (صلی اللہ علیہ وسلم) اس کے بندے اور رسول ہیں۔',
    instructionsEn: 'Sit in the Qa\'dah position at the end of the second and final Rak\'ah. Raise the index finger upon uttering the Shahadah.',
    instructionsUr: 'دوسری اور آخری رکعت کے اختتام پر قعدہ میں بیٹھیں اور کلمہ شہادت پر انگشتِ شہادت سے توحید کا اشارہ کریں۔',
    fiqhGuidance: {
      hanafi: 'Raise index finger upon saying "Ash-hadu alla ilaha" and lower it upon "illallah", keeping the hand settled.',
      shafii: 'Keep index finger raised from "illallah" until standing or completion of prayer. Sit in Tawarruk in the final Qa\'dah.',
      general: 'Tashahhud taught by Abdullah ibn Mas\'ud (RA) is recorded in Sahih al-Bukhari.'
    }
  },
  {
    stepNumber: 13,
    id: 'durood-ibrahim',
    stepNameEn: 'Durood-e-Ibrahim (Salutations upon the Prophet)',
    stepNameUr: 'درودِ ابراہیمی',
    stepNameAr: 'الصَّلاَةُ الإِبْرَاهِيمِيَّةُ',
    posture: 'sitting',
    arabicText: 'اللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ وَعَلَىٰ آلِ مُحَمَّدٍ كَمَا صَلَّيْتَ عَلَىٰ إِبْرَاهِيمَ وَعَلَىٰ آلِ إِبْرَاهِيمَ إِنَّكَ حَمِيدٌ مَجِيدٌ ۝ اللَّهُمَّ بَارِكْ عَلَىٰ مُحَمَّدٍ وَعَلَىٰ آلِ مُحَمَّدٍ كَمَا بَارَكْتَ عَلَىٰ إِبْرَاهِيمَ وَعَلَىٰ آلِ إِبْرَاهِيمَ إِنَّكَ حَمِيدٌ مَجِيدٌ',
    transliteration: 'Allahumma salli \'ala Muhammadin wa \'ala ali Muhammad, kama sallayta \'ala Ibraheema wa \'ala ali Ibraheem, innaka Hameedum-Majeed. Allahumma barik \'ala Muhammadin wa \'ala ali Muhammad, kama barakta \'ala Ibraheema wa \'ala ali Ibraheem, innaka Hameedum-Majeed.',
    englishTranslation: 'O Allah, bestow Your favor upon Muhammad and the family of Muhammad as You bestowed favor upon Ibrahim and the family of Ibrahim. Indeed, You are Praiseworthy and Glorious. O Allah, bless Muhammad and the family of Muhammad as You blessed Ibrahim and the family of Ibrahim. Indeed, You are Praiseworthy and Glorious.',
    urduTranslation: 'اے اللہ! رحمت نازل فرما حضرت محمد (صلی اللہ علیہ وسلم) پر اور ان کی آل پر جیسا کہ تو نے رحمت نازل فرمائی حضرت ابراہیم پر اور ان کی آل پر، بے شک تو تعریف کیا گیا بڑی بزرگی والا ہے۔ اے اللہ! برکت نازل فرما حضرت محمد (صلی اللہ علیہ وسلم) پر اور ان کی آل پر جیسا کہ تو نے برکت نازل فرمائی حضرت ابراہیم پر اور ان کی آل پر، بے شک تو تعریف کیا گیا بڑی بزرگی والا ہے۔',
    instructionsEn: 'Recited in the final sitting (Qa\'dah Akheerah) before making the final supplication.',
    instructionsUr: 'آخری قعدہ میں تشہد کے بعد درود ابراہیمی پڑھیں۔',
    fiqhGuidance: {
      hanafi: 'Reciting Durood-e-Ibrahim is a confirmed Sunnah (Sunnah Muakkadah) in the final Qa\'dah.',
      shafii: 'Sending salutations upon the Prophet is an obligatory pillar (Fard) of the final sitting.',
      general: 'This is the most authentic and complete form of Durood taught by the Prophet himself (Sahih al-Bukhari).'
    }
  },
  {
    stepNumber: 14,
    id: 'dua-salam',
    stepNameEn: 'Dua Masoora & Tasleem (Concluding Salam)',
    stepNameUr: 'دعائے ماثورہ اور سلام پھیرنا',
    stepNameAr: 'الدُّعَاءُ الْمَأْثُورُ وَالتَّسْلِيمُ',
    posture: 'sitting',
    arabicText: 'اللَّهُمَّ إِنِّي ظَلَمْتُ نَفْسِي ظُلْمًا كَثِيرًا، وَلَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ، فَاغْفِرْ لِي مَغْفِرَةً مِنْ عِنْدِكَ وَارْحَمْنِي إِنَّكَ أَنْتَ الْغَفُورُ الرَّحِيمُ ۝ السَّلاَمُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ',
    transliteration: 'Allahumma inni zalamtu nafsi zulman katheera, wa la yaghfirudh-dhunooba illa Ant, faghfir li maghfiratan min \'indika warhamni, innaka Antal-Ghafoorur-Raheem. Assalamu \'alaykum wa Rahmatullah.',
    englishTranslation: 'O Allah, I have wronged myself greatly and none forgives sins except You, so grant me forgiveness from You and have mercy on me; indeed You are the All-Forgiving, Most Merciful. Peace and the mercy of Allah be upon you.',
    urduTranslation: 'اے اللہ! میں نے اپنی جان پر بہت بڑا ظلم کیا اور تیرے سوا کوئی گناہوں کو نہیں بخش سکتا، پس اپنی خاص بخشش سے میری مغفرت فرما اور مجھ پر رحم فرما، بے شک تو ہی بڑا بخشنے والا نہایت رحم فرمانے والا ہے۔ تم پر سلامتی اور اللہ کی رحمت ہو۔',
    instructionsEn: 'Recite a Masnoon dua, then turn your face to the right and utter the Salam, then turn to the left and utter the Salam to conclude prayer.',
    instructionsUr: 'دعائے ماثورہ پڑھنے کے بعد پہلے دائیں کندھے کی طرف رخ کر کے سلام پھیریں، پھر بائیں کندھے کی طرف سلام پھیر کر نماز مکمل کریں۔',
    fiqhGuidance: {
      hanafi: 'Both Salams are Wajib. Turning right and left concludes the prayer.',
      shafii: 'The first Salam to the right is the obligatory pillar that exits the state of Ihram; the second Salam to the left is Sunnah.',
      general: 'Prayers of angels and righteous servants are greeted upon turning to both sides.'
    }
  }
];
