import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkoutManagement } from './workout-management';

describe('WorkoutManagement', () => {
  let component: WorkoutManagement;
  let fixture: ComponentFixture<WorkoutManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkoutManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorkoutManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
