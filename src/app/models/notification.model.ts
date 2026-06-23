export interface Announcement {
  id?: string;
  type: 'holiday' | 'advertisement';
  title: string;
  content: string;
  category: string;
  start_date: string;
  expiry_date: string;
  priority: 'high' | 'low';
  created_at?: string;
}

export interface CreateAnnouncementDto extends Omit<Announcement, 'id' | 'created_at'> {}


// For tracking the 24-hour cache
export interface DailyCache {
  date: string; // e.g., '2026-05-10'
  data: Announcement[];
}

// For tracking how many times they closed a specific ad today
export interface DailyLedger {
  date: string; // e.g., '2026-05-10'
  closures: Record<string, number>; // Maps Announcement ID to closure count { "uuid-1": 1, "uuid-2": 2 }
}