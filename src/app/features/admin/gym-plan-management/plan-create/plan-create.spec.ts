import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlanCreate } from './plan-create';

describe('PlanCreate', () => {
  let component: PlanCreate;
  let fixture: ComponentFixture<PlanCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlanCreate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlanCreate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
