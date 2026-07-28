package com.bank.frauddetection.controller;

import com.bank.frauddetection.supabase.SupabaseAuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final SupabaseAuthService authService;

    public AuthController(SupabaseAuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        try {
            var result = authService.login(
                credentials.get("email"),
                credentials.get("password")
            );
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid credentials"));
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            var user = authService.getCurrentUser(token);
            String role = authService.getUserRole(token);
            Map<String, Object> result = new java.util.LinkedHashMap<>(user);
            result.put("role", role);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
    }

    @GetMapping("/role")
    public ResponseEntity<?> myRole(@RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            String role = authService.getUserRole(token);
            return ResponseEntity.ok(Map.of("role", role != null ? role : "unknown"));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
    }
}
