import { TestBed } from '@angular/core/testing';

import { UserDeadlineService } from './user-deadline-service';

describe('UserDeadlineService', () => {
  let service: UserDeadlineService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserDeadlineService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
