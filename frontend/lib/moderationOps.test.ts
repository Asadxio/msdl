import { canModerateTarget } from './moderationOps';

describe('moderation scope boundaries', () => {
  it('moderator cannot moderate admin/super_admin/moderator', () => {
    expect(canModerateTarget('moderator', 'admin')).toBe(false);
    expect(canModerateTarget('moderator', 'super_admin')).toBe(false);
    expect(canModerateTarget('moderator', 'moderator')).toBe(false);
  });

  it('admin can moderate moderator but not super_admin', () => {
    expect(canModerateTarget('admin', 'moderator')).toBe(true);
    expect(canModerateTarget('admin', 'super_admin')).toBe(false);
  });
});
