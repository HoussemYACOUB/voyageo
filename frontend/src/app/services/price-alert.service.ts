import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { resolveBackendApiRoot } from './api-url';
import { FlightSearchRoute } from './travel-offer.service';

export interface PriceAlert {
  id: number;
  originIata: string;
  destinationIata: string;
  destination: string;
  departureDate: string;
  returnDate: string | null;
  targetPrice: number;
  currency: string;
  status: 'ACTIVE' | 'TRIGGERED';
  observedPrice: number | null;
  emailNotifications: boolean;
  createdAt: string;
  triggeredAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class PriceAlertService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${resolveBackendApiRoot()}/price-alerts`;

  list(): Observable<PriceAlert[]> {
    return this.http.get<PriceAlert[]>(this.endpoint);
  }

  create(
    route: FlightSearchRoute,
    destination: string,
    targetPrice: number,
    emailNotifications: boolean
  ): Observable<PriceAlert> {
    return this.http.post<PriceAlert>(this.endpoint, {
      ...route,
      destination,
      targetPrice,
      emailNotifications
    });
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.endpoint}/${id}`);
  }

  emailAvailable(): Observable<boolean> {
    return this.http.get<boolean>(`${this.endpoint}/email-available`);
  }
}
