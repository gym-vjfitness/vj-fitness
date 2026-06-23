// ==========================================
// 1. WRITE MODELS (For Signup/Sending)
// ==========================================

/**
 * The "Extra Data" that sits inside Supabase Auth Metadata.
 * This MUST match the keys in your Postgres Trigger exactly.
 */
export interface UserMetadata {
  full_name: string;
  phone: string;
  user_role: string;
  gender: 'Male' | 'Female' | 'Other' | string; // Union type for better safety
  date_of_birth: string; // Format: 'YYYY-MM-DD'
  address: string;
  is_active: boolean,
  new_user: boolean
  avatar_url?: string | null;
}

/**
 * The complete payload sent to supabase.auth.signUp()
 */
export interface SignupPayload {
  email: string;
  password: string;
  options: {
    data: UserMetadata; // This ensures you never miss a field
  };
}


// ==========================================
// 2. READ MODELS (For Displaying/Fetching)
// ==========================================

/**
 * Represents a single row in the 'public.profiles' table.
 * Use this when fetching data: supabase.from('profiles').select('*')
 */
export interface UserProfile {
  id: string; // UUID
  user_role: 'member' | 'trainer' | 'admin';
  email: string;

  // These might be null in the DB, so we mark them optional (?)
  full_name: string;
  phone?: string;
  gender?: string;
  address?: string;
  date_of_birth?: string; // Postgres Date returns as string
  avatar_url?: string;
  new_user: boolean;
  is_active: boolean;
  created_at: string; // ISO Timestamp
  updated_at: string; // ISO Timestamp
  // these 2 are added for join condition and fetching data from members table...
  exercise_plan_id?:string;
  diet_plan_id?:string;
  temp_pass?:boolean;
  last_message_sent_at?:string
}

export interface ProfileShortInfoDto {
  id: string;
  user_role: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}