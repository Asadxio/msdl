import {
  ISLAMIC_EVENT_TEMPLATES,
  getEventsForHijriYear,
  getHijriDateParts,
  getUpcomingIslamicEvents,
  hijriToGregorianDate,
} from './islamicCalendarService';

describe('Islamic Calendar Service', () => {
  it('converts November 25, 2026 to Jumada al-Thani 1448 AH accurately', () => {
    const parts = getHijriDateParts(new Date(2026, 10, 25, 12, 0, 0));
    expect(parts.year).toBe(1448);
    expect(parts.month).toBe(6);
    expect(parts.day).toBe(15);
    expect(parts.monthName).toBe('Jumada al-Thani');
    expect(parts.formattedWithAH).toContain('15 Jumada al-Thani 1448 AH');
  });

  it('includes all 17 canonical Islamic calendar milestones', () => {
    expect(ISLAMIC_EVENT_TEMPLATES).toHaveLength(17);
    const titles = ISLAMIC_EVENT_TEMPLATES.map((e) => e.title);
    expect(titles).toContain('Islamic New Year');
    expect(titles).toContain('Day of Ashura');
    expect(titles).toContain('Mawlid al-Nabi');
    expect(titles).toContain('Rajab begins');
    expect(titles).toContain("Isra and Mi'raj");
    expect(titles).toContain("Sha'ban begins");
    expect(titles).toContain("Mid-Sha'ban");
    expect(titles).toContain('First day of Ramadan');
    expect(titles).toContain('Last ten nights begin');
    expect(titles).toContain('Laylat al-Qadr');
    expect(titles).toContain('Eid al-Fitr');
    expect(titles).toContain('Six fasts of Shawwal');
    expect(titles).toContain('Dhul Hijjah begins');
    expect(titles).toContain('Day of Tarwiyah');
    expect(titles).toContain('Day of Arafah');
    expect(titles).toContain('Eid al-Adha');
    expect(titles).toContain('Days of Tashriq');
  });

  it('orders upcoming events chronologically starting with Rajab begins on Nov 25, 2026', () => {
    const refNow = new Date(2026, 10, 25, 3, 20, 0);
    const upcoming = getUpcomingIslamicEvents(refNow, 370);
    expect(upcoming.length).toBeGreaterThanOrEqual(14);
    expect(upcoming[0].title).toBe('Rajab begins');
    expect(upcoming[0].hijriYear).toBe(1448);
    expect(upcoming[0].daysRemaining).toBeGreaterThan(0);
    expect(upcoming[0].countdownLabel).toMatch(/^In \d+ days$/);
    expect(upcoming[1].title).toBe("Isra and Mi'raj");

    for (let i = 1; i < upcoming.length; i++) {
      expect(upcoming[i].gregorianDate.getTime()).toBeGreaterThanOrEqual(
        upcoming[i - 1].gregorianDate.getTime()
      );
    }
  });

  it('renders Today badge cleanly when reference date matches event date', () => {
    const rajab1448 = hijriToGregorianDate(1448, 7, 1);
    const upcoming = getUpcomingIslamicEvents(rajab1448, 370);
    expect(upcoming[0].title).toBe('Rajab begins');
    expect(upcoming[0].daysRemaining).toBe(0);
    expect(upcoming[0].countdownLabel).toBe('Today');
  });

  it('generates full 1449 AH year events with valid pill abbreviations and Gregorian dates', () => {
    const events1449 = getEventsForHijriYear(1449, new Date(2026, 10, 25, 12, 0, 0));
    expect(events1449).toHaveLength(17);
    expect(events1449[0].hijriMonthAbbr).toBe('Muh');
    expect(events1449[7].hijriMonthAbbr).toBe('Ram');
    expect(events1449[15].title).toBe('Eid al-Adha');
    expect(events1449[15].gregorianDate.getFullYear()).toBe(2028);
  });
});
