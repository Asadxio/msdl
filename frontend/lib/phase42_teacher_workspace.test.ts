import fs from 'fs';
import path from 'path';

describe('Phase 42 — Teacher Workspace & Automation Engine', () => {
  const liveClassSrc = fs.readFileSync(path.resolve(__dirname, '../app/live-class/[id].tsx'), 'utf8');
  const recordingsSrc = fs.readFileSync(path.resolve(__dirname, '../app/recordings.tsx'), 'utf8');
  const teacherDashSrc = fs.readFileSync(path.resolve(__dirname, '../components/teacher/TeacherDashboard.tsx'), 'utf8');

  test('live-class/[id].tsx contains 1-tap in-class attendance register and modal', () => {
    expect(liveClassSrc).toContain('attendanceModalVisible');
    expect(liveClassSrc).toContain('handleOpenAttendanceModal');
    expect(liveClassSrc).toContain('handleSubmitInClassAttendance');
    expect(liveClassSrc).toContain('attendanceStudents');
    expect(liveClassSrc).toContain('marked_by');
    expect(liveClassSrc).toContain('live_class');
    expect(liveClassSrc).toContain('attModalOverlay');
  });

  test('recordings.tsx supports attaching, editing, and reading Dars Notes', () => {
    expect(recordingsSrc).toContain('notes_text');
    expect(recordingsSrc).toContain('modalNotesSection');
    expect(recordingsSrc).toContain('editingNotesModal');
    expect(recordingsSrc).toContain('notesTextInput');
    expect(recordingsSrc).toContain('Dars Notes & Tajweed Rules');
  });

  test('TeacherDashboard.tsx contains 7-day visual weekly timetable & automation widget', () => {
    expect(teacherDashSrc).toContain('Weekly Teaching Timetable');
    expect(teacherDashSrc).toContain('daysStripRow');
    expect(teacherDashSrc).toContain('dayPill');
    expect(teacherDashSrc).toContain('timetableContentCard');
    expect(teacherDashSrc).toContain('timetableAttendanceBtn');
    expect(teacherDashSrc).toContain('timetableLaunchBtn');
  });
});
