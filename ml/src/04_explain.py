"""CrashZero ML · step 4 — explainability.

Produces:
  * permutation_importance.json (model-agnostic, no SHAP needed)
  * partial_dependence.json     (1D PDP for each feature)
  * plots/{roc, calibration, importance, pdp_*}.png

All labels are kept in English on charts because the sandbox does not have a
Korean font installed (Noto Sans KR 아웃 폰트 없으니까 한글은 넎어가요).
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[2]
PROC = ROOT / "ml" / "data" / "processed"
ART = ROOT / "ml" / "artifacts"
PLOTS = ART / "plots"
PLOTS.mkdir(parents=True, exist_ok=True)

FEATURES = json.loads((ART / "feature_names.json").read_text(encoding="utf-8"))


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -50, 50)))


def load_model():
    npz = np.load(ART / "model.npz")
    return {
        "w": npz["logistic_w"],
        "b": float(npz["logistic_b"][0]),
        "stump_feature": npz["stump_feature"],
        "stump_threshold": npz["stump_threshold"],
        "stump_left": npz["stump_left"],
        "stump_right": npz["stump_right"],
        "stump_lr": float(npz["stump_lr"][0]),
    }


def predict(model, X):
    z = X @ model["w"] + model["b"]
    lr = model["stump_lr"]
    for j in range(len(model["stump_feature"])):
        feat = int(model["stump_feature"][j])
        thr = model["stump_threshold"][j]
        left = model["stump_left"][j]
        right = model["stump_right"][j]
        pred = np.where(X[:, feat] <= thr, left, right)
        z = z + lr * pred
    return sigmoid(z)


def auc_roc(y, p):
    order = np.argsort(-p)
    y = y[order]
    tp = np.cumsum(y); fp = np.cumsum(1 - y)
    tpr = tp / max(1, y.sum()); fpr = fp / max(1, (1 - y).sum())
    tpr = np.concatenate([[0.0], tpr, [1.0]])
    fpr = np.concatenate([[0.0], fpr, [1.0]])
    return float(np.trapz(tpr, fpr)), fpr, tpr


def permutation_importance(model, X, y, rng):
    base_p = predict(model, X)
    base_auc, _, _ = auc_roc(y, base_p)
    rows = []
    for j, name in enumerate(FEATURES):
        Xp = X.copy()
        rng.shuffle(Xp[:, j])
        p = predict(model, Xp)
        auc, _, _ = auc_roc(y, p)
        rows.append({"feature": name, "auc_drop": float(base_auc - auc)})
    rows.sort(key=lambda r: r["auc_drop"], reverse=True)
    return base_auc, rows


def partial_dependence(model, X, j, n_grid=20):
    xs = X[:, j]
    grid = np.linspace(np.quantile(xs, 0.02), np.quantile(xs, 0.98), n_grid)
    Xp = X.copy()
    out = []
    for g in grid:
        Xp[:, j] = g
        out.append(float(predict(model, Xp).mean()))
    return grid.tolist(), out


def plot_roc(fpr, tpr, auc, path):
    fig, ax = plt.subplots(figsize=(4, 4))
    ax.plot(fpr, tpr, color="#60a5fa", linewidth=2, label=f"AUC = {auc:.3f}")
    ax.plot([0, 1], [0, 1], color="#475569", linestyle="--", linewidth=1)
    ax.set_xlabel("False positive rate")
    ax.set_ylabel("True positive rate")
    ax.set_title("ROC · holdout 2025")
    ax.legend(loc="lower right")
    fig.tight_layout()
    fig.savefig(path, dpi=140, facecolor="white")
    plt.close(fig)


def plot_calibration(y, p, path, n_bins=10):
    bins = np.linspace(0, 1, n_bins + 1)
    idx = np.digitize(p, bins) - 1
    xs, ys = [], []
    for b in range(n_bins):
        mask = idx == b
        if mask.sum() < 5:
            continue
        xs.append(float(p[mask].mean()))
        ys.append(float(y[mask].mean()))
    fig, ax = plt.subplots(figsize=(4, 4))
    ax.plot([0, 1], [0, 1], color="#475569", linestyle="--", linewidth=1)
    ax.plot(xs, ys, marker="o", color="#D34037", linewidth=2)
    ax.set_xlabel("Predicted probability")
    ax.set_ylabel("Empirical rate")
    ax.set_title("Calibration · holdout 2025")
    fig.tight_layout()
    fig.savefig(path, dpi=140, facecolor="white")
    plt.close(fig)


def plot_importance(rows, path):
    rows = sorted(rows, key=lambda r: r["auc_drop"])
    names = [r["feature"] for r in rows]
    vals = [r["auc_drop"] for r in rows]
    fig, ax = plt.subplots(figsize=(5.5, 3.5))
    ax.barh(names, vals, color="#7da2ff")
    ax.set_xlabel("AUC drop when permuted")
    ax.set_title("Permutation importance")
    fig.tight_layout()
    fig.savefig(path, dpi=140, facecolor="white")
    plt.close(fig)


def plot_pdp(name, grid, vals, path):
    fig, ax = plt.subplots(figsize=(4.2, 3.0))
    ax.plot(grid, vals, color="#60a5fa", linewidth=2)
    ax.set_xlabel(name)
    ax.set_ylabel("Avg predicted risk")
    ax.set_title(f"Partial dependence · {name}")
    fig.tight_layout()
    fig.savefig(path, dpi=140, facecolor="white")
    plt.close(fig)


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
    mask = years == 2025
    X_h, y_h = X[mask], y[mask]

    model = load_model()
    p_h = predict(model, X_h)
    auc, fpr, tpr = auc_roc(y_h, p_h)

    rng = np.random.default_rng(7)
    _, imp = permutation_importance(model, X_h, y_h, rng)
    (ART / "permutation_importance.json").write_text(
        json.dumps(imp, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    pdp = {}
    for j, name in enumerate(FEATURES):
        grid, vals = partial_dependence(model, X_h, j)
        pdp[name] = {"grid": grid, "values": vals}
        plot_pdp(name, grid, vals, PLOTS / f"pdp_{name}.png")
    (ART / "partial_dependence.json").write_text(
        json.dumps(pdp, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    plot_roc(fpr, tpr, auc, PLOTS / "roc.png")
    plot_calibration(y_h, p_h, PLOTS / "calibration.png")
    plot_importance(imp, PLOTS / "importance.png")
    print(json.dumps({"holdout_auc": auc, "importance": imp[:3]}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
