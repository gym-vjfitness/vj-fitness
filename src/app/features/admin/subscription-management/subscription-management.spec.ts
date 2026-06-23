import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubscriptionManagement } from './subscription-management';

describe('SubscriptionManagement', () => {
  let component: SubscriptionManagement;
  let fixture: ComponentFixture<SubscriptionManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubscriptionManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SubscriptionManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
