package com.riskboard.backend.travel.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.riskboard.backend.travel.model.PriceAlert;
import com.riskboard.backend.travel.model.PriceAlertStatus;

public interface PriceAlertRepository extends JpaRepository<PriceAlert, Long> {
    List<PriceAlert> findAllByUserIdOrderByCreatedAtDesc(Long userId);
    List<PriceAlert> findAllByStatusOrderByCreatedAtAsc(PriceAlertStatus status);
    Optional<PriceAlert> findByIdAndUserId(Long id, Long userId);
}
