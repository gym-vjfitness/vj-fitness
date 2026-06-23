export interface GymSettings {
  id: number;
  admin_upi_id: string;
  bank_account_name: string;
  updated_at?: string;
}

export interface GymSettingsUpdateDTO {
  id: number;
  admin_upi_id: string;
  bank_account_name: string;
  updated_at: string;
}