# CrashZero ML pipeline

Pure-NumPy implementation that runs end-to-end in a no-network sandbox.

## Pipeline

| Step | Script | Output |
| ---- | ------ | ------ |
| 1 | `01_fetch_data.py` | `data/raw/{overpass,koroad,fixture}.json` |
| 2 | `02_build_features.py` | `data/processed/panel.parquet` |
| 3 | `03_train_model.py` | `artifacts/model.npz`, `metrics.json` |
| 4 | `04_explain.py` | `artifacts/permutation_importance.json`, `plots/*.png` |
| 5 | `05_export_artifacts.py` | `artifacts/predictions.json`, `manifest.json` |

## Run

```bash
cd ml
python -m pip install -r requirements.txt
python src/01_fetch_data.py
python src/02_build_features.py
python src/03_train_model.py
python src/04_explain.py
python src/05_export_artifacts.py
```

Set `USE_FIXTURES=1` to force the offline fixture path.

## Algorithms

- **Logistic baseline** with Adam optimizer and L2 weight decay.
- **Gradient-boosted decision stumps** (depth-1 trees) fit to the logistic residual.
- **Permutation importance** for model-agnostic feature attribution (no SHAP needed).
- **Partial dependence plots** for each feature at the holdout split.

## Splits

Following the spatial contract:

- Train: 2021–2023
- Val: 2024
- Holdout: 2025

## Notes

- Charts are saved in English because the sandbox does not have a Korean font.
- The fixture fallback produces a deterministic toy panel so the pipeline keeps
  passing even on a fresh machine without API keys.
