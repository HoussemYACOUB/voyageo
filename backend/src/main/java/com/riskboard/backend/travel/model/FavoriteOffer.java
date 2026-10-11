package com.riskboard.backend.travel.model;

import java.math.BigDecimal;
import java.time.Instant;

import com.riskboard.backend.auth.model.UserAccount;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "favorite_offers", uniqueConstraints = @UniqueConstraint(columnNames = { "user_id", "offer_id" }))
public class FavoriteOffer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @Column(name = "offer_id", nullable = false, length = 255)
    private String offerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OfferCategory category;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable = false, length = 255)
    private String destination;

    @Column(nullable = false, length = 100)
    private String provider;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(nullable = false, length = 1000)
    private String details;

    @Column(nullable = false, precision = 4, scale = 2)
    private BigDecimal rating;

    @Column(nullable = false)
    private boolean demo;

    private java.time.LocalDate departureDate;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    protected FavoriteOffer() {
    }

    public FavoriteOffer(UserAccount user, TravelOffer offer) {
        this.user = user;
        this.offerId = offer.id();
        this.category = offer.category();
        this.title = offer.title();
        this.destination = offer.destination();
        this.provider = offer.provider();
        this.price = offer.price();
        this.currency = offer.currency();
        this.details = offer.details();
        this.rating = offer.rating();
        this.demo = offer.demo();
        this.departureDate = offer.departureDate() == null ? null : java.time.LocalDate.parse(offer.departureDate());
    }

    public String getOfferId() { return offerId; }
    public OfferCategory getCategory() { return category; }
    public String getTitle() { return title; }
    public String getDestination() { return destination; }
    public String getProvider() { return provider; }
    public BigDecimal getPrice() { return price; }
    public String getCurrency() { return currency; }
    public String getDetails() { return details; }
    public BigDecimal getRating() { return rating; }
    public boolean isDemo() { return demo; }
    public java.time.LocalDate getDepartureDate() { return departureDate; }

    public TravelOffer toTravelOffer() {
        return new TravelOffer(offerId, category, title, destination, provider, price, currency, details, rating, demo,
                null, departureDate == null ? null : departureDate.toString());
    }
}
