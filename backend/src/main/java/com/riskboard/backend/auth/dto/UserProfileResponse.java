package com.riskboard.backend.auth.dto;

public record UserProfileResponse(
        Long id,
        String email,
        String displayName
) {
}
