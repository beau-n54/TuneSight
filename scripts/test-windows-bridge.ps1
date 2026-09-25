param([Parameter(Mandatory=$true)][string]$Installer, [Parameter(Mandatory=$true)][string]$InstallDirectory, [switch]$OccupiedPortOnly)
$ErrorActionPreference = 'Stop'
$install = [IO.Path]::GetFullPath($InstallDirectory)
if (Test-Path -LiteralPath $install) { throw 'Installer smoke test requires a new isolated directory' }
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{A909606A-7669-49C9-A7B5-6E8424637E57}_is1'
if ((Get-ItemProperty -Path $runKey -Name 'TuneSight Bridge' -ErrorAction SilentlyContinue) -or (Test-Path $uninstallKey)) { throw 'Existing TuneSight Bridge installation: use a clean test account instead of replacing it' }
$existing = Get-NetTCPConnection -LocalPort 57631 -State Listen -ErrorAction SilentlyContinue
if ($existing -and -not $OccupiedPortOnly) { throw 'Existing bridge listener: do not disturb it; close it yourself or test on another machine' }
if ($OccupiedPortOnly -and -not $existing) { throw 'Occupied-port-only test requires an existing listener and never creates one' }
$origin = 'https://tunesight-beta.vercel.app'
$headers = @{ Origin=$origin; 'Content-Type'='application/json' }
$exe = Join-Path $install 'TuneSightBridge.exe'
$summary = [ordered]@{ controlledInstallerSmoke=$true; cleanWindowsUser=$false; physicalVehicle=$false }
function Install-Beta {
    $process = Start-Process -FilePath $Installer -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/TASKS=autostart',("/DIR=`"$install`"")) -WindowStyle Hidden -PassThru -Wait
    if ($process.ExitCode -ne 0) { throw "Installer failed with exit $($process.ExitCode)" }
}
function Wait-Pair {
    for ($attempt=0; $attempt -lt 30; $attempt++) {
        try { return Invoke-RestMethod 'http://127.0.0.1:57631/v1/pair' -Headers $headers -TimeoutSec 1 } catch { Start-Sleep -Milliseconds 200 }
    }
    throw 'Packaged bridge never became ready'
}
function Stop-Beta {
    if (Test-Path -LiteralPath $exe) {
        $stop = Start-Process -FilePath $exe -ArgumentList '--shutdown' -WindowStyle Hidden -PassThru -Wait
        if ($stop.ExitCode -ne 0) { throw 'Packaged bridge did not shut down cleanly' }
    }
}
try {
    Install-Beta
    if (-not (Test-Path (Join-Path $install 'runtime\node.exe'))) { throw 'Bundled Node missing' }
    $autostart = (Get-ItemProperty -Path $runKey -Name 'TuneSight Bridge').'TuneSight Bridge'
    if ($autostart -ne "`"$exe`"") { throw 'Start with Windows did not register the installed executable' }
    $summary.install = 'passed'; $summary.autostartRegistration = 'passed (logon not exercised)'
    # Remove separately installed Node/Git from this process environment before launching the native host.
    $previousPath = $env:PATH
    try { $env:PATH = "$env:WINDIR\System32;$env:WINDIR"; $app = Start-Process -FilePath $exe -WindowStyle Hidden -PassThru } finally { $env:PATH = $previousPath }
    if ($OccupiedPortOnly) {
        Start-Sleep -Seconds 3
        $listenerAfter = Get-NetTCPConnection -LocalPort 57631 -State Listen
        if ($listenerAfter.OwningProcess -ne $existing.OwningProcess) { throw 'Existing listener changed during conflict-only test' }
        $log = Join-Path $env:LOCALAPPDATA 'TuneSight\Bridge\Logs\bridge.log'
        if (-not (Select-String -LiteralPath $log -SimpleMatch 'category=port_occupied' -Quiet)) { throw 'Packaged port conflict was not reported' }
        $second = Start-Process -FilePath $exe -WindowStyle Hidden -PassThru -Wait
        if ($second.ExitCode -ne 0 -or $app.HasExited) { throw 'Single instance failed' }
        $summary.singleInstance = 'passed'; $summary.portConflict = 'passed; existing listener unchanged'
        Install-Beta
        $summary.repair = 'passed in conflict-only mode'
        $summary.pairingRestartAndVehicle = 'not exercised: existing listener intentionally preserved'
    } else {
    $pair = Wait-Pair
    if ($pair.version.desktopVersion -ne '0.1.0-beta.1') { throw 'Incorrect packaged desktop version' }
    $summary.bundledRuntimeWithoutNodeOnPath = 'passed'
    $second = Start-Process -FilePath $exe -WindowStyle Hidden -PassThru -Wait
    if ($second.ExitCode -ne 0 -or $app.HasExited) { throw 'Single instance failed' }
    $summary.singleInstance = 'passed'
    $preflight = Invoke-WebRequest 'http://127.0.0.1:57631/v1/pair' -Method Options -Headers @{ Origin=$origin; 'Access-Control-Request-Method'='GET'; 'Access-Control-Request-Headers'='content-type'; 'Access-Control-Request-Private-Network'='true' }
    if ($preflight.StatusCode -ne 204 -or $preflight.Headers['Access-Control-Allow-Private-Network'] -ne 'true') { throw 'Packaged preflight failed' }
    $summary.hostedOriginHttpPairing = 'passed (HTTP contract; browser permission is separate)'
    $oldToken = $pair.token
    Stop-Beta
    $app = Start-Process -FilePath $exe -WindowStyle Hidden -PassThru
    $pair = Wait-Pair
    if ($pair.token -eq $oldToken) { throw 'Restart reused session credential' }
    $summary.restartTokenRenewal = 'passed'
    Install-Beta
    $app = Start-Process -FilePath $exe -WindowStyle Hidden -PassThru
    $pair = Wait-Pair
    $summary.repair = 'passed (same beta version; cross-version upgrade remains manual)'
    $listener = Get-NetTCPConnection -LocalPort 57631 -State Listen
    if (@($listener).Count -ne 1 -or $listener.LocalAddress -ne '127.0.0.1') { throw 'Packaged listener is not loopback only' }
    $summary.loopbackOnly = 'passed'
    Stop-Beta
    # Own the conflicting port. The app must leave this listener alone and provide a safe category.
    $conflict = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Parse('127.0.0.1'),57631)
    $conflict.Start()
    try {
        $app = Start-Process -FilePath $exe -WindowStyle Hidden -PassThru
        Start-Sleep -Seconds 3
        if (-not $conflict.Server.IsBound) { throw 'Bridge interfered with a conflicting listener' }
        $log = Join-Path $env:LOCALAPPDATA 'TuneSight\Bridge\Logs\bridge.log'
        if (-not (Select-String -LiteralPath $log -SimpleMatch 'category=port_occupied' -Quiet)) { throw 'Port conflict was not reported' }
        $contents = Get-Content -LiteralPath $log -Raw
        if ($contents.Contains($pair.token) -or $contents.Contains($oldToken)) { throw 'Credential found in local diagnostics' }
        $summary.portConflict = 'passed'; $summary.safeLogs = 'passed'
        Stop-Beta
    } finally { $conflict.Stop() }
    }
} finally {
    Stop-Beta
    $uninstaller = Join-Path $install 'unins000.exe'
    if (Test-Path -LiteralPath $uninstaller) {
        $removed = Start-Process -FilePath $uninstaller -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART') -WindowStyle Hidden -PassThru -Wait
        if ($removed.ExitCode -ne 0) { throw 'Uninstaller failed' }
        for ($attempt=0; $attempt -lt 30 -and (Test-Path -LiteralPath $exe); $attempt++) { Start-Sleep -Milliseconds 200 }
        if ((Test-Path -LiteralPath $exe) -or (Get-ItemProperty -Path $runKey -Name 'TuneSight Bridge' -ErrorAction SilentlyContinue)) { throw 'Uninstall left executable or startup registration' }
        $summary.uninstall = 'passed (bounded support logs retained as documented)'
    }
}
$summary | ConvertTo-Json
