import { Injectable, inject, signal } from '@angular/core';
import { GymSettings, GymSettingsUpdateDTO } from '../models/upi.model'; 
import { SupabaseService } from './supabase-service';

@Injectable({
  providedIn: 'root',
})
export class SettingService {
  private supabaseService = inject(SupabaseService);

  // --- Cache Signals (Prevents unwanted API calls on tab switch) ---
  private cachedSettings = signal<GymSettings | null>(null);
  private settingsFetched = signal<boolean>(false);
  
  private cachedLocation = signal<[number, number] | null>(null);
  private locationFetched = signal<boolean>(false);

  // ==========================================
  // UPI & BANK SETTINGS METHODS
  // ==========================================
  async getSettings(): Promise<GymSettings | null> {
    // Return cached data immediately if already fetched in memory
    if (this.settingsFetched()) {
      return this.cachedSettings();
    }

    // Check localStorage cache
    if (typeof window !== 'undefined' && window.localStorage) {
      const local = localStorage.getItem('gym_settings');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          this.cachedSettings.set(parsed);
          this.settingsFetched.set(true);
          // Trigger a background fetch to ensure it's up to date
          this.fetchSettingsBackground();
          return parsed;
        } catch (e) {}
      }
    }

    return this.fetchSettingsBackground();
  }

  private async fetchSettingsBackground(): Promise<GymSettings | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('gym_settings')
        .select('id, admin_upi_id, bank_account_name, updated_at')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching settings:', error);
        return null;
      }

      this.cachedSettings.set(data);
      this.settingsFetched.set(true);
      if (data && typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('gym_settings', JSON.stringify(data));
      }
      return data;
    } catch (e) {
      return this.cachedSettings();
    }
  }

  async upsertSettings(settings: Omit<GymSettingsUpdateDTO, 'id'>) {
    const { data, error } = await this.supabaseService.client
      .from('gym_settings')
      .upsert({ 
        id: 1, 
        admin_upi_id: settings.admin_upi_id,
        bank_account_name: settings.bank_account_name,
        updated_at: settings.updated_at
      })
      .select()
      .single();

    if (error) throw error;

    this.cachedSettings.set(data);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('gym_settings', JSON.stringify(data));
    }
    
    return data;
  }

  // ==========================================
  // LOCATION METHODS 
  // ==========================================
  async getLocation(): Promise<[number, number] | null> {
    if (this.locationFetched()) {
      return this.cachedLocation();
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      const local = localStorage.getItem('gym_location');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          this.cachedLocation.set(parsed);
          this.locationFetched.set(true);
          // Trigger background fetch to verify location
          this.fetchLocationBackground();
          return parsed;
        } catch (e) {}
      }
    }

    return this.fetchLocationBackground();
  }

  private async fetchLocationBackground(): Promise<[number, number] | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('gym_settings')
        .select('location')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching location:', error);
        return null;
      }

      const locationData = data?.location && data.location.length === 2 
        ? [data.location[0], data.location[1]] as [number, number] 
        : null;

      this.cachedLocation.set(locationData);
      this.locationFetched.set(true);
      if (locationData && typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('gym_location', JSON.stringify(locationData));
      }
      
      return locationData;
    } catch (e) {
      return this.cachedLocation();
    }
  }

  async updateLocation(location: [number, number]) {
    const { data, error } = await this.supabaseService.client
      .from('gym_settings')
      .update({ location: location })
      .eq('id', 1)
      .select('location')
      .single();

    if (error) throw error;
    
    const locationData = [data.location[0], data.location[1]] as [number, number];
    this.cachedLocation.set(locationData);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('gym_location', JSON.stringify(locationData));
    }
    return data;
  }
}