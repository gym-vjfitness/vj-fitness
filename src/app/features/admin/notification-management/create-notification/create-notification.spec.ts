import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateNotification } from './create-notification';

describe('CreateNotification', () => {
  let component: CreateNotification;
  let fixture: ComponentFixture<CreateNotification>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateNotification]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateNotification);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
