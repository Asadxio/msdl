# Audio Lessons Production Guide

Audio Lessons is the primary recorded lesson system. Teachers/admins can either record M4A audio directly inside the app with the device microphone or upload an existing MP3/M4A/AAC lecture after class. Students stream, pause/resume, seek, and optionally download lessons from each course page.

## Recommended audio formats

- **In-app recording:** M4A (`audio/mp4`) using AAC at Expo AV high-quality settings.
- **Uploaded files:** MP3 (`audio/mpeg`), M4A (`audio/mp4` or `audio/x-m4a`), or AAC (`audio/aac`).
- **Best default:** M4A/MP3 voice audio at **64–96 kbps** for lower storage cost while preserving lecture clarity.

## Recommended max upload size

- App limit: **100 MB per audio lesson**.
- Recommended operating target: **30–60 MB per one-hour class** at 64–96 kbps.
- If a lecture is larger than 100 MB, split it into Part 1 / Part 2 before publishing.

## One-year storage estimate

Assumption: 1-hour lectures encoded around 64 kbps.

- Approximate size per class: **30 MB**.
- 1 class/day for 365 days: **~11 GB/year**.
- 3 classes/day for 365 days: **~33 GB/year**.
- 10 classes/day for 365 days: **~110 GB/year**.

Add 20–30% headroom for retries, higher-bitrate uploads, and accidental duplicates during teacher training.

## Firestore schema

Collection: `audio_lessons/{audioLessonId}`

Required fields:

```json
{
  "title": "Qur'an Tafseer - Surah Al-Fatiha",
  "description": "Post-class audio lecture",
  "course_id": "course_id",
  "teacher_id": "firebase_teacher_uid",
  "duration": 3600,
  "upload_date": "server timestamp",
  "updated_at": "server timestamp",
  "audio_url": "https://firebasestorage.googleapis.com/...",
  "file_size": 31457280,
  "file_name": "lesson.m4a",
  "mime_type": "audio/mp4",
  "storage_path": "audio_lessons/course_id/teacher_uid/timestamp_lesson.m4a",
  "title_lower": "qur'an tafseer - surah al-fatiha"
}
```

`title_lower` powers prefix search by lesson title. `duration` is stored in seconds. `file_size` is stored in bytes.

## Firebase Storage path

```text
audio_lessons/{courseId}/{teacherId}/{timestamp_fileName}
```

Only the uploading teacher or an admin can manage lesson metadata. Signed-in users can read audio lessons.

## Recording behavior

- Start, pause, resume, and stop controls are available inside the Audio Lesson modal for teachers/admins.
- Recordings are saved as M4A/AAC using Expo AV.
- The recording timer updates during capture.
- If the app backgrounds while recording, the recording is paused to protect the file and prevent silent/corrupt recordings.
- After stop, the app shows duration and file size before upload.
- Upload progress and retry are shown before publishing.

## Production readiness checklist

- [ ] Firebase Storage rules deployed with `audio_lessons/{courseId}/{teacherId}/{fileName}` write restrictions.
- [ ] Firestore rules deployed with `audio_lessons` validation.
- [ ] Composite indexes created if Firestore prompts for them:
  - `audio_lessons`: `course_id ASC`, `upload_date DESC`
  - `audio_lessons`: `course_id ASC`, `title_lower ASC`
- [ ] Teacher/admin devices tested for microphone permission, start, pause, resume, stop, rename, upload, retry, edit, and delete.
- [ ] Student devices tested for stream, play, pause, 15-second seek backward/forward, and download/share.
- [ ] Audio files compressed to 64–96 kbps before manual upload.
- [ ] Firebase Storage budget alerts enabled.
- [ ] Course page tested with at least 50 audio lessons to verify pagination.
- [ ] App backgrounding/interruption tested during active recording.
