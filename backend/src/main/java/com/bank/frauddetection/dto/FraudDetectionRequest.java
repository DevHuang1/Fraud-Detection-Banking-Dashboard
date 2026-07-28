package com.bank.frauddetection.dto;

public class FraudDetectionRequest {

    private int step;
    private String type;
    private double amount;
    private double oldbalanceOrg;
    private double newbalanceOrig;
    private double oldbalanceDest;
    private double newbalanceDest;
    private int isFlaggedFraud;

    public FraudDetectionRequest() {}

    public FraudDetectionRequest(int step, String type, double amount,
                                  double oldbalanceOrg, double newbalanceOrig,
                                  double oldbalanceDest, double newbalanceDest,
                                  int isFlaggedFraud) {
        this.step = step;
        this.type = type;
        this.amount = amount;
        this.oldbalanceOrg = oldbalanceOrg;
        this.newbalanceOrig = newbalanceOrig;
        this.oldbalanceDest = oldbalanceDest;
        this.newbalanceDest = newbalanceDest;
        this.isFlaggedFraud = isFlaggedFraud;
    }

    public int getStep() { return step; }
    public void setStep(int step) { this.step = step; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public double getAmount() { return amount; }
    public void setAmount(double amount) { this.amount = amount; }
    public double getOldbalanceOrg() { return oldbalanceOrg; }
    public void setOldbalanceOrg(double oldbalanceOrg) { this.oldbalanceOrg = oldbalanceOrg; }
    public double getNewbalanceOrig() { return newbalanceOrig; }
    public void setNewbalanceOrig(double newbalanceOrig) { this.newbalanceOrig = newbalanceOrig; }
    public double getOldbalanceDest() { return oldbalanceDest; }
    public void setOldbalanceDest(double oldbalanceDest) { this.oldbalanceDest = oldbalanceDest; }
    public double getNewbalanceDest() { return newbalanceDest; }
    public void setNewbalanceDest(double newbalanceDest) { this.newbalanceDest = newbalanceDest; }
    public int getIsFlaggedFraud() { return isFlaggedFraud; }
    public void setIsFlaggedFraud(int isFlaggedFraud) { this.isFlaggedFraud = isFlaggedFraud; }
}
