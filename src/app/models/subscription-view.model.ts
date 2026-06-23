// subscription-view.model.ts
export interface SubscriptionFeature {
    id: string;
    name: string;
}

export interface SubscriptionPrice {
    id: string;
    name: string;
    price: number;
    duration_in_days: number;
}

export interface SubscriptionPlan {
    id: string;
    name: string;
    description: string;
    is_active: boolean;
    plan_features: SubscriptionFeature[];
    plan_prices: SubscriptionPrice[];
}

export interface seletedSubscriptionPlan {
    id: string;
    name: string;
    plan_features: string[];
    plan_price: SubscriptionPrice;
}