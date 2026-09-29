package com.riskboard.backend.travel.controller;

import java.util.List;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.riskboard.backend.travel.model.OfferCategory;
import com.riskboard.backend.travel.model.TravelOffer;
import com.riskboard.backend.travel.service.TravelOfferService;

@RestController
@RequestMapping("/api/offers")
@CrossOrigin(origins = {"http://localhost:4200", "http://localhost", "capacitor://localhost"})
public class TravelOfferController {

    private final TravelOfferService offerService;

    public TravelOfferController(TravelOfferService offerService) {
        this.offerService = offerService;
    }

    @GetMapping
    public List<TravelOffer> search(
            @RequestParam(required = false) String destination,
            @RequestParam(required = false) OfferCategory category,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String originIata,
            @RequestParam(required = false) String destinationIata,
            @RequestParam(required = false) String departureDate,
            @RequestParam(required = false) String returnDate,
            @RequestParam(required = false) String hotelCheckIn,
            @RequestParam(required = false) String hotelCheckOut,
            @RequestParam(required = false) Integer adults
    ) {
        return offerService.search(destination, category, sort, originIata, destinationIata, departureDate, returnDate,
                hotelCheckIn, hotelCheckOut, adults);
    }

    @GetMapping("/destinations")
    public List<String> destinations() {
        return offerService.listDestinations();
    }
}