const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const serviceAccountPath = '../backend/serviceAccountKey.json';
const rawData = fs.readFileSync(serviceAccountPath, 'utf8');
const serviceAccount = JSON.parse(rawData);

// Prevent re-initialization if already initialized (though not strictly necessary here)
try {
  initializeApp({
    credential: cert(serviceAccount)
  });
} catch (e) {
  if (e.code !== 'app/duplicate-app') throw e;
}

const db = getFirestore();

const QUIZ_DATA = [
  // Azan
  { question: "Azan ka maqsad kya hai?", option1: "Namaz ka waqt batana aur Namaz ki taraf bulana", option2: "Roza shuru karna", option3: "Nikah ka elan karna", option4: "Safar ka elan karna", correctAnswer: "Namaz ka waqt batana aur Namaz ki taraf bulana", category: "Azan" },
  { question: "Azan kis ibadat ke liye di jati hai?", option1: "Roza", option2: "Namaz", option3: "Hajj", option4: "Zakat", correctAnswer: "Namaz", category: "Azan" },
  { question: "Paanch waqt ki Farz Namazon ke liye Azan ka kya hukm hai?", option1: "Sunnat-e-Muakkadah", option2: "Farz", option3: "Wajib", option4: "Mustahab", correctAnswer: "Sunnat-e-Muakkadah", category: "Azan" },
  { question: "Azan dene wale ko kya kehte hain?", option1: "Imam", option2: "Muazzin", option3: "Khateeb", option4: "Hafiz", correctAnswer: "Muazzin", category: "Azan" },
  { question: "Azan mein sabse pehle kaun se alfaaz kahe jate hain?", option1: "Subhanallah", option2: "Allahu Akbar", option3: "Alhamdulillah", option4: "Astaghfirullah", correctAnswer: "Allahu Akbar", category: "Azan" },
  { question: "Azan ke baad kaunsi cheez padhna Sunnat hai?", option1: "Durood Shareef aur Azan ki Dua", option2: "Sirf Surah Fatiha", option3: "Ayat-ul-Kursi", option4: "Surah Yaseen", correctAnswer: "Durood Shareef aur Azan ki Dua", category: "Azan" },
  { question: "Azan sunne wale ko kya karna chahiye?", option1: "Muazzin ke alfaaz ka jawab dena", option2: "Khamosh rehna", option3: "Namaz shuru kar dena", option4: "Masjid se bahar jana", correctAnswer: "Muazzin ke alfaaz ka jawab dena", category: "Azan" },
  { question: "\"Hayya alas Salah\" ke jawab mein kya padhna chahiye?", option1: "Allahu Akbar", option2: "La hawla wa la quwwata illa billah", option3: "Subhanallah", option4: "Alhamdulillah", correctAnswer: "La hawla wa la quwwata illa billah", category: "Azan" },
  { question: "Azan kis zaban mein di jati hai?", option1: "Urdu", option2: "Arabic", option3: "English", option4: "Hindi", correctAnswer: "Arabic", category: "Azan" },
  { question: "Fajr ki Azan mein kaun se izafi alfaaz kahe jate hain?", option1: "As-Salatu Khairum Minan-Nawm", option2: "Hayya Alal Jannah", option3: "Subhan Rabbiyal Azeem", option4: "Astaghfirullah", correctAnswer: "As-Salatu Khairum Minan-Nawm", category: "Azan" },
  { question: "Azan kis ilm ke masail mein shamil hai?", option1: "Fiqh", option2: "Nahw", option3: "Balaghat", option4: "Tafseer", correctAnswer: "Fiqh", category: "Azan" },
  { question: "Azan ke baad Namaz se pehle kya di jati hai?", option1: "Iqamah", option2: "Khutbah", option3: "Takbeer-e-Tashreeq", option4: "Dua-e-Qunoot", correctAnswer: "Iqamah", category: "Azan" },
  { question: "Azan ka zikr kis ibadat ke bab mein aata hai?", option1: "Kitab-us-Salah", option2: "Kitab-us-Saum", option3: "Kitab-ul-Hajj", option4: "Kitab-uz-Zakat", correctAnswer: "Kitab-us-Salah", category: "Azan" },
  { question: "Azan ka jawab dena kaisa hai?", option1: "Sunnat", option2: "Farz", option3: "Wajib", option4: "Makruh", correctAnswer: "Sunnat", category: "Azan" },
  { question: "Azan ke baad ki Dua mangna kaisa hai?", option1: "Mustahab", option2: "Makruh", option3: "Na-Jaiz", option4: "Farz", correctAnswer: "Mustahab", category: "Azan" },
  { question: "Azan ki ibtida kis lafz se hoti hai?", option1: "Allahu Akbar", option2: "Ashhadu", option3: "Hayya", option4: "La ilaha illallah", correctAnswer: "Allahu Akbar", category: "Azan" },
  { question: "Azan ka ikhtitam kis jumle par hota hai?", option1: "Subhanallah", option2: "Allahu Akbar", option3: "La ilaha illallah", option4: "Alhamdulillah", correctAnswer: "La ilaha illallah", category: "Azan" },
  { question: "Azan ke baad Muazzin ke liye Dua karna kaisa hai?", option1: "Jaiz", option2: "Mustahab", option3: "Makruh", option4: "Na-Jaiz", correctAnswer: "Mustahab", category: "Azan" },
  { question: "Azan ka jawab dene ke baad kya padhna Sunnat hai?", option1: "Durood Shareef", option2: "Sirf Tasbeeh", option3: "Sirf Surah Ikhlas", option4: "Sirf Astaghfar", correctAnswer: "Durood Shareef", category: "Azan" },
  { question: "Azan ka asal maqsad kya hai?", option1: "Logon ko Namaz ke liye jama karna", option2: "Roza khulwana", option3: "Nikah ka elan", option4: "Safar ka elan", correctAnswer: "Logon ko Namaz ke liye jama karna", category: "Azan" },

  // Satr-e-Aurat
  { question: "Satr-e-Aurat ka kya matlab hai?", option1: "Jism ke un hisson ko chhupana jinka chhupana Shari'at mein zaroori hai", option2: "Sirf Sar dhakna", option3: "Sirf Chehra dhakna", option4: "Sirf Dupatta pehenna", correctAnswer: "Jism ke un hisson ko chhupana jinka chhupana Shari'at mein zaroori hai", category: "Satr-e-Aurat" },
  { question: "Namaz ke liye Satr-e-Aurat ka kya hukm hai?", option1: "Farz", option2: "Wajib", option3: "Sunnat", option4: "Mustahab", correctAnswer: "Farz", category: "Satr-e-Aurat" },
  { question: "Agar Namaz mein Satr-e-Aurat khul jaye to Namaz par kya asar pad sakta hai?", option1: "Namaz toot sakti hai", option2: "Koi asar nahi", option3: "Sirf Sajda Sahw hoga", option4: "Roza toot jayega", correctAnswer: "Namaz toot sakti hai", category: "Satr-e-Aurat" },
  { question: "Satr-e-Aurat kis ilm ke masail mein shamil hai?", option1: "Fiqh", option2: "Tajweed", option3: "Nahw", option4: "Balaghat", correctAnswer: "Fiqh", category: "Satr-e-Aurat" },
  { question: "Namaz se pehle kapdon ka kaisa hona zaroori hai?", option1: "Paak aur Satr ko chhupane wale", option2: "Mehange", option3: "Rangeen", option4: "Naye", correctAnswer: "Paak aur Satr ko chhupane wale", category: "Satr-e-Aurat" },
  { question: "Patle kapde jin se badan nazar aaye, un mein Namaz ka kya hukm hai?", option1: "Jaiz", option2: "Jaiz nahi", option3: "Mustahab", option4: "Mubah", correctAnswer: "Jaiz nahi", category: "Satr-e-Aurat" },
  { question: "Namaz ke liye libas ka kaisa hona zaroori hai?", option1: "Satr ko poori tarah chhupane wala", option2: "Sirf Safed", option3: "Sirf Kala", option4: "Sirf Mehanga", correctAnswer: "Satr ko poori tarah chhupane wala", category: "Satr-e-Aurat" },
  { question: "Satr-e-Aurat ki pabandi kis ibadat mein zaroori hai?", option1: "Namaz", option2: "Roza", option3: "Zakat", option4: "Safar", correctAnswer: "Namaz", category: "Satr-e-Aurat" },
  { question: "Satr-e-Aurat ke ahkam kis kitab ke bab mein padhaye jate hain?", option1: "Kitab-us-Salah", option2: "Kitab-ul-Buyu", option3: "Kitab-ul-Hajj", option4: "Kitab-ul-Wasiyyah", correctAnswer: "Kitab-us-Salah", category: "Satr-e-Aurat" },
  { question: "Satr-e-Aurat ki hifazat karna kis cheez ki nishani hai?", option1: "Haya", option2: "Takabbur", option3: "Ghaflat", option4: "Riya", correctAnswer: "Haya", category: "Satr-e-Aurat" },
  { question: "Namaz mein badan dhakna kis cheez ki shart hai?", option1: "Namaz ki Sahih Adaigi", option2: "Roza", option3: "Zakat", option4: "Nikah", correctAnswer: "Namaz ki Sahih Adaigi", category: "Satr-e-Aurat" },
  { question: "Satr-e-Aurat ka hukm kis ne diya hai?", option1: "Allah Ta'ala ne", option2: "Sirf Ulema ne", option3: "Logon ne", option4: "Hukumat ne", correctAnswer: "Allah Ta'ala ne", category: "Satr-e-Aurat" },
  { question: "Namaz ke liye kapde paak hone chahiye?", option1: "Haan", option2: "Nahi", option3: "Sirf Eid mein", option4: "Sirf Jummah mein", correctAnswer: "Haan", category: "Satr-e-Aurat" },
  { question: "Satr-e-Aurat ka ehtimam kis sifat ko mazboot karta hai?", option1: "Haya", option2: "Hasad", option3: "Ghussa", option4: "Takabbur", correctAnswer: "Haya", category: "Satr-e-Aurat" },
  { question: "Namaz mein Satr-e-Aurat ka khayal rakhna kaisa hai?", option1: "Zaroori", option2: "Ikhtiyari", option3: "Mustahab", option4: "Makruh", correctAnswer: "Zaroori", category: "Satr-e-Aurat" },
  { question: "Agar kapda itna patla ho ki badan ka rang nazar aaye to Namaz ka kya hukm hai?", option1: "Sahih nahi", option2: "Sahih hai", option3: "Mustahab hai", option4: "Makruh hai", correctAnswer: "Sahih nahi", category: "Satr-e-Aurat" },
  { question: "Satr-e-Aurat ke ahkam kis ilm ka hissa hain?", option1: "Fiqh", option2: "Nahw", option3: "Sarf", option4: "Balaghat", correctAnswer: "Fiqh", category: "Satr-e-Aurat" },
  { question: "Namaz ki sahih adaigi ke liye Satr-e-Aurat ka khayal rakhna kaisa hai?", option1: "Shart", option2: "Mustahab", option3: "Makruh", option4: "Nafl", correctAnswer: "Shart", category: "Satr-e-Aurat" },
  { question: "Satr-e-Aurat ki pabandi ka ta'alluq kis se hai?", option1: "Haya aur Shari'at", option2: "Sirf Riwayat", option3: "Sirf Culture", option4: "Sirf Mausam", correctAnswer: "Haya aur Shari'at", category: "Satr-e-Aurat" },
  { question: "Satr-e-Aurat ka asal maqsad kya hai?", option1: "Allah Ta'ala ke hukm par amal aur Haya ki hifazat", option2: "Sirf Riwaj", option3: "Sirf Fashion", option4: "Sirf Safar", correctAnswer: "Allah Ta'ala ke hukm par amal aur Haya ki hifazat", category: "Satr-e-Aurat" },

  // Namaz ki Shartein
  { question: "Namaz ki kitni shartein hain?", option1: "5", option2: "6", option3: "7", option4: "8", correctAnswer: "6", category: "Namaz ki Shartein" },
  { question: "Namaz ki pehli shart kya hai?", option1: "Taharat", option2: "Takbeer-e-Tahrimah", option3: "Ruku", option4: "Qiyam", correctAnswer: "Taharat", category: "Namaz ki Shartein" },
  { question: "Namaz ki doosri shart kya hai?", option1: "Satr-e-Aurat", option2: "Ruku", option3: "Qiyam", option4: "Qaadah", correctAnswer: "Satr-e-Aurat", category: "Namaz ki Shartein" },
  { question: "Namaz ki teesri shart kya hai?", option1: "Istiqbal-e-Qiblah", option2: "Sajdah", option3: "Qiraat", option4: "Salam", correctAnswer: "Istiqbal-e-Qiblah", category: "Namaz ki Shartein" },
  { question: "Namaz ki chauthi shart kya hai?", option1: "Waqt ka hona", option2: "Takbeer-e-Tahrimah", option3: "Ruku", option4: "Qaadah", correctAnswer: "Waqt ka hona", category: "Namaz ki Shartein" },
  { question: "Namaz ki paanchvi shart kya hai?", option1: "Niyyat", option2: "Sajdah", option3: "Qiraat", option4: "Tasleem", correctAnswer: "Niyyat", category: "Namaz ki Shartein" },
  { question: "Namaz ki chhathi shart kya hai?", option1: "Takbeer-e-Tahrimah", option2: "Ruku", option3: "Qaadah", option4: "Sajdah", correctAnswer: "Takbeer-e-Tahrimah", category: "Namaz ki Shartein" },
  { question: "Taharat se murad kya hai?", option1: "Paaki hasil karna", option2: "Roza rakhna", option3: "Safar karna", option4: "Zakat dena", correctAnswer: "Paaki hasil karna", category: "Namaz ki Shartein" },
  { question: "Satr-e-Aurat kis cheez ki shart hai?", option1: "Namaz", option2: "Roza", option3: "Zakat", option4: "Hajj", correctAnswer: "Namaz", category: "Namaz ki Shartein" },
  { question: "Istiqbal-e-Qiblah ka kya matlab hai?", option1: "Qiblah ki taraf rukh karna", option2: "Masjid jana", option3: "Azaan dena", option4: "Wudu karna", correctAnswer: "Qiblah ki taraf rukh karna", category: "Namaz ki Shartein" },
  { question: "Namaz ka waqt shuru hone se pehle Namaz padhna kaisa hai?", option1: "Jaiz", option2: "Jaiz nahi", option3: "Mustahab", option4: "Makruh", correctAnswer: "Jaiz nahi", category: "Namaz ki Shartein" },
  { question: "Niyyat kis cheez ka iradah hai?", option1: "Namaz ada karne ka", option2: "Safar ka", option3: "Roza ka", option4: "Tijarat ka", correctAnswer: "Namaz ada karne ka", category: "Namaz ki Shartein" },
  { question: "Takbeer-e-Tahrimah kis lafz se kahi jati hai?", option1: "Allahu Akbar", option2: "Subhanallah", option3: "Alhamdulillah", option4: "Astaghfirullah", correctAnswer: "Allahu Akbar", category: "Namaz ki Shartein" },
  { question: "Namaz ki shartein kis ilm ke masail mein shamil hain?", option1: "Fiqh", option2: "Nahw", option3: "Balaghat", option4: "Tafseer", correctAnswer: "Fiqh", category: "Namaz ki Shartein" },
  { question: "Namaz ke liye kapde kaise hone chahiye?", option1: "Paak", option2: "Mehange", option3: "Naye", option4: "Rangeen", correctAnswer: "Paak", category: "Namaz ki Shartein" },
  { question: "Agar Qiblah ki taraf rukh karna mumkin ho to kis taraf rukh karna zaroori hai?", option1: "Qiblah ki taraf", option2: "Mashriq", option3: "Maghrib", option4: "Kisi bhi taraf", correctAnswer: "Qiblah ki taraf", category: "Namaz ki Shartein" },
  { question: "Namaz ki shartein poori na hon to Namaz ka kya hukm hai?", option1: "Sahih nahi hogi", option2: "Sahih hogi", option3: "Sirf Nafl hogi", option4: "Makruh hogi", correctAnswer: "Sahih nahi hogi", category: "Namaz ki Shartein" },
  { question: "Niyyat ka ta'alluq kis se hai?", option1: "Dil se", option2: "Zaban se", option3: "Haath se", option4: "Pair se", correctAnswer: "Dil se", category: "Namaz ki Shartein" },
  { question: "Namaz ki shartein kis bab mein padhayi jati hain?", option1: "Kitab-us-Salah", option2: "Kitab-us-Saum", option3: "Kitab-ul-Hajj", option4: "Kitab-uz-Zakat", correctAnswer: "Kitab-us-Salah", category: "Namaz ki Shartein" },
  { question: "Namaz ki shartein poori karna kaisa hai?", option1: "Zaroori", option2: "Mustahab", option3: "Makruh", option4: "Mubah", correctAnswer: "Zaroori", category: "Namaz ki Shartein" },

  // Namaz ke Farz
  { question: "Namaz ke kitne Farz hain?", option1: "5", option2: "6", option3: "7", option4: "8", correctAnswer: "6", category: "Namaz ke Farz" },
  { question: "Namaz ka pehla Farz kya hai?", option1: "Qiyam", option2: "Ruku", option3: "Sajdah", option4: "Qa'dah", correctAnswer: "Qiyam", category: "Namaz ke Farz" },
  { question: "Namaz ka doosra Farz kya hai?", option1: "Ruku", option2: "Qiraat", option3: "Sajdah", option4: "Qa'dah", correctAnswer: "Qiraat", category: "Namaz ke Farz" },
  { question: "Namaz ka teesra Farz kya hai?", option1: "Ruku", option2: "Takbeer", option3: "Tasleem", option4: "Dua", correctAnswer: "Ruku", category: "Namaz ke Farz" },
  { question: "Namaz ka chautha Farz kya hai?", option1: "Qa'dah", option2: "Sajdah", option3: "Qiyam", option4: "Salaam", correctAnswer: "Sajdah", category: "Namaz ke Farz" },
  { question: "Namaz ka paanchwa Farz kya hai?", option1: "Qa'dah Akhirah", option2: "Takbeer", option3: "Tasbeeh", option4: "Dua", correctAnswer: "Qa'dah Akhirah", category: "Namaz ke Farz" },
  { question: "Namaz ka chhatha Farz kya hai?", option1: "Khurooj bi Sun'ihi", option2: "Qunoot", option3: "Ameen", option4: "Durood", correctAnswer: "Khurooj bi Sun'ihi", category: "Namaz ke Farz" },
  { question: "Qiyam se kya murad hai?", option1: "Khade hona", option2: "Baithna", option3: "Jhukna", option4: "Salaam pherna", correctAnswer: "Khade hona", category: "Namaz ke Farz" },
  { question: "Qiraat se kya murad hai?", option1: "Quran-e-Kareem padhna", option2: "Tasbeeh padhna", option3: "Dua karna", option4: "Takbeer kehna", correctAnswer: "Quran-e-Kareem padhna", category: "Namaz ke Farz" },
  { question: "Ruku mein kya kiya jata hai?", option1: "Jhuka jata hai", option2: "Baitha jata hai", option3: "Khada raha jata hai", option4: "Salaam phera jata hai", correctAnswer: "Jhuka jata hai", category: "Namaz ke Farz" },
  { question: "Har Rakat mein kitne Sajde Farz hain?", option1: "1", option2: "2", option3: "3", option4: "4", correctAnswer: "2", category: "Namaz ke Farz" },
  { question: "Qa'dah Akhirah kis Rakat ke baad hota hai?", option1: "Aakhri Rakat ke baad", option2: "Pehli Rakat ke baad", option3: "Doosri Rakat ke baad", option4: "Teesri Rakat ke baad", correctAnswer: "Aakhri Rakat ke baad", category: "Namaz ke Farz" },
  { question: "Khurooj bi Sun'ihi se kya murad hai?", option1: "Salaam ke saath Namaz se nikalna", option2: "Masjid se nikalna", option3: "Wudu karna", option4: "Takbeer kehna", correctAnswer: "Salaam ke saath Namaz se nikalna", category: "Namaz ke Farz" },
  { question: "Agar Namaz ka ek Farz chhoot jaye to Namaz ka kya hukm hai?", option1: "Namaz fasid ho jayegi", option2: "Sirf Sajda Sahw hoga", option3: "Namaz mukammal hogi", option4: "Koi farq nahi padega", correctAnswer: "Namaz fasid ho jayegi", category: "Namaz ke Farz" },
  { question: "Namaz ke Farz kis ilm ka hissa hain?", option1: "Fiqh", option2: "Nahw", option3: "Sarf", option4: "Balaghat", correctAnswer: "Fiqh", category: "Namaz ke Farz" },
  { question: "Qiyam kis surat mein Farz hota hai?", option1: "Farz Namaz mein qudrat hone par", option2: "Har Nafl Namaz mein", option3: "Sirf Eid ki Namaz mein", option4: "Kabhi nahi", correctAnswer: "Farz Namaz mein qudrat hone par", category: "Namaz ke Farz" },
  { question: "Qiraat kis Rakat mein Farz hoti hai?", option1: "Kam az kam ek Rakat mein", option2: "Sirf Aakhri Rakat mein", option3: "Har Sajde mein", option4: "Sirf Witr mein", correctAnswer: "Kam az kam ek Rakat mein", category: "Namaz ke Farz" },
  { question: "Namaz ke Farz kis kitab ke bab mein padhaye jate hain?", option1: "Kitab-us-Salah", option2: "Kitab-us-Saum", option3: "Kitab-ul-Hajj", option4: "Kitab-uz-Zakat", correctAnswer: "Kitab-us-Salah", category: "Namaz ke Farz" },
  { question: "Sajdah Namaz ka kya hai?", option1: "Farz", option2: "Sunnat", option3: "Mustahab", option4: "Makruh", correctAnswer: "Farz", category: "Namaz ke Farz" },
  { question: "Namaz ke tamam Farz ada karna kaisa hai?", option1: "Zaroori", option2: "Mustahab", option3: "Makruh", option4: "Mubah", correctAnswer: "Zaroori", category: "Namaz ke Farz" },

  // Namaz ke Wajibat
  { question: "Namaz mein Wajib chhoot jaye to kya karna hota hai?", option1: "Sajda Sahw", option2: "Namaz dobara", option3: "Kuch nahi", option4: "Wudu", correctAnswer: "Sajda Sahw", category: "Namaz ke Wajibat" },
  { question: "Surah Fatiha padhna kis hukm mein hai?", option1: "Farz", option2: "Wajib", option3: "Sunnat", option4: "Mustahab", correctAnswer: "Wajib", category: "Namaz ke Wajibat" },
  { question: "Surah Fatiha ke baad Surah milana kis Namaz mein Wajib hai?", option1: "Farz ki pehli do Rak'at aur tamam Sunnat, Nafl aur Witr mein", option2: "Sirf Nafl mein", option3: "Sirf Witr mein", option4: "Kisi mein nahi", correctAnswer: "Farz ki pehli do Rak'at aur tamam Sunnat, Nafl aur Witr mein", category: "Namaz ke Wajibat" },
  { question: "Ruku aur Sajde ko itminan se ada karna kya hai?", option1: "Farz", option2: "Wajib", option3: "Mustahab", option4: "Makruh", correctAnswer: "Wajib", category: "Namaz ke Wajibat" },
  { question: "Qa'dah Ula mein Tashahhud padhna kya hai?", option1: "Farz", option2: "Wajib", option3: "Sunnat", option4: "Mustahab", correctAnswer: "Wajib", category: "Namaz ke Wajibat" },
  { question: "Qa'dah Ula ke baad foran khade hona kya hai?", option1: "Wajib", option2: "Farz", option3: "Makruh", option4: "Mustahab", correctAnswer: "Wajib", category: "Namaz ke Wajibat" },
  { question: "Witr ki Namaz mein Dua-e-Qunoot padhna kya hai?", option1: "Farz", option2: "Wajib", option3: "Sunnat", option4: "Mustahab", correctAnswer: "Wajib", category: "Namaz ke Wajibat" },
  { question: "Dua-e-Qunoot se pehle kaunsi Takbeer kahi jati hai?", option1: "Takbeer-e-Qunoot", option2: "Takbeer-e-Tahrimah", option3: "Takbeer-e-Eid", option4: "Takbeer-e-Tashreeq", correctAnswer: "Takbeer-e-Qunoot", category: "Namaz ke Wajibat" },
  { question: "Har Farz aur Wajib ko uski jagah par ada karna kya hai?", option1: "Wajib", option2: "Sunnat", option3: "Mustahab", option4: "Makruh", correctAnswer: "Wajib", category: "Namaz ke Wajibat" },
  { question: "Do Farzon ke darmiyan Wajib ko chhodna kaisa hai?", option1: "Jaiz", option2: "Na-Jaiz", option3: "Mustahab", option4: "Mubah", correctAnswer: "Na-Jaiz", category: "Namaz ke Wajibat" },
  { question: "Agar Wajib bhool kar chhoot jaye to kya kiya jata hai?", option1: "Sajda Sahw", option2: "Namaz tod di jati hai", option3: "Sirf Astaghfar", option4: "Kuch nahi", correctAnswer: "Sajda Sahw", category: "Namaz ke Wajibat" },
  { question: "Agar Wajib jaan-boojh kar chhod diya jaye to kya hukm hai?", option1: "Namaz ka i'adah (dobara padhna) wajib hota hai", option2: "Sirf Sajda Sahw", option3: "Koi farq nahi", option4: "Roza rakhna hoga", correctAnswer: "Namaz ka i'adah (dobara padhna) wajib hota hai", category: "Namaz ke Wajibat" },
  { question: "Qa'dah Akhirah mein Tashahhud padhna kya hai?", option1: "Wajib", option2: "Farz", option3: "Mustahab", option4: "Makruh", correctAnswer: "Wajib", category: "Namaz ke Wajibat" },
  { question: "Namaz ke Wajibat kis ilm ka hissa hain?", option1: "Fiqh", option2: "Tajweed", option3: "Nahw", option4: "Balaghat", correctAnswer: "Fiqh", category: "Namaz ke Wajibat" },
  { question: "Namaz ke Wajibat kis bab mein padhaye jate hain?", option1: "Kitab-us-Salah", option2: "Kitab-us-Saum", option3: "Kitab-ul-Hajj", option4: "Kitab-uz-Zakat", correctAnswer: "Kitab-us-Salah", category: "Namaz ke Wajibat" },
  { question: "Namaz mein ta'deel-e-arkan ka kya hukm hai?", option1: "Wajib", option2: "Farz", option3: "Sunnat", option4: "Mustahab", correctAnswer: "Wajib", category: "Namaz ke Wajibat" },
  { question: "Jahri Namazon mein Imam ka buland awaaz se Qiraat karna kya hai?", option1: "Wajib", option2: "Farz", option3: "Mustahab", option4: "Makruh", correctAnswer: "Wajib", category: "Namaz ke Wajibat" },
  { question: "Sirri Namazon mein Imam ka ahista Qiraat karna kya hai?", option1: "Wajib", option2: "Farz", option3: "Sunnat", option4: "Mustahab", correctAnswer: "Wajib", category: "Namaz ke Wajibat" },
  { question: "Namaz mein Wajib ki ahmiyat kya hai?", option1: "Iska ehtimam zaroori hai", option2: "Isay chhodna aasaan hai", option3: "Iski koi ahmiyat nahi", option4: "Sirf Imam ke liye hai", correctAnswer: "Iska ehtimam zaroori hai", category: "Namaz ke Wajibat" },
  { question: "Namaz ke Wajibat poore karna kaisa hai?", option1: "Zaroori", option2: "Ikhtiyari", option3: "Makruh", option4: "Sirf Nafl mein", correctAnswer: "Zaroori", category: "Namaz ke Wajibat" },

  // Namaz ki Sunnatein
  { question: "Namaz shuru karte waqt haath uthana kya hai?", option1: "Farz", option2: "Wajib", option3: "Sunnat", option4: "Makruh", correctAnswer: "Sunnat", category: "Namaz ki Sunnatein" },
  { question: "Takbeer-e-Tahrimah ke baad haath kahan baandhna Sunnat hai?", option1: "Naaf ke neeche", option2: "Seene par", option3: "Peeth ke piche", option4: "Khule rakhna", correctAnswer: "Naaf ke neeche", category: "Namaz ki Sunnatein" },
  { question: "Sana (Subhanakallahumma...) padhna kya hai?", option1: "Farz", option2: "Wajib", option3: "Sunnat", option4: "Makruh", correctAnswer: "Sunnat", category: "Namaz ki Sunnatein" },
  { question: "Ta'awwuz (A'uzu billahi...) padhna kya hai?", option1: "Farz", option2: "Sunnat", option3: "Wajib", option4: "Makruh", correctAnswer: "Sunnat", category: "Namaz ki Sunnatein" },
  { question: "Tasmiyah (Bismillahir Rahmanir Rahim) padhna kya hai?", option1: "Farz", option2: "Wajib", option3: "Sunnat", option4: "Makruh", correctAnswer: "Sunnat", category: "Namaz ki Sunnatein" },
  { question: "Ruku mein kam az kam teen martaba \"Subhana Rabbiyal Azeem\" padhna kya hai?", option1: "Farz", option2: "Sunnat", option3: "Makruh", option4: "Wajib", correctAnswer: "Sunnat", category: "Namaz ki Sunnatein" },
  { question: "Sajde mein kam az kam teen martaba \"Subhana Rabbiyal A'la\" padhna kya hai?", option1: "Farz", option2: "Sunnat", option3: "Wajib", option4: "Makruh", correctAnswer: "Sunnat", category: "Namaz ki Sunnatein" },
  { question: "Ruku se uthte waqt Imam aur Munfarid kya padhte hain?", option1: "Sami'Allahu liman hamidah", option2: "Subhanallah", option3: "Allahu Akbar", option4: "Astaghfirullah", correctAnswer: "Sami'Allahu liman hamidah", category: "Namaz ki Sunnatein" },
  { question: "Ruku se uthkar kya padhna Sunnat hai?", option1: "Rabbana lakal hamd", option2: "Subhanallah", option3: "La ilaha illallah", option4: "Hasbunallah", correctAnswer: "Rabbana lakal hamd", category: "Namaz ki Sunnatein" },
  { question: "Har rukn mein itminan se rukna kya hai?", option1: "Sunnat", option2: "Farz", option3: "Makruh", option4: "Mustahab", correctAnswer: "Sunnat", category: "Namaz ki Sunnatein" },
  { question: "Qa'dah mein Attahiyyat ke baad Durood Shareef padhna kya hai?", option1: "Sunnat", option2: "Farz", option3: "Makruh", option4: "Wajib", correctAnswer: "Sunnat", category: "Namaz ki Sunnatein" },
  { question: "Durood Shareef ke baad Dua padhna kya hai?", option1: "Farz", option2: "Sunnat", option3: "Makruh", option4: "Wajib", correctAnswer: "Sunnat", category: "Namaz ki Sunnatein" },
  { question: "Salaam pehle kis taraf pherna Sunnat hai?", option1: "Daayi taraf", option2: "Baayi taraf", option3: "Samne", option4: "Peeche", correctAnswer: "Daayi taraf", category: "Namaz ki Sunnatein" },
  { question: "Doosra Salaam kis taraf pherna Sunnat hai?", option1: "Baayi taraf", option2: "Daayi taraf", option3: "Samne", option4: "Neeche", correctAnswer: "Baayi taraf", category: "Namaz ki Sunnatein" },
  { question: "Takbeer ke waqt ungliyan kis halat mein rakhna Sunnat hai?", option1: "Apni mamooli halat mein", option2: "Band kar lena", option3: "Muthi banana", option4: "Ungliyan chhupa lena", correctAnswer: "Apni mamooli halat mein", category: "Namaz ki Sunnatein" },
  { question: "Qa'dah mein Shahadat ki ungli se ishara karna kya hai?", option1: "Sunnat", option2: "Farz", option3: "Makruh", option4: "Wajib", correctAnswer: "Sunnat", category: "Namaz ki Sunnatein" },
  { question: "Namaz mein nazar kahan rakhna Sunnat hai jab Qiyam mein khade hon?", option1: "Sajde ki jagah", option2: "Aasmaan ki taraf", option3: "Daaye taraf", option4: "Baaye taraf", correctAnswer: "Sajde ki jagah", category: "Namaz ki Sunnatein" },
  { question: "Namaz ki Sunnatein kis ilm ka hissa hain?", option1: "Fiqh", option2: "Nahw", option3: "Balaghat", option4: "Tafseer", correctAnswer: "Fiqh", category: "Namaz ki Sunnatein" },
  { question: "Namaz ki Sunnatein kis bab mein padhayi jati hain?", option1: "Kitab-us-Salah", option2: "Kitab-us-Saum", option3: "Kitab-ul-Hajj", option4: "Kitab-uz-Zakat", correctAnswer: "Kitab-us-Salah", category: "Namaz ki Sunnatein" },
  { question: "Namaz ki Sunnaton ka ehtimam karna kaisa hai?", option1: "Sawab ka sabab hai", option2: "Makruh hai", option3: "Na-Jaiz hai", option4: "Koi ahmiyat nahi", correctAnswer: "Sawab ka sabab hai", category: "Namaz ki Sunnatein" },

  // Namaz ke Makruhat
  { question: "Namaz mein bila zarurat idhar-udhar dekhna kya hai?", option1: "Farz", option2: "Makruh", option3: "Sunnat", option4: "Mustahab", correctAnswer: "Makruh", category: "Namaz ke Makruhat" },
  { question: "Namaz mein kapdon se khelna kaisa hai?", option1: "Mustahab", option2: "Makruh", option3: "Farz", option4: "Wajib", correctAnswer: "Makruh", category: "Namaz ke Makruhat" },
  { question: "Namaz mein ungliyan chatkana kaisa hai?", option1: "Sunnat", option2: "Makruh", option3: "Mustahab", option4: "Farz", correctAnswer: "Makruh", category: "Namaz ke Makruhat" },
  { question: "Namaz mein kamar par haath rakhna kaisa hai?", option1: "Makruh", option2: "Sunnat", option3: "Farz", option4: "Mustahab", correctAnswer: "Makruh", category: "Namaz ke Makruhat" },
  { question: "Namaz mein jamhai aaye to kya karna chahiye?", option1: "Munh ko haath se dhakna", option2: "Zor se jamhai lena", option3: "Namaz tod dena", option4: "Baatein karna", correctAnswer: "Munh ko haath se dhakna", category: "Namaz ke Makruhat" },
  { question: "Namaz mein aankhen band rakhna bila wajah kaisa hai?", option1: "Sunnat", option2: "Makruh", option3: "Farz", option4: "Wajib", correctAnswer: "Makruh", category: "Namaz ke Makruhat" },
  { question: "Namaz mein aasman ki taraf dekhna kaisa hai?", option1: "Mustahab", option2: "Makruh", option3: "Farz", option4: "Sunnat", correctAnswer: "Makruh", category: "Namaz ke Makruhat" },
  { question: "Namaz mein baal ya kapde sametna kaisa hai?", option1: "Makruh", option2: "Sunnat", option3: "Farz", option4: "Mustahab", correctAnswer: "Makruh", category: "Namaz ke Makruhat" },
  { question: "Namaz mein bila zarurat ek paon se doosre paon par bojh dalte rehna kaisa hai?", option1: "Makruh", option2: "Sunnat", option3: "Farz", option4: "Mustahab", correctAnswer: "Makruh", category: "Namaz ke Makruhat" },
  { question: "Namaz mein bila zarurat khankharna kaisa hai?", option1: "Makruh", option2: "Mustahab", option3: "Farz", option4: "Sunnat", correctAnswer: "Makruh", category: "Namaz ke Makruhat" },
  { question: "Namaz mein tasveer ki taraf munh karke Namaz padhna kaisa hai?", option1: "Makruh", option2: "Farz", option3: "Sunnat", option4: "Mustahab", correctAnswer: "Makruh", category: "Namaz ke Makruhat" },
  { question: "Namaz mein bila zarurat angdai lena kaisa hai?", option1: "Makruh", option2: "Farz", option3: "Mustahab", option4: "Sunnat", correctAnswer: "Makruh", category: "Namaz ke Makruhat" },
  { question: "Namaz mein nazar idhar-udhar ghumana kaisa hai?", option1: "Makruh", option2: "Sunnat", option3: "Mustahab", option4: "Farz", correctAnswer: "Makruh", category: "Namaz ke Makruhat" },
  { question: "Namaz mein bila zarurat baar-baar kapda theek karna kaisa hai?", option1: "Makruh", option2: "Farz", option3: "Sunnat", option4: "Mustahab", correctAnswer: "Makruh", category: "Namaz ke Makruhat" },
  { question: "Namaz mein bila zarurat jism ko harkat dena kaisa hai?", option1: "Makruh", option2: "Farz", option3: "Mustahab", option4: "Sunnat", correctAnswer: "Makruh", category: "Namaz ke Makruhat" },
  { question: "Namaz ke Makruhat kis ilm ka hissa hain?", option1: "Fiqh", option2: "Nahw", option3: "Sarf", option4: "Balaghat", correctAnswer: "Fiqh", category: "Namaz ke Makruhat" },
  { question: "Namaz ke Makruhat kis bab mein padhaye jate hain?", option1: "Kitab-us-Salah", option2: "Kitab-us-Saum", option3: "Kitab-ul-Hajj", option4: "Kitab-uz-Zakat", correctAnswer: "Kitab-us-Salah", category: "Namaz ke Makruhat" },
  { question: "Makruh ka asar Namaz par kya hota hai?", option1: "Namaz ka sawab kam ho jata hai", option2: "Namaz toot jati hai", option3: "Wudu toot jata hai", option4: "Roza toot jata hai", correctAnswer: "Namaz ka sawab kam ho jata hai", category: "Namaz ke Makruhat" },
  { question: "Makruhat se bachna kaisa hai?", option1: "Behtar aur Sunnat ke mutabiq", option2: "Zaroori nahi", option3: "Makruh", option4: "Na-Jaiz", correctAnswer: "Behtar aur Sunnat ke mutabiq", category: "Namaz ke Makruhat" },
  { question: "Namaz ko khushu' aur khuzu' ke saath ada karna kaisa hai?", option1: "Pasandeedah aur Sunnat ke mutabiq", option2: "Makruh", option3: "Na-Jaiz", option4: "Sirf Nafl mein", correctAnswer: "Pasandeedah aur Sunnat ke mutabiq", category: "Namaz ke Makruhat" }
];

async function seed() {
  console.log(`Starting to seed ${QUIZ_DATA.length} quiz questions...`);
  
  const quizzesRef = db.collection('quizzes');
  let inserted = 0;
  let skipped = 0;
  const categories = {};
  
  const snapshot = await quizzesRef.get();
  const existingQuestions = new Set();
  
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.question) {
      existingQuestions.add(data.question.trim());
    }
  });

  const batches = [];
  let currentBatch = db.batch();
  let operationCount = 0;

  for (const item of QUIZ_DATA) {
    if (existingQuestions.has(item.question.trim())) {
      skipped++;
      continue;
    }
    
    // Ensure correctAnswer strictly matches one option
    const opts = [item.option1, item.option2, item.option3, item.option4];
    if (!opts.includes(item.correctAnswer)) {
      console.error(`Invalid correct answer for question: "${item.question}"`);
      console.error(`Options: ${opts.join(', ')} | Correct Answer: ${item.correctAnswer}`);
      process.exit(1);
    }
    
    const docRef = quizzesRef.doc();
    currentBatch.set(docRef, item);
    inserted++;
    
    if (!categories[item.category]) categories[item.category] = 0;
    categories[item.category]++;

    operationCount++;
    if (operationCount === 400) {
      batches.push(currentBatch);
      currentBatch = db.batch();
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    batches.push(currentBatch);
  }

  for (let i = 0; i < batches.length; i++) {
    await batches[i].commit();
    console.log(`Committed batch ${i + 1} / ${batches.length}`);
  }
  
  const finalSnap = await quizzesRef.get();
  
  console.log('--- SEEDING COMPLETE ---');
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped (Duplicates): ${skipped}`);
  console.log('Category Counts Inserted:', categories);
  console.log(`Final Total Count in DB: ${finalSnap.size}`);
}

seed().catch(err => {
  console.error("Failed to seed:", err);
  process.exit(1);
});
