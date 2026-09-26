import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Observable } from 'rxjs';

export type OfferCategory = 'HOTEL' | 'FLIGHT' | 'TRAIN' | 'CAR';
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

@Injectable({ providedIn: 'root' })
export class TravelOfferService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = resolveApiBaseUrl();

  search(destination: string, category?: OfferCategory, sort?: OfferSort): Observable<TravelOffer[]> {
    let params = new HttpParams();
    if (destination) params = params.set('destination', destination);
    if (category) params = params.set('category', category);
    if (sort) params = params.set('sort', sort);
    return this.http.get<TravelOffer[]>(this.endpoint, { params });
  }

  destinations(): Observable<string[]> {
    return this.http.get<string[]>(`${this.endpoint}/destinations`);
  }
}