package com.bank.frauddetection.dto;

public class FraudDetectionResponse {

    private double fraudProbability;
    private double legitimateProbability;
    private boolean isFraud;
    private String riskLevel;

    public FraudDetectionResponse() {}

    public double getFraudProbability() { return fraudProbability; }
    public void setFraudProbability(double fraudProbability) { this.fraudProbability = fraudProbability; }
    public double getLegitimateProbability() { return legitimateProbability; }
    public void setLegitimateProbability(double legitimateProbability) { this.legitimateProbability = legitimateProbability; }
    public boolean isFraud() { return isFraud; }
    public void setFraud(boolean fraud) { isFraud = fraud; }
    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }
}
