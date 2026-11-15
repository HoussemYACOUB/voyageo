import { CommonModule, registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, map, of, Subscription, switchMap } from 'rxjs';
import { FavoriteToggle } from './favorite-toggle/favorite-toggle';
import { MonthlyDateCalendar } from './monthly-date-calendar/monthly-date-calendar';
import { PriceComparisonChart, PriceComparisonItem } from './price-comparison-chart/price-comparison-chart';
import { PriceAlertPanel } from './price-alert-panel/price-alert-panel';
import { AuthService } from './services/auth.service';
import { FavoriteService } from './services/favorite.service';
import { CitySuggestion, FlightSearchRoute, HotelSearchCriteria, OfferCategory, OfferSort, TravelOffer, TravelOfferService } from './services/travel-offer.service';

type CategoryFilter = 'ALL' | OfferCategory;
type TripType = 'ROUND_TRIP' | 'ONE_WAY';

interface PartnerSite {
  id: string;
  name: string;
  url: string;
  categories: OfferCategory[];
  badge: string;
  color: string;
}

interface TravelInspiration {
  destination: string;
  category: 'FLIGHT' | 'HOTEL';
  region: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
}

interface RecentSearch {
  destination: string;
  origin: string;
  originIata: string;
  destinationIata: string;
  departureDate: string;
  returnDate: string;
  travelers: number;
  tripType: TripType;
  category: CategoryFilter;
}

interface TripChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

interface TripPlan {
  name: string;
  notes: string;
  offers: TravelOffer[];
  checklist: TripChecklistItem[];
}

interface TripBudgetTotal {
  currency: string;
  amount: number;
}

registerLocaleData(localeFr, 'fr-FR');

const FAVORITES_STORAGE_KEY = 'voyageo.favorites';
const RECENT_SEARCHES_STORAGE_KEY = 'voyageo.recent-searches';
const TRIP_PLAN_STORAGE_KEY = 'voyageo.trip-plan.v1';
const MAX_RECENT_SEARCHES = 6;
const MAX_COMPARISON_OFFERS = 3;
const MAX_TRIP_PLAN_OFFERS = 100;
const MAX_TRIP_CHECKLIST_ITEMS = 50;
const DEFAULT_TRIP_NAME = 'Mon prochain voyage';
const DEFAULT_TRIP_CHECKLIST: TripChecklistItem[] = [
  { id: 'identity-documents', label: 'Vérifier mes papiers d’identité', done: false },
  { id: 'transport-tickets', label: 'Confirmer mes billets de transport', done: false },
  { id: 'accommodation', label: 'Confirmer mon hébergement', done: false },
  { id: 'travel-insurance', label: 'Vérifier mon assurance voyage', done: false },
  { id: 'charger', label: 'Préparer chargeur et adaptateur', done: false }
];
const FALLBACK_CITIES: CitySuggestion[] = [
  { text: 'Paris, France', placeId: 'PAR', iataCode: 'PAR', type: 'city', provider: 'fallback' },
  { text: 'Lyon, France', placeId: 'LYS', iataCode: 'LYS', type: 'city', provider: 'fallback' },
  { text: 'Marseille, France', placeId: 'MRS', iataCode: 'MRS', type: 'city', provider: 'fallback' },
  { text: 'Nice, France', placeId: 'NCE', iataCode: 'NCE', type: 'city', provider: 'fallback' },
  { text: 'Lisbonne, Portugal', placeId: 'LIS', iataCode: 'LIS', type: 'city', provider: 'fallback' },
  { text: 'Rome, Italie', placeId: 'ROM', iataCode: 'ROM', type: 'city', provider: 'fallback' },
  { text: 'Londres, Royaume-Uni', placeId: 'LON', iataCode: 'LON', type: 'city', provider: 'fallback' },
  { text: 'New York, États-Unis', placeId: 'NYC', iataCode: 'NYC', type: 'city', provider: 'fallback' }
];

function normalizeCityQuery(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr-FR');
}

function isCategoryFilter(value: unknown): value is CategoryFilter {
  return value === 'ALL' || value === 'HOTEL' || value === 'FLIGHT'
    || value === 'TRAIN' || value === 'CAR' || value === 'CARPOOL';
}

function isRecentSearch(value: unknown): value is RecentSearch {
  if (typeof value !== 'object' || value === null) return false;
  const search = value as Record<string, unknown>;
  const destination = search['destination'];
  const origin = search['origin'];
  const originIata = search['originIata'];
  const destinationIata = search['destinationIata'];
  const departureDate = search['departureDate'];
  const returnDate = search['returnDate'];
  const travelers = search['travelers'];
  const tripType = search['tripType'];
  const category = search['category'];
  return typeof destination === 'string'
    && typeof origin === 'string'
    && typeof originIata === 'string'
    && typeof destinationIata === 'string'
    && typeof departureDate === 'string'
    && typeof returnDate === 'string'
    && typeof travelers === 'number'
    && Number.isInteger(travelers)
    && travelers >= 1
    && travelers <= 9
    && (tripType === 'ROUND_TRIP' || tripType === 'ONE_WAY')
    && isCategoryFilter(category);
}

function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isTravelOffer(value: unknown): value is TravelOffer {
  if (typeof value !== 'object' || value === null) return false;
  const offer = value as Record<string, unknown>;
  return typeof offer['id'] === 'string'
    && isCategoryFilter(offer['category'])
    && offer['category'] !== 'ALL'
    && typeof offer['title'] === 'string'
    && typeof offer['destination'] === 'string'
    && typeof offer['provider'] === 'string'
    && typeof offer['price'] === 'number'
    && Number.isFinite(offer['price'])
    && offer['price'] >= 0
    && typeof offer['currency'] === 'string'
    && /^[A-Z]{3}$/.test(offer['currency'])
    && typeof offer['details'] === 'string'
    && typeof offer['rating'] === 'number'
    && Number.isFinite(offer['rating'])
    && typeof offer['demo'] === 'boolean'
    && (offer['bookingUrl'] === undefined || offer['bookingUrl'] === null || typeof offer['bookingUrl'] === 'string')
    && (offer['departureDate'] === undefined || offer['departureDate'] === null || typeof offer['departureDate'] === 'string');
}

function isTripChecklistItem(value: unknown): value is TripChecklistItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item['id'] === 'string'
    && item['id'].length > 0
    && typeof item['label'] === 'string'
    && item['label'].trim().length > 0
    && item['label'].length <= 120
    && typeof item['done'] === 'boolean';
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, PriceComparisonChart, FavoriteToggle, MonthlyDateCalendar, PriceAlertPanel],
  templateUrl: './app.html',
  styleUrls: ['./app.scss', './auth.scss', './trip-plan.scss']
})
export class App implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly offerService = inject(TravelOfferService);
  private readonly authService = inject(AuthService);
  private readonly favoriteService = inject(FavoriteService);
  private activeSearch?: Subscription;

  protected readonly destination = signal('');
  protected readonly origin = signal('');
  protected readonly originIata = signal('');
  protected readonly destinationIata = signal('');
  protected readonly departureDate = signal('');
  protected readonly returnDate = signal('');
  protected readonly minimumDate = (() => {
    const date = new Date();
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return localDate.toISOString().slice(0, 10);
  })();
  protected readonly travelers = signal(2);
  protected readonly tripType = signal<TripType>('ROUND_TRIP');
  protected readonly activeCategory = signal<CategoryFilter>('ALL');
  protected readonly sortBy = signal<OfferSort>('price');
  protected readonly budgetCeiling = signal<number | null>(null);
  protected readonly budgetCurrency = signal('EUR');
  protected readonly offers = signal<TravelOffer[]>([]);
  protected readonly comparisonSelection = signal<TravelOffer[]>([]);
  protected readonly comparisonOpen = signal(false);
  protected readonly shareStatus = signal('');
  protected readonly tripPlanOpen = signal(false);
  protected readonly tripPlan = signal<TripPlan>({
    name: DEFAULT_TRIP_NAME,
    notes: '',
    offers: [],
    checklist: DEFAULT_TRIP_CHECKLIST.map((item) => ({ ...item }))
  });
  protected readonly tripChecklistDraft = signal('');
  protected readonly tripPlanMessage = signal('');
  protected readonly tripPlanStorageError = signal('');
  protected readonly tripChecklistProgress = computed(() => {
    const checklist = this.tripPlan().checklist;
    return { done: checklist.filter((item) => item.done).length, total: checklist.length };
  });
  protected readonly tripBudgetTotals = computed<TripBudgetTotal[]>(() => {
    const totals = new Map<string, number>();
    for (const offer of this.tripPlan().offers) {
      totals.set(offer.currency, (totals.get(offer.currency) ?? 0) + offer.price);
    }
    return [...totals.entries()]
      .map(([currency, amount]) => ({ currency, amount }))
      .sort((left, right) => left.currency.localeCompare(right.currency));
  });
  protected readonly recentSearches = signal<RecentSearch[]>([]);
  protected readonly accountFavoriteOffers = signal<TravelOffer[]>([]);
  protected readonly favorites = signal<Set<string>>(new Set());
  protected readonly favoritesOnly = signal(false);
  protected readonly currentFlightRoute = computed<FlightSearchRoute | null>(() => {
    if (!this.originIata() || !this.destinationIata() || !this.departureDate()) return null;
    return {
      originIata: this.originIata(),
      destinationIata: this.destinationIata(),
      departureDate: this.departureDate(),
      returnDate: this.tripType() === 'ROUND_TRIP' ? this.returnDate() || undefined : undefined
    };
  });
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly destinationSuggestions = signal<string[]>([]);
  protected readonly originAutocompleteSuggestions = signal<CitySuggestion[]>([]);
  protected readonly destinationAutocompleteSuggestions = signal<CitySuggestion[]>([]);
  protected readonly originAutocompleteComplete = signal(false);
  protected readonly destinationAutocompleteComplete = signal(false);
  protected readonly categories: { id: CategoryFilter; label: string; icon: string }[] = [
    { id: 'ALL', label: 'Tout comparer', icon: '✦' },
    { id: 'HOTEL', label: 'Hébergements', icon: '⌂' },
    { id: 'FLIGHT', label: 'Vols', icon: '✈' },
    { id: 'TRAIN', label: 'Trains', icon: '▤' },
    { id: 'CAR', label: 'Voitures', icon: '◈' },
    { id: 'CARPOOL', label: 'Covoiturage', icon: '🚙' }
  ];
  protected readonly inspirationCategory = signal<'FLIGHT' | 'HOTEL'>('FLIGHT');
  protected readonly travelInspirations: TravelInspiration[] = [
    {
      destination: 'Rome',
      category: 'FLIGHT',
      region: 'Italie',
      title: 'Un week-end à Rome',
      description: 'Ruelles historiques et longues soirées en terrasse.',
      imageUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=900&h=620&q=82',
      imageAlt: 'Le Colisée et l’architecture historique de Rome'
    },
    {
      destination: 'Lisbonne',
      category: 'FLIGHT',
      region: 'Portugal',
      title: 'Cap sur Lisbonne',
      description: 'Tramways, azulejos et lumière sur le Tage.',
      imageUrl: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=900&h=620&q=82',
      imageAlt: 'Façades et rues pittoresques de Lisbonne'
    },
    {
      destination: 'Paris',
      category: 'HOTEL',
      region: 'France',
      title: 'Une nuit parisienne',
      description: 'Choisissez votre quartier et votre style de séjour.',
      imageUrl: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&h=620&q=82',
      imageAlt: 'Toits de Paris au coucher du soleil'
    },
    {
      destination: 'Nice',
      category: 'HOTEL',
      region: 'France',
      title: 'Séjour au bord de mer',
      description: 'Une escapade ensoleillée sur la Côte d’Azur.',
      imageUrl: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=900&h=620&q=82',
      imageAlt: 'Mer turquoise et littoral méditerranéen près de Nice'
    }
  ];
  protected readonly visibleInspirations = computed(() =>
    this.travelInspirations.filter((inspiration) => inspiration.category === this.inspirationCategory())
  );
  protected readonly sortOptions: { id: OfferSort; label: string }[] = [
    { id: 'price', label: 'Prix le plus bas' },
    { id: 'rating', label: 'Mieux notées' }
  ];
  protected readonly partnerSites: PartnerSite[] = [
    {
      id: 'booking',
      name: 'Booking.com',
      url: 'https://www.booking.com',
      categories: ['HOTEL'],
      badge: '🏨',
      color: '#003580'
    },
    {
      id: 'google-hotels',
      name: 'Google Hotels',
      url: 'https://www.google.com/travel/hotels',
      categories: ['HOTEL'],
      badge: '🔎',
      color: '#4285f4'
    },
    {
      id: 'flights',
      name: 'Google Flights',
      url: 'https://www.google.com/travel/flights',
      categories: ['FLIGHT'],
      badge: '🛫',
      color: '#c1175a'
    },
    {
      id: 'aviasales',
      name: 'Aviasales',
      url: 'https://www.aviasales.com',
      categories: ['FLIGHT'],
      badge: '✈',
      color: '#e84b39'
    },
    {
      id: 'sncf',
      name: 'SNCF Connect',
      url: 'https://www.sncf-connect.com',
      categories: ['TRAIN'],
      badge: '🚆',
      color: '#0b1641'
    },
    {
      id: 'blablacar',
      name: 'BlaBlaCar',
      url: 'https://www.blablacar.fr',
      categories: ['CARPOOL'],
      badge: '🚙',
      color: '#00a88f'
    }
  ];

  // Cree en contexte d'injection : necessaire pour toObservable()
  private readonly originAutocompleteChanges$ = toObservable(this.origin);
  private readonly destinationAutocompleteChanges$ = toObservable(this.destination);

  protected readonly budgetCandidates = computed(() => {
    const category = this.activeCategory();
    const offers = this.favoritesOnly() && this.isAuthenticated()
      ? this.accountFavoriteOffers()
      : this.offers();
    return offers
      .filter((offer) => category === 'ALL' || offer.category === category)
      .filter((offer) => !this.favoritesOnly() || this.favorites().has(offer.id));
  });
  protected readonly availableBudgetCurrencies = computed(() =>
    [...new Set(this.budgetCandidates().map((offer) => offer.currency))].sort()
  );
  protected readonly activeBudgetCurrency = computed(() => {
    const currencies = this.availableBudgetCurrencies();
    return currencies.includes(this.budgetCurrency()) ? this.budgetCurrency() : currencies[0] ?? 'EUR';
  });
  protected readonly budgetRangeMaximum = computed(() => {
    const maximumPrice = this.budgetCandidates()
      .filter((offer) => offer.currency === this.activeBudgetCurrency())
      .reduce((maximum, offer) => Math.max(maximum, offer.price), 0);
    return Math.max(10, Math.ceil(maximumPrice / 10) * 10);
  });
  protected readonly visibleOffers = computed(() => {
    const budget = this.budgetCeiling();
    const currency = this.activeBudgetCurrency();
    const sort = this.sortBy();
    return this.budgetCandidates()
      .filter((offer) => budget === null || (offer.currency === currency && offer.price <= budget))
      .slice()
      .sort((left, right) => (sort === 'rating' ? right.rating - left.rating : left.price - right.price));
  });

  protected readonly lowestOffer = computed(() =>
    this.visibleOffers().reduce<TravelOffer | null>(
      (lowest, offer) => !lowest || offer.price < lowest.price ? offer : lowest,
      null
    )
  );
  protected readonly priceComparison = computed<PriceComparisonItem[]>(() => {
    if (this.activeCategory() === 'ALL') return [];

    const offers = this.visibleOffers().filter((offer) => offer.price > 0);
    const currency = offers[0]?.currency;
    const comparableOffers = offers
      .filter((offer) => offer.currency === currency)
      .slice()
      .sort((left, right) => left.price - right.price)
      .slice(0, 5);

    if (comparableOffers.length < 2) return [];

    const maximumPrice = comparableOffers.at(-1)?.price ?? 0;
    return comparableOffers.map((offer) => ({
      id: offer.id,
      title: offer.title,
      price: offer.price,
      currency: offer.currency,
      width: maximumPrice > 0 ? Math.max(8, Math.round((offer.price / maximumPrice) * 100)) : 0
    }));
  });
  protected readonly savedCount = computed(() => this.favorites().size);
  protected readonly visiblePartners = computed(() => {
    const activeCategory = this.activeCategory();
    return this.partnerSites.filter((partner) =>
      activeCategory === 'ALL' ? true : partner.categories.includes(activeCategory)
    );
  });
  protected readonly authOpen = signal(false);
  protected readonly authMode = signal<'login' | 'register'>('login');
  protected readonly authEmail = signal('');
  protected readonly authPassword = signal('');
  protected readonly authDisplayName = signal('');
  protected readonly authLoading = signal(false);
  protected readonly authError = signal('');
  protected readonly profileDisplayName = signal('');
  protected readonly profilePassword = signal('');
  protected readonly newPassword = signal('');
  protected readonly profileLoading = signal(false);
  protected readonly profileError = signal('');
  protected readonly profileSuccess = signal('');
  protected readonly user = this.authService.currentUser;
  protected readonly isAuthenticated = this.authService.isAuthenticated;
  protected readonly userInitial = computed(() => this.user()?.displayName?.charAt(0).toUpperCase() ?? '👤');
  protected readonly hasDemoOffers = computed(() => this.visibleOffers().some((offer) => offer.demo));

  ngOnInit(): void {
    this.restoreFavorites();
    this.restoreRecentSearches();
    this.restoreTripPlan();
    this.restoreSharedSearch();
    this.authService.bootstrapSession().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (user) => {
        if (user) this.loadAccountFavorites();
      },
      error: () => undefined
    });
    this.offerService.destinations().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (destinations) => this.destinationSuggestions.set(destinations),
      error: () => this.destinationSuggestions.set([])
    });
    this.originAutocompleteChanges$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((query) => this.autocompleteCities(query)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((suggestions) => {
        this.originAutocompleteSuggestions.set(suggestions);
        this.originAutocompleteComplete.set(this.origin().trim().length >= 2);
      });
    this.destinationAutocompleteChanges$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((query) => this.autocompleteCities(query)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((suggestions) => {
        this.destinationAutocompleteSuggestions.set(suggestions);
        this.destinationAutocompleteComplete.set(this.destination().trim().length >= 2);
      });
    this.searchOffers();
  }

  private restoreSharedSearch(): void {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (!['destination', 'origin', 'departure', 'return', 'category', 'tripType', 'travelers']
      .some((key) => params.has(key))) return;

    this.destination.set((params.get('destination') ?? '').trim().slice(0, 120));
    this.origin.set((params.get('origin') ?? '').trim().slice(0, 120));
    const originIata = params.get('originIata') ?? '';
    const destinationIata = params.get('destinationIata') ?? '';
    this.originIata.set(/^[A-Z0-9]{3}$/i.test(originIata) ? originIata.toUpperCase() : '');
    this.destinationIata.set(/^[A-Z0-9]{3}$/i.test(destinationIata) ? destinationIata.toUpperCase() : '');

    const departureDate = params.get('departure') ?? '';
    const returnDate = params.get('return') ?? '';
    this.departureDate.set(isValidDateInput(departureDate) ? departureDate : '');
    this.returnDate.set(isValidDateInput(returnDate) ? returnDate : '');

    const travelers = Number(params.get('travelers'));
    if (Number.isInteger(travelers) && travelers >= 1 && travelers <= 9) this.travelers.set(travelers);
    const tripType = params.get('tripType');
    if (tripType === 'ROUND_TRIP' || tripType === 'ONE_WAY') this.tripType.set(tripType);
    const category = params.get('category');
    if (isCategoryFilter(category)) this.activeCategory.set(category);
    if (this.activeCategory() === 'HOTEL') this.tripType.set('ROUND_TRIP');
    if (this.tripType() === 'ONE_WAY') this.returnDate.set('');
  }

  private autocompleteCities(query: string) {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) return of<CitySuggestion[]>([]);
    return this.offerService.autocomplete(trimmedQuery).pipe(
      map((suggestions) => this.relevantSuggestions(suggestions, trimmedQuery)),
      map((suggestions) => suggestions.length ? suggestions : this.localSuggestions(trimmedQuery)),
      catchError((error: unknown) => {
        console.warn('Autocomplétion indisponible, utilisation des suggestions locales.', error);
        return of(this.localSuggestions(trimmedQuery));
      })
    );
  }

  private relevantSuggestions(suggestions: CitySuggestion[], query: string): CitySuggestion[] {
    const normalizedQuery = normalizeCityQuery(query);
    return suggestions
      .map((suggestion, index) => {
        const normalizedText = normalizeCityQuery(suggestion.text);
        const normalizedCode = normalizeCityQuery(suggestion.iataCode ?? '');
        const textScore = normalizedText.startsWith(normalizedQuery) ? 0
          : normalizedText.includes(normalizedQuery) ? 1
            : Number.POSITIVE_INFINITY;
        const codeScore = normalizedCode.startsWith(normalizedQuery) ? 2 : Number.POSITIVE_INFINITY;
        return { suggestion, index, score: Math.min(textScore, codeScore) };
      })
      .filter(({ score }) => Number.isFinite(score))
      .sort((left, right) => left.score - right.score || left.index - right.index)
      .slice(0, 6)
      .map(({ suggestion }) => suggestion);
  }

  private localSuggestions(query: string): CitySuggestion[] {
    const normalizedQuery = normalizeCityQuery(query);
    return FALLBACK_CITIES
      .filter((suggestion) =>
        normalizeCityQuery(suggestion.text).includes(normalizedQuery)
        || normalizeCityQuery(suggestion.iataCode ?? '').startsWith(normalizedQuery)
      )
      .slice(0, 5);
  }

  private restoreFavorites(): void {
    try {
      const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (!stored) return;
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) {
        this.favorites.set(new Set(parsed));
      } else {
        console.warn('Les favoris locaux de Voyageo sont illisibles et ont été ignorés.');
      }
    } catch (error) {
      console.warn('Impossible de restaurer les favoris locaux de Voyageo.', error);
    }
  }

  private persistFavorites(favorites: Set<string>): void {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...favorites]));
    } catch (error) {
      console.warn('Impossible d’enregistrer les favoris locaux de Voyageo.', error);
    }
  }

  private restoreRecentSearches(): void {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
      if (!stored) return;
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        console.warn('Les recherches récentes de Voyageo sont illisibles et ont été ignorées.');
        return;
      }
      const validSearches = parsed.filter(isRecentSearch).slice(0, MAX_RECENT_SEARCHES);
      if (validSearches.length !== parsed.length) {
        console.warn('Certaines recherches récentes de Voyageo sont illisibles et ont été ignorées.');
      }
      this.recentSearches.set(validSearches);
    } catch (error) {
      console.warn('Impossible de restaurer les recherches récentes de Voyageo.', error);
    }
  }

  private restoreTripPlan(): void {
    try {
      const stored = localStorage.getItem(TRIP_PLAN_STORAGE_KEY);
      if (!stored) return;
      const parsed: unknown = JSON.parse(stored);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        console.warn('Le carnet de voyage local de Voyageo est illisible et a été ignoré.');
        this.tripPlanStorageError.set('Le carnet enregistré est illisible ; une prochaine modification peut remplacer ces données.');
        return;
      }

      const value = parsed as Record<string, unknown>;
      if (typeof value['name'] !== 'string'
        || typeof value['notes'] !== 'string'
        || !Array.isArray(value['offers'])
        || !Array.isArray(value['checklist'])) {
        console.warn('Le format du carnet de voyage local de Voyageo est invalide et a été ignoré.');
        this.tripPlanStorageError.set('Le format du carnet enregistré est invalide ; une prochaine modification peut remplacer ces données.');
        return;
      }
      const storedOffers = value['offers'];
      const storedChecklist = value['checklist'];
      const offers = storedOffers.filter(isTravelOffer).slice(0, MAX_TRIP_PLAN_OFFERS);
      const checklist = storedChecklist.filter(isTripChecklistItem).slice(0, MAX_TRIP_CHECKLIST_ITEMS);
      if (offers.length !== storedOffers.length || checklist.length !== storedChecklist.length) {
        console.warn('Certaines données du carnet de voyage de Voyageo sont invalides et ont été ignorées.');
        this.tripPlanStorageError.set('Certaines entrées illisibles du carnet ont été ignorées.');
      }
      this.tripPlan.set({
        name: typeof value['name'] === 'string' && value['name'].trim()
          ? value['name'].trim().slice(0, 80)
          : DEFAULT_TRIP_NAME,
        notes: typeof value['notes'] === 'string' ? value['notes'].slice(0, 2000) : '',
        offers,
        checklist: storedChecklist.length > 0 && checklist.length === 0
          ? DEFAULT_TRIP_CHECKLIST.map((item) => ({ ...item }))
          : checklist
      });
    } catch (error) {
      console.warn('Impossible de restaurer le carnet de voyage local de Voyageo.', error);
      this.tripPlanStorageError.set('Impossible de lire le carnet de voyage enregistré sur cet appareil.');
    }
  }

  private persistTripPlan(plan: TripPlan): void {
    try {
      localStorage.setItem(TRIP_PLAN_STORAGE_KEY, JSON.stringify(plan));
      this.tripPlanStorageError.set('');
    } catch (error) {
      console.error('Impossible d’enregistrer le carnet de voyage de Voyageo.', error);
      this.tripPlanStorageError.set('Enregistrement local impossible. Vérifiez l’espace disponible dans votre navigateur.');
    }
  }

  private updateTripPlan(update: (plan: TripPlan) => TripPlan): void {
    const next = update(this.tripPlan());
    this.tripPlan.set(next);
    this.persistTripPlan(next);
  }

  protected openTripPlan(): void {
    this.comparisonOpen.set(false);
    this.tripPlanMessage.set('');
    this.tripPlanOpen.set(true);
  }

  protected closeTripPlan(): void {
    this.tripPlanOpen.set(false);
  }

  protected isInTripPlan(id: string): boolean {
    return this.tripPlan().offers.some((offer) => offer.id === id);
  }

  protected toggleTripOffer(offer: TravelOffer): void {
    this.tripPlanMessage.set('');
    this.updateTripPlan((plan) => {
      const exists = plan.offers.some((item) => item.id === offer.id);
      if (exists) return { ...plan, offers: plan.offers.filter((item) => item.id !== offer.id) };
      if (plan.offers.length >= MAX_TRIP_PLAN_OFFERS) {
        this.tripPlanMessage.set('Votre carnet contient déjà le maximum de 100 offres.');
        return plan;
      }
      return { ...plan, offers: [...plan.offers, offer] };
    });
  }

  protected updateTripName(name: string): void {
    this.updateTripPlan((plan) => ({ ...plan, name: name.slice(0, 80) }));
  }

  protected updateTripNotes(notes: string): void {
    this.updateTripPlan((plan) => ({ ...plan, notes: notes.slice(0, 2000) }));
  }

  protected toggleTripChecklistItem(id: string): void {
    this.updateTripPlan((plan) => ({
      ...plan,
      checklist: plan.checklist.map((item) => item.id === id ? { ...item, done: !item.done } : item)
    }));
  }

  protected removeTripChecklistItem(id: string): void {
    this.updateTripPlan((plan) => ({
      ...plan,
      checklist: plan.checklist.filter((item) => item.id !== id)
    }));
  }

  protected addTripChecklistItem(): void {
    const label = this.tripChecklistDraft().trim();
    if (!label) {
      this.tripPlanMessage.set('Saisissez une tâche à ajouter à votre checklist.');
      return;
    }
    if (label.length > 120) {
      this.tripPlanMessage.set('Une tâche ne peut pas dépasser 120 caractères.');
      return;
    }
    if (this.tripPlan().checklist.length >= MAX_TRIP_CHECKLIST_ITEMS) {
      this.tripPlanMessage.set('Votre checklist contient déjà le maximum de 50 tâches.');
      return;
    }
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `trip-task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.updateTripPlan((plan) => ({
      ...plan,
      checklist: [...plan.checklist, { id, label, done: false }]
    }));
    this.tripChecklistDraft.set('');
    this.tripPlanMessage.set('Tâche ajoutée à votre checklist.');
  }

  protected exportTripPlan(): void {
    let downloadUrl: string | null = null;
    let link: HTMLAnchorElement | null = null;
    try {
      const content = JSON.stringify(this.tripPlan(), null, 2);
      downloadUrl = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
      link = document.createElement('a');
      const safeName = this.tripPlan().name
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'mon-voyage';
      link.href = downloadUrl;
      link.download = `${safeName}.json`;
      document.body.append(link);
      link.click();
      this.tripPlanMessage.set('Votre carnet a été exporté au format JSON.');
    } catch (error) {
      console.error('Impossible d’exporter le carnet de voyage de Voyageo.', error);
      this.tripPlanMessage.set('Export impossible dans ce navigateur. Réessayez ou vérifiez ses permissions.');
    } finally {
      link?.remove();
      if (downloadUrl) {
        const urlToRevoke = downloadUrl;
        window.setTimeout(() => URL.revokeObjectURL(urlToRevoke), 0);
      }
    }
  }

  private recordRecentSearch(): void {
    const search: RecentSearch = {
      destination: this.destination().trim(),
      origin: this.origin().trim(),
      originIata: this.originIata(),
      destinationIata: this.destinationIata(),
      departureDate: this.departureDate(),
      returnDate: this.returnDate(),
      travelers: this.travelers(),
      tripType: this.tripType(),
      category: this.activeCategory()
    };
    if (!search.destination && !search.origin && !search.departureDate && !search.returnDate) return;

    const key = JSON.stringify(search);
    const updatedSearches = [
      search,
      ...this.recentSearches().filter((recentSearch) => JSON.stringify(recentSearch) !== key)
    ].slice(0, MAX_RECENT_SEARCHES);
    this.recentSearches.set(updatedSearches);
    try {
      localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(updatedSearches));
    } catch (error) {
      console.warn('Impossible d’enregistrer les recherches récentes de Voyageo.', error);
    }
  }

  protected repeatRecentSearch(search: RecentSearch): void {
    this.destination.set(search.destination);
    this.origin.set(search.origin);
    this.originIata.set(search.originIata);
    this.destinationIata.set(search.destinationIata);
    this.departureDate.set(search.departureDate);
    this.returnDate.set(search.returnDate);
    this.travelers.set(search.travelers);
    this.tripType.set(search.tripType);
    this.activeCategory.set(search.category);
    this.favoritesOnly.set(false);
    this.originAutocompleteSuggestions.set([]);
    this.destinationAutocompleteSuggestions.set([]);
    this.originAutocompleteComplete.set(false);
    this.destinationAutocompleteComplete.set(false);
    this.searchOffers();
  }

  protected clearRecentSearches(): void {
    this.recentSearches.set([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
    } catch (error) {
      console.warn('Impossible d’effacer les recherches récentes de Voyageo.', error);
    }
  }

  protected recentSearchLabel(search: RecentSearch): string {
    const destination = search.destination || 'N’importe où';
    return search.origin ? `${search.origin} → ${destination}` : destination;
  }

  protected recentSearchDetails(search: RecentSearch): string {
    const dates = [search.departureDate, search.returnDate].filter(Boolean).join(' → ');
    const details = [this.categoryLabel(search.category), dates, `${search.travelers} voyageur${search.travelers > 1 ? 's' : ''}`];
    return details.filter(Boolean).join(' · ');
  }

  protected selectOriginSuggestion(suggestion: CitySuggestion): void {
    this.origin.set(suggestion.text);
    this.originIata.set(suggestion.iataCode ?? '');
    this.originAutocompleteSuggestions.set([]);
    this.originAutocompleteComplete.set(false);
  }

  protected selectDestinationSuggestion(suggestion: CitySuggestion): void {
    this.destination.set(suggestion.text);
    this.destinationIata.set(suggestion.iataCode ?? '');
    this.destinationAutocompleteSuggestions.set([]);
    this.destinationAutocompleteComplete.set(false);
  }

  protected updateOrigin(value: string): void {
    if (value !== this.origin()) this.originIata.set('');
    this.origin.set(value);
    if (value.trim().length < 2) {
      this.originAutocompleteSuggestions.set([]);
      this.originAutocompleteComplete.set(false);
    }
  }

  protected updateDestination(value: string): void {
    if (value !== this.destination()) this.destinationIata.set('');
    this.destination.set(value);
    if (value.trim().length < 2) {
      this.destinationAutocompleteSuggestions.set([]);
      this.destinationAutocompleteComplete.set(false);
    }
  }

  protected searchOffers(): void {
    const dateError = this.departureDate() && this.departureDate() < this.minimumDate
      ? 'La date de départ doit être aujourd’hui ou dans le futur.'
      : this.returnDate() && this.returnDate() < this.minimumDate
        ? 'La date de retour doit être aujourd’hui ou dans le futur.'
        : this.departureDate() && this.returnDate() && this.returnDate() < this.departureDate()
          ? 'La date de retour doit être postérieure à la date de départ.'
          : '';
    if (dateError) {
      this.activeSearch?.unsubscribe();
      this.loading.set(false);
      this.errorMessage.set(dateError);
      return;
    }

    this.recordRecentSearch();
    this.loading.set(true);
    this.errorMessage.set('');
    const category = this.activeCategory();
    const route: FlightSearchRoute | undefined = this.activeCategory() !== 'HOTEL'
      && this.originIata() && this.destinationIata() && this.departureDate()
      ? {
          originIata: this.originIata(),
          destinationIata: this.destinationIata(),
          departureDate: this.departureDate(),
          returnDate: this.tripType() === 'ROUND_TRIP' ? this.returnDate() || undefined : undefined
        }
      : undefined;
    const hotel: HotelSearchCriteria | undefined = category === 'HOTEL' && this.departureDate() && this.returnDate()
      ? { checkIn: this.departureDate(), checkOut: this.returnDate(), adults: this.travelers() }
      : undefined;
    const query = this.destination().trim();
    const selectedCategory = category === 'ALL' ? undefined : category;
    const request = hotel
      ? this.offerService.search(query, selectedCategory, this.sortBy(), route, hotel)
      : route
        ? this.offerService.search(query, selectedCategory, this.sortBy(), route)
        : this.offerService.search(query, selectedCategory, this.sortBy());
    this.activeSearch?.unsubscribe();
    this.activeSearch = request
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (offers) => {
          this.offers.set(offers);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          const providerMessage = error.error?.detail ?? error.error?.message;
          if (category === 'HOTEL' && error.status === 503) {
            this.errorMessage.set(typeof providerMessage === 'string'
              ? providerMessage
              : 'Accès Booking refusé : vérifiez la clé RAPIDAPI_KEY et le quota du fournisseur Booking COM dans RapidAPI.');
          } else {
            this.errorMessage.set('Impossible de charger les offres. Vérifiez que le serveur est démarré.');
          }
          this.loading.set(false);
        }
      });
  }

  protected selectCategory(category: CategoryFilter): void {
    this.activeCategory.set(category);
    this.favoritesOnly.set(false);
    if (category === 'HOTEL') this.tripType.set('ROUND_TRIP');
    this.searchOffers();
  }

  protected selectTripType(tripType: TripType): void {
    this.tripType.set(tripType);
    if (tripType === 'ONE_WAY') this.returnDate.set('');
  }

  protected selectSort(sort: OfferSort): void {
    this.sortBy.set(sort);
  }

  protected updateBudgetCeiling(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value) && value >= 0) this.budgetCeiling.set(value);
  }

  protected selectBudgetCurrency(currency: string): void {
    this.budgetCurrency.set(currency);
  }

  protected clearBudgetFilter(): void {
    this.budgetCeiling.set(null);
  }

  protected selectInspirationCategory(category: 'FLIGHT' | 'HOTEL'): void {
    this.inspirationCategory.set(category);
  }

  protected createSearchShareUrl(): string {
    const url = new URL(window.location.href);
    const params = new URLSearchParams();
    const values: Record<string, string> = {
      destination: this.destination().trim(),
      origin: this.origin().trim(),
      originIata: this.originIata(),
      destinationIata: this.destinationIata(),
      departure: this.departureDate(),
      return: this.tripType() === 'ROUND_TRIP' ? this.returnDate() : '',
      travelers: String(this.travelers()),
      tripType: this.tripType(),
      category: this.activeCategory()
    };
    for (const [key, value] of Object.entries(values)) {
      if (value) params.set(key, value);
    }
    url.search = params.toString();
    url.hash = 'recherche';
    return url.toString();
  }

  protected async shareSearch(): Promise<void> {
    this.shareStatus.set('');
    try {
      const url = this.createSearchShareUrl();
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Ma recherche Voyageo', url });
        this.shareStatus.set('Recherche partagée.');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        this.shareStatus.set('Lien de recherche copié.');
      } else {
        throw new Error('Aucune option de partage ou de copie n’est disponible dans ce navigateur.');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Impossible de partager la recherche Voyageo.', error);
      this.shareStatus.set('Partage impossible. Vérifiez les permissions du navigateur.');
    }
  }

  protected exploreInspiration(inspiration: TravelInspiration): void {
    this.activeCategory.set(inspiration.category);
    this.inspirationCategory.set(inspiration.category);
    this.favoritesOnly.set(false);
    this.destination.set(inspiration.destination);
    this.destinationIata.set('');
    this.destinationAutocompleteSuggestions.set([]);
    this.destinationAutocompleteComplete.set(false);
    this.searchOffers();
  }

  /** Raccourci "faciliteur de tache" : remplit la destination et lance la recherche en un clic. */
  protected quickSearch(destination: string): void {
    this.destinationIata.set('');
    this.destinationAutocompleteSuggestions.set([]);
    this.destinationAutocompleteComplete.set(false);
    this.destination.set(destination);
    this.searchOffers();
  }

  protected toggleFavoritesView(): void {
    this.favoritesOnly.update((current) => !current);
    if (this.favoritesOnly() && this.isAuthenticated()) this.loadAccountFavorites();
  }

  protected toggleFavorite(offer: TravelOffer): void {
    if (this.isAuthenticated()) {
      const isSaved = this.favorites().has(offer.id);
      const request = isSaved ? this.favoriteService.remove(offer.id) : this.favoriteService.save(offer);
      request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.favorites.update((current) => {
            const next = new Set(current);
            if (isSaved) next.delete(offer.id);
            else next.add(offer.id);
            return next;
          });
          this.accountFavoriteOffers.update((current) =>
            isSaved ? current.filter((item) => item.id !== offer.id) : [offer, ...current]
          );
        },
        error: () => this.errorMessage.set('Impossible de mettre à jour vos favoris. Réessayez.')
      });
      return;
    }

    const next = new Set(this.favorites());
    if (next.has(offer.id)) next.delete(offer.id);
    else next.add(offer.id);
    this.favorites.set(next);
    this.persistFavorites(next);
  }

  protected swapRoute(): void {
    const currentOrigin = this.origin();
    const currentOriginIata = this.originIata();
    this.origin.set(this.destination());
    this.originIata.set(this.destinationIata());
    this.destination.set(currentOrigin);
    this.destinationIata.set(currentOriginIata);
    this.originAutocompleteSuggestions.set([]);
    this.destinationAutocompleteSuggestions.set([]);
    this.originAutocompleteComplete.set(false);
    this.destinationAutocompleteComplete.set(false);
  }

  protected isFavorite(id: string): boolean {
    return this.favorites().has(id);
  }

  protected isComparisonSelected(id: string): boolean {
    return this.comparisonSelection().some((offer) => offer.id === id);
  }

  protected toggleComparison(offer: TravelOffer): void {
    const selected = this.comparisonSelection();
    if (selected.some((item) => item.id === offer.id)) {
      this.removeComparedOffer(offer.id);
      return;
    }
    if (selected.length >= MAX_COMPARISON_OFFERS) return;
    this.comparisonSelection.set([...selected, offer]);
  }

  protected openComparison(): void {
    if (this.comparisonSelection().length >= 2) this.comparisonOpen.set(true);
  }

  protected closeComparison(): void {
    this.comparisonOpen.set(false);
  }

  protected removeComparedOffer(id: string): void {
    const remaining = this.comparisonSelection().filter((offer) => offer.id !== id);
    this.comparisonSelection.set(remaining);
    if (remaining.length < 2) this.comparisonOpen.set(false);
  }

  protected clearComparison(): void {
    this.comparisonSelection.set([]);
    this.comparisonOpen.set(false);
  }

  protected selectCalendarDate(date: string): void {
    this.departureDate.set(date);
    if (this.returnDate() && this.returnDate() <= date) this.returnDate.set('');
    this.searchOffers();
  }

  protected categoryLabel(category: CategoryFilter): string {
    return this.categories.find((item) => item.id === category)?.label ?? category;
  }

  protected recentSearchKey(search: RecentSearch): string {
    return JSON.stringify(search);
  }

  private static readonly destinationPhotoIds: Record<string, string> = {
    paris: 'photo-1502602898657-3e91760cbb34',
    lisbonne: 'photo-1555881400-74d7acaacd8b',
    rome: 'photo-1552832230-c0197dd311b5',
    'new york': 'photo-1485871981521-5b1fd3805eee',
    nice: 'photo-1533105079780-92b9be482077',
    lyon: 'photo-1500530855697-b586d89ba3ee'
  };

  private static readonly categoryPhotoIds: Record<OfferCategory, string[]> = {
    HOTEL: ['photo-1566073771259-6a8506099945', 'photo-1445019980597-93fa8acb246c', 'photo-1571003123894-1f0594d2b5d9'],
    FLIGHT: ['photo-1436491865332-7a61a109cc05', 'photo-1569154941061-e231b4725ef1', 'photo-1544620347-c4fd4a3d5957'],
    TRAIN: ['photo-1474487548417-781cb71495f3', 'photo-1517649763962-0c623066013b', 'photo-1568605114967-8130f3a36994'],
    CAR: ['photo-1502877338535-766e1452684a', 'photo-1449965408869-eaa3f722e40d', 'photo-1503376780353-7e6692767b70'],
    CARPOOL: ['photo-1502877338535-766e1452684a', 'photo-1449965408869-eaa3f722e40d', 'photo-1494905998402-395d579af36f']
  };

  protected offerImageUrl(offer: TravelOffer): string {
    const destination = offer.destination
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .trim()
      .toLocaleLowerCase('fr-FR');
    const photoId = App.destinationPhotoIds[destination] ?? App.categoryPhotoIds[offer.category][0];
    return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=900&h=620&q=82`;
  }

  protected onOfferImageError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  protected providerSite(offer: TravelOffer): PartnerSite | null {
    const provider = offer.provider.toLowerCase();

    const byProviderName = this.partnerSites.find((site) =>
      provider.includes(site.name.toLowerCase()) || provider.includes(site.id)
    );
    if (byProviderName) return byProviderName;

    return this.partnerSites.find((site) => site.categories.includes(offer.category)) ?? null;
  }

  protected providerUrl(offer: TravelOffer): string | null {
    return this.providerSite(offer)?.url ?? null;
  }

  protected providerDisplayName(offer: TravelOffer): string {
    return this.providerSite(offer)?.name ?? offer.provider;
  }

  protected providerBadge(offer: TravelOffer): string {
    return this.providerSite(offer)?.badge ?? '🌍';
  }

  protected providerColor(offer: TravelOffer): string {
    return this.providerSite(offer)?.color ?? '#168c7e';
  }

  protected openAuth(mode: 'login' | 'register'): void {
    this.authMode.set(mode);
    this.authOpen.set(true);
    this.authError.set('');
  }

  protected openProfile(): void {
    this.profileDisplayName.set(this.user()?.displayName ?? '');
    this.profilePassword.set('');
    this.newPassword.set('');
    this.profileError.set('');
    this.profileSuccess.set('');
    this.authOpen.set(true);
    this.authError.set('');
  }

  protected closeAuth(): void {
    this.authOpen.set(false);
    this.authLoading.set(false);
    this.authError.set('');
  }

  protected partnerSearchUrl(partner: PartnerSite): string {
    const origin = this.origin().trim();
    const destination = this.destination().trim();
    const departureDate = this.departureDate();

    if (partner.id === 'blablacar' && origin && destination) {
      const params = new URLSearchParams({ fn: origin, tn: destination });
      if (departureDate) params.set('db', departureDate);
      return `https://www.blablacar.fr/search?${params.toString()}`;
    }

    if (partner.id === 'flights' && origin && destination) {
      const flightOrigin = this.originIata() || origin;
      const flightDestination = this.destinationIata() || destination;
      const query = new URLSearchParams({
        q: `Flights from ${flightOrigin} to ${flightDestination}${departureDate ? ` on ${departureDate}` : ''}${this.returnDate() ? ` to ${this.returnDate()}` : ''}`,
        hl: 'fr',
        curr: 'EUR'
      });
      return `${partner.url}?${query.toString()}`;
    }

    if (partner.id === 'google-hotels' && destination) {
      const params = new URLSearchParams({
        q: `Hôtels à ${destination}`,
        hl: 'fr',
        gl: 'fr',
        curr: 'EUR',
        adults: String(this.travelers())
      });
      if (departureDate) params.set('checkin', departureDate);
      if (this.returnDate()) params.set('checkout', this.returnDate());
      return `${partner.url}?${params.toString()}`;
    }

    if (partner.id === 'booking' && destination) {
      const params = new URLSearchParams({
        ss: destination,
        group_adults: String(this.travelers()),
        group_children: '0',
        no_rooms: '1',
        lang: 'fr'
      });
      if (departureDate) params.set('checkin', departureDate);
      if (this.returnDate()) params.set('checkout', this.returnDate());
      return `https://www.booking.com/searchresults.html?${params.toString()}`;
    }

    return partner.url;
  }

  protected offerPartnerSearchUrl(offer: TravelOffer): string | null {
    if (offer.bookingUrl?.startsWith('https://www.aviasales.com/')) return offer.bookingUrl;
    const partner = this.providerSite(offer);
    return partner ? this.partnerSearchUrl(partner) : null;
  }

  protected submitAuth(): void {
    const email = this.authEmail().trim();
    const password = this.authPassword();
    const displayName = this.authDisplayName().trim();

    if (!email || !password || (this.authMode() === 'register' && !displayName)) {
      this.authError.set('Veuillez compléter les champs requis.');
      return;
    }

    this.authLoading.set(true);
    this.authError.set('');

    const request$ = this.authMode() === 'register'
      ? this.authService.register({ email, password, displayName })
      : this.authService.login({ email, password });

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.authLoading.set(false);
        this.authPassword.set('');
        this.authOpen.set(false);
        this.loadAccountFavorites();
      },
      error: (error: HttpErrorResponse) => {
        this.authLoading.set(false);
        const message = error.error?.message;
        this.authError.set(typeof message === 'string' ? message : 'Connexion impossible. Vérifiez vos identifiants ou réessayez.');
      }
    });
  }

  protected updateAccountProfile(): void {
    const displayName = this.profileDisplayName().trim();
    if (displayName.length < 2 || displayName.length > 120) {
      this.profileError.set('Le nom affiché doit contenir entre 2 et 120 caractères.');
      return;
    }

    this.profileLoading.set(true);
    this.profileError.set('');
    this.profileSuccess.set('');
    this.authService.updateProfile(displayName).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.profileLoading.set(false);
        this.profileSuccess.set('Votre profil a été mis à jour.');
      },
      error: (error: HttpErrorResponse) => {
        this.profileLoading.set(false);
        const message = error.error?.message;
        this.profileError.set(typeof message === 'string' ? message : 'Impossible de mettre à jour votre profil.');
      }
    });
  }

  protected changeAccountPassword(): void {
    const currentPassword = this.profilePassword();
    const newPassword = this.newPassword();
    if (!currentPassword || newPassword.length < 12 || newPassword.length > 72) {
      this.profileError.set('Saisissez votre mot de passe actuel et un nouveau mot de passe de 12 à 72 caractères.');
      return;
    }

    this.profileLoading.set(true);
    this.profileError.set('');
    this.profileSuccess.set('');
    this.authService.changePassword({ currentPassword, newPassword }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.profileLoading.set(false);
        this.profilePassword.set('');
        this.newPassword.set('');
        this.profileSuccess.set('Votre mot de passe a été modifié.');
      },
      error: (error: HttpErrorResponse) => {
        this.profileLoading.set(false);
        const message = error.error?.message;
        this.profileError.set(typeof message === 'string' ? message : 'Impossible de modifier votre mot de passe.');
      }
    });
  }

  protected logout(): void {
    this.authService.logout();
    this.accountFavoriteOffers.set([]);
    this.favorites.set(new Set());
    this.restoreFavorites();
  }

  private loadAccountFavorites(): void {
    this.favoriteService.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (offers) => {
        this.accountFavoriteOffers.set(offers);
        this.favorites.set(new Set(offers.map((offer) => offer.id)));
      },
      error: () => this.errorMessage.set('Impossible de charger les favoris de votre compte.')
    });
  }
}
