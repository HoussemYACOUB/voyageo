package com.riskboard.backend.travel.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class TravelOfferControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void exposesSortedDemoOffersForDestinationSearch() throws Exception {
        mockMvc.perform(get("/api/offers").param("destination", "Paris"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("train-paris-1"))
                .andExpect(jsonPath("$[0].demo").value(true));
    }
}