export interface MemberDto {
  profile_id: string|undefined;
  height_cm: number;
  weight_kg: number;
  chest_cm?: number;
  waist_cm?: number;
  blood_group: string;
  fitness_goal: string;
  medical_conditions?: string;
  injuries_history?: string;
}