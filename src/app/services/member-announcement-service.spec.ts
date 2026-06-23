import { TestBed } from '@angular/core/testing';

import { MemberAnnouncementService } from './member-announcement-service';

describe('MemberAnnouncementService', () => {
  let service: MemberAnnouncementService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MemberAnnouncementService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
