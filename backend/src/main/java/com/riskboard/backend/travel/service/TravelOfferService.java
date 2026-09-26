package com.riskboard.backend.travel.service;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.riskboard.backend.travel.model.OfferCategory;
import com.riskboard.backend.travel.model.TravelOffer;

@Service
public class TravelOfferService {

        private final RestClient restClient = RestClient.create();
        private final ObjectMapper objectMapper = new ObjectMapper();

        @Value("${providers.booking.enabled:false}")
        private boolean bookingEnabled;

        @Value("${providers.booking.base-url:https://booking-com15.p.rapidapi.com/api/v1}")
        private String bookingBaseUrl;

        @Value("${providers.booking.host:booking-com15.p.rapidapi.com}")
        private String bookingHost;

        @Value("${providers.booking.api-key:}")
        private String bookingApiKey;

        @Value("${providers.flight.enabled:false}")
        private boolean flightEnabled;

        @Value("${providers.flight.base-url:https://api.tequila.kiwi.com}")
        private String flightBaseUrl;

        @Value("${providers.flight.api-key:}")
        private String flightApiKey;

        @Value("${providers.sncf.enabled:false}")
        private boolean sncfEnabled;

        @Value("${providers.sncf.base-url:https://api.sncf.com/v1}")
        private String sncfBaseUrl;

        @Value("${providers.sncf.api-key:}")
        private String sncfApiKey;

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
        String normalizedDestination = normalize(destination);
                List<TravelOffer> source = new ArrayList<>(DEMO_OFFERS);

                if (!normalizedDestination.isBlank()) {
                        source.addAll(fetchExternalOffers(destination, category));
                }

                return source.stream()
                .filter(offer -> category == null || offer.category() == category)
                .filter(offer -> normalizedDestination.isBlank()
                        || normalize(offer.destination()).contains(normalizedDestination)
                        || normalize(offer.title()).contains(normalizedDestination))
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

        private List<TravelOffer> fetchExternalOffers(String destination, OfferCategory category) {
                List<TravelOffer> offers = new ArrayList<>();
                try {
                        if ((category == null || category == OfferCategory.HOTEL) && bookingEnabled && hasText(bookingApiKey)) {
                                offers.addAll(fetchBookingOffers(destination));
                        }
                        if ((category == null || category == OfferCategory.FLIGHT || category == OfferCategory.CAR)
                                        && flightEnabled && hasText(flightApiKey)) {
                                offers.addAll(fetchFlightOffers(destination));
                        }
                        if ((category == null || category == OfferCategory.TRAIN) && sncfEnabled && hasText(sncfApiKey)) {
                                offers.addAll(fetchSncfOffers(destination));
                        }
                } catch (Exception ignored) {
                        // Fallback silencieux sur données démo en cas d'indisponibilité fournisseur.
                }
                return offers;
        }

        private List<TravelOffer> fetchBookingOffers(String destination) {
                String encodedDestination = URLEncoder.encode(destination, StandardCharsets.UTF_8);
                String url = bookingBaseUrl + "/hotels/searchDestination?query=" + encodedDestination;

                String body = restClient.get()
                                .uri(url)
                                .header("x-rapidapi-key", bookingApiKey)
                                .header("x-rapidapi-host", bookingHost)
                                .accept(MediaType.APPLICATION_JSON)
                                .retrieve()
                                .body(String.class);

                if (body == null) {
                        return List.of();
                }

                JsonNode root = readJson(body);
                JsonNode list = root.path("data");
                if (!list.isArray()) {
                        return List.of();
                }

                List<TravelOffer> offers = new ArrayList<>();
                int count = 0;
                for (JsonNode node : list) {
                        if (count >= 5) break;
                        String city = node.path("city_name").asText(destination);
                        String hotel = node.path("name").asText("Hôtel " + city);
                        String destId = node.path("dest_id").asText("dest");
                        offers.add(new TravelOffer(
                                        "booking-" + destId + "-" + count,
                                        OfferCategory.HOTEL,
                                        hotel,
                                        city,
                                        "Booking.com",
                                        new BigDecimal("99.00"),
                                        "EUR",
                                        "Offre fournisseur externe (prix final selon disponibilité)",
                                        new BigDecimal("4.3"),
                                        false
                        ));
                        count++;
                }
                return offers;
        }

        private List<TravelOffer> fetchFlightOffers(String destination) {
                String encodedDestination = URLEncoder.encode(destination, StandardCharsets.UTF_8);
                String url = flightBaseUrl + "/locations/query?term=" + encodedDestination + "&limit=5&location_types=city";

                String body = restClient.get()
                                .uri(url)
                                .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                                .header("apikey", flightApiKey)
                                .retrieve()
                                .body(String.class);

                if (body == null) {
                        return List.of();
                }

                JsonNode root = readJson(body);
                JsonNode list = root.path("locations");
                if (!list.isArray()) {
                        return List.of();
                }

                List<TravelOffer> offers = new ArrayList<>();
                int count = 0;
                for (JsonNode node : list) {
                        if (count >= 4) break;
                        String city = node.path("name").asText(destination);
                        String code = node.path("code").asText("XXX");
                        offers.add(new TravelOffer(
                                        "flight-" + code + "-" + count,
                                        OfferCategory.FLIGHT,
                                        "Paris → " + city,
                                        city,
                                        "GO Voyages",
                                        new BigDecimal("129.00"),
                                        "EUR",
                                        "Comparaison externe (prix dynamique selon API)",
                                        new BigDecimal("4.2"),
                                        false
                        ));
                        count++;
                }
                return offers;
        }

        private List<TravelOffer> fetchSncfOffers(String destination) {
                String encodedDestination = URLEncoder.encode(destination, StandardCharsets.UTF_8);
                String url = sncfBaseUrl + "/coverage/sncf/places?q=" + encodedDestination;

                String body = restClient.get()
                                .uri(url)
                                .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                                .header(HttpHeaders.AUTHORIZATION, toBasicAuth(sncfApiKey))
                                .retrieve()
                                .body(String.class);

                if (body == null) {
                        return List.of();
                }

                JsonNode root = readJson(body);
                JsonNode list = root.path("places");
                if (!list.isArray()) {
                        return List.of();
                }

                List<TravelOffer> offers = new ArrayList<>();
                int count = 0;
                for (JsonNode node : list) {
                        if (count >= 4) break;
                        String city = node.path("name").asText(destination);
                        offers.add(new TravelOffer(
                                        "sncf-" + count + "-" + normalize(city),
                                        OfferCategory.TRAIN,
                                        "Train vers " + city,
                                        city,
                                        "SNCF Connect",
                                        new BigDecimal("49.00"),
                                        "EUR",
                                        "Donnée issue d'un fournisseur externe",
                                        new BigDecimal("4.4"),
                                        false
                        ));
                        count++;
                }
                return offers;
        }

        private JsonNode readJson(String body) {
                try {
                        return objectMapper.readTree(body);
                } catch (Exception ex) {
                        return objectMapper.createObjectNode();
                }
        }

        private static String toBasicAuth(String token) {
                String source = (token == null ? "" : token) + ":";
                String encoded = java.util.Base64.getEncoder().encodeToString(source.getBytes(StandardCharsets.UTF_8));
                return "Basic " + encoded;
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
                new BigDecimal(price), "EUR", details, new BigDecimal(rating), true);
    }
}