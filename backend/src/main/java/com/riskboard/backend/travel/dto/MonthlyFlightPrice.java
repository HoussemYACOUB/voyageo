package com.riskboard.backend.travel.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record MonthlyFlightPrice(LocalDate departureDate, BigDecimal price, String currency) {
}
