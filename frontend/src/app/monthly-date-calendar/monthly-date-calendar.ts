import { CommonModule, registerLocaleData } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MonthlyFlightPrice, TravelOfferService } from '../services/travel-offer.service';
import localeFr from '@angular/common/locales/fr';

registerLocaleData(localeFr, 'fr-FR');

interface CalendarDay {
  date: string;
  day: number;
  price: MonthlyFlightPrice | null;
}

@Component({
  selector: 'app-monthly-date-calendar',
  imports: [CommonModule],
  template: `
    <section class="calendar-panel" aria-labelledby="calendar-title">
      <div class="calendar-heading">
        <div><span class="eyebrow">DATES FLEXIBLES</span><h3 id="calendar-title">Comparez les prix du mois</h3></div>
        <div class="calendar-navigation">
          <button type="button" aria-label="Mois précédent" [disabled]="previousDisabled()" (click)="changeMonth(-1)">‹</button>
          <strong>{{ monthLabel() }}</strong>
          <button type="button" aria-label="Mois suivant" (click)="changeMonth(1)">›</button>
        </div>
      </div>
      @if (loading()) {
        <p class="calendar-status" role="status">Recherche des tarifs du mois…</p>
      } @else if (error()) {
        <p class="calendar-status calendar-error" role="alert">{{ error() }}</p>
      } @else if (prices().length === 0) {
        <p class="calendar-status">Aucun tarif mensuel disponible pour ces dates avec le fournisseur actuel.</p>
      } @else {
        <div class="calendar-grid" role="grid" [attr.aria-label]="'Tarifs de ' + monthLabel()">
          @for (weekday of weekdays; track weekday) { <span class="calendar-weekday" role="columnheader">{{ weekday }}</span> }
          @for (day of calendarDays(); track day.date || $index) {
            @if (day.day === 0) {
              <span class="calendar-empty" aria-hidden="true"></span>
            } @else {
              <button class="calendar-day" type="button" role="gridcell" [class.has-price]="day.price !== null"
                [class.selected]="day.date === selectedDate()" [disabled]="day.price === null"
                [attr.aria-label]="day.price ? day.date + ', ' + (day.price.price | currency:day.price.currency:'symbol':'1.0-0':'fr-FR') : day.date + ', tarif indisponible'"
                (click)="select(day.date)">
                <span>{{ day.day }}</span>
                @if (day.price) { <strong>{{ day.price.price | currency:day.price.currency:'symbol':'1.0-0':'fr-FR' }}</strong> }
              </button>
            }
          }
        </div>
        <p class="calendar-footnote">Tarifs indicatifs Aviasales, uniquement pour les dates retournées par le fournisseur. À revérifier avant réservation.</p>
      }
    </section>
  `,
  styles: [`
    :host { display: block; margin-top: 18px; }
    .calendar-panel { padding: 18px; border: 1px solid #dce6ed; border-radius: 16px; background: #fff; }
    .calendar-heading, .calendar-navigation { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .calendar-heading h3 { margin: 3px 0 0; font-size: 1.05rem; }
    .eyebrow { color: #55727f; font-size: .68rem; font-weight: 800; letter-spacing: .08em; }
    .calendar-navigation button { width: 32px; height: 32px; border: 1px solid #dce6ed; border-radius: 8px; background: #fff; color: #17425d; font-size: 1.2rem; cursor: pointer; }
    .calendar-navigation button:disabled { opacity: .4; cursor: not-allowed; }
    .calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 5px; margin-top: 14px; }
    .calendar-weekday { padding: 5px 0; color: #647786; text-align: center; font-size: .72rem; font-weight: 700; }
    .calendar-day { min-height: 58px; display: grid; align-content: center; gap: 3px; border: 1px solid #edf1f4; border-radius: 9px; background: #f8fafb; color: #52636f; font-size: .78rem; }
    .calendar-day.has-price { border-color: #9fdacf; background: #effaf7; color: #145c50; cursor: pointer; }
    .calendar-day.has-price:hover, .calendar-day.selected { outline: 2px solid #168c7e; outline-offset: 1px; }
    .calendar-day strong { font-size: .72rem; }
    .calendar-empty { min-height: 58px; }
    .calendar-status, .calendar-footnote { margin: 12px 0 0; color: #586b77; font-size: .82rem; }
    .calendar-error { color: #a62d36; }
    @media (max-width: 520px) { .calendar-panel { padding: 13px; } .calendar-heading { align-items: flex-start; flex-direction: column; } .calendar-day { min-height: 47px; font-size: .72rem; } .calendar-day strong { font-size: .64rem; } .calendar-empty { min-height: 47px; } }
  `]
})
export class MonthlyDateCalendar {
  private readonly destroyRef = inject(DestroyRef);
  private readonly offerService = inject(TravelOfferService);

  readonly originIata = input('');
  readonly destinationIata = input('');
  readonly destination = input('');
  readonly selectedDate = input('');
  readonly dateSelected = output<string>();
  protected readonly weekdays = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
  protected readonly prices = signal<MonthlyFlightPrice[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  private readonly month = signal(this.currentMonth());
  protected readonly monthLabel = computed(() => {
    const [year, month] = this.month().split('-').map(Number);
    return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
  });
  protected readonly calendarDays = computed<CalendarDay[]>(() => {
    const [year, month] = this.month().split('-').map(Number);
    const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();
    const pricesByDate = new Map(this.prices().map((price) => [price.departureDate, price]));
    return [
      ...Array.from({ length: firstWeekday }, () => ({ date: '', day: 0, price: null })),
      ...Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        const date = `${this.month()}-${String(day).padStart(2, '0')}`;
        return { date, day, price: pricesByDate.get(date) ?? null };
      })
    ];
  });
  protected readonly previousDisabled = computed(() => this.month() <= this.currentMonth());

  constructor() {
    effect(() => {
      const origin = this.originIata();
      const destinationIata = this.destinationIata();
      const destination = this.destination();
      const selectedDate = this.selectedDate();
      const selectedMonth = selectedDate.slice(0, 7);
      if (selectedMonth && selectedMonth !== this.month()) this.month.set(selectedMonth);
      if (origin.length === 3 && destinationIata.length === 3 && destination.trim()) {
        this.loadPrices(origin, destinationIata, destination, this.month());
      }
    });
  }

  protected changeMonth(offset: number): void {
    const [year, month] = this.month().split('-').map(Number);
    const next = new Date(year, month - 1 + offset, 1);
    const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    if (nextMonth >= this.currentMonth()) this.month.set(nextMonth);
  }

  protected select(date: string): void {
    this.dateSelected.emit(date);
  }

  private loadPrices(origin: string, destinationIata: string, destination: string, month: string): void {
    this.loading.set(true);
    this.error.set('');
    this.offerService.monthlyPrices(origin, destinationIata, destination, month)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (prices) => {
          this.prices.set(prices);
          this.loading.set(false);
        },
        error: () => {
          this.prices.set([]);
          this.error.set('Le calendrier tarifaire est momentanément indisponible. Réessayez plus tard.');
          this.loading.set(false);
        }
      });
  }

  private currentMonth(): string {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
}
