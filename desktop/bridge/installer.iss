#ifndef Payload
  #error Payload must be supplied by build-windows-bridge.ps1
#endif
#ifndef Output
  #error Output must be supplied by build-windows-bridge.ps1
#endif
#ifndef BridgeVersion
  #error BridgeVersion must be supplied by build-windows-bridge.ps1
#endif
[Setup]
AppId={{A909606A-7669-49C9-A7B5-6E8424637E57}
AppName=TuneSight Bridge
AppVersion={#BridgeVersion}
AppPublisher=TuneSight
AppPublisherURL=https://tunesight-beta.vercel.app/bridge
DefaultDirName={localappdata}\Programs\TuneSight Bridge
DefaultGroupName=TuneSight Bridge
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.19041
OutputDir={#Output}
OutputBaseFilename=TuneSight-Bridge-{#BridgeVersion}-windows-x64-setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\TuneSightBridge.exe
CloseApplications=no
RestartApplications=no
UsePreviousTasks=yes
SetupLogging=no
DisableProgramGroupPage=yes
LicenseFile={#Payload}\BETA-NOTICE.txt
[Files]
Source: "{#Payload}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
[Tasks]
Name: "autostart"; Description: "Start TuneSight Bridge with Windows"; Flags: checkedonce
[Icons]
Name: "{group}\TuneSight Bridge"; Filename: "{app}\TuneSightBridge.exe"
Name: "{group}\Uninstall TuneSight Bridge"; Filename: "{uninstallexe}"
[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "TuneSight Bridge"; ValueData: """{app}\TuneSightBridge.exe"""; Tasks: autostart; Flags: uninsdeletevalue
[Run]
Filename: "{app}\TuneSightBridge.exe"; Description: "Start TuneSight Bridge"; Flags: nowait postinstall skipifsilent
[Code]
function StopExisting(): Boolean;
var ResultCode: Integer;
begin
  Result := True;
  if FileExists(ExpandConstant('{app}\TuneSightBridge.exe')) then
    Result := Exec(ExpandConstant('{app}\TuneSightBridge.exe'), '--shutdown', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;
function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  if not StopExisting() then Result := 'Close TuneSight Bridge from its tray menu and retry. No unrelated process will be stopped.';
end;
function InitializeUninstall(): Boolean;
begin
  Result := StopExisting();
  if not Result then MsgBox('Close TuneSight Bridge from its tray menu and retry removal.', mbError, MB_OK);
end;
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if (CurStep = ssPostInstall) and not WizardIsTaskSelected('autostart') then
    RegDeleteValue(HKEY_CURRENT_USER, 'Software\Microsoft\Windows\CurrentVersion\Run', 'TuneSight Bridge');
end;
