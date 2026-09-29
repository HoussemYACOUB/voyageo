import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TravelOfferService } from './travel-offer.service';

describe('TravelOfferService', () => {
  let service: TravelOfferService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(TravelOfferService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests the demo API and encodes the destination', () => {
    service.search('Île de France').subscribe((offers) => expect(offers).toEqual([]));

    const request = http.expectOne((candidate) => candidate.url === 'http://localhost:8080/api/offers');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('destination')).toBe('Île de France');
    request.flush([]);
  });

  it('omits an empty destination parameter', () => {
    service.search('').subscribe();

    const request = http.expectOne('http://localhost:8080/api/offers');
    expect(request.request.params.has('destination')).toBe(false);
    request.flush([]);
  });

  it('includes category and sort parameters when provided', () => {
    service.search('Paris', 'FLIGHT', 'rating').subscribe();

    const request = http.expectOne((candidate) => candidate.url === 'http://localhost:8080/api/offers');
    expect(request.request.params.get('category')).toBe('FLIGHT');
    expect(request.request.params.get('sort')).toBe('rating');
    request.flush([]);
  });

  it('includes Travelpayouts route codes and dates for a flight search', () => {
    service.search('Lisbonne, Portugal', 'FLIGHT', 'price', {
      originIata: 'PAR',
      destinationIata: 'LIS',
      departureDate: '2026-11-15',
      returnDate: '2026-11-22'
    }).subscribe();

    const request = http.expectOne((candidate) => candidate.url === 'http://localhost:8080/api/offers');
    expect(request.request.params.get('originIata')).toBe('PAR');
    expect(request.request.params.get('destinationIata')).toBe('LIS');
    expect(request.request.params.get('departureDate')).toBe('2026-11-15');
    expect(request.request.params.get('returnDate')).toBe('2026-11-22');
    request.flush([]);
  });

  it('fetches the list of destination suggestions', () => {
    service.destinations().subscribe((destinations) => expect(destinations).toEqual(['Lyon', 'Paris']));

    const request = http.expectOne('http://localhost:8080/api/offers/destinations');
    expect(request.request.method).toBe('GET');
    request.flush(['Lyon', 'Paris']);
  });

  it('requests Google city autocomplete through the Netlify function', () => {
    service.autocomplete('Lisbon').subscribe((suggestions) => {
      expect(suggestions).toEqual([{ text: 'Lisbon, Portugal', placeId: 'place-id', provider: 'google' }]);
    });

    const request = http.expectOne((candidate) => candidate.url === 'http://localhost:8888/api/places/autocomplete');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('q')).toBe('Lisbon');
    request.flush({ suggestions: [{ text: 'Lisbon, Portugal', placeId: 'place-id', provider: 'google' }] });
  });
});