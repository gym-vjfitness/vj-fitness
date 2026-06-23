import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HealthTracker } from './health-tracker';

describe('HealthTracker', () => {
  let component: HealthTracker;
  let fixture: ComponentFixture<HealthTracker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HealthTracker]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HealthTracker);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
