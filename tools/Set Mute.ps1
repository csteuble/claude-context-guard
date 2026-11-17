# Set Mute.ps1 (context-guard 1.0.9, 2026-11-17): sets the default playback device's mute state explicitly.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File "Set Mute.ps1" on|off
# Sets, never toggles, through the Windows Core Audio API (IAudioEndpointVolume::SetMute). No installs.
# Prints "Muted." or "Unmuted." (the state read back after the set) and exits 0; on any failure prints
# "FAILED: <reason>" and exits 1.
param([Parameter(Mandatory = $true)][ValidateSet('on', 'off')][string]$State)

$ErrorActionPreference = 'Stop'
try {
    if (-not ('ContextGuardMute.Endpoint' -as [type])) {
        Add-Type -Language CSharp -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace ContextGuardMute {
  [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioEndpointVolume {
    int NotImpl1(); int NotImpl2(); int GetChannelCount(out uint c);
    int SetMasterVolumeLevel(float l, ref Guid g); int SetMasterVolumeLevelScalar(float l, ref Guid g);
    int GetMasterVolumeLevel(out float l); int GetMasterVolumeLevelScalar(out float l);
    int SetChannelVolumeLevel(uint n, float l, ref Guid g); int SetChannelVolumeLevelScalar(uint n, float l, ref Guid g);
    int GetChannelVolumeLevel(uint n, out float l); int GetChannelVolumeLevelScalar(uint n, out float l);
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid g);
    int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
  }
  [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice {
    int Activate(ref Guid iid, int ctx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o);
  }
  [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator {
    int NotImpl1();
    int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice d);
  }
  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorCom { }
  public static class Endpoint {
    static IAudioEndpointVolume Vol() {
      var en = (IMMDeviceEnumerator)(new MMDeviceEnumeratorCom());
      IMMDevice dev;
      Marshal.ThrowExceptionForHR(en.GetDefaultAudioEndpoint(0, 1, out dev)); // eRender, eMultimedia
      Guid iid = typeof(IAudioEndpointVolume).GUID;
      object o;
      Marshal.ThrowExceptionForHR(dev.Activate(ref iid, 23, IntPtr.Zero, out o)); // CLSCTX_ALL
      return (IAudioEndpointVolume)o;
    }
    public static bool Set(bool mute) {
      var v = Vol();
      Guid g = Guid.Empty;
      Marshal.ThrowExceptionForHR(v.SetMute(mute, ref g));
      bool now;
      Marshal.ThrowExceptionForHR(v.GetMute(out now));
      return now;
    }
  }
}
'@
    }
    $want = ($State -eq 'on')
    $now = [ContextGuardMute.Endpoint]::Set($want)
    if ($now -ne $want) { throw "the device reads $(if ($now) { 'muted' } else { 'unmuted' }) after the set" }
    if ($now) { 'Muted.' } else { 'Unmuted.' }
    exit 0
} catch {
    "FAILED: $($_.Exception.Message)"
    exit 1
}
