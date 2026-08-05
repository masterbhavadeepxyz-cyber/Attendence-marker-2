# QuickCheck PowerShell HTTP Server for Windows
param(
    [int]$Port = 3000
)

$PublicDir = Join-Path $PSScriptRoot "frontend"
$BackendDir = Join-Path $PSScriptRoot "backend"
$DataDir = Join-Path $BackendDir "data"
$DbFile = Join-Path $DataDir "db.json"

if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
}

# Initial seed data
$InitialData = @{
    members = @(
        @{ id = "11111111-1111-1111-1111-111111111111"; name = "Sarah Jenkins"; role = "Lead Developer"; department = "Engineering"; email = "sarah.j@company.com" },
        @{ id = "22222222-2222-2222-2222-222222222222"; name = "Alex Rivera"; role = "Senior UX Designer"; department = "Design"; email = "alex.r@company.com" },
        @{ id = "33333333-3333-3333-3333-333333333333"; name = "Michael Chen"; role = "Product Manager"; department = "Product"; email = "michael.c@company.com" },
        @{ id = "44444444-4444-4444-4444-444444444444"; name = "Priya Patel"; role = "Frontend Engineer"; department = "Engineering"; email = "priya.p@company.com" },
        @{ id = "55555555-5555-5555-5555-555555555555"; name = "David Kim"; role = "Marketing Specialist"; department = "Marketing"; email = "david.k@company.com" },
        @{ id = "66666666-6666-6666-6666-666666666666"; name = "Emily Watson"; role = "Operations Lead"; department = "Operations"; email = "emily.w@company.com" },
        @{ id = "77777777-7777-7777-7777-777777777777"; name = "Carlos Mendez"; role = "Visual Designer"; department = "Design"; email = "carlos.m@company.com" },
        @{ id = "88888888-8888-8888-8888-888888888888"; name = "James Wilson"; role = "DevOps Engineer"; department = "Engineering"; email = "james.w@company.com" }
    )
    attendance = @{}
}

if (-not (Test-Path $DbFile)) {
    $InitialData | ConvertTo-Json -Depth 10 | Set-Content -Path $DbFile -Encoding UTF8
}

function Get-MimeType($filePath) {
    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
    switch ($ext) {
        ".html" { return "text/html; charset=utf-8" }
        ".css"  { return "text/css; charset=utf-8" }
        ".js"   { return "application/javascript; charset=utf-8" }
        ".json" { return "application/json; charset=utf-8" }
        ".png"  { return "image/png" }
        ".jpg"  { return "image/jpeg" }
        ".svg"  { return "image/svg+xml" }
        ".ico"  { return "image/x-icon" }
        default { return "application/octet-stream" }
    }
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host "🚀 QuickCheck Server running at: http://localhost:$Port" -ForegroundColor Cyan
    Write-Host "Serving frontend from: $PublicDir" -ForegroundColor Gray
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host "Press Ctrl+C in this terminal to stop the server." -ForegroundColor Yellow
    Write-Host ""
} catch {
    Write-Host "Failed to start listener on $prefix : $_" -ForegroundColor Red
    exit 1
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        $urlPath = $request.Url.AbsolutePath

        # Enable CORS
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        # Health API Endpoint
        if ($urlPath -eq "/api/health") {
            $json = '{"status":"ok","mode":"Supabase & Express Ready"}'
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.ContentType = "application/json"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # Static File Serving
        $relPath = $urlPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($relPath)) {
            $relPath = "index.html"
        }

        $filePath = Join-Path $PublicDir $relPath

        if (Test-Path $filePath -PathType Leaf) {
            $buffer = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = Get-MimeType $filePath
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        } else {
            $response.StatusCode = 404
            $buffer = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        $response.Close()
    } catch {
        # Continue loop on connection reset
    }
}
