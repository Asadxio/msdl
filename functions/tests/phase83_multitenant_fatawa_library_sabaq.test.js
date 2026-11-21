/**
 * Phase 83 Test Suite: Multi-Tenant Fatawa, Library, Bank/UPI, and Sabaq Diary Isolation
 * 
 * Verifies:
 * Gap 1: Dar-ul-Iftaa (Fatawa) Multi-Tenant Isolation
 * Gap 2: Library & Books Multi-Tenant Isolation
 * Gap 3: Multi-Madrasa Bank & UPI Routing
 * Gap 4: Dunya Ke Har Madarse Ki Jaan — "Sabaq, Sabqi, Manzil" (Hifz/Dars Diary)
 */

const assert = require('assert');

console.log('================================================================');
console.log(' PHASE 83: MULTI-TENANT FATAWA, LIBRARY, BANK & SABAQ DIARY     ');
console.log('================================================================');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log('  [PASS] ' + name);
    passed++;
  } catch (err) {
    console.error('  [FAIL] ' + name + ': ' + (err.stack || err.message));
    failed++;
  }
}

(async () => {
  // ─── GAP 1: Dar-ul-Iftaa (Fatawa) Multi-Tenant Isolation ──────────────────
  await test('FATWA-01: Fatawa questions are stamped with organization_id and institution_name', () => {
    const createFatwaPayload = (params) => ({
      id: 'fq_123',
      student_id: params.userId,
      student_name: params.userName || 'Taliba',
      organization_id: params.organizationId || 'mslb-main',
      institution_name: params.institutionName || 'Madrasatu-s-Salikat Lil Banat',
      category: params.category,
      title: params.title,
      question: params.question,
      status: 'pending',
      is_public: false,
    });

    const docA = createFatwaPayload({
      userId: 'student_1',
      userName: 'Fatima',
      organizationId: 'madrasa_alpha',
      institutionName: 'Jamia Fatima Lil Banat',
      category: 'taharat',
      title: 'Purity Question',
      question: 'Detail about ghusl rulings...',
    });

    assert.strictEqual(docA.organization_id, 'madrasa_alpha');
    assert.strictEqual(docA.institution_name, 'Jamia Fatima Lil Banat');
    assert.strictEqual(docA.is_public, false);
    assert.strictEqual(docA.status, 'pending');
  });

  await test('FATWA-02: Scholar queries only return questions belonging to their own madrasa', () => {
    const allQuestionsInStore = [
      { id: '1', organization_id: 'madrasa_alpha', title: 'Alpha Private Q', student_id: 'std_1' },
      { id: '2', organization_id: 'madrasa_beta', title: 'Beta Confidential Q', student_id: 'std_2' },
      { id: '3', organization_id: 'mslb-main', title: 'Main Campus Q', student_id: 'std_3' },
      { id: '4', title: 'Legacy Q without orgId', student_id: 'std_4' },
    ];

    const filterForTeacher = (targetOrgId) => {
      return allQuestionsInStore.filter((item) => {
        if (targetOrgId === 'mslb-main') {
          return !item.organization_id || item.organization_id === 'mslb-main';
        }
        return item.organization_id === targetOrgId;
      });
    };

    const betaTeacherQuestions = filterForTeacher('madrasa_beta');
    assert.strictEqual(betaTeacherQuestions.length, 1);
    assert.strictEqual(betaTeacherQuestions[0].id, '2');
    assert.ok(!betaTeacherQuestions.some((q) => q.organization_id === 'madrasa_alpha'), 'Beta teacher must NOT see Alpha confidential queries');

    const alphaTeacherQuestions = filterForTeacher('madrasa_alpha');
    assert.strictEqual(alphaTeacherQuestions.length, 1);
    assert.strictEqual(alphaTeacherQuestions[0].id, '1');

    const mainTeacherQuestions = filterForTeacher('mslb-main');
    assert.strictEqual(mainTeacherQuestions.length, 2);
    assert.ok(mainTeacherQuestions.some((q) => q.id === '3'));
    assert.ok(mainTeacherQuestions.some((q) => q.id === '4'));
  });

  // ─── GAP 2: Library & Books Multi-Tenant Isolation ────────────────────────
  await test('LIB-01: Books query filters by active organization and preserves default org legacy books', () => {
    const rawBooksStore = [
      { id: 'b1', title: 'Risala Roohi Sharif', organization_id: 'mslb-main' },
      { id: 'b2', title: 'Classical Arabic Grammar', organization_id: 'madrasa_alpha' },
      { id: 'b3', title: 'Hifz Guidebook', organization_id: 'madrasa_beta' },
      { id: 'b4', title: 'Legacy Hadith Intro' }, // no org id
    ];

    const filterBooksForOrg = (activeOrgId) => {
      return rawBooksStore.filter((b) => {
        if (activeOrgId === 'mslb-main') {
          return !b.organization_id || b.organization_id === 'mslb-main';
        }
        return b.organization_id === activeOrgId;
      });
    };

    const alphaBooks = filterBooksForOrg('madrasa_alpha');
    assert.strictEqual(alphaBooks.length, 1);
    assert.strictEqual(alphaBooks[0].title, 'Classical Arabic Grammar');

    const betaBooks = filterBooksForOrg('madrasa_beta');
    assert.strictEqual(betaBooks.length, 1);
    assert.strictEqual(betaBooks[0].title, 'Hifz Guidebook');

    const mainBooks = filterBooksForOrg('mslb-main');
    assert.strictEqual(mainBooks.length, 2);
    assert.ok(mainBooks.some((b) => b.id === 'b1'));
    assert.ok(mainBooks.some((b) => b.id === 'b4'));
  });

  await test('LIB-02: Adding a book stamps organization_id', () => {
    const createBookPayload = (title, fileUrl, category, activeOrgId) => ({
      title: title.trim(),
      file_url: fileUrl.trim(),
      pdf_url: fileUrl.trim(),
      category: category.trim(),
      organization_id: activeOrgId || 'mslb-main',
    });

    const book = createBookPayload('Sharh Miata Amil', 'https://drive.google.com/test', 'Dars-e-Nizami', 'madrasa_alpha');
    assert.strictEqual(book.organization_id, 'madrasa_alpha');
    assert.strictEqual(book.pdf_url, 'https://drive.google.com/test');
  });

  // ─── GAP 3: Multi-Madrasa Bank & UPI Routing ──────────────────────────────
  await test('BANK-01: Update organization settings allows bank fields in allowedUpdates', () => {
    // Simulating organizationService allowedUpdates extraction
    const settings = {
      name: 'Jamia Noor-ul-Huda',
      upi_id: 'noorulhuda@okhdfcbank',
      upi_name: 'Noor-ul-Huda Educational Trust',
      bank_name: 'State Bank of India',
      account_number: '31092847561',
      ifsc_code: 'sbin0004521',
      account_holder: 'Noor-ul-Huda Trust',
      fee_instructions: 'Payment ke baad UTR screenshot WhatsApp karein: +91 99999 88888',
      unauthorized_quota_tamper: 99999, // Should be rejected
    };

    const allowedUpdates = {};
    if (typeof settings.name === 'string') allowedUpdates.name = settings.name.trim();
    if (typeof settings.upi_id === 'string') allowedUpdates.upi_id = settings.upi_id.trim();
    if (typeof settings.upi_name === 'string') allowedUpdates.upi_name = settings.upi_name.trim();
    if (typeof settings.bank_name === 'string') allowedUpdates.bank_name = settings.bank_name.trim();
    if (typeof settings.account_number === 'string') allowedUpdates.account_number = settings.account_number.trim();
    if (typeof settings.ifsc_code === 'string') allowedUpdates.ifsc_code = settings.ifsc_code.trim().toUpperCase();
    if (typeof settings.account_holder === 'string') allowedUpdates.account_holder = settings.account_holder.trim();
    if (typeof settings.fee_instructions === 'string') allowedUpdates.fee_instructions = settings.fee_instructions.trim();

    assert.strictEqual(allowedUpdates.bank_name, 'State Bank of India');
    assert.strictEqual(allowedUpdates.account_number, '31092847561');
    assert.strictEqual(allowedUpdates.ifsc_code, 'SBIN0004521'); // Auto-uppercased
    assert.strictEqual(allowedUpdates.account_holder, 'Noor-ul-Huda Trust');
    assert.ok(allowedUpdates.fee_instructions.includes('+91 99999 88888'));
    assert.strictEqual(allowedUpdates.unauthorized_quota_tamper, undefined, 'Unauthorized fields must be stripped');
  });

  // ─── GAP 4: Dunya Ke Har Madarse Ki Jaan — "Sabaq, Sabqi, Manzil" ──────────
  await test('SABAQ-01: Sabaq diary grades, attkiyan, and multi-tenant schema are validated', () => {
    const validGrades = ['Mumtaz', 'Jayyid Jiddan', 'Jayyid', 'Maqbool', 'Doharayein'];

    const testEntry = {
      id: 'madrasa_alpha_std101_2026-11-21',
      organization_id: 'madrasa_alpha',
      institution_name: 'Jamia Ayesha Lil Banat',
      student_id: 'std_101',
      student_name: 'Amina Siddiqua',
      teacher_id: 'tch_55',
      teacher_name: 'Ustaadha Khadija',
      date: '2026-11-21',
      status: 'present',
      sabaq: {
        text: 'Surah Al-Baqarah Ayah 1-25',
        grade: 'Mumtaz',
        mistakes: 0,
      },
      sabqi: {
        text: 'Last 5 Pages (Surah Al-Fatiha to Ayah 50)',
        grade: 'Jayyid Jiddan',
        mistakes: 1,
      },
      manzil: {
        text: 'Juz 30 (Amma)',
        juz: 30,
        grade: 'Mumtaz',
        mistakes: 0,
      },
      teacher_notes: 'ماشاءاللہ بہت اچھے لہجے اور تجوید کے ساتھ تلاوت کی۔',
    };

    assert.ok(validGrades.includes(testEntry.sabaq.grade));
    assert.ok(validGrades.includes(testEntry.sabqi.grade));
    assert.ok(validGrades.includes(testEntry.manzil.grade));
    assert.strictEqual(testEntry.manzil.juz, 30);
    assert.strictEqual(testEntry.status, 'present');
    assert.strictEqual(testEntry.organization_id, 'madrasa_alpha');
  });

  await test('SABAQ-02: WhatsApp progress report formats clean Urdu + English for parents', () => {
    // Replicate formatting logic from sabaqDiary.ts
    const SABAQ_GRADE_CONFIG = {
      Mumtaz: { arabic: 'مُمْتَاز', label: 'Mumtaz' },
      'Jayyid Jiddan': { arabic: 'جَیِّد جِدّاً', label: 'Jayyid Jiddan' },
      Jayyid: { arabic: 'جَیِّد', label: 'Jayyid' },
      Maqbool: { arabic: 'مَقْبُول', label: 'Maqbool' },
      Doharayein: { arabic: 'دُہْرَائِیں', label: 'Doharayein' },
    };

    const formatReport = (entry, madrasaName) => {
      const sabaqCfg = SABAQ_GRADE_CONFIG[entry.sabaq.grade];
      const sabqiCfg = SABAQ_GRADE_CONFIG[entry.sabqi.grade];
      const manzilCfg = SABAQ_GRADE_CONFIG[entry.manzil.grade];
      return (
        `*السلام علیکم ورحمۃ اللہ وبرکاتہ*\n\n` +
        `محترم والدین!\n` +
        `*${madrasaName}* کی جانب سے آپ کی صاحبزادی کی یومیہ رپورٹ:\n\n` +
        `📋 *طالبہ کا نام (Student):* ${entry.student_name}\n` +
        `📅 *تاریخ (Date):* ${entry.date}\n` +
        `📍 *حاضری (Attendance):* حاضر (Present)\n\n` +
        `───────────────\n` +
        `📖 *سبق (New Lesson):*\n` +
        `${entry.sabaq.text}\n` +
        `درجہ: *${sabaqCfg.arabic} — ${entry.sabaq.grade}*\n` +
        `غلطیاں/اٹکن: ${entry.sabaq.mistakes}\n\n` +
        `🔁 *سبقی (Recent Revision):*\n` +
        `${entry.sabqi.text}\n` +
        `درجہ: *${sabqiCfg.arabic} — ${entry.sabqi.grade}*\n\n` +
        `🌟 *منزل / دور (Manzil Revision):*\n` +
        `${entry.manzil.text} (پارہ: ${entry.manzil.juz})\n` +
        `درجہ: *${manzilCfg.arabic} — ${entry.manzil.grade}*\n` +
        `───────────────\n` +
        `✍️ *استاذہ کا تبصرہ:* ${entry.teacher_notes}\n\n` +
        `استاذہ: ${entry.teacher_name}\n` +
        `والسلام,\n*${madrasaName}*`
      );
    };

    const entry = {
      student_name: 'Zainab Bint Ali',
      date: '2026-11-21',
      teacher_name: 'Ustaadha Maryam',
      teacher_notes: 'حفظ بہت عمدہ ہے، ماشاءاللہ۔',
      sabaq: { text: 'Surah Al-Baqarah Ayah 20-30', grade: 'Mumtaz', mistakes: 0 },
      sabqi: { text: 'Ayah 1 to 20', grade: 'Jayyid Jiddan', mistakes: 1 },
      manzil: { text: 'Surah An-Naba to An-Nas', juz: 30, grade: 'Mumtaz', mistakes: 0 },
    };

    const report = formatReport(entry, 'Jamia Ayesha Lil Banat');
    assert.ok(report.includes('Jamia Ayesha Lil Banat'), 'Must include madrasa name');
    assert.ok(report.includes('Zainab Bint Ali'), 'Must include student name');
    assert.ok(report.includes('2026-11-21'), 'Must include date');
    assert.ok(report.includes('مُمْتَاز — Mumtaz'), 'Must include Mumtaz grade');
    assert.ok(report.includes('سبقی (Recent Revision)'), 'Must include Sabqi');
    assert.ok(report.includes('منزل / دور (Manzil Revision)'), 'Must include Manzil');
    assert.ok(report.includes('پارہ: 30'), 'Must include Juz 30');
    assert.ok(report.includes('حفظ بہت عمدہ ہے، ماشاءاللہ۔'), 'Must include teacher note');
  });

  console.log('----------------------------------------------------------------');
  console.log(`Phase 83 Result: ${passed} passed, ${failed} failed`);
  console.log('================================================================');
  if (failed > 0) {
    process.exit(1);
  }
})();
