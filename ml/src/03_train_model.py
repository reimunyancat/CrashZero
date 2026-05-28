"""CrashZero ML · step 3 — train a pure-NumPy logistic + gradient-boosted stumps.

The sandbox has no scipy/sklearn/xgboost, so we hand-roll:
  * a logistic baseline (Adam optimizer, weight decay)
  * a tiny gradient-boosted decision-stump ensemble (newton-raphson stumps)

Train split: 2021–2023, val: 2024, holdout: 2025 (per the spatial contract).
Artifacts: model.npz + metrics.json.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
PROC = ROOT / "ml" / "data" / "processed"
ART = ROOT / "ml" / "artifacts"
ART.mkdir(parents=True, exist_ok=True)

FEATURES = [
    "highway_class_base",
    "length_km",
    "blackspot_proximity",
    "peak_flag",
    "season_winter",
    "season_summer",
    "has_signal_nearby",
]


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -50, 50)))


@dataclass
class LogisticModel:
    w: np.ndarray
    b: float
    feature_names: list

    def predict_proba(self, X):
        return sigmoid(X @ self.w + self.b)


def train_logistic(X, y, *, lr=0.05, epochs=400, weight_decay=1e-4):
    rng = np.random.default_rng(0)
    n, d = X.shape
    w = rng.normal(0, 0.05, size=d)
    b = 0.0
    m_w = np.zeros(d); v_w = np.zeros(d); m_b = 0.0; v_b = 0.0
    beta1, beta2, eps = 0.9, 0.999, 1e-8
    for t in range(1, epochs + 1):
        z = X @ w + b
        p = sigmoid(z)
        diff = (p - y)
        gw = X.T @ diff / n + weight_decay * w
        gb = diff.mean()
        m_w = beta1 * m_w + (1 - beta1) * gw
        v_w = beta2 * v_w + (1 - beta2) * (gw * gw)
        m_b = beta1 * m_b + (1 - beta1) * gb
        v_b = beta2 * v_b + (1 - beta2) * (gb * gb)
        m_w_h = m_w / (1 - beta1 ** t)
        v_w_h = v_w / (1 - beta2 ** t)
        m_b_h = m_b / (1 - beta1 ** t)
        v_b_h = v_b / (1 - beta2 ** t)
        w -= lr * m_w_h / (np.sqrt(v_w_h) + eps)
        b -= lr * m_b_h / (np.sqrt(v_b_h) + eps)
    return LogisticModel(w=w, b=b, feature_names=FEATURES)


@dataclass
class Stump:
    feature: int
    threshold: float
    left: float
    right: float


def best_stump(X, residual):
    n, d = X.shape
    best = None
    best_loss = np.inf
    for j in range(d):
        xs = X[:, j]
        # 9 quantile cut points
        qs = np.quantile(xs, np.linspace(0.1, 0.9, 9))
        for thr in np.unique(qs):
            mask = xs <= thr
            if mask.sum() == 0 or mask.sum() == n:
                continue
            left = residual[mask].mean()
            right = residual[~mask].mean()
            pred = np.where(mask, left, right)
            loss = float(((residual - pred) ** 2).mean())
            if loss < best_loss:
                best_loss = loss
                best = Stump(feature=j, threshold=float(thr), left=float(left), right=float(right))
    return best


def train_boosting(X, y, base_logits, *, n_rounds=80, lr=0.1):
    logits = base_logits.copy()
    stumps = []
    for _ in range(n_rounds):
        p = sigmoid(logits)
        residual = y - p
        stump = best_stump(X, residual)
        if stump is None:
            break
        pred = np.where(X[:, stump.feature] <= stump.threshold, stump.left, stump.right)
        logits = logits + lr * pred
        stumps.append(stump)
    return stumps, lr


def predict_boost(X, base_logits, stumps, lr):
    logits = base_logits.copy()
    for s in stumps:
        pred = np.where(X[:, s.feature] <= s.threshold, s.left, s.right)
        logits = logits + lr * pred
    return sigmoid(logits)


def auc_roc(y_true, y_score):
    order = np.argsort(-y_score)
    y = y_true[order]
    tp = np.cumsum(y)
    fp = np.cumsum(1 - y)
    tpr = tp / max(1, y.sum())
    fpr = fp / max(1, (1 - y).sum())
    # prepend (0,0)
    tpr = np.concatenate([[0.0], tpr, [1.0]])
    fpr = np.concatenate([[0.0], fpr, [1.0]])
    trap = getattr(np, 'trapezoid', None) or getattr(np, 'trapz')
    return float(trap(tpr, fpr))


def brier(y_true, y_score):
    return float(((y_score - y_true) ** 2).mean())


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
    X = df[FEATURES].to_numpy(dtype=float)
    y = df["y"].to_numpy(dtype=float)
    years = df["year"].to_numpy()

    train = years <= 2023
    val = years == 2024
    test = years == 2025

    # Logistic baseline
    logistic = train_logistic(X[train], y[train])
    base_train = X[train] @ logistic.w + logistic.b
    base_val = X[val] @ logistic.w + logistic.b
    base_test = X[test] @ logistic.w + logistic.b

    # Boosting on logistic residual
    stumps, lr = train_boosting(X[train], y[train], base_train)

    p_val = predict_boost(X[val], base_val, stumps, lr)
    p_test = predict_boost(X[test], base_test, stumps, lr)
    p_val_logistic = sigmoid(base_val)

    metrics = {
        "feature_names": FEATURES,
        "train_rows": int(train.sum()),
        "val_rows": int(val.sum()),
        "test_rows": int(test.sum()),
        "logistic_auc_val": auc_roc(y[val], p_val_logistic),
        "logistic_brier_val": brier(y[val], p_val_logistic),
        "boost_auc_val": auc_roc(y[val], p_val),
        "boost_brier_val": brier(y[val], p_val),
        "boost_auc_test": auc_roc(y[test], p_test),
        "boost_brier_test": brier(y[test], p_test),
        "n_stumps": len(stumps),
        "lr": lr,
    }
    print(json.dumps(metrics, indent=2))

    np.savez(
        ART / "model.npz",
        logistic_w=logistic.w,
        logistic_b=np.array([logistic.b]),
        stump_feature=np.array([s.feature for s in stumps]),
        stump_threshold=np.array([s.threshold for s in stumps]),
        stump_left=np.array([s.left for s in stumps]),
        stump_right=np.array([s.right for s in stumps]),
        stump_lr=np.array([lr]),
    )
    (ART / "metrics.json").write_text(json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf-8")
    (ART / "feature_names.json").write_text(json.dumps(FEATURES, ensure_ascii=False), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
