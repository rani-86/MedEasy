# Medeasy ML Inference Service (FastAPI)

**Status: not yet scaffolded.**

The architecture for this service is fully specified in [`docs/ml-architecture.md`](../../docs/ml-architecture.md) — datasets, features, models, training pipeline, FastAPI service structure, REST API contracts, and deployment strategy.

## To scaffold this service

```bash
cd apps/ml-service
python -m venv venv && source venv/bin/activate
pip install fastapi uvicorn mlflow lightgbm pandas pydantic
```

Then build out `app/main.py`, `app/routers/`, and `app/model_registry.py` per Sections 5–6 of the ML architecture doc. This is intentionally last in the build order — it needs real usage data from the backend/frontend in production before the v2 models described in the doc have anything meaningful to train on. The v1 rule-based logic for Queue Prediction and Recommendation already lives in the Node.js backend (see `backend-architecture.md`) and needs no Python service to function.
