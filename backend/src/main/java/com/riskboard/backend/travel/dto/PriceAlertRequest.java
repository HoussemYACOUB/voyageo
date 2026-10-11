package com.riskboard.backend.travel.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record PriceAlertRequest(
        @NotBlank @Pattern(regexp = "(?i)[A-Z]{3}") String originIata,
        @NotBlank @Pattern(regexp = "(?i)[A-Z]{3}") String destinationIata,
        @NotBlank @Size(max = 255) String destination,
        @NotNull @FutureOrPresent LocalDate departureDate,
        @FutureOrPresent LocalDate returnDate,
        @NotNull @DecimalMin("0.01") BigDecimal targetPrice,
        boolean emailNotifications
) {
}
