package com.riskboard.backend.travel.service;

import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.riskboard.backend.auth.model.UserAccount;
import com.riskboard.backend.travel.dto.FavoriteOfferRequest;
import com.riskboard.backend.travel.model.FavoriteOffer;
import com.riskboard.backend.travel.model.TravelOffer;
import com.riskboard.backend.travel.repository.FavoriteOfferRepository;

@Service
public class FavoriteOfferService {

    private final FavoriteOfferRepository repository;

    public FavoriteOfferService(FavoriteOfferRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<TravelOffer> list(UserAccount user) {
        return repository.findAllByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(FavoriteOffer::toTravelOffer)
                .toList();
    }

    @Transactional
    public void save(UserAccount user, FavoriteOfferRequest request) {
        if (repository.existsByUserIdAndOfferId(user.getId(), request.id())) return;
        TravelOffer offer = new TravelOffer(request.id(), request.category(), request.title(), request.destination(),
                request.provider(), request.price(), request.currency().toUpperCase(Locale.ROOT), request.details(), request.rating(),
                request.demo(), null, request.departureDate() == null ? null : request.departureDate().toString());
        repository.save(new FavoriteOffer(user, offer));
    }

    @Transactional
    public void remove(UserAccount user, String offerId) {
        repository.deleteByUserIdAndOfferId(user.getId(), offerId);
    }
}
