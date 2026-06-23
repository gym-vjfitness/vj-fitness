export type SubscriptionStatus = 
    | 'PENDING'   
    | 'ACTIVE'    
    | 'REJECTED'  
    | 'PAUSED'    
    | 'CANCELLED' 
    | 'EXPIRED';  

export interface UserSubscription {       
    profile_id: string; // Linked directly to public.profiles

    // Reference Keys
    original_plan_id: string;
    original_price_id: string;

    // The Immutable Snapshot
    purchased_plan_name: string;
    purchased_price: number;             
    purchased_duration_days: number;
    purchased_features: string[]; 

    // Lifecycle State
    status: SubscriptionStatus;
    transaction_id: string | null; // Added transaction_id here

    // Time Management
    requested_at: string;      
    start_date: string | null; 
    end_date: string | null;   

    // Pause Management
    paused_at: string | null;  
    pause_reason: string | null; 
    coins_used:number;
    coupon_code:string|null;
    coupon_discount:number;  
}

export interface SubscriptionDetail {
  id: string;
  purchased_plan_name: string;
  purchased_price: number;
  purchased_duration_days: number;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'PAUSED' | 'CANCELLED' | 'EXPIRED' | 'PENDING_VERIFICATION';
  start_date: string | null;
  end_date: string | null;
  transaction_id: string | null;
}

export interface SubscriptionMetaInfo {
    id:string,
    status:string,
    transaction_id:string,
    purchased_price:string,
    purchased_plan_name:string
}


export type PaymentStatus = 'PENDING' | 'PENDING_VERIFICATION' | 'PAID' | 'REJECTED';

export interface SubscriptionPayment {
  id: string;
  subscription_id: string;
  amount: number;
  installment_number: number;
  due_date: string;
  utr_number: string | null;
  status: PaymentStatus;
  submitted_at: string | null;
  verified_at: string | null;
}