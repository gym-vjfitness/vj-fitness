import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExerciseManagement } from './exercise-management';

describe('ExerciseManagement', () => {
  let component: ExerciseManagement;
  let fixture: ComponentFixture<ExerciseManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExerciseManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExerciseManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
