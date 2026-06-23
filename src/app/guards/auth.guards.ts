import { inject } from '@angular/core';
import { CanActivateFn, CanActivateChildFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { ToastService } from './../services/toast-service'; 
import { TrainerService } from '../services/trainer-service';

// --- HELPER ---
const getUserFromStorage = () => {
    const userStr = localStorage.getItem('user');
    if (!userStr || userStr === 'null' || userStr === 'undefined') {
        localStorage.removeItem('user');
        return null;
    }
    try {
        const user = JSON.parse(userStr);
        if (!user || typeof user !== 'object' || !user.user_role) {
            localStorage.removeItem('user'); 
            return null;
        }
        return user;
    } catch (e) {
        localStorage.removeItem('user'); 
        return null;
    }
};

const dashboardMap: Record<string, string> = {
    'admin': '/admin/dashboard',
    'trainer': '/trainer/dashboard',
    'member': '/member/dashboard'
};

// 1. PUBLIC GUARD
export const publicGuard: CanActivateFn = () => {
    const router = inject(Router);
    const user = getUserFromStorage();

    if (user) {
        if (user.user_role === 'member' && user.temp_pass) {
            return router.createUrlTree(['/auth/reset-password']);
        }
        if (user.new_user && user.user_role === 'member') {
            return router.createUrlTree(['/auth/member-onboarding']);
        }
        return router.createUrlTree([dashboardMap[user.user_role] || '/member/dashboard']);
    }
    return true;
};

// 2. AUTH GUARD
export const authGuard: CanActivateFn = () => {
    const router = inject(Router);
    const toastService = inject(ToastService);
    const user = getUserFromStorage();

    if (!user) {
        toastService.danger('Please log in to continue.');
        return router.createUrlTree(['/auth/login']);
    }

    if (user.user_role === 'member' && user.temp_pass) {
        toastService.warning('You must change your temporary password before continuing.');
        return router.createUrlTree(['/auth/reset-password']);
    }
    return true;
};

// 3. ONBOARDING GUARD (Added back & fixed)
export const onboardingGuard: CanActivateFn = () => {
    const router = inject(Router);
    const user = getUserFromStorage();

    if (!user) return router.createUrlTree(['/auth/login']);

    if (user.user_role === 'member' && user.temp_pass) {
        return router.createUrlTree(['/auth/reset-password']);
    }

    if (!user.new_user || user.user_role === 'admin' || user.user_role === 'trainer') {
        return router.createUrlTree([dashboardMap[user.user_role] || '/member/dashboard']);
    }
    return true;
};

// 4. ROLE GUARD
export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
    const router = inject(Router);
    const toastService = inject(ToastService);
    const user = getUserFromStorage();

    if (!user) return router.createUrlTree(['/auth/login']);

    const expectedRoles = route.data['roles'] as Array<string>;

    if (expectedRoles && !expectedRoles.includes(user.user_role)) {
        toastService.danger('Access denied. Unauthorized area.');
        return router.createUrlTree([dashboardMap[user.user_role] || '/auth/login']);
    }
    return true;
};

// 5. MEMBER STATUS GUARD
export const memberStatusGuard: CanActivateChildFn = (childRoute: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const router = inject(Router);
    const toastService = inject(ToastService);
    const user = getUserFromStorage();

    if (!user) return true;

    if (user.user_role === 'member' && user.temp_pass) {
        toastService.warning('Please set your new password first.');
        return router.createUrlTree(['/auth/reset-password']);
    }

    if (user.new_user && user.user_role === 'member') {
        toastService.warning('Please complete your profile setup first.');
        return router.createUrlTree(['/auth/member-onboarding']);
    }

    if (user.user_role === 'member' && !user.is_active) {
        const allowedPaths = ['/member/plans', '/member/billing', '/member/billing-installment', '/member/profile'];
        const requestUrl = state.url.split('?')[0];
        const isAllowed = allowedPaths.some(path => requestUrl === path || requestUrl.startsWith(path + '/'));

        if (!isAllowed) {
           toastService.danger("Membership inactive. Renew now.");
           return router.createUrlTree(['/member/plans']);
        }
    }
    return true;
};

// 6. RESET PASSWORD GUARD
export const resetPasswordGuard: CanActivateFn = () => {
    const router = inject(Router);
    const user = getUserFromStorage();

    if (!user) return router.createUrlTree(['/auth/login']);

    if (user.user_role === 'admin' || user.user_role === 'trainer') return true;

    if (user.user_role === 'member') {
        if (user.temp_pass === true) return true;
        if (user.new_user) return router.createUrlTree(['/auth/member-onboarding']);
        return router.createUrlTree(['/member/dashboard']);
    }
    return router.createUrlTree(['/auth/login']);
};

// 7. TRAINER PERMISSION GUARD (Synchronous & Zero API Calls)
export const trainerPermissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
    const router = inject(Router);
    const toastService = inject(ToastService);

    // 1. Check if the route even needs a specific permission
    const requiredPermission = route.data['requiredPermission'];
    if (!requiredPermission) return true;

    // 2. Get User
    const user = getUserFromStorage();
    if (!user || user.user_role !== 'trainer') return true;

    // 3. READ INSTANTLY FROM LOCAL STORAGE CACHE (Zero API Calls)
    const cacheKey = `trainer_perms_${user.id}`;
    const cachedPerms = localStorage.getItem(cacheKey);

    if (cachedPerms) {
        try {
            const permissions = JSON.parse(cachedPerms);
            // 4. Check if they have the specific permission
            if (permissions[requiredPermission] === true) {
                return true; // INSTANT ACCESS granted
            }
        } catch (e) {
            console.error("Failed to parse trainer permissions cache.");
        }
    }

    // 5. If no cache exists, or permission is explicitly false -> Block instantly
    toastService.danger('Access Restricted. Permission Required.');
    return router.createUrlTree(['/trainer/dashboard']);
};