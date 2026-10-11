import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { resolveBackendApiRoot } from './api-url';
import { TravelOffer } from './travel-offer.service';

@Injectable({ providedIn: 'root' })
export class FavoriteService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${resolveBackendApiRoot()}/favorites`;

  list(): Observable<TravelOffer[]> {
    return this.http.get<TravelOffer[]>(this.endpoint);
  }

  save(offer: TravelOffer): Observable<void> {
    return this.http.post<void>(this.endpoint, offer);
  }

  remove(offerId: string): Observable<void> {
    return this.http.delete<void>(`${this.endpoint}/${encodeURIComponent(offerId)}`);
  }
}
