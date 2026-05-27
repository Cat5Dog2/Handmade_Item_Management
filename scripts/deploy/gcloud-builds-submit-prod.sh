#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

DEPLOY_ENV=prod bash "$script_dir/gcloud-builds-submit-stg.sh"
