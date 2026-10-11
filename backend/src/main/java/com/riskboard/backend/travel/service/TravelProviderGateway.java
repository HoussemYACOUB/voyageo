package com.riskboard.backend.travel.service;

import java.net.URI;

import org.springframework.stereotype.Component;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

@Component
public class TravelProviderGateway {

    private final RestClient restClient;

    public TravelProviderGateway() {
        this(RestClient.builder());
    }

    public TravelProviderGateway(RestClient.Builder restClientBuilder) {
        this.restClient = restClientBuilder.build();
    }

    String fetchFlightPrices(URI uri, String accessToken) {
        return restClient.get()
                .uri(uri)
                .header("X-Access-Token", accessToken.trim())
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .body(String.class);
    }

    String fetchBookingResponse(URI uri, String apiKey, String apiHost) {
        return restClient.get()
                .uri(uri)
                .header("X-RapidAPI-Key", apiKey.trim())
                .header("X-RapidAPI-Host", apiHost.trim())
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .body(String.class);
    }
}
