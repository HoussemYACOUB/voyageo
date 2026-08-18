package com.riskboard.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.riskboard.backend.model.DerogationRequest;
import com.riskboard.backend.model.DerogationStatus;

public interface DerogationRequestRepository extends JpaRepository<DerogationRequest, Long> {
    List<DerogationRequest> findByStatus(DerogationStatus status);
}
