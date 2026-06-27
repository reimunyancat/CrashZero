# CrashZero

Traffic-accident **risk prediction → countermeasure simulation → budget allocation** for road segments in Yeongdeungpo-gu, Seoul.

CrashZero fuses open public data (KOROAD accident blackspots, V-World, KMA, OpenStreetMap) with a from-scratch risk model to score each road segment, then compares the effect and cost of CMF-based (Crash Modification Factor) countermeasures under a fixed budget.

## Pipeline

The ML side is a set of ordered, reproducible steps in `ml/src/`:

| Step | Script | What it does |
| ---- | ------ | ------------ |
| 0 | `00_normalize_raw.py` | Normalize raw public datasets into one common schema |
| 1 | `01_fetch_data.py` | Assemble blackspots, school zones, and road segments |
| 2 | `02_build_features.py` | Geospatial feature engineering |
| 3 | `03_train_model.py` | Train the risk model and evaluate it |
| 4 | `04_explain.py` | Per-feature attribution / explainability |
| 5 | `05_export_artifacts.py` | Export the model + metrics for the backend |

### Feature engineering (`02_build_features.py`)

Every candidate point becomes a feature vector built from real geometry, not toy data:

- Haversine distance to the **nearest road segment**, plus that segment's highway-class base risk
- **School-zone density** within 300 m, log nearest-school-zone distance, and CCTV counts
- **Blackspot density** within 500 m and the mean local occurrence count
- Negative samples are placed **≥ 450 m from any positive** to avoid label leakage

### Model (`03_train_model.py`)

No black-box library — the model is written by hand in NumPy:

- A **logistic-regression** baseline trained with an Adam optimizer + weight decay
- A **gradient-boosted decision-stump ensemble** fit on the logistic residuals (Newton-style stumps over feature quantiles)
- An honest **temporal split** — train 2022 / validate 2023 / test 2024
- Custom **AUC-ROC** and **Brier score**; artifacts saved as `model.npz` + `metrics.json`

## Stack

- **ML:** Python, NumPy, pandas — everything (logistic regression, boosting, metrics) implemented from scratch
- **Backend:** Node.js (Express)
- **Frontend:** web map UI for risk scoring + budget simulation

## License

MIT — see `LICENSE`. External dataset / icon licenses are listed in `docs/DATA_SOURCES.md`.
