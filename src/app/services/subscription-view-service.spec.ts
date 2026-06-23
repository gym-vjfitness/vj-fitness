import { TestBed } from '@angular/core/testing';

import { SubscriptionViewService } from './subscription-view-service';

describe('SubscriptionViewService', () => {
  let service: SubscriptionViewService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SubscriptionViewService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
