package com.riskboard.backend.travel.dto;

import java.math.BigDecimal;

import com.riskboard.backend.travel.model.OfferCategory;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record FavoriteOfferRequest(
        @NotBlank @Size(max = 255) String id,
        @NotNull OfferCategory category,
        @NotBlank @Size(max = 255) String title,
        @NotBlank @Size(max = 255) String destination,
        @NotBlank @Size(max = 100) String provider,
        @NotNull @DecimalMin("0.01") BigDecimal price,
        @NotBlank @Size(min = 3, max = 3) String currency,
        @NotBlank @Size(max = 1000) String details,
        @NotNull @DecimalMin("0.00") BigDecimal rating,
        boolean demo,
        java.time.LocalDate departureDate
) {
}
