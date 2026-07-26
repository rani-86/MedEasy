# Medeasy — ML Architecture

**Version:** 1.0
**Companion to:** Medeasy PRD, System Architecture, PostgreSQL Schema, Backend & Frontend Architecture docs
**Status:** Draft for Engineering Review
**Date:** July 2026

> **Scope note:** The PRD and System Architecture docs deliberately scope Queue Prediction and the Recommendation Engine as **rule-based/statistical for v1**, with ML upgrades planned once sufficient usage data exists. This document specifies that v2 ML architecture — it's the target state to build toward once the v1 statistical baselines (already shipped per the earlier docs) have accumulated enough historical data to train on. Bed Availability Prediction and Inventory Demand Forecasting are new v2-scope capabilities not covered in the original MVP.

---

## 1. Datasets

| Model | Source tables (from PostgreSQL schema) | Supplementary sources | Approx. granularity needed before training |
|---|---|---|---|
| **Queue Wait Time Prediction** | `appointments` (slot_start, slot_end, status, queue_position), `doctors` (avg_consult_minutes, specialty), `bed_admissions` (for context on admitted vs walk-in load) | Live check-in events, doctor break/delay events (from event bus) | 3+ months of appointment history per doctor, minimum ~500 completed consults/doctor |
| **Bed Availability Prediction** | `beds` (status, category, updated_at — sampled as a time series), `bed_admissions` (admitted_at, discharged_at), `appointments` (to correlate OPD volume with admission likelihood) | Seasonal/calendar features (day of week, local holidays, flu season flags) | 6+ months of bed status history per hospital per category |
| **Hospital Recommendation Engine** | `hospitals`, `doctors` (ratings), `appointments` (booking outcomes), `beds` (historical availability at time of past searches) | Search/click/booking interaction logs (need a new `search_events` table — see below), patient rating/review data | 2+ months of interaction logs with sufficient search volume across hospitals |
| **Inventory Demand Forecasting** | `inventory_items` (current_stock, category over time — sampled), `purchase_orders`, `appointments`/`prescriptions` (procedure/medicine usage correlation) | Seasonal illness trend data (e.g. regional flu/dengue season signals), supplier lead-time history | 6+ months of consumption history per item per hospital |

### New supporting table required: `search_events`
```sql
CREATE TABLE search_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID REFERENCES patient_profiles(id),
    query_specialty VARCHAR(100),
    query_lat       NUMERIC(9,6),
    query_lng       NUMERIC(9,6),
    is_emergency    BOOLEAN NOT NULL DEFAULT FALSE,
    results_shown   JSONB NOT NULL,   -- [{hospitalId, rank, score}]
    clicked_hospital_id UUID REFERENCES hospitals(id),
    booked_hospital_id  UUID REFERENCES hospitals(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
This table doesn't exist in the v1 transactional schema — it's a purpose-built log for training the Recommendation Engine's ranking model (click-through and booking-conversion are the primary learning signals).

### Data pipeline for training data
- Nightly ETL job (Airflow) extracts from PostgreSQL read replicas → writes to a feature-store-friendly format (Parquet on object storage) → avoids ever running heavy training queries against the transactional database.
- TimescaleDB (already in the architecture for analytics) is the natural source for anything time-series-shaped: bed occupancy history, queue wait patterns, inventory consumption trends.

---

## 2. Features

### 2.1 Queue Wait Time Prediction
| Feature | Type | Source |
|---|---|---|
| `patients_ahead` | numeric | live queue state (Redis) |
| `doctor_avg_consult_minutes_30d` | numeric | rolling window over `appointments` |
| `doctor_consult_variance` | numeric | stddev of actual vs scheduled duration |
| `time_of_day_bucket` | categorical | derived from `slot_start` |
| `day_of_week` | categorical | derived from `slot_start` |
| `department` | categorical | `doctors.specialty` |
| `is_doctor_currently_delayed` | boolean | live event flag |
| `hospital_current_load_ratio` | numeric | today's bookings / typical daily bookings for this hospital |

### 2.2 Bed Availability Prediction
| Feature | Type | Source |
|---|---|---|
| `current_occupancy_ratio` | numeric | live `beds` status snapshot |
| `avg_length_of_stay_by_category_30d` | numeric | `bed_admissions` (discharged_at − admitted_at) |
| `admissions_last_24h` | numeric | rolling count |
| `discharges_expected_today` | numeric | derived from LOS distribution of currently admitted patients |
| `day_of_week`, `is_holiday` | categorical | calendar |
| `department_opd_volume_trend` | numeric | correlates OPD surge with admission likelihood |
| `seasonal_illness_flag` | boolean | external signal (flu/dengue season) |

### 2.3 Hospital Recommendation Engine
| Feature | Type | Source |
|---|---|---|
| `distance_km` | numeric | haversine(patient location, hospital location) |
| `specialty_match_score` | numeric | text/category match between query and hospital departments |
| `hospital_rating_avg` | numeric | `hospitals.rating_avg` |
| `doctor_rating_avg` | numeric | `doctors.rating_avg` (if doctor-level search) |
| `live_bed_availability_flag` | boolean | Redis live-state mirror |
| `historical_ctr_for_hospital` | numeric | learned from `search_events` |
| `historical_booking_conversion` | numeric | learned from `search_events` |
| `patient_past_hospital_visits` | numeric | personalization signal from `appointments` history |
| `price_fit_score` | numeric | if patient set a budget preference |
| `is_emergency_query` | boolean | context flag — changes feature weighting at inference |

### 2.4 Inventory Demand Forecasting
| Feature | Type | Source |
|---|---|---|
| `item_consumption_7d_avg`, `_30d_avg` | numeric | rolling windows over stock deduction events |
| `department_opd_volume` | numeric | correlates procedure volume with consumable usage |
| `day_of_week`, `month`, `is_holiday_season` | categorical | calendar/seasonality |
| `days_to_expiry` | numeric | `inventory_items.expiry_date` |
| `supplier_avg_lead_time_days` | numeric | historical `purchase_orders` fulfillment time |
| `current_stock_ratio` | numeric | current_stock / reorder_threshold |
| `regional_illness_trend_flag` | boolean | external signal (correlates e.g. IV fluids demand with dengue season) |

---

## 3. Models

| Model | Algorithm (v2 target) | Why |
|---|---|---|
| **Queue Wait Time Prediction** | Gradient-boosted regression (LightGBM) | Tabular, mixed categorical/numeric features, needs fast inference (<50ms), handles non-linear doctor-variance patterns well; interpretable via feature importance for the "why is my wait longer" explanation |
| **Bed Availability Prediction** | Time-series forecasting: Prophet or LightGBM-with-lag-features per (hospital, category) pair | Occupancy is inherently a time series with weekly/seasonal patterns; Prophet handles holiday effects and seasonality natively with less tuning, LightGBM alternative if more exogenous features are needed |
| **Hospital Recommendation Engine** | Learning-to-Rank (LightGBM Ranker / LambdaMART) over the v1 rule-based candidate set | Reframes the v1 weighted-scoring formula as a learned ranking function trained on click/booking signals — keeps the same candidate-generation step (Elasticsearch geo+specialty filter) but replaces hand-tuned weights with learned ones |
| **Inventory Demand Forecasting** | Per-item time-series forecasting: LightGBM with lag/rolling features, or SARIMA for high-volume stable-demand items | Demand forecasting is well-served by gradient boosting with lag features for irregular-demand items (most medicines), with a simpler SARIMA fallback for high-volume, stable-pattern items (e.g. routine consumables) |

**Common design principle across all four models:** every model is trained and served as a **fallback-safe advisory layer** — none of them sit in the write path of a transaction. If a model is unavailable or returns low confidence, the system falls back to the v1 rule-based/statistical logic already described in the System Architecture doc, never to a hard failure.

---

## 4. Training Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│  Airflow DAG (nightly, per model)                                │
│                                                                    │
│  1. Extract   → pull from Postgres read replica / TimescaleDB    │
│  2. Transform → feature engineering (pandas/Polars), write to    │
│                  Parquet feature store (S3-compatible object     │
│                  storage), versioned by date                      │
│  3. Validate  → data quality checks (Great Expectations):        │
│                  null rates, distribution drift vs prior window   │
│  4. Train     → LightGBM/Prophet training job (containerized,    │
│                  runs on a scheduled compute pool, not always-on) │
│  5. Evaluate  → holdout set metrics (MAE for regression, NDCG    │
│                  for ranking) compared against currently-deployed │
│                  model version                                    │
│  6. Register  → if metrics improve (or don't regress beyond a    │
│                  tolerance), register new model version in a      │
│                  model registry (MLflow)                          │
│  7. Deploy    → canary rollout (see Section 7)                    │
└─────────────────────────────────────────────────────────────────┘
```

### 4.1 Retraining cadence
| Model | Cadence | Rationale |
|---|---|---|
| Queue Wait Time | Nightly (incremental) | Doctor patterns shift week to week; cheap to retrain (small per-doctor datasets) |
| Bed Availability | Weekly | Slower-moving seasonal patterns; daily retraining adds little value |
| Recommendation Ranking | Weekly, with a lightweight online feature refresh (live bed/rating signals) daily | Ranking model itself is stable; the live features it consumes (bed availability) update independently at request time |
| Inventory Demand | Weekly, per hospital | Consumption patterns are seasonal; weekly retraining balances freshness against compute cost |

### 4.2 Experiment tracking & reproducibility
- **MLflow** tracks every training run: hyperparameters, feature set version, evaluation metrics, and the resulting model artifact.
- Feature engineering code is versioned alongside the model (same git repo, tagged release) so a registered model always has a reproducible, matching feature-computation function used at inference time — avoiding train/serve skew.

---

## 5. FastAPI Service

A single **ML Inference Service** (Python/FastAPI) serves all four models — chosen over four separate services at this scale to reduce operational overhead, since all four are read-only, low-QPS-relative-to-core-transactional-traffic, and share the same deployment/monitoring pattern. Internally organized as one router per model for a clean split-out path later if any one model's traffic profile diverges enough to warrant its own service.

```python
# app/main.py
from fastapi import FastAPI
from app.routers import queue_prediction, bed_prediction, recommendation, inventory_forecast
from app.middleware.logging import RequestLoggingMiddleware

app = FastAPI(title="Medeasy ML Inference Service", version="1.0.0")
app.add_middleware(RequestLoggingMiddleware)

app.include_router(queue_prediction.router, prefix="/v1/queue", tags=["queue"])
app.include_router(bed_prediction.router, prefix="/v1/beds", tags=["beds"])
app.include_router(recommendation.router, prefix="/v1/recommendations", tags=["recommendations"])
app.include_router(inventory_forecast.router, prefix="/v1/inventory", tags=["inventory"])

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/ready")
def ready():
    # checks that all model artifacts are loaded in memory
    from app.model_registry import registry
    return {"models_loaded": registry.all_loaded()}
```

```python
# app/routers/queue_prediction.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.model_registry import registry

router = APIRouter()

class QueuePredictionRequest(BaseModel):
    doctor_id: str
    patients_ahead: int = Field(ge=0)
    time_of_day_bucket: str
    day_of_week: str
    is_doctor_currently_delayed: bool = False

class QueuePredictionResponse(BaseModel):
    predicted_wait_minutes: float
    confidence: float
    model_version: str
    fallback_used: bool = False

@router.post("/predict", response_model=QueuePredictionResponse)
def predict_wait_time(payload: QueuePredictionRequest):
    model = registry.get("queue_wait_time")
    if model is None:
        raise HTTPException(status_code=503, detail="Model unavailable — caller should use statistical fallback")

    features = model.build_features(payload)
    prediction, confidence = model.predict(features)
    return QueuePredictionResponse(
        predicted_wait_minutes=round(prediction, 1),
        confidence=confidence,
        model_version=model.version,
    )
```

```python
# app/model_registry.py
import mlflow
import threading

class ModelRegistry:
    def __init__(self):
        self._models = {}
        self._lock = threading.Lock()

    def load_all(self):
        with self._lock:
            self._models["queue_wait_time"] = mlflow.pyfunc.load_model("models:/queue_wait_time/Production")
            self._models["bed_availability"] = mlflow.pyfunc.load_model("models:/bed_availability/Production")
            self._models["hospital_ranking"] = mlflow.pyfunc.load_model("models:/hospital_ranking/Production")
            self._models["inventory_demand"] = mlflow.pyfunc.load_model("models:/inventory_demand/Production")

    def get(self, name: str):
        return self._models.get(name)

    def all_loaded(self) -> bool:
        return len(self._models) == 4

    def hot_swap(self, name: str, new_model):
        with self._lock:
            self._models[name] = new_model  # atomic reference swap, no request-blocking reload

registry = ModelRegistry()
```

**Design points:**
- Models are loaded into memory at startup (`/ready` gates traffic until loaded) — no per-request model file I/O.
- `hot_swap` allows deploying a newly-trained model version without restarting the service (a background poller checks the model registry for a new "Production" tag and swaps the in-memory reference).
- Every response includes `model_version` and `confidence` — the consuming service (e.g. Queue Prediction Service in the Node backend) uses `confidence` to decide whether to trust the ML prediction or fall back to the v1 statistical formula.

---

## 6. REST APIs

| Endpoint | Method | Purpose | Consumed by |
|---|---|---|---|
| `/v1/queue/predict` | POST | Predict wait time for a given queue position + doctor context | Node.js Queue Prediction Service (event consumer) |
| `/v1/beds/forecast` | GET | Forecast bed availability for a hospital/category over the next N hours | Node.js Bed Management Service, Recommendation Service |
| `/v1/beds/forecast/batch` | POST | Batch forecast across multiple hospitals (used by Recommendation Engine for candidate scoring) | Recommendation Service |
| `/v1/recommendations/rank` | POST | Re-rank a candidate hospital list (from Elasticsearch) using the learned ranking model | Node.js Recommendation Service |
| `/v1/inventory/forecast` | GET | Forecast demand for a specific item over the next N days | Node.js Inventory Service (reorder decision logic) |
| `/v1/inventory/forecast/batch` | POST | Batch forecast for all items in a hospital (used by nightly reorder-alert job) | Inventory Service scheduled job |
| `/health`, `/ready` | GET | Liveness/readiness probes | Kubernetes |

**Example — recommendation ranking contract:**
```python
# app/routers/recommendation.py
class RankingCandidate(BaseModel):
    hospital_id: str
    distance_km: float
    specialty_match_score: float
    hospital_rating_avg: float
    live_bed_availability: bool

class RankRequest(BaseModel):
    patient_id: str | None = None  # optional, enables personalization features
    is_emergency: bool = False
    candidates: list[RankingCandidate]

class RankedResult(BaseModel):
    hospital_id: str
    score: float
    rank: int

@router.post("/rank", response_model=list[RankedResult])
def rank_hospitals(payload: RankRequest):
    model = registry.get("hospital_ranking")
    if model is None or len(payload.candidates) == 0:
        raise HTTPException(status_code=503, detail="Ranking unavailable — caller should use v1 weighted scoring")

    scored = model.score(payload.candidates, personalize_for=payload.patient_id, emergency=payload.is_emergency)
    ranked = sorted(scored, key=lambda x: x.score, reverse=True)
    return [RankedResult(hospital_id=r.hospital_id, score=r.score, rank=i + 1) for i, r in enumerate(ranked)]
```

**Contract convention:** the ML service never does its own candidate generation or geo-filtering — it only re-scores/ranks a candidate set the Node.js Recommendation Service already assembled via Elasticsearch. This keeps the ML service stateless and cheap to scale, and keeps the "what hospitals exist and are structurally eligible" logic in one place (the Node service), not duplicated across two languages.

---

## 7. Deployment Strategy

```
                    ┌───────────────────────────┐
                    │   Node.js Backend Services  │
                    │  (Queue/Bed/Inventory/Rec.)  │
                    └──────────────┬─────────────┘
                                   │ internal HTTP (service mesh)
                    ┌──────────────▼─────────────┐
                    │   ML Inference Service        │
                    │   (FastAPI, K8s Deployment)   │
                    │   - HPA: min 2, scales on CPU │
                    │     + request latency          │
                    └──────────────┬─────────────┘
                                   │
                    ┌──────────────▼─────────────┐
                    │   Model Registry (MLflow)     │
                    │   + Artifact store (S3-compat)│
                    └──────────────┬─────────────┘
                                   │
                    ┌──────────────▼─────────────┐
                    │   Training Pipeline (Airflow) │
                    │   - runs on separate compute   │
                    │     pool, not the serving pods │
                    └───────────────────────────┘
```

### 7.1 Isolation from the transactional path
- The ML Inference Service is called **only** from Node.js domain services, never directly from client apps — this matches the System Architecture doc's principle that intelligence services are advisory and decoupled from the booking/bed critical path.
- Every caller implements a timeout (e.g. 200ms) + circuit breaker around ML service calls; on timeout, breaker-open, or low-confidence response, the caller falls back to the v1 rule-based logic already in production. The ML layer can be entirely down without breaking core functionality.

### 7.2 Rollout strategy
- **Canary deployment per model**, independent of the other three — a new `queue_wait_time` model version can roll out without touching `hospital_ranking`.
- Canary process: new model version tagged "Staging" in MLflow → 5% of inference traffic routed to it (via a feature flag read by the Node caller, or an internal weighted router) → compare live prediction error / ranking CTR against the "Production" model over a defined window → promote to "Production" tag (triggers `hot_swap` in the registry) or roll back.
- **Shadow mode** for the first deployment of a genuinely new model (e.g. first-ever Bed Availability model, since there's no prior ML version to compare against): predictions are computed and logged but not surfaced to users, compared against actual outcomes for 1–2 weeks before going live.

### 7.3 Monitoring
- **Prediction drift:** track feature distribution of live inference requests vs. training data distribution (via Evidently or a custom job) — alerts if drift exceeds threshold, flagging a need for retraining.
- **Model performance:** for Queue Wait Time and Bed Availability, log predicted vs. actual outcomes (once the actual wait/occupancy is known) into TimescaleDB, feeding a rolling MAE dashboard in the existing Analytics Service.
- **Latency/availability:** standard Prometheus + Grafana metrics on the FastAPI service (p50/p95/p99 latency, error rate) — these feed the circuit breakers in the Node.js callers.
- **Fallback rate:** explicitly tracked metric — what fraction of requests fell back to rule-based logic (due to timeout, low confidence, or model unavailability). A rising fallback rate is an early signal of ML service degradation before it shows up as a user-facing issue.

### 7.4 Environments
- `staging` mirrors `prod` model registry structure at reduced scale; new models are always validated in staging against a replayed traffic sample before any production canary.
- Training pipeline (Airflow) runs in an isolated environment with read-replica-only database access — it never has write access to production data and never runs on the same compute pool as the serving FastAPI pods, so a runaway training job can't degrade inference latency.

---

*End of Document*
