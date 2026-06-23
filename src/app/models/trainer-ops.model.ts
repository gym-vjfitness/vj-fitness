export type TrainerAttendanceStatus = 'pending' | 'approved' | 'rejected';
export type TrainerPaymentStatus = 'completed' | 'pending' | 'failed';
export type TrainerPaymentMode = 'cash' | 'upi' | 'bank' | 'cheque' | 'other';

export interface TrainerMini {
  id: string;
  full_name: string | null;
}

export interface TrainerAttendanceRow {
  id: string;
  trainer_profile_id: string;
  attendance_date: string;
  start_time: string;
  end_time: string;
  status: TrainerAttendanceStatus;
  profiles?: {
    full_name: string | null;
  } | null;
}

export interface TrainerPaymentRow {
  id: string;
  trainer_profile_id: string;
  salary_month: string;
  amount: number;
  payment_date: string;
  payment_mode: TrainerPaymentMode;
  profiles?: {
    full_name: string | null;
  } | null;
}

export interface TrainerPaymentSnapshot {
  total_paid: number;
  current_month_paid: number;
  completed_count: number;
  last_payment_date: string | null;
  last_five_months: { month: string; total: number }[];
}

export interface TrainerAttendanceSnapshot {
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  current_month_days: number;
  current_month_hours: number;
}