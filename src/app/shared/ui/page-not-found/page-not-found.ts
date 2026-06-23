import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-page-not-found',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './page-not-found.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './page-not-found.scss',
})
export class PageNotFound {}