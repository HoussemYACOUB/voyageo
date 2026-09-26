import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { App } from './app';
import { TravelOffer, TravelOfferService } from './services/travel-offer.service';

const demoOffers: TravelOffer[] = [
  { id: 'stay-paris', category: 'HOTEL', title: 'Hôtel Paris', destination: 'Paris', provider: 'Démo', price: 119, currency: 'EUR', details: 'Centre-ville', rating: 4.5, demo: true },
  { id: 'train-paris', category: 'TRAIN', title: 'Lyon → Paris', destination: 'Paris', provider: 'Démo', price: 39, currency: 'EUR', details: 'Grande vitesse', rating: 4.6, demo: true },
  { id: 'flight-rome', category: 'FLIGHT', title: 'Paris → Rome', destination: 'Rome', provider: 'Démo', price: 104, currency: 'EUR', details: 'Vol direct', rating: 4.4, demo: true }
];

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let service: { search: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    service = { search: vi.fn(() => of(demoOffers)) };
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: TravelOfferService, useValue: service }]
    }).compileComponents();
    fixture = TestBed.createComponent(App);
    fixture.detectChanges();
  });

  it('loads and presents demonstration offers from the service', () => {
    expect(service.search).toHaveBeenCalledWith('');
    expect(fixture.nativeElement.textContent).toContain('Mode démonstration');
    expect(fixture.nativeElement.textContent).toContain('Hôtel Paris');
  });

  it('displays offers in ascending price order', () => {
    const titles = Array.from(fixture.nativeElement.querySelectorAll('.offer-card h3') as NodeListOf<HTMLElement>)
      .map((heading) => heading.textContent?.trim());
    expect(titles).toEqual(['Lyon → Paris', 'Paris → Rome', 'Hôtel Paris']);
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

    expect(service.search).toHaveBeenLastCalledWith('Tokyo');
  });
});
