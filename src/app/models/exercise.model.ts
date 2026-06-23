export interface Exercise {
  id: string;
  name: string;
  description?: string | null;
  video_url?: string | null;
  target_muscle_group?: string | null;
  equipment_required?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateExerciseDto {
  name: string;
  description?: string | null;
  video_url?: string | null;
  target_muscle_group?: string | null;
  equipment_required?: string | null;
}

export interface ExerciseSearchResult {
  id: string;
  name: string;
  target_muscle_group: string | null;
}
