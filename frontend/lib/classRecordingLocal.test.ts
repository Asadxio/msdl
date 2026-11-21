/**
 * classRecordingLocal.test.ts — Phase P0.1 Verification
 * Comprehensive tests for Strict On-Device Recording, Purdah Privacy,
 * local metadata management, restart recovery, and absence of cloud uploads.
 */
import fs from 'fs';
import path from 'path';

// Mock React Native & Expo modules for unit testing logic
jest.mock('expo-av', () => ({
  Audio: {
    Recording: jest.fn(),
    Sound: {
      createAsync: jest.fn(),
    },
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  },
}));

const mockAsyncStorageData: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockAsyncStorageData[key] || null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockAsyncStorageData[key] = value;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete mockAsyncStorageData[key];
  }),
}));

const mockFileSystemFiles: Record<string, { exists: boolean; size: number; isDirectory: boolean }> = {};
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/com.madrasa.mslb/files/',
  getInfoAsync: jest.fn(async (uri: string) => {
    if (mockFileSystemFiles[uri]) {
      return mockFileSystemFiles[uri];
    }
    return { exists: false, isDirectory: false, size: 0, uri };
  }),
  makeDirectoryAsync: jest.fn(async (uri: string) => {
    mockFileSystemFiles[uri] = { exists: true, size: 0, isDirectory: true };
  }),
  copyAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    const src = mockFileSystemFiles[from];
    mockFileSystemFiles[to] = { exists: true, size: src?.size ?? 1024, isDirectory: false };
  }),
  deleteAsync: jest.fn(async (uri: string) => {
    delete mockFileSystemFiles[uri];
  }),
  readAsStringAsync: jest.fn(async (uri: string) => {
    return mockFileSystemFiles[uri] ? JSON.stringify([]) : '[]';
  }),
  writeAsStringAsync: jest.fn(async (uri: string, contents: string) => {
    mockFileSystemFiles[uri] = { exists: true, size: contents.length, isDirectory: false };
  }),
  readDirectoryAsync: jest.fn(async (dirUri: string) => {
    const prefix = dirUri.endsWith('/') ? dirUri : `${dirUri}/`;
    return Object.keys(mockFileSystemFiles)
      .filter((k) => k.startsWith(prefix) && !mockFileSystemFiles[k].isDirectory)
      .map((k) => k.slice(prefix.length));
  }),
}));

jest.mock('@/lib/firebase', () => ({
  auth: { currentUser: { uid: 'teacher_test_uid' } },
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(async () => ({
    exists: () => true,
    data: () => ({ organization_id: 'org_mslb_default' }),
  })),
  deleteDoc: jest.fn(),
}));

import {
  formatDuration,
  formatFileSize,
  getLocalClassRecordings,
  deleteLocalClassRecording,
  deleteClassRecording,
  recoverLocalRecordingsFromDisk,
  LOCAL_RECORDINGS_DIR,
} from './classRecording';

describe('Phase P0.1 — Strict On-Device Recording Architecture & Security', () => {
  const classRecordingSrc = fs.readFileSync(path.resolve(__dirname, './classRecording.ts'), 'utf8');
  const liveClassScreenSrc = fs.readFileSync(path.resolve(__dirname, '../app/live-class/[id].tsx'), 'utf8');
  const recordingsScreenSrc = fs.readFileSync(path.resolve(__dirname, '../app/recordings.tsx'), 'utf8');

  describe('1. Zero Cloud Upload Enforcement (Purdah Protection)', () => {
    test('classRecording.ts contains NO import of uploadBytes or getDownloadURL', () => {
      expect(classRecordingSrc).not.toContain('uploadBytes');
      expect(classRecordingSrc).not.toContain('getDownloadURL');
      expect(classRecordingSrc).not.toContain("from 'firebase/storage'");
      expect(classRecordingSrc).not.toContain('from "firebase/storage"');
    });

    test('classRecording.ts targets persistent application document storage, not cache', () => {
      expect(classRecordingSrc).toContain('FileSystem.documentDirectory');
      expect(classRecordingSrc).toContain('mslb_teacher_recordings');
      expect(classRecordingSrc).not.toContain('FileSystem.cacheDirectory +');
    });

    test('classRecording.ts logs and documents permanent loss warning on app data clear/uninstall', () => {
      expect(classRecordingSrc).toContain('device loss');
      expect(classRecordingSrc).toContain('uninstall');
      expect(classRecordingSrc.toLowerCase()).toContain('purdah');
    });
  });

  describe('2. UI & Privacy Notices in Screens', () => {
    test('live-class screen alerts teacher with Purdah Notice and uninstall loss warning upon save', () => {
      expect(liveClassScreenSrc).toContain('Recording Saved Locally ✓');
      expect(liveClassScreenSrc).toContain('Purdah & Privacy Protection');
      expect(liveClassScreenSrc).toContain('Uninstalling the app or clearing app data will remove local recordings');
    });

    test('recordings screen displays Purdah & Device Retention banner for teachers', () => {
      expect(recordingsScreenSrc).toContain('purdahBanner');
      expect(recordingsScreenSrc).toContain('Strict On-Device Recording (Purdah Protection)');
      expect(recordingsScreenSrc).toContain('Device loss, clearing app data, or uninstalling will permanently remove local recordings');
    });

    test('recordings screen displays On-Device Only badge and suppresses external open/download for local files', () => {
      expect(recordingsScreenSrc).toContain('localPurdahBadge');
      expect(recordingsScreenSrc).toContain('On-Device Only • Purdah Protected');
      expect(recordingsScreenSrc).toContain('!item.is_local_only');
    });
  });

  describe('3. Formatting Utilities', () => {
    test('formatDuration correctly handles 0, seconds, minutes, and hours', () => {
      expect(formatDuration(0)).toBe('00:00');
      expect(formatDuration(45)).toBe('00:45');
      expect(formatDuration(65)).toBe('01:05');
      expect(formatDuration(3665)).toBe('1:01:05');
    });

    test('formatFileSize correctly formats bytes into KB and MB', () => {
      expect(formatFileSize(0)).toBe('0.0 KB');
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1048576)).toBe('1.0 MB');
      expect(formatFileSize(5242880)).toBe('5.0 MB');
    });
  });

  describe('4. Local Listing, File Verification & Deletion', () => {
    const teacherUid = 'teacher_xyz';
    const storageKey = `@mslb_teacher_recordings_v1_${teacherUid}`;
    const testFileUri = `${LOCAL_RECORDINGS_DIR}2026-10-24_Test_Class.m4a`;

    beforeEach(() => {
      for (const k in mockAsyncStorageData) delete mockAsyncStorageData[k];
      for (const k in mockFileSystemFiles) delete mockFileSystemFiles[k];
    });

    test('getLocalClassRecordings returns items whose physical file exists on disk', async () => {
      // Setup file on mock disk
      mockFileSystemFiles[testFileUri] = { exists: true, size: 2048, isDirectory: false };

      const sampleRec = {
        id: 'rec_local_123',
        title: 'Fiqh Class — 24 Oct 2026',
        description: 'On-device recording',
        file_url: testFileUri,
        file_uri: testFileUri,
        storage_path: 'recordings/2026-10-24_Test_Class.m4a',
        course_id: 'course_fiqh',
        class_id: 'class_1',
        teacher_id: teacherUid,
        teacher_name: 'Ustaadha Fatima',
        organization_id: 'org_mslb_default',
        duration_sec: 1800,
        size_bytes: 2048,
        is_local_only: true,
        created_at: new Date().toISOString(),
      };

      mockAsyncStorageData[storageKey] = JSON.stringify([sampleRec]);

      const records = await getLocalClassRecordings(teacherUid);
      expect(records).toHaveLength(1);
      expect(records[0].id).toBe('rec_local_123');
      expect(records[0].size_bytes).toBe(2048);
    });

    test('getLocalClassRecordings filters out orphaned metadata whose file was deleted from disk', async () => {
      // File does NOT exist in mockFileSystemFiles
      const sampleRec = {
        id: 'rec_local_missing',
        title: 'Missing File',
        file_url: `${LOCAL_RECORDINGS_DIR}missing.m4a`,
        file_uri: `${LOCAL_RECORDINGS_DIR}missing.m4a`,
        storage_path: '',
        course_id: 'c1',
        class_id: 'cl1',
        teacher_id: teacherUid,
        teacher_name: 'Ustaadha',
        organization_id: 'org_default',
        duration_sec: 100,
        size_bytes: 100,
      };

      mockAsyncStorageData[storageKey] = JSON.stringify([sampleRec]);

      const records = await getLocalClassRecordings(teacherUid);
      expect(records).toHaveLength(0);
    });

    test('deleteLocalClassRecording deletes physical file from storage and prunes metadata', async () => {
      mockFileSystemFiles[testFileUri] = { exists: true, size: 2048, isDirectory: false };
      const sampleRec = {
        id: 'rec_local_del',
        title: 'To Be Deleted',
        file_url: testFileUri,
        file_uri: testFileUri,
        storage_path: '',
        course_id: 'c1',
        class_id: 'cl1',
        teacher_id: teacherUid,
        teacher_name: 'Ustaadha',
        organization_id: 'org_default',
        duration_sec: 100,
        size_bytes: 2048,
      };
      mockAsyncStorageData[storageKey] = JSON.stringify([sampleRec]);

      const success = await deleteLocalClassRecording('rec_local_del', teacherUid);
      expect(success).toBe(true);
      expect(mockFileSystemFiles[testFileUri]).toBeUndefined();

      const remaining = await getLocalClassRecordings(teacherUid);
      expect(remaining).toHaveLength(0);
    });

    test('deleteClassRecording delegates rec_local_ IDs to local deletion without remote calls', async () => {
      mockFileSystemFiles[testFileUri] = { exists: true, size: 4096, isDirectory: false };
      const sampleRec = {
        id: 'rec_local_universal',
        title: 'Universal Delete Test',
        file_url: testFileUri,
        file_uri: testFileUri,
        storage_path: '',
        course_id: 'c1',
        class_id: 'cl1',
        teacher_id: 'teacher_test_uid', // matches auth.currentUser.uid
        teacher_name: 'Ustaadha',
        organization_id: 'org_default',
        duration_sec: 100,
        size_bytes: 4096,
      };
      mockAsyncStorageData['@mslb_teacher_recordings_v1_teacher_test_uid'] = JSON.stringify([sampleRec]);

      const result = await deleteClassRecording('rec_local_universal');
      expect(result.success).toBe(true);
      expect(result.localDeleted).toBe(true);
      expect(result.firestoreDeleted).toBe(false);
      expect(result.storageDeleted).toBe(false);
    });
  });

  describe('5. App Restart Recovery from Disk', () => {
    test('recoverLocalRecordingsFromDisk recovers unindexed .m4a audio files into catalog', async () => {
      const teacherUid = 'teacher_recovery_test';
      const storageKey = `@mslb_teacher_recordings_v1_${teacherUid}`;

      // Mark the directory as existing
      mockFileSystemFiles[LOCAL_RECORDINGS_DIR] = { exists: true, size: 0, isDirectory: true };

      // Simulate an unindexed .m4a file surviving an app crash or reinstall
      const orphanUri = `${LOCAL_RECORDINGS_DIR}2026-10-24_Tajweed_CrashRecovery.m4a`;
      mockFileSystemFiles[orphanUri] = { exists: true, size: 8192, isDirectory: false };

      // Metadata is currently empty
      mockAsyncStorageData[storageKey] = JSON.stringify([]);

      const recovered = await recoverLocalRecordingsFromDisk(teacherUid);
      expect(recovered.length).toBeGreaterThanOrEqual(1);

      const recoveredItem = recovered.find((r) => r.file_url === orphanUri);
      expect(recoveredItem).toBeDefined();
      expect(recoveredItem?.title).toContain('Tajweed CrashRecovery');
      expect(recoveredItem?.size_bytes).toBe(8192);
      expect(recoveredItem?.is_local_only).toBe(true);
    });
  });
});
