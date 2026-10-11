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
import com.riskboard.backend.travel.dto.PriceAlertRequest;
import com.riskboard.backend.travel.dto.PriceAlertResponse;
import com.riskboard.backend.travel.service.PriceAlertEmailService;
import com.riskboard.backend.travel.service.PriceAlertService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/price-alerts")
public class PriceAlertController {

    private final PriceAlertService priceAlertService;
    private final PriceAlertEmailService emailService;

    public PriceAlertController(PriceAlertService priceAlertService, PriceAlertEmailService emailService) {
        this.priceAlertService = priceAlertService;
        this.emailService = emailService;
    }

    @GetMapping
    public List<PriceAlertResponse> list(@AuthenticationPrincipal UserAccount user) {
        return priceAlertService.list(user);
    }

    @GetMapping("/email-available")
    public boolean emailAvailable() {
        return emailService.isConfigured();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PriceAlertResponse create(
            @AuthenticationPrincipal UserAccount user,
            @Valid @RequestBody PriceAlertRequest request
    ) {
        return priceAlertService.create(user, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal UserAccount user, @PathVariable Long id) {
        priceAlertService.delete(user, id);
    }
}
