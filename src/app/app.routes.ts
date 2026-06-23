import { Routes } from '@angular/router';
import { AuthLayout } from './layouts/auth-layout/auth-layout';
import { MainLayout } from './layouts/main-layout/main-layout';
import { publicGuard, authGuard, onboardingGuard, roleGuard, memberStatusGuard, resetPasswordGuard } from './guards/auth.guards'; 

export const routes: Routes = [
  {
    path: 'auth',
    component: AuthLayout,
    children: [
      { path: '', redirectTo: '/auth/login', pathMatch: 'full' },
      { 
        path: 'login', 
        loadComponent: () => import('./features/auth/login/login').then(c => c.Login),
        canActivate: [publicGuard] 
      },
      { 
        path: 'signup', 
        loadComponent: () => import('./features/auth/signup/signup').then(c => c.Signup),
        canActivate: [publicGuard] 
      },
      { 
        path: 'trainer-signup', 
        loadComponent: () => import('./features/auth/trainer-signup/trainer-signup').then(c => c.TrainerSignup),
        canActivate: [publicGuard] 
      },
      { 
        path: 'reset-password', 
        loadComponent: () => import('./features/auth/reset-password/reset-password').then(c => c.ResetPassword),
        canActivate: [resetPasswordGuard]
      },
      { 
        path: 'member-onboarding', 
        loadComponent: () => import('./features/auth/member-onboarding/member-onboarding').then(c => c.MemberOnboarding),
        canActivate: [onboardingGuard] 
      },
      { 
        path: 'page-not-found', 
        loadComponent: () => import('./shared/ui/page-not-found/page-not-found').then(c => c.PageNotFound)
      }
    ]
  },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard], 
    children: [
      { 
        path: 'member', 
        loadChildren: () => import('./features/member/member.routes').then(c => c.memberRoutes),
        data: { roles: ['member'] },
        canActivate: [roleGuard], 
        canActivateChild: [memberStatusGuard] 
      },
      { 
        path: 'admin', 
        loadChildren: () => import('./features/admin/admin.routes').then(c => c.adminRoutes), 
        data: { roles: ['admin'] },
        canActivate: [roleGuard],
        canActivateChild: [roleGuard]
      },
      { 
        path: 'trainer', 
        loadChildren: () => import('./features/trainer/trainer.routes').then(c => c.trainerRoutes), 
        data: { roles: ['trainer'] },
        canActivate: [roleGuard],
        canActivateChild: [roleGuard]
      }
    ]
  },
  { path: '**', redirectTo: '/auth/page-not-found' } 
];