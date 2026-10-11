import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-favorite-toggle',
  template: `
    <button class="save-button" type="button" [attr.aria-label]="saved() ? 'Retirer des favoris' : 'Ajouter aux favoris'"
      [attr.aria-pressed]="saved()" (click)="toggle.emit()">{{ saved() ? '♥' : '♡' }}</button>
  `,
  styles: [`
    :host { display: contents; }
    .save-button { display: grid; position: absolute; z-index: 2; top: 11px; right: 11px; width: 34px; height: 34px; place-items: center; border: 0; border-radius: 50%; background: #ffffffed; color: #0867ce; font-size: 18px; box-shadow: 0 2px 6px #17253616; cursor: pointer; }
    .save-button:focus-visible { outline: 3px solid #168c7e; outline-offset: 2px; }
    @media (max-width: 600px) { .save-button { top: 8px; right: 7px; width: 27px; height: 27px; } }
  `]
})
export class FavoriteToggle {
  readonly saved = input(false);
  readonly toggle = output<void>();
}
