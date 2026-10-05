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

## Deploying to Vercel

NutriNexus is a single FastAPI app: `api/index.py` serves both the `/api/*` routes and the static website, so one Vercel project hosts everything. No database, environment variables or build step are needed.

**How Vercel finds the app.** Vercel's Python runtime looks for an `app` object in a recognised entrypoint file (`index.py` inside `api/` is one) and installs dependencies from the root `requirements.txt`. Keep both of those as they are.

### Option A: Vercel dashboard

1. Push the repository to GitHub.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Leave the build and install commands empty and the root directory as `/`. The framework should be detected as FastAPI (or "Other").
4. Click **Deploy**.

Every later push to `main` redeploys automatically, and other branches get preview URLs.

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel          # preview deployment
vercel --prod   # production deployment
```

### Check the deployment

Open these on your deployed URL:

| URL | Expected |
| --- | --- |
| `/` | The NutriNexus website |
| `/api/health` | `{"status":"ok", ... "records":272}` |
| `/api/countries` | A list of 59 countries |
| `/api/years?country=Burundi` | Only the years that exist for that country |

Then pick a country and year on the Predict page and confirm a result appears.

### Troubleshooting

- **Build or import error mentioning scikit-learn:** the model was saved with the versions pinned in `requirements.txt`. Do not change `scikit-learn`, `numpy` or `joblib` without re-saving the model.
- **Function too large:** all Python dependencies ship in one bundle, and Vercel documents a size limit for it. Keep `requirements.txt` limited to the six packages listed and avoid adding heavy libraries.
- **Website loads but `/api/...` returns 404:** make sure the entrypoint is still `api/index.py` and the app variable is still named `app`.
- **Old page after a deploy:** hard-refresh the browser (Ctrl/Cmd+Shift+R) to bypass cached CSS and JavaScript.

No notebook or raw training datasets are required for the deployed application.

## Frontend

Single-page site in `api/static/` (Home, Predict, Methodology, About) with hash routing. No auth, database or build step. Country and year dropdowns are populated from `/api/countries` and `/api/years`. Images live in `api/static/img/`. `globe-dots.json` and `world-dots.svg` were generated from Natural Earth country geometry (teal = countries in `model_dataset.csv`).
