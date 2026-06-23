import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GlobalDialog } from './global-dialog';

describe('GlobalDialog', () => {
  let component: GlobalDialog;
  let fixture: ComponentFixture<GlobalDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GlobalDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GlobalDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
