import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserSettingService } from '../../../services/user-setting-service';
import { environment } from '../../../../environments/environment';


interface SettingTab {
  id: 'faq' | 'terms' | 'logout';
  label: string;
  description: string;
  theme: 'success' | 'info' | 'primary' | 'warning' | 'danger';
  icon: string;
}

@Component({
  selector: 'app-user-setting',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-setting.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './user-setting.scss',
})
export class UserSetting {
  public settingService = inject(UserSettingService);
  companyName = environment.companyName;

  // View state management: 'menu' | 'faq' | 'terms'
  activeView = signal<'menu' | 'faq' | 'terms'>('menu');

  faqs = this.settingService.getFaqs();
  terms = this.settingService.getTermsAndConditions();

  // Static items (Theme is handled directly in HTML to easily swap SVGs)
  settingTabs: SettingTab[] = [
    {
      id: 'faq',
      label: 'FAQs',
      description: 'Frequently Asked Questions',
      theme: 'primary',
      icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    {
      id: 'terms',
      label: 'Terms & Conditions',
      description: 'Rules and regulations',
      theme: 'warning',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
    },
    {
      id: 'logout',
      label: 'Logout',
      description: 'Sign out of your account',
      theme: 'danger',
      icon: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'
    }
  ];


  goBack() {
    if (this.activeView() !== 'menu') {
      // If inside a sub-view, return to menu
      this.activeView.set('menu');
    } else {
      // If at root menu, navigate browser back
      window.history.back();
    }
  }

  handleAction(id: 'faq' | 'terms' | 'logout') {
    if (id === 'logout') {
      this.settingService.logout();
    } else {
      this.activeView.set(id);
    }
  }

}