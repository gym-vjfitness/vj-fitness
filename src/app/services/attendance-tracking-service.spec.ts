import { TestBed } from '@angular/core/testing';

import { AttendanceTrackingService } from './attendance-tracking-service';

describe('AttendanceTrackingService', () => {
  let service: AttendanceTrackingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AttendanceTrackingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
