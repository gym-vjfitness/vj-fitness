import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AttendaceHistory } from './attendace-history';

describe('AttendaceHistory', () => {
  let component: AttendaceHistory;
  let fixture: ComponentFixture<AttendaceHistory>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttendaceHistory]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AttendaceHistory);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
