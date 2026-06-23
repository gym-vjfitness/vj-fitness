import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateCoupon } from './create-coupon';

describe('CreateCoupon', () => {
  let component: CreateCoupon;
  let fixture: ComponentFixture<CreateCoupon>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateCoupon]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateCoupon);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
