#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${FIREBASE_PROJECT_ID:-demo-handmade-item-management}"
DATA_DIR="/workspace/.firebase-emulator-data"
CONFIG_FILE="/workspace/firebase.docker.json"

mkdir -p "$DATA_DIR"

exec firebase --config "$CONFIG_FILE" emulators:start \
  --project "$PROJECT_ID" \
  --only auth,firestore,storage \
  --import "$DATA_DIR" \
  --export-on-exit "$DATA_DIR"
