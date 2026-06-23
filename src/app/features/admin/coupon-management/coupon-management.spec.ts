import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CouponManagement } from './coupon-management';

describe('CouponManagement', () => {
  let component: CouponManagement;
  let fixture: ComponentFixture<CouponManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CouponManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CouponManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
