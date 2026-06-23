import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GymPlanManagement } from './gym-plan-management';

describe('GymPlanManagement', () => {
  let component: GymPlanManagement;
  let fixture: ComponentFixture<GymPlanManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GymPlanManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GymPlanManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
