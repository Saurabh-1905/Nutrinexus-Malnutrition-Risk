from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "malnutrition_risk_pipeline.joblib"
DATA_PATH = BASE_DIR / "model_dataset.csv"

app = FastAPI(title="Global Child Malnutrition Risk API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"]
)

model = joblib.load(MODEL_PATH)
data = pd.read_csv(DATA_PATH)

# The exact feature order is stored inside the trained sklearn pipeline.
MODEL_FEATURES = list(model.named_steps["imputer"].feature_names_in_)

data["Year"] = pd.to_numeric(data["Year"], errors="coerce")
data["Next_Year"] = pd.to_numeric(data["Next_Year"], errors="coerce")

data = data.replace([np.inf, -np.inf], np.nan)

class PredictionRequest(BaseModel):
    country: str = Field(min_length=1, max_length=100)
    year: int = Field(ge=1900, le=2100)


def clean_country(value: str) -> str:
    return " ".join(str(value).strip().split()).casefold()


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "model": "Overall Malnutrition Risk",
        "model_type": "Random Forest with training-only feature selection",
        "records": int(len(data)),
    }


@app.get("/api/countries")
def countries():
    countries = sorted(data["CountryName"].dropna().astype(str).unique().tolist())
    return {"countries": countries}


@app.get("/api/years")
def years(country: str):
    key = clean_country(country)
    subset = data[data["CountryName"].map(clean_country) == key]
    if subset.empty:
        raise HTTPException(status_code=404, detail="Country not found in the deployment dataset.")

    years = sorted(subset["Year"].dropna().astype(int).unique().tolist())
    return {"country": subset.iloc[0]["CountryName"], "years": years}


@app.post("/api/predict")
def predict(request: PredictionRequest):
    key = clean_country(request.country)
    subset = data[
        (data["CountryName"].map(clean_country) == key)
        & (data["Year"] == request.year)
    ].copy()

    if subset.empty:
        raise HTTPException(
            status_code=404,
            detail="That country-year combination is not available in the deployment dataset."
        )

    row = subset.iloc[0]
    X = pd.DataFrame([{feature: row.get(feature, np.nan) for feature in MODEL_FEATURES}])
    X = X.replace([np.inf, -np.inf], np.nan)

    prediction = model.predict(X)[0]
    probabilities = model.predict_proba(X)[0]
    probability_map = {
        str(label): round(float(probability) * 100, 2)
        for label, probability in zip(model.classes_, probabilities)
    }

    def number(name):
        value = row.get(name)
        if pd.isna(value):
            return None
        return round(float(value), 2)

    forecast_year = int(row["Next_Year"]) if not pd.isna(row["Next_Year"]) else request.year + 1

    return {
        "country": str(row["CountryName"]),
        "reference_year": int(request.year),
        "forecast_year": forecast_year,
        "risk": str(prediction),
        "probabilities": probability_map,
        "indicators": {
            "stunting": number("Stunting"),
            "wasting": number("Wasting"),
            "underweight": number("Underweight"),
        },
        "context": {
            "undernourishment_3yr": number("FAO_Undernourishment_3yr"),
            "gdp_ppp": number("FAO_GDP_PPP"),
            "basic_water": number("FAO_BasicWater"),
            "basic_sanitation": number("FAO_BasicSanitation"),
        },
        "scope": "Country-year level prediction; not an individual-child diagnosis.",
    }

# Static frontend is mounted after API routes so /api/* keeps API precedence.
app.mount("/", StaticFiles(directory=BASE_DIR / "static", html=True), name="frontend")
