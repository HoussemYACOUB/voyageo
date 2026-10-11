package com.riskboard.backend.travel.controller;

import java.time.LocalDate;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class TravelAccountFeaturesIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void storesAccountFavoritesAndPriceAlertsBehindAuthentication() throws Exception {
        String email = "features-" + UUID.randomUUID() + "@example.com";
        MvcResult registration = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"displayName\":\"Voyageur\",\"password\":\"secure-password-2026\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String token = objectMapper.readTree(registration.getResponse().getContentAsString()).path("token").asText();
        assertTrue(token.length() > 20);

        mockMvc.perform(get("/api/favorites"))
                .andExpect(status().isUnauthorized());

        String offerId = "test-flight-" + UUID.randomUUID();
        mockMvc.perform(post("/api/favorites")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"id":"%s","category":"FLIGHT","title":"Paris → Lisbonne","destination":"Lisbonne","provider":"Aviasales","price":98.50,"currency":"EUR","details":"Départ %s","rating":0.00,"demo":false,"departureDate":"%s"}
                                """.formatted(offerId, LocalDate.now().plusDays(30), LocalDate.now().plusDays(30))))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/favorites").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(offerId))
                .andExpect(jsonPath("$[0].departureDate").value(LocalDate.now().plusDays(30).toString()));

        LocalDate departure = LocalDate.now().plusDays(60);
        String alertResponse = mockMvc.perform(post("/api/price-alerts")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"originIata":"PAR","destinationIata":"LIS","destination":"Lisbonne, Portugal","departureDate":"%s","targetPrice":100.00,"emailNotifications":false}
                                """.formatted(departure)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andReturn().getResponse().getContentAsString();
        JsonNode alert = objectMapper.readTree(alertResponse);
        long alertId = alert.path("id").asLong();

        mockMvc.perform(get("/api/price-alerts").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].targetPrice").value(100.00))
                .andExpect(jsonPath("$[0].emailNotifications").value(false));

        mockMvc.perform(delete("/api/favorites/{offerId}", offerId).header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/price-alerts/{id}", alertId).header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/favorites").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
        mockMvc.perform(get("/api/price-alerts").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }
}
