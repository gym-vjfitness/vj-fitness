import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationManagement } from './notification-management';

describe('NotificationManagement', () => {
  let component: NotificationManagement;
  let fixture: ComponentFixture<NotificationManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NotificationManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
