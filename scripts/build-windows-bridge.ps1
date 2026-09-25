param(
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [string]$CompilerPath,
    [switch]$AllowUncommitted
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $repo
if ($env:OS -ne 'Windows_NT' -or -not [Environment]::Is64BitOperatingSystem) { throw 'Windows x64 build host required' }
$dirty = @(git status --porcelain)
if ($LASTEXITCODE -ne 0) { throw 'Git status failed' }
if ($dirty.Count -and -not $AllowUncommitted) { throw 'Release build requires a clean committed checkout' }
$commit = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $commit -notmatch '^[0-9a-f]{40}$') { throw 'Cannot resolve source commit' }
$versionSource = Get-Content -LiteralPath 'lib/vehicle-interface/bridgeVersion.ts' -Raw
$version = [regex]::Match($versionSource, 'DESKTOP_BRIDGE_VERSION = "([0-9]+\.[0-9]+\.[0-9]+-beta\.[0-9]+)"').Groups[1].Value
if (-not $version) { throw 'Explicit beta version required' }
$output = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $output) { throw 'Use a new empty output directory; existing build artifacts are never overwritten' }
New-Item -ItemType Directory -Path $output | Out-Null
$payload = Join-Path $output 'payload'
$runtime = Join-Path $payload 'runtime'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$nodeVersion = '24.14.1'
$zip = Join-Path $output 'node.zip'
Invoke-WebRequest "https://nodejs.org/download/release/v$nodeVersion/node-v$nodeVersion-win-x64.zip" -OutFile $zip
if ((Get-FileHash $zip -Algorithm SHA256).Hash -ne '6E50CE5498C0CEBC20FD39AB3FF5DF836ED2F8A31AA093CECAD8497CFF126D70') { throw 'Node archive checksum mismatch' }
Expand-Archive -LiteralPath $zip -DestinationPath (Join-Path $output 'node')
$nodeRoot = Join-Path $output "node\node-v$nodeVersion-win-x64"
$node = Join-Path $nodeRoot 'node.exe'
if ((Get-FileHash $node).Hash -ne '58E74BF02FC5BBACC41DCB8BEF089961CD5BDDD37830B87784E4FC624D145D1F') { throw 'Node executable checksum mismatch' }
$nodeSignature = Get-AuthenticodeSignature $node
if ($nodeSignature.Status -ne 'Valid' -or $nodeSignature.SignerCertificate.Subject -notmatch 'OpenJS Foundation') { throw 'Node publisher verification failed' }
Copy-Item -LiteralPath $node -Destination (Join-Path $runtime 'node.exe')
Copy-Item -LiteralPath (Join-Path $nodeRoot 'LICENSE') -Destination (Join-Path $runtime 'NODE-LICENSE.txt')
# Explicit runtime closure: only the existing transport and its dependencies, never subscriber files or .env.
$runtimeSources = @(
    'desktop/bridge/desktopBridge.ts', 'scripts/tunesightVehicleBridge.ts',
    'lib/vehicle-interface/bridgeVersion.ts', 'lib/vehicle-interface/bridgePairingContract.ts',
    'lib/vehicle-interface/bridgeSecurity.ts', 'lib/vehicle-interface/enetDiscovery.ts',
    'lib/vehicle-interface/enetObd.ts', 'lib/vehicle-interface/nativeVehicleData.ts',
    'lib/vehicle-interface/liveTelemetryPresentation.ts'
)
foreach ($source in $runtimeSources) {
    $target = Join-Path $runtime $source
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
    Copy-Item -LiteralPath (Join-Path $repo $source) -Destination $target
}
$utf8 = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $runtime 'package.json'), '{"private":true,"type":"module"}', $utf8)
Copy-Item -LiteralPath 'desktop/bridge/BETA-NOTICE.txt' -Destination $payload
$sourceLabel = $commit
if ($dirty.Count) { $sourceLabel += '-uncommitted-validation-only' }
$generated = Join-Path $output 'BuildInfo.cs'
[IO.File]::WriteAllText($generated, "using System.Reflection; [assembly: AssemblyVersion(`"0.1.0.0`")] [assembly: AssemblyInformationalVersion(`"$version`")] namespace TuneSight.Bridge { internal static class BuildInfo { internal const string Version = `"$version`"; internal const string Commit = `"$sourceLabel`"; internal const string NodeVersion = `"$nodeVersion`"; } }", $utf8)
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $csc /nologo /target:winexe /platform:x64 /optimize+ "/out:$payload\TuneSightBridge.exe" /reference:System.dll /reference:System.Core.dll /reference:System.Drawing.dll /reference:System.Windows.Forms.dll /reference:System.Web.Extensions.dll "/win32manifest:$repo\desktop\bridge\app.manifest" "/win32icon:$repo\app\favicon.ico" (Join-Path $repo 'desktop\bridge\TrayApplication.cs') $generated
if ($LASTEXITCODE -ne 0) { throw 'Native tray host compilation failed' }
[IO.File]::WriteAllText((Join-Path $payload 'TuneSightBridge.exe.config'), '<configuration><startup useLegacyV2RuntimeActivationPolicy="true"><supportedRuntime version="v4.0" sku=".NETFramework,Version=v4.8" /></startup></configuration>', $utf8)
if (-not $CompilerPath) {
    $compilerSetup = Join-Path $output 'innosetup-6.7.3.exe'
    Invoke-WebRequest 'https://github.com/jrsoftware/issrc/releases/download/is-6_7_3/innosetup-6.7.3.exe' -OutFile $compilerSetup
    if ((Get-FileHash $compilerSetup).Hash -ne '9C73C3BAE7ED48D44112A0F48E66742C00090BDB5BEF71D9D3C056C66E97B732') { throw 'Inno Setup checksum mismatch' }
    $signature = Get-AuthenticodeSignature $compilerSetup
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Pyrsys B.V.') { throw 'Inno Setup publisher verification failed' }
    $compilerDirectory = Join-Path $output 'compiler'
    $compilerInstall = Start-Process -FilePath $compilerSetup -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/CURRENTUSER','/NOICONS','/TASKS=',("/DIR=`"$compilerDirectory`"")) -WindowStyle Hidden -PassThru -Wait
    if ($compilerInstall.ExitCode -ne 0) { throw 'Inno Setup compiler installation failed' }
    $CompilerPath = Join-Path $compilerDirectory 'ISCC.exe'
}
# ISCC's PE ProductVersion is 0.0.0.0; pin the actual compiler binaries extracted from
# the checksum- and publisher-verified 6.7.3 installer instead.
$compilerHashes = @{
    'ISCC.exe'='0A8757031B33777E4C9CBFFEE40F11A5062B36D25CBE144C1DB73B6102B80AD7'
    'ISCmplr.dll'='85A1E3090D3A5B85319F001B7C8F9ECFAD45F37EFF030A67BBE29EF58B7AA2C3'
    'ISPP.dll'='BDE04BE7F4A55CA56AFB6B06600D7CBE8326FAC468AC3F2885B80EEFB3ED2A7A'
}
foreach ($name in $compilerHashes.Keys) {
    if ((Get-FileHash (Join-Path (Split-Path -Parent $CompilerPath) $name)).Hash -ne $compilerHashes[$name]) { throw 'Expected verified Inno Setup 6.7.3 compiler binaries' }
}
$artifacts = Join-Path $output 'artifacts'
& $CompilerPath "/DPayload=$payload" "/DOutput=$artifacts" "/DBridgeVersion=$version" 'desktop/bridge/installer.iss'
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed' }
$installer = Get-Item (Join-Path $artifacts "TuneSight-Bridge-$version-windows-x64-setup.exe")
$hash = (Get-FileHash $installer.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $artifacts 'SHA256SUMS.txt'), "$hash  $($installer.Name)`n", $utf8)
$manifest = [ordered]@{ schema=1; version=$version; protocolVersion=1; minimumHostedVersion=1; nodeVersion=$nodeVersion; sourceCommit=$sourceLabel; filename=$installer.Name; bytes=$installer.Length; sha256=$hash; signed=$false; releaseState='draft-beta'; physicalValidation='pending' }
[IO.File]::WriteAllText((Join-Path $artifacts 'release-manifest.json'), ($manifest | ConvertTo-Json) + "`n", $utf8)
$manifest | ConvertTo-Json
