import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Observable, of, tap } from 'rxjs';

export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  user: AuthUser;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  displayName: string;
}

function resolveAuthBaseUrl(): string {
  const host = Capacitor.getPlatform() === 'android' ? '10.0.2.2' : 'localhost';
  return `http://${host}:8080/api/auth`;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = resolveAuthBaseUrl();
  private readonly storageKey = 'voyageo.auth.token';

  protected readonly currentUserSignal = signal<AuthUser | null>(null);
  protected readonly tokenSignal = signal<string | null>(localStorage.getItem(this.storageKey));

  readonly currentUser = computed(() => this.currentUserSignal());
  readonly isAuthenticated = computed(() => !!this.currentUserSignal());

  bootstrapSession(): Observable<AuthUser | null> {
    const token = this.tokenSignal();
    if (!token) {
      this.currentUserSignal.set(null);
      return of(null);
    }

    return this.http.get<AuthUser>(`${this.endpoint}/me`).pipe(
      tap({
        next: (user) => this.currentUserSignal.set(user),
        error: () => this.logout()
      })
    );
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.endpoint}/register`, payload).pipe(
      tap((response) => this.applyAuth(response))
    );
  }

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.endpoint}/login`, payload).pipe(
      tap((response) => this.applyAuth(response))
    );
  }

  logout(): void {
    this.currentUserSignal.set(null);
    this.tokenSignal.set(null);
    localStorage.removeItem(this.storageKey);
  }

  token(): string | null {
    return this.tokenSignal();
  }

  private applyAuth(response: AuthResponse): void {
    localStorage.setItem(this.storageKey, response.token);
    this.tokenSignal.set(response.token);
    this.currentUserSignal.set(response.user);
  }
}
