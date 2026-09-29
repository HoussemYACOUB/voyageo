package com.riskboard.backend.travel.service;

import java.math.BigDecimal;
import java.net.URI;
import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.riskboard.backend.travel.model.OfferCategory;
import com.riskboard.backend.travel.model.TravelOffer;

@Service
public class TravelOfferService {

        private static final String BOOKING_DESTINATION_PATH = "/api/v1/hotels/searchDestination";
        private static final String BOOKING_HOTELS_PATH = "/api/v1/hotels/searchHotels";

        private final RestClient restClient;
        private final ObjectMapper objectMapper = new ObjectMapper();
        private final String travelPayoutsToken;
        private final String bookingApiBaseUrl;
        private final String rapidApiKey;
        private final String rapidApiHost;
        private final ConcurrentMap<String, CachedHotelOffers> hotelSearchCache = new ConcurrentHashMap<>();

        private record CachedHotelOffers(Instant expiresAt, List<TravelOffer> offers) {}

        @Autowired
        TravelOfferService(
                        RestClient.Builder restClientBuilder,
                        @Value("${providers.travelpayouts.token:}") String travelPayoutsToken,
                        @Value("${providers.booking.base-url:https://booking-com15.p.rapidapi.com}") String bookingApiBaseUrl,
                        @Value("${providers.booking.rapidapi-key:}") String rapidApiKey,
                        @Value("${providers.booking.rapidapi-host:booking-com15.p.rapidapi.com}") String rapidApiHost
        ) {
                this.restClient = restClientBuilder.build();
                this.travelPayoutsToken = travelPayoutsToken;
                this.bookingApiBaseUrl = normalizeBaseUrl(bookingApiBaseUrl);
                this.rapidApiKey = rapidApiKey;
                this.rapidApiHost = rapidApiHost;
        }

        TravelOfferService() {
                this(RestClient.builder(), "", "", "", "");
        }

    private static final List<TravelOffer> DEMO_OFFERS = List.of(
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
                return search(destination, category, sort, originIata, destinationIata, departureDate, returnDate,
                                null, null, null);
        }

        public List<TravelOffer> search(
                        String destination,
                        OfferCategory category,
                        String sort,
                        String originIata,
                        String destinationIata,
                        String departureDate,
                        String returnDate,
                        String hotelCheckIn,
                        String hotelCheckOut,
                        Integer adults
        ) {
        String normalizedDestination = normalize(destination);
                String normalizedCity = normalizedDestination.split(",", 2)[0].trim();
                if (category == OfferCategory.HOTEL) {
                        return fetchHotelOffers(destination, hotelCheckIn, hotelCheckOut, adults).stream()
                                        .sorted(resolveComparator(sort))
                                        .toList();
                }
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

        private List<TravelOffer> fetchHotelOffers(String destination, String checkIn, String checkOut, Integer adults) {
                if (!hasText(destination) || !isValidTravelDate(checkIn) || !isValidTravelDate(checkOut)
                                || !LocalDate.parse(checkOut).isAfter(LocalDate.parse(checkIn))) {
                        return List.of();
                }
                if (!hasText(rapidApiKey) || !hasText(rapidApiHost)) {
                        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                                        "Ajoutez RAPIDAPI_KEY au backend et activez le forfait Basic gratuit Booking COM dans RapidAPI.");
                }
                int guestCount = adults == null ? 2 : adults;
                if (guestCount < 1 || guestCount > 6) return List.of();
                String cacheKey = normalize(destination) + "|" + checkIn + "|" + checkOut + "|" + guestCount;
                CachedHotelOffers cached = hotelSearchCache.get(cacheKey);
                if (cached != null && cached.expiresAt().isAfter(Instant.now())) return cached.offers();

                try {
                        JsonNode destinationResponse = getBookingApiResponse(
                                        UriComponentsBuilder.fromUriString(bookingApiBaseUrl + BOOKING_DESTINATION_PATH)
                                                        .queryParam("query", destination)
                                                        .build().encode().toUri());
                        JsonNode destinationResult = selectDestination(destinationResponse.path("data"), destination);
                        if (destinationResult == null || !destinationResult.hasNonNull("dest_id")) return List.of();

                        String searchType = destinationResult.path("search_type").asText("CITY");
                        JsonNode hotelsResponse = getBookingApiResponse(
                                        UriComponentsBuilder.fromUriString(bookingApiBaseUrl + BOOKING_HOTELS_PATH)
                                                        .queryParam("dest_id", destinationResult.path("dest_id").asText())
                                                        .queryParam("search_type", searchType)
                                                        .queryParam("arrival_date", checkIn)
                                                        .queryParam("departure_date", checkOut)
                                                        .queryParam("adults", guestCount)
                                                        .queryParam("room_qty", 1)
                                                        .queryParam("currency_code", "EUR")
                                                        .queryParam("languagecode", "fr")
                                                        .queryParam("page_number", 1)
                                                        .build().encode().toUri());
                        List<TravelOffer> offers = mapHotelOffers(hotelsResponse, destination, checkIn, checkOut);
                        hotelSearchCache.put(cacheKey, new CachedHotelOffers(Instant.now().plusSeconds(900), offers));
                        return offers;
                } catch (RestClientResponseException exception) {
                        String message = exception.getStatusCode().value() == 403
                                        ? "Accès Booking refusé. Activez le forfait Basic gratuit de Booking COM sur RapidAPI et vérifiez la clé RAPIDAPI_KEY du backend."
                                        : exception.getStatusCode().value() == 429
                                                        ? "Quota RapidAPI atteint. Le forfait gratuit Booking COM est limité à 50 appels par mois."
                                                        : "Le fournisseur Booking COM a refusé la recherche. Réessayez plus tard.";
                        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, message, exception);
                } catch (RestClientException exception) {
                        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                                        "Le fournisseur Booking COM est temporairement inaccessible.", exception);
                } catch (JsonProcessingException | IllegalArgumentException exception) {
                        return List.of();
                }
        }

        private JsonNode getBookingApiResponse(URI uri) throws JsonProcessingException {
                String body = restClient.get()
                                .uri(uri)
                                .header("X-RapidAPI-Key", rapidApiKey.trim())
                                .header("X-RapidAPI-Host", rapidApiHost.trim())
                                .accept(MediaType.APPLICATION_JSON)
                                .retrieve()
                                .body(String.class);
                if (!hasText(body)) return objectMapper.createObjectNode();
                return objectMapper.readTree(body);
        }

        private List<TravelOffer> mapHotelOffers(JsonNode response, String destination, String checkIn, String checkOut) {
                JsonNode results = response.path("data").path("hotels");
                if (!results.isArray()) results = response.path("data");
                if (!results.isArray()) results = response.path("hotels");
                if (!results.isArray()) return List.of();

                long nights = LocalDate.parse(checkOut).toEpochDay() - LocalDate.parse(checkIn).toEpochDay();
                List<TravelOffer> offers = new ArrayList<>();
                for (JsonNode result : results) {
                        JsonNode property = result.path("property").isObject() ? result.path("property") : result;
                        JsonNode priceBreakdown = firstObject(property.path("priceBreakdown"), result.path("priceBreakdown"));
                        JsonNode grossPrice = priceBreakdown.path("grossPrice");
                        JsonNode priceNode = grossPrice.isObject() ? grossPrice.path("value") : grossPrice;
                        if (!priceNode.isNumber() && !priceNode.isTextual()) {
                                priceNode = firstPresent(property.path("price"), result.path("price"),
                                                property.path("min_total_price"), result.path("min_total_price"));
                        }
                        BigDecimal price = decimalValue(priceNode);
                        if (price == null || price.signum() <= 0) continue;

                        String name = firstText(property, "name", "hotel_name", "title");
                        if (!hasText(name)) name = firstText(result, "name", "hotel_name", "title");
                        if (!hasText(name)) name = "Hébergement à " + destination;
                        String id = firstText(property, "id", "hotel_id");
                        if (!hasText(id)) id = firstText(result, "id", "hotel_id");
                        if (!hasText(id)) id = Integer.toString(offers.size());
                        String currency = firstText(grossPrice, "currency");
                        if (!hasText(currency)) currency = firstText(priceBreakdown, "currency");
                        if (!hasText(currency)) currency = "EUR";
                        BigDecimal rating = decimalValue(firstPresent(property.path("reviewScore"),
                                        property.path("review_score"), result.path("reviewScore"), result.path("review_score")));
                        if (rating == null) rating = BigDecimal.ZERO;
                        String directUrl = firstText(property, "url", "bookingUrl", "booking_url");
                        if (!hasText(directUrl)) directUrl = firstText(result, "url", "bookingUrl", "booking_url");

                        offers.add(new TravelOffer(
                                        "booking-hotel-" + id,
                                        OfferCategory.HOTEL,
                                        name,
                                        destination,
                                        "Booking.com",
                                        price,
                                        currency.toUpperCase(Locale.ROOT),
                                        "Du " + checkIn + " au " + checkOut + " · " + nights + " nuit(s) · tarif consulté sur Booking.com, à revérifier",
                                        rating,
                                        false,
                                        safeBookingUrl(directUrl)
                        ));
                        if (offers.size() == 10) break;
                }
                return offers;
        }

        private static JsonNode selectDestination(JsonNode destinations, String query) {
                if (!destinations.isArray()) return null;
                String normalizedQuery = normalize(query.split(",", 2)[0]);
                JsonNode first = null;
                for (JsonNode candidate : destinations) {
                        if (first == null) first = candidate;
                        String type = candidate.path("search_type").asText("");
                        String city = firstText(candidate, "city_name", "name", "label");
                        if ((!hasText(type) || "CITY".equalsIgnoreCase(type))
                                        && normalize(city).contains(normalizedQuery)) return candidate;
                }
                return first;
        }

        private static JsonNode firstObject(JsonNode first, JsonNode second) {
                return first != null && first.isObject() ? first : second;
        }

        private static JsonNode firstPresent(JsonNode... nodes) {
                for (JsonNode node : nodes) {
                        if (node != null && !node.isMissingNode() && !node.isNull()) return node;
                }
                return null;
        }

        private static String firstText(JsonNode node, String... fields) {
                for (String field : fields) {
                        JsonNode value = node.path(field);
                        if (value.isValueNode() && hasText(value.asText())) return value.asText();
                }
                return "";
        }

        private static BigDecimal decimalValue(JsonNode node) {
                if (node == null || node.isNull() || node.isMissingNode()) return null;
                try {
                        return node.isNumber() ? node.decimalValue() : new BigDecimal(node.asText());
                } catch (NumberFormatException exception) {
                        return null;
                }
        }

        private static String safeBookingUrl(String value) {
                if (!hasText(value)) return null;
                try {
                        URI uri = URI.create(value);
                        String host = uri.getHost();
                        return "https".equalsIgnoreCase(uri.getScheme()) && host != null
                                        && (host.equalsIgnoreCase("booking.com") || host.endsWith(".booking.com"))
                                                        ? uri.toString()
                                                        : null;
                } catch (IllegalArgumentException exception) {
                        return null;
                }
        }

        private static String normalizeBaseUrl(String value) {
                if (!hasText(value)) return "https://booking-com15.p.rapidapi.com";
                String trimmed = value.trim();
                return trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : "https://" + trimmed;
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