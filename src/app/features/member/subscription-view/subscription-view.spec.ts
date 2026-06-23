import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SubscriptionView } from './subscription-view';
import { SubscriptionViewService } from '../../../services/subscription-view-service';
import { SupabaseService } from '../../../services/supabase-service';
import { ToastService } from '../../../services/toast-service';
import { Router } from '@angular/router';

describe('SubscriptionView', () => {
  let component: SubscriptionView;
  let fixture: ComponentFixture<SubscriptionView>;

  const mockSubscriptionService = {
    getActiveSubscriptions: () => Promise.resolve([]),
    getLatestSubscriptionDetails: () => Promise.resolve(null),
    clearSubscriptionCache: () => {}
  };

  const mockSupabaseService = {
    currentUser: () => ({ id: '123', user_role: 'member' })
  };

  const mockToastService = {
    success: () => {},
    error: () => {}
  };

  const mockRouter = {
    navigate: () => Promise.resolve(true)
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubscriptionView],
      providers: [
        { provide: SubscriptionViewService, useValue: mockSubscriptionService },
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: ToastService, useValue: mockToastService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SubscriptionView);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});