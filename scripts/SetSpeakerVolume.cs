// Sets default speaker volume (scalar 0-1) via CoreAudio.
using System;
using System.Runtime.InteropServices;

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
class MMDeviceEnumeratorComObject2 { }

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator2
{
    int NotImpl1();
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice2 device);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice2
{
    int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
}

[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume2
{
    int RegisterControlChangeNotify(IntPtr notify);
    int UnregisterControlChangeNotify(IntPtr notify);
    int GetChannelCount(out uint count);
    int SetMasterVolumeLevel(float level, ref Guid ctx);
    int SetMasterVolumeLevelScalar(float level, ref Guid ctx);
    int GetMasterVolumeLevel(out float level);
    int GetMasterVolumeLevelScalar(out float level);
}

public static class SpeakerVolume
{
    public static void Set(double level)
    {
        var enumerator = (IMMDeviceEnumerator2)(object)new MMDeviceEnumeratorComObject2();
        IMMDevice2 device;
        enumerator.GetDefaultAudioEndpoint(0, 0, out device);
        var iid = typeof(IAudioEndpointVolume2).GUID;
        object o;
        device.Activate(ref iid, 1, IntPtr.Zero, out o);
        var vol = (IAudioEndpointVolume2)o;
        var ctx = Guid.Empty;
        vol.SetMasterVolumeLevelScalar((float)level, ref ctx);
        float now;
        vol.GetMasterVolumeLevelScalar(out now);
        Console.WriteLine("speaker volume now " + (now * 100).ToString("0") + "%");
    }
}
