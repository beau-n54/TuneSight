using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

namespace TuneSight.Bridge {
    internal static class Program {
        internal const string Website = "https://tunesight-beta.vercel.app";
        internal const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
        internal const string RunName = "TuneSight Bridge";
        internal static string InstanceName { get { return @"Local\TuneSightBridge-" + WindowsIdentity.GetCurrent().User.Value; } }
        [STAThread] static int Main(string[] args) {
            bool created;
            using (var mutex = new Mutex(true, InstanceName, out created)) {
                if (args.Contains("--shutdown")) {
                    if (!created) {
                        try { using (var signal = EventWaitHandle.OpenExisting(InstanceName + "-stop")) signal.Set(); }
                        catch (WaitHandleCannotBeOpenedException) { return 2; }
                        try { if (!mutex.WaitOne(12000)) return 3; } catch (AbandonedMutexException) { }
                    }
                    mutex.ReleaseMutex(); return 0;
                }
                if (!created) return 0; // Never create another listener or take over an occupied port.
                try {
                    Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
                    if (!Environment.Is64BitOperatingSystem || Environment.OSVersion.Version < new Version(10, 0, 19041)) {
                        MessageBox.Show("Unsupported Windows version. TuneSight Bridge beta requires Windows 10 build 19041 or later, or Windows 11, x64.", "TuneSight Bridge"); return 4;
                    }
                    using (var context = new TrayContext()) Application.Run(context);
                    return 0;
                } finally { mutex.ReleaseMutex(); }
            }
        }
    }
    internal sealed class TrayContext : ApplicationContext {
        readonly NotifyIcon tray;
        readonly Control ui = new Control();
        readonly ToolStripMenuItem bridge = new ToolStripMenuItem("Bridge starting"), cable = new ToolStripMenuItem("Checking ENET cable"), dme = new ToolStripMenuItem("DME not connected"), autostart = new ToolStripMenuItem("Start with Windows");
        readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer { Interval = 3000 };
        readonly string logDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TuneSight", "Bridge", "Logs");
        readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = 16384 };
        readonly EventWaitHandle shutdown;
        readonly RegisteredWaitHandle shutdownWait;
        readonly HashSet<string> categories = new HashSet<string> { "ready", "cable_missing", "ethernet_ready", "unsupported_network", "connected", "disconnected", "vehicle_unavailable", "port_occupied", "startup_failed", "runtime_failed" };
        readonly Dictionary<string, string> last = new Dictionary<string, string>();
        Process child;
        IntPtr job;
        bool quitting, restarting, updateBusy, conflict;
        int failures;
        DateTime restartAt = DateTime.MinValue;
        public TrayContext() {
            ui.CreateControl();
            var access = new EventWaitHandleSecurity();
            access.AddAccessRule(new EventWaitHandleAccessRule(WindowsIdentity.GetCurrent().User, EventWaitHandleRights.FullControl, AccessControlType.Allow));
            bool created; shutdown = new EventWaitHandle(false, EventResetMode.AutoReset, Program.InstanceName + "-stop", out created, access);
            shutdownWait = ThreadPool.RegisterWaitForSingleObject(shutdown, (s, timedOut) => Post(Quit), null, -1, true);
            bridge.Enabled = cable.Enabled = dme.Enabled = false;
            var menu = new ContextMenuStrip();
            menu.Items.AddRange(new ToolStripItem[] { new ToolStripMenuItem("TuneSight Bridge " + BuildInfo.Version) { Enabled = false }, bridge, cable, dme,
                new ToolStripMenuItem("Browser permission: check TuneSight page") { Enabled = false }, new ToolStripSeparator() });
            menu.Items.Add("Open TuneSight", null, (s, e) => Open(Program.Website + "/dashboard"));
            menu.Items.Add("Restart Bridge", null, (s, e) => Restart());
            menu.Items.Add("Check for Update", null, async (s, e) => {
                if (updateBusy) return; updateBusy = true;
                string message = await System.Threading.Tasks.Task.Run<string>(() => CheckUpdate());
                updateBusy = false;
                if (!quitting) MessageBox.Show(message, "TuneSight Bridge updates", MessageBoxButtons.OK, MessageBoxIcon.Information);
            });
            autostart.Checked = IsAutostart(); autostart.Click += (s, e) => ToggleAutostart(); menu.Items.Add(autostart);
            menu.Items.Add("Diagnostic Logs", null, (s, e) => { Directory.CreateDirectory(logDirectory); Open(logDirectory); });
            menu.Items.Add("Export Diagnostic Report", null, (s, e) => ExportReport());
            menu.Items.Add(new ToolStripSeparator()); menu.Items.Add("Quit", null, (s, e) => Quit());
            tray = new NotifyIcon { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath), Text = "TuneSight Bridge", Visible = true, ContextMenuStrip = menu };
            tray.DoubleClick += (s, e) => Open(Program.Website + "/bridge");
            Log("app_started"); StartBridge();
            timer.Tick += (s, e) => { SendNetwork(); if (child == null && !conflict && failures < 3 && DateTime.UtcNow >= restartAt) StartBridge(); };
            timer.Start();
        }
        void Post(Action action) { if (quitting || ui.IsDisposed) return; try { ui.BeginInvoke(action); } catch (InvalidOperationException) { } }
        void Log(string category) {
            // Only internal constant categories reach this method. Never child text or exceptions.
            try {
                Directory.CreateDirectory(logDirectory);
                string file = Path.Combine(logDirectory, "bridge.log");
                if (File.Exists(file) && new FileInfo(file).Length > 262144) { string previous = Path.Combine(logDirectory, "bridge.previous.log"); if (File.Exists(previous)) File.Delete(previous); File.Move(file, previous); }
                File.AppendAllText(file, DateTime.UtcNow.ToString("o") + " app=" + BuildInfo.Version + " protocol=1 hosted-min=1 category=" + category + Environment.NewLine);
            } catch (IOException) { } catch (UnauthorizedAccessException) { }
        }
        void State(string category) {
            if (!categories.Contains(category)) return;
            string group = category == "cable_missing" || category == "ethernet_ready" || category == "unsupported_network" ? "network" : category == "connected" || category == "disconnected" || category == "vehicle_unavailable" ? "dme" : "bridge";
            string prior; if (last.TryGetValue(group, out prior) && prior == category) return;
            last[group] = category; Log(category);
            switch (category) {
                case "ready": bridge.Text = "Bridge ready"; break;
                case "cable_missing": cable.Text = "ENET cable not detected"; break;
                case "ethernet_ready": cable.Text = "Ethernet ready; ENET verified on Connect BMW"; break;
                case "unsupported_network": cable.Text = "Unsupported ENET network condition"; break;
                case "connected": dme.Text = "DME connected"; break;
                case "disconnected": dme.Text = "DME not connected"; break;
                case "vehicle_unavailable": dme.Text = "Vehicle ignition/DME not responding"; break;
                case "port_occupied": conflict = true; bridge.Text = "Port already occupied - close the other bridge"; break;
                default: bridge.Text = "Bridge unavailable - restart or export diagnostics"; break;
            }
        }
        void StartBridge() {
            if (quitting || child != null) return;
            restarting = false; last.Clear(); bridge.Text = "Bridge starting"; dme.Text = "DME not connected";
            try {
                var start = new ProcessStartInfo(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "runtime", "node.exe"), "--disable-warning=ExperimentalWarning --experimental-strip-types \"" + Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "runtime", "desktop", "bridge", "desktopBridge.ts") + "\"") {
                    UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true,
                    WorkingDirectory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "runtime")
                };
                // Installed profile is fixed. Node injection variables and developer overrides are not inherited.
                foreach (string key in start.EnvironmentVariables.Keys.Cast<string>().ToArray())
                    if (key.StartsWith("NODE_", StringComparison.OrdinalIgnoreCase) || key.StartsWith("TUNESIGHT_", StringComparison.OrdinalIgnoreCase)) start.EnvironmentVariables.Remove(key);
                var running = new Process { StartInfo = start, EnableRaisingEvents = true }; child = running;
                running.OutputDataReceived += (s, e) => { if (e.Data != null && e.Data.StartsWith("TSB:") && categories.Contains(e.Data.Substring(4))) Post(() => { if (child == running) State(e.Data.Substring(4)); }); };
                running.ErrorDataReceived += (s, e) => { /* Deliberately discard arbitrary stderr: never persist exception/request data. */ };
                running.Exited += (s, e) => Post(() => { if (child != running) return; CloseChildHandles(); if (!restarting && !conflict) { failures++; bridge.Text = failures < 3 ? "Bridge stopped; retrying" : "Bridge stopped - restart or export diagnostics"; restartAt = DateTime.UtcNow.AddSeconds(5); Log("child_exit"); } });
                running.Start(); job = Job.Create(running.Handle);
                running.BeginOutputReadLine(); running.BeginErrorReadLine(); SendNetwork();
            } catch { StopBridge(); failures = 3; bridge.Text = "Bridge startup failed - export diagnostics"; Log("startup_failed"); }
        }
        void SendNetwork() {
            if (child == null || child.HasExited) return;
            try {
                var ethernet = NetworkInterface.GetAllNetworkInterfaces().Where(n => n.NetworkInterfaceType == NetworkInterfaceType.Ethernet && n.OperationalStatus == OperationalStatus.Up).ToArray();
                var candidates = ethernet.SelectMany(n => n.GetIPProperties().UnicastAddresses).Where(a => a.Address.AddressFamily == AddressFamily.InterNetwork).Select(a => new { address = a.Address.ToString(), netmask = a.IPv4Mask.ToString() }).Take(32).ToArray();
                child.StandardInput.WriteLine(json.Serialize(new { kind = "network", ethernetUp = ethernet.Length > 0, interfaces = candidates })); child.StandardInput.Flush();
            } catch { State("unsupported_network"); }
        }
        void CloseChildHandles() { if (job != IntPtr.Zero) { Job.CloseHandle(job); job = IntPtr.Zero; } if (child != null) { child.Dispose(); child = null; } }
        void StopBridge() {
            if (child == null) return;
            restarting = true;
            try { if (!child.HasExited) { child.StandardInput.WriteLine("quit"); child.StandardInput.Flush(); if (!child.WaitForExit(2000)) child.Kill(); child.WaitForExit(2000); } } catch { }
            CloseChildHandles();
        }
        void Restart() { StopBridge(); failures = 0; conflict = false; Log("restart_requested"); StartBridge(); }
        bool IsAutostart() { using (var key = Registry.CurrentUser.OpenSubKey(Program.RunKey)) return key != null && (string)key.GetValue(Program.RunName, "") == "\"" + Application.ExecutablePath + "\""; }
        void ToggleAutostart() {
            try { using (var key = Registry.CurrentUser.CreateSubKey(Program.RunKey)) { if (IsAutostart()) key.DeleteValue(Program.RunName, false); else key.SetValue(Program.RunName, "\"" + Application.ExecutablePath + "\""); } autostart.Checked = IsAutostart(); Log(autostart.Checked ? "autostart_enabled" : "autostart_disabled"); }
            catch { MessageBox.Show("Could not change Start with Windows. No administrator access is required; check your account policy.", "TuneSight Bridge"); }
        }
        string CheckUpdate() {
            try {
                ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
                var request = (HttpWebRequest)WebRequest.Create(Program.Website + "/bridge/releases.json");
                request.AllowAutoRedirect = false; request.Timeout = 8000; request.ReadWriteTimeout = 8000;
                using (var response = (HttpWebResponse)request.GetResponse()) using (var stream = response.GetResponseStream()) using (var reader = new StreamReader(stream)) {
                    if (response.StatusCode != HttpStatusCode.OK) throw new IOException();
                    var buffer = new char[16385]; int count = 0, read;
                    while (count < buffer.Length && (read = reader.Read(buffer, count, buffer.Length - count)) > 0) count += read;
                    if (count == buffer.Length) throw new IOException();
                    var feed = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(new string(buffer, 0, count));
                    if (!feed.ContainsKey("schema") || Convert.ToInt32(feed["schema"]) != 1 || !feed.ContainsKey("latest")) throw new IOException();
                    if (feed["latest"] == null) return "No public installer release is available. This unsigned beta is for Founder testing only. No update was downloaded or installed.";
                    return "A release is listed. Open TuneSight > Bridge to review its version, checksum and signing status. Updates require your review and a downloaded installer; no update was installed automatically.";
                }
            } catch { return "Update check unavailable. Keep the installed bridge and retry later. No update was downloaded or installed."; }
        }
        void ExportReport() {
            using (var dialog = new SaveFileDialog { Filter = "Text report (*.txt)|*.txt", FileName = "TuneSight-Bridge-diagnostics.txt", OverwritePrompt = true }) {
                if (dialog.ShowDialog() != DialogResult.OK) return;
                try {
                    string report = "TuneSight Bridge " + BuildInfo.Version + "\r\nSource " + BuildInfo.Commit + "\r\nNode " + BuildInfo.NodeVersion + "\r\nUnsigned Founder beta\r\n" + bridge.Text + "\r\n" + cable.Text + "\r\n" + dme.Text + "\r\nBrowser Local Network Access: unknown to the desktop; inspect the hosted page.\r\n";
                    string file = Path.Combine(logDirectory, "bridge.log"); if (File.Exists(file)) report += File.ReadAllText(file);
                    File.WriteAllText(dialog.FileName, report); Log("report_exported");
                } catch { MessageBox.Show("Could not write the report. Choose a writable folder.", "TuneSight Bridge"); }
            }
        }
        void Open(string value) { try { Process.Start(new ProcessStartInfo(value) { UseShellExecute = true }); } catch { MessageBox.Show("Could not open the browser or folder. Visit " + Program.Website + "/bridge", "TuneSight Bridge"); } }
        void Quit() { if (quitting) return; quitting = true; timer.Stop(); StopBridge(); Log("app_stopped"); tray.Visible = false; ExitThread(); }
        protected override void Dispose(bool disposing) { if (disposing) { Quit(); shutdownWait.Unregister(null); shutdown.Dispose(); timer.Dispose(); tray.Dispose(); ui.Dispose(); } base.Dispose(disposing); }
    }
    // Closing the parent's job handle terminates only its own child, even after a host crash.
    internal static class Job {
        [StructLayout(LayoutKind.Sequential)] struct Basic { public long PerProcessUserTimeLimit, PerJobUserTimeLimit; public uint LimitFlags; public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize; public uint ActiveProcessLimit; public UIntPtr Affinity; public uint PriorityClass, SchedulingClass; }
        [StructLayout(LayoutKind.Sequential)] struct Io { public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount, ReadTransferCount, WriteTransferCount, OtherTransferCount; }
        [StructLayout(LayoutKind.Sequential)] struct Extended { public Basic BasicLimitInformation; public Io IoInfo; public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed; }
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
        [DllImport("kernel32.dll")] static extern bool SetInformationJobObject(IntPtr job, int infoClass, IntPtr info, uint length);
        [DllImport("kernel32.dll")] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
        [DllImport("kernel32.dll")] internal static extern bool CloseHandle(IntPtr handle);
        internal static IntPtr Create(IntPtr process) {
            IntPtr handle = CreateJobObject(IntPtr.Zero, null); var info = new Extended(); info.BasicLimitInformation.LimitFlags = 0x2000;
            int length = Marshal.SizeOf(info); IntPtr pointer = Marshal.AllocHGlobal(length);
            try { Marshal.StructureToPtr(info, pointer, false); if (handle == IntPtr.Zero || !SetInformationJobObject(handle, 9, pointer, (uint)length) || !AssignProcessToJobObject(handle, process)) { if (handle != IntPtr.Zero) CloseHandle(handle); throw new IOException("child_supervision_failed"); } return handle; }
            finally { Marshal.FreeHGlobal(pointer); }
        }
    }
}
