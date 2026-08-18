package com.riskboard.backend.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.riskboard.backend.model.RiskStatus;

class RiskAssessmentServiceTest {

    private final RiskAssessmentService service = new RiskAssessmentService();

    @Test
    void shouldReturnGreenWhenUsageRateIsBelow70Percent() {
        assertThat(service.calculateRiskStatus(new BigDecimal("69.99"))).isEqualTo(RiskStatus.GREEN);
        assertThat(service.calculateRiskStatus(new BigDecimal("0"))).isEqualTo(RiskStatus.GREEN);
    }

    @Test
    void shouldReturnOrangeWhenUsageRateIsBetween70And90Percent() {
        assertThat(service.calculateRiskStatus(new BigDecimal("70"))).isEqualTo(RiskStatus.ORANGE);
        assertThat(service.calculateRiskStatus(new BigDecimal("89.99"))).isEqualTo(RiskStatus.ORANGE);
    }

    @Test
    void shouldReturnRedWhenUsageRateExceeds90Percent() {
        assertThat(service.calculateRiskStatus(new BigDecimal("90.01"))).isEqualTo(RiskStatus.RED);
        assertThat(service.calculateRiskStatus(new BigDecimal("100"))).isEqualTo(RiskStatus.RED);
    }

    @Test
    void shouldAggregateExposureBySector() {
        Map<String, BigDecimal> exposure = new java.util.LinkedHashMap<>();
        exposure.put("Banking", new BigDecimal("1500.50"));
        exposure.put("Energy", new BigDecimal("750.25"));
        exposure.put("Technology", new BigDecimal("500.00"));

        Map<String, BigDecimal> aggregated = service.aggregateExposureBySector(exposure);

        assertThat(aggregated).containsEntry("Banking", new BigDecimal("1500.50"));
        assertThat(aggregated).containsEntry("Energy", new BigDecimal("750.25"));
        assertThat(aggregated).containsEntry("Technology", new BigDecimal("500.00"));
    }
}
