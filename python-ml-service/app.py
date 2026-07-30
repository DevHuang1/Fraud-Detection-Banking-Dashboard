import joblib
import numpy as np
import pandas as pd
import keras
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os

# ── Hugging Face Transformers ──────────────────────────────────
TRANSFORMER_AVAILABLE = False
try:
    from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
    TRANSFORMER_AVAILABLE = True
except ImportError:
    pass

app = FastAPI(title="Fraud Detection ML Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.h5")
PREPROCESSOR_DIR = os.path.join(os.path.dirname(__file__), "preprocessor")

model = None
scaler = None
label_encoder = None
transformer_pipeline = None

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


class TransactionText(BaseModel):
    transaction_id: Optional[str] = ""
    amount: float
    merchant: Optional[str] = "Unknown"
    merchant_category: Optional[str] = ""
    transaction_type: Optional[str] = "purchase"
    channel: Optional[str] = "online"
    region: Optional[str] = "Unknown"
    country: Optional[str] = ""
    risk_score: Optional[float] = 0.0
    risk_level: Optional[str] = "low"


class PredictionResponse(BaseModel):
    fraud_probability: float
    legitimate_probability: float
    is_fraud: bool
    risk_level: str


class TransformerResponse(BaseModel):
    fraud_probability: float
    risk_score: float
    risk_level: str
    model: str


@app.on_event("startup")
def load_artifacts():
    global model, scaler, label_encoder, transformer_pipeline

    # Keras model
    if os.path.exists(MODEL_PATH):
        try:
            model = keras.models.load_model(MODEL_PATH)
            scaler = joblib.load(os.path.join(PREPROCESSOR_DIR, "scaler.pkl"))
            label_encoder = joblib.load(os.path.join(PREPROCESSOR_DIR, "label_encoder.pkl"))
            print("[ml] Keras model loaded")
        except Exception as e:
            print(f"[ml] Keras load failed: {e}")

    # Hugging Face transformer
    if TRANSFORMER_AVAILABLE:
        try:
            model_name = "distilbert-base-uncased"
            tokenizer = AutoTokenizer.from_pretrained(model_name)
            hf_model = AutoModelForSequenceClassification.from_pretrained(model_name, num_labels=2)
            transformer_pipeline = pipeline(
                "text-classification",
                model=hf_model,
                tokenizer=tokenizer,
            )
            print(f"[ml] HF transformer loaded: {model_name}")
        except Exception as e:
            print(f"[ml] HF transformer load failed: {e}")


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "keras_model_loaded": model is not None,
        "transformer_loaded": transformer_pipeline is not None,
    }


@app.post("/predict", response_model=PredictionResponse)
def predict(tx: Transaction):
    """Keras-based fraud prediction (original endpoint)."""
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
        risk_level = "critical"
    elif fraud_prob >= 0.4:
        risk_level = "high"
    elif fraud_prob >= 0.2:
        risk_level = "medium"
    else:
        risk_level = "low"

    return PredictionResponse(
        fraud_probability=round(fraud_prob, 6),
        legitimate_probability=round(legit_prob, 6),
        is_fraud=fraud_prob >= 0.5,
        risk_level=risk_level,
    )


@app.post("/predict-transformer", response_model=TransformerResponse)
def predict_transformer(tx: TransactionText):
    """Hugging Face transformer-based fraud prediction from transaction text."""
    if transformer_pipeline is None:
        raise HTTPException(status_code=503, detail="Transformer model not loaded")

    text = (
        f"Transaction of ${tx.amount:.2f}. "
        f"Type: {tx.transaction_type}. "
        f"Merchant: {tx.merchant} ({tx.merchant_category}). "
        f"Channel: {tx.channel}. "
        f"Region: {tx.region}, {tx.country}."
    )

    try:
        result = transformer_pipeline(text, return_all_scores=False)
        if result and isinstance(result, list):
            score = result[0]
            # Model outputs LABEL_0 (legitimate) / LABEL_1 (fraud)
            if score["label"].lower() in ("label_1", "fraud"):
                fraud_prob = float(score["score"])
            else:
                fraud_prob = 1.0 - float(score["score"])
        else:
            fraud_prob = 0.05
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transformer inference failed: {e}")

    risk_score = round(fraud_prob * 100, 2)
    if risk_score >= 70:
        risk_level = "critical"
    elif risk_score >= 40:
        risk_level = "high"
    elif risk_score >= 15:
        risk_level = "medium"
    else:
        risk_level = "low"

    return TransformerResponse(
        fraud_probability=round(fraud_prob, 6),
        risk_score=risk_score,
        risk_level=risk_level,
        model="distilbert-base-uncased",
    )


@app.post("/predict-ensemble")
def predict_ensemble(keras_tx: Transaction, text_tx: TransactionText):
    """
    Ensemble prediction: combines Keras model (tabular) + HF transformer (text).
    Weight: 60% Keras, 40% Transformer.
    """
    # Keras prediction
    if model is None:
        raise HTTPException(status_code=503, detail="Keras model not loaded")
    if keras_tx.type not in TYPE_MAP:
        raise HTTPException(status_code=400, detail=f"Invalid type: {keras_tx.type}")

    type_encoded = TYPE_MAP[keras_tx.type]
    raw = [[keras_tx.step, type_encoded, keras_tx.amount, keras_tx.oldbalanceOrg,
            keras_tx.newbalanceOrig, keras_tx.oldbalanceDest, keras_tx.newbalanceDest,
            keras_tx.isFlaggedFraud]]
    df = pd.DataFrame(raw, columns=FEATURE_COLS)
    scaled = scaler.transform(df)
    probs = model.predict(scaled, verbose=0)[0]
    keras_prob = float(probs[1])

    # Transformer prediction
    transformer_prob = 0.05
    if transformer_pipeline is not None:
        text = (
            f"Transaction of ${text_tx.amount:.2f}. "
            f"Type: {text_tx.transaction_type}. "
            f"Merchant: {text_tx.merchant}. "
            f"Channel: {text_tx.channel}. "
            f"Region: {text_tx.region}."
        )
        try:
            result = transformer_pipeline(text, return_all_scores=False)
            if result and isinstance(result, list):
                score = result[0]
                if score["label"].lower() in ("label_1", "fraud"):
                    transformer_prob = float(score["score"])
                else:
                    transformer_prob = 1.0 - float(score["score"])
        except Exception:
            pass

    # Weighted ensemble
    ensemble_prob = 0.6 * keras_prob + 0.4 * transformer_prob
    risk_score = round(ensemble_prob * 100, 2)

    if risk_score >= 70:
        risk_level = "critical"
    elif risk_score >= 40:
        risk_level = "high"
    elif risk_score >= 15:
        risk_level = "medium"
    else:
        risk_level = "low"

    return {
        "fraud_probability": round(ensemble_prob, 6),
        "keras_probability": round(keras_prob, 6),
        "transformer_probability": round(transformer_prob, 6),
        "risk_score": risk_score,
        "risk_level": risk_level,
        "is_fraud": ensemble_prob >= 0.5,
    }


# ── Supabase Proxy Endpoints ──────────────────────────────────────
SUPABASE_URL = "https://cllohfvwvhfncgihrnvx.supabase.co"
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
SUPABASE_HEADERS = {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"}

if not SUPABASE_SERVICE_KEY:
    print("[warn] SUPABASE_SERVICE_KEY not set — proxy endpoints disabled")


@app.get("/api/stats")
def proxy_stats():
    """Return aggregated dashboard stats (paginates through all rows)."""
    if not SUPABASE_SERVICE_KEY:
        raise HTTPException(503, "Service key not configured")
    try:
        offset = 0
        page_size = 1000
        txs = []
        while True:
            r = requests.get(f"{SUPABASE_URL}/rest/v1/transactions", headers=SUPABASE_HEADERS,
                params={"select": "status,risk_level,is_fraud,is_suspicious,risk_score,amount",
                        "limit": page_size, "offset": offset})
            page = r.json()
            if not page:
                break
            txs.extend(page)
            offset += page_size
            if len(page) < page_size:
                break

        total = len(txs)
        suspicious = sum(1 for t in txs if t.get("is_suspicious"))
        confirmed = sum(1 for t in txs if t.get("is_fraud"))
        blocked = sum(1 for t in txs if t.get("status") == "blocked")
        high_risk = sum(1 for t in txs if t.get("risk_level") in ("high", "critical"))
        avg_risk = round(sum(t.get("risk_score", 0) or 0 for t in txs) / max(total, 1), 2)
        fraud_rate = round(confirmed / max(total, 1) * 100, 2)

        offset2 = 0
        unread = 0
        while True:
            r2 = requests.get(f"{SUPABASE_URL}/rest/v1/alerts", headers=SUPABASE_HEADERS,
                params={"select": "id", "is_read": "eq.false", "limit": page_size, "offset": offset2})
            page2 = r2.json()
            if not page2:
                break
            unread += len(page2)
            offset2 += page_size
            if len(page2) < page_size:
                break

        return {"totalTransactions": total, "suspiciousTransactions": suspicious,
                "confirmedFraud": confirmed, "blockedAttempts": blocked,
                "avgRiskScore": avg_risk, "highRiskAccounts": high_risk,
                "fraudRate": fraud_rate, "unreadAlerts": unread}
    except Exception as e:
        raise HTTPException(500, f"Stats proxy failed: {e}")


@app.get("/api/transactions")
def proxy_transactions(limit: int = 100, offset: int = 0):
    """Return transactions page (uses service_role key)."""
    if not SUPABASE_SERVICE_KEY:
        raise HTTPException(503, "Service key not configured")
    try:
        r = requests.get(f"{SUPABASE_URL}/rest/v1/transactions", headers={
            **SUPABASE_HEADERS, "Prefer": "count=exact"
        }, params={"select": "*", "order": "timestamp.desc",
                    "limit": limit, "offset": offset})
        data = r.json()
        cr = r.headers.get("content-range", "*/0")
        total = int(cr.split("/")[1]) if "/" in cr else len(data)
        return {"data": data, "total": total, "limit": limit, "offset": offset}
    except Exception as e:
        raise HTTPException(500, f"Transactions proxy failed: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
