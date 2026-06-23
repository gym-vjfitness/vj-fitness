import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InactivateUsers } from './inactivate-users';

describe('InactivateUsers', () => {
  let component: InactivateUsers;
  let fixture: ComponentFixture<InactivateUsers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InactivateUsers]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InactivateUsers);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
