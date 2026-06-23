import { TestBed } from '@angular/core/testing';

import { HealthTrackingService } from './health-tracking-service';

describe('HealthTrackingService', () => {
  let service: HealthTrackingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HealthTrackingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
