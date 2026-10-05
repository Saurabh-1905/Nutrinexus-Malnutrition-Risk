# NutriNexus — Global Child Malnutrition Risk Prediction

Vercel-ready web application for the project's **Overall Malnutrition Risk** model.

## Included

- `api/index.py` — FastAPI API + frontend hosting
- `api/static/` — responsive frontend
- `api/malnutrition_risk_pipeline.joblib` — trained Risk pipeline
- `api/model_dataset.csv` — country-year feature lookup used to construct model inputs
- `requirements.txt` — Python dependencies

## Scope

The application predicts **country-year Overall Malnutrition Risk (Low / Moderate / High)** for the year following the selected reference year, using only country-year combinations present in the dataset. It is not an individual-child diagnosis.

The lower-accuracy Trend model is intentionally **not deployed**.

## Local test

From this folder:

```bash
pip install -r requirements.txt
uvicorn api.index:app --reload
```

Open `http://127.0.0.1:8000`.

API health check:

```text
GET /api/health
```

## Vercel

Push this folder to a GitHub repository and import the repository into Vercel. Vercel recognizes `api/index.py` as the FastAPI entrypoint. The frontend is mounted by FastAPI from `api/static/`, so the API and website use the same deployment.

No notebook or raw training datasets are required for the deployed application.

## Frontend

Single-page site in `api/static/` (Home, Predict, Methodology, About) with hash routing. No auth, database or build step. Country and year dropdowns are populated from `/api/countries` and `/api/years`. Optional photos: add `api/static/img/context.jpg` and `api/static/img/impact.jpg` (the slots stay as placeholders until then).
