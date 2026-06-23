import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExerciseCreate } from './exercise-create';

describe('ExerciseCreate', () => {
  let component: ExerciseCreate;
  let fixture: ComponentFixture<ExerciseCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExerciseCreate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExerciseCreate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
