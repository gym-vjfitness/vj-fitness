import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DietDetails } from './diet-details';

describe('DietDetails', () => {
  let component: DietDetails;
  let fixture: ComponentFixture<DietDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DietDetails]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DietDetails);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
