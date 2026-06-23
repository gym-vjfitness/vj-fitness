import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DietManagement } from './diet-management';

describe('DietManagement', () => {
  let component: DietManagement;
  let fixture: ComponentFixture<DietManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DietManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DietManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
