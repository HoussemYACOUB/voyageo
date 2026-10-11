package com.riskboard.backend.travel.service;

import java.math.BigDecimal;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

import com.riskboard.backend.auth.model.UserAccount;
import com.riskboard.backend.travel.dto.PriceAlertRequest;
import com.riskboard.backend.travel.dto.PriceAlertResponse;
import com.riskboard.backend.travel.model.OfferCategory;
import com.riskboard.backend.travel.model.PriceAlert;
import com.riskboard.backend.travel.model.PriceAlertStatus;
import com.riskboard.backend.travel.model.TravelOffer;
import com.riskboard.backend.travel.repository.PriceAlertRepository;

@Service
public class PriceAlertService {

    private static final Logger logger = LoggerFactory.getLogger(PriceAlertService.class);

    private final PriceAlertRepository repository;
    private final TravelOfferService travelOfferService;
    private final PriceAlertEmailService emailService;

    public PriceAlertService(
            PriceAlertRepository repository,
            TravelOfferService travelOfferService,
            PriceAlertEmailService emailService
    ) {
        this.repository = repository;
        this.travelOfferService = travelOfferService;
        this.emailService = emailService;
    }

    @Transactional(readOnly = true)
    public List<PriceAlertResponse> list(UserAccount user) {
        return repository.findAllByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(PriceAlertResponse::from)
                .toList();
    }

    @Transactional
    public PriceAlertResponse create(UserAccount user, PriceAlertRequest request) {
        if (request.returnDate() != null && !request.returnDate().isAfter(request.departureDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La date de retour doit suivre le départ.");
        }
        if (request.emailNotifications() && !emailService.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Les notifications e-mail ne sont pas configurées sur le serveur.");
        }

        PriceAlert saved = repository.save(new PriceAlert(user, request.originIata(), request.destinationIata(),
                request.destination().trim(), request.departureDate(), request.returnDate(), request.targetPrice(),
                request.emailNotifications()));
        return PriceAlertResponse.from(saved);
    }

    @Transactional
    public void delete(UserAccount user, Long id) {
        PriceAlert alert = repository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alerte introuvable."));
        repository.delete(alert);
    }

    @Scheduled(fixedDelayString = "${price-alerts.check-interval-ms:21600000}")
    @Transactional
    public void checkActiveAlerts() {
        for (PriceAlert alert : repository.findAllByStatusOrderByCreatedAtAsc(PriceAlertStatus.ACTIVE)) {
            try {
                checkAlert(alert);
            } catch (RestClientException | ResponseStatusException exception) {
                logger.warn("Price alert check failed for alertId={}: {}", alert.getId(), exception.getMessage());
            }
        }
    }

    private void checkAlert(PriceAlert alert) {
        List<TravelOffer> offers = travelOfferService.search(alert.getDestination(), OfferCategory.FLIGHT, "price",
                alert.getOriginIata(), alert.getDestinationIata(), alert.getDepartureDate().toString(),
                alert.getReturnDate() == null ? null : alert.getReturnDate().toString());
        BigDecimal observedPrice = offers.stream()
                .filter(offer -> !offer.demo() && "EUR".equalsIgnoreCase(offer.currency()))
                .map(TravelOffer::price)
                .min(BigDecimal::compareTo)
                .orElse(null);
        if (observedPrice != null && observedPrice.compareTo(alert.getTargetPrice()) <= 0) {
            alert.trigger(observedPrice);
            if (alert.isEmailNotifications()) emailService.send(alert, alert.getUser());
            logger.info("Price alert triggered for alertId={} observedPrice={}", alert.getId(), observedPrice);
        }
    }
}
