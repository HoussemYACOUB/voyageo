import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { map, Observable } from 'rxjs';

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

// En natif (Android/iOS) on cible le backend local ; sur le web deploye on utilise un chemin relatif proxifie par Netlify
function resolveApiBaseUrl(): string {
  if (Capacitor.isNativePlatform()) {
    const host = Capacitor.getPlatform() === 'android' ? '10.0.2.2' : 'localhost';
    return `http://${host}:8080/api/offers`;
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:8080/api/offers';
  }
  return '/api/offers';
}

function resolveAutocompleteUrl(): string {
  if (Capacitor.isNativePlatform()) {
    return 'https://voyageo-app.netlify.app/api/places/autocomplete';
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:8888/api/places/autocomplete';
  }
  return '/api/places/autocomplete';
}

@Injectable({ providedIn: 'root' })
export class TravelOfferService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = resolveApiBaseUrl();
  private readonly autocompleteEndpoint = resolveAutocompleteUrl();

  search(destination: string, category?: OfferCategory, sort?: OfferSort, route?: FlightSearchRoute): Observable<TravelOffer[]> {
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
}