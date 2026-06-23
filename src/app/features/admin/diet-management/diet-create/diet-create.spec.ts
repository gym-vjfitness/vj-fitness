import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DietCreate } from './diet-create';

describe('DietCreate', () => {
  let component: DietCreate;
  let fixture: ComponentFixture<DietCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DietCreate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DietCreate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
