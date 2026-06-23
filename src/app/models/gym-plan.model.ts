// gym-plan.model.ts
export interface PlanFeatureDTO {
  id?: string;
  plan_id?: string;
  name: string;
}

export interface PlanPriceDTO {
  id?: string;
  plan_id?: string;
  name: string;
  price: number;
  duration_in_days: number;
  is_active?: boolean;
}

export interface GymPlanDTO {
  id?: string;
  name: string;
  description: string;
  is_active?: boolean;
  plan_prices?: PlanPriceDTO[];
  plan_features?: PlanFeatureDTO[]; // <-- Added features
}