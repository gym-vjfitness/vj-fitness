import { TestBed } from '@angular/core/testing';

import { AttendanceHistoryService } from './attendance-history-service';

describe('AttendanceHistoryService', () => {
  let service: AttendanceHistoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AttendanceHistoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
