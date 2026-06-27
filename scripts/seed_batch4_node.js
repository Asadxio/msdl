const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const serviceAccountPath = '../backend/serviceAccountKey.json';
const rawData = fs.readFileSync(serviceAccountPath, 'utf8');
const serviceAccount = JSON.parse(rawData);

try {
  initializeApp({
    credential: cert(serviceAccount)
  });
} catch (e) {
  if (e.code !== 'app/duplicate-app') throw e;
}

const db = getFirestore();

const QUIZ_DATA = [
  // Namaz Todne Wali Cheezein
  { question: "Namaz mein jaan-boojh kar baat karna kya karta hai?", option1: "Namaz tod deta hai", option2: "Makruh karta hai", option3: "Sawab kam karta hai", option4: "Kuch nahi karta", correctAnswer: "Namaz tod deta hai", category: "Namaz Todne Wali Cheezein" },
  { question: "Namaz mein jaan-boojh kar khana ya peena kya karta hai?", option1: "Namaz tod deta hai", option2: "Makruh karta hai", option3: "Sajda Sahw wajib karta hai", option4: "Kuch nahi karta", correctAnswer: "Namaz tod deta hai", category: "Namaz Todne Wali Cheezein" },
  { question: "Namaz mein qahqaha (zor se hansna) ka kya hukm hai?", option1: "Namaz toot jati hai", option2: "Sirf Makruh hoti hai", option3: "Kuch nahi hota", option4: "Sirf Sajda Sahw hota hai", correctAnswer: "Namaz toot jati hai", category: "Namaz Todne Wali Cheezein" },
  { question: "Namaz mein amal-e-kaseer (bahut zyada harkat) ka kya hukm hai?", option1: "Namaz toot jati hai", option2: "Makruh hoti hai", option3: "Mustahab hai", option4: "Koi asar nahi", correctAnswer: "Namaz toot jati hai", category: "Namaz Todne Wali Cheezein" },
  { question: "Namaz ke dauran Wudu toot jaye to kya hukm hai?", option1: "Namaz toot jati hai", option2: "Namaz jari rahegi", option3: "Sirf Sajda Sahw hoga", option4: "Kuch nahi hoga", correctAnswer: "Namaz toot jati hai", category: "Namaz Todne Wali Cheezein" },
  { question: "Namaz mein Qiblah se poori tarah munh pher lena kya karta hai?", option1: "Namaz tod deta hai", option2: "Makruh karta hai", option3: "Sawab kam karta hai", option4: "Kuch nahi karta", correctAnswer: "Namaz tod deta hai", category: "Namaz Todne Wali Cheezein" },
  { question: "Namaz mein bila zarurat teen musalsal harkatein karna kya kehlata hai?", option1: "Amal-e-Kaseer", option2: "Ta'deel-e-Arkan", option3: "Qiraat", option4: "Takbeer", correctAnswer: "Amal-e-Kaseer", category: "Namaz Todne Wali Cheezein" },
  { question: "Namaz mein salaam ka jawab dena kya karta hai?", option1: "Namaz tod deta hai", option2: "Makruh karta hai", option3: "Sawab badhata hai", option4: "Kuch nahi karta", correctAnswer: "Namaz tod deta hai", category: "Namaz Todne Wali Cheezein" },
  { question: "Namaz ke dauran duniya ki baat karna kya karta hai?", option1: "Namaz tod deta hai", option2: "Sirf Makruh karta hai", option3: "Sunnat hai", option4: "Mustahab hai", correctAnswer: "Namaz tod deta hai", category: "Namaz Todne Wali Cheezein" },
  { question: "Namaz ke dauran jaan-boojh kar zor se rona (dunyawi wajah se) ka kya hukm hai?", option1: "Namaz toot jati hai", option2: "Namaz behtar ho jati hai", option3: "Sirf Makruh hoti hai", option4: "Koi asar nahi", correctAnswer: "Namaz toot jati hai", category: "Namaz Todne Wali Cheezein" },
  { question: "Namaz ke dauran aurat agar poori tarah Qiblah se munh pher le to kya hukm hai?", option1: "Namaz toot jati hai", option2: "Namaz jari rahegi", option3: "Sirf Makruh hogi", option4: "Sirf Sajda Sahw hoga", correctAnswer: "Namaz toot jati hai", category: "Namaz Todne Wali Cheezein" },
  { question: "Namaz ke dauran jaan-boojh kar kisi ko jawab dena kya karta hai?", option1: "Namaz tod deta hai", option2: "Makruh karta hai", option3: "Sawab kam karta hai", option4: "Kuch nahi karta", correctAnswer: "Namaz tod deta hai", category: "Namaz Todne Wali Cheezein" },
  { question: "Namaz todne wali cheezein kis ilm ka hissa hain?", option1: "Fiqh", option2: "Nahw", option3: "Balaghat", option4: "Tafseer", correctAnswer: "Fiqh", category: "Namaz Todne Wali Cheezein" },
  { question: "Namaz todne wali cheezein kis bab mein padhayi jati hain?", option1: "Kitab-us-Salah", option2: "Kitab-us-Saum", option3: "Kitab-ul-Hajj", option4: "Kitab-uz-Zakat", correctAnswer: "Kitab-us-Salah", category: "Namaz Todne Wali Cheezein" },
  { question: "Namaz ke dauran jaan-boojh kar salam pher dena kya karta hai?", option1: "Namaz khatam kar deta hai", option2: "Makruh karta hai", option3: "Sajda Sahw wajib karta hai", option4: "Kuch nahi karta", correctAnswer: "Namaz khatam kar deta hai", category: "Namaz Todne Wali Cheezein" },
  { question: "Namaz ke dauran amal-e-kaseer se bachna kaisa hai?", option1: "Zaroori", option2: "Ikhtiyari", option3: "Mustahab", option4: "Makruh", correctAnswer: "Zaroori", category: "Namaz Todne Wali Cheezein" },
  { question: "Namaz ki hifazat ke liye Mufsidat se bachna kaisa hai?", option1: "Zaroori", option2: "Makruh", option3: "Sirf Imam ke liye", option4: "Sirf Nafl mein", correctAnswer: "Zaroori", category: "Namaz Todne Wali Cheezein" },
  { question: "Namaz toot jane ke baad kya karna chahiye?", option1: "Dobarah Namaz padhna", option2: "Sirf Dua karna", option3: "Sirf Sajda Sahw karna", option4: "Kuch nahi", correctAnswer: "Dobarah Namaz padhna", category: "Namaz Todne Wali Cheezein" },
  { question: "Mufsidat-e-Namaz ka maqsad kya samajhna hai?", option1: "Namaz ko sahih tareeqe se ada karna", option2: "Namaz chhodna", option3: "Sirf Nafl padhna", option4: "Sirf Dua seekhna", correctAnswer: "Namaz ko sahih tareeqe se ada karna", category: "Namaz Todne Wali Cheezein" },
  { question: "Namaz todne wali cheezon ka ilm hasil karna kaisa hai?", option1: "Aham", option2: "Ghair Zaroori", option3: "Makruh", option4: "Sirf Ulema ke liye", correctAnswer: "Aham", category: "Namaz Todne Wali Cheezein" },

  // Sajda Sahw
  { question: "Sajda Sahw kab kiya jata hai?", option1: "Jab Namaz mein Wajib bhool kar chhoot jaye", option2: "Har Namaz ke baad", option3: "Farz chhootne par", option4: "Sunnat chhootne par", correctAnswer: "Jab Namaz mein Wajib bhool kar chhoot jaye", category: "Sajda Sahw" },
  { question: "Sajda Sahw kitne Sajde hote hain?", option1: "1", option2: "2", option3: "3", option4: "4", correctAnswer: "2", category: "Sajda Sahw" },
  { question: "Farz chhoot jane par Sajda Sahw kafi hota hai?", option1: "Haan", option2: "Nahi", option3: "Kabhi Kabhi", option4: "Sirf Nafl mein", correctAnswer: "Nahi", category: "Sajda Sahw" },
  { question: "Jaan-boojh kar Wajib chhodne par Sajda Sahw kafi hota hai?", option1: "Haan", option2: "Nahi", option3: "Sirf Imam ke liye", option4: "Sirf Nafl mein", correctAnswer: "Nahi", category: "Sajda Sahw" },
  { question: "Sajda Sahw kis ilm ke masail mein shamil hai?", option1: "Fiqh", option2: "Nahw", option3: "Sarf", option4: "Balaghat", correctAnswer: "Fiqh", category: "Sajda Sahw" },
  { question: "Sajda Sahw kis Namaz mein kiya ja sakta hai?", option1: "Jis Namaz mein uska sabab paida ho", option2: "Sirf Fajr", option3: "Sirf Witr", option4: "Sirf Eid", correctAnswer: "Jis Namaz mein uska sabab paida ho", category: "Sajda Sahw" },
  { question: "Sajda Sahw ka sabab kis cheez se paida hota hai?", option1: "Wajib bhool jana", option2: "Sunnat padhna", option3: "Dua padhna", option4: "Tasbeeh padhna", correctAnswer: "Wajib bhool jana", category: "Sajda Sahw" },
  { question: "Sajda Sahw karne se kya durust hota hai?", option1: "Bhool se chhuta hua Wajib", option2: "Farz", option3: "Taharat", option4: "Wudu", correctAnswer: "Bhool se chhuta hua Wajib", category: "Sajda Sahw" },
  { question: "Sajda Sahw Namaz ka kis qisam ka mas'ala hai?", option1: "Fiqhi", option2: "Tajweed", option3: "Nahw", option4: "Balaghat", correctAnswer: "Fiqhi", category: "Sajda Sahw" },
  { question: "Sajda Sahw na karne se bhool se chhuta Wajib ka kya hukm hota hai?", option1: "Namaz ka i'adah wajib ho sakta hai", option2: "Kuch nahi hota", option3: "Roza toot jata hai", option4: "Wudu toot jata hai", correctAnswer: "Namaz ka i'adah wajib ho sakta hai", category: "Sajda Sahw" },
  { question: "Sajda Sahw mein kitni martaba Sajda kiya jata hai?", option1: "2", option2: "1", option3: "3", option4: "4", correctAnswer: "2", category: "Sajda Sahw" },
  { question: "Sajda Sahw kis bab mein padhaya jata hai?", option1: "Kitab-us-Salah", option2: "Kitab-us-Saum", option3: "Kitab-ul-Hajj", option4: "Kitab-uz-Zakat", correctAnswer: "Kitab-us-Salah", category: "Sajda Sahw" },
  { question: "Bhool se Qa'dah Ula chhoot jaye to kya kiya jata hai?", option1: "Sajda Sahw", option2: "Namaz tod di jati hai", option3: "Kuch nahi", option4: "Wudu kiya jata hai", correctAnswer: "Sajda Sahw", category: "Sajda Sahw" },
  { question: "Sajda Sahw ka hukm kis Fiqh mein padhaya jata hai?", option1: "Hanafi Fiqh", option2: "Sirf Tajweed", option3: "Sirf Hadith", option4: "Sirf Nahw", correctAnswer: "Hanafi Fiqh", category: "Sajda Sahw" },
  { question: "Bhool se Wajib chhootne par Namaz ko durust karne ka tareeqa kya hai?", option1: "Sajda Sahw", option2: "Takbeer", option3: "Tasbeeh", option4: "Dua", correctAnswer: "Sajda Sahw", category: "Sajda Sahw" },
  { question: "Sajda Sahw ka maqsad kya hai?", option1: "Bhool ki talaafi karna", option2: "Sawab badhana", option3: "Roza mukammal karna", option4: "Taharat hasil karna", correctAnswer: "Bhool ki talaafi karna", category: "Sajda Sahw" },
  { question: "Sajda Sahw kis surat mein zaroori hota hai?", option1: "Bhool se Wajib chhoot jaye", option2: "Farz chhoot jaye", option3: "Sunnat padh li jaye", option4: "Har Namaz ke baad", correctAnswer: "Bhool se Wajib chhoot jaye", category: "Sajda Sahw" },
  { question: "Sajda Sahw ka ta'alluq kis ibadat se hai?", option1: "Namaz", option2: "Roza", option3: "Zakat", option4: "Hajj", correctAnswer: "Namaz", category: "Sajda Sahw" },
  { question: "Sajda Sahw se kis qisam ki ghalati ki islaah hoti hai?", option1: "Bhool se hui ghalati", option2: "Jaan-boojh kar ki hui ghalati", option3: "Taharat ki kami", option4: "Wudu tootna", correctAnswer: "Bhool se hui ghalati", category: "Sajda Sahw" },
  { question: "Sajda Sahw ke masail seekhna kaisa hai?", option1: "Aham", option2: "Ghair Zaroori", option3: "Makruh", option4: "Sirf Ulema ke liye", correctAnswer: "Aham", category: "Sajda Sahw" },

  // Witr
  { question: "Witr ki Namaz ka kya hukm hai?", option1: "Farz", option2: "Wajib", option3: "Sunnat", option4: "Nafl", correctAnswer: "Wajib", category: "Witr" },
  { question: "Witr ki Namaz kitni Rak'at hai?", option1: "1", option2: "2", option3: "3", option4: "4", correctAnswer: "3", category: "Witr" },
  { question: "Witr ki Namaz kis waqt padhi jati hai?", option1: "Fajr se pehle Isha ke baad", option2: "Zuhr ke baad", option3: "Asr ke baad", option4: "Maghrib se pehle", correctAnswer: "Fajr se pehle Isha ke baad", category: "Witr" },
  { question: "Witr ki Namaz kis Farz Namaz ke baad hoti hai?", option1: "Fajr", option2: "Zuhr", option3: "Maghrib", option4: "Isha", correctAnswer: "Isha", category: "Witr" },
  { question: "Witr ki teesri Rak'at mein kya padha jata hai?", option1: "Dua-e-Qunoot", option2: "Attahiyyat", option3: "Sirf Surah Fatiha", option4: "Takbeer-e-Tashreeq", correctAnswer: "Dua-e-Qunoot", category: "Witr" },
  { question: "Dua-e-Qunoot se pehle kya kaha jata hai?", option1: "Takbeer", option2: "Salaam", option3: "Tasbeeh", option4: "Ameen", correctAnswer: "Takbeer", category: "Witr" },
  { question: "Dua-e-Qunoot padhna Witr mein kya hai?", option1: "Farz", option2: "Wajib", option3: "Sunnat", option4: "Mustahab", correctAnswer: "Wajib", category: "Witr" },
  { question: "Agar Dua-e-Qunoot bhool jaye to kya kiya jayega?", option1: "Sajda Sahw", option2: "Namaz tod di jayegi", option3: "Kuch nahi", option4: "Wudu kiya jayega", correctAnswer: "Sajda Sahw", category: "Witr" },
  { question: "Witr ki Namaz kis ilm ke masail mein shamil hai?", option1: "Fiqh", option2: "Nahw", option3: "Balaghat", option4: "Tafseer", correctAnswer: "Fiqh", category: "Witr" },
  { question: "Witr ki Namaz kis bab mein padhayi jati hai?", option1: "Kitab-us-Salah", option2: "Kitab-us-Saum", option3: "Kitab-ul-Hajj", option4: "Kitab-uz-Zakat", correctAnswer: "Kitab-us-Salah", category: "Witr" },
  { question: "Witr ki Namaz Ramazan ke ilawa bhi padhi jati hai?", option1: "Haan", option2: "Nahi", option3: "Sirf Ramazan mein", option4: "Sirf Jumu'ah ko", correctAnswer: "Haan", category: "Witr" },
  { question: "Witr ki Namaz ka waqt kab khatam hota hai?", option1: "Fajr ka waqt shuru hone par", option2: "Suraj nikalne par", option3: "Zuhr par", option4: "Asr par", correctAnswer: "Fajr ka waqt shuru hone par", category: "Witr" },
  { question: "Agar Witr chhoot jaye to uska kya hukm hai?", option1: "Qaza padhi jayegi", option2: "Kuch nahi", option3: "Sirf Taubah", option4: "Sirf Dua", correctAnswer: "Qaza padhi jayegi", category: "Witr" },
  { question: "Witr ki Namaz kis waqt padhna afzal hai?", option1: "Raat ke aakhri hisse mein (agar uthne ka yaqeen ho)", option2: "Asr ke baad", option3: "Zuhr se pehle", option4: "Maghrib se pehle", correctAnswer: "Raat ke aakhri hisse mein (agar uthne ka yaqeen ho)", category: "Witr" },
  { question: "Agar raat ke aakhri hisse mein uthne ka yaqeen na ho to Witr kab padhna behtar hai?", option1: "Isha ke baad sone se pehle", option2: "Fajr ke baad", option3: "Zuhr ke baad", option4: "Asr ke baad", correctAnswer: "Isha ke baad sone se pehle", category: "Witr" },
  { question: "Witr ki Namaz mein kitni baar Qa'dah hota hai?", option1: "Ek", option2: "Do", option3: "Teen", option4: "Chaar", correctAnswer: "Do", category: "Witr" },
  { question: "Witr ki Namaz kis Farz Namaz ke saath ada ki jati hai?", option1: "Isha", option2: "Fajr", option3: "Zuhr", option4: "Asr", correctAnswer: "Isha", category: "Witr" },
  { question: "Witr ki Namaz ka ta'alluq kis ibadat se hai?", option1: "Namaz", option2: "Roza", option3: "Zakat", option4: "Hajj", correctAnswer: "Namaz", category: "Witr" },
  { question: "Dua-e-Qunoot kis Rak'at mein padhi jati hai?", option1: "Pehli", option2: "Doosri", option3: "Teesri", option4: "Har Rak'at", correctAnswer: "Teesri", category: "Witr" },
  { question: "Witr ki Namaz ke masail seekhna kaisa hai?", option1: "Aham", option2: "Ghair Zaroori", option3: "Makruh", option4: "Sirf Ulema ke liye", correctAnswer: "Aham", category: "Witr" },

  // Roza
  { question: "Ramazan ke roze ka kya hukm hai?", option1: "Farz", option2: "Wajib", option3: "Sunnat", option4: "Nafl", correctAnswer: "Farz", category: "Roza" },
  { question: "Ramazan ke roze kis par Farz hote hain?", option1: "Har aqil aur baligh Musalman par", option2: "Sirf Mardon par", option3: "Sirf Ulema par", option4: "Sirf Musafiron par", correctAnswer: "Har aqil aur baligh Musalman par", category: "Roza" },
  { question: "Roza kis mahine mein rakha jata hai?", option1: "Muharram", option2: "Rajab", option3: "Ramazan", option4: "Shawwal", correctAnswer: "Ramazan", category: "Roza" },
  { question: "Roza ki niyyat kab ki jati hai?", option1: "Roza rakhne se pehle", option2: "Iftar ke baad", option3: "Asr ke baad", option4: "Maghrib ke baad", correctAnswer: "Roza rakhne se pehle", category: "Roza" },
  { question: "Roza kis waqt se shuru hota hai?", option1: "Fajr se", option2: "Suraj nikalne se", option3: "Zuhr se", option4: "Asr se", correctAnswer: "Fajr se", category: "Roza" },
  { question: "Roza kis waqt khatam hota hai?", option1: "Maghrib ke waqt", option2: "Asr ke waqt", option3: "Isha ke waqt", option4: "Suraj nikalne par", correctAnswer: "Maghrib ke waqt", category: "Roza" },
  { question: "Roza kis ibadat ka naam hai?", option1: "Subah se Maghrib tak ibadat ki niyyat ke saath mufattirat se rukna", option2: "Sirf bhookha rehna", option3: "Sirf pyasa rehna", option4: "Sirf sehri karna", correctAnswer: "Subah se Maghrib tak ibadat ki niyyat ke saath mufattirat se rukna", category: "Roza" },
  { question: "Roza kis ilm ke masail mein shamil hai?", option1: "Fiqh", option2: "Nahw", option3: "Balaghat", option4: "Tafseer", correctAnswer: "Fiqh", category: "Roza" },
  { question: "Roza kis bab mein padhaya jata hai?", option1: "Kitab-us-Saum", option2: "Kitab-us-Salah", option3: "Kitab-ul-Hajj", option4: "Kitab-uz-Zakat", correctAnswer: "Kitab-us-Saum", category: "Roza" },
  { question: "Roza Islam ka kaunsa rukn hai?", option1: "Pehla", option2: "Doosra", option3: "Teesra", option4: "Chautha", correctAnswer: "Chautha", category: "Roza" },
  { question: "Roza rakhne se pehle khaya jane wala khana kya kehlata hai?", option1: "Sehri", option2: "Iftar", option3: "Walimah", option4: "Aqeeqah", correctAnswer: "Sehri", category: "Roza" },
  { question: "Roza kholne ko kya kehte hain?", option1: "Iftar", option2: "Sehri", option3: "Qunoot", option4: "Takbeer", correctAnswer: "Iftar", category: "Roza" },
  { question: "Roza kis maqsad ke liye Farz kiya gaya?", option1: "Taqwa hasil karne ke liye", option2: "Sirf bhookha rehne ke liye", option3: "Wazan kam karne ke liye", option4: "Safar ke liye", correctAnswer: "Taqwa hasil karne ke liye", category: "Roza" },
  { question: "Roza rakhna kis par Farz nahi hai?", option1: "Na-baligh bachche", option2: "Baligh Musalman", option3: "Aqil Musalman", option4: "Muqeem Musalman", correctAnswer: "Na-baligh bachche", category: "Roza" },
  { question: "Ramazan ke roze kitne mahine mein aate hain?", option1: "Ek", option2: "Do", option3: "Teen", option4: "Chaar", correctAnswer: "Ek", category: "Roza" },
  { question: "Roza ki niyyat ka ta'alluq kis se hai?", option1: "Dil se", option2: "Zaban se", option3: "Haath se", option4: "Kapdon se", correctAnswer: "Dil se", category: "Roza" },
  { question: "Roza ki ibadat kis ke liye ki jati hai?", option1: "Allah Ta'ala ke liye", option2: "Logon ke liye", option3: "Riwaj ke liye", option4: "Apni sehat ke liye", correctAnswer: "Allah Ta'ala ke liye", category: "Roza" },
  { question: "Roza ke dauran jaan-boojh kar khana peena kaisa hai?", option1: "Roza toot jata hai", option2: "Koi asar nahi", option3: "Makruh hota hai", option4: "Mustahab hai", correctAnswer: "Roza toot jata hai", category: "Roza" },
  { question: "Roza ke dauran Fajr ke baad sehri karna kaisa hai?", option1: "Jaiz nahi", option2: "Jaiz hai", option3: "Mustahab hai", option4: "Sunnat hai", correctAnswer: "Jaiz nahi", category: "Roza" },
  { question: "Roza ke bunyadi masail seekhna kaisa hai?", option1: "Aham", option2: "Ghair Zaroori", option3: "Makruh", option4: "Sirf Ulema ke liye", correctAnswer: "Aham", category: "Roza" },

  // Roza Todne Wali Cheezein
  { question: "Roze ki halat mein jaan-boojh kar khana khane ka kya hukm hai?", option1: "Roza toot jata hai", option2: "Roza Makruh hota hai", option3: "Kuch nahi hota", option4: "Sirf Wudu toot ta hai", correctAnswer: "Roza toot jata hai", category: "Roza Todne Wali Cheezein" },
  { question: "Roze ki halat mein jaan-boojh kar pani peene ka kya hukm hai?", option1: "Roza toot jata hai", option2: "Roza Makruh hota hai", option3: "Roza sahih rehta hai", option4: "Sirf Sawab kam hota hai", correctAnswer: "Roza toot jata hai", category: "Roza Todne Wali Cheezein" },
  { question: "Roze ki halat mein jaan-boojh kar dawa khana kya karta hai?", option1: "Roza tod deta hai", option2: "Roza Makruh karta hai", option3: "Kuch nahi karta", option4: "Sirf Wudu todta hai", correctAnswer: "Roza tod deta hai", category: "Roza Todne Wali Cheezein" },
  { question: "Roze mein jaan-boojh kar cigarette ya beedi peene ka kya hukm hai?", option1: "Roza toot jata hai", option2: "Roza Makruh hota hai", option3: "Roza sahih rehta hai", option4: "Koi asar nahi hota", correctAnswer: "Roza toot jata hai", category: "Roza Todne Wali Cheezein" },
  { question: "Roze ki halat mein jaan-boojh kar ulti munh bhar kar wapas nigal lena kya karta hai?", option1: "Roza tod deta hai", option2: "Roza Makruh karta hai", option3: "Kuch nahi karta", option4: "Sirf Sawab kam karta hai", correctAnswer: "Roza tod deta hai", category: "Roza Todne Wali Cheezein" },
  { question: "Roze ki halat mein jaan-boojh kar jima' (hambistari) ka kya hukm hai?", option1: "Roza toot jata hai", option2: "Roza Makruh hota hai", option3: "Roza sahih rehta hai", option4: "Koi asar nahi hota", correctAnswer: "Roza toot jata hai", category: "Roza Todne Wali Cheezein" },
  { question: "Roza todne wali cheezein kis ilm ka hissa hain?", option1: "Fiqh", option2: "Nahw", option3: "Balaghat", option4: "Tajweed", correctAnswer: "Fiqh", category: "Roza Todne Wali Cheezein" },
  { question: "Roza todne wali cheezein kis bab mein padhayi jati hain?", option1: "Kitab-us-Saum", option2: "Kitab-us-Salah", option3: "Kitab-ul-Hajj", option4: "Kitab-uz-Zakat", correctAnswer: "Kitab-us-Saum", category: "Roza Todne Wali Cheezein" },
  { question: "Roze ki halat mein jaan-boojh kar khoon ya koi ghiza badan ke andar pahunchana kya karta hai?", option1: "Roza tod deta hai", option2: "Roza Makruh karta hai", option3: "Koi asar nahi hota", option4: "Sirf Sawab kam hota hai", correctAnswer: "Roza tod deta hai", category: "Roza Todne Wali Cheezein" },
  { question: "Roze mein jaan-boojh kar naswar ya tambaku istemal karna kya karta hai?", option1: "Roza tod deta hai", option2: "Roza Makruh karta hai", option3: "Roza sahih rehta hai", option4: "Koi asar nahi hota", correctAnswer: "Roza tod deta hai", category: "Roza Todne Wali Cheezein" },
  { question: "Roze mein jaan-boojh kar koi khane ki cheez nigal lena kya karta hai?", option1: "Roza tod deta hai", option2: "Roza Makruh karta hai", option3: "Roza sahih rehta hai", option4: "Koi asar nahi hota", correctAnswer: "Roza tod deta hai", category: "Roza Todne Wali Cheezein" },
  { question: "Roze mein jaan-boojh kar pani ka qatra halaq se neeche utarna kya karta hai?", option1: "Roza tod deta hai", option2: "Roza Makruh karta hai", option3: "Roza sahih rehta hai", option4: "Sirf Sawab kam hota hai", correctAnswer: "Roza tod deta hai", category: "Roza Todne Wali Cheezein" },
  { question: "Roze ki halat mein jaan-boojh kar dawa ka injection lagwana kya hukm rakhta hai?", option1: "Fiqhi tafseel talab mas'ala hai", option2: "Har surat mein Roza toot jata hai", option3: "Har surat mein Roza nahi toot ta", option4: "Hamesha Kaffarah hota hai", correctAnswer: "Fiqhi tafseel talab mas'ala hai", category: "Roza Todne Wali Cheezein" },
  { question: "Roza todne wali cheez ka ilm hasil karna kaisa hai?", option1: "Aham", option2: "Ghair Zaroori", option3: "Makruh", option4: "Sirf Ulema ke liye", correctAnswer: "Aham", category: "Roza Todne Wali Cheezein" },
  { question: "Roze ki halat mein jaan-boojh kar iftar waqt se pehle khana kaisa hai?", option1: "Roza toot jata hai", option2: "Jaiz hai", option3: "Mustahab hai", option4: "Makruh hai", correctAnswer: "Roza toot jata hai", category: "Roza Todne Wali Cheezein" },
  { question: "Roze ki halat mein jaan-boojh kar jima' karne par kya lazim ho sakta hai?", option1: "Qaza aur Kaffarah", option2: "Sirf Qaza", option3: "Sirf Kaffarah", option4: "Kuch nahi", correctAnswer: "Qaza aur Kaffarah", category: "Roza Todne Wali Cheezein" },
  { question: "Roza todne wali cheezon se bachna kaisa hai?", option1: "Zaroori", option2: "Makruh", option3: "Mustahab", option4: "Ikhtiyari", correctAnswer: "Zaroori", category: "Roza Todne Wali Cheezein" },
  { question: "Agar Roza toot jaye to kya karna chahiye?", option1: "Shar'i hukm ke mutabiq Qaza ya Kaffarah ada karna", option2: "Kuch nahi", option3: "Sirf Dua karna", option4: "Sirf Sadqah dena", correctAnswer: "Shar'i hukm ke mutabiq Qaza ya Kaffarah ada karna", category: "Roza Todne Wali Cheezein" },
  { question: "Roza todne wali cheezon ka maqsad samajhna kyun zaroori hai?", option1: "Roze ki hifazat ke liye", option2: "Sirf Imtihan ke liye", option3: "Sirf Ulema ke liye", option4: "Koi wajah nahi", correctAnswer: "Roze ki hifazat ke liye", category: "Roza Todne Wali Cheezein" },
  { question: "Roza todne wali cheezein seekhna kaisa hai?", option1: "Aham", option2: "Ghair Zaroori", option3: "Makruh", option4: "Sirf Ramazan mein", correctAnswer: "Aham", category: "Roza Todne Wali Cheezein" }
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
