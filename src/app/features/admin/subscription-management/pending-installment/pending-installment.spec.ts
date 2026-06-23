import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PendingInstallment } from './pending-installment';

describe('PendingInstallment', () => {
  let component: PendingInstallment;
  let fixture: ComponentFixture<PendingInstallment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PendingInstallment]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PendingInstallment);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
