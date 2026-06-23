import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ToastService } from '../services/toast-service';
import { authGuard, publicGuard, roleGuard, memberStatusGuard } from './auth.guards';

describe('Auth Guards', () => {
  let mockRouter: any;
  let mockToastService: any;

  beforeEach(() => {
    mockRouter = {
      createUrlTree: vi.fn().mockImplementation((path) => ({ url: path.join('/') })),
      navigate: vi.fn()
    };
    mockToastService = {
      danger: vi.fn(),
      warning: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: ToastService, useValue: mockToastService }
      ]
    });

    localStorage.clear();
  });

  describe('publicGuard', () => {
    it('should allow navigation if user is not in storage', () => {
      const result = TestBed.runInInjectionContext(() => publicGuard(null as any, null as any));
      expect(result).toBe(true);
    });

    it('should redirect member with temporary password to reset-password', () => {
      localStorage.setItem('user', JSON.stringify({ id: '1', user_role: 'member', temp_pass: true }));
      const result = TestBed.runInInjectionContext(() => publicGuard(null as any, null as any));
      expect(result).toEqual({ url: '/auth/reset-password' });
    });

    it('should redirect member to dashboard if authenticated and active', () => {
      localStorage.setItem('user', JSON.stringify({ id: '1', user_role: 'member', is_active: true }));
      const result = TestBed.runInInjectionContext(() => publicGuard(null as any, null as any));
      expect(result).toEqual({ url: '/member/dashboard' });
    });
  });

  describe('authGuard', () => {
    it('should redirect to login if user is not logged in', () => {
      const result = TestBed.runInInjectionContext(() => authGuard(null as any, null as any));
      expect(result).toEqual({ url: '/auth/login' });
      expect(mockToastService.danger).toHaveBeenCalledWith('Please log in to continue.');
    });

    it('should redirect member with temp_pass to reset-password', () => {
      localStorage.setItem('user', JSON.stringify({ id: '1', user_role: 'member', temp_pass: true }));
      const result = TestBed.runInInjectionContext(() => authGuard(null as any, null as any));
      expect(result).toEqual({ url: '/auth/reset-password' });
    });

    it('should allow active authenticated user', () => {
      localStorage.setItem('user', JSON.stringify({ id: '1', user_role: 'member', is_active: true }));
      const result = TestBed.runInInjectionContext(() => authGuard(null as any, null as any));
      expect(result).toBe(true);
    });
  });
});
