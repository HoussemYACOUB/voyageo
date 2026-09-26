import { CommonModule, registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OfferCategory, TravelOffer, TravelOfferService } from './services/travel-offer.service';

type CategoryFilter = 'ALL' | OfferCategory;

registerLocaleData(localeFr, 'fr-FR');

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private readonly offerService = inject(TravelOfferService);

  protected readonly destination = signal('');
  protected readonly departureDate = signal('');
  protected readonly returnDate = signal('');
  protected readonly travelers = signal(2);
  protected readonly activeCategory = signal<CategoryFilter>('ALL');
  protected readonly offers = signal<TravelOffer[]>([]);
  protected readonly favorites = signal<Set<string>>(new Set());
  protected readonly favoritesOnly = signal(false);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly categories: { id: CategoryFilter; label: string; icon: string }[] = [
    { id: 'ALL', label: 'Tout comparer', icon: '✦' },
    { id: 'HOTEL', label: 'Hébergements', icon: '⌂' },
    { id: 'FLIGHT', label: 'Vols', icon: '✈' },
    { id: 'TRAIN', label: 'Trains', icon: '▤' },
    { id: 'CAR', label: 'Voitures', icon: '◈' }
  ];

  protected readonly visibleOffers = computed(() => {
    const category = this.activeCategory();
    return this.offers()
      .filter((offer) => category === 'ALL' || offer.category === category)
      .filter((offer) => !this.favoritesOnly() || this.favorites().has(offer.id))
      .slice()
      .sort((left, right) => left.price - right.price);
  });

  protected readonly lowestPrice = computed(() => this.visibleOffers()[0]?.price ?? null);
  protected readonly savedCount = computed(() => this.favorites().size);

  ngOnInit(): void {
    this.searchOffers();
  }

  protected searchOffers(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.offerService.search(this.destination().trim()).subscribe({
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
}
