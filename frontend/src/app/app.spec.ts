import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { App } from './app';
import { AuthService } from './services/auth.service';
import { TravelOffer, TravelOfferService } from './services/travel-offer.service';

const demoOffers: TravelOffer[] = [
  { id: 'train-paris', category: 'TRAIN', title: 'Lyon → Paris', destination: 'Paris', provider: 'Démo', price: 39, currency: 'EUR', details: 'Grande vitesse', rating: 4.6, demo: true },
  { id: 'flight-rome', category: 'FLIGHT', title: 'Paris → Rome', destination: 'Rome', provider: 'Démo', price: 104, currency: 'EUR', details: 'Vol direct', rating: 4.9, demo: true }
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
    localStorage.clear();
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

  it('uses destination-specific high-resolution travel photography', () => {
    const images = Array.from(fixture.nativeElement.querySelectorAll('.art-photo') as NodeListOf<HTMLImageElement>);

    expect(images[0].src).toContain('photo-1502602898657-3e91760cbb34');
    expect(images[1].src).toContain('photo-1552832230-c0197dd311b5');
    expect(images[0].src).toContain('w=900');
    expect(images[0].getAttribute('decoding')).toBe('async');
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

  it('restores saved favorites after the app is reloaded', () => {
    (fixture.nativeElement.querySelector('.save-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.destroy();

    fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.favorite-count')?.textContent).toContain('1');
    expect(fixture.nativeElement.querySelector('.save-button')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('opens Voyageo account registration and sends the form to its auth service', async () => {
    (Array.from(fixture.nativeElement.querySelectorAll('.auth-secondary')) as HTMLButtonElement[])
      .find((button) => button.textContent?.includes('Créer un compte'))?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const fields: Record<string, string> = {
      displayName: 'Alex Voyageur',
      email: 'alex@example.com',
      password: 'un-mot-de-passe-solide'
    };
    for (const [name, value] of Object.entries(fields)) {
      const input = fixture.nativeElement.querySelector(`input[name="${name}"]`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await fixture.whenStable();
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('.auth-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(authService.register).toHaveBeenCalledWith({
      email: 'alex@example.com',
      password: 'un-mot-de-passe-solide',
      displayName: 'Alex Voyageur'
    });
    expect(fixture.nativeElement.querySelector('.auth-overlay')).toBeNull();
  });

  it('shows the signed-in user profile when the account avatar is selected', () => {
    const account = { id: 1, email: 'alex@example.com', displayName: 'Alex Voyageur' };
    authService.currentUser.set(account);
    authService.isAuthenticated.set(true);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.profile-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.profile-summary')?.textContent).toContain('alex@example.com');
    expect(fixture.nativeElement.querySelector('.profile-actions')?.textContent).toContain('Voir mes favoris');
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

  it('filters autocomplete results to the typed city', async () => {
    service.autocomplete.mockReturnValue(of([
      { text: 'Kars, Turquie', iataCode: 'KSY', type: 'city', provider: 'travelpayouts' },
      { text: 'Paris, France', iataCode: 'PAR', type: 'city', provider: 'travelpayouts' }
    ]));
    const input = fixture.nativeElement.querySelector('input[name="destination"]') as HTMLInputElement;
    input.value = 'Paris';
    input.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 300));
    fixture.detectChanges();

    const suggestions = fixture.nativeElement.querySelectorAll('#destination-city-options [role="option"]');
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].textContent).toContain('Paris');
    expect(suggestions[0].textContent).not.toContain('Kars');
  });

  it('offers labeled local autocomplete suggestions when the provider is unavailable', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    service.autocomplete.mockReturnValue(throwError(() => new Error('offline')));
    const input = fixture.nativeElement.querySelector('input[name="destination"]') as HTMLInputElement;
    input.value = 'Paris';
    input.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 300));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#destination-city-options')?.textContent).toContain('Paris, France');
    expect(fixture.nativeElement.querySelector('#destination-city-options')?.textContent).toContain('Suggestions locales');
    vi.restoreAllMocks();
  });

  it('swaps the origin, destination, and selected airport codes', async () => {
    await fixture.whenStable();
    const origin = fixture.nativeElement.querySelector('input[name="origin"]') as HTMLInputElement;
    origin.value = 'Paris';
    origin.dispatchEvent(new Event('input'));
    const destination = fixture.nativeElement.querySelector('input[name="destination"]') as HTMLInputElement;
    destination.value = 'Lyon';
    destination.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.route-swap') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement.querySelector('input[name="origin"]') as HTMLInputElement).value).toBe('Lyon');
    expect((fixture.nativeElement.querySelector('input[name="destination"]') as HTMLInputElement).value).toBe('Paris');
  });

  it('rejects a return date before departure instead of hiding the results', () => {
    const departure = fixture.nativeElement.querySelector('input[name="departure"]') as HTMLInputElement;
    departure.value = '2099-10-20';
    departure.dispatchEvent(new Event('input'));
    const returnDate = fixture.nativeElement.querySelector('input[name="return"]') as HTMLInputElement;
    returnDate.value = '2099-10-15';
    returnDate.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.search-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('postérieure');
  });

  it('resorts offers by rating locally without another provider request', () => {
    const select = fixture.nativeElement.querySelector('select[name="sort"]') as HTMLSelectElement;
    select.value = 'rating';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const titles = Array.from(fixture.nativeElement.querySelectorAll('.offer-card h3') as NodeListOf<HTMLElement>)
      .map((heading) => heading.textContent?.trim());
    expect(titles).toEqual(['Paris → Rome', 'Lyon → Paris']);
    expect(service.search).toHaveBeenCalledTimes(1);
  });

  it('shows a price chart only for comparable offers in the selected category', () => {
    service.search.mockReturnValue(of([
      { id: 'flight-one', category: 'FLIGHT', title: 'Paris → Rome', destination: 'Rome', provider: 'Démo', price: 80, currency: 'EUR', details: 'Vol direct', rating: 4.5, demo: true },
      { id: 'flight-two', category: 'FLIGHT', title: 'Paris → Lisbonne', destination: 'Lisbonne', provider: 'Démo', price: 120, currency: 'EUR', details: 'Vol direct', rating: 4.4, demo: true }
    ]));

    const flightFilter = Array.from(fixture.nativeElement.querySelectorAll('.category-chip') as NodeListOf<HTMLButtonElement>)
      .find((button) => button.textContent?.includes('Vols'));
    flightFilter?.click();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.price-chart-row');
    expect(rows.length).toBe(2);
    expect(fixture.nativeElement.querySelector('.price-chart')?.textContent).toContain('Même catégorie · même devise');
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
