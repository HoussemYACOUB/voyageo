# Voyageo — application mobile

Interface Angular responsive, empaquetable pour Android et iOS avec Capacitor. L’API Java fournit actuellement un catalogue de démonstration; les prix ne sont ni des tarifs en temps réel ni des offres réservables.

## Prérequis

- Node.js pris en charge par Angular 22 et npm
- Java 21+ pour l’API (`backend/mvnw`)
- Android Studio + Android SDK pour Android
- macOS + Xcode pour construire et signer iOS

## Lancer en local

1. Démarrer l’API depuis `backend/` avec `./mvnw spring-boot:run` (Windows : `mvnw.cmd spring-boot:run`). Elle écoute sur `http://localhost:8080`.
2. Dans `frontend/`, installer les dépendances avec `npm ci`, puis lancer `npm start`.
3. Ouvrir `http://localhost:4200`. L’API de démonstration est `GET /api/offers?destination=Paris`.

Pour un appareil physique, remplacer l’URL de l’API dans `src/app/services/travel-offer.service.ts` par une adresse joignable en HTTPS (ou l’adresse IP locale de développement); `localhost` désigne le téléphone dans une application native.

## Android et iOS

Après `npm ci`, ajouter les projets natifs une seule fois avec `npx cap add android` et `npx cap add ios`. Pour synchroniser les dernières ressources web et ouvrir l’IDE : `npm run mobile:sync`, puis `npm run mobile:android` ou `npm run mobile:ios`.

Les builds/signatures de production se font dans Android Studio et Xcode. L’accès à des fournisseurs de voyage réels demandera des comptes partenaires, des clés conservées uniquement côté serveur et des URL de réservation vérifiées.

## Tests

- Interface : `npm test` (tests unitaires Vitest)
- API et service : `cd backend && ./mvnw test`

## Périmètre de démonstration

La recherche filtre par destination; les filtres de catégorie et le tri par prix fonctionnent dans l’interface. Les champs de dates et voyageurs sont prêts côté interface mais ne modifient pas encore les exemples. La réservation, les favoris persistants, les prix en direct, les comptes utilisateur et les paiements ne sont pas activés.
