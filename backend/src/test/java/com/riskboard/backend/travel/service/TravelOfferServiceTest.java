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

        assertEquals(11, offers.size());
        assertEquals("24.00", offers.getFirst().price().toPlainString());
        assertTrue(offers.stream().allMatch(TravelOffer::demo));
    }

    @Test
    void filtersDestinationWithoutBeingCaseOrAccentSensitive() {
        List<TravelOffer> offers = service.search("lisbONNe", null);

        assertEquals(2, offers.size());
        assertTrue(offers.stream().allMatch(offer -> offer.destination().equals("Lisbonne")));
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
}