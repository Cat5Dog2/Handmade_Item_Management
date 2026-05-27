param(
  [ValidateSet("stg", "demo", "prod")]
  [string] $DeployEnvironment = "stg"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ($PSVersionTable.PSVersion.Major -ge 7) {
  $PSNativeCommandUseErrorActionPreference = $true
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
$envFileName = if ($DeployEnvironment -eq "prod") { ".env" } else { ".env.$DeployEnvironment" }
$envFile = Join-Path $repoRoot $envFileName

function Import-EnvFile {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Path
  )

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "$envFileName was not found: $Path"
  }

  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()

    if ($line -eq "" -or $line.StartsWith("#")) {
      return
    }

    $parts = $line -split "=", 2

    if ($parts.Count -ne 2) {
      return
    }

    $key = $parts[0].Trim()
    $value = $parts[1].Trim()

    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    [Environment]::SetEnvironmentVariable($key, $value, "Process")
  }
}

function Assert-RequiredEnv {
  param(
    [Parameter(Mandatory = $true)]
    [string[]] $Names
  )

  $missingEnvNames = @($Names | Where-Object {
    [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_, "Process"))
  })

  if ($missingEnvNames.Count -gt 0) {
    throw "$envFileName is missing required values: $($missingEnvNames -join ', ')"
  }
}

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Command,

    [Parameter(Mandatory = $true)]
    [string[]] $Arguments
  )

  & $Command @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $Command $($Arguments -join ' ')"
  }
}

function Resolve-GoogleApplicationCredentials {
  if ([string]::IsNullOrWhiteSpace($env:GOOGLE_APPLICATION_CREDENTIALS)) {
    return
  }

  $credentialsValue = $env:GOOGLE_APPLICATION_CREDENTIALS
  $credentialsCandidates = if ([System.IO.Path]::IsPathRooted($credentialsValue)) {
    @($credentialsValue)
  } else {
    @(
      (Join-Path $repoRoot $credentialsValue),
      (Join-Path (Join-Path $repoRoot "apps\api") $credentialsValue)
    )
  }
  $credentialsPath = $credentialsCandidates |
    Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
    Select-Object -First 1

  if ($credentialsPath) {
    $env:GOOGLE_APPLICATION_CREDENTIALS = (Resolve-Path -LiteralPath $credentialsPath).Path
    return
  }

  $adcPath = Join-Path $env:APPDATA "gcloud\application_default_credentials.json"

  if (-not (Test-Path -LiteralPath $adcPath -PathType Leaf)) {
    throw "Google credentials were not found. Put the service account JSON at '$credentialsValue' or run 'gcloud auth application-default login'."
  }

  Write-Warning "GOOGLE_APPLICATION_CREDENTIALS was not found. Using gcloud application default credentials instead."
  $env:GOOGLE_APPLICATION_CREDENTIALS = $adcPath
}

Import-EnvFile -Path $envFile

Assert-RequiredEnv -Names @(
  "APP_OWNER_EMAIL",
  "CORS_ORIGIN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID"
)

if ([string]::IsNullOrWhiteSpace($env:GOOGLE_CLOUD_PROJECT)) {
  $env:GOOGLE_CLOUD_PROJECT = $env:FIREBASE_PROJECT_ID
}

$substitutions = @(
  "_APP_OWNER_EMAIL=$($env:APP_OWNER_EMAIL)",
  "_CORS_ORIGIN=$($env:CORS_ORIGIN)",
  "_FIREBASE_PROJECT_ID=$($env:FIREBASE_PROJECT_ID)",
  "_FIREBASE_STORAGE_BUCKET=$($env:FIREBASE_STORAGE_BUCKET)",
  "_VITE_FIREBASE_API_KEY=$($env:VITE_FIREBASE_API_KEY)",
  "_VITE_FIREBASE_AUTH_DOMAIN=$($env:VITE_FIREBASE_AUTH_DOMAIN)",
  "_VITE_FIREBASE_STORAGE_BUCKET=$($env:VITE_FIREBASE_STORAGE_BUCKET)",
  "_VITE_FIREBASE_MESSAGING_SENDER_ID=$($env:VITE_FIREBASE_MESSAGING_SENDER_ID)",
  "_VITE_FIREBASE_APP_ID=$($env:VITE_FIREBASE_APP_ID)",
  "_VITE_FIREBASE_MEASUREMENT_ID=$($env:VITE_FIREBASE_MEASUREMENT_ID)"
) -join ","

Push-Location $repoRoot

try {
  Invoke-CheckedCommand -Command "gcloud" -Arguments @(
    "builds",
    "submit",
    "--project",
    $env:FIREBASE_PROJECT_ID,
    "--config",
    "cloudbuild.yaml",
    "--substitutions",
    $substitutions
  )

  if ($DeployEnvironment -ne "prod") {
    $env:DEMO_SEED_ENABLED = if ($env:DEMO_SEED_ENABLED) { $env:DEMO_SEED_ENABLED } else { "true" }
    $env:DEMO_SEED_TARGET = if ($env:DEMO_SEED_TARGET) { $env:DEMO_SEED_TARGET } else { $DeployEnvironment }
    $env:DEMO_SEED_COUNT = if ($env:DEMO_SEED_COUNT) { $env:DEMO_SEED_COUNT } else { "25" }
    $seedConfirmEnvName = if ($DeployEnvironment -eq "demo") { "DEMO_SEED_DEMO_CONFIRM" } else { "DEMO_SEED_STG_CONFIRM" }
    [Environment]::SetEnvironmentVariable($seedConfirmEnvName, $env:FIREBASE_PROJECT_ID, "Process")
    $env:DEMO_OWNER_PASSWORD = if ($env:DEMO_OWNER_PASSWORD) { $env:DEMO_OWNER_PASSWORD } else { $env:APP_PASS }
    $env:FIRESTORE_EMULATOR_HOST = ""
    $env:FIREBASE_AUTH_EMULATOR_HOST = ""

    Resolve-GoogleApplicationCredentials

    $seedScript = if ($DeployEnvironment -eq "demo") { "seed:demo:demo" } else { "seed:demo:stg" }
    Invoke-CheckedCommand -Command "npm" -Arguments @("run", $seedScript)
  }
} finally {
  Pop-Location
}
