import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrainerDashboard } from './trainer-dashboard';

describe('TrainerDashboard', () => {
  let component: TrainerDashboard;
  let fixture: ComponentFixture<TrainerDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrainerDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TrainerDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
