import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GymSetting } from './gym-setting';

describe('GymSetting', () => {
  let component: GymSetting;
  let fixture: ComponentFixture<GymSetting>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GymSetting]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GymSetting);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
