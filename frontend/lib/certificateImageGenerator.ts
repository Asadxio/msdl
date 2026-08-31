/**
 * certificateImageGenerator.ts
 * Generates high-resolution themed Islamic Certificates with Official MSLB Logo
 */
import { MSLB_LOGO_BASE64 } from './mslbLogoBase64';
import type { QuizCertificateData } from './quizCertificate';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

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
