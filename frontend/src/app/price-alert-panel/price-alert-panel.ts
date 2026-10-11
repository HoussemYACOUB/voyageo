import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FlightSearchRoute } from '../services/travel-offer.service';
import { PriceAlert, PriceAlertService } from '../services/price-alert.service';

@Component({
  selector: 'app-price-alert-panel',
  imports: [CommonModule, FormsModule],
  template: `
    <section class="alert-panel" aria-labelledby="price-alert-heading">
      <div class="alert-intro">
        <span class="alert-icon" aria-hidden="true">♧</span>
        <div><h3 id="price-alert-heading">Alerte de prix</h3><p>Nous suivons le tarif réel et vous prévenons s’il atteint votre seuil.</p></div>
      </div>
      @if (route(); as searchRoute) {
        <form class="alert-form" (ngSubmit)="create(searchRoute)">
          <label>Me prévenir sous
            <span class="target-price"><input name="targetPrice" type="number" min="1" step="1" required [ngModel]="targetPrice()" (ngModelChange)="targetPrice.set($event)"><span>€</span></span>
          </label>
          @if (emailAvailable()) {
            <label class="email-option"><input type="checkbox" name="emailNotifications" [ngModel]="emailNotifications()" (ngModelChange)="emailNotifications.set($event)"> Recevoir aussi un e-mail</label>
          }
          <button type="submit" [disabled]="saving() || !targetPrice()">Créer l’alerte</button>
        </form>
      } @else {
        <p class="alert-hint">Choisissez un départ et une destination dans les suggestions pour créer une alerte sur un vol.</p>
      }
      @if (message()) { <p class="alert-message" role="status">{{ message() }}</p> }
      @if (error()) { <p class="alert-error" role="alert">{{ error() }}</p> }
      @if (alerts().length) {
        <ul class="alert-list">
          @for (alert of alerts(); track alert.id) {
            <li>
              <div><strong>{{ alert.originIata }} → {{ alert.destinationIata }}</strong><span>{{ alert.departureDate }} · seuil {{ alert.targetPrice | currency:alert.currency:'symbol':'1.0-0':'fr-FR' }}</span>
                @if (alert.status === 'TRIGGERED' && alert.observedPrice !== null) { <span class="triggered">Tarif atteint : {{ alert.observedPrice | currency:alert.currency:'symbol':'1.0-0':'fr-FR' }}</span> }
                @else { <span class="active">Surveillance active</span> }
              </div>
              <button type="button" [attr.aria-label]="'Supprimer l’alerte ' + alert.originIata + ' vers ' + alert.destinationIata" (click)="remove(alert)">Supprimer</button>
            </li>
          }
        </ul>
      }
      <p class="alert-footnote">Contrôle périodique côté serveur ; les vérifications s’interrompent lorsque l’hébergement met l’API en veille. Les tarifs démo ne déclenchent jamais d’alerte.</p>
    </section>
  `,
  styles: [`
    :host { display: block; margin-top: 18px; }
    .alert-panel { padding: 18px; border: 1px solid #dce6ed; border-radius: 16px; background: #fff; }
    .alert-intro { display: flex; align-items: center; gap: 12px; }
    .alert-icon { display: grid; width: 42px; height: 42px; place-items: center; border-radius: 13px; background: #eaf6f4; color: #147264; font-size: 1.4rem; }
    h3 { margin: 0; font-size: 1.05rem; } p { margin: 4px 0 0; color: #586b77; font-size: .82rem; }
    .alert-form { display: flex; flex-wrap: wrap; align-items: end; gap: 12px; margin-top: 16px; }
    .alert-form > label { display: grid; gap: 6px; color: #294553; font-size: .8rem; font-weight: 700; }
    .target-price { display: flex; align-items: center; gap: 7px; width: 130px; padding: 7px 9px; border: 1px solid #dce6ed; border-radius: 8px; }
    .target-price input { width: 100%; border: 0; outline: 0; color: #17425d; }
    .email-option { display: flex !important; align-items: center; min-height: 37px; }
    .alert-form button { min-height: 37px; padding: 0 14px; border: 0; border-radius: 8px; background: #137668; color: #fff; font-weight: 700; cursor: pointer; }
    .alert-form button:disabled { opacity: .55; cursor: not-allowed; }
    .alert-list { display: grid; gap: 8px; margin: 16px 0 0; padding: 0; list-style: none; }
    .alert-list li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px solid #edf1f4; }
    .alert-list li div { display: grid; gap: 3px; font-size: .78rem; }
    .alert-list li div span { color: #62737d; } .alert-list .triggered { color: #137668; font-weight: 700; } .alert-list .active { color: #55727f; }
    .alert-list li button { border: 0; background: transparent; color: #a62d36; cursor: pointer; }
    .alert-message { color: #137668; } .alert-error { color: #a62d36; } .alert-hint { margin-top: 14px; }
    .alert-footnote { margin-top: 14px; font-size: .72rem; }
  `]
})
export class PriceAlertPanel implements OnInit {
  private readonly destroyRef: DestroyRef;
  readonly route = input<FlightSearchRoute | null>(null);
  readonly destination = input('');
  protected readonly alerts = signal<PriceAlert[]>([]);
  protected readonly targetPrice = signal<number | null>(null);
  protected readonly emailNotifications = signal(false);
  protected readonly emailAvailable = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');

  constructor(private readonly priceAlertService: PriceAlertService) {
    this.destroyRef = inject(DestroyRef);
  }

  ngOnInit(): void {
    this.refresh();
    this.priceAlertService.emailAvailable().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (available) => this.emailAvailable.set(available),
      error: () => this.emailAvailable.set(false)
    });
  }

  protected create(route: FlightSearchRoute): void {
    const targetPrice = this.targetPrice();
    if (!targetPrice || targetPrice <= 0) return;
    this.saving.set(true);
    this.message.set('');
    this.error.set('');
    this.priceAlertService.create(route, this.destination(), targetPrice, this.emailNotifications())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (alert) => {
          this.alerts.update((items) => [alert, ...items]);
          this.message.set('Votre alerte de prix est enregistrée.');
          this.saving.set(false);
        },
        error: (response: { error?: { detail?: string; message?: string } }) => {
          this.error.set(response.error?.detail ?? response.error?.message ?? 'Impossible d’enregistrer cette alerte.');
          this.saving.set(false);
        }
      });
  }

  protected remove(alert: PriceAlert): void {
    this.priceAlertService.remove(alert.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.alerts.update((items) => items.filter((item) => item.id !== alert.id)),
      error: () => this.error.set('Impossible de supprimer cette alerte.')
    });
  }

  private refresh(): void {
    this.priceAlertService.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (alerts) => this.alerts.set(alerts),
      error: () => this.error.set('Impossible de charger vos alertes enregistrées.')
    });
  }
}
