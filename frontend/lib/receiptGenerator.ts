/**
 * receiptGenerator.ts — Phase 45
 * Official Islamic Fee Receipt & Donation Voucher Generator
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Share, Platform, Linking } from 'react-native';

export interface FeeReceiptData {
  receiptId: string;
  studentName: string;
  studentEmail?: string;
  studentId?: string;
  courseName?: string;
  amount: number;
  currency?: string;
  category: 'fees' | 'sadqa' | 'zakat' | 'fitra' | 'langar' | 'admission' | string;
  paymentMethod: string; // Razorpay | Direct Transfer | Cash
  transactionId?: string;
  issueDateGregorian: string;
  issueDateHijri?: string;
  status: string; // Succeeded | Approved | Verified
  note?: string;
}

export function formatCategoryLabel(cat: string): string {
  switch (cat?.toLowerCase()) {
    case 'fees':
      return 'Course Monthly Tuition Fee';
    case 'admission':
      return 'Madrasa Admission & Enrollment Fee';
    case 'sadqa':
      return 'Sadqah-e-Jariyah Contribution';
    case 'zakat':
      return 'Zakat Fund';
    case 'fitra':
      return 'Sadaqat-ul-Fitr';
    case 'langar':
      return 'Talibat Langar & Meals Support';
    default:
      return 'Madrasa Educational Contribution';
  }
}

export function generateFeeReceiptHtml(data: FeeReceiptData): string {
  const currencySymbol = data.currency === 'USD' ? '$' : '₹';
  const categoryLabel = formatCategoryLabel(data.category);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Receipt - ${data.receiptId}</title>
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
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: rgba(255,255,255,0.8);
      margin-top: 10px;
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
      margin-bottom: 24px;
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
      <div class="receipt-title">Official E-Fee Receipt & Voucher</div>
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
        <div class="label">Received With Thanks From</div>
        <div class="value">${data.studentName}</div>
        ${data.studentEmail ? `<div style="font-size: 12px; color: #4b5563; margin-top: 2px;">Email: ${data.studentEmail}</div>` : ''}
        ${data.studentId ? `<div style="font-size: 11px; color: #6b7280; margin-top: 2px;">Student ID: ${data.studentId}</div>` : ''}
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>Description / Purpose</th>
            <th style="text-align: right;">Payment Method</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>${categoryLabel}</strong>
              ${data.courseName ? `<div style="font-size: 12px; color: #6b7280;">Course: ${data.courseName}</div>` : ''}
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
        title: `Fee Receipt - ${data.receiptId}`,
        message: `Official Fee Receipt from Madrasatu-s-Salikat Lil Banat\nReceipt No: ${data.receiptId}\nStudent: ${data.studentName}\nAmount: ₹${data.amount}\nStatus: ${data.status}\nDate: ${data.issueDateGregorian}`,
      });
    }
  } catch (err: unknown) {
    // Fallback to text share
    await Share.share({
      title: `Fee Receipt - ${data.receiptId}`,
      message: `Official Fee Receipt from Madrasatu-s-Salikat Lil Banat\nReceipt No: ${data.receiptId}\nStudent: ${data.studentName}\nAmount: ₹${data.amount}\nStatus: ${data.status}\nDate: ${data.issueDateGregorian}`,
    });
  }
}


/**
 * Builds an authentic, professional Urdu / English Islamic Fee Receipt message for WhatsApp
 */
export function buildReceiptWhatsAppMessage(data: FeeReceiptData): string {
  const currency = data.currency === 'USD' ? '$' : '₹';
  const categoryTitle = formatCategoryLabel(data.category);

  const lines: string[] = [
    '🌸 *مدرسۃ السالکات للبنات - فیس وصولی رسید*',
    'السلام علیکم ورحمۃ اللہ وبرکاتہ',
    '',
    'محترم والدین / سرپرست! طالبہ کی فیس باضابطہ موصول اور تصدیق (Approved) ہو چکی ہے:',
    '',
    `🧾 *رسید نمبر (Receipt No):* ${data.receiptId}`,
    `👧 *طالبہ کا نام (Student):* ${data.studentName}`,
  ];

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
  lines.push('اللہ تعالیٰ آپ کے تعاون و صدقات کو قبول فرمائے اور طالبہ کے علم و عمل میں برکت عطا فرمائے۔ آمین!');
  lines.push('');
  lines.push('_شعبہ مالیات و فیس مینجمنٹ - مدرسۃ السالکات للبنات_');

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
      title: `Fee Receipt - ${data.receiptId}`,
      message,
    });
    return false;
  }
}
