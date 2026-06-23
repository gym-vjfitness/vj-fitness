import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TrainerSignup } from './trainer-signup';

describe('TrainerSignup', () => {
  let component: TrainerSignup;
  let fixture: ComponentFixture<TrainerSignup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrainerSignup],
      providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TrainerSignup);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
