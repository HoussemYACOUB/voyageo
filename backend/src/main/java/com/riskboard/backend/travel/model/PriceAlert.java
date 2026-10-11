package com.riskboard.backend.travel.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

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

@Entity
@Table(name = "price_alerts")
public class PriceAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @Column(nullable = false, length = 3)
    private String originIata;

    @Column(nullable = false, length = 3)
    private String destinationIata;

    @Column(nullable = false, length = 255)
    private String destination;

    @Column(nullable = false)
    private LocalDate departureDate;

    private LocalDate returnDate;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal targetPrice;

    @Column(nullable = false, length = 3)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PriceAlertStatus status;

    @Column(precision = 12, scale = 2)
    private BigDecimal observedPrice;

    @Column(nullable = false)
    private boolean emailNotifications;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    private Instant triggeredAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
        status = PriceAlertStatus.ACTIVE;
    }

    protected PriceAlert() {
    }

    public PriceAlert(
            UserAccount user,
            String originIata,
            String destinationIata,
            String destination,
            LocalDate departureDate,
            LocalDate returnDate,
            BigDecimal targetPrice,
            boolean emailNotifications
    ) {
        this.user = user;
        this.originIata = originIata.toUpperCase();
        this.destinationIata = destinationIata.toUpperCase();
        this.destination = destination;
        this.departureDate = departureDate;
        this.returnDate = returnDate;
        this.targetPrice = targetPrice;
        this.currency = "EUR";
        this.emailNotifications = emailNotifications;
    }

    public Long getId() { return id; }
    public UserAccount getUser() { return user; }
    public String getOriginIata() { return originIata; }
    public String getDestinationIata() { return destinationIata; }
    public String getDestination() { return destination; }
    public LocalDate getDepartureDate() { return departureDate; }
    public LocalDate getReturnDate() { return returnDate; }
    public BigDecimal getTargetPrice() { return targetPrice; }
    public String getCurrency() { return currency; }
    public PriceAlertStatus getStatus() { return status; }
    public BigDecimal getObservedPrice() { return observedPrice; }
    public boolean isEmailNotifications() { return emailNotifications; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getTriggeredAt() { return triggeredAt; }

    public void trigger(BigDecimal price) {
        status = PriceAlertStatus.TRIGGERED;
        observedPrice = price;
        triggeredAt = Instant.now();
    }
}
