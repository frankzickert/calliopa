# Installs calliopa on Windows:
#
#   irm https://raw.githubusercontent.com/frankzickert/calliopa/main/install.ps1 | iex
#
# This script is pinned to one release. It checks the release's SHA256SUMS
# against the digest below, and the binary against SHA256SUMS, and installs
# nothing on a mismatch. It refuses with throw, never exit, so the window the
# command was typed into stays open.
#
#   $env:CALLIOPA_INSTALL_DIR   where to install (default %LOCALAPPDATA%\Programs\calliopa)
#   $env:CALLIOPA_RELEASE_BASE  where to download from (default GitHub Releases)

& {
    $ErrorActionPreference = 'Stop'
    $ProgressPreference = 'SilentlyContinue'

    # Written by the release; empty until the first one.
    $Version = '0.1.0'
    $SumsDigest = '30cd7779fda203ed7ef59d8dcc86c21c2457eea44df3e6f338eadbf5d6afcd41'

    if (-not $Version -or -not $SumsDigest) {
        throw 'calliopa install: this installer is not pinned to a release'
    }
    $arch = $env:PROCESSOR_ARCHITECTURE
    if ($arch -ne 'AMD64') {
        throw "calliopa install: Windows on $arch is not supported; calliopa runs on Windows amd64"
    }

    $asset = "calliopa_${Version}_windows_amd64.exe"
    $base = $env:CALLIOPA_RELEASE_BASE
    if (-not $base) { $base = "https://github.com/frankzickert/calliopa/releases/download/v$Version" }
    $dir = $env:CALLIOPA_INSTALL_DIR
    if (-not $dir) { $dir = Join-Path $env:LOCALAPPDATA 'Programs\calliopa' }
    $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("calliopa-" + [guid]::NewGuid())
    New-Item -ItemType Directory -Path $tmp | Out-Null

    try {
        Write-Host "Installing calliopa $Version ($asset)"
        $sums = Join-Path $tmp 'SHA256SUMS'
        Invoke-WebRequest -UseBasicParsing -Uri "$base/SHA256SUMS" -OutFile $sums
        if ((Get-FileHash -Algorithm SHA256 $sums).Hash.ToLower() -ne $SumsDigest) {
            throw 'calliopa install: SHA256SUMS does not match the digest this installer pins; nothing was installed'
        }
        $file = Join-Path $tmp $asset
        Invoke-WebRequest -UseBasicParsing -Uri "$base/$asset" -OutFile $file
        $want = Get-Content $sums | ForEach-Object {
            $f = $_ -split '\s+'
            if ($f[1] -eq $asset -or $f[1] -eq "*$asset") { $f[0] }
        } | Select-Object -First 1
        if (-not $want -or (Get-FileHash -Algorithm SHA256 $file).Hash.ToLower() -ne $want) {
            throw "calliopa install: $asset does not match SHA256SUMS; nothing was installed"
        }

        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        $exe = Join-Path $dir 'calliopa.exe'
        # A running calliopa.exe cannot be replaced, but it can be moved aside.
        if (Test-Path $exe) {
            $old = "$exe.old"
            Remove-Item -Force $old -ErrorAction SilentlyContinue
            Move-Item -Force $exe $old
        }
        Copy-Item $file $exe

        $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
        if (-not (($userPath -split ';') -contains $dir)) {
            [Environment]::SetEnvironmentVariable('Path', ($userPath.TrimEnd(';') + ";$dir").TrimStart(';'), 'User')
            $env:Path = "$env:Path;$dir"
            Write-Host "Added $dir to your PATH; new terminals will find calliopa."
        }
        Write-Host "Installed calliopa $Version to $exe"
        Write-Host 'Connect your agent with: calliopa agent install claude   (or: codex)'
    }
    finally {
        Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
    }
}
