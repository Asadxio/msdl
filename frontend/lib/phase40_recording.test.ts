import fs from 'fs';
import path from 'path';

describe('Phase 40 — Live Class Inbuilt Audio Recording & Library Audit', () => {
  const classRecordingSrc = fs.readFileSync(path.resolve(__dirname, './classRecording.ts'), 'utf8');
  const liveClassScreenSrc = fs.readFileSync(path.resolve(__dirname, '../app/live-class/[id].tsx'), 'utf8');
  const recordingsScreenSrc = fs.readFileSync(path.resolve(__dirname, '../app/recordings.tsx'), 'utf8');
  const firestoreRulesSrc = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');
  const storageRulesSrc = fs.readFileSync(path.resolve(__dirname, '../../storage.rules'), 'utf8');

  test('classRecording.ts provides start, stopAndSave, and delete helpers', () => {
    expect(classRecordingSrc).toContain('startClassRecording');
    expect(classRecordingSrc).toContain('stopAndSaveRecording');
    expect(classRecordingSrc).toContain('deleteClassRecording');
    expect(classRecordingSrc).toContain('formatDuration');
    expect(classRecordingSrc).toContain('formatFileSize');
    expect(classRecordingSrc).toContain('recordings/');
  });

  test('live-class screen includes teacher audio recording controls', () => {
    expect(liveClassScreenSrc).toContain('handleStartAudioRecording');
    expect(liveClassScreenSrc).toContain('handleStopAndSaveAudioRecording');
    expect(liveClassScreenSrc).toContain('isRecording');
    expect(liveClassScreenSrc).toContain('isSavingRecording');
    expect(liveClassScreenSrc).toContain('Inbuilt Class Audio Recording');
    expect(liveClassScreenSrc).toContain('Start Audio Recording');
    expect(liveClassScreenSrc).toContain('Stop & Save Class Recording');
  });

  test('recordings screen has in-app player and metadata', () => {
    expect(recordingsScreenSrc).toContain('handleTogglePlayback');
    expect(recordingsScreenSrc).toContain('soundObj');
    expect(recordingsScreenSrc).toContain('activePlayingId');
    expect(recordingsScreenSrc).toContain('miniPlayer');
    expect(recordingsScreenSrc).toContain('Listen In-App');
    expect(recordingsScreenSrc).toContain('durationBadge');
    expect(recordingsScreenSrc).toContain('teacher_name');
  });

  test('firestore.rules allows teachers to create recordings', () => {
    expect(firestoreRulesSrc).toContain('match /recordings/{recordingId}');
    expect(firestoreRulesSrc).toContain('allow create: if isTeacherOrAdmin()');
  });

  test('storage.rules allows teachers to upload class recordings to storage', () => {
    expect(storageRulesSrc).toContain('match /recordings/{classId}/{fileName}');
    expect(storageRulesSrc).toContain('allow create, update: if isTeacherOrAdmin()');
  });
});
