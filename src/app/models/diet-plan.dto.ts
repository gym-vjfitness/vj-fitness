export interface CreateDietPlanDto {
  title: string;
  general_notes?: string | null;
  restricted_foods?: string[];
  recommended_foods?: string[];
  weekly_schedule: any[]; // replace with proper type if you have one
}

// --- Interfaces to type-check your JSON data ---
export interface FoodItem {
  food: string;
  icon: string;
}

export interface Meal {
  mealName: string;
  items: FoodItem[];
}

export interface DaySchedule {
  dayName: string;
  dayNotes?: string;
  meals: Meal[];
}

export interface DietPlan {
  id: string;
  title: string;
  general_notes?: string;
  restricted_foods?: string[];
  recommended_foods?: string[];
  weekly_schedule?: DaySchedule[];
  created_at: string;
  updated_at: string;
}