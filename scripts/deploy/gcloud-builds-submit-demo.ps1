$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$scriptPath = Join-Path $PSScriptRoot "gcloud-builds-submit-stg.ps1"

& $scriptPath -DeployEnvironment "demo"
