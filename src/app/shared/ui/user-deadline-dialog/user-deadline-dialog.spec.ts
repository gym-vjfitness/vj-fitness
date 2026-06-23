import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserDeadlineDialog } from './user-deadline-dialog';

describe('UserDeadlineDialog', () => {
  let component: UserDeadlineDialog;
  let fixture: ComponentFixture<UserDeadlineDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserDeadlineDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserDeadlineDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
