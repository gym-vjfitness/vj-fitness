import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageUpi } from './manage-upi';

describe('ManageUpi', () => {
  let component: ManageUpi;
  let fixture: ComponentFixture<ManageUpi>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageUpi]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManageUpi);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
