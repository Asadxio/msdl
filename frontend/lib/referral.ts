import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface ReferralRecord {
  id: string;
  referrer_uid: string;
  referrer_name: string;
  referee_uid: string;
  referee_name: string;
  referral_code: string;
  status: 'joined' | 'enrolled';
  created_at?: Timestamp | any;
}

export interface SadqahTier {
  title: string;
  arabicTitle: string;
  badge: string;
  icon: string;
  color: string;
  nextMilestone: number;
}

export function generateReferralCode(uid: string, name?: string): string {
  const cleanName = (name || 'TALIB')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 5) || 'DEEN';
  const cleanUid = (uid || '786').slice(-4).toUpperCase();
  return 'MSLB-' + cleanName + '-' + cleanUid;
}

export function getSadqahTier(count: number): SadqahTier {
  if (count >= 15) {
    return {
      title: 'Senior Deen Ambassador',
      arabicTitle: 'داعية إسلامية ومربية',
      badge: '👑 داعیۂ اسلام',
      icon: 'ribbon',
      color: '#C8A84E',
      nextMilestone: 15,
    };
  }
  if (count >= 5) {
    return {
      title: 'Deen Messenger',
      arabicTitle: 'مبلغة الخير',
      badge: '📖 مبلّغۂ خیر',
      icon: 'book',
      color: '#005F46',
      nextMilestone: 15,
    };
  }
  return {
    title: 'Beginner Da’iyah',
    arabicTitle: 'داعية مبتدئة',
    badge: '🌸 داعیۂ ابتدائی',
    icon: 'heart',
    color: '#059669',
    nextMilestone: 5,
  };
}

export function getReferralShareMessage(referralCode: string, studentName?: string): string {
  const name = studentName || 'طالبہ';
  return (
    'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم\n\n' +
    '🌸 *مدرسۃ السالکات للبنات* میں آن لائن اسلامی تعلیم و تربیت حاصل کریں۔\n\n' +
    'عزیز بہن! میں آپ کو مدرسۃ السالکات للبنات جوائن کرنے کی پرخلوص دعوت دیتی ہوں جہاں مکمل پردہ کے ساتھ تجوید، فقہ، حدیث، اور فرض علوم سکھائے جاتے ہیں۔\n\n' +
    '✨ *دعوت کوڈ:* ' + referralCode + '\n' +
    '📲 *ایپ ڈاؤن لوڈ و رجسٹریشن لنک:* https://mslb.app/join?ref=' + referralCode + '\n\n' +
    'رسول اللہ ﷺ نے فرمایا:\n' +
    '*"مَنْ دَلَّ عَلَى خَيْرٍ فَلَهُ مِثْلُ أَجْرِ فَاعِلِهِ"*\n' +
    '(جس نے کسی نیکی کی رہنمائی کی، اسے بھی نیکی کرنے والے کے برابر ثواب ملے گا — صحیح مسلم)'
  );
}

export async function recordReferralSignup(params: {
  newStudentUid: string;
  newStudentName: string;
  referralCode: string;
}): Promise<boolean> {
  const code = (params.referralCode || '').trim().toUpperCase();
  if (!code || !code.startsWith('MSLB-')) return false;

  try {
    const recordId = 'ref_' + params.newStudentUid;
    const docRef = doc(db, 'referral_records', recordId);

    // Mask name for purdah
    const nameParts = params.newStudentName.trim().split(/\s+/);
    const maskedName = nameParts[0] ? nameParts[0] + ' (محفوظ برائے پردہ)' : 'طالبہ';

    await setDoc(docRef, {
      id: recordId,
      referral_code: code,
      referee_uid: params.newStudentUid,
      referee_name: maskedName,
      status: 'joined',
      created_at: serverTimestamp(),
    });

    // Lookup referrer by referral code in users collection
    const usersQ = query(collection(db, 'users'), where('referral_code', '==', code), limit(1));
    const userSnap = await getDocs(usersQ);

    if (!userSnap.empty) {
      const referrerDoc = userSnap.docs[0];
      const referrerUid = referrerDoc.id;

      await updateDoc(doc(db, 'users', referrerUid), {
        referral_count: increment(1),
      });

      await updateDoc(docRef, {
        referrer_uid: referrerUid,
        referrer_name: (referrerDoc.data() as any)?.name || 'داعیہ',
      });

      // Send congratulations notification to referrer
      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id,
        recipient_id: referrerUid,
        user_id: referrerUid,
        type: 'referral_success',
        title: '🌸 صدقہ جاریہ کی مبارکباد (New Sister Joined)',
        body: 'ماشاءاللہ! آپ کی دعوت سے ایک نئی بہن نے مدرسہ جوائن کر لیا ہے۔ اللہ تعالیٰ اس نیکی کو آپ کے لیے صدقہ جاریہ بنائے۔',
        route: '/referral',
        read: false,
        created_at: serverTimestamp(),
      });
    }

    return true;
  } catch (err) {
    console.warn('[Referral] Failed to record referral signup:', err);
    return false;
  }
}

export function subscribeToMyReferrals(
  referrerUid: string,
  callback: (records: ReferralRecord[]) => void
): () => void {
  const q = query(
    collection(db, 'referral_records'),
    where('referrer_uid', '==', referrerUid),
    orderBy('created_at', 'desc'),
    limit(50)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: ReferralRecord[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as ReferralRecord);
      });
      callback(list);
    },
    (err) => {
      console.warn('[Referral] Error fetching referrals:', err);
      callback([]);
    }
  );
}
