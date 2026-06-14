# Quiz & Learning System Documentation

## Learning hierarchy
- `courses` define top-level learning offerings.
- `categories`, `modules`, `lessons`, and `assignments` model structured content.
- `audio_lessons` and `recordings` provide recorded media.
- `enrollments` connect students to courses.
- `lesson_progress`, `submissions`, `quiz_results`, and `certificates` track outcomes.

## Quiz flow
1. Student opens quiz hub or lesson quiz.
2. Quiz metadata is read if content visibility/enrollment permits.
3. Submission goes through `/api/lms/quiz/submit` for validation and anti-abuse/idempotency.
4. Result is stored in `quiz_results`; progress/certificate eligibility can update separately.

## Security
- Students can create only their own quiz results with score/total/timestamp fields allowed by rules.
- Quiz definitions are admin-managed.
- Backend quiz security helpers provide nonce/attempt lock/timing validation.
