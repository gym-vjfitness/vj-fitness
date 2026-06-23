import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { ProfileShortInfoDto } from '../models/user.model';

export interface MemberCacheState {
  data: ProfileShortInfoDto[];
  count: number;
  page: number;
  search: string;
  loaded: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private supabaseService = inject(SupabaseService);

  // --- Caching States ---
  private activeState: MemberCacheState = { data: [], count: 0, page: 1, search: '', loaded: false };
  private inactiveState: MemberCacheState = { data: [], count: 0, page: 1, search: '', loaded: false };
  private memberDetailsCache = new Map<string, any>();

  getActiveState() { return this.activeState; }
  getInactiveState() { return this.inactiveState; }

  async getMembers(page: number, pageSize: number, searchQuery: string, isActive: boolean) {
    const state = isActive ? this.activeState : this.inactiveState;

    // Check cache: If page and search match what we already have, return instantly
    if (state.loaded && state.page === page && state.search === searchQuery) {
      return { data: state.data, count: state.count };
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabaseService.client
      .from('profiles')
      .select('id, user_role, full_name, email, phone, is_active, created_at, updated_at', { count: 'exact' })
      .eq('is_active', isActive)
      .eq('user_role', 'member');

    const search = searchQuery.trim();
    if (search) {
      query = query.or(`full_name.ilike.${search}%,email.ilike.${search}%,phone.ilike.${search}%`);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to);

    if (error) throw error;

    // Save fetched data to the service state cache
    state.data = (data as ProfileShortInfoDto[]) || [];
    state.count = count || 0;
    state.page = page;
    state.search = searchQuery;
    state.loaded = true;

    return { data: state.data, count: state.count };
  }

  async updateMemberActiveStatus(id: string, isActive: boolean): Promise<boolean> {
    const { error } = await this.supabaseService.client
      .from('profiles')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error updating active status:', error.message);
      throw error;
    }

    // Mutate the local cache so we don't have to fetch again
    if (isActive) {
      // Moved from Inactive -> Active
      const initialLength = this.inactiveState.data.length;
      this.inactiveState.data = this.inactiveState.data.filter(u => u.id !== id);
      this.inactiveState.count = Math.max(0, this.inactiveState.count - (initialLength - this.inactiveState.data.length));
      this.activeState.loaded = false; // Invalidate Active cache so it refreshes next time admin views it
    } else {
      // Moved from Active -> Inactive
      const initialLength = this.activeState.data.length;
      this.activeState.data = this.activeState.data.filter(u => u.id !== id);
      this.activeState.count = Math.max(0, this.activeState.count - (initialLength - this.activeState.data.length));
      this.inactiveState.loaded = false; // Invalidate Inactive cache
    }

    return true;
  }

  async deleteMembers(userIds: string[]): Promise<void> {
    const { error } = await this.supabaseService.client
      .rpc('delete_users_bulk', { user_ids: userIds });

    if (error) {
      console.error('Error deleting users:', error.message);
      throw error;
    }

    // Remove from inactive cache directly
    const initialInactiveLength = this.inactiveState.data.length;
    this.inactiveState.data = this.inactiveState.data.filter(u => !userIds.includes(u.id));
    this.inactiveState.count = Math.max(0, this.inactiveState.count - (initialInactiveLength - this.inactiveState.data.length));

    // Clear details cache for deleted users
    userIds.forEach(id => this.memberDetailsCache.delete(id));
  }

  async assignPlansToMember(
    profileId: string,
    dietPlanId: string | null,
    workoutPlanId: string | null,
    trainerId: string | null // <-- Added Trainer ID
  ): Promise<void> {
    const { error } = await this.supabaseService.client
      .from('members')
      .upsert({
        profile_id: profileId,
        diet_plan_id: dietPlanId,
        exercise_plan_id: workoutPlanId,
        assigned_trainer_id: trainerId, // <-- Added to upsert
        updated_at: new Date().toISOString()
      }, { onConflict: 'profile_id' });

    if (error) {
      console.error('Error assigning plans:', error.message);
      throw error;
    }

    this.memberDetailsCache.delete(profileId);
  }

  async getMemberAssignments(profileId: string) {
    if (this.memberDetailsCache.has(profileId)) {
      return this.memberDetailsCache.get(profileId);
    }

    const { data, error } = await this.supabaseService.client
      .from('members')
      .select(`
        diet_plan_id,
        exercise_plan_id,
        assigned_trainer_id,
        diet_plans ( id, title ),
        workout_plans ( id, heading ),
        trainer:profiles!members_assigned_trainer_id_fkey ( id, full_name ) 
      `) // Fetching trainer details using the foreign key
      .eq('profile_id', profileId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching assignments:', error.message);
      return null;
    }

    if (data) {
      this.memberDetailsCache.set(profileId, data);
    }
    return data;
  }
}