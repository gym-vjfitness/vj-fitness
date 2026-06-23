import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnnouncementDialog } from './announcement-dialog';

describe('AnnouncementDialog', () => {
  let component: AnnouncementDialog;
  let fixture: ComponentFixture<AnnouncementDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnnouncementDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnnouncementDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
