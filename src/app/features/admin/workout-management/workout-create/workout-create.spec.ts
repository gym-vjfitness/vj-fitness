import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkoutCreate } from './workout-create';

describe('WorkoutCreate', () => {
  let component: WorkoutCreate;
  let fixture: ComponentFixture<WorkoutCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkoutCreate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorkoutCreate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
