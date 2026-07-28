package com.bank.frauddetection.supabase;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Component
public class SupabaseClient {

    private final RestTemplate restTemplate;
    private final String supabaseUrl;
    private final String anonKey;
    private final String serviceRoleKey;

    public SupabaseClient(RestTemplate restTemplate,
                          @Value("${supabase.url}") String supabaseUrl,
                          @Value("${supabase.anon-key}") String anonKey,
                          @Value("${supabase.service-role-key}") String serviceRoleKey) {
        this.restTemplate = restTemplate;
        this.supabaseUrl = supabaseUrl;
        this.anonKey = anonKey;
        this.serviceRoleKey = serviceRoleKey;
    }

    public String getSupabaseUrl() { return supabaseUrl; }
    public String getAnonKey() { return anonKey; }

    public HttpHeaders authHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("apikey", anonKey);
        if (token != null && !token.isEmpty()) {
            headers.setBearerAuth(token);
        }
        return headers;
    }

    public HttpHeaders serviceHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("apikey", serviceRoleKey);
        headers.setBearerAuth(serviceRoleKey);
        return headers;
    }

    public <T> T get(String path, String token, Class<T> responseType) {
        var entity = new HttpEntity<>(authHeaders(token));
        var resp = restTemplate.exchange(
            supabaseUrl + "/rest/v1/" + path,
            HttpMethod.GET, entity, responseType);
        return resp.getBody();
    }

    public <T, R> T post(String path, R body, String token, Class<T> responseType) {
        var entity = new HttpEntity<>(body, authHeaders(token));
        var resp = restTemplate.exchange(
            supabaseUrl + "/rest/v1/" + path,
            HttpMethod.POST, entity, responseType);
        return resp.getBody();
    }

    public <T, R> T patch(String path, R body, String token, Class<T> responseType) {
        var entity = new HttpEntity<>(body, authHeaders(token));
        var resp = restTemplate.exchange(
            supabaseUrl + "/rest/v1/" + path,
            HttpMethod.PATCH, entity, responseType);
        return resp.getBody();
    }

    public Map<String, Object> signInWithPassword(String email, String password) {
        var body = Map.of("email", email, "password", password);
        var entity = new HttpEntity<>(body, authHeaders(null));
        var resp = restTemplate.postForEntity(
            supabaseUrl + "/auth/v1/token?grant_type=password",
            entity, Map.class);
        return resp.getBody();
    }

    public Map<String, Object> getUser(String token) {
        var entity = new HttpEntity<>(authHeaders(token));
        var resp = restTemplate.exchange(
            supabaseUrl + "/auth/v1/user",
            HttpMethod.GET, entity, Map.class);
        return resp.getBody();
    }
}
