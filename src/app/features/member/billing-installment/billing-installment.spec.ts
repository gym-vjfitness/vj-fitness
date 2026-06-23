import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BillingInstallment } from './billing-installment';

describe('BillingInstallment', () => {
  let component: BillingInstallment;
  let fixture: ComponentFixture<BillingInstallment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BillingInstallment]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BillingInstallment);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
