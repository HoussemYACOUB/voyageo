package com.riskboard.backend.travel.service;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Service;

import com.riskboard.backend.travel.model.OfferCategory;
import com.riskboard.backend.travel.model.TravelOffer;

@Service
public class TravelOfferService {

    private static final List<TravelOffer> DEMO_OFFERS = List.of(
            offer("hotel-paris-1", OfferCategory.HOTEL, "Hôtel des Arts", "Paris", "Séjour démo",
                    "Quartier Montmartre · petit-déjeuner", "4.7", "119.00"),
            offer("hotel-paris-2", OfferCategory.HOTEL, "Maison Rivoli", "Paris", "Séjour démo",
                    "Centre-ville · annulation flexible", "4.5", "146.00"),
            offer("hotel-lyon-1", OfferCategory.HOTEL, "Le Jardin Lyonnais", "Lyon", "Séjour démo",
                    "Presqu’île · proche du métro", "4.6", "98.00"),
            offer("hotel-lisbonne-1", OfferCategory.HOTEL, "Casa Alfama", "Lisbonne", "Séjour démo",
                    "Alfama · terrasse ensoleillée", "4.8", "82.00"),
            offer("flight-lisbonne-1", OfferCategory.FLIGHT, "Paris → Lisbonne", "Lisbonne", "Vol démo",
                    "Vol direct · aller simple", "4.3", "89.00"),
            offer("flight-rome-1", OfferCategory.FLIGHT, "Paris → Rome", "Rome", "Vol démo",
                    "Vol direct · aller simple", "4.4", "104.00"),
            offer("flight-newyork-1", OfferCategory.FLIGHT, "Paris → New York", "New York", "Vol démo",
                    "Vol direct · aller simple", "4.2", "389.00"),
            offer("train-paris-1", OfferCategory.TRAIN, "Lyon → Paris", "Paris", "Train démo",
                    "Grande vitesse · environ 2 h", "4.6", "39.00"),
            offer("train-nice-1", OfferCategory.TRAIN, "Marseille → Nice", "Nice", "Train démo",
                    "Train régional · environ 2 h 40", "4.4", "24.00"),
            offer("car-lyon-1", OfferCategory.CAR, "Citadine à Lyon", "Lyon", "Location démo",
                    "Kilométrage inclus · par jour", "4.1", "31.00"),
            offer("car-nice-1", OfferCategory.CAR, "Compacte à Nice", "Nice", "Location démo",
                    "Retrait à l’aéroport · par jour", "4.2", "36.00")
    );

    public List<TravelOffer> search(String destination, OfferCategory category) {
        String normalizedDestination = normalize(destination);

        return DEMO_OFFERS.stream()
                .filter(offer -> category == null || offer.category() == category)
                .filter(offer -> normalizedDestination.isBlank()
                        || normalize(offer.destination()).contains(normalizedDestination)
                        || normalize(offer.title()).contains(normalizedDestination))
                .sorted(Comparator.comparing(TravelOffer::price).thenComparing(TravelOffer::id))
                .toList();
    }

    private static String normalize(String value) {
        if (value == null) {
            return "";
        }

        return Normalizer.normalize(value.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
    }

    private static TravelOffer offer(
            String id,
            OfferCategory category,
            String title,
            String destination,
            String provider,
            String details,
            String rating,
            String price
    ) {
        return new TravelOffer(id, category, title, destination, provider,
                new BigDecimal(price), "EUR", details, new BigDecimal(rating), true);
    }
}