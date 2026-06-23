import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserSetting } from './user-setting';

describe('UserSetting', () => {
  let component: UserSetting;
  let fixture: ComponentFixture<UserSetting>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserSetting]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserSetting);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
