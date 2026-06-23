import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { SupabaseService } from '../../../services/supabase-service';
import { DialogService } from '../../../services/dialog-service';
import { UserSettingService } from '../../../services/user-setting-service';

interface SettingTab {
  id: string;
  label: string;
  description: string;
  path: string;
  icon: string;
  theme: 'success' | 'info' | 'primary' | 'warning' |'danger';
}

@Component({
  selector: 'app-gym-setting',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gym-setting.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './gym-setting.scss',
})
export class GymSetting {

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  userSettingService = inject(UserSettingService);


  settingTabs: SettingTab[] = [
    {
      id: 'upi',
      label: 'Payments',
      description: 'UPI & Bank Configuration',
      path: 'upi',
      theme: 'success',
      icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z'
    },
    {
      id: 'location',
      label: 'Location',
      description: 'Gym Branch Details',
      path: 'location',
      theme: 'info',
      icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z'
    },
    {
      id: 'coupon',
      label: 'Coupons',
      description: 'Coupons create and manage',
      path: 'coupon',
      theme: 'warning',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
    },
    {
      id: 'security',
      label: 'Security',
      description: 'Passwords & Access',
      path: 'security',
      theme: 'primary',
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
    },
     {
      id: 'logout',
      label: 'Logout',
      description: 'Sign out of your account',
      path:'logout',
      theme: 'danger',
      icon: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'
    }
  ];

  goBack() {
    window.history.back();
  }

  navigateTo(path: string) {
    if(path == 'logout'){
     this.userSettingService.logout();
      return;
    }

    this.router.navigate([path], { relativeTo: this.route });
  }


  
}