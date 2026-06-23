import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkoutDetails } from './workout-details';

describe('WorkoutDetails', () => {
  let component: WorkoutDetails;
  let fixture: ComponentFixture<WorkoutDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkoutDetails]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorkoutDetails);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
