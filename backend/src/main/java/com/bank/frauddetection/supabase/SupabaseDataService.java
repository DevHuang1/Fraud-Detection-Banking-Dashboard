package com.bank.frauddetection.supabase;

import com.bank.frauddetection.dto.*;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class SupabaseDataService {

    private final SupabaseClient supabase;

    public SupabaseDataService(SupabaseClient supabase) {
        this.supabase = supabase;
    }

    public List<Map<String, Object>> getTransactions(String token, String queryParams) {
        String path = "transactions?order=timestamp.desc&limit=50" + (queryParams != null ? "&" + queryParams : "");
        return supabase.get(path, token, List.class);
    }

    public Map<String, Object> getTransactionById(String token, Long id) {
        String path = "transactions?id=eq." + id + "&select=*";
        var list = supabase.get(path, token, List.class);
        return list != null && !list.isEmpty() ? (Map<String, Object>) list.get(0) : null;
    }

    public List<Map<String, Object>> getFraudCases(String token, String queryParams) {
        String path = "fraud_cases?order=created_at.desc&limit=50" + (queryParams != null ? "&" + queryParams : "");
        return supabase.get(path, token, List.class);
    }

    public Map<String, Object> updateFraudCase(String token, Long caseId, Map<String, Object> updates) {
        String path = "fraud_cases?id=eq." + caseId;
        return supabase.patch(path, updates, token, Map.class);
    }

    public List<Map<String, Object>> getAlerts(String token, String queryParams) {
        String path = "alerts?order=created_at.desc&limit=20" + (queryParams != null ? "&" + queryParams : "");
        return supabase.get(path, token, List.class);
    }

    public List<Map<String, Object>> getDashboardStats(String token) {
        String path = "transactions?select=status,risk_level,is_fraud,amount";
        return supabase.get(path, token, List.class);
    }

    public List<Map<String, Object>> getFraudRules(String token) {
        return supabase.get("fraud_rules?order=hit_count.desc", token, List.class);
    }
}
