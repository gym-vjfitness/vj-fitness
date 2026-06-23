import { inject, Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { UserProfile } from '../models/user.model';
import { Router } from '@angular/router';
import { StorageService } from './storage-service';
import { ToastService } from './toast-service';

@Injectable({
  providedIn: 'root' 
})
export class SupabaseService {
  private router = inject(Router);
  private storageService = inject(StorageService);
  private toastService = inject(ToastService);

  private isHandlingAuthError = false;
  private hasInitialized = false;

  private supabase: SupabaseClient = createClient(
    environment.supabaseUrl, 
    environment.supabaseKey, 
    {
      global: {
        fetch: async (url, options) => {
          const response = await fetch(url, options);

          // INTERCEPTOR: Catch global 401/403 evictions
          if ((response.status === 401 || response.status === 403) && !this.isHandlingAuthError) {
            this.isHandlingAuthError = true;
            
            const isAuthApi = url.toString().includes('/auth/v1/');
            const errorMessage = isAuthApi
              ? 'Session expired or logged in elsewhere. Please log in again.'
              : 'Access revoked or subscription expired. Please log in again.';

            setTimeout(() => this.handleForceLogout(errorMessage), 0);
          }
          return response;
        }
      }
    }
  );

  currentUser = signal<UserProfile | null>(null);

  constructor() {
    this.initializeAuth();
  }

  get client() {
    return this.supabase;
  }

  async initializeAuth() {
    if (this.hasInitialized) return; 
    this.hasInitialized = true;

    // 1. ALWAYS ATTACH LISTENER FIRST
    this.supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
           const currentCache = localStorage.getItem("user");
           if (!currentCache || JSON.parse(currentCache).id !== session.user.id) {
               await this.fetchAndStoreProfile(session.user.id);
           } else {
               this.currentUser.set(JSON.parse(currentCache));
           }
        }
      } else if (event === 'SIGNED_OUT') {
        this.currentUser.set(null);
        localStorage.removeItem("user"); 
        this.storageService.clearAll();
      }
    });

    // 2. CHECK LOCAL STORAGE SESSION FIRST
    const { data: sessionData } = await this.supabase.auth.getSession();
    
    // If no local session exists, stop the bootup check (user is just at the login screen)
    if (!sessionData.session) {
      return;
    }

    // 3. THE HARD PING (Verifies local session with the server)
    const { data: userData, error } = await this.supabase.auth.getUser();

    if (error || !userData?.user) {
      return; 
    }

    // 4. LOAD VALID PROFILE
    const storedUserRaw = localStorage.getItem("user");
    if (storedUserRaw) {
      const parsedUser: UserProfile = JSON.parse(storedUserRaw);
      if (parsedUser.id === userData.user.id) {
        this.currentUser.set(parsedUser);
      } else {
        await this.fetchAndStoreProfile(userData.user.id);
      }
    } else {
      await this.fetchAndStoreProfile(userData.user.id);
    }
  }

  private async fetchAndStoreProfile(userId: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select(`
        *,
        members!members_profile_id_fkey (
          diet_plan_id,
          exercise_plan_id
        )
      `)
      .eq('id', userId)
      .single(); 

    if (error) {
      console.error("Profile fetch failed:", error);
      this.handleForceLogout('Your account is inactive or access has been revoked.');
      return; 
    }

    if (data) {
      const memberData = Array.isArray(data.members) ? data.members[0] : data.members;

      const enrichedProfile: UserProfile = {
        ...data,
        diet_plan_id: memberData?.diet_plan_id || null,
        exercise_plan_id: memberData?.exercise_plan_id || null
      };

      delete (enrichedProfile as any).members;

      this.currentUser.set(enrichedProfile);
      localStorage.setItem("user", JSON.stringify(enrichedProfile));
    }
  }

  public async handleForceLogout(message: string) {
    this.toastService.error(message);
    
    try {
      await this.supabase.auth.signOut();
    } catch (e) {}

    this.currentUser.set(null);
    localStorage.clear();
    this.storageService.clearAll();
    this.isHandlingAuthError = false;

    this.router.navigate(['/auth/login'], { replaceUrl: true });
  }

  async logout() {
    try {
       await this.supabase.auth.signOut();
       this.currentUser.set(null);
       localStorage.clear();
       this.storageService.clearAll();
       await this.router.navigate(['/auth/login'], { replaceUrl: true });
       window.location.reload();
    } catch (error) {
       this.currentUser.set(null);
       localStorage.clear();
       await this.router.navigate(['/auth/login'], { replaceUrl: true });
       window.location.reload();
    }
  }

  async getSession() {
    const { data } = await this.supabase.auth.getSession();
    return data.session;
  }

 // =====================================================================
  // NEW METHOD: Safely handles updating the user password via Supabase.
  // Requires user to exist in the session and throws explicit errors
  // that the component catches to trigger Toasts.
  // =====================================================================
  async updatePasswordWithVerification(oldPassword: string, newPassword: string): Promise<boolean> {
    const { data: { user }, error: userError } = await this.supabase.auth.getUser();
    
    if (userError || !user?.email || !user?.id) {
      throw new Error('Could not identify your current session. Please log out and log back in.');
    }

    // 1. Verify old password by attempting to re-authenticate
    const { error: signInError } = await this.supabase.auth.signInWithPassword({
      email: user.email,
      password: oldPassword,
    });

    if (signInError) {
      throw new Error('Incorrect current password.');
    }

    // 2. Update to the new password in Supabase Auth
    const { error: updateError } = await this.supabase.auth.updateUser({
      password: newPassword
    });

    if (updateError) {
      throw new Error(updateError.message);
    }
    
    // 3. ONLY executes if password was updated successfully above
    const { error: profileError } = await this.supabase
      .from('profiles')
      .update({ temp_pass: false })
      .eq('id', user.id);

    if (profileError) {
      // Logging it so developers know, but we don't throw an error to the UI 
      // because the primary action (password reset) was actually successful.
      console.error('Password updated, but failed to clear temp_pass flag in profiles:', profileError.message);
    } else {
      // 4. Update the local signal and cache so the app instantly reflects the change
      const currentProfile = this.currentUser();
      if (currentProfile) {
        const updatedProfile = { ...currentProfile, temp_pass: false };
        this.currentUser.set(updatedProfile);
        localStorage.setItem("user", JSON.stringify(updatedProfile));
      }
    }
    
    return true;
  }

  public async refreshUserProfile(): Promise<void> {
    const current = this.currentUser();
    
    if (current && current.id) {
      // If we have the user in memory, just refresh their data
      await this.fetchAndStoreProfile(current.id);
    } else {
      // Fallback: Check the actual Supabase session just in case the signal was lost
      const { data } = await this.supabase.auth.getSession();
      if (data?.session?.user?.id) {
        await this.fetchAndStoreProfile(data.session.user.id);
      }
    }
  }
}