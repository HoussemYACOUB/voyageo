package com.riskboard.backend.auth.dto;

public record AuthResponse(
        String token,
        String tokenType,
        UserProfileResponse user
) {
}
