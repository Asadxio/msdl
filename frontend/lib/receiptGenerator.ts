/**
 * receiptGenerator.ts — Phase 45
 * Official Islamic Fee Receipt & Donation Voucher Generator
 * Official E-Fee Receipt & Voucher
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Share, Platform, Linking } from 'react-native';

export interface FeeReceiptData {
  receiptId: string;
  studentName: string;
  donorName?: string;
  studentEmail?: string;
  studentId?: string;
  courseName?: string;
  amount: number;
  currency?: string;
  category: 'fees' | 'sadqa' | 'zakat' | 'fitra' | 'langar' | 'admission' | 'admission_fee' | 'course_fee' | 'tuition_fee' | 'academic_other' | 'sadqah' | 'fitrah' | 'donation_other' | string;
  paymentDomain?: 'academic_fee' | 'donation';
  paymentMethod: string; // Razorpay | Direct Transfer | Cash
  transactionId?: string;
  issueDateGregorian: string;
  issueDateHijri?: string;
  status: string; // Succeeded | Approved | Verified
  note?: string;
  admissionFee?: number;
  courseFee?: number;
}

export function formatCategoryLabel(cat: string): string {
  switch (cat?.toLowerCase()) {
    case 'fees':
    case 'course_fee':
    case 'tuition_fee':
      return 'Course Monthly Tuition Fee';
    case 'admission':
    case 'admission_fee':
      return 'Madrasa Admission & Enrollment Fee';
    case 'academic_other':
      return 'Other Academic Educational Fee';
    case 'sadqa':
    case 'sadqah':
      return 'Sadqah-e-Jariyah Contribution';
    case 'zakat':
      return 'Zakat Fund Contribution';
    case 'fitra':
    case 'fitrah':
      return 'Sadaqat-ul-Fitr';
    case 'langar':
      return 'Talibat Langar & Meals Support';
    case 'donation_other':
      return 'General Madrasa Donation';
    default:
      return 'Madrasa Educational Contribution';
  }
}

export function generateFeeReceiptHtml(data: FeeReceiptData): string {
  const currencySymbol = data.currency === 'USD' ? '$' : '₹';
  const DONATION_CATS = ['sadqa', 'sadqah', 'zakat', 'fitra', 'fitrah', 'langar', 'donation_other'];
  const isDonation = data.paymentDomain === 'donation' || DONATION_CATS.includes(String(data.category || '').toLowerCase());
  const categoryLabel = formatCategoryLabel(data.category);
  const payerName = isDonation ? (data.donorName || data.studentName) : data.studentName;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${isDonation ? 'Donation Voucher' : 'Fee Receipt'} - ${data.receiptId}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f3f4f6;
      margin: 0;
      padding: 30px 15px;
      color: #1f2937;
    }
    .receipt-card {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0,0,0,0.1);
      border: 2px solid #C8A84E;
    }
    .header {
      background: #005F46;
      color: #ffffff;
      text-align: center;
      padding: 24px 20px;
    }
    .bismillah {
      font-size: 20px;
      color: #C8A84E;
      margin-bottom: 6px;
    }
    .madrasa-name {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .madrasa-arabic {
      font-size: 16px;
      color: #C8A84E;
      margin-top: 4px;
    }
    .receipt-title {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #ffffff;
      background: rgba(200, 168, 78, 0.25);
      border-radius: 6px;
      padding: 4px 12px;
      display: inline-block;
      margin-top: 10px;
      font-weight: 700;
    }
    .content {
      padding: 24px;
    }
    .receipt-meta {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px dashed #d1d5db;
      padding-bottom: 16px;
      margin-bottom: 16px;
      font-size: 13px;
    }
    .student-box {
      background: #f9fafb;
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 20px;
      border-left: 4px solid #005F46;
    }
    .label {
      font-size: 11px;
      color: #6b7280;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .value {
      font-size: 15px;
      font-weight: 700;
      color: #111827;
    }
    .dua-banner {
      background: #fdf8e6;
      border: 1px dashed #C8A84E;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 20px;
      text-align: center;
      color: #785a12;
      font-size: 13px;
      font-weight: 600;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .table th {
      text-align: left;
      font-size: 12px;
      color: #6b7280;
      border-bottom: 2px solid #e5e7eb;
      padding: 8px 4px;
    }
    .table td {
      padding: 12px 4px;
      border-bottom: 1px solid #f3f4f6;
      font-size: 14px;
    }
    .amount-box {
      background: #ECFDF5;
      border: 1px solid #10B981;
      border-radius: 8px;
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
    }
    .total-label {
      font-size: 14px;
      font-weight: 700;
      color: #065F46;
    }
    .total-amount {
      font-size: 24px;
      font-weight: 900;
      color: #065F46;
    }
    .status-badge {
      display: inline-block;
      background: #047857;
      color: #ffffff;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .disclaimer {
      font-size: 11px;
      color: #6b7280;
      margin-bottom: 20px;
      line-height: 1.4;
      font-style: italic;
    }
    .footer {
      border-top: 1px dashed #d1d5db;
      padding-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 11px;
      color: #6b7280;
    }
    .seal-wrap {
      text-align: center;
    }
    .seal {
      width: 70px;
      height: 70px;
      border: 2px double #C8A84E;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #C8A84E;
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      margin: 0 auto 4px;
      line-height: 1.2;
    }
  </style>
</head>
<body>
  <div class="receipt-card">
    <div class="header">
      <div class="bismillah">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم</div>
      <h1 class="madrasa-name">Madrasatu-s-Salikat Lil Banat</h1>
      <div class="madrasa-arabic">مدرسۃ السالکات للبنات</div>
      <div class="receipt-title">${isDonation ? 'Official Donation Voucher / رسیدِ عطیہ و صدقات' : 'Official Academic Fee Receipt / رسیدِ تعلیمی فیس'}</div>
    </div>
    <div class="content">
      <div class="receipt-meta">
        <div>
          <div class="label">Receipt No</div>
          <div class="value" style="color: #005F46;">${data.receiptId}</div>
        </div>
        <div style="text-align: right;">
          <div class="label">Date of Issue</div>
          <div class="value">${data.issueDateGregorian}</div>
          ${data.issueDateHijri ? `<div style="font-size: 11px; color: #C8A84E;">${data.issueDateHijri}</div>` : ''}
        </div>
      </div>

      <div class="student-box">
        <div class="label">${isDonation ? 'Received With Thanks From (Donor)' : 'Received With Thanks From (Student)'}</div>
        <div class="value">${payerName}</div>
        ${data.studentEmail ? `<div style="font-size: 12px; color: #4b5563; margin-top: 2px;">Email: ${data.studentEmail}</div>` : ''}
        ${!isDonation && data.studentId ? `<div style="font-size: 11px; color: #6b7280; margin-top: 2px;">Student ID: ${data.studentId}</div>` : ''}
      </div>

      ${isDonation ? `
      <div class="dua-banner">
        جَزَاكُمُ اللَّهُ خَيْرًا وَأَحْسَنَ الْجَزَاء<br>
        <span style="font-size: 11px; font-weight: normal;">May Allah accept your noble contribution and grant abundant barakah in your wealth.</span>
      </div>
      ` : ''}

      <table class="table">
        <thead>
          <tr>
            <th>${isDonation ? 'Donation Fund / Purpose' : 'Course & Fee Breakdown'}</th>
            <th style="text-align: right;">Payment Method</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>${categoryLabel}</strong>
              ${!isDonation && data.courseName ? `<div style="font-size: 12px; color: #6b7280; margin-top: 3px;">Course: ${data.courseName}</div>` : ''}
              ${!isDonation && data.admissionFee ? `<div style="font-size: 11px; color: #6b7280;">Admission Fee: ${currencySymbol}${data.admissionFee}</div>` : ''}
              ${!isDonation && data.courseFee ? `<div style="font-size: 11px; color: #6b7280;">Course Fee: ${currencySymbol}${data.courseFee}</div>` : ''}
            </td>
            <td style="text-align: right;">
              <div>${data.paymentMethod}</div>
              ${data.transactionId ? `<div style="font-size: 10px; color: #9ca3af;">Ref: ${data.transactionId}</div>` : ''}
            </td>
          </tr>
        </tbody>
      </table>

      <div class="amount-box">
        <div>
          <div class="total-label">Total Amount Paid</div>
          <div style="margin-top: 4px;"><span class="status-badge">${data.status || 'Verified & Paid'}</span></div>
        </div>
        <div class="total-amount">${currencySymbol}${data.amount.toLocaleString()}</div>
      </div>

      <div class="disclaimer">
        ${isDonation 
          ? 'Note: This receipt confirms an Islamic charitable contribution towards madrasa welfare funds. It does not constitute academic tuition fees or student enrollment.'
          : 'Note: Official academic tuition receipt confirming valid enrollment at Madrasatu-s-Salikat Lil Banat.'}
      </div>

      <div class="footer">
        <div>
          <div>Madrasatu-s-Salikat Lil Banat</div>
          <div>Authorized Electronic Document</div>
          <div>Verified via MSLB Portal</div>
        </div>
        <div class="seal-wrap">
          <div class="seal">MSLB<br>OFFICIAL<br>SEAL</div>
          <div>Accounts & Finance</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

export async function exportAndShareReceipt(data: FeeReceiptData): Promise<void> {
  const html = generateFeeReceiptHtml(data);
  const fileName = `Receipt_${data.receiptId.replace(/[^a-zA-Z0-9_-]/g, '_')}.html`;

  if (Platform.OS === 'web') {
    // Web fallback: open blob
    if (typeof window !== 'undefined') {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
    }
    return;
  }

  try {
    const file = new File(Paths.document, fileName);
    file.write(html);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/html',
        dialogTitle: `Receipt ${data.receiptId} - ${data.studentName}`,
        UTI: 'public.html',
      });
    } else {
      await Share.share({
        title: `Receipt - ${data.receiptId}`,
        message: `Official Receipt from Madrasatu-s-Salikat Lil Banat\nReceipt No: ${data.receiptId}\nReceived From: ${data.studentName}\nAmount: ₹${data.amount}\nStatus: ${data.status}\nDate: ${data.issueDateGregorian}`,
      });
    }
  } catch (err: unknown) {
    // Fallback to text share
    await Share.share({
      title: `Receipt - ${data.receiptId}`,
      message: `Official Receipt from Madrasatu-s-Salikat Lil Banat\nReceipt No: ${data.receiptId}\nReceived From: ${data.studentName}\nAmount: ₹${data.amount}\nStatus: ${data.status}\nDate: ${data.issueDateGregorian}`,
    });
  }
}

/**
 * Builds an authentic, professional Urdu / English Islamic Receipt message for WhatsApp
 */
export function buildReceiptWhatsAppMessage(data: FeeReceiptData): string {
  const currency = data.currency === 'USD' ? '$' : '₹';
  const DONATION_CATS = ['sadqa', 'sadqah', 'zakat', 'fitra', 'fitrah', 'langar', 'donation_other'];
  const isDonation = data.paymentDomain === 'donation' || DONATION_CATS.includes(String(data.category || '').toLowerCase());
  const categoryTitle = formatCategoryLabel(data.category);
  const payerName = isDonation ? (data.donorName || data.studentName) : data.studentName;

  const lines: string[] = [];

  if (isDonation) {
    lines.push('🌸 *مدرسۃ السالکات للبنات - رسیدِ عطیہ و صدقات (Donation Receipt)*');
    lines.push('السلام علیکم ورحمۃ اللہ وبرکاتہ');
    lines.push('');
    lines.push('محترم معاون / ڈونر صاحب! آپ کا عطیہ باضابطہ موصول اور تصدیق ہو چکا ہے:');
    lines.push('');
    lines.push(`🧾 *رسید نمبر (Receipt No):* ${data.receiptId}`);
    lines.push(`👤 *نام معاون (Donor):* ${payerName}`);
    lines.push(`💰 *عطیہ کی رقم (Amount Paid):* ${currency}${data.amount.toLocaleString()}`);
    lines.push(`🏷️ *مد / شعبہ (Fund):* ${categoryTitle}`);
    lines.push(`💳 *ادائیگی کا طریقہ (Method):* ${data.paymentMethod || 'آن لائن / تصدیق شدہ'}`);
    lines.push(`✅ *حیثیت (Status):* منظور شدہ (Approved & Verified)`);
    lines.push(`📅 *تاریخ (Date):* ${data.issueDateGregorian}`);
    if (data.transactionId) {
      lines.push(`🔢 *ٹرانزیکشن آئی ڈی:* ${data.transactionId}`);
    }
    lines.push('');
    lines.push('جَزَاكُمُ اللَّهُ خَيْرًا وَأَحْسَنَ الْجَزَاء');
    lines.push('اللہ تعالیٰ آپ کے صدقہ و خیرات کو شرفِ قبولیت عطا فرمائے اور دارین میں برکت عطا فرمائے۔ آمین!');
    lines.push('');
    lines.push('_شعبہ مالیات و فنڈز - مدرسۃ السالکات للبنات_');
  } else {
    lines.push('🌸 *مدرسۃ السالکات للبنات - تعلیمی فیس وصولی رسید (Academic Fee Receipt)*');
    lines.push('السلام علیکم ورحمۃ اللہ وبرکاتہ');
    lines.push('');
    lines.push('محترم والدین / طالبہ! آپ کی تعلیمی فیس باضابطہ موصول اور تصدیق (Approved) ہو چکی ہے:');
    lines.push('');
    lines.push(`🧾 *رسید نمبر (Receipt No):* ${data.receiptId}`);
    lines.push(`👧 *طالبہ کا نام (Student):* ${data.studentName}`);
    if (data.courseName) {
      lines.push(`📚 *کورس / کلاس (Course):* ${data.courseName}`);
    }
    lines.push(`💰 *فیس کی رقم (Amount Paid):* ${currency}${data.amount.toLocaleString()}`);
    lines.push(`🏷️ *شعبہ / مد (Category):* ${categoryTitle}`);
    lines.push(`💳 *ادائیگی کا طریقہ (Method):* ${data.paymentMethod || 'آن لائن / تصدیق شدہ'}`);
    lines.push(`✅ *حیثیت (Status):* منظور شدہ (Approved & Verified)`);
    lines.push(`📅 *تاریخ (Date):* ${data.issueDateGregorian}`);
    if (data.transactionId) {
      lines.push(`🔢 *ٹرانزیکشن آئی ڈی:* ${data.transactionId}`);
    }
    lines.push('');
    lines.push('اللہ تعالیٰ طالبہ کے علم و عمل میں برکت عطا فرمائے اور نیک اعمال کی توفیق دے۔ آمین!');
    lines.push('');
    lines.push('_شعبہ مالیات و تعلیمی فیس - مدرسۃ السالکات للبنات_');
  }

  return lines.join('\n');
}

/**
 * Share Fee Receipt directly to WhatsApp / WhatsApp Status or specific parent phone number
 */
export async function shareReceiptToWhatsApp(
  data: FeeReceiptData,
  parentPhone?: string
): Promise<boolean> {
  const message = buildReceiptWhatsAppMessage(data);
  const encoded = encodeURIComponent(message);

  let url = `whatsapp://send?text=${encoded}`;
  let webUrl = `https://api.whatsapp.com/send?text=${encoded}`;

  if (parentPhone) {
    const cleaned = parentPhone.replace(/[^0-9]/g, '');
    if (cleaned.length >= 8) {
      url = `whatsapp://send?phone=${cleaned}&text=${encoded}`;
      webUrl = `https://wa.me/${cleaned}?text=${encoded}`;
    }
  }

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    } else {
      await Linking.openURL(webUrl);
      return true;
    }
  } catch (err) {
    console.warn('[ReceiptGenerator] Could not open WhatsApp:', err);
    // Fallback to native system share
    await Share.share({
      title: `Receipt - ${data.receiptId}`,
      message,
    });
    return false;
  }
}
