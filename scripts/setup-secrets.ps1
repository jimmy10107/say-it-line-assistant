param([Parameter(Mandatory=$true)][string]$AppUrl)
$taskNode = (Get-Command node -ErrorAction Stop).Source
& $taskNode (Join-Path $PSScriptRoot 'setup-secrets.mjs') $AppUrl
Read-Host '完成後按 Enter 關閉此視窗'
