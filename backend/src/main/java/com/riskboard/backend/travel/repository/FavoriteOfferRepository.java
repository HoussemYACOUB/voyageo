package com.riskboard.backend.travel.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.riskboard.backend.travel.model.FavoriteOffer;

public interface FavoriteOfferRepository extends JpaRepository<FavoriteOffer, Long> {
    List<FavoriteOffer> findAllByUserIdOrderByCreatedAtDesc(Long userId);
    boolean existsByUserIdAndOfferId(Long userId, String offerId);
    void deleteByUserIdAndOfferId(Long userId, String offerId);
}
