import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { MonthlyDateCalendar } from './monthly-date-calendar';
import { TravelOfferService } from '../services/travel-offer.service';

describe('MonthlyDateCalendar', () => {
  let fixture: ComponentFixture<MonthlyDateCalendar>;
  let monthlyPrices: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const today = new Date();
    const availableDate = new Date(today.getFullYear(), today.getMonth() + 2, 12).toISOString().slice(0, 10);
    monthlyPrices = vi.fn(() => of([{ departureDate: availableDate, price: 98, currency: 'EUR' }]));
    await TestBed.configureTestingModule({
      imports: [MonthlyDateCalendar],
      providers: [{ provide: TravelOfferService, useValue: { monthlyPrices } }]
    }).compileComponents();
    fixture = TestBed.createComponent(MonthlyDateCalendar);
    fixture.componentRef.setInput('originIata', 'PAR');
    fixture.componentRef.setInput('destinationIata', 'LIS');
    fixture.componentRef.setInput('destination', 'Lisbonne');
    fixture.componentRef.setInput('selectedDate', availableDate);
    fixture.detectChanges();
  });

  it('shows actual monthly provider fares and leaves unavailable dates unpriced', () => {
    const today = new Date();
    const availableDate = new Date(today.getFullYear(), today.getMonth() + 2, 12).toISOString().slice(0, 10);
    fixture.detectChanges();

    expect(monthlyPrices).toHaveBeenCalledWith('PAR', 'LIS', 'Lisbonne', availableDate.slice(0, 7));
    const pricedDay = fixture.nativeElement.querySelector(`[aria-label^="${availableDate},"]`) as HTMLButtonElement;
    expect(pricedDay).not.toBeNull();
    expect(pricedDay.textContent).toContain('98');
    expect(fixture.nativeElement.querySelector(`[aria-label="${availableDate.slice(0, 8)}13, tarif indisponible"]`)?.disabled).toBe(true);
  });
});
