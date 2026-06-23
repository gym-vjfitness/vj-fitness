export interface MemberData {
  id: string;
  height_cm: number;
  weight_kg: number;
  chest_cm?: number;
  waist_cm?: number;
  blood_group: string;
  fitness_goal: string;
  medical_conditions: string;
  injuries_history: string;
}

export interface MeasurementLog {
  id: string;
  weight_kg: number;
  height_cm: number;
  chest_cm?: number;
  waist_cm?: number;
  recorded_at: string;
}