#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/../.." && pwd)"
deploy_env="${DEPLOY_ENV:-stg}"

if [[ "$deploy_env" != "stg" && "$deploy_env" != "demo" && "$deploy_env" != "prod" ]]; then
  echo "Error: DEPLOY_ENV must be either 'stg', 'demo', or 'prod'." >&2
  exit 1
fi

if [[ "$deploy_env" == "prod" ]]; then
  env_file_name=".env"
else
  env_file_name=".env.$deploy_env"
fi
env_file="$repo_root/$env_file_name"

die() {
  echo "Error: $*" >&2
  exit 1
}

trim() {
  sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

load_env_file() {
  local path="$1"

  [[ -f "$path" ]] || die "$env_file_name was not found: $path"

  local line trimmed key value

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    trimmed="$(printf '%s' "$line" | trim)"

    [[ -z "$trimmed" || "${trimmed:0:1}" == "#" ]] && continue
    [[ "$trimmed" =~ ^[A-Za-z_][A-Za-z0-9_]*[[:space:]]*= ]] || continue

    key="$(printf '%s' "${trimmed%%=*}" | trim)"
    value="$(printf '%s' "${trimmed#*=}" | trim)"

    if [[ ${#value} -ge 2 ]]; then
      if [[ "${value:0:1}" == '"' && "${value: -1}" == '"' ]]; then
        value="${value:1:${#value}-2}"
      elif [[ "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
        value="${value:1:${#value}-2}"
      fi
    fi

    export "$key=$value"
  done < "$path"
}

assert_required_env() {
  local missing=()
  local name

  for name in "$@"; do
    if [[ -z "${!name:-}" ]]; then
      missing+=("$name")
    fi
  done

  if (( ${#missing[@]} > 0 )); then
    die "$env_file_name is missing required values: ${missing[*]}"
  fi
}

is_absolute_path() {
  local value="$1"

  [[ "$value" == /* || "$value" =~ ^[A-Za-z]:[/\\] ]]
}

to_unix_path_if_possible() {
  local value="$1"

  if command -v cygpath >/dev/null 2>&1; then
    cygpath -u "$value" 2>/dev/null || printf '%s\n' "$value"
  else
    printf '%s\n' "$value"
  fi
}

first_existing_file() {
  local candidate unix_candidate

  for candidate in "$@"; do
    [[ -z "$candidate" ]] && continue

    if [[ -f "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi

    unix_candidate="$(to_unix_path_if_possible "$candidate")"

    if [[ -f "$unix_candidate" ]]; then
      printf '%s\n' "$unix_candidate"
      return 0
    fi
  done

  return 1
}

resolve_google_application_credentials() {
  [[ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]] || return 0

  local credentials_value="$GOOGLE_APPLICATION_CREDENTIALS"
  local credentials_path=""
  local candidates=()
  local adc_candidates=()

  if is_absolute_path "$credentials_value"; then
    candidates+=("$credentials_value")
  else
    candidates+=(
      "$repo_root/$credentials_value"
      "$repo_root/apps/api/$credentials_value"
    )
  fi

  credentials_path="$(first_existing_file "${candidates[@]}")" || true

  if [[ -n "$credentials_path" ]]; then
    export GOOGLE_APPLICATION_CREDENTIALS="$credentials_path"
    return 0
  fi

  if [[ -n "${APPDATA:-}" ]]; then
    adc_candidates+=(
      "$APPDATA/gcloud/application_default_credentials.json"
      "$(to_unix_path_if_possible "$APPDATA")/gcloud/application_default_credentials.json"
    )
  fi

  if [[ -n "${HOME:-}" ]]; then
    adc_candidates+=("$HOME/.config/gcloud/application_default_credentials.json")
  fi

  if [[ -n "${USERPROFILE:-}" ]]; then
    adc_candidates+=(
      "$USERPROFILE/AppData/Roaming/gcloud/application_default_credentials.json"
      "$(to_unix_path_if_possible "$USERPROFILE")/AppData/Roaming/gcloud/application_default_credentials.json"
    )
  fi

  credentials_path="$(first_existing_file "${adc_candidates[@]}")" || true

  if [[ -n "$credentials_path" ]]; then
    echo "Warning: GOOGLE_APPLICATION_CREDENTIALS was not found. Using gcloud application default credentials instead." >&2
    export GOOGLE_APPLICATION_CREDENTIALS="$credentials_path"
    return 0
  fi

  die "Google credentials were not found. Put the service account JSON at '$credentials_value' or run 'gcloud auth application-default login'."
}

load_env_file "$env_file"

assert_required_env \
  APP_OWNER_EMAIL \
  CORS_ORIGIN \
  FIREBASE_PROJECT_ID \
  FIREBASE_STORAGE_BUCKET \
  VITE_FIREBASE_API_KEY \
  VITE_FIREBASE_AUTH_DOMAIN \
  VITE_FIREBASE_STORAGE_BUCKET \
  VITE_FIREBASE_MESSAGING_SENDER_ID \
  VITE_FIREBASE_APP_ID

if [[ -z "${GOOGLE_CLOUD_PROJECT:-}" ]]; then
  export GOOGLE_CLOUD_PROJECT="$FIREBASE_PROJECT_ID"
fi

substitution_parts=(
  "_APP_OWNER_EMAIL=$APP_OWNER_EMAIL"
  "_CORS_ORIGIN=$CORS_ORIGIN"
  "_FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID"
  "_FIREBASE_STORAGE_BUCKET=$FIREBASE_STORAGE_BUCKET"
  "_VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY"
  "_VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN"
  "_VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET"
  "_VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID"
  "_VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID"
  "_VITE_FIREBASE_MEASUREMENT_ID=${VITE_FIREBASE_MEASUREMENT_ID:-}"
)
substitutions="$(IFS=,; echo "${substitution_parts[*]}")"

cd "$repo_root"

gcloud builds submit \
  --project "$FIREBASE_PROJECT_ID" \
  --config cloudbuild.yaml \
  --substitutions "$substitutions"

if [[ "$deploy_env" != "prod" ]]; then
  export DEMO_SEED_ENABLED="${DEMO_SEED_ENABLED:-true}"
  export DEMO_SEED_TARGET="${DEMO_SEED_TARGET:-$deploy_env}"
  export DEMO_SEED_COUNT="${DEMO_SEED_COUNT:-25}"
  if [[ "$deploy_env" == "demo" ]]; then
    export DEMO_SEED_DEMO_CONFIRM="$FIREBASE_PROJECT_ID"
    seed_script="seed:demo:demo"
  else
    export DEMO_SEED_STG_CONFIRM="$FIREBASE_PROJECT_ID"
    seed_script="seed:demo:stg"
  fi
  export DEMO_OWNER_PASSWORD="${DEMO_OWNER_PASSWORD:-${APP_PASS:-}}"
  export FIRESTORE_EMULATOR_HOST=""
  export FIREBASE_AUTH_EMULATOR_HOST=""

  resolve_google_application_credentials

  npm run "$seed_script"
fi
