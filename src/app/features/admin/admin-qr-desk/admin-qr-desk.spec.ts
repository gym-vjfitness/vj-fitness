import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminQrDesk } from './admin-qr-desk';

describe('AdminQrDesk', () => {
  let component: AdminQrDesk;
  let fixture: ComponentFixture<AdminQrDesk>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminQrDesk]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminQrDesk);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
