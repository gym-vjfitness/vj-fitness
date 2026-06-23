export class FormatedDateUtils {
  
  /**
   * 1. GET EXACT UNIVERSAL MOMENT
   * Use for: created_at, updated_at, submitted_at, verified_at
   * Example output: "2026-05-14T09:45:12.000Z"
   */
  static getExactMomentNow(): string {
    return new Date().toISOString();
  }

  /**
   * 2. GET SAFE LOCAL CALENDAR STRING (YYYY-MM-DD)
   * Extracts the pure calendar day without ANY background timezone shifting.
   * Use for: Date Pickers, UI Display strings, calculating math.
   * Example output: "2026-05-14"
   */
  static getLocalCalendarString(dateValue?: string | Date | null): string {
    if (dateValue === null || dateValue === undefined) {
      dateValue = new Date();
    }
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }
    const d = new Date(dateValue);
    
    // Safety check for invalid dates
    if (isNaN(d.getTime())) return '';

    return new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Kolkata', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).format(d);
  }

  /**
   * 3. GET SUPABASE IST TIMESTAMP BOUNDARY
   * Forces the database to accept the date perfectly locked to Indian Midnight boundaries.
   * Use for: start_date, end_date, coupon valid_from/valid_until
   * 
   * @param dateValue The date to process
   * @param isEndOfDay If true, sets time to 23:59:59. If false, sets time to 00:00:00.
   * Example Start output: "2026-05-14T00:00:00+05:30"
   * Example End output: "2026-05-14T23:59:59+05:30"
   */
  static getISTTimestampBoundary(dateValue: string | Date | null, isEndOfDay: boolean = false): string | null {
    if (!dateValue) return null;
    
    const dateStr = this.getLocalCalendarString(dateValue);
    if (!dateStr) return null;

    const timePart = isEndOfDay ? '23:59:59' : '00:00:00';
    return `${dateStr}T${timePart}+05:30`;
  }

  /**
   * 4. ADD DAYS SECURELY (No time shifting)
   * Safely adds duration to a date without accidentally jumping backwards a day.
   * Use for: Calculating subscription end dates based on duration.
   */
  static addDaysToLocal(startDate: string | Date, durationDays: number): string {
    const d = new Date(startDate);
    d.setDate(d.getDate() + durationDays);
    return this.getLocalCalendarString(d);
  }
  
  /**
   * 5. FORMAT DATE FOR UI DISPLAY
   * Formats a raw database string safely for users to read.
   * Example output: "14 May 2026"
   */
  static formatForDisplay(dateString: string | Date | null): string {
    if (!dateString) return 'Not Set';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  }
}