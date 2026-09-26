import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type OfferCategory = 'HOTEL' | 'FLIGHT' | 'TRAIN' | 'CAR';

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

@Injectable({ providedIn: 'root' })
export class TravelOfferService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = 'http://localhost:8080/api/offers';

  search(destination: string): Observable<TravelOffer[]> {
    let params = new HttpParams();
    if (destination) params = params.set('destination', destination);
    return this.http.get<TravelOffer[]>(this.endpoint, { params });
  }
}