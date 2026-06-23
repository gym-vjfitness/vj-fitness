import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubscriptionDetail } from './subscription-detail';

describe('SubscriptionDetail', () => {
  let component: SubscriptionDetail;
  let fixture: ComponentFixture<SubscriptionDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubscriptionDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SubscriptionDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
