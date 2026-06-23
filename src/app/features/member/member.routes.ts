import { Routes } from "@angular/router";

export const memberRoutes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', loadComponent: () => import('./user-dashboard/user-dashboard').then(c => c.UserDashboard) },
  { path: 'attendance', loadComponent: () => import('./attendance/attendance').then(c => c.Attendance) },
  { path: 'attendance/detail', loadComponent: () => import('./attendance/attendance-detail/attendance-detail').then(c => c.AttendanceDetail) },
  { path: 'plans', loadComponent: () => import('./subscription-view/subscription-view').then(c => c.SubscriptionView) },
  { path: 'profile', loadComponent: () => import('./profile/profile').then(c => c.Profile) },
  { path: 'billing', loadComponent: () => import('./membership-billing/membership-billing').then(c => c.MembershipBilling) },
  { path: 'billing-installment', loadComponent: () => import('./billing-installment/billing-installment').then(c => c.BillingInstallment) },
  { path: 'ai-chat', loadComponent: () => import('./ai-chat/ai-chat').then(c => c.AiChat) },
  { path: 'diet-details/:input', loadComponent: () => import('../admin/diet-management/diet-details/diet-details').then(c => c.DietDetails) },
  { path: 'workout-details/:id', loadComponent: () => import('../admin/workout-management/workout-details/workout-details').then(c => c.WorkoutDetails) },
  { path: 'health-tracker', loadComponent: () => import('./health-tracker/health-tracker').then(c => c.HealthTracker) },
  { path: 'health-tracker/insight', loadComponent: () => import('./health-tracker/health-insight/health-insight').then(c => c.HealthInsight) },
  { path: 'setting', loadComponent: () => import('./user-setting/user-setting').then(c => c.UserSetting) }
]