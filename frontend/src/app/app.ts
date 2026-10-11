import { CommonModule, registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, map, of, Subscription, switchMap } from 'rxjs';
import { PriceComparisonChart, PriceComparisonItem } from './price-comparison-chart/price-comparison-chart';
import { AuthService } from './services/auth.service';
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

registerLocaleData(localeFr, 'fr-FR');

const FAVORITES_STORAGE_KEY = 'voyageo.favorites';
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

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, PriceComparisonChart],
  templateUrl: './app.html',
  styleUrls: ['./app.scss', './auth.scss']
})
export class App implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly offerService = inject(TravelOfferService);
  private readonly authService = inject(AuthService);
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
  protected readonly offers = signal<TravelOffer[]>([]);
  protected readonly favorites = signal<Set<string>>(new Set());
  protected readonly favoritesOnly = signal(false);
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
      imageUrl: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=900&h=620&q=82',
      imageAlt: 'Vue ensoleillée sur les maisons colorées de la côte italienne'
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

  protected readonly visibleOffers = computed(() => {
    const category = this.activeCategory();
    const sort = this.sortBy();
    return this.offers()
      .filter((offer) => category === 'ALL' || offer.category === category)
      .filter((offer) => !this.favoritesOnly() || this.favorites().has(offer.id))
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
  protected readonly user = this.authService.currentUser;
  protected readonly isAuthenticated = this.authService.isAuthenticated;
  protected readonly userInitial = computed(() => this.user()?.displayName?.charAt(0).toUpperCase() ?? '👤');
  protected readonly hasDemoOffers = computed(() => this.visibleOffers().some((offer) => offer.demo));

  ngOnInit(): void {
    this.restoreFavorites();
    this.authService.bootstrapSession().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => undefined });
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

  protected selectInspirationCategory(category: 'FLIGHT' | 'HOTEL'): void {
    this.inspirationCategory.set(category);
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
  }

  protected toggleFavorite(id: string): void {
    const next = new Set(this.favorites());
    if (next.has(id)) next.delete(id);
    else next.add(id);
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

  protected categoryLabel(category: OfferCategory): string {
    return this.categories.find((item) => item.id === category)?.label ?? category;
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
      },
      error: (error: HttpErrorResponse) => {
        this.authLoading.set(false);
        const message = error.error?.message;
        this.authError.set(typeof message === 'string' ? message : 'Connexion impossible. Vérifiez vos identifiants ou réessayez.');
      }
    });
  }

  protected logout(): void {
    this.authService.logout();
  }
}
