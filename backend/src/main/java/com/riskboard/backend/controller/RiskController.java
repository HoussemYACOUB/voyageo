package com.riskboard.backend.controller;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.riskboard.backend.dto.DerogationRequestPayload;
import com.riskboard.backend.dto.ImportSummary;
import com.riskboard.backend.model.Counterparty;
import com.riskboard.backend.model.DerogationRequest;
import com.riskboard.backend.model.DerogationStatus;
import com.riskboard.backend.model.LimitType;
import com.riskboard.backend.model.RiskLimit;
import com.riskboard.backend.model.RiskStatus;
import com.riskboard.backend.repository.CounterpartyRepository;
import com.riskboard.backend.repository.DerogationRequestRepository;
import com.riskboard.backend.repository.RiskLimitRepository;
import com.riskboard.backend.service.RiskAssessmentService;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class RiskController {

    private final CounterpartyRepository counterpartyRepository;
    private final RiskLimitRepository riskLimitRepository;
    private final DerogationRequestRepository derogationRequestRepository;
    private final RiskAssessmentService riskAssessmentService;

    public RiskController(CounterpartyRepository counterpartyRepository,
                         RiskLimitRepository riskLimitRepository,
                         DerogationRequestRepository derogationRequestRepository,
                         RiskAssessmentService riskAssessmentService) {
        this.counterpartyRepository = counterpartyRepository;
        this.riskLimitRepository = riskLimitRepository;
        this.derogationRequestRepository = derogationRequestRepository;
        this.riskAssessmentService = riskAssessmentService;
    }

    private LimitType parseLimitType(String rawValue) {
        String normalized = rawValue == null ? "" : rawValue.trim().toUpperCase(Locale.ROOT);
        if ("COUNTERPARTY".equals(normalized)) {
            return LimitType.MARKET;
        }
        return LimitType.valueOf(normalized);
    }

    @PostMapping("/risk-import")
    @Transactional
    public ResponseEntity<ImportSummary> importCsv(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(new ImportSummary(0, 1, List.of("Le fichier est vide.")));
        }

        List<String> errors = new ArrayList<>();
        int successCount = 0;

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
            String line;
            boolean firstLine = true;

            while ((line = reader.readLine()) != null) {
                if (firstLine) {
                    firstLine = false;
                    continue;
                }
                if (line.isBlank()) {
                    continue;
                }

                String[] values = line.split(",", -1);
                if (values.length != 8) {
                    errors.add("Ligne invalide : " + line);
                    continue;
                }

                try {
                    String name = values[0].trim();
                    String ricosCode = values[1].trim();
                    String country = values[2].trim();
                    String sector = values[3].trim();
                    LimitType limitType = parseLimitType(values[4].trim());
                    BigDecimal maxAmount = new BigDecimal(values[5].trim());
                    BigDecimal usedAmount = new BigDecimal(values[6].trim());
                    String currency = values[7].trim();

                    if (name.isBlank() || ricosCode.isBlank() || country.isBlank() || sector.isBlank()) {
                        throw new IllegalArgumentException("Données obligatoires manquantes");
                    }

                    Counterparty counterparty = counterpartyRepository.findByRicosCode(ricosCode)
                            .orElseGet(() -> counterpartyRepository.save(new Counterparty(name, ricosCode, country, sector)));

                    if (!counterparty.getName().equals(name) || !counterparty.getCountry().equals(country) || !counterparty.getSector().equals(sector)) {
                        counterparty.setName(name);
                        counterparty.setCountry(country);
                        counterparty.setSector(sector);
                        counterpartyRepository.save(counterparty);
                    }

                    RiskLimit riskLimit = riskLimitRepository.findByCounterpartyIdAndLimitType(counterparty.getId(), limitType)
                            .orElseGet(() -> new RiskLimit(counterparty, limitType, maxAmount, usedAmount, currency, OffsetDateTime.now()));

                    riskLimit.setCounterparty(counterparty);
                    riskLimit.setLimitType(limitType);
                    riskLimit.setMaxAmount(maxAmount);
                    riskLimit.setUsedAmount(usedAmount);
                    riskLimit.setCurrency(currency);
                    riskLimit.setLastUpdated(OffsetDateTime.now());
                    riskLimitRepository.save(riskLimit);

                    successCount++;
                } catch (Exception ex) {
                    errors.add("Erreur pour la ligne '" + line + "' : " + ex.getMessage());
                }
            }
        } catch (IOException ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ImportSummary(0, 1, List.of("Impossible de lire le fichier CSV : " + ex.getMessage())));
        }

        return ResponseEntity.ok(new ImportSummary(successCount, errors.size(), errors));
    }

    @GetMapping("/risks")
    public List<Map<String, Object>> getRiskDashboard() {
        List<RiskLimit> limits = riskLimitRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();

        for (RiskLimit limit : limits) {
            BigDecimal usageRate = riskAssessmentService.computeUsageRate(limit.getUsedAmount(), limit.getMaxAmount());
            RiskStatus riskStatus = riskAssessmentService.calculateRiskStatus(usageRate);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("counterpartyId", limit.getCounterparty().getId());
            row.put("name", limit.getCounterparty().getName());
            row.put("limitType", limit.getLimitType().name());
            row.put("sector", limit.getCounterparty().getSector());
            row.put("maxAmount", limit.getMaxAmount());
            row.put("usedAmount", limit.getUsedAmount());
            row.put("usageRate", usageRate.setScale(2, RoundingMode.HALF_UP));
            row.put("riskStatus", riskStatus.name());
            row.put("currency", limit.getCurrency());
            result.add(row);
        }

        result.sort(Comparator.comparing((Map<String, Object> m) -> String.valueOf(m.get("name")))
                .thenComparing(m -> String.valueOf(m.get("limitType")))
                .thenComparing(m -> String.valueOf(m.get("sector")))
                .thenComparing((m) -> new BigDecimal(String.valueOf(m.get("maxAmount"))), Comparator.reverseOrder())
                .thenComparing((m) -> new BigDecimal(String.valueOf(m.get("usedAmount"))), Comparator.reverseOrder())
                .thenComparing((m) -> new BigDecimal(String.valueOf(m.get("usageRate"))), Comparator.reverseOrder())
                .thenComparing(m -> String.valueOf(m.get("riskStatus"))));
        return result;
    }

    @GetMapping("/risk-exposure")
    public Map<String, BigDecimal> getAggregatedExposureBySector() {
        Map<String, BigDecimal> exposure = new LinkedHashMap<>();
        for (RiskLimit limit : riskLimitRepository.findAll()) {
            exposure.merge(limit.getCounterparty().getSector(), limit.getUsedAmount(), BigDecimal::add);
        }
        return exposure.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .collect(LinkedHashMap::new, (map, entry) -> map.put(entry.getKey(), entry.getValue()), LinkedHashMap::putAll);
    }

    @GetMapping("/risk-limits/validate")
    public ResponseEntity<Map<String, Object>> validateRiskLimit(@RequestParam Long counterpartyId,
                                                                @RequestParam LimitType riskType,
                                                                @RequestParam BigDecimal amount) {
        Optional<RiskLimit> existing = riskLimitRepository.findByCounterpartyIdAndLimitType(counterpartyId, riskType);
        if (existing.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("valid", false, "message", "Aucune limite n’existe pour cette contrepartie et ce type de risque."));
        }

        BigDecimal maxAmount = existing.get().getMaxAmount();
        if (amount.compareTo(maxAmount.multiply(new BigDecimal("1.5"))) > 0) {
            return ResponseEntity.badRequest().body(Map.of("valid", false, "message", "Le montant ne doit pas dépasser 150 % de la limite maximale."));
        }

        return ResponseEntity.ok(Map.of("valid", true, "message", "Validation OK"));
    }

    @PostMapping("/derogation-requests")
    @Transactional
    public ResponseEntity<?> createDerogation(@RequestBody DerogationRequestPayload payload) {
        if (payload == null || payload.counterpartyId() == null || payload.riskType() == null || payload.amount() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Données invalides."));
        }

        Optional<Counterparty> counterpartyOpt = counterpartyRepository.findById(payload.counterpartyId());
        if (counterpartyOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Contrepartie inconnue."));
        }

        Optional<RiskLimit> riskLimitOpt = riskLimitRepository.findByCounterpartyIdAndLimitType(payload.counterpartyId(), payload.riskType());
        if (riskLimitOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Aucune limite n’existe pour cette combinaison."));
        }

        if (payload.amount().compareTo(riskLimitOpt.get().getMaxAmount().multiply(new BigDecimal("1.5"))) > 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "Le montant dépasse 150% de la limite maximale."));
        }

        DerogationRequest request = new DerogationRequest(
                counterpartyOpt.get(),
                payload.riskType(),
                payload.amount(),
                payload.reason(),
                payload.requestedBy()
        );
        DerogationRequest saved = derogationRequestRepository.save(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping("/derogation-requests/pending")
    public List<Map<String, Object>> getPendingDerogations() {
        return derogationRequestRepository.findByStatus(DerogationStatus.PENDING).stream().map(request -> {
            Map<String, Object> dto = new LinkedHashMap<>();
            dto.put("id", request.getId());
            dto.put("counterpartyName", request.getCounterparty().getName());
            dto.put("riskType", request.getRiskType().name());
            dto.put("amount", request.getAmount());
            dto.put("reason", request.getReason());
            dto.put("requestedBy", request.getRequestedBy());
            return dto;
        }).toList();
    }

    @PatchMapping("/derogation-requests/{id}/approve")
    public ResponseEntity<?> approveRequest(@PathVariable Long id) {
        Optional<DerogationRequest> request = derogationRequestRepository.findById(id);
        if (request.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        request.get().setStatus(DerogationStatus.APPROVED);
        derogationRequestRepository.save(request.get());
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/derogation-requests/{id}/reject")
    public ResponseEntity<?> rejectRequest(@PathVariable Long id) {
        Optional<DerogationRequest> request = derogationRequestRepository.findById(id);
        if (request.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        request.get().setStatus(DerogationStatus.REJECTED);
        derogationRequestRepository.save(request.get());
        return ResponseEntity.ok().build();
    }
}
