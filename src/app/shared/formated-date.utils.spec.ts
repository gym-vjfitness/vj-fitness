import { FormatedDateUtils } from './formated-date.utils';

describe('FormatedDateUtils', () => {
  describe('getLocalCalendarString', () => {
    it('should format a Date object to YYYY-MM-DD', () => {
      const date = new Date('2026-06-17T12:00:00Z');
      const result = FormatedDateUtils.getLocalCalendarString(date);
      expect(result).toBe('2026-06-17');
    });

    it('should format a string date to YYYY-MM-DD', () => {
      const result = FormatedDateUtils.getLocalCalendarString('2026-06-17');
      expect(result).toBe('2026-06-17');
    });
  });

  describe('getISTTimestampBoundary', () => {
    it('should get start of day timestamp in IST boundary', () => {
      const result = FormatedDateUtils.getISTTimestampBoundary('2026-06-17', false);
      expect(result).toBe('2026-06-17T00:00:00+05:30');
    });

    it('should get end of day timestamp in IST boundary', () => {
      const result = FormatedDateUtils.getISTTimestampBoundary('2026-06-17', true);
      expect(result).toBe('2026-06-17T23:59:59+05:30');
    });
  });

  describe('addDaysToLocal', () => {
    it('should add days correctly without rolling over', () => {
      const result = FormatedDateUtils.addDaysToLocal('2026-05-31', 30);
      expect(result).toBe('2026-06-30');
    });
  });

  describe('formatForDisplay', () => {
    it('should format a date safely for display', () => {
      const result = FormatedDateUtils.formatForDisplay('2026-06-17');
      expect(result).toBe('17 Jun 2026');
    });
  });
});
