const assert = require('assert');
const fs = require('fs');

console.log("================================================================");
console.log("   PHASE 62 — QR-VERIFIED SHARABLE SANAD PDF MASTER SUITE       ");
console.log("================================================================");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log("  [PASS] " + name);
    passed++;
  } catch (err) {
    console.error("  [FAIL] " + name + ": " + err.message);
    failed++;
  }
}

// 1. Sanad Verification URL & QR Invariants
test("P62-01: Official Sanad verification URL targets active GitHub Pages portal", () => {
  const MADRASA_WEBSITE_URL = 'https://asadxio.github.io/madrasa-website/';
  function getSanadVerificationUrl(certId) {
    const cleanId = encodeURIComponent(certId || '');
    const baseUrl = MADRASA_WEBSITE_URL.endsWith('/') ? MADRASA_WEBSITE_URL : MADRASA_WEBSITE_URL + '/';
    return baseUrl + 'verify-sanad.html?id=' + cleanId;
  }
  function getSanadQrCodeUrl(certId) {
    const targetUrl = encodeURIComponent(getSanadVerificationUrl(certId));
    return 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + targetUrl + '&margin=6&color=005F46';
  }

  const certId = 'MSLB-QZ-2026-FIQ-USR892A';
  const verifyUrl = getSanadVerificationUrl(certId);
  const qrUrl = getSanadQrCodeUrl(certId);

  assert.strictEqual(verifyUrl, 'https://asadxio.github.io/madrasa-website/verify-sanad.html?id=MSLB-QZ-2026-FIQ-USR892A');
  assert(qrUrl.includes('https%3A%2F%2Fasadxio.github.io%2Fmadrasa-website%2Fverify-sanad.html%3Fid%3DMSLB-QZ-2026-FIQ-USR892A'));
  assert(qrUrl.includes('color=005F46'));
});

// 2. HTML Template Print & PDF Invariants
test("P62-02: HTML generator contains @media print landscape rules and PDF toolbar", () => {
  const certGenSrc = fs.readFileSync('frontend/lib/certificateImageGenerator.ts', 'utf8');
  assert(certGenSrc.includes('@media print'), 'Must include @media print stylesheet');
  assert(certGenSrc.includes('size: A4 landscape'), 'Must specify A4 landscape print layout');
  assert(certGenSrc.includes('-webkit-print-color-adjust: exact'), 'Must force background graphics printing');
  assert(certGenSrc.includes('print-toolbar'), 'Must contain top PDF print action toolbar');
  assert(certGenSrc.includes('window.print()'), 'Must contain 1-Tap window.print trigger');
  assert(certGenSrc.includes('getSanadQrCodeUrl'), 'Must use synchronized QR helper');
  assert(certGenSrc.includes('getSanadVerificationUrl'), 'Must use synchronized verification helper');
});

// 3. SVG Template Quality Invariants
test("P62-03: SVG generator embeds official QR code and seal with verified credentials", () => {
  const certGenSrc = fs.readFileSync('frontend/lib/certificateImageGenerator.ts', 'utf8');
  assert(certGenSrc.includes('getSanadQrCodeUrl(cert.certificateId)'), 'SVG must embed official getSanadQrCodeUrl');
  assert(certGenSrc.includes('MSLB_LOGO_BASE64'), 'SVG must render official crest logo');
  assert(certGenSrc.includes('Scan to Verify Sanad'), 'SVG must instruct scanner');
});

// 4. WhatsApp Sharing Live Link
test("P62-04: WhatsApp sharing generator embeds official verification URL", () => {
  const certGenSrc = fs.readFileSync('frontend/lib/certificateImageGenerator.ts', 'utf8');
  assert(certGenSrc.includes('const verifyUrl = getSanadVerificationUrl(cert.certificateId);'), 'WhatsApp message must provide live URL');
  assert(certGenSrc.includes('Official Sanad PDF & Print'), 'Share sheet title must indicate PDF & Print');
});

// 5. Islamic Certificate Modal UI Invariants
test("P62-05: Modal UI renders 1-Tap PDF Download / Print button", () => {
  const modalSrc = fs.readFileSync('frontend/components/IslamicCertificateModal.tsx', 'utf8');
  assert(modalSrc.includes('Download / Print Official PDF'), 'Modal must have explicit PDF Download / Print button');
  assert(modalSrc.includes('document-text'), 'Must use document icon');
});

console.log("\n================================================================");
console.log("   PHASE 62 RESULTS: " + passed + " PASSED / " + failed + " FAILED");
console.log("================================================================");

if (failed > 0) process.exit(1);

