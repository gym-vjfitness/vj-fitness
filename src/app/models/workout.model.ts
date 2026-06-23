export interface WorkoutExercise {
  exercise_id: string;
  name: string;
  trackingType: 'reps' | 'time';
  sets: number;
  restSeconds?: number;
  notes?: string;
  setDetails: number[];
}

export interface WorkoutDay {
  dayName: string;
  focusMuscle?: string;
  dayNotes?: string;
  exercises: WorkoutExercise[];
}

// --- Supabase Database Models ---

// Used when inserting a brand new plan
export interface WorkoutPlanInsert {
  heading: string;
  goal_type: string;
  difficulty_level: string;
  target_audience: string;
  description?: string;
  schedule_data: WorkoutDay[];
}

// Used for list views/pagination (Lightweight)
export interface WorkoutMetaDataDto {
  id?: string;
  heading: string;
  goal_type: string;
  difficulty_level: string;
  target_audience: string;
  created_at?: string;
}

// Used for fetching the full plan to view/edit (Heavyweight)
export interface WorkoutPlanDetails {
  id?: string;
  heading: string;
  goal_type: string;
  difficulty_level: string;
  target_audience: string;
  description: string;
  schedule_data: WorkoutDay[];
  created_at?: string;
  updated_at?: string;
}