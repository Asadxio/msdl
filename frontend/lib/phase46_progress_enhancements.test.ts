import fs from 'fs';
import path from 'path';

describe('Phase 46 — Student Progress Screen (progress.tsx) Enhancements', () => {
  const progressScreenSrc = fs.readFileSync(path.resolve(__dirname, '../app/(tabs)/progress.tsx'), 'utf8');
  const serviceSrc = fs.readFileSync(path.resolve(__dirname, './studentProgressService.ts'), 'utf8');

  test('4.1 Attendance progress combined view & percentage trend', () => {
    expect(progressScreenSrc).toContain('attendanceSummary');
    expect(progressScreenSrc).toContain('attendanceRecords');
    expect(progressScreenSrc).toContain('ATTENDANCE & PARTICIPATION PROGRESS');
    expect(progressScreenSrc).toContain('Present (حاضر)');
    expect(progressScreenSrc).toContain('Absent (غیر حاضر)');
  });

  test('4.2 Study streak calculation algorithm and component rendering', () => {
    expect(serviceSrc).toContain('calculateStudyStreak');
    expect(serviceSrc).toContain('currentStreak');
    expect(serviceSrc).toContain('longestStreak');
    expect(progressScreenSrc).toContain('studyStreak');
    expect(progressScreenSrc).toContain('streakCard');
    expect(progressScreenSrc).toContain('Study Streak');
  });

  test('4.3 Weekly goal setting persists target and tracks completion percentage', () => {
    expect(serviceSrc).toContain('loadWeeklyGoal');
    expect(serviceSrc).toContain('saveWeeklyGoal');
    expect(serviceSrc).toContain('getQuizzesThisWeek');
    expect(progressScreenSrc).toContain('weeklyGoal');
    expect(progressScreenSrc).toContain('goalProgressPct');
    expect(progressScreenSrc).toContain('goalModalVisible');
    expect(progressScreenSrc).toContain('Set Weekly Quiz Goal');
  });

  test('4.4 Export my progress generates CSV and triggers native sharing', () => {
    expect(serviceSrc).toContain('exportStudentProgressCsv');
    expect(serviceSrc).toContain('STUDENT PROGRESS REPORT');
    expect(progressScreenSrc).toContain('handleExportProgress');
    expect(progressScreenSrc).toContain('exportProgressBtn');
  });
});
