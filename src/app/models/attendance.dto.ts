export class CreateAttendanceDto {
  profile_id!: string;        // uuid
  attendance_date?: string;  // ISO date (YYYY-MM-DD)
  check_in_time?: string;    // ISO datetime
  check_out_time?: string|null;   // ISO datetime
  marked_by?: string;        // uuid
  marked_by_role?: string;   // text
}

export interface AttendanceRecord {
  id: string;
  profile_id?: string;
  attendance_date: string;
  check_in_time: string;
  check_out_time: string | null;
  marked_by?: string;
  marked_by_role?: string;
  created_at?: string;
  updated_at?: string;
}