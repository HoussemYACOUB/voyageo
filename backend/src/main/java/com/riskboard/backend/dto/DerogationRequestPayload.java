package com.riskboard.backend.dto;

import java.math.BigDecimal;

import com.riskboard.backend.model.LimitType;

public record DerogationRequestPayload(
        Long counterpartyId,
        LimitType riskType,
        BigDecimal amount,
        String reason,
        String requestedBy
) {
}
