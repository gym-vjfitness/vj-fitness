import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase-service';
import { ProfileShortInfoDto } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class UserResetService {
  private supabaseService = inject(SupabaseService);

  async resetMemberPassword(targetUserId: string): Promise<string> {
    const cleanId = targetUserId?.trim();

    if (!cleanId) {
      throw new Error('Invalid user id');
    }

    const { data, error } = await this.supabaseService.client.rpc(
      'admin_reset_user_password',
      { target_user_id: cleanId }
    );

    if (error) {
      throw error;
    }

    if (typeof data !== 'string' || !data.trim()) {
      throw new Error('Password reset succeeded, but no temporary password was returned.');
    }

    return data;
  }

 buildResetMessage(member: ProfileShortInfoDto, tempPassword: string): string {
  const name = (member.full_name || member.email || 'Member').trim();

  const cleanPassword = String(tempPassword).replace(/\s+/g, "");

return [
  `Hi *${name}*,`,
  ``,
  `🔐 Your gym account password has been reset successfully.`,
  ``,
  `Temporary Password: *${cleanPassword}*`,
  ``,
  `📢 Please log in and change this password immediately.`,
  `⚠️ If you did not request this reset, contact the gym admin right away.`,
  ``,
  `Regards,`,
  `*VJ-FITNESS Team*`,
].join('\n');
}

  buildWhatsAppUrl(phone: string, message: string): string | null {
    const digits = this.normalizePhone(phone);

    if (!digits) {
      return null;
    }

    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${digits}?text=${encodedMessage}`;
  }

  openWhatsApp(phone: string, message: string): boolean {
    const url = this.buildWhatsAppUrl(phone, message);

    if (!url) {
      return false;
    }

    // Try to open in a new tab
    const opened = window.open(url, '_blank', 'noopener,noreferrer');

    // If 'opened' is null, the browser's pop-up blocker stopped it.
    if (!opened) {
      console.warn('WhatsApp pop-up was blocked by the browser.');
      // Return false so your component knows the action failed
      return false; 
    }

    return true;
  }

  private normalizePhone(phone: string): string {
    return (phone || '').replace(/[^\d]/g, '');
  }

  canUseWhatsapp(phone: string | null | undefined): boolean {
    return !!this.normalizePhone(phone ?? '');
  }
}