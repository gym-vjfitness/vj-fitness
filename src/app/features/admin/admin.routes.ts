import { Routes } from "@angular/router";

export const adminRoutes: Routes = [ // FIXED NAME HERE
  //dashboard
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', loadComponent: () => import('./admin-dashboard/admin-dashboard').then(c => c.AdminDashboard) },

  //diet
  { path: 'diet', loadComponent: () => import('./diet-management/diet-management').then(c => c.DietManagement) },
  { path: 'diet/details/:input', loadComponent: () => import('./diet-management/diet-details/diet-details').then(c => c.DietDetails) },
  { path: 'diet/create', loadComponent: () => import('./diet-management/diet-create/diet-create').then(c => c.DietCreate) },
  { path: 'diet/update/:id', loadComponent: () => import('./diet-management/diet-create/diet-create').then(c => c.DietCreate) },

  //members
  { path: 'members', loadComponent: () => import('./profile-management/profile-management').then(c => c.ProfileManagement) },
  { path: 'members/inactive', loadComponent: () => import('./profile-management/inactivate-users/inactivate-users').then(c => c.InactivateUsers) },
  { path: 'members/details/:id', loadComponent: () => import('./profile-management/profile-details/profile-details').then(c => c.ProfileDetails) },

  //workout
  { path: 'workout', loadComponent: () => import('./workout-management/workout-management').then(c => c.WorkoutManagement) },
  { path: 'workout/details/:id', loadComponent: () => import('./workout-management/workout-details/workout-details').then(c => c.WorkoutDetails) },
  { path: 'workout/create', loadComponent: () => import('./workout-management/workout-create/workout-create').then(c => c.WorkoutCreate) },
  { path: 'workout/update/:id', loadComponent: () => import('./workout-management/workout-create/workout-create').then(c => c.WorkoutCreate) },

  //exercise
  { path: 'exercise-library', loadComponent: () => import('./exercise-management/exercise-management').then(c => c.ExerciseManagement) },
  { path: 'exercise-library/create', loadComponent: () => import('./exercise-management/exercise-create/exercise-create').then(c => c.ExerciseCreate) },
  { path: 'exercise-library/update/:id', loadComponent: () => import('./exercise-management/exercise-create/exercise-create').then(c => c.ExerciseCreate) },

  //gym-plan
  { path: 'gym-plan', loadComponent: () => import('./gym-plan-management/gym-plan-management').then(c => c.GymPlanManagement) },
  { path: 'gym-plan/create', loadComponent: () => import('./gym-plan-management/plan-create/plan-create').then(c => c.PlanCreate) },
  { path: 'gym-plan/update/:id', loadComponent: () => import('./gym-plan-management/plan-create/plan-create').then(c => c.PlanCreate) },
  { path: 'gym-plan/details/:id', loadComponent: () => import('./gym-plan-management/plan-details/plan-details').then(c => c.PlanDetails) },

  //gym-setting
  { path: 'setting', loadComponent: () => import('./gym-setting/gym-setting').then(c => c.GymSetting) },
  { path: 'setting/upi', loadComponent: () => import('./gym-setting/manage-upi/manage-upi').then(c => c.ManageUpi) },
  { path: 'setting/location', loadComponent: () => import('./gym-setting/manage-location/manage-location').then(c => c.ManageLocation) },
  { path: 'setting/coupon', loadComponent: () => import('./coupon-management/coupon-management').then(c => c.CouponManagement) },
  { path: 'setting/coupon/create', loadComponent: () => import('./coupon-management/create-coupon/create-coupon').then(c => c.CreateCoupon) },
  { path: 'setting/coupon/update/:id', loadComponent: () => import('./coupon-management/create-coupon/create-coupon').then(c => c.CreateCoupon) },

  //subscription
  { path: 'subscription', loadComponent: () => import('./subscription-management/subscription-management').then(c => c.SubscriptionManagement) },
  { path: 'subscription/detail/:id', loadComponent: () => import('./subscription-management/subscription-detail/subscription-detail').then(c => c.SubscriptionDetail) },
  { path: 'subscription/pending-installment', loadComponent: () => import('./subscription-management/pending-installment/pending-installment').then(c => c.PendingInstallment) },

  { path: 'offline-checkout', loadComponent: () => import('./admin-offline-checkout/admin-offline-checkout').then(c => c.AdminOfflineCheckout) },
  { path: 'admin-qr-desk', loadComponent: () => import('./admin-qr-desk/admin-qr-desk').then(c => c.AdminQrDesk) },

  //coupon

  //notification
  { path: 'notification', loadComponent: () => import('./notification-management/notification-management').then(c => c.NotificationManagement) },
  { path: 'notification/create', loadComponent: () => import('./notification-management/create-notification/create-notification').then(c => c.CreateNotification) },
  { path: 'notification/update/:id', loadComponent: () => import('./notification-management/create-notification/create-notification').then(c => c.CreateNotification) },

  { path: 'attendance-history', loadComponent: () => import('./attendace-history/attendace-history').then(c => c.AttendaceHistory) },
  { path: 'trainer-ops', loadComponent: () => import('./trainer-ops/trainer-ops').then(c => c.TrainerOps) },


  { path: 'trainers', loadComponent: () => import('./trainer-management/trainer-management').then(c => c.TrainerManagement) },
  { path: 'trainers/access/:id', loadComponent: () => import('./trainer-management/trainer-access/trainer-access').then(c => c.TrainerAccess) }
]
