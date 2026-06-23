import { Routes } from "@angular/router";
import { trainerPermissionGuard } from "../../guards/auth.guards";


export const trainerRoutes: Routes = [
  // Dashboard & Worklog (Basic access, no special permission required)
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', loadComponent: () => import('./trainer-dashboard/trainer-dashboard').then(c => c.TrainerDashboard) },
  { path: 'worklog', loadComponent: () => import('./trainer-worklog/trainer-worklog').then(c => c.TrainerWorklog) },
  
  // Diet Management
  { 
    path: 'diet', 
    loadComponent: () => import('../admin/diet-management/diet-management').then(c => c.DietManagement),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_diet' }
  },
  { 
    path: 'diet/details/:input', 
    loadComponent: () => import('../admin/diet-management/diet-details/diet-details').then(c=>c.DietDetails),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_diet' }
  },
  { 
    path: 'diet/create', 
    loadComponent: () => import('../admin/diet-management/diet-create/diet-create').then(c => c.DietCreate),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_diet' }
  },
  { 
    path: 'diet/update/:id', 
    loadComponent: () => import('../admin/diet-management/diet-create/diet-create').then(c => c.DietCreate),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_diet' }
  },
  
  // Members / Users Management
  {
    path: 'members',
    loadComponent: () => import('../admin/profile-management/profile-management').then(c=>c.ProfileManagement),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_users' }
  },
  {
    path: 'members/inactive', 
    loadComponent: () => import('../admin/profile-management/inactivate-users/inactivate-users').then(c=>c.InactivateUsers),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_users' }
  },
  {
    path: 'members/details/:id', 
    loadComponent: () => import('../admin/profile-management/profile-details/profile-details').then(c => c.ProfileDetails),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_users' }
  },
  
  // Workout Management
  {
    path: 'workout',
    loadComponent: () => import('../admin/workout-management/workout-management').then(c=>c.WorkoutManagement),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_workout' }
  },
  {
    path: 'workout/details/:id',
    loadComponent: () => import('../admin/workout-management/workout-details/workout-details').then(c=>c.WorkoutDetails),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_workout' }
  },
  {
    path: 'workout/create', 
    loadComponent: () => import('../admin/workout-management/workout-create/workout-create').then(c=>c.WorkoutCreate),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_workout' }
  },
  {
    path: 'workout/update/:id', 
    loadComponent: () => import('../admin/workout-management/workout-create/workout-create').then(c=>c.WorkoutCreate),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_workout' }
  },
  
  // Exercise Library
  {
    path: 'exercise-library',
    loadComponent: () => import('../admin/exercise-management/exercise-management').then(c=>c.ExerciseManagement),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_exercises' }
  },
  {
    path: 'exercise-library/create',
    loadComponent: () => import('../admin/exercise-management/exercise-create/exercise-create').then(c=>c.ExerciseCreate),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_exercises' }
  },
  {
    path: 'exercise-library/update/:id',
    loadComponent: () => import('../admin/exercise-management/exercise-create/exercise-create').then(c=>c.ExerciseCreate),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_exercises' }
  },

  // Gym Plans
  {
    path: 'gym-plan',
    loadComponent: () => import('../admin/gym-plan-management/gym-plan-management').then(c=>c.GymPlanManagement),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_gym_plans' }
  },
  {
    path: 'gym-plan/create',
    loadComponent: () => import('../admin/gym-plan-management/plan-create/plan-create').then(c=>c.PlanCreate),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_gym_plans' }
  },
  {
    path: 'gym-plan/update/:id',
    loadComponent: () => import('../admin/gym-plan-management/plan-create/plan-create').then(c=>c.PlanCreate),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_gym_plans' }
  },
  {
    path: 'gym-plan/details/:id',
    loadComponent: () => import('../admin/gym-plan-management/plan-details/plan-details').then(c=>c.PlanDetails),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_gym_plans' }
  },

  // Subscriptions
  {
    path: 'subscription', 
    loadComponent: () => import('../admin/subscription-management/subscription-management').then(c=>c.SubscriptionManagement),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_subscriptions' }
  },
  {
    path: 'subscription/detail/:id',
    loadComponent: () => import('../admin/subscription-management/subscription-detail/subscription-detail').then(c=>c.SubscriptionDetail),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_subscriptions' }
  },
  {
    path: 'subscription/pending-installment',
    loadComponent: () => import('../admin/subscription-management/pending-installment/pending-installment').then(c=>c.PendingInstallment),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_subscriptions' }
  },

  // QR Desk & Attendance
  {
    path: 'admin-qr-desk',
    loadComponent: () => import('../admin/admin-qr-desk/admin-qr-desk').then(c => c.AdminQrDesk),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_view_qr_desk' }
  },
  {
    path: 'attendance-history', 
    loadComponent: () => import('../admin/attendace-history/attendace-history').then(c => c.AttendaceHistory),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_view_attendance' }
  },

  // Settings & Coupons (Assuming tied to can_manage_settings)
  {
    path: 'setting',
    loadComponent: () => import('../admin/gym-setting/gym-setting').then(c=>c.GymSetting),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_settings' }
  },
  {
    path: 'setting/upi',
    loadComponent: () => import('../admin/gym-setting/manage-upi/manage-upi').then(c=>c.ManageUpi),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_settings' }
  },
  {
    path: 'setting/location',
    loadComponent: () => import('../admin/gym-setting/manage-location/manage-location').then(c=>c.ManageLocation),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_settings' }
  },
  {
    path: 'setting/coupon', 
    loadComponent: () => import('../admin/coupon-management/coupon-management').then(c=>c.CouponManagement),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_settings' }
  },
  {
    path: 'setting/coupon/create',
    loadComponent: () => import('../admin/coupon-management/create-coupon/create-coupon').then(c=>c.CreateCoupon),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_settings' }
  },
  {
    path: 'setting/coupon/update/:id',
    loadComponent: () => import('../admin/coupon-management/create-coupon/create-coupon').then(c=>c.CreateCoupon),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_settings' }
  },

  // Notifications
  {
    path: 'notification', 
    loadComponent: () => import('../admin/notification-management/notification-management').then(c => c.NotificationManagement),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_announcements' }
  },
  {
    path: 'notification/create',
    loadComponent: () => import('../admin/notification-management/create-notification/create-notification').then(c=>c.CreateNotification),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_announcements' }
  },
  {
    path: 'notification/update/:id',
    loadComponent: () => import('../admin/notification-management/create-notification/create-notification').then(c=>c.CreateNotification),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_announcements' }
  },

  // Offline Checkout (Assuming tied to subscriptions/billing)
  {
    path: 'offline-checkout',
    loadComponent: () => import('../admin/admin-offline-checkout/admin-offline-checkout').then(c=>c.AdminOfflineCheckout),
    canActivate: [trainerPermissionGuard], data: { requiredPermission: 'can_manage_subscriptions' }
  },

  // Profile (Always available)
  { path: 'profile', loadComponent: () => import('../member/profile/profile').then(c => c.Profile) },

  // This instantly stops the router from checking guards on garbage URLs
  { path: '**', redirectTo: 'dashboard', pathMatch: 'full' }
];