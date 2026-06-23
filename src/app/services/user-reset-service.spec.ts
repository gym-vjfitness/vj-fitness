import { TestBed } from '@angular/core/testing';

import { UserResetService } from './user-reset-service';

describe('UserResetService', () => {
  let service: UserResetService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserResetService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
