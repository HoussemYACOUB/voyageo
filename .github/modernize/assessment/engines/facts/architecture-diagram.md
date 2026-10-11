# Architecture Diagram

Voyageo is a French-language travel comparison application with an Angular client and a Spring Boot REST API. The diagrams show the current application boundaries and how authenticated account features flow through the frontend and backend.

## Application Architecture

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
```mermaid
flowchart TD
    subgraph ClientLayer["Client Layer"]
        Browser["Desktop and mobile browser"]
    end
    subgraph FrontendLayer["Frontend Layer"]
        Netlify["Netlify frontend hosting"]
        AngularApp["Angular 22 application"]
    end
    subgraph BackendLayer["Backend Layer"]
        Render["Render backend hosting"]
        RestApi["Spring Boot 4 REST API"]
        Security["Spring Security JWT"]
        TravelLogic["Travel and account services"]
    end
    subgraph DataLayer["Data Layer"]
        JPA["Spring Data JPA"]
        H2[("H2 local database")]
        PostgreSQL[("PostgreSQL production option")]
    end
    subgraph ExternalLayer["External Services"]
        Flights["Travelpayouts Aviasales API"]
        Hotels["Booking.com via RapidAPI"]
        Mail["Optional SMTP email"]
        CI["GitHub Actions and SonarQube"]
    end

    Browser -->|"loads web application"| Netlify
    Netlify -->|"serves Angular assets"| AngularApp
    AngularApp -->|"JSON over HTTP"| Render
    Render -->|"runs"| RestApi
    RestApi -->|"authenticates protected requests"| Security
    Security -->|"routes authorized requests"| TravelLogic
    TravelLogic -->|"uses ORM"| JPA
    JPA -->|"local profile"| H2
    JPA -->|"production profile"| PostgreSQL
    TravelLogic -->|"searches flight prices"| Flights
    TravelLogic -->|"searches hotels"| Hotels
    TravelLogic -->|"sends configured notifications"| Mail
    CI -->|"tests and analyzes changes"| RestApi
    CI -->|"tests and builds changes"| AngularApp
```

### Technology Stack Summary

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Frontend | Angular | 22 | Search, account, favorites, price alerts, and flexible-date UI |
| Frontend language | TypeScript | 6 | Typed client application |
| Frontend reactive APIs | RxJS | 7.8 | HTTP request and event streams |
| Backend | Spring Boot | 4.0.0 | REST API, dependency injection, scheduling, and configuration |
| Backend language | Java | 21 | API and business logic |
| Persistence | Spring Data JPA | Managed by Spring Boot | Relational persistence and repositories |
| Local database | H2 | Managed by Spring Boot | Local development and test persistence |
| Production database option | PostgreSQL | Driver configured | Persistent production storage when a datasource is provided |
| CI and analysis | GitHub Actions and SonarQube or SonarCloud | Workflow actions | Tests, builds, and optional static analysis |
| Hosting | Netlify and Render | Hosted services | Frontend delivery and backend execution |

### Data Storage & External Services

Spring Data JPA stores accounts, favorites, and price alerts. H2 is the default local database; PostgreSQL can be selected through datasource environment variables, but a hosted database must be provisioned and connected separately. The travel service calls Travelpayouts Aviasales for flight prices and Booking.com through RapidAPI for hotel offers. SMTP email is optional; account notifications remain in Voyageo when SMTP is not configured.

### Key Architectural Decisions

- The backend separates HTTP controllers, business services, and persistence repositories; JWT authentication protects account-specific operations.
- An AOP aspect measures service execution time without logging method arguments.
- Provider credentials, datasource values, mail settings, and analysis tokens are supplied through environment variables or CI secrets rather than source code.

## Component Relationships

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
```mermaid
flowchart LR
    subgraph PresentationLayer["Presentation"]
        cSearchUI["Travel search UI"]
        cCalendarUI["Monthly fare calendar"]
        cAccountUI["Account UI"]
        cFavoriteUI["Favorites UI"]
        cAlertUI["Price alert UI"]
    end
    subgraph ClientServiceLayer["Frontend Services"]
        cTravelClient["TravelOfferService"]
        cAuthClient["AuthService"]
        cFavoriteClient["FavoriteService"]
        cAlertClient["PriceAlertService"]
    end
    subgraph ApiLayer["Backend Controllers"]
        cTravelController["TravelOfferController"]
        cAuthController["AuthController"]
        cFavoriteController["FavoriteOfferController"]
        cAlertController["PriceAlertController"]
    end
    subgraph BusinessLayer["Backend Services"]
        cTravelService["TravelOfferService"]
        cAuthService["AuthService"]
        cFavoriteService["FavoriteOfferService"]
        cAlertService["PriceAlertService"]
    end
    subgraph DataAccessLayer["Data Access"]
        cUserRepo["UserAccountRepository"]
        cFavoriteRepo["FavoriteOfferRepository"]
        cAlertRepo["PriceAlertRepository"]
    end
    subgraph CrossCuttingLayer["Cross Cutting"]
        cJwtFilter["JwtAuthenticationFilter"]
        cTimingAspect["ServiceTimingAspect"]
    end

    cSearchUI -->|"searches offers"| cTravelClient
    cCalendarUI -->|"loads monthly fares"| cTravelClient
    cTravelClient -->|"calls REST API"| cTravelController
    cTravelController -->|"delegates"| cTravelService
    cAccountUI -->|"signs in or registers"| cAuthClient
    cAuthClient -->|"calls REST API"| cAuthController
    cAuthController -->|"delegates"| cAuthService
    cAuthService -->|"loads account"| cUserRepo
    cFavoriteUI -->|"manages saved offers"| cFavoriteClient
    cFavoriteClient -->|"calls REST API"| cFavoriteController
    cFavoriteController -->|"delegates"| cFavoriteService
    cFavoriteService -->|"persists account favorites"| cFavoriteRepo
    cFavoriteService -->|"checks account ownership"| cUserRepo
    cAlertUI -->|"manages price alerts"| cAlertClient
    cAlertClient -->|"calls REST API"| cAlertController
    cAlertController -->|"delegates"| cAlertService
    cAlertService -->|"persists alert state"| cAlertRepo
    cAlertService -->|"checks account ownership"| cUserRepo
    cAlertService -->|"checks current fares"| cTravelService
    cJwtFilter -.->|"authenticates requests"| cTravelController
    cJwtFilter -.->|"authenticates requests"| cAuthController
    cJwtFilter -.->|"authenticates requests"| cFavoriteController
    cJwtFilter -.->|"authenticates requests"| cAlertController
    cTimingAspect -.->|"measures service calls"| cTravelService
    cTimingAspect -.->|"measures service calls"| cAuthService
    cTimingAspect -.->|"measures service calls"| cFavoriteService
    cTimingAspect -.->|"measures service calls"| cAlertService
```

### Component Inventory

| Component | Layer | Type | Responsibility |
|---|---|---|---|
| Travel search UI | Presentation | Angular component | Collects travel search criteria and displays offers |
| Monthly fare calendar | Presentation | Angular component | Displays provider-returned monthly fares and emits a selected date |
| Account UI | Presentation | Angular component | Provides login, registration, and profile interactions |
| Favorites UI | Presentation | Angular component | Saves offers locally or to the signed-in account |
| Price alert UI | Presentation | Angular component | Creates and manages account price alerts |
| TravelOfferService | Frontend Services | Angular service | Requests offers, destination suggestions, and monthly fares |
| AuthService | Frontend Services | Angular service | Manages authentication requests and client session state |
| FavoriteService | Frontend Services | Angular service | Calls account favorite endpoints |
| PriceAlertService | Frontend Services | Angular service | Calls price alert endpoints |
| TravelOfferController | Backend Controllers | REST controller | Exposes travel search, autocomplete, and monthly price routes |
| AuthController | Backend Controllers | REST controller | Exposes account registration, login, and current-user routes |
| FavoriteOfferController | Backend Controllers | REST controller | Exposes authenticated favorite operations |
| PriceAlertController | Backend Controllers | REST controller | Exposes authenticated price alert operations |
| TravelOfferService | Backend Services | Business service | Searches external travel providers and maps offers |
| AuthService | Backend Services | Business service | Creates accounts and authenticates credentials |
| FavoriteOfferService | Backend Services | Business service | Applies account ownership and favorite persistence rules |
| PriceAlertService | Backend Services | Business service | Manages alert state and scheduled fare checks |
| UserAccountRepository | Data Access | Spring Data repository | Loads and persists account records |
| FavoriteOfferRepository | Data Access | Spring Data repository | Loads and persists saved offers |
| PriceAlertRepository | Data Access | Spring Data repository | Loads and persists alert records |
| JwtAuthenticationFilter | Cross Cutting | Security filter | Validates bearer tokens and establishes request identity |
| ServiceTimingAspect | Cross Cutting | AOP aspect | Measures service execution time without logging arguments |
