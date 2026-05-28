#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python src/01_fetch_data.py
python src/02_build_features.py
python src/03_train_model.py
python src/04_explain.py
python src/05_export_artifacts.py
echo 'CrashZero ML pipeline OK'
