import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberOnboarding } from './member-onboarding';

describe('MemberOnboarding', () => {
  let component: MemberOnboarding;
  let fixture: ComponentFixture<MemberOnboarding>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberOnboarding]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MemberOnboarding);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
