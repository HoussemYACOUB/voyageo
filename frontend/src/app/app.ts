import { CommonModule, registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, skip } from 'rxjs';
import { AuthService } from './services/auth.service';
import { OfferCategory, OfferSort, TravelOffer, TravelOfferService } from './services/travel-offer.service';

type CategoryFilter = 'ALL' | OfferCategory;

interface PartnerSite {
  id: string;
  name: string;
  url: string;
  categories: OfferCategory[];
  badge: string;
  color: string;
}

registerLocaleData(localeFr, 'fr-FR');

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private readonly offerService = inject(TravelOfferService);
  private readonly authService = inject(AuthService);

  protected readonly destination = signal('');
  protected readonly departureDate = signal('');
  protected readonly returnDate = signal('');
  protected readonly travelers = signal(2);
  protected readonly activeCategory = signal<CategoryFilter>('ALL');
  protected readonly sortBy = signal<OfferSort>('price');
  protected readonly offers = signal<TravelOffer[]>([]);
  protected readonly favorites = signal<Set<string>>(new Set());
  protected readonly favoritesOnly = signal(false);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly destinationSuggestions = signal<string[]>([]);
  protected readonly categories: { id: CategoryFilter; label: string; icon: string }[] = [
    { id: 'ALL', label: 'Tout comparer', icon: '✦' },
    { id: 'HOTEL', label: 'Hébergements', icon: '⌂' },
    { id: 'FLIGHT', label: 'Vols', icon: '✈' },
    { id: 'TRAIN', label: 'Trains', icon: '▤' },
    { id: 'CAR', label: 'Voitures', icon: '◈' }
  ];
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
      id: 'govoyages',
      name: 'GO Voyages',
      url: 'https://www.govoyages.com',
      categories: ['FLIGHT', 'CAR'],
      badge: '🛫',
      color: '#c1175a'
    },
    {
      id: 'sncf',
      name: 'SNCF Connect',
      url: 'https://www.sncf-connect.com',
      categories: ['TRAIN'],
      badge: '🚆',
      color: '#0b1641'
    }
  ];

  // Cree en contexte d'injection : necessaire pour toObservable()
  private readonly destinationChanges$ = toObservable(this.destination);

  protected readonly visibleOffers = computed(() => {
    const category = this.activeCategory();
    const sort = this.sortBy();
    return this.offers()
      .filter((offer) => category === 'ALL' || offer.category === category)
      .filter((offer) => !this.favoritesOnly() || this.favorites().has(offer.id))
      .slice()
      .sort((left, right) => (sort === 'rating' ? right.rating - left.rating : left.price - right.price));
  });

  protected readonly lowestPrice = computed(() => this.visibleOffers()[0]?.price ?? null);
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

  ngOnInit(): void {
    this.authService.bootstrapSession().subscribe({ error: () => undefined });
    this.searchOffers();
    this.offerService.destinations().subscribe({
      next: (destinations) => this.destinationSuggestions.set(destinations),
      error: () => this.destinationSuggestions.set([])
    });
    // Recherche dynamique : relance automatiquement apres une pause de saisie
    this.destinationChanges$
      .pipe(debounceTime(450), distinctUntilChanged(), skip(1))
      .subscribe(() => this.searchOffers());
  }

  protected searchOffers(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    const category = this.activeCategory();
    this.offerService
      .search(this.destination().trim(), category === 'ALL' ? undefined : category, this.sortBy())
      .subscribe({
        next: (offers) => {
          this.offers.set(offers);
          this.loading.set(false);
        },
        error: () => {
          this.errorMessage.set('Impossible de charger les offres. Vérifiez que le serveur est démarré.');
          this.loading.set(false);
        }
      });
  }

  protected selectCategory(category: CategoryFilter): void {
    this.activeCategory.set(category);
    this.favoritesOnly.set(false);
    this.searchOffers();
  }

  protected selectSort(sort: OfferSort): void {
    this.sortBy.set(sort);
    this.searchOffers();
  }

  /** Raccourci "faciliteur de tache" : remplit la destination et lance la recherche en un clic. */
  protected quickSearch(destination: string): void {
    this.destination.set(destination);
    this.searchOffers();
  }

  protected toggleFavoritesView(): void {
    this.favoritesOnly.update((current) => !current);
  }

  protected toggleFavorite(id: string): void {
    this.favorites.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected isFavorite(id: string): boolean {
    return this.favorites().has(id);
  }

  protected categoryLabel(category: OfferCategory): string {
    return this.categories.find((item) => item.id === category)?.label ?? category;
  }

  protected offerIcon(category: OfferCategory): string {
    return this.categories.find((item) => item.id === category)?.icon ?? '✦';
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

  protected closeAuth(): void {
    this.authOpen.set(false);
    this.authLoading.set(false);
    this.authError.set('');
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

    request$.subscribe({
      next: () => {
        this.authLoading.set(false);
        this.authPassword.set('');
        this.authOpen.set(false);
      },
      error: () => {
        this.authLoading.set(false);
        this.authError.set('Connexion impossible. Vérifiez vos identifiants ou créez un compte.');
      }
    });
  }

  protected logout(): void {
    this.authService.logout();
  }
}
