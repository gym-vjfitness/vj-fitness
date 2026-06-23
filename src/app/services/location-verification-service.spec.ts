import { TestBed } from '@angular/core/testing';

import { LocationVerificationService } from './location-verification-service';

describe('LocationVerificationService', () => {
  let service: LocationVerificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LocationVerificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
