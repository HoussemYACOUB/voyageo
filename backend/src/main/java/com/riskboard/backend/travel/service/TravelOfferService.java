package com.riskboard.backend.travel.service;

import java.math.BigDecimal;
import java.net.URI;
import java.text.Normalizer;
import java.time.LocalDate;
import java.util.Locale;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.riskboard.backend.travel.model.OfferCategory;
import com.riskboard.backend.travel.model.TravelOffer;

@Service
public class TravelOfferService {

        private final RestClient restClient = RestClient.create();
        private final ObjectMapper objectMapper = new ObjectMapper();

        @Value("${providers.travelpayouts.token:}")
        private String travelPayoutsToken;

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
        return search(destination, category, null);
    }

    public List<TravelOffer> search(String destination, OfferCategory category, String sort) {
                return search(destination, category, sort, null, null, null, null);
        }

        public List<TravelOffer> search(
                        String destination,
                        OfferCategory category,
                        String sort,
                        String originIata,
                        String destinationIata,
                        String departureDate,
                        String returnDate
        ) {
        String normalizedDestination = normalize(destination);
                String normalizedCity = normalizedDestination.split(",", 2)[0].trim();
                List<TravelOffer> source = new ArrayList<>(DEMO_OFFERS);
                List<TravelOffer> flightOffers = fetchFlightOffers(
                                destination, originIata, destinationIata, departureDate, returnDate, category);
                if (!flightOffers.isEmpty()) {
                        source.removeIf(offer -> offer.demo() && offer.category() == OfferCategory.FLIGHT);
                        source.addAll(flightOffers);
                }

                return source.stream()
                .filter(offer -> category == null || offer.category() == category)
                .filter(offer -> normalizedCity.isBlank()
                        || normalize(offer.destination()).contains(normalizedCity)
                        || normalize(offer.title()).contains(normalizedCity))
                .sorted(resolveComparator(sort))
                .toList();
    }

    /** Renvoie les destinations distinctes disponibles, utilisees pour l'auto-completion. */
    public List<String> listDestinations() {
        return DEMO_OFFERS.stream()
                .map(TravelOffer::destination)
                .distinct()
                .sorted()
                .toList();
    }

    private static Comparator<TravelOffer> resolveComparator(String sort) {
        if ("rating".equalsIgnoreCase(sort)) {
            return Comparator.comparing(TravelOffer::rating).reversed().thenComparing(TravelOffer::id);
        }
        return Comparator.comparing(TravelOffer::price).thenComparing(TravelOffer::id);
    }

        private List<TravelOffer> fetchFlightOffers(
                        String destinationLabel,
                        String originIata,
                        String destinationIata,
                        String departureDate,
                        String returnDate,
                        OfferCategory category
        ) {
                if (category != null && category != OfferCategory.FLIGHT) return List.of();
                if (!hasText(travelPayoutsToken) || !isIataCode(originIata) || !isIataCode(destinationIata)
                                || !isValidTravelDate(departureDate)) return List.of();

                try {
                        UriComponentsBuilder uri = UriComponentsBuilder
                                    .fromUriString("https://api.travelpayouts.com/aviasales/v3/prices_for_dates")
                                        .queryParam("origin", originIata.toUpperCase(Locale.ROOT))
                                        .queryParam("destination", destinationIata.toUpperCase(Locale.ROOT))
                                        .queryParam("departure_at", departureDate)
                                        .queryParam("currency", "eur")
                                        .queryParam("one_way", !hasText(returnDate))
                                        .queryParam("sorting", "price")
                                        .queryParam("limit", 5);
                        if (hasText(returnDate) && isValidTravelDate(returnDate)) {
                                uri.queryParam("return_at", returnDate);
                        }

                        String body = restClient.get()
                                        .uri(URI.create(uri.build().encode().toUriString()))
                                        .header("X-Access-Token", travelPayoutsToken.trim())
                                        .accept(MediaType.APPLICATION_JSON)
                                        .retrieve()
                                        .body(String.class);
                        if (!hasText(body)) return List.of();

                        JsonNode root = objectMapper.readTree(body);
                        JsonNode results = root.path("data");
                        if (!root.path("success").asBoolean(false) || !results.isArray()) return List.of();

                        List<TravelOffer> offers = new ArrayList<>();
                        for (JsonNode result : results) {
                                JsonNode priceNode = result.path("price");
                                if (!priceNode.isNumber() || priceNode.decimalValue().signum() <= 0) continue;
                                String from = result.path("origin_name").asText(originIata.toUpperCase(Locale.ROOT));
                                String to = result.path("destination_name").asText(destinationLabel);
                                String airline = result.path("airline").asText("");
                                String stops = result.path("transfers").isNumber()
                                                ? result.path("transfers").asText() + " escale(s)"
                                                : "Itinéraire selon disponibilité";
                                String departure = result.path("departure_at").asText(departureDate);
                                String foundAt = result.path("found_at").asText("");
                                String details = "Départ " + departure + " · " + stops
                                                + (hasText(airline) ? " · compagnie " + airline : "")
                                                + (hasText(foundAt) ? " · relevé " + foundAt : "")
                                                + " · tarif indicatif issu du cache Aviasales, à revérifier";
                                String link = result.path("link").asText("");
                                String bookingUrl = link.startsWith("/") && !link.startsWith("//")
                                                ? "https://www.aviasales.com" + link
                                                : null;
                                String id = "aviasales-" + offers.size() + "-" + departure + "-" + originIata + "-" + destinationIata;
                                offers.add(new TravelOffer(
                                                id,
                                                OfferCategory.FLIGHT,
                                                from + " → " + to,
                                                destinationLabel,
                                                "Aviasales",
                                                priceNode.decimalValue(),
                                                root.path("currency").asText("EUR").toUpperCase(Locale.ROOT),
                                                details,
                                                BigDecimal.ZERO,
                                                false,
                                                bookingUrl
                                ));
                        }
                        return offers;
                } catch (RestClientException | JsonProcessingException | IllegalArgumentException ignored) {
                        // Le catalogue de démonstration reste disponible si le fournisseur est absent ou indisponible.
                        return List.of();
                }
        }

        private static boolean isIataCode(String value) {
                return value != null && value.trim().matches("(?i)[a-z]{3}");
        }

        private static boolean isValidTravelDate(String value) {
                if (value == null) return false;
                try {
                        return !LocalDate.parse(value).isBefore(LocalDate.now());
                } catch (RuntimeException exception) {
                        return false;
                }
        }

        private static boolean hasText(String value) {
                return value != null && !value.isBlank();
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
                new BigDecimal(price), "EUR", details, new BigDecimal(rating), true, null);
    }
}