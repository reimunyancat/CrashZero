"""CrashZero ML · step 5 — freeze the artifacts the backend ships.

Bundles:
  * artifacts/predictions.json    — per-link risk for the latest year
  * artifacts/segment_baseline.json
  * artifacts/manifest.json
"""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
PROC = ROOT / "ml" / "data" / "processed"
ART = ROOT / "ml" / "artifacts"
ART.mkdir(parents=True, exist_ok=True)
FEATURES = json.loads((ART / "feature_names.json").read_text(encoding="utf-8"))


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -50, 50)))


def predict_all(X):
    npz = np.load(ART / "model.npz")
    z = X @ npz["logistic_w"] + npz["logistic_b"][0]
    lr = npz["stump_lr"][0]
    for j in range(len(npz["stump_feature"])):
        feat = int(npz["stump_feature"][j])
        thr = npz["stump_threshold"][j]
        left = npz["stump_left"][j]
        right = npz["stump_right"][j]
        z = z + lr * np.where(X[:, feat] <= thr, left, right)
    return sigmoid(z)


def sha(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()[:16]


def main() -> int:
    panel_parquet = PROC / 'panel.parquet'
    panel_csv = PROC / 'panel.csv'
    if panel_parquet.exists():
        try:
            df = pd.read_parquet(panel_parquet)
        except Exception:
            df = pd.read_csv(panel_csv)
    else:
        df = pd.read_csv(panel_csv)
    latest = df[df["year"] == df["year"].max()].copy()
    X = latest[FEATURES].to_numpy(dtype=float)
    latest["risk"] = predict_all(X)

    by_link = (
        latest.groupby(["link_id", "highway", "name"], as_index=False)
        .agg(risk=("risk", "mean"))
        .sort_values("risk", ascending=False)
    )

    def band(r):
        if r >= 0.75: return "very_high"
        if r >= 0.55: return "high"
        if r >= 0.35: return "medium"
        if r >= 0.20: return "low"
        return "very_low"

    by_link["risk_band"] = by_link["risk"].apply(band)
    predictions = by_link.to_dict(orient="records")
    (ART / "predictions.json").write_text(
        json.dumps(predictions, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    manifest = {
        "generated_at": int(time.time()),
        "feature_names": FEATURES,
        "n_links": int(by_link.shape[0]),
        "latest_year": int(df["year"].max()),
        "model_hash": sha(ART / "model.npz"),
        "metrics": json.loads((ART / "metrics.json").read_text(encoding="utf-8")),
    }
    (ART / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
