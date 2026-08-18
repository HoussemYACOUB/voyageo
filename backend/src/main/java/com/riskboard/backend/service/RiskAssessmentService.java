package com.riskboard.backend.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.riskboard.backend.model.RiskStatus;

@Service
public class RiskAssessmentService {

    public RiskStatus calculateRiskStatus(BigDecimal usageRate) {
        if (usageRate == null) {
            return RiskStatus.GREEN;
        }

        if (usageRate.compareTo(new BigDecimal("70")) < 0) {
            return RiskStatus.GREEN;
        }
        if (usageRate.compareTo(new BigDecimal("90")) <= 0) {
            return RiskStatus.ORANGE;
        }
        return RiskStatus.RED;
    }

    public Map<String, BigDecimal> aggregateExposureBySector(Map<String, BigDecimal> sectorExposure) {
        Map<String, BigDecimal> aggregated = new LinkedHashMap<>();

        sectorExposure.forEach((sector, amount) ->
                aggregated.merge(sector, amount == null ? BigDecimal.ZERO : amount, BigDecimal::add)
        );

        return aggregated.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .collect(java.util.stream.Collectors.toMap(
                        Map.Entry::getKey,
                        Map.Entry::getValue,
                        (existing, replacement) -> replacement,
                        LinkedHashMap::new
                ));
    }

    public BigDecimal computeUsageRate(BigDecimal usedAmount, BigDecimal maxAmount) {
        if (maxAmount == null || maxAmount.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }

        return usedAmount
                .multiply(BigDecimal.valueOf(100))
                .divide(maxAmount, 4, RoundingMode.HALF_UP);
    }
}
