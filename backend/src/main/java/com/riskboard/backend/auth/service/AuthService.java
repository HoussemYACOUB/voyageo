package com.riskboard.backend.auth.service;

import java.util.Locale;

import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.riskboard.backend.auth.dto.AuthResponse;
import com.riskboard.backend.auth.dto.ChangePasswordRequest;
import com.riskboard.backend.auth.dto.LoginRequest;
import com.riskboard.backend.auth.dto.RegisterRequest;
import com.riskboard.backend.auth.dto.UpdateProfileRequest;
import com.riskboard.backend.auth.dto.UserProfileResponse;
import com.riskboard.backend.auth.model.UserAccount;
import com.riskboard.backend.auth.repository.UserAccountRepository;

@Service
public class AuthService {

    private final UserAccountRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(
            UserAccountRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String normalizedEmail = normalizeEmail(request.email());
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new IllegalArgumentException("Un compte existe déjà avec cet email.");
        }

        UserAccount user = new UserAccount();
        user.setEmail(normalizedEmail);
        user.setDisplayName(request.displayName().trim());
        user.setPasswordHash(passwordEncoder.encode(request.password()));

        UserAccount saved = userRepository.save(user);
        return issueToken(saved);
    }

    public AuthResponse login(LoginRequest request) {
        String normalizedEmail = normalizeEmail(request.email());
        UserAccount user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new BadCredentialsException("Email ou mot de passe invalide."));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BadCredentialsException("Email ou mot de passe invalide.");
        }

        return issueToken(user);
    }

    public UserProfileResponse me(UserAccount user) {
        return mapProfile(user);
    }

    @Transactional
    public UserProfileResponse updateProfile(UserAccount user, UpdateProfileRequest request) {
        user.setDisplayName(request.displayName().trim());
        return mapProfile(userRepository.save(user));
    }

    @Transactional
    public void changePassword(UserAccount user, ChangePasswordRequest request) {
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new BadCredentialsException("Le mot de passe actuel est incorrect.");
        }
        if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Choisissez un nouveau mot de passe différent de l’actuel.");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
    }

    public UserAccount loadByEmail(String email) {
        return userRepository.findByEmailIgnoreCase(normalizeEmail(email))
                .orElseThrow(() -> new BadCredentialsException("Utilisateur introuvable."));
    }

    private AuthResponse issueToken(UserAccount user) {
        String token = jwtService.generateToken(user.getEmail());
        return new AuthResponse(token, "Bearer", mapProfile(user));
    }

    private static UserProfileResponse mapProfile(UserAccount user) {
        return new UserProfileResponse(user.getId(), user.getEmail(), user.getDisplayName());
    }

    private static String normalizeEmail(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }
}
