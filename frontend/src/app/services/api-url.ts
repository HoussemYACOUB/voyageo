import { Capacitor } from '@capacitor/core';

export function resolveBackendApiRoot(): string {
  if (Capacitor.isNativePlatform()) {
    const host = Capacitor.getPlatform() === 'android' ? '10.0.2.2' : 'localhost';
    return `http://${host}:8080/api`;
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:8080/api';
  }
  return '/api';
}
