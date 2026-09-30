package com.riskboard.backend.travel.service;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import com.riskboard.backend.travel.model.OfferCategory;
import com.riskboard.backend.travel.model.TravelOffer;

class BookingHotelSearchTest {

    @Test
    void fetchesLiveBookingPricesForSelectedDatesAndGuests() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        TravelOfferService service = new TravelOfferService(
                builder, "", "https://booking.test/api/v1/", "test-rapidapi-key", "booking-com15.p.rapidapi.com");
        String checkIn = LocalDate.now().plusDays(30).toString();
        String checkOut = LocalDate.now().plusDays(34).toString();

        server.expect(request -> assertTrue(request.getURI().getPath().endsWith("/api/v1/hotels/searchDestination")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("query", "Lisbonne,%20Portugal"))
                .andExpect(header("X-RapidAPI-Key", "test-rapidapi-key"))
                .andExpect(header("X-RapidAPI-Host", "booking-com15.p.rapidapi.com"))
                .andRespond(withSuccess("""
                        {"data":[{"dest_id":123,"search_type":"CITY","city_name":"Lisbonne","country":"Portugal","label":"Lisbonne, Portugal"}]}
                        """, MediaType.APPLICATION_JSON));
        server.expect(request -> assertTrue(request.getURI().getPath().endsWith("/api/v1/hotels/searchHotels")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(queryParam("dest_id", "123"))
                .andExpect(queryParam("search_type", "CITY"))
                .andExpect(queryParam("arrival_date", checkIn))
                .andExpect(queryParam("departure_date", checkOut))
                .andExpect(queryParam("adults", "3"))
                .andExpect(queryParam("currency_code", "EUR"))
                .andRespond(withSuccess("""
                        {"data":{"hotels":[{"property":{"id":"hotel-1","name":"Hôtel Lisboa","reviewScore":8.7,"url":"https://www.booking.com/hotel/pt/example.html","priceBreakdown":{"grossPrice":{"value":321.45,"currency":"EUR"}}}}]}}
                        """, MediaType.APPLICATION_JSON));

        var offers = service.search("Lisbonne, Portugal", OfferCategory.HOTEL, "price",
                null, null, null, null, checkIn, checkOut, 3);

        assertEquals(1, offers.size());
        TravelOffer offer = offers.getFirst();
        assertEquals("Hôtel Lisboa", offer.title());
        assertEquals(new BigDecimal("321.45"), offer.price());
        assertEquals("EUR", offer.currency());
        assertEquals(new BigDecimal("8.7"), offer.rating());
        assertFalse(offer.demo());
        assertEquals("https://www.booking.com/hotel/pt/example.html", offer.bookingUrl());
        assertTrue(offer.details().contains("4 nuit(s)"));
        assertEquals(offers, service.search("Lisbonne, Portugal", OfferCategory.HOTEL, "price",
                null, null, null, null, checkIn, checkOut, 3), "Repeated searches should use the short-lived cache");
        server.verify();
    }

    @Test
    void ignoresNonBookingUrlsReturnedByProvider() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        TravelOfferService service = new TravelOfferService(
                builder, "", "https://booking.test", "test-rapidapi-key", "booking-com15.p.rapidapi.com");
        String checkIn = LocalDate.now().plusDays(30).toString();
        String checkOut = LocalDate.now().plusDays(31).toString();

        server.expect(request -> assertTrue(request.getURI().getPath().endsWith("/searchDestination")))
                .andRespond(withSuccess("""
                        {"data":[{"dest_id":42,"search_type":"CITY","city_name":"Paris"}]}
                        """, MediaType.APPLICATION_JSON));
        server.expect(request -> assertTrue(request.getURI().getPath().endsWith("/searchHotels")))
                .andRespond(withSuccess("""
                        {"data":{"hotels":[{"property":{"id":1,"name":"Hotel","url":"https://evil.example/","priceBreakdown":{"grossPrice":{"value":80,"currency":"EUR"}}}}]}}
                        """, MediaType.APPLICATION_JSON));

        var offers = service.search("Paris", OfferCategory.HOTEL, "price",
                null, null, null, null, checkIn, checkOut, 2);

        assertEquals(1, offers.size());
        assertNull(offers.getFirst().bookingUrl());
        server.verify();
    }

    @Test
    void selectsTheRequestedCountryAndCityInsteadOfAnUnrelatedHomonym() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        TravelOfferService service = new TravelOfferService(
                builder, "", "https://booking.test", "test-rapidapi-key", "booking-com15.p.rapidapi.com");
        String checkIn = LocalDate.now().plusDays(30).toString();
        String checkOut = LocalDate.now().plusDays(31).toString();

        server.expect(request -> assertTrue(request.getURI().getPath().endsWith("/searchDestination")))
                .andRespond(withSuccess("""
                        {"data":[
                          {"dest_id":"wrong","search_type":"hotel","name":"LISBONNE","city_name":"Le Mans","country":"France","label":"LISBONNE, Le Mans, France"},
                          {"dest_id":"1859607","search_type":"hotel","name":"Lisbonne Appartements","city_name":"Lisbon","country":"Portugal","label":"Lisbonne Appartements, Lisbon, Portugal"}
                        ]}
                        """, MediaType.APPLICATION_JSON));
        server.expect(request -> assertTrue(request.getURI().getPath().endsWith("/searchHotels")))
                .andExpect(queryParam("dest_id", "1859607"))
                .andExpect(queryParam("search_type", "hotel"))
                .andRespond(withSuccess("""
                        {"data":{"hotels":[{"property":{"id":"lisbon-hotel","name":"Lisbonne Appartements","priceBreakdown":{"grossPrice":{"value":200,"currency":"EUR"}}}}]}}
                        """, MediaType.APPLICATION_JSON));

        var offers = service.search("Lisbonne, Portugal", OfferCategory.HOTEL, "price",
                null, null, null, null, checkIn, checkOut, 2);

        assertEquals(1, offers.size());
        assertEquals("Lisbonne Appartements", offers.getFirst().title());
        server.verify();
    }

    @Test
        void reportsMissingRapidApiCredentialsWhenSearchingWithDates() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        TravelOfferService service = new TravelOfferService(builder, "", "https://booking.test", "", "booking-com15.p.rapidapi.com");

        String checkIn = LocalDate.now().plusDays(30).toString();
        String checkOut = LocalDate.now().plusDays(31).toString();
        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.search(
                "Paris", OfferCategory.HOTEL, "price", null, null, null, null, checkIn, checkOut, 2));
        assertTrue(exception.getReason().contains("RAPIDAPI_KEY"));
        server.verify();
    }

    @Test
    void explainsWhenRapidApiHasNotSubscribedToBooking() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        TravelOfferService service = new TravelOfferService(
                builder, "", "https://booking.test", "test-rapidapi-key", "booking-com15.p.rapidapi.com");
        String checkIn = LocalDate.now().plusDays(30).toString();
        String checkOut = LocalDate.now().plusDays(31).toString();
        server.expect(request -> assertTrue(request.getURI().getPath().endsWith("/searchDestination")))
                .andRespond(withStatus(HttpStatus.FORBIDDEN));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> service.search(
                "Paris", OfferCategory.HOTEL, "price", null, null, null, null, checkIn, checkOut, 2));

        assertTrue(exception.getReason().contains("forfait Basic gratuit"));
        server.verify();
    }
}
