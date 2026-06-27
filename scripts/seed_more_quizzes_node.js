const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const serviceAccountPath = '../backend/serviceAccountKey.json';
const rawData = fs.readFileSync(serviceAccountPath, 'utf8');
const serviceAccount = JSON.parse(rawData);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const QUIZ_DATA = [
  // Najasat
  { question: "Najasat kitni qisam ki hoti hai?", option1: "1", option2: "2", option3: "3", option4: "4", correctAnswer: "2", category: "Najasat" },
  { question: "Najasat ki do qisamein kaun si hain?", option1: "Ghaleezah aur Khafeefah", option2: "Kubra aur Sughra", option3: "Sunnat aur Farz", option4: "Paak aur Napaak", correctAnswer: "Ghaleezah aur Khafeefah", category: "Najasat" },
  { question: "Insaan ka peshab kis qisam ki najasat hai?", option1: "Najasat-e-Khafeefah", option2: "Najasat-e-Ghaleezah", option3: "Paak", option4: "Makruh", correctAnswer: "Najasat-e-Ghaleezah", category: "Najasat" },
  { question: "Insaan ka pakhana kis qisam ki najasat hai?", option1: "Najasat-e-Khafeefah", option2: "Najasat-e-Ghaleezah", option3: "Paak", option4: "Mubah", correctAnswer: "Najasat-e-Ghaleezah", category: "Najasat" },
  { question: "Bahne wala khoon kis qisam ki najasat hai?", option1: "Paak", option2: "Najasat-e-Ghaleezah", option3: "Najasat-e-Khafeefah", option4: "Mustahab", correctAnswer: "Najasat-e-Ghaleezah", category: "Najasat" },
  { question: "Sharaab ka hukm kya hai?", option1: "Paak", option2: "Najasat-e-Ghaleezah", option3: "Najasat-e-Khafeefah", option4: "Jaiz", correctAnswer: "Najasat-e-Ghaleezah", category: "Najasat" },
  { question: "Kutta kis hukm mein hai?", option1: "Paak", option2: "Napaak", option3: "Makruh", option4: "Mustahab", correctAnswer: "Napaak", category: "Najasat" },
  { question: "Suar kis hukm mein hai?", option1: "Paak", option2: "Napaak-ul-Ain", option3: "Makruh", option4: "Mustahab", correctAnswer: "Napaak-ul-Ain", category: "Najasat" },
  { question: "Kapde par Najasat lag jaye to kya karna chahiye?", option1: "Namaz padh leni chahiye", option2: "Use paak karna chahiye", option3: "Nazarandaz karna chahiye", option4: "Kapda phenk dena chahiye", correctAnswer: "Use paak karna chahiye", category: "Najasat" },
  { question: "Paak paani ka istemal kis liye kiya jata hai?", option1: "Najasat door karne ke liye", option2: "Sirf peene ke liye", option3: "Sirf Wudu ke liye", option4: "Sirf Ghusl ke liye", correctAnswer: "Najasat door karne ke liye", category: "Najasat" },
  { question: "Jis cheez par najasat ho uska kya hukm hai?", option1: "Paak", option2: "Napaak", option3: "Makruh", option4: "Mustahab", correctAnswer: "Napaak", category: "Najasat" },
  { question: "Najasat door karne ke liye sabse behtar cheez kya hai?", option1: "Paak Paani", option2: "Tel", option3: "Doodh", option4: "Sharbat", correctAnswer: "Paak Paani", category: "Najasat" },
  { question: "Najasat se paaki hasil karna kis ibadat ke liye zaroori hai?", option1: "Namaz", option2: "Roza", option3: "Zakat", option4: "Hajj", correctAnswer: "Namaz", category: "Najasat" },
  { question: "Jis jagah najasat lagi ho us jagah Namaz padhna kaisa hai?", option1: "Jaiz", option2: "Na-Jaiz", option3: "Mustahab", option4: "Mubah", correctAnswer: "Na-Jaiz", category: "Najasat" },
  { question: "Najasat-e-Ghaleezah ka hukm kis se zyada sakht hai?", option1: "Najasat-e-Khafeefah", option2: "Paak cheezon se", option3: "Paani se", option4: "Hawa se", correctAnswer: "Najasat-e-Khafeefah", category: "Najasat" },
  { question: "Najasat-e-Khafeefah ka hukm Najasat-e-Ghaleezah ke muqable mein kaisa hai?", option1: "Halka", option2: "Sakht", option3: "Barabar", option4: "Koi farq nahi", correctAnswer: "Halka", category: "Najasat" },
  { question: "Paaki aur Napaaki ke ahkam kis ilm ka hissa hain?", option1: "Tajweed", option2: "Fiqh", option3: "Tafseer", option4: "Hadith", correctAnswer: "Fiqh", category: "Najasat" },
  { question: "Najasat se paaki hasil karna kis cheez ki shart hai?", option1: "Namaz", option2: "Nikah", option3: "Qurbani", option4: "Safar", correctAnswer: "Namaz", category: "Najasat" },
  { question: "Agar kapde se najasat door ho jaye to kapda kaisa ho jata hai?", option1: "Paak", option2: "Napaak", option3: "Makruh", option4: "Mubah", correctAnswer: "Paak", category: "Najasat" },
  { question: "Taharat aur Najasat ke masail kis ilm mein padhaye jate hain?", option1: "Fiqh", option2: "Nahw", option3: "Sarf", option4: "Balaghat", correctAnswer: "Fiqh", category: "Najasat" },

  // Istinja
  { question: "Istinja ka kya matlab hai?", option1: "Kapde dhona", option2: "Najasat ko paak karna", option3: "Wudu karna", option4: "Ghusl karna", correctAnswer: "Najasat ko paak karna", category: "Istinja" },
  { question: "Istinja kis ke baad kiya jata hai?", option1: "Namaz ke baad", option2: "Peshaab ya Pakhana ke baad", option3: "Roza kholne ke baad", option4: "Azaan ke baad", correctAnswer: "Peshaab ya Pakhana ke baad", category: "Istinja" },
  { question: "Istinja ke liye sabse afzal cheez kya hai?", option1: "Paak Paani", option2: "Kapda", option3: "Kaghaz", option4: "Mitti", correctAnswer: "Paak Paani", category: "Istinja" },
  { question: "Agar paani na ho to Istinja kis se kiya ja sakta hai?", option1: "Paak Kankar ya Tissue", option2: "Sheesha", option3: "Loha", option4: "Roti", correctAnswer: "Paak Kankar ya Tissue", category: "Istinja" },
  { question: "Istinja karte waqt Qiblah ki taraf munh karna kaisa hai?", option1: "Jaiz", option2: "Makruh", option3: "Farz", option4: "Mustahab", correctAnswer: "Makruh", category: "Istinja" },
  { question: "Istinja ke baad kya hasil hoti hai?", option1: "Taharat", option2: "Roza", option3: "Zakat", option4: "Hajj", correctAnswer: "Taharat", category: "Istinja" },
  { question: "Istinja kis haath se karna Sunnat hai?", option1: "Daaya Haath", option2: "Baaya Haath", option3: "Dono Haath", option4: "Kisi bhi Haath se", correctAnswer: "Baaya Haath", category: "Istinja" },
  { question: "Khana khane ke liye kaunsa haath Sunnat hai?", option1: "Baaya Haath", option2: "Daaya Haath", option3: "Dono Haath", option4: "Koi bhi", correctAnswer: "Daaya Haath", category: "Istinja" },
  { question: "Istinja ke baad haath dhona kaisa hai?", option1: "Sunnat", option2: "Makruh", option3: "Haram", option4: "Na-Jaiz", correctAnswer: "Sunnat", category: "Istinja" },
  { question: "Najasat baqi reh jaye to kya Istinja mukammal hoga?", option1: "Haan", option2: "Nahi", option3: "Kabhi Kabhi", option4: "Sirf Safar mein", correctAnswer: "Nahi", category: "Istinja" },
  { question: "Istinja ka maqsad kya hai?", option1: "Najasat door karna", option2: "Wudu todna", option3: "Roza rakhna", option4: "Safar karna", correctAnswer: "Najasat door karna", category: "Istinja" },
  { question: "Istinja ke baad Wudu karna kab zaroori hota hai?", option1: "Jab Wudu toot chuka ho", option2: "Kabhi nahi", option3: "Sirf Jummah ko", option4: "Sirf Eid par", correctAnswer: "Jab Wudu toot chuka ho", category: "Istinja" },
  { question: "Istinja ke liye paak paani hona kaisa hai?", option1: "Shart", option2: "Makruh", option3: "Mustahab", option4: "Mubah", correctAnswer: "Shart", category: "Istinja" },
  { question: "Istinja ke baad badan aur kapde kis halat mein hone chahiye?", option1: "Paak", option2: "Napaak", option3: "Geele", option4: "Sukhe", correctAnswer: "Paak", category: "Istinja" },
  { question: "Peshaab ke chhinton se bachna kaisa hai?", option1: "Zaroori", option2: "Makruh", option3: "Mustahab", option4: "Mubah", correctAnswer: "Zaroori", category: "Istinja" },
  { question: "Istinja ke baad agar najasat baqi rahe to Namaz ka kya hukm hai?", option1: "Jaiz", option2: "Na-Jaiz", option3: "Mustahab", option4: "Mubah", correctAnswer: "Na-Jaiz", category: "Istinja" },
  { question: "Istinja karna kis ilm ke masail mein shamil hai?", option1: "Fiqh", option2: "Hadith", option3: "Tafseer", option4: "Nahw", correctAnswer: "Fiqh", category: "Istinja" },
  { question: "Istinja ke baad Taharat hasil hone se kaunsi ibadat ada ki ja sakti hai?", option1: "Namaz", option2: "Zakat", option3: "Hajj", option4: "Qurbani", correctAnswer: "Namaz", category: "Istinja" },
  { question: "Istinja ke liye istemal hone wala paani kaisa hona chahiye?", option1: "Paak", option2: "Napaak", option3: "Meetha hi ho", option4: "Garam hi ho", correctAnswer: "Paak", category: "Istinja" },
  { question: "Istinja ka hukm kis maqsad ke liye hai?", option1: "Taharat hasil karne ke liye", option2: "Safar ke liye", option3: "Roza ke liye", option4: "Zakat ke liye", correctAnswer: "Taharat hasil karne ke liye", category: "Istinja" },

  // Haiz
  { question: "Haiz kise kehte hain?", option1: "Bimari ka Khoon", option2: "Baligh aurat ka fitri khoon jo makhsoos auqat mein aaye", option3: "Zakhm ka Khoon", option4: "Naak ka Khoon", correctAnswer: "Baligh aurat ka fitri khoon jo makhsoos auqat mein aaye", category: "Haiz" },
  { question: "Haiz sirf kis ko aata hai?", option1: "Mard", option2: "Baligh Aurat", option3: "Bachcha", option4: "Har Insaan", correctAnswer: "Baligh Aurat", category: "Haiz" },
  { question: "Haiz ki halat mein Namaz ka kya hukm hai?", option1: "Farz hai", option2: "Na-Jaiz hai", option3: "Mustahab hai", option4: "Makruh hai", correctAnswer: "Na-Jaiz hai", category: "Haiz" },
  { question: "Haiz ki halat mein Roza rakhna kaisa hai?", option1: "Jaiz", option2: "Na-Jaiz", option3: "Mustahab", option4: "Farz", correctAnswer: "Na-Jaiz", category: "Haiz" },
  { question: "Haiz khatam hone ke baad kya farz hota hai?", option1: "Wudu", option2: "Ghusl", option3: "Tayammum", option4: "Kuch nahi", correctAnswer: "Ghusl", category: "Haiz" },
  { question: "Haiz ki halat mein Quran-e-Kareem ko chhoona kaisa hai?", option1: "Jaiz", option2: "Na-Jaiz", option3: "Mustahab", option4: "Sunnat", correctAnswer: "Na-Jaiz", category: "Haiz" },
  { question: "Haiz ki halat mein Tawaf karna kaisa hai?", option1: "Jaiz", option2: "Na-Jaiz", option3: "Mustahab", option4: "Mubah", correctAnswer: "Na-Jaiz", category: "Haiz" },
  { question: "Haiz kis ilm ke masail mein shamil hai?", option1: "Tafseer", option2: "Fiqh", option3: "Nahw", option4: "Hadith", correctAnswer: "Fiqh", category: "Haiz" },
  { question: "Haiz ki halat mein Masjid mein theharna kaisa hai?", option1: "Jaiz", option2: "Na-Jaiz", option3: "Mustahab", option4: "Farz", correctAnswer: "Na-Jaiz", category: "Haiz" },
  { question: "Haiz khatam hone ke baad ibadat se pehle kya zaroori hai?", option1: "Sirf Wudu", option2: "Ghusl", option3: "Kuch nahi", option4: "Sirf Dua", correctAnswer: "Ghusl", category: "Haiz" },
  { question: "Haiz ki halat mein Roze ka kya hukm hai?", option1: "Baad mein Qaza karna hogi", option2: "Kaffarah dena hoga", option3: "Roza poora hoga", option4: "Kuch nahi", correctAnswer: "Baad mein Qaza karna hogi", category: "Haiz" },
  { question: "Haiz ki halat mein chhuti hui Namazon ka kya hukm hai?", option1: "Qaza karni hogi", option2: "Qaza nahi hai", option3: "Kaffarah hai", option4: "Sadqah dena hoga", correctAnswer: "Qaza nahi hai", category: "Haiz" },
  { question: "Haiz ke baad Ghusl kis liye zaroori hai?", option1: "Taharat hasil karne ke liye", option2: "Safar ke liye", option3: "Nikah ke liye", option4: "Khana khane ke liye", correctAnswer: "Taharat hasil karne ke liye", category: "Haiz" },
  { question: "Haiz ki halat mein Namaz kyun nahi padhi jati?", option1: "Shari'at ka Hukm", option2: "Thakan ki wajah se", option3: "Paani ki kami ki wajah se", option4: "Safar ki wajah se", correctAnswer: "Shari'at ka Hukm", category: "Haiz" },
  { question: "Haiz ke masail kis kitab ke bab mein padhaye jate hain?", option1: "Kitab-ut-Taharah", option2: "Kitab-us-Salah", option3: "Kitab-ul-Buyu", option4: "Kitab-ul-Hajj", correctAnswer: "Kitab-ut-Taharah", category: "Haiz" },
  { question: "Haiz khatam hone ke baad pehli ibadat kya ho sakti hai?", option1: "Namaz", option2: "Zakat", option3: "Qurbani", option4: "Safar", correctAnswer: "Namaz", category: "Haiz" },
  { question: "Haiz ki halat mein Quran ki tilawat ka kya hukm hai?", option1: "Jaiz", option2: "Na-Jaiz", option3: "Mustahab", option4: "Farz", correctAnswer: "Na-Jaiz", category: "Haiz" },
  { question: "Haiz kis qisam ka khoon hai?", option1: "Fitri Khoon", option2: "Zakhm ka Khoon", option3: "Naak ka Khoon", option4: "Bimari ka Khoon", correctAnswer: "Fitri Khoon", category: "Haiz" },
  { question: "Haiz ke baad Taharat hasil karne ke liye kya zaroori hai?", option1: "Ghusl", option2: "Sirf Wudu", option3: "Tayammum", option4: "Kuch nahi", correctAnswer: "Ghusl", category: "Haiz" },
  { question: "Haiz ke ahkam kis ilm ka hissa hain?", option1: "Fiqh", option2: "Tajweed", option3: "Nahw", option4: "Balaghat", correctAnswer: "Fiqh", category: "Haiz" },

  // Nifas
  { question: "Nifas kise kehte hain?", option1: "Haiz ke khoon ko", option2: "Bachche ki wiladat ke baad aane wale khoon ko", option3: "Zakhm ke khoon ko", option4: "Naak ke khoon ko", correctAnswer: "Bachche ki wiladat ke baad aane wale khoon ko", category: "Nifas" },
  { question: "Nifas kis ke baad hota hai?", option1: "Nikah ke baad", option2: "Wiladat ke baad", option3: "Safar ke baad", option4: "Roza ke baad", correctAnswer: "Wiladat ke baad", category: "Nifas" },
  { question: "Nifas ki halat mein Namaz ka kya hukm hai?", option1: "Farz", option2: "Na-Jaiz", option3: "Mustahab", option4: "Mubah", correctAnswer: "Na-Jaiz", category: "Nifas" },
  { question: "Nifas ki halat mein Roza rakhna kaisa hai?", option1: "Jaiz", option2: "Na-Jaiz", option3: "Mustahab", option4: "Farz", correctAnswer: "Na-Jaiz", category: "Nifas" },
  { question: "Nifas khatam hone ke baad kya farz hota hai?", option1: "Wudu", option2: "Ghusl", option3: "Tayammum", option4: "Kuch nahi", correctAnswer: "Ghusl", category: "Nifas" },
  { question: "Nifas ki halat mein Quran-e-Kareem ko chhoona kaisa hai?", option1: "Jaiz", option2: "Na-Jaiz", option3: "Mustahab", option4: "Sunnat", correctAnswer: "Na-Jaiz", category: "Nifas" },
  { question: "Nifas ki halat mein Quran ki tilawat ka kya hukm hai?", option1: "Jaiz", option2: "Na-Jaiz", option3: "Mustahab", option4: "Farz", correctAnswer: "Na-Jaiz", category: "Nifas" },
  { question: "Nifas ki halat mein Masjid mein theharna kaisa hai?", option1: "Jaiz", option2: "Na-Jaiz", option3: "Mustahab", option4: "Farz", correctAnswer: "Na-Jaiz", category: "Nifas" },
  { question: "Nifas ki halat mein Tawaf karna kaisa hai?", option1: "Jaiz", option2: "Na-Jaiz", option3: "Mustahab", option4: "Mubah", correctAnswer: "Na-Jaiz", category: "Nifas" },
  { question: "Nifas ke baad ibadat se pehle kya zaroori hai?", option1: "Sirf Wudu", option2: "Ghusl", option3: "Kuch nahi", option4: "Sirf Dua", correctAnswer: "Ghusl", category: "Nifas" },
  { question: "Nifas ki halat mein chhute hue Rozon ka kya hukm hai?", option1: "Baad mein Qaza karna hogi", option2: "Koi Qaza nahi", option3: "Kaffarah dena hoga", option4: "Sadqah dena hoga", correctAnswer: "Baad mein Qaza karna hogi", category: "Nifas" },
  { question: "Nifas ki halat mein chhuti hui Namazon ka kya hukm hai?", option1: "Qaza karni hogi", option2: "Qaza nahi hai", option3: "Kaffarah dena hoga", option4: "Sadqah dena hoga", correctAnswer: "Qaza nahi hai", category: "Nifas" },
  { question: "Nifas kis ilm ke masail mein shamil hai?", option1: "Fiqh", option2: "Tafseer", option3: "Nahw", option4: "Balaghat", correctAnswer: "Fiqh", category: "Nifas" },
  { question: "Nifas ke baad Taharat hasil karne ke liye kya zaroori hai?", option1: "Ghusl", option2: "Sirf Wudu", option3: "Tayammum", option4: "Kuch nahi", correctAnswer: "Ghusl", category: "Nifas" },
  { question: "Nifas kis qisam ka khoon hai?", option1: "Wiladat ke baad ka fitri khoon", option2: "Zakhm ka khoon", option3: "Naak ka khoon", option4: "Bimari ka khoon", correctAnswer: "Wiladat ke baad ka fitri khoon", category: "Nifas" },
  { question: "Nifas ke ahkam kis bab mein padhaye jate hain?", option1: "Kitab-ut-Taharah", option2: "Kitab-us-Salah", option3: "Kitab-ul-Hajj", option4: "Kitab-ul-Buyu", correctAnswer: "Kitab-ut-Taharah", category: "Nifas" },
  { question: "Nifas khatam hone ke baad pehli ibadat kya ho sakti hai?", option1: "Namaz", option2: "Zakat", option3: "Qurbani", option4: "Safar", correctAnswer: "Namaz", category: "Nifas" },
  { question: "Nifas ki halat mein Namaz na padhna kis wajah se hai?", option1: "Shari'at ka Hukm", option2: "Kamzori ki wajah se", option3: "Safar ki wajah se", option4: "Paani ki kami ki wajah se", correctAnswer: "Shari'at ka Hukm", category: "Nifas" },
  { question: "Nifas khatam hone ke baad sabse pehle kya hasil karna zaroori hai?", option1: "Taharat", option2: "Safar", option3: "Tijarat", option4: "Aaram", correctAnswer: "Taharat", category: "Nifas" },
  { question: "Nifas ke ahkam kis ilm ka hissa hain?", option1: "Fiqh", option2: "Tajweed", option3: "Nahw", option4: "Sarf", correctAnswer: "Fiqh", category: "Nifas" },

  // Istihaza
  { question: "Istihaza kise kehte hain?", option1: "Haiz ke khoon ko", option2: "Nifas ke khoon ko", option3: "Haiz aur Nifas ke alawa aane wale khoon ko", option4: "Zakhm ke khoon ko", correctAnswer: "Haiz aur Nifas ke alawa aane wale khoon ko", category: "Istihaza" },
  { question: "Istihaza ka khoon kis hukm mein hota hai?", option1: "Haiz ka hukm", option2: "Nifas ka hukm", option3: "Marz (Uzr) ka hukm", option4: "Taharat ka hukm", correctAnswer: "Marz (Uzr) ka hukm", category: "Istihaza" },
  { question: "Istihaza ki halat mein Namaz ka kya hukm hai?", option1: "Na-Jaiz", option2: "Namaz ada karegi", option3: "Sirf Nafl padhegi", option4: "Sirf Jummah padhegi", correctAnswer: "Namaz ada karegi", category: "Istihaza" },
  { question: "Istihaza ki halat mein Roza ka kya hukm hai?", option1: "Roza nahi rakh sakti", option2: "Roza rakh sakti hai", option3: "Sirf Nafl Roza", option4: "Sirf Ramzan ke baad", correctAnswer: "Roza rakh sakti hai", category: "Istihaza" },
  { question: "Istihaza wali aurat kis hukm mein hoti hai?", option1: "Haiza", option2: "Nufasa", option3: "Ma'zoor ke hukm mein", option4: "Junub", correctAnswer: "Ma'zoor ke hukm mein", category: "Istihaza" },
  { question: "Istihaza ki halat mein Quran-e-Kareem chhoona kaisa hai?", option1: "Na-Jaiz", option2: "Jaiz, agar Wudu ho", option3: "Sirf Dastane ke saath", option4: "Haram", correctAnswer: "Jaiz, agar Wudu ho", category: "Istihaza" },
  { question: "Istihaza ki halat mein Masjid jana kaisa hai?", option1: "Na-Jaiz", option2: "Jaiz", option3: "Makruh", option4: "Sirf Eid ke din", correctAnswer: "Jaiz", category: "Istihaza" },
  { question: "Istihaza ki halat mein Tawaf karna kaisa hai?", option1: "Na-Jaiz", option2: "Jaiz, agar Taharat ke ahkam poore kiye jayen", option3: "Sirf Nafl Tawaf", option4: "Sirf Umrah mein", correctAnswer: "Jaiz, agar Taharat ke ahkam poore kiye jayen", category: "Istihaza" },
  { question: "Istihaza kis ilm ke masail mein shamil hai?", option1: "Fiqh", option2: "Nahw", option3: "Tafseer", option4: "Balaghat", correctAnswer: "Fiqh", category: "Istihaza" },
  { question: "Istihaza wali aurat har Namaz ke waqt kya karti hai?", option1: "Ghusl", option2: "Naya Wudu", option3: "Tayammum", option4: "Kuch nahi", correctAnswer: "Naya Wudu", category: "Istihaza" },
  { question: "Istihaza ka khoon kis ka sabab nahi banta?", option1: "Namaz chhodne ka", option2: "Wudu karne ka", option3: "Uzr ke ahkam ka", option4: "Taharat ki ihtiyat ka", correctAnswer: "Namaz chhodne ka", category: "Istihaza" },
  { question: "Istihaza ki halat mein Shohar aur Biwi ke ta'alluq ka kya hukm hai?", option1: "Na-Jaiz", option2: "Jaiz", option3: "Makruh", option4: "Haram", correctAnswer: "Jaiz", category: "Istihaza" },
  { question: "Istihaza wali aurat ko kis ki pabandi karni chahiye?", option1: "Taharat aur Wudu ke ahkam", option2: "Sirf Ghusl", option3: "Sirf Tayammum", option4: "Koi nahi", correctAnswer: "Taharat aur Wudu ke ahkam", category: "Istihaza" },
  { question: "Istihaza kis bab ke masail mein aata hai?", option1: "Kitab-ut-Taharah", option2: "Kitab-us-Salah", option3: "Kitab-ul-Hajj", option4: "Kitab-ul-Buyu", correctAnswer: "Kitab-ut-Taharah", category: "Istihaza" },
  { question: "Istihaza ki halat mein Roze ka kya hukm hai?", option1: "Qaza zaroori hai", option2: "Roza sahih hai", option3: "Roza toot jata hai", option4: "Roza Makruh hai", correctAnswer: "Roza sahih hai", category: "Istihaza" },
  { question: "Istihaza ki halat mein Namaz ki adaigi ka hukm kya hai?", option1: "Farz Namaz ada karegi", option2: "Namaz nahi padhegi", option3: "Sirf Nafl padhegi", option4: "Sirf Witr padhegi", correctAnswer: "Farz Namaz ada karegi", category: "Istihaza" },
  { question: "Istihaza wali aurat Quran ki tilawat kar sakti hai?", option1: "Nahi", option2: "Haan, Wudu ke saath", option3: "Sirf Ramzan mein", option4: "Sirf Nafl mein", correctAnswer: "Haan, Wudu ke saath", category: "Istihaza" },
  { question: "Istihaza ke ahkam kis ilm ka hissa hain?", option1: "Fiqh", option2: "Tajweed", option3: "Nahw", option4: "Sarf", correctAnswer: "Fiqh", category: "Istihaza" },
  { question: "Istihaza ki halat mein Taharat ka ehtimam karna kaisa hai?", option1: "Zaroori", option2: "Makruh", option3: "Mustahab", option4: "Na-Jaiz", correctAnswer: "Zaroori", category: "Istihaza" },
  { question: "Istihaza wali aurat ko Namaz ke liye kya karna chahiye?", option1: "Har Namaz ke waqt Wudu karna", option2: "Har Namaz ke liye Ghusl karna", option3: "Sirf Tayammum karna", option4: "Kuch bhi nahi", correctAnswer: "Har Namaz ke waqt Wudu karna", category: "Istihaza" }
];

async function seed() {
  console.log(`Starting to seed ${QUIZ_DATA.length} quiz questions...`);
  
  const quizzesRef = db.collection('quizzes');
  let inserted = 0;
  let skipped = 0;
  const categories = {};
  
  // Get all existing quizzes to check for duplicates based on exact question text
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
