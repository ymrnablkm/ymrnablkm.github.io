<#
用途：把后台运行所需的 5 个环境变量写入 Cloudflare Pages 项目（加密保存）。

首次使用：
  1. 安装依赖（若尚未安装）：npm install
  2. 登录 Cloudflare（会打开浏览器）：
     npx wrangler login
  3. 运行本脚本（把 你的项目名 换成 Cloudflare Pages 的项目名）：
     powershell -ExecutionPolicy Bypass -File scripts/setup-cloudflare-secrets.ps1 -ProjectName 你的项目名

两种提供密钥的方式：
  A. 交互式：脚本逐个提示输入，输入内容不会显示。
  B. 文件式（推荐，避免在聊天中泄露）：复制 .dev.vars.example 为 .dev.vars，
     填好 5 个值后运行上面的命令；脚本会自动读取 .dev.vars。
     .dev.vars 已加入 .gitignore，不会提交到仓库。

只预览、不写入：
  powershell -ExecutionPolicy Bypass -File scripts/setup-cloudflare-secrets.ps1 -ProjectName 你的项目名 -DryRun
#>
param(
  [string]$ProjectName = "",
  [string]$EnvFile = ".dev.vars",
  [switch]$DryRun,
  [switch]$NonInteractive
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# 如果存在 .cf-token，就使用 API Token 认证（无需 wrangler login）
$cfTokenFile = Join-Path $root ".cf-token"
if (Test-Path $cfTokenFile) {
  foreach ($line in Get-Content $cfTokenFile) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
    $idx = $trimmed.IndexOf("=")
    if ($idx -lt 1) { continue }
    $name = $trimmed.Substring(0, $idx).Trim()
    $value = $trimmed.Substring($idx + 1).Trim().Trim('"').Trim("'")
    if ($name -eq "CLOUDFLARE_API_TOKEN" -and $value) { $env:CLOUDFLARE_API_TOKEN = $value }
    if ($name -eq "CLOUDFLARE_ACCOUNT_ID" -and $value) { $env:CLOUDFLARE_ACCOUNT_ID = $value }
  }
}

$keys = @(
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "ADMIN_GITHUB_LOGIN",
  "SESSION_SECRET",
  "GITHUB_TOKEN"
)

if (-not $ProjectName) {
  $ProjectName = Read-Host "请输入 Cloudflare Pages 项目名称（与 Dashboard 中完全一致）"
}
if (-not $ProjectName.Trim()) { throw "项目名称不能为空" }
$ProjectName = $ProjectName.Trim()

$values = @{}
if (Test-Path $EnvFile) {
  Write-Host "从 $EnvFile 读取配置..." -ForegroundColor Cyan
  foreach ($line in Get-Content $EnvFile) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
    $idx = $trimmed.IndexOf("=")
    if ($idx -lt 1) { continue }
    $name = $trimmed.Substring(0, $idx).Trim()
    $value = $trimmed.Substring($idx + 1).Trim().Trim('"').Trim("'")
    if (($keys -contains $name) -and $value) { $values[$name] = $value }
  }
}

foreach ($key in $keys) {
  if ($values.ContainsKey($key)) { continue }
  if ($DryRun) {
    $values[$key] = "DRY-RUN-VALUE"
    continue
  }
  if ($NonInteractive) {
    throw "$key 为空，请先在 $EnvFile 中填写。"
  }

  Write-Host ""
  Write-Host "$key ：" -ForegroundColor Yellow

  if ($key -eq "SESSION_SECRET") {
    $custom = Read-Host "直接回车自动生成 48 位随机值，或粘贴自定义值"
    if (-not $custom) {
      $bytes = New-Object byte[] 36
      [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
      $values[$key] = [Convert]::ToBase64String($bytes)
      Write-Host "已自动生成 SESSION_SECRET" -ForegroundColor Green
    } else {
      $values[$key] = $custom
    }
    continue
  }

  $secure = Read-Host -AsSecureString "请输入 $key（输入时不显示，直接回车跳过表示稍后手动配置）"
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $values[$key] = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

$missing = @()
foreach ($key in $keys) {
  if (-not $values.ContainsKey($key) -or -not $values[$key]) { $missing += $key }
}
if ($missing.Count -gt 0) {
  throw "以下配置为空，已停止：$($missing -join ', ')"
}
if ($values["SESSION_SECRET"].Length -lt 16) {
  throw "SESSION_SECRET 至少需要 16 位随机字符，建议直接回车让脚本自动生成。"
}

if (-not $DryRun) {
  Write-Host ""
  Write-Host "检查 Cloudflare 认证状态..." -ForegroundColor Cyan
  $who = (npx wrangler whoami 2>&1 | Out-String)
  Write-Host $who
  if (-not $env:CLOUDFLARE_API_TOKEN -and ($who -match "not authenticated|not logged in|You are not")) {
    throw "尚未登录 Cloudflare。请先执行：npx wrangler login，或在 .cf-token 中填写 API Token。"
  }
  if ($env:CLOUDFLARE_API_TOKEN -and ($who -match "not authenticated|not logged in|You are not")) {
    throw "API Token 无效或权限不足，请检查 .cf-token 中的 CLOUDFLARE_API_TOKEN。"
  }
}

foreach ($key in $keys) {
  if ($DryRun) {
    Write-Host "[DryRun] npx wrangler pages secret put $key --project-name $ProjectName"
    continue
  }
  Write-Host ""
  Write-Host "写入 $key ..." -ForegroundColor Cyan
  $values[$key] | npx wrangler pages secret put $key --project-name $ProjectName
  if ($LASTEXITCODE -ne 0) {
    throw "$key 写入失败，请检查项目名称、登录状态和网络。"
  }
}

Write-Host ""
if ($DryRun) {
  Write-Host "DryRun 完成：以上 5 个变量将被写入项目「$ProjectName」。" -ForegroundColor Green
} else {
  Write-Host "全部完成：5 个环境变量已写入项目「$ProjectName」。" -ForegroundColor Green
  Write-Host "请到 Cloudflare Pages → 项目 → Deployments，点击最新部署右侧的「Retry deployment」重新部署，变量才会生效。" -ForegroundColor Yellow
  Write-Host "OAuth App 的 Authorization callback URL 必须是：https://你的域名/api/auth/callback" -ForegroundColor Yellow
}
