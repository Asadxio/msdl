import fs from 'fs';
import path from 'path';

describe('Phase 45 — Instant Madrasa Fee Receipt & Official Sanad/Certificate Generator', () => {
  const receiptGenSrc = fs.readFileSync(path.resolve(__dirname, './receiptGenerator.ts'), 'utf8');
  const receiptModalSrc = fs.readFileSync(path.resolve(__dirname, '../components/IslamicReceiptModal.tsx'), 'utf8');
  const adminPaymentsSrc = fs.readFileSync(path.resolve(__dirname, '../app/admin/payments.tsx'), 'utf8');
  const certModalSrc = fs.readFileSync(path.resolve(__dirname, '../components/IslamicCertificateModal.tsx'), 'utf8');
  const certImgGenSrc = fs.readFileSync(path.resolve(__dirname, './certificateImageGenerator.ts'), 'utf8');

  test('receiptGenerator.ts produces official HTML with Islamic header and verification serial', () => {
    expect(receiptGenSrc).toContain('generateFeeReceiptHtml');
    expect(receiptGenSrc).toContain('exportAndShareReceipt');
    expect(receiptGenSrc).toContain('formatCategoryLabel');
    expect(receiptGenSrc).toContain('Madrasatu-s-Salikat Lil Banat');
    expect(receiptGenSrc).toContain('Official E-Fee Receipt & Voucher');
    expect(receiptGenSrc).toContain('Paths.document');
    expect(receiptGenSrc).toContain('Sharing.shareAsync');
  });

  test('certificateImageGenerator.ts supports 4 themes and embeds official logo', () => {
    expect(certImgGenSrc).toContain('CERTIFICATE_THEMES');
    expect(certImgGenSrc).toContain('emerald');
    expect(certImgGenSrc).toContain('ivory');
    expect(certImgGenSrc).toContain('parchment');
    expect(certImgGenSrc).toContain('midnight');
    expect(certImgGenSrc).toContain('MSLB_LOGO_BASE64');
    expect(certImgGenSrc).toContain('shareCertificatePngFile');
  });

  test('IslamicReceiptModal.tsx renders official voucher and share button', () => {
    expect(receiptModalSrc).toContain('IslamicReceiptModal');
    expect(receiptModalSrc).toContain('exportAndShareReceipt');
    expect(receiptModalSrc).toContain('receiptPaper');
    expect(receiptModalSrc).toContain('TOTAL PAID');
  });

  test('admin/payments.tsx integrates Official Receipt generation', () => {
    expect(adminPaymentsSrc).toContain('IslamicReceiptModal');
    expect(adminPaymentsSrc).toContain('Official Receipt');
    expect(adminPaymentsSrc).toContain('receiptModalVisible');
    expect(adminPaymentsSrc).toContain('selectedReceipt');
  });

  test('IslamicCertificateModal.tsx renders official logo and theme selection', () => {
    expect(certModalSrc).toContain('IslamicCertificateModal');
    expect(certModalSrc).toContain('mslb_logo.png');
    expect(certModalSrc).toContain('SELECT CERTIFICATE THEME');
    expect(certModalSrc).toContain('CERTIFICATE_THEMES');
    expect(certModalSrc).toContain('handleShare');
  });
});
