/**
 * certificateImageGenerator.ts
 * Generates high-resolution themed Islamic Certificates with Official MSLB Logo
 */
import { MSLB_LOGO_BASE64 } from './mslbLogoBase64';
import type { QuizCertificateData } from './quizCertificate';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Linking, Share } from 'react-native';

export type CertificateThemeKey = 'emerald' | 'ivory' | 'parchment' | 'midnight';

export interface CertificateTheme {
  key: CertificateThemeKey;
  label: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgColor: string;
  paperColor: string;
  borderColor: string;
  textColor: string;
}

export const CERTIFICATE_THEMES: Record<CertificateThemeKey, CertificateTheme> = {
  emerald: {
    key: 'emerald',
    label: 'Royal Emerald',
    primaryColor: '#005F46',
    secondaryColor: '#C8A84E',
    accentColor: '#047857',
    bgColor: '#F4F7F5',
    paperColor: '#FCFBF8',
    borderColor: '#C8A84E',
    textColor: '#1A332B',
  },
  ivory: {
    key: 'ivory',
    label: 'Modern Minimalist',
    primaryColor: '#0F172A',
    secondaryColor: '#B89354',
    accentColor: '#334155',
    bgColor: '#F8FAFC',
    paperColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    textColor: '#0F172A',
  },
  parchment: {
    key: 'parchment',
    label: 'Classic Sanad',
    primaryColor: '#78350F',
    secondaryColor: '#D97706',
    accentColor: '#92400E',
    bgColor: '#FDFBF7',
    paperColor: '#FAF5EC',
    borderColor: '#B45309',
    textColor: '#451A03',
  },
  midnight: {
    key: 'midnight',
    label: 'Royal Navy',
    primaryColor: '#0F2537',
    secondaryColor: '#EAB308',
    accentColor: '#1E3A8A',
    bgColor: '#F0F4F8',
    paperColor: '#FFFFFF',
    borderColor: '#EAB308',
    textColor: '#0B192C',
  },
};

export function generateCertificateHtml(cert: QuizCertificateData, themeKey: CertificateThemeKey = 'emerald'): string {
  const theme = CERTIFICATE_THEMES[themeKey] || CERTIFICATE_THEMES.emerald;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate - ${cert.studentName}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: ${theme.bgColor};
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .cert-container {
      width: 100%;
      max-width: 800px;
      background: ${theme.paperColor};
      border: 8px solid ${theme.borderColor};
      padding: 16px;
      border-radius: 16px;
      box-shadow: 0 15px 35px rgba(0,0,0,0.12);
      position: relative;
    }
    .inner-frame {
      border: 2px solid ${theme.primaryColor};
      border-radius: 10px;
      padding: 28px 24px;
      text-align: center;
      position: relative;
      background: radial-gradient(circle at center, rgba(255,255,255,0.9), ${theme.paperColor});
    }
    .corner-ornament {
      position: absolute;
      width: 24px;
      height: 24px;
      border: 3px solid ${theme.secondaryColor};
    }
    .top-left { top: 6px; left: 6px; border-right: none; border-bottom: none; }
    .top-right { top: 6px; right: 6px; border-left: none; border-bottom: none; }
    .bottom-left { bottom: 6px; left: 6px; border-right: none; border-top: none; }
    .bottom-right { bottom: 6px; right: 6px; border-left: none; border-top: none; }
    
    .bismillah {
      font-size: 20px;
      color: ${theme.primaryColor};
      font-weight: 700;
      margin-bottom: 8px;
    }
    .logo-img {
      width: 90px;
      height: 90px;
      object-fit: contain;
      margin: 4px auto 8px;
      display: block;
    }
    .madrasa-title {
      font-size: 20px;
      font-weight: 900;
      color: ${theme.primaryColor};
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .madrasa-arabic {
      font-size: 16px;
      color: ${theme.secondaryColor};
      font-weight: 700;
      margin-top: 2px;
    }
    .cert-type {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 3px;
      color: ${theme.secondaryColor};
      font-weight: 800;
      margin-top: 14px;
      padding: 4px 16px;
      display: inline-block;
      border-top: 1px solid ${theme.borderColor};
      border-bottom: 1px solid ${theme.borderColor};
    }
    .presented-text {
      font-size: 13px;
      color: #64748B;
      font-style: italic;
      margin-top: 14px;
    }
    .student-name {
      font-size: 32px;
      font-weight: 900;
      color: ${theme.primaryColor};
      margin: 10px 0 6px;
      padding-bottom: 4px;
      display: inline-block;
      border-bottom: 2px solid ${theme.secondaryColor};
    }
    .description {
      font-size: 14px;
      line-height: 1.6;
      color: ${theme.textColor};
      max-width: 620px;
      margin: 12px auto;
    }
    .category-highlight {
      color: ${theme.primaryColor};
      font-weight: 700;
    }
    .score-badge-wrap {
      margin: 16px 0;
    }
    .score-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #ECFDF5;
      border: 1.5px solid #10B981;
      color: #065F46;
      padding: 6px 18px;
      border-radius: 20px;
      font-weight: 800;
      font-size: 14px;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px dashed #CBD5E1;
      text-align: left;
    }
    .meta-col {
      font-size: 11px;
      color: #475569;
      line-height: 1.5;
    }
    .meta-serial {
      font-family: monospace;
      font-size: 10px;
      color: ${theme.primaryColor};
      font-weight: bold;
      margin-top: 2px;
    }
    .seal-col {
      text-align: center;
    }
    .seal {
      width: 65px;
      height: 65px;
      border: 2px double ${theme.secondaryColor};
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: ${theme.secondaryColor};
      font-size: 9px;
      font-weight: 900;
      line-height: 1.1;
      margin: 0 auto;
    }
    .sign-col {
      text-align: right;
      font-size: 11px;
      color: #475569;
    }
    .sign-line {
      width: 120px;
      border-bottom: 1px solid #94A3B8;
      margin-bottom: 4px;
      margin-left: auto;
    }
    .sign-title {
      font-weight: 700;
      color: ${theme.primaryColor};
    }
  </style>
</head>
<body>
  <div class="cert-container" id="certificate-root">
    <div class="inner-frame">
      <div class="corner-ornament top-left"></div>
      <div class="corner-ornament top-right"></div>
      <div class="corner-ornament bottom-left"></div>
      <div class="corner-ornament bottom-right"></div>

      <div class="bismillah">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم</div>
      <img src="${MSLB_LOGO_BASE64}" class="logo-img" alt="MSLB Crest" />
      <h1 class="madrasa-title">Madrasatu-s-Salikat Lil Banat</h1>
      <div class="madrasa-arabic">مدرسۃ السالکات للبنات</div>

      <div class="cert-type">Certificate of Academic Excellence</div>
      <div class="presented-text">This is proudly awarded to</div>
      <div class="student-name">${cert.studentName}</div>

      <p class="description">
        has successfully passed the Islamic Knowledge Assessment in <span class="category-highlight">${cert.quizCategory}</span>, demonstrating dedication and authentic mastery of Islamic principles.
      </p>

      <div class="score-badge-wrap">
        <div class="score-badge">
          Score: ${cert.score}/${cert.totalQuestions} (${cert.percentage}%) • ${cert.gradeLabel}
        </div>
      </div>

      <div class="footer">
        <div class="meta-col">
          <div><strong>Date:</strong> ${cert.issueDateGregorian}</div>
          <div><strong>Hijri:</strong> ${cert.issueDateHijri}</div>
          <div class="meta-serial">Serial: ${cert.certificateId}</div>
        </div>

        <div class="seal-col">
          <div class="seal">
            <span>★ MSLB ★</span>
            <span>OFFICIAL</span>
            <span>SEAL</span>
          </div>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https%3A%2F%2Fmslb.app%2Fverify-sanad%3Fid%3D${encodeURIComponent(cert.certificateId)}" style="width: 54px; height: 54px; margin-top: 6px; border: 1px solid #CBD5E1; border-radius: 4px; padding: 2px; background: #fff;" alt="Verify QR" />
          <div style="font-size: 8px; color: #64748B; margin-top: 2px; font-weight: 600;">Scan to Verify Sanad</div>
        </div>

        <div class="sign-col">
          <div class="sign-line"></div>
          <div class="sign-title">Academic Directorate</div>
          <div>Madrasatu-s-Salikat</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Generates a high-resolution Vector SVG image representing the complete Islamic Sanad Certificate
 * 11.2: Native vector image export compatible with social apps, image viewers, and printing
 */
export function generateCertificateSvg(cert: QuizCertificateData, themeKey: CertificateThemeKey = 'emerald'): string {
  const theme = CERTIFICATE_THEMES[themeKey] || CERTIFICATE_THEMES.emerald;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https%3A%2F%2Fmslb.app%2Fverify-sanad%3Fid%3D${encodeURIComponent(cert.certificateId)}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1050" width="800" height="1050">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95" />
      <stop offset="100%" stop-color="${theme.paperColor}" stop-opacity="1" />
    </radialGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.15"/>
    </filter>
  </defs>

  <!-- Background Base -->
  <rect width="800" height="1050" fill="${theme.bgColor}"/>

  <!-- Certificate Paper with Outer Golden Border -->
  <rect x="30" y="30" width="740" height="990" rx="16" fill="${theme.paperColor}" stroke="${theme.borderColor}" stroke-width="8" filter="url(#shadow)"/>

  <!-- Inner Ornamental Frame -->
  <rect x="48" y="48" width="704" height="954" rx="10" fill="url(#bgGrad)" stroke="${theme.primaryColor}" stroke-width="2.5"/>

  <!-- Corner Islamic Ornaments -->
  <path d="M 54 84 L 54 54 L 84 54" fill="none" stroke="${theme.secondaryColor}" stroke-width="3.5" />
  <path d="M 746 84 L 746 54 L 716 54" fill="none" stroke="${theme.secondaryColor}" stroke-width="3.5" />
  <path d="M 54 966 L 54 996 L 84 996" fill="none" stroke="${theme.secondaryColor}" stroke-width="3.5" />
  <path d="M 746 966 L 746 996 L 716 996" fill="none" stroke="${theme.secondaryColor}" stroke-width="3.5" />

  <!-- Bismillah Calligraphy -->
  <text x="400" y="105" text-anchor="middle" font-family="Traditional Arabic, Scheherazade, Amiri, serif" font-size="24" font-weight="bold" fill="${theme.primaryColor}">
    بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم
  </text>

  <!-- Madrasa Crest Image -->
  <image href="${MSLB_LOGO_BASE64}" x="355" y="125" width="90" height="90" preserveAspectRatio="xMidYMid meet" />

  <!-- Madrasa Title English & Arabic -->
  <text x="400" y="242" text-anchor="middle" font-family="-apple-system, Roboto, sans-serif" font-size="20" font-weight="900" letter-spacing="1.5" fill="${theme.primaryColor}">
    MADRASATU-S-SALIKAT LIL BANAT
  </text>
  <text x="400" y="268" text-anchor="middle" font-family="Traditional Arabic, Scheherazade, Amiri, serif" font-size="18" font-weight="bold" fill="${theme.secondaryColor}">
    مدرسۃ السالکات للبنات
  </text>

  <!-- Certificate Ribbon Header -->
  <rect x="220" y="292" width="360" height="30" rx="4" fill="none" stroke="${theme.secondaryColor}" stroke-width="1.5" />
  <text x="400" y="312" text-anchor="middle" font-family="-apple-system, Roboto, sans-serif" font-size="12" font-weight="bold" letter-spacing="3" fill="${theme.secondaryColor}">
    CERTIFICATE OF ACADEMIC EXCELLENCE
  </text>

  <!-- Presented To Notice -->
  <text x="400" y="360" text-anchor="middle" font-family="-apple-system, Roboto, sans-serif" font-size="14" font-style="italic" fill="#64748B">
    This is proudly awarded to
  </text>

  <!-- Student Name -->
  <text x="400" y="420" text-anchor="middle" font-family="-apple-system, Roboto, sans-serif" font-size="34" font-weight="900" fill="${theme.primaryColor}">
    ${cert.studentName}
  </text>
  <line x1="250" y1="435" x2="550" y2="435" stroke="${theme.secondaryColor}" stroke-width="2.5" />

  <!-- Body Description -->
  <text x="400" y="480" text-anchor="middle" font-family="-apple-system, Roboto, sans-serif" font-size="15" fill="${theme.textColor}">
    for successfully completing and demonstrating mastery in
  </text>
  <text x="400" y="510" text-anchor="middle" font-family="-apple-system, Roboto, sans-serif" font-size="18" font-weight="bold" fill="${theme.primaryColor}">
    ${cert.quizCategory}
  </text>
  <text x="400" y="540" text-anchor="middle" font-family="-apple-system, Roboto, sans-serif" font-size="14" fill="${theme.textColor}">
    with sincere dedication and excellence in authentic Islamic studies.
  </text>

  <!-- Score & Grade Pill -->
  <rect x="230" y="575" width="340" height="42" rx="21" fill="#ECFDF5" stroke="#10B981" stroke-width="1.8" />
  <text x="400" y="602" text-anchor="middle" font-family="-apple-system, Roboto, sans-serif" font-size="15" font-weight="bold" fill="#065F46">
    Score: ${cert.score}/${cert.totalQuestions} (${cert.percentage}%) • ${cert.gradeLabel}
  </text>

  <!-- Divider Line -->
  <line x1="80" y1="675" x2="720" y2="675" stroke="#CBD5E1" stroke-width="1.5" stroke-dasharray="6,6" />

  <!-- Footer Left: Issue Dates & Serial -->
  <text x="90" y="730" font-family="-apple-system, Roboto, sans-serif" font-size="12" fill="#64748B">Date of Issue:</text>
  <text x="90" y="750" font-family="-apple-system, Roboto, sans-serif" font-size="13" font-weight="bold" fill="#1E293B">${cert.issueDateGregorian}</text>
  <text x="90" y="770" font-family="Traditional Arabic, sans-serif" font-size="13" font-weight="bold" fill="${theme.secondaryColor}">${cert.issueDateHijri}</text>
  <text x="90" y="805" font-family="monospace" font-size="11" font-weight="bold" fill="${theme.primaryColor}">Serial: ${cert.certificateId}</text>

  <!-- Footer Center: Official Seal & QR Code -->
  <circle cx="400" cy="740" r="38" fill="none" stroke="${theme.secondaryColor}" stroke-width="2.5" stroke-dasharray="4,2"/>
  <circle cx="400" cy="740" r="33" fill="none" stroke="${theme.secondaryColor}" stroke-width="1.2"/>
  <text x="400" y="730" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="9" font-weight="900" fill="${theme.secondaryColor}">★ MSLB ★</text>
  <text x="400" y="743" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="9" font-weight="900" fill="${theme.secondaryColor}">OFFICIAL</text>
  <text x="400" y="756" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="9" font-weight="900" fill="${theme.secondaryColor}">SEAL</text>
  
  <image href="${qrUrl}" x="368" y="795" width="64" height="64" />
  <text x="400" y="875" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="9" font-weight="bold" fill="#64748B">Scan to Verify Sanad</text>

  <!-- Footer Right: Signature Directorate -->
  <line x1="570" y1="770" x2="710" y2="770" stroke="#94A3B8" stroke-width="1.5" />
  <text x="640" y="790" text-anchor="middle" font-family="-apple-system, Roboto, sans-serif" font-size="13" font-weight="bold" fill="${theme.primaryColor}">Academic Directorate</text>
  <text x="640" y="810" text-anchor="middle" font-family="-apple-system, Roboto, sans-serif" font-size="11" fill="#64748B">Madrasatu-s-Salikat</text>
  <text x="640" y="828" text-anchor="middle" font-family="-apple-system, Roboto, sans-serif" font-size="10" fill="#059669">✓ Officially Verified</text>
</svg>`;
}

/**
 * 11.2: Exports and shares certificate in native Vector Image (.svg) format
 * Directly attachable to social media, WhatsApp status, messaging apps, and image viewers.
 */
export async function shareCertificateImageFile(cert: QuizCertificateData, themeKey: CertificateThemeKey = 'emerald'): Promise<void> {
  const svg = generateCertificateSvg(cert, themeKey);
  const cleanId = cert.certificateId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `MSLB_Sanad_${cleanId}.svg`;

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
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
    file.write(svg);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'image/svg+xml',
        dialogTitle: `Official Sanad Image - ${cert.studentName}`,
        UTI: 'public.svg-image',
      });
    } else {
      await Share.share({
        title: `Official Sanad - ${cert.studentName}`,
        message: `Madrasatu-s-Salikat Lil Banat Official Sanad Certificate for ${cert.studentName}\nVerify: https://mslb.app/verify-sanad?id=${encodeURIComponent(cert.certificateId)}`,
      });
    }
  } catch (err: unknown) {
    console.warn('[shareCertificateImageFile] Share error:', err);
  }
}

/**
 * 11.1: Directly shares certificate celebration text & live verification link to WhatsApp
 */
export async function shareCertificateToWhatsApp(cert: QuizCertificateData): Promise<boolean> {
  const verifyUrl = `https://mslb.app/verify-sanad?id=${encodeURIComponent(cert.certificateId)}`;
  const shareText = `🌸 *الحمد لله رب العالمين!*

ہماری بیٹی *${cert.studentName}* نے *مدرسۃ السالکات للبنات* کے شعبہ تعلیم میں شاندار کامیابی حاصل کر کے باضابطہ سند (Official Sanad) حاصل کی ہے۔

📜 *کورس / مضمون:* ${cert.quizCategory}
📊 *حاصل کردہ نمبر:* *${cert.score} / ${cert.totalQuestions}* (${cert.percentage}%)
🏅 *درجہ / گریڈ:* *${cert.gradeLabel}*
🔢 *سند نمبر (Serial ID):* \`${cert.certificateId}\`
📅 *تاریخ:* ${cert.issueDateGregorian} (${cert.issueDateHijri})

🔗 *سند کی آن لائن تصدیق (Live Sanad Verification):*
${verifyUrl}

_مدرسۃ السالکات للبنات (Madrasatu-s-Salikat Lil Banat)_
_Nurturing Knowledge & Faith_`;

  const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(shareText)}`;
  const webWhatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;

  try {
    const canOpen = await Linking.canOpenURL(whatsappUrl).catch(() => false);
    if (canOpen) {
      await Linking.openURL(whatsappUrl);
      return true;
    } else {
      const canOpenWeb = await Linking.canOpenURL(webWhatsappUrl).catch(() => false);
      if (canOpenWeb) {
        await Linking.openURL(webWhatsappUrl);
        return true;
      } else {
        await Share.share({
          title: `Official Sanad - ${cert.studentName}`,
          message: shareText,
        });
        return true;
      }
    }
  } catch (err) {
    console.warn('[shareCertificateToWhatsApp] Error:', err);
    await Share.share({
      title: `Official Sanad - ${cert.studentName}`,
      message: shareText,
    });
    return false;
  }
}

/**
 * Saves and launches native OS image share sheet
 */
export async function shareCertificatePngFile(cert: QuizCertificateData, themeKey: CertificateThemeKey = 'emerald'): Promise<void> {
  const html = generateCertificateHtml(cert, themeKey);
  const fileName = `Certificate_${cert.certificateId.replace(/[^a-zA-Z0-9_-]/g, '_')}.html`;

  if (Platform.OS === 'web') {
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
        dialogTitle: `Official Sanad - ${cert.studentName}`,
        UTI: 'public.html',
      });
    }
  } catch (err: unknown) {
    console.warn('[shareCertificatePngFile] Share error:', err);
  }
}

