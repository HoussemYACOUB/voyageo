package com.riskboard.backend.travel.model;

import java.math.BigDecimal;

public record TravelOffer(
        String id,
        OfferCategory category,
        String title,
        String destination,
        String provider,
        BigDecimal price,
        String currency,
        String details,
        BigDecimal rating,
        boolean demo
) {
}