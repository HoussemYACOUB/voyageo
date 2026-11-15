# Voyageo — application mobile

Interface Angular responsive, empaquetable pour Android et iOS avec Capacitor, avec une API Java pour les offres et les comptes.

## Prérequis

- Node.js pris en charge par Angular 22 et npm
- Java 21+ pour l’API (`backend/mvnw`)
- Android Studio + Android SDK pour Android
- macOS + Xcode pour construire et signer iOS

## Lancer en local

1. Démarrer l’API depuis `backend/` avec `./mvnw spring-boot:run` (Windows : `mvnw.cmd spring-boot:run`). Elle écoute sur `http://localhost:8080`.
2. Dans `frontend/`, installer les dépendances avec `npm ci`, puis lancer `npm start`.
3. Ouvrir `http://localhost:4200`. Les offres sont disponibles via `GET /api/offers?destination=Paris`.

## Fournisseurs de voyage et quotas

Les suggestions de villes et codes IATA utilisent Travelpayouts/Aviasales. Geoapify peut être activé avec `GEOAPIFY_API_KEY`; Google Places reste un recours optionnel nécessitant une clé avec facturation. Les clés de ces fonctions Netlify sont des variables d’environnement, jamais du code.

Le backend accepte `TRAVELPAYOUTS_TOKEN` pour rechercher des tarifs Aviasales par route IATA et dates. Les résultats peuvent être issus d’un cache de plusieurs jours ; ils sont indicatifs et doivent être vérifiés chez le transporteur.

Les recherches d’hôtels utilisent Booking.com via Booking COM sur RapidAPI et nécessitent `RAPIDAPI_KEY` côté backend. Le quota gratuit dépend du forfait et des conditions en vigueur chez RapidAPI ; vérifiez-le dans votre compte avant utilisation. Sans identifiants ou dates valides, aucune offre d’hôtel en direct n’est renvoyée.

Ces intégrations fournissent de la recherche et des liens vers les fournisseurs, pas une API de réservation ou de paiement gratuite. Aucune réservation n’est finalisée dans Voyageo. Les tarifs et disponibilités peuvent changer et doivent être confirmés sur le site partenaire.

Pour tester les fonctions Netlify en local, copiez `.env.example` vers `.env` dans `frontend/`, puis lancez `npx netlify-cli dev`. Configurez les secrets des fournisseurs dans l’environnement de déploiement correspondant.

Pour un appareil physique, remplacer l’URL de l’API dans `src/app/services/travel-offer.service.ts` par une adresse joignable en HTTPS (ou l’adresse IP locale de développement); `localhost` désigne le téléphone dans une application native.

## Android et iOS

Après `npm ci`, ajouter les projets natifs une seule fois avec `npx cap add android` et `npx cap add ios`. Pour synchroniser les dernières ressources web et ouvrir l’IDE : `npm run mobile:sync`, puis `npm run mobile:android` ou `npm run mobile:ios`.

Les builds/signatures de production se font dans Android Studio et Xcode. L’accès à des fournisseurs de voyage réels demandera des comptes partenaires, des clés conservées uniquement côté serveur et des URL de réservation vérifiées.

## Tests

- Interface : `npm test` (tests unitaires Vitest)
- API et service : `cd backend && ./mvnw test`

## Limites fonctionnelles

Le tri et le budget maximum par offre sont appliqués dans l’interface sans nouvel appel fournisseur ; les montants sont comparés uniquement dans la devise choisie, et le filtre peut être effacé. Jusqu’à trois offres peuvent être comparées, avec les prix affichés dans leur devise d’origine. Une recherche peut être partagée sous forme de lien qui restaure ses critères à l’ouverture. Le carnet de voyage permet d’enregistrer des offres, de tenir une checklist et des notes, de suivre les estimations séparément par devise, puis d’exporter le tout en JSON ; il reste stocké sur l’appareil et n’est pas synchronisé au compte. Les six recherches récentes et les favoris des visiteurs sont conservés localement sur l’appareil et peuvent être effacés depuis l’interface. Les offres de démonstration sont clairement identifiées et ne sont pas réservables. Les comptes permettent l’authentification, mais Voyageo ne stocke pas les réservations et ne traite aucun paiement.
