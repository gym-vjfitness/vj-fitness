import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { Announcement, CreateAnnouncementDto } from '../models/notification.model';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private supabaseService = inject(SupabaseService);

  private detailCache = new Map<string, Announcement>();

  notifications = signal<Announcement[]>([]);
  totalItems = signal<number>(0);
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  searchTerm = signal<string>('');
  searchInput = signal<string>('');
  selectedType = signal<string>(''); 
  
  hasLoaded = signal<boolean>(false);

  async getNotifications(page: number, limit: number, search: string, type: string) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // STRICTLY FETCHING ONLY id AND title (Bandwidth Optimized)
    let query = this.supabaseService.client
      .from('announcements')
      .select('id, title', { count: 'exact' });

    if (search) {
      query = query.ilike('title', `${search}%`);
    }

    if (type) {
      query = query.eq('type', type);
    }

    // STRICTLY DESCENDING ORDER (Latest first)
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    
    return {
      data: data as Announcement[],
      count: count || 0
    };
  }

  async getNotificationById(id: string): Promise<Announcement> {
    if (this.detailCache.has(id)) {
      return this.detailCache.get(id) as Announcement;
    }

    // Fetches full data ONLY when Admin explicitly clicks "Edit"
    const { data, error } = await this.supabaseService.client
      .from('announcements')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    
    this.detailCache.set(id, data as Announcement);
    return data as Announcement;
  }

  async createNotification(payload: CreateAnnouncementDto) {
    const { error } = await this.supabaseService.client.rpc('create_announcement_and_clean', {
      p_type: payload.type,
      p_title: payload.title,
      p_content: payload.content,
      p_category: payload.category,
      p_start_date: payload.start_date,
      p_expiry_date: payload.expiry_date,
      p_priority: payload.priority
    });

    if (error) throw error;
    this.hasLoaded.set(false); 
  }

  async updateNotification(id: string, payload: Partial<CreateAnnouncementDto>) {
    const { error } = await this.supabaseService.client
      .from('announcements')
      .update(payload)
      .eq('id', id);

    if (error) throw error;
    
    this.detailCache.delete(id);
    this.notifications.update(current => 
      current.map(n => n.id === id ? { ...n, ...payload } : n)
    );
  }

  async deleteNotification(id: string) {
    const { error } = await this.supabaseService.client
      .from('announcements')
      .delete()
      .eq('id', id);

    if (error) throw error;
    this.detailCache.delete(id);
    this.hasLoaded.set(false); 
  }
}