package com.bank.frauddetection.supabase;

import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class SupabaseAuthService {

    private final SupabaseClient supabase;

    public SupabaseAuthService(SupabaseClient supabase) {
        this.supabase = supabase;
    }

    public Map<String, Object> login(String email, String password) {
        return supabase.signInWithPassword(email, password);
    }

    public Map<String, Object> getCurrentUser(String token) {
        return supabase.getUser(token);
    }

    public String extractUserId(Map<String, Object> userData) {
        if (userData == null) return null;
        Object id = userData.get("id");
        return id != null ? id.toString() : null;
    }

    public String extractToken(Map<String, Object> authResponse) {
        if (authResponse == null) return null;
        Object token = authResponse.get("access_token");
        return token != null ? token.toString() : null;
    }

    public String getUserRole(String token) {
        var user = getCurrentUser(token);
        if (user == null) return null;
        Object role = user.get("role");
        if (role != null) return role.toString();
        Object userMeta = user.get("user_metadata");
        if (userMeta instanceof Map) {
            Object metaRole = ((Map<?, ?>) userMeta).get("role");
            if (metaRole != null) return metaRole.toString();
        }
        return null;
    }

    public boolean hasRole(String token, String... roles) {
        String userRole = getUserRole(token);
        if (userRole == null) return false;
        for (String r : roles) {
            if (r.equals(userRole)) return true;
        }
        return false;
    }
}
