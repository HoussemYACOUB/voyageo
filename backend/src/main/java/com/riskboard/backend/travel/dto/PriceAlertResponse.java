package com.riskboard.backend.travel.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import com.riskboard.backend.travel.model.PriceAlert;
import com.riskboard.backend.travel.model.PriceAlertStatus;

public record PriceAlertResponse(
        Long id,
        String originIata,
        String destinationIata,
        String destination,
        LocalDate departureDate,
        LocalDate returnDate,
        BigDecimal targetPrice,
        String currency,
        PriceAlertStatus status,
        BigDecimal observedPrice,
        boolean emailNotifications,
        Instant createdAt,
        Instant triggeredAt
) {
    public static PriceAlertResponse from(PriceAlert alert) {
        return new PriceAlertResponse(alert.getId(), alert.getOriginIata(), alert.getDestinationIata(),
                alert.getDestination(), alert.getDepartureDate(), alert.getReturnDate(), alert.getTargetPrice(),
                alert.getCurrency(), alert.getStatus(), alert.getObservedPrice(), alert.isEmailNotifications(),
                alert.getCreatedAt(), alert.getTriggeredAt());
    }
}
