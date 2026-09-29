import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { App } from './app';
import { AuthService } from './services/auth.service';
import { TravelOffer, TravelOfferService } from './services/travel-offer.service';

const demoOffers: TravelOffer[] = [
  { id: 'train-paris', category: 'TRAIN', title: 'Lyon → Paris', destination: 'Paris', provider: 'Démo', price: 39, currency: 'EUR', details: 'Grande vitesse', rating: 4.6, demo: true },
  { id: 'flight-rome', category: 'FLIGHT', title: 'Paris → Rome', destination: 'Rome', provider: 'Démo', price: 104, currency: 'EUR', details: 'Vol direct', rating: 4.4, demo: true }
];

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let service: { search: ReturnType<typeof vi.fn>; destinations: ReturnType<typeof vi.fn>; autocomplete: ReturnType<typeof vi.fn> };
  let authService: {
    currentUser: ReturnType<typeof signal>;
    isAuthenticated: ReturnType<typeof signal>;
    bootstrapSession: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      search: vi.fn(() => of(demoOffers)),
      destinations: vi.fn(() => of(['Paris', 'Rome'])),
      autocomplete: vi.fn(() => of([]))
    };
    authService = {
      currentUser: signal(null),
      isAuthenticated: signal(false),
      bootstrapSession: vi.fn(() => of(null)),
      login: vi.fn(() => of({ token: 'x', tokenType: 'Bearer', user: { id: 1, email: 'a@b.com', displayName: 'Alex' } })),
      register: vi.fn(() => of({ token: 'x', tokenType: 'Bearer', user: { id: 1, email: 'a@b.com', displayName: 'Alex' } })),
      logout: vi.fn()
    };
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: TravelOfferService, useValue: service },
        { provide: AuthService, useValue: authService }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(App);
    fixture.detectChanges();
  });

  it('loads demonstration offers without inventing hotel prices', () => {
    expect(service.search).toHaveBeenCalledWith('', undefined, 'price');
    expect(fixture.nativeElement.textContent).toContain('Mode démonstration');
    expect(fixture.nativeElement.textContent).not.toContain('Hôtel Paris');
  });

  it('displays offers in ascending price order', () => {
    const titles = Array.from(fixture.nativeElement.querySelectorAll('.offer-card h3') as NodeListOf<HTMLElement>)
      .map((heading) => heading.textContent?.trim());
    expect(titles).toEqual(['Lyon → Paris', 'Paris → Rome']);
  });

  it('filters offers by selected category', () => {
    const trainFilter = Array.from(fixture.nativeElement.querySelectorAll('.category-chip') as NodeListOf<HTMLButtonElement>)
      .find((button) => button.textContent?.includes('Trains'));
    trainFilter?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.offer-card').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.offer-card h3')?.textContent).toContain('Lyon → Paris');
  });

  it('adds an offer to favorites and updates the counter', () => {
    const favoriteButton = fixture.nativeElement.querySelector('.save-button') as HTMLButtonElement;
    favoriteButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.favorite-count')?.textContent).toContain('1');
    expect(favoriteButton.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows only saved offers in the favorites view', () => {
    (fixture.nativeElement.querySelector('.save-button') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('.favorites-link') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.offer-card').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.offer-card h3')?.textContent).toContain('Lyon → Paris');
  });

  it('sends a trimmed destination when searching', () => {
    const input = fixture.nativeElement.querySelector('input[name="destination"]') as HTMLInputElement;
    input.value = '  Tokyo  ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.search-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(service.search).toHaveBeenLastCalledWith('Tokyo', undefined, 'price');
  });

  it('quick-searches a suggested destination in one click', () => {
    const suggestion = Array.from(fixture.nativeElement.querySelectorAll('.suggestion-chip') as NodeListOf<HTMLButtonElement>)
      .find((button) => button.textContent?.includes('Rome'));
    suggestion?.click();
    fixture.detectChanges();

    expect(service.search).toHaveBeenLastCalledWith('Rome', undefined, 'price');
  });

  it('resorts offers by rating when the sort option changes', () => {
    const select = fixture.nativeElement.querySelector('select[name="sort"]') as HTMLSelectElement;
    select.value = 'rating';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(service.search).toHaveBeenLastCalledWith('', undefined, 'rating');
  });

  it('opens a BlaBlaCar search with the selected route and departure date', () => {
    const origin = fixture.nativeElement.querySelector('input[name="origin"]') as HTMLInputElement;
    origin.value = 'Paris';
    origin.dispatchEvent(new Event('input'));
    const destination = fixture.nativeElement.querySelector('input[name="destination"]') as HTMLInputElement;
    destination.value = 'Lyon';
    destination.dispatchEvent(new Event('input'));
    const departure = fixture.nativeElement.querySelector('input[name="departure"]') as HTMLInputElement;
    departure.value = '2026-10-15';
    departure.dispatchEvent(new Event('input'));

    const carpoolFilter = Array.from(fixture.nativeElement.querySelectorAll('.category-chip') as NodeListOf<HTMLButtonElement>)
      .find((button) => button.textContent?.includes('Covoiturage'));
    carpoolFilter?.click();
    fixture.detectChanges();

    const partnerLink = fixture.nativeElement.querySelector('.partner-chip') as HTMLAnchorElement;
    expect(partnerLink.textContent).toContain('BlaBlaCar');
    expect(partnerLink.getAttribute('href')).toContain('fn=Paris');
    expect(partnerLink.getAttribute('href')).toContain('tn=Lyon');
    expect(partnerLink.getAttribute('href')).toContain('db=2026-10-15');
    expect(fixture.nativeElement.textContent).not.toContain('Mode démonstration');
  });

  it('opens partner hotel searches with destination, dates, and traveler count', () => {
    const destination = fixture.nativeElement.querySelector('input[name="destination"]') as HTMLInputElement;
    destination.value = 'Lisbonne, Portugal';
    destination.dispatchEvent(new Event('input'));
    const departure = fixture.nativeElement.querySelector('input[name="departure"]') as HTMLInputElement;
    departure.value = '2026-10-15';
    departure.dispatchEvent(new Event('input'));
    const returnDate = fixture.nativeElement.querySelector('input[name="return"]') as HTMLInputElement;
    returnDate.value = '2026-10-22';
    returnDate.dispatchEvent(new Event('input'));
    const travelers = fixture.nativeElement.querySelector('select[name="travelers"]') as HTMLSelectElement;
    travelers.selectedIndex = 2;
    travelers.dispatchEvent(new Event('change'));

    const hotelFilter = Array.from(fixture.nativeElement.querySelectorAll('.category-chip') as NodeListOf<HTMLButtonElement>)
      .find((button) => button.textContent?.includes('Hébergements'));
    hotelFilter?.click();
    fixture.detectChanges();

    const partnerLinks = Array.from(fixture.nativeElement.querySelectorAll('.hotel-search-links a') as NodeListOf<HTMLAnchorElement>);
    expect(partnerLinks).toHaveLength(2);
    const bookingUrl = new URL(partnerLinks.find((link) => link.textContent?.includes('Booking.com'))!.href);
    expect(bookingUrl.searchParams.get('ss')).toBe('Lisbonne, Portugal');
    expect(bookingUrl.searchParams.get('checkin')).toBe('2026-10-15');
    expect(bookingUrl.searchParams.get('checkout')).toBe('2026-10-22');
    expect(bookingUrl.searchParams.get('group_adults')).toBe('3');
    const googleHotelsUrl = new URL(partnerLinks.find((link) => link.textContent?.includes('Google Hotels'))!.href);
    expect(googleHotelsUrl.searchParams.get('q')).toContain('Lisbonne, Portugal');
    expect(googleHotelsUrl.searchParams.get('adults')).toBe('3');
    expect(fixture.nativeElement.textContent).toContain('disponibilités');
  });
});
