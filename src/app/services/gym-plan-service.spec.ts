import { TestBed } from '@angular/core/testing';

import { GymPlanService } from './gym-plan-service';

describe('GymPlanService', () => {
  let service: GymPlanService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GymPlanService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
