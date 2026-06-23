import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminOfflineCheckout } from './admin-offline-checkout';

describe('AdminOfflineCheckout', () => {
  let component: AdminOfflineCheckout;
  let fixture: ComponentFixture<AdminOfflineCheckout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminOfflineCheckout]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminOfflineCheckout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
