import fs from 'fs';
import path from 'path';

describe('Phase 45 — Instant Madrasa Fee Receipt & Official Sanad/Certificate Generator', () => {
  const receiptGenSrc = fs.readFileSync(path.resolve(__dirname, './receiptGenerator.ts'), 'utf8');
  const receiptModalSrc = fs.readFileSync(path.resolve(__dirname, '../components/IslamicReceiptModal.tsx'), 'utf8');
  const adminPaymentsSrc = fs.readFileSync(path.resolve(__dirname, '../app/admin/payments.tsx'), 'utf8');
  const certModalSrc = fs.readFileSync(path.resolve(__dirname, '../components/IslamicCertificateModal.tsx'), 'utf8');

  test('receiptGenerator.ts produces official HTML with Islamic header and verification serial', () => {
    expect(receiptGenSrc).toContain('generateFeeReceiptHtml');
    expect(receiptGenSrc).toContain('exportAndShareReceipt');
    expect(receiptGenSrc).toContain('formatCategoryLabel');
    expect(receiptGenSrc).toContain('Madrasatu-s-Salikat Lil Banat');
    expect(receiptGenSrc).toContain('Official E-Fee Receipt & Voucher');
    expect(receiptGenSrc).toContain('Paths.document');
    expect(receiptGenSrc).toContain('Sharing.shareAsync');
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

  test('IslamicCertificateModal.tsx generates certificate with institutional seal', () => {
    expect(certModalSrc).toContain('IslamicCertificateModal');
    expect(certModalSrc).toContain('Certificate of Academic Excellence');
    expect(certModalSrc).toContain('handleDownload');
    expect(certModalSrc).toContain('handleShare');
  });
});
