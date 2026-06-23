import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrainerAccess } from './trainer-access';

describe('TrainerAccess', () => {
  let component: TrainerAccess;
  let fixture: ComponentFixture<TrainerAccess>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrainerAccess]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TrainerAccess);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
