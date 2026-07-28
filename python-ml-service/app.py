import joblib
import numpy as np
import pandas as pd
import keras
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import os

app = FastAPI(title="Fraud Detection ML Service", version="1.0.0")

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.h5")
PREPROCESSOR_DIR = os.path.join(os.path.dirname(__file__), "preprocessor")

model = None
scaler = None
label_encoder = None

FEATURE_COLS = [
    "step", "type_encoded", "amount", "oldbalanceOrg",
    "newbalanceOrig", "oldbalanceDest", "newbalanceDest", "isFlaggedFraud",
]

TYPE_MAP = {"CASH_IN": 0, "CASH_OUT": 1, "DEBIT": 2, "PAYMENT": 3, "TRANSFER": 4}


class Transaction(BaseModel):
    step: int
    type: str
    amount: float
    oldbalanceOrg: float
    newbalanceOrig: float
    oldbalanceDest: float
    newbalanceDest: float
    isFlaggedFraud: Optional[int] = 0


class PredictionResponse(BaseModel):
    fraud_probability: float
    legitimate_probability: float
    is_fraud: bool
    risk_level: str


@app.on_event("startup")
def load_artifacts():
    global model, scaler, label_encoder
    model = keras.models.load_model(MODEL_PATH)
    scaler = joblib.load(os.path.join(PREPROCESSOR_DIR, "scaler.pkl"))
    label_encoder = joblib.load(os.path.join(PREPROCESSOR_DIR, "label_encoder.pkl"))


@app.get("/health")
def health():
    return {"status": "healthy", "model_loaded": model is not None}


@app.post("/predict", response_model=PredictionResponse)
def predict(tx: Transaction):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    if tx.type not in TYPE_MAP:
        raise HTTPException(status_code=400, detail=f"Invalid type: {tx.type}. Must be one of {list(TYPE_MAP.keys())}")

    type_encoded = TYPE_MAP[tx.type]
    raw = [[tx.step, type_encoded, tx.amount, tx.oldbalanceOrg,
            tx.newbalanceOrig, tx.oldbalanceDest, tx.newbalanceDest, tx.isFlaggedFraud]]
    df = pd.DataFrame(raw, columns=FEATURE_COLS)
    scaled = scaler.transform(df)

    probs = model.predict(scaled, verbose=0)[0]
    fraud_prob = float(probs[1])
    legit_prob = float(probs[0])

    if fraud_prob >= 0.7:
        risk_level = "HIGH"
    elif fraud_prob >= 0.4:
        risk_level = "MEDIUM"
    elif fraud_prob >= 0.2:
        risk_level = "LOW"
    else:
        risk_level = "MINIMAL"

    return PredictionResponse(
        fraud_probability=round(fraud_prob, 6),
        legitimate_probability=round(legit_prob, 6),
        is_fraud=fraud_prob >= 0.5,
        risk_level=risk_level,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
