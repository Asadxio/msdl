import { describe, it, expect } from '@jest/globals';

describe('moderation anti-abuse heuristics', () => {
  it('basic sentinel', () => {
    expect(30_000).toBeGreaterThan(0);
  });
});
