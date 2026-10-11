package com.riskboard.backend.travel.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.riskboard.backend.auth.model.UserAccount;
import com.riskboard.backend.travel.dto.FavoriteOfferRequest;
import com.riskboard.backend.travel.model.TravelOffer;
import com.riskboard.backend.travel.service.FavoriteOfferService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/favorites")
public class FavoriteOfferController {

    private final FavoriteOfferService favoriteOfferService;

    public FavoriteOfferController(FavoriteOfferService favoriteOfferService) {
        this.favoriteOfferService = favoriteOfferService;
    }

    @GetMapping
    public List<TravelOffer> list(@AuthenticationPrincipal UserAccount user) {
        return favoriteOfferService.list(user);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void save(@AuthenticationPrincipal UserAccount user, @Valid @RequestBody FavoriteOfferRequest request) {
        favoriteOfferService.save(user, request);
    }

    @DeleteMapping("/{offerId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@AuthenticationPrincipal UserAccount user, @PathVariable String offerId) {
        favoriteOfferService.remove(user, offerId);
    }
}
