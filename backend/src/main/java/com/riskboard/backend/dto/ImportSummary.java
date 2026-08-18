package com.riskboard.backend.dto;

import java.util.List;

public record ImportSummary(int successCount, int errorCount, List<String> errors) {
}
