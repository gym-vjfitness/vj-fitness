import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageLocation } from './manage-location';

describe('ManageLocation', () => {
  let component: ManageLocation;
  let fixture: ComponentFixture<ManageLocation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageLocation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManageLocation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
