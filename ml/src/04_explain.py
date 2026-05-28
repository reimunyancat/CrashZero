from __future__ import annotations
import json
from pathlib import Path

import numpy as np
import pandas as pd

try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    HAS_MPL = True
except Exception:
    HAS_MPL = False

ROOT = Path(__file__).resolve().parents[2]
PROC = ROOT / 'ml' / 'data' / 'processed'
ART = ROOT / 'ml' / 'artifacts'
PLOTS = ART / 'plots'
PLOTS.mkdir(parents=True, exist_ok=True)

FEATURES = json.loads((ART / 'feature_names.json').read_text(encoding='utf-8'))


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -50, 50)))


def load_model():
    npz = np.load(ART / 'model.npz')
    return {
        'w': npz['logistic_w'],
        'b': float(npz['logistic_b'][0]),
        'sf': npz['stump_feature'],
        'st': npz['stump_threshold'],
        'sl': npz['stump_left'],
        'sr': npz['stump_right'],
        'lr': float(npz['stump_lr'][0]),
    }


def predict(model, X):
    z = X @ model['w'] + model['b']
    lr = model['lr']
    for j in range(len(model['sf'])):
        feat = int(model['sf'][j])
        thr = model['st'][j]
        left = model['sl'][j]
        right = model['sr'][j]
        z = z + lr * np.where(X[:, feat] <= thr, left, right)
    return sigmoid(z)


def auc_curve(y, p):
    order = np.argsort(-p)
    y = y[order]
    tp = np.cumsum(y)
    fp = np.cumsum(1 - y)
    tpr = tp / max(1, y.sum())
    fpr = fp / max(1, (1 - y).sum())
    tpr = np.concatenate([[0.0], tpr, [1.0]])
    fpr = np.concatenate([[0.0], fpr, [1.0]])
    trap = getattr(np, 'trapezoid', None) or getattr(np, 'trapz')
    return float(trap(tpr, fpr)), fpr.tolist(), tpr.tolist()


def calibration_bins(y, p, n=10):
    edges = np.linspace(0, 1, n + 1)
    xs, ys = [], []
    for i in range(n):
        m = (p >= edges[i]) & (p < edges[i + 1])
        if m.sum() == 0:
            continue
        xs.append(float(p[m].mean()))
        ys.append(float(y[m].mean()))
    return xs, ys


def permutation_importance(model, X, y, rng):
    base_auc, _, _ = auc_curve(y, predict(model, X))
    rows = []
    for j, name in enumerate(FEATURES):
        Xp = X.copy()
        rng.shuffle(Xp[:, j])
        auc, _, _ = auc_curve(y, predict(model, Xp))
        rows.append({'feature': name, 'auc_drop': float(base_auc - auc)})
    rows.sort(key=lambda r: r['auc_drop'], reverse=True)
    return base_auc, rows


def partial_dependence(model, X, j, n_grid=20):
    xs = X[:, j]
    grid = np.linspace(np.quantile(xs, 0.02), np.quantile(xs, 0.98), n_grid)
    out = []
    for g in grid:
        Xp = X.copy()
        Xp[:, j] = g
        out.append({'x': float(g), 'y': float(predict(model, Xp).mean())})
    return out


def save_plot_roc(fpr, tpr, auc, path):
    if not HAS_MPL:
        return
    fig, ax = plt.subplots(figsize=(5, 4))
    ax.plot(fpr, tpr, color='#60a5fa', linewidth=2, label=f'AUC = {auc:.3f}')
    ax.plot([0, 1], [0, 1], color='#475569', linestyle='--', linewidth=1)
    ax.set_xlabel('False positive rate')
    ax.set_ylabel('True positive rate')
    ax.set_title('ROC · holdout 2024')
    ax.legend(loc='lower right')
    fig.tight_layout()
    fig.savefig(path, dpi=140, facecolor='white')
    plt.close(fig)


def save_plot_calib(xs, ys, path):
    if not HAS_MPL:
        return
    fig, ax = plt.subplots(figsize=(5, 4))
    ax.plot([0, 1], [0, 1], color='#475569', linestyle='--', linewidth=1)
    ax.plot(xs, ys, marker='o', color='#D34037', linewidth=2)
    ax.set_xlabel('Predicted probability')
    ax.set_ylabel('Empirical rate')
    ax.set_title('Calibration · holdout 2024')
    fig.tight_layout()
    fig.savefig(path, dpi=140, facecolor='white')
    plt.close(fig)


def save_plot_importance(rows, path):
    if not HAS_MPL:
        return
    fig, ax = plt.subplots(figsize=(6, 4))
    names = [r['feature'] for r in rows]
    vals = [r['auc_drop'] for r in rows]
    ax.barh(names[::-1], vals[::-1], color='#9ACA83')
    ax.set_xlabel('AUC drop')
    ax.set_title('Permutation importance')
    fig.tight_layout()
    fig.savefig(path, dpi=140, facecolor='white')
    plt.close(fig)


def save_plot_pdp(name, pts, path):
    if not HAS_MPL:
        return
    fig, ax = plt.subplots(figsize=(5, 3))
    ax.plot([p['x'] for p in pts], [p['y'] for p in pts], color='#EAE065', linewidth=2)
    ax.set_xlabel(name)
    ax.set_ylabel('mean predicted risk')
    ax.set_title(f'PDP · {name}')
    fig.tight_layout()
    fig.savefig(path, dpi=140, facecolor='white')
    plt.close(fig)


def main():
    df = pd.read_csv(PROC / 'panel.csv')
    X = df[FEATURES].to_numpy(dtype=float)
    y = df['y'].to_numpy(dtype=float)
    years = df['year'].to_numpy()
    mask = years == 2024
    X_h, y_h = X[mask], y[mask]

    model = load_model()
    p_h = predict(model, X_h)
    auc, fpr, tpr = auc_curve(y_h, p_h)
    xs, ys = calibration_bins(y_h, p_h)

    rng = np.random.default_rng(0)
    base_auc, importance = permutation_importance(model, X_h, y_h, rng)

    pdps = {}
    for j, name in enumerate(FEATURES):
        pdps[name] = partial_dependence(model, X_h, j)

    (ART / 'permutation_importance.json').write_text(
        json.dumps({'base_auc': base_auc, 'rows': importance}, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )
    (ART / 'partial_dependence.json').write_text(
        json.dumps(pdps, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )
    (ART / 'roc_curve.json').write_text(
        json.dumps({'auc': auc, 'fpr': fpr, 'tpr': tpr}, ensure_ascii=False),
        encoding='utf-8',
    )
    (ART / 'calibration.json').write_text(
        json.dumps({'bins_pred': xs, 'bins_empirical': ys}, ensure_ascii=False),
        encoding='utf-8',
    )

    save_plot_roc(fpr, tpr, auc, PLOTS / 'roc.png')
    save_plot_calib(xs, ys, PLOTS / 'calibration.png')
    save_plot_importance(importance, PLOTS / 'importance.png')
    for j, name in enumerate(FEATURES):
        save_plot_pdp(name, pdps[name], PLOTS / f'pdp_{name}.png')

    print(json.dumps({
        'auc_holdout': auc,
        'top_importance': importance[:3],
        'has_matplotlib': HAS_MPL,
    }, indent=2, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
