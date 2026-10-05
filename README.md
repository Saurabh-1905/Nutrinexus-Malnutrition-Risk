# NutriNexus

NutriNexus is a full-stack web application that classifies child malnutrition risk (Low / Moderate / High) at the country-year level using a Random Forest pipeline trained on global indicator data. It serves the model through a FastAPI backend and a custom, framework-free frontend, and it only lets users query country-year combinations that exist in the dataset.

## Overview

Child malnutrition is hard to read from a single number. Stunting, wasting, underweight, food security, income, and access to water and sanitation all vary independently across countries and years. NutriNexus combines these population-level signals into one risk category.

The project integrates three child-growth indicator sources with FAOSTAT context variables into a country-year table. It engineers history-based features, trains a tree-ensemble classifier, and exposes the result through an API and an interactive site. The system works at the **country-year level. It is not an individual-child diagnosis tool** and gives no medical advice.

## Key Features

- **Dataset-driven inputs.** The country list comes from `/api/countries`, and the year list for a country comes from `/api/years`. Invalid combinations are rejected by the API with a 404, so the app cannot be asked about years it has no data for.
- **Next-year risk classification.** For a chosen reference year, the model returns the predicted risk class for the following year, along with all three class probabilities.
- **Interpretable output.** Results show the three class probabilities, the underlying indicator values, and a plain-language explanation. Missing values are displayed as "Not available" instead of being filled in.
- **Honest scoping.** The weaker secondary Trend model (about 57.78% test accuracy) is deliberately not deployed.
- **Custom frontend.** It is built with vanilla HTML, CSS and JavaScript and has no framework or build step. Features include hash-based routing, a rotating canvas globe drawn from real country geometry, scroll-triggered animation, keyboard-accessible tabs and `prefers-reduced-motion` support.
- **Simple deployment.** One FastAPI app serves both the API and the static site. There is no database, authentication or external service.

## Technical Stack

| Layer | Technologies |
| --- | --- |
| Language | Python, JavaScript, HTML, CSS |
| Backend | FastAPI, Pydantic, Uvicorn (local), CORS middleware |
| Data / ML | pandas, NumPy, scikit-learn, joblib |
| Frontend | Vanilla JS (Canvas API, IntersectionObserver, Fetch API), CSS Grid/Flexbox |
| Map data | Natural Earth geometry, pre-processed into static dot data |
| Hosting | Vercel (FastAPI entrypoint at `api/index.py`) |

## How It Works

1. The user picks a country. The frontend calls `GET /api/years?country=...` and fills the year dropdown with only the years found in `model_dataset.csv`.
2. The user submits the selection, and the frontend calls `POST /api/predict` with the country and year.
3. The backend looks up the exact country-year row and builds the 35-feature input in the order stored in the trained pipeline.
4. The scikit-learn pipeline imputes, selects features and classifies.
5. The API returns the risk class, per-class probabilities, the forecast year, and the indicator values. The frontend renders them.

## Algorithms / Methodology

- **Dataset.** The dataset has 272 country-year records covering 59 countries and reference years from 1988 to 2023. Stunting and wasting come from the UNICEF/WHO/World Bank Joint Child Malnutrition Estimates, and underweight from the WHO Global Health Observatory. FAOSTAT supplies undernourishment, GDP per capita (PPP), and drinking-water and sanitation access.
- **Target.** The risk score is the mean of stunting, wasting and underweight. The label is that score for the **following year**, binned into Low, Moderate and High (92, 93 and 87 records).
- **Feature engineering.** There are 35 input features: current indicators, FAOSTAT context, and history-based features such as lags, year-over-year deltas, rolling means and risk-score slopes.
- **Preprocessing and selection.** A single scikit-learn `Pipeline` applies median imputation with missing-value indicators, then `SelectFromModel` (a Random Forest with a median-importance threshold). This keeps 30 of the transformed features. Selection is fitted on training data only to avoid leakage.
- **Classifier.** A Random Forest with 500 trees, max depth 8, `min_samples_leaf=2`, and balanced class weights to handle class imbalance.
- **Evaluation.** The split is chronological rather than random. Time-aware cross-validation was used for model validation, and a held-out future period (cutoff 2018) served as the final test.

## Architecture / Project Structure

```text
NutriNexus/
├── api/
│   ├── index.py                          # FastAPI app: API routes + static hosting
│   ├── malnutrition_risk_pipeline.joblib # Trained sklearn pipeline
│   ├── model_dataset.csv                 # Country-year lookup table
│   └── static/
│       ├── index.html                    # Home, Predict, Methodology, About (hash-routed)
│       ├── styles.css
│       ├── app.js                        # Routing, API calls, rendering, globe
│       └── img/                          # Globe/map dot data and images
├── requirements.txt
└── README.md
```

API routes:

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Status and record count |
| `GET /api/countries` | Countries in the dataset |
| `GET /api/years?country=` | Available reference years for a country |
| `POST /api/predict` | Risk class and probabilities for a country-year |

The model and dataset are loaded once at startup. The static frontend is mounted after the API routes so `/api/*` takes precedence.

## Running the Project

```bash
git clone https://github.com/Saurabh-1905/Nutrinexus-Malnutrition-Risk.git
cd Nutrinexus-Malnutrition-Risk
pip install -r requirements.txt uvicorn
uvicorn api.index:app --reload
```

Open `http://127.0.0.1:8000`. The package versions in `requirements.txt` are pinned to match the environment the model was saved in.

To deploy, import the repository into Vercel. No build command or environment variables are needed.

## Results / Impact

On the held-out future test period (45 records, cutoff 2018), the primary risk model reported:

| Metric | Value |
| --- | --- |
| Accuracy | 93.33% (42 of 45 correct) |
| Balanced accuracy | 92.19% |
| Macro F1 | 92.67% |
| Macro ROC-AUC | 97.99% |
| Time-aware CV accuracy | 88.89% ± 6.09% |

These figures come from the project's training and evaluation work, which is not included in this repository. Training accuracy was 99.56%, so some overfitting is likely. The test set is small, so these results carry real uncertainty. They measure agreement with the dataset's own risk labels, not medical correctness.

## Future Improvements

- Add the training and evaluation notebook, plus a reproducible script, so results can be verified from the repo.
- Add feature-importance or SHAP-style explanations for each prediction.
- Add automated tests for the API and a CI check for dependency compatibility.
- Report calibration and per-class metrics, and test on larger or more recent data.
- Add a `LICENSE` and a screenshot or live demo link.

## Why This Project Matters

NutriNexus covers the whole path from raw data to a deployed service: merging data from several sources, building features on time-ordered data, evaluating with a chronological split to avoid leakage, and serving a sklearn pipeline through a validated API. It also shows careful product decisions: restricting inputs to real data, not deploying a weak model, and being explicit about scope and limitations.

## Author

**Saurabh** — B.Tech CSE (AI & Data Science)

GitHub: [Saurabh-1905](https://github.com/Saurabh-1905)
