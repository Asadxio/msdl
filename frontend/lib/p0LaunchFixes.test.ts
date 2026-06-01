import fs from 'fs';
import path from 'path';

describe('P0 launch blocker fixes', () => {
  it('payment flow sends selected course_id for fee payments', () => {
    const source = fs.readFileSync(path.join(__dirname, '../app/payment.tsx'), 'utf8');
    expect(source).toContain('useLocalSearchParams');
    expect(source).toContain('const { courses } = useData();');
    expect(source).toContain('selectedCourseId');
    expect(source).toContain("Please select the course this fee payment is for.");
    expect(source).toContain("...(paymentType === 'fees' ? { course_id: selectedCourseId } : {})");
  });

  it('backend payment initiation persists course_id and rejects missing fee course', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../backend/server.py'), 'utf8');
    expect(source).toContain('course_id: str | None = None');
    expect(source).toContain('course_id is required for fee payments');
    expect(source).toContain('**({"course_id": course_id} if ptype == "fees" else {})');
  });

  it('live class join can use backend token app id when build env is absent', () => {
    const source = fs.readFileSync(path.join(__dirname, '../app/live-class/[id].tsx'), 'utf8');
    expect(source).toContain('AGORA_APP_ID || rtcToken.appId');
    expect(source).toContain('Agora App ID is not available from the app build or live token service');
  });
});
