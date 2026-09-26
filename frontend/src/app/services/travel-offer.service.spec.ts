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
});