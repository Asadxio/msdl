/**
 * MSLB Bulk Student Import Utility
 * Client-side validation, parsing, and execution coordinator.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export interface RawImportRow {
  name: string;
  email?: string;
  phone?: string;
  guardian_name?: string;
  guardian_phone?: string;
  course_id?: string;
  course_name?: string;
}

export interface ImportErrorDetail {
  row: number;
  name: string;
  error: string;
}

export interface ValidationReport {
  totalRows: number;
  validRows: RawImportRow[];
  errors: ImportErrorDetail[];
  canProceed: boolean;
}

export interface ImportResult {
  success: boolean;
  total_rows: number;
  imported_count: number;
  failed_count: number;
  errors: ImportErrorDetail[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

/**
 * Validate raw student import rows locally before submitting to backend.
 */
export function validateStudentImportRows(rows: RawImportRow[]): ValidationReport {
  const errors: ImportErrorDetail[] = [];
  const validRows: RawImportRow[] = [];
  const seenIdentifiers = new Set<string>();

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      totalRows: 0,
      validRows: [],
      errors: [{ row: 0, name: '', error: 'The import file contains no student records.' }],
      canProceed: false,
    };
  }

  rows.forEach((row, index) => {
    const rowNum = index + 1;
    const cleanName = (row.name || '').trim();
    const cleanEmail = (row.email || '').trim().toLowerCase();
    const cleanPhone = (row.phone || '').trim().replace(/[\s-]/g, '');

    if (!cleanName) {
      errors.push({ row: rowNum, name: '', error: 'Student full name is required.' });
      return;
    }

    if (!cleanEmail && !cleanPhone) {
      errors.push({ row: rowNum, name: cleanName, error: 'At least one contact method (email or phone) is required.' });
      return;
    }

    if (cleanEmail && !EMAIL_REGEX.test(cleanEmail)) {
      errors.push({ row: rowNum, name: cleanName, error: `Invalid email address format: '${cleanEmail}'.` });
      return;
    }

    if (cleanPhone && !PHONE_REGEX.test(cleanPhone)) {
      errors.push({ row: rowNum, name: cleanName, error: `Invalid phone format: '${cleanPhone}'. Expected 7-15 digits.` });
      return;
    }

    const key = cleanEmail || cleanPhone;
    if (seenIdentifiers.has(key)) {
      errors.push({ row: rowNum, name: cleanName, error: `Duplicate contact identifier in roster: '${key}'.` });
      return;
    }
    seenIdentifiers.add(key);

    validRows.push({
      name: cleanName,
      email: cleanEmail || undefined,
      phone: cleanPhone || undefined,
      guardian_name: (row.guardian_name || '').trim() || undefined,
      guardian_phone: (row.guardian_phone || '').trim() || undefined,
      course_id: (row.course_id || '').trim() || undefined,
      course_name: (row.course_name || '').trim() || undefined,
    });
  });

  return {
    totalRows: rows.length,
    validRows,
    errors,
    canProceed: validRows.length > 0,
  };
}

/**
 * Parse CSV text content into structured RawImportRow array.
 */
export function parseCSVToStudentRows(csvText: string): RawImportRow[] {
  if (!csvText || !csvText.trim()) return [];
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse header line
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
  const nameIdx = headers.findIndex((h) => h.includes('name') && !h.includes('guardian'));
  const emailIdx = headers.findIndex((h) => h.includes('email'));
  const phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('mobile') || h.includes('contact'));
  const guardianNameIdx = headers.findIndex((h) => h.includes('guardian') && h.includes('name'));
  const courseIdx = headers.findIndex((h) => h.includes('course') || h.includes('class'));

  const rows: RawImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));

    const name = nameIdx >= 0 ? parts[nameIdx] || '' : parts[0] || '';
    const email = emailIdx >= 0 ? parts[emailIdx] || '' : '';
    const phone = phoneIdx >= 0 ? parts[phoneIdx] || '' : '';
    const guardian_name = guardianNameIdx >= 0 ? parts[guardianNameIdx] || '' : '';
    const course_name = courseIdx >= 0 ? parts[courseIdx] || '' : '';

    rows.push({
      name,
      email,
      phone,
      guardian_name,
      course_name,
    });
  }

  return rows;
}

/**
 * Execute bulk student import via trusted Cloud Function.
 */
export async function executeBulkStudentImport(
  organizationId: string,
  students: RawImportRow[]
): Promise<ImportResult> {
  const bulkImportCall = httpsCallable<{ organization_id: string; students: RawImportRow[] }, ImportResult>(
    functions,
    'bulkImportStudents'
  );

  const res = await bulkImportCall({
    organization_id: organizationId,
    students,
  });

  return res.data;
}
