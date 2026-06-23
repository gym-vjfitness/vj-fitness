
export interface CouponDTO {
  id?: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  max_discount?: number | null;
  max_usage?: number | null;
  used_count?: number;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active?: boolean;
  created_at?: string;
}

export interface CouponPreviewResponse {
  is_valid: boolean;
  original_price: number;
  discount_amount: number;
  final_price: number;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  max_discount: number | null;
  message: string;
}