package com.riskboard.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.riskboard.backend.model.LimitType;
import com.riskboard.backend.model.RiskLimit;

public interface RiskLimitRepository extends JpaRepository<RiskLimit, Long> {
    Optional<RiskLimit> findByCounterpartyIdAndLimitType(Long counterpartyId, LimitType limitType);
}
