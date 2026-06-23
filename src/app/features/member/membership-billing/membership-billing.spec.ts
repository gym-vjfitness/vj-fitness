import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MembershipBilling } from './membership-billing';

describe('MembershipBilling', () => {
  let component: MembershipBilling;
  let fixture: ComponentFixture<MembershipBilling>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MembershipBilling]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MembershipBilling);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
