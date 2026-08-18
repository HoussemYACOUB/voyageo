package com.riskboard.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "counterparties", uniqueConstraints = {
        @UniqueConstraint(name = "uk_counterparty_ricos", columnNames = "ricos_code")
})
public class Counterparty {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "ricos_code", nullable = false)
    private String ricosCode;

    @Column(nullable = false)
    private String country;

    @Column(nullable = false)
    private String sector;

    public Counterparty() {
    }

    public Counterparty(String name, String ricosCode, String country, String sector) {
        this.name = name;
        this.ricosCode = ricosCode;
        this.country = country;
        this.sector = sector;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getRicosCode() {
        return ricosCode;
    }

    public void setRicosCode(String ricosCode) {
        this.ricosCode = ricosCode;
    }

    public String getCountry() {
        return country;
    }

    public void setCountry(String country) {
        this.country = country;
    }

    public String getSector() {
        return sector;
    }

    public void setSector(String sector) {
        this.sector = sector;
    }
}
