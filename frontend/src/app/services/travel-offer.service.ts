import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { resolveBackendApiRoot } from './api-url';

export type OfferCategory = 'HOTEL' | 'FLIGHT' | 'TRAIN' | 'CAR' | 'CARPOOL';
export type OfferSort = 'price' | 'rating';

export interface TravelOffer {
  id: string;
  category: OfferCategory;
  title: string;
  destination: string;
  provider: string;
  price: number;
  currency: string;
  details: string;
  rating: number;
  demo: boolean;
  bookingUrl?: string | null;
  departureDate?: string | null;
}

export interface MonthlyFlightPrice {
  departureDate: string;
  price: number;
  currency: string;
}

export interface CitySuggestion {
  text: string;
  placeId?: string;
  iataCode?: string;
  type?: 'city' | 'airport';
  provider?: 'google' | 'geoapify' | 'travelpayouts' | 'fallback';
}

export interface FlightSearchRoute {
  originIata: string;
  destinationIata: string;
  departureDate: string;
  returnDate?: string;
}

export interface HotelSearchCriteria {
  checkIn: string;
  checkOut: string;
  adults: number;
}

function resolveAutocompleteUrl(): string {
  if (typeof window !== 'undefined' && window.location.protocol === 'capacitor:') {
    return 'https://voyageo-app.netlify.app/api/places/autocomplete';
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'https://voyageo-app.netlify.app/api/places/autocomplete';
  }
  return '/api/places/autocomplete';
}

@Injectable({ providedIn: 'root' })
export class TravelOfferService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${resolveBackendApiRoot()}/offers`;
  private readonly autocompleteEndpoint = resolveAutocompleteUrl();

  search(destination: string, category?: OfferCategory, sort?: OfferSort, route?: FlightSearchRoute, hotel?: HotelSearchCriteria): Observable<TravelOffer[]> {
    let params = new HttpParams();
    if (destination) params = params.set('destination', destination);
    if (category) params = params.set('category', category);
    if (sort) params = params.set('sort', sort);
    if (route) {
      params = params
        .set('originIata', route.originIata)
        .set('destinationIata', route.destinationIata)
        .set('departureDate', route.departureDate);
      if (route.returnDate) params = params.set('returnDate', route.returnDate);
    }
    if (hotel) {
      params = params
        .set('hotelCheckIn', hotel.checkIn)
        .set('hotelCheckOut', hotel.checkOut)
        .set('adults', hotel.adults);
    }
    return this.http.get<TravelOffer[]>(this.endpoint, { params });
  }

  destinations(): Observable<string[]> {
    return this.http.get<string[]>(`${this.endpoint}/destinations`);
  }

  autocomplete(query: string): Observable<CitySuggestion[]> {
    const params = new HttpParams().set('q', query);
    return this.http.get<{ suggestions?: CitySuggestion[] }>(this.autocompleteEndpoint, { params }).pipe(
      map((response) => response.suggestions ?? [])
    );
  }

  monthlyPrices(originIata: string, destinationIata: string, destination: string, month: string): Observable<MonthlyFlightPrice[]> {
    const params = new HttpParams()
      .set('originIata', originIata)
      .set('destinationIata', destinationIata)
      .set('destination', destination)
      .set('month', month);
    return this.http.get<MonthlyFlightPrice[]>(`${this.endpoint}/calendar`, { params });
  }
}