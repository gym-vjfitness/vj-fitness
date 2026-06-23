import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfileDetails } from './profile-details';

describe('ProfileDetails', () => {
  let component: ProfileDetails;
  let fixture: ComponentFixture<ProfileDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileDetails]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProfileDetails);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
