import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrainerManagement } from './trainer-management';

describe('TrainerManagement', () => {
  let component: TrainerManagement;
  let fixture: ComponentFixture<TrainerManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrainerManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TrainerManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
