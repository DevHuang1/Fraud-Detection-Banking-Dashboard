package com.bank.frauddetection.controller;

import com.bank.frauddetection.supabase.SupabaseAuthService;
import com.bank.frauddetection.supabase.SupabaseDataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final SupabaseDataService dataService;
    private final SupabaseAuthService authService;

    public DashboardController(SupabaseDataService dataService, SupabaseAuthService authService) {
        this.dataService = dataService;
        this.authService = authService;
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats(@RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            var transactions = dataService.getDashboardStats(token);
            var alerts = dataService.getAlerts(token, "is_read=eq.false");

            long total = transactions.size();
            long suspicious = transactions.stream().filter(t -> Boolean.TRUE.equals(t.get("is_suspicious"))).count();
            long confirmedFraud = transactions.stream().filter(t -> Boolean.TRUE.equals(t.get("is_fraud"))).count();
            long blocked = transactions.stream().filter(t -> "blocked".equals(t.get("status"))).count();
            double avgRisk = transactions.stream()
                .mapToDouble(t -> {
                    Object rs = t.get("risk_score");
                    return rs instanceof Number ? ((Number) rs).doubleValue() : 0;
                })
                .average().orElse(0);
            long highRisk = transactions.stream()
                .filter(t -> "high".equals(t.get("risk_level")) || "critical".equals(t.get("risk_level")))
                .count();

            double fraudRate = total > 0 ? (confirmedFraud * 100.0 / total) : 0;
            long unreadAlerts = alerts.size();

            Map<String, Object> stats = new LinkedHashMap<>();
            stats.put("totalTransactions", total);
            stats.put("suspiciousTransactions", suspicious);
            stats.put("confirmedFraud", confirmedFraud);
            stats.put("blockedAttempts", blocked);
            stats.put("avgRiskScore", Math.round(avgRisk * 100.0) / 100.0);
            stats.put("highRiskAccounts", highRisk);
            stats.put("fraudRate", Math.round(fraudRate * 100.0) / 100.0);
            stats.put("unreadAlerts", unreadAlerts);

            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/transactions")
    public ResponseEntity<?> getTransactions(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(defaultValue = "50") int limit) {
        try {
            String token = authHeader.replace("Bearer ", "");
            var txs = dataService.getTransactions(token, "limit=" + limit);
            return ResponseEntity.ok(txs);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/transactions/{id}")
    public ResponseEntity<?> getTransaction(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long id) {
        try {
            String token = authHeader.replace("Bearer ", "");
            var tx = dataService.getTransactionById(token, id);
            if (tx == null) return ResponseEntity.notFound().build();
            return ResponseEntity.ok(tx);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/cases")
    public ResponseEntity<?> getCases(@RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            var cases = dataService.getFraudCases(token, null);
            return ResponseEntity.ok(cases);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/cases/{id}")
    public ResponseEntity<?> updateCase(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long id,
            @RequestBody Map<String, Object> updates) {
        try {
            String token = authHeader.replace("Bearer ", "");
            if (!authService.hasRole(token, "investigator", "admin")) {
                return ResponseEntity.status(403).body(Map.of("error", "Forbidden: investigator or admin role required"));
            }
            dataService.updateFraudCase(token, id, updates);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/alerts")
    public ResponseEntity<?> getAlerts(@RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            var alerts = dataService.getAlerts(token, null);
            return ResponseEntity.ok(alerts);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/rules")
    public ResponseEntity<?> getRules(@RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            if (!authService.hasRole(token, "investigator", "admin")) {
                return ResponseEntity.status(403).body(Map.of("error", "Forbidden: investigator or admin role required"));
            }
            var rules = dataService.getFraudRules(token);
            return ResponseEntity.ok(rules);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
}
