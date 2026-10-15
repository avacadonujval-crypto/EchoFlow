// Reads mute + volume of default capture and render endpoints via CoreAudio.
using System;
using System.Runtime.InteropServices;

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
class MMDeviceEnumeratorComObject { }

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator
{
    int NotImpl1();
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice device);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice
{
    int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
}

[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume
{
    int RegisterControlChangeNotify(IntPtr notify);
    int UnregisterControlChangeNotify(IntPtr notify);
    int GetChannelCount(out uint count);
    int SetMasterVolumeLevel(float level, ref Guid ctx);
    int SetMasterVolumeLevelScalar(float level, ref Guid ctx);
    int GetMasterVolumeLevel(out float level);
    int GetMasterVolumeLevelScalar(out float level);
    int SetChannelVolumeLevel(uint ch, float level, ref Guid ctx);
    int SetChannelVolumeLevelScalar(uint ch, float level, ref Guid ctx);
    int GetChannelVolumeLevel(uint ch, out float level);
    int GetChannelVolumeLevelScalar(uint ch, out float level);
    int SetMute(bool mute, ref Guid ctx);
    int GetMute(out bool mute);
}

public static class AudioState
{
    static IAudioEndpointVolume GetVolume(int dataFlow)
    {
        var enumerator = (IMMDeviceEnumerator)(object)new MMDeviceEnumeratorComObject();
        IMMDevice device;
        enumerator.GetDefaultAudioEndpoint(dataFlow, 0, out device);
        var iid = typeof(IAudioEndpointVolume).GUID;
        object o;
        device.Activate(ref iid, 1, IntPtr.Zero, out o);
        return (IAudioEndpointVolume)o;
    }

    public static void Report()
    {
        var mic = GetVolume(1); // capture
        bool micMute; float micVol;
        mic.GetMute(out micMute);
        mic.GetMasterVolumeLevelScalar(out micVol);
        Console.WriteLine("MIC  mute=" + micMute + " volume=" + (micVol * 100).ToString("0") + "%");

        var spk = GetVolume(0); // render
        bool spkMute; float spkVol;
        spk.GetMute(out spkMute);
        spk.GetMasterVolumeLevelScalar(out spkVol);
        Console.WriteLine("SPKR mute=" + spkMute + " volume=" + (spkVol * 100).ToString("0") + "%");
    }

    public static void FixMic()
    {
        var mic = GetVolume(1);
        var ctx = Guid.Empty;
        mic.SetMute(false, ref ctx);
        mic.SetMasterVolumeLevelScalar(1.0f, ref ctx);
        Console.WriteLine("mic unmuted, volume 100%");
    }
}
