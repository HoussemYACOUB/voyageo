package com.riskboard.backend.travel.service;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;

import com.riskboard.backend.travel.model.OfferCategory;
import com.riskboard.backend.travel.model.TravelOffer;

class TravelOfferServiceTest {

    private final TravelOfferService service = new TravelOfferService();

    @Test
    void returnsAllDemoOffersCheapestFirstWhenNoFiltersAreProvided() {
        List<TravelOffer> offers = service.search(null, null);

        assertEquals(7, offers.size());
        assertEquals("24.00", offers.getFirst().price().toPlainString());
        assertTrue(offers.stream().allMatch(TravelOffer::demo));
    }

    @Test
    void filtersDestinationWithoutBeingCaseOrAccentSensitive() {
        List<TravelOffer> offers = service.search("lisbONNe", null);

        assertEquals(1, offers.size());
        assertTrue(offers.stream().allMatch(offer -> offer.destination().equals("Lisbonne")));
    }

    @Test
    void matchesAutocompleteCityWithCountrySuffix() {
        List<TravelOffer> offers = service.search("Lisbonne, Portugal", OfferCategory.FLIGHT);

        assertEquals(1, offers.size());
        assertEquals("flight-lisbonne-1", offers.getFirst().id());
        assertTrue(offers.getFirst().demo());
    }

    @Test
    void doesNotPresentInventedHotelPricesAsOffers() {
        assertTrue(service.search("Paris", OfferCategory.HOTEL).isEmpty());
    }

    @Test
    void filtersByCategoryAndDestinationTogether() {
        List<TravelOffer> offers = service.search("paris", OfferCategory.TRAIN);

        assertEquals(1, offers.size());
        assertEquals("train-paris-1", offers.getFirst().id());
    }

    @Test
    void returnsNoOffersForAnUnknownDestination() {
        assertTrue(service.search("Tokyo", null).isEmpty());
    }

    @Test
    void sortsByRatingDescendingWhenRequested() {
        List<TravelOffer> offers = service.search(null, null, "rating");

        assertEquals("train-paris-1", offers.getFirst().id());
        assertEquals("4.6", offers.getFirst().rating().toPlainString());
    }

    @Test
    void listsDistinctDestinationsSortedAlphabetically() {
        List<String> destinations = service.listDestinations();

        assertEquals(List.of("Lisbonne", "Lyon", "New York", "Nice", "Paris", "Rome"), destinations);
    }
}