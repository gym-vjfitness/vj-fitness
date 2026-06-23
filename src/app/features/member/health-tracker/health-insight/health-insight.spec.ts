import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HealthInsight } from './health-insight';

describe('HealthInsight', () => {
  let component: HealthInsight;
  let fixture: ComponentFixture<HealthInsight>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HealthInsight]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HealthInsight);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
