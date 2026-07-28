package com.bank.frauddetection.ml;

import com.bank.frauddetection.dto.FraudDetectionRequest;
import com.bank.frauddetection.dto.FraudDetectionResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class FraudDetectionClient {

    private final RestTemplate restTemplate;
    private final String mlServiceUrl;

    public FraudDetectionClient(RestTemplate restTemplate,
                                @Value("${ml.service.url:http://localhost:5001}") String mlServiceUrl) {
        this.restTemplate = restTemplate;
        this.mlServiceUrl = mlServiceUrl;
    }

    public FraudDetectionResponse predict(FraudDetectionRequest request) {
        String url = mlServiceUrl + "/predict";
        return restTemplate.postForObject(url, request, FraudDetectionResponse.class);
    }

    public boolean isHealthy() {
        try {
            var response = restTemplate.getForEntity(mlServiceUrl + "/health", String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            return false;
        }
    }
}
