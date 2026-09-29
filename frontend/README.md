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

## Suggestions et prix de vols

Les champs de ville utilisent l’API publique Travelpayouts/Aviasales pour les suggestions et codes IATA; Geoapify peut la remplacer avec `GEOAPIFY_API_KEY` (forfait gratuit annoncé à 3 000 requêtes/jour, sans carte bancaire). Google Places est proposé en dernier recours et demande une clé Google Maps avec facturation. Les clés sont des variables d’environnement Netlify, jamais du code.

Le backend accepte `TRAVELPAYOUTS_TOKEN` (variable secrète Render) pour demander des tarifs Aviasales pour une route IATA et des dates. L’API Data renvoie des tarifs observés en cache, parfois vieux de 2 à 7 jours: ils sont indicatifs et doivent être revérifiés auprès du partenaire. Sans token, les exemples de vols restent marqués comme démo. Travelpayouts indique ne pas fournir d’API hôtels; les cartes hôtels restent des exemples avec liens partenaires. Google Flights n’a pas d’API publique de tarifs; son lien prérempli est une redirection, pas une comparaison API.

Pour tester les fonctions Netlify en local, copiez `.env.example` vers `.env` dans `frontend/`, puis lancez `npx netlify-cli dev`. Pour les prix Aviasales, configurez `TRAVELPAYOUTS_TOKEN` dans Render.

Pour un appareil physique, remplacer l’URL de l’API dans `src/app/services/travel-offer.service.ts` par une adresse joignable en HTTPS (ou l’adresse IP locale de développement); `localhost` désigne le téléphone dans une application native.

## Android et iOS

Après `npm ci`, ajouter les projets natifs une seule fois avec `npx cap add android` et `npx cap add ios`. Pour synchroniser les dernières ressources web et ouvrir l’IDE : `npm run mobile:sync`, puis `npm run mobile:android` ou `npm run mobile:ios`.

Les builds/signatures de production se font dans Android Studio et Xcode. L’accès à des fournisseurs de voyage réels demandera des comptes partenaires, des clés conservées uniquement côté serveur et des URL de réservation vérifiées.

## Tests

- Interface : `npm test` (tests unitaires Vitest)
- API et service : `cd backend && ./mvnw test`

## Périmètre de démonstration

La recherche filtre par destination; les filtres de catégorie et le tri par prix fonctionnent dans l’interface. Les champs de dates et voyageurs sont prêts côté interface mais ne modifient pas encore les exemples. La réservation, les favoris persistants, les prix en direct, les comptes utilisateur et les paiements ne sont pas activés.
