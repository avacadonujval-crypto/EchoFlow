// Minimal WinMM waveIn recorder: records N seconds of 16 kHz mono PCM to a WAV file.
// Used to diagnose which Windows capture API works on this machine.
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

public static class WinmmRecord
{
    [StructLayout(LayoutKind.Sequential)]
    public struct WAVEFORMATEX
    {
        public ushort wFormatTag, nChannels;
        public uint nSamplesPerSec, nAvgBytesPerSec;
        public ushort nBlockAlign, wBitsPerSample, cbSize;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct WAVEHDR
    {
        public IntPtr lpData;
        public uint dwBufferLength, dwBytesRecorded;
        public IntPtr dwUser;
        public uint dwFlags, dwLoops;
        public IntPtr lpNext, reserved;
    }

    [DllImport("winmm.dll")]
    static extern int waveInOpen(out IntPtr h, uint dev, ref WAVEFORMATEX fmt, IntPtr cb, IntPtr inst, uint flags);
    [DllImport("winmm.dll")]
    static extern int waveInPrepareHeader(IntPtr h, ref WAVEHDR hdr, int size);
    [DllImport("winmm.dll")]
    static extern int waveInUnprepareHeader(IntPtr h, ref WAVEHDR hdr, int size);
    [DllImport("winmm.dll")]
    static extern int waveInAddBuffer(IntPtr h, ref WAVEHDR hdr, int size);
    [DllImport("winmm.dll")]
    static extern int waveInStart(IntPtr h);
    [DllImport("winmm.dll")]
    static extern int waveInStop(IntPtr h);
    [DllImport("winmm.dll")]
    static extern int waveInClose(IntPtr h);

    const uint WAVE_MAPPER = 0xFFFFFFFF;
    const uint WHDR_DONE = 1;

    public static void Main(string[] args)
    {
        int seconds = args.Length > 0 ? int.Parse(args[0]) : 8;
        string outPath = args.Length > 1 ? args[1] : "winmm-test.wav";

        var fmt = new WAVEFORMATEX
        {
            wFormatTag = 1,
            nChannels = 1,
            nSamplesPerSec = 16000,
            wBitsPerSample = 16,
        };
        fmt.nBlockAlign = (ushort)(fmt.nChannels * fmt.wBitsPerSample / 8);
        fmt.nAvgBytesPerSec = fmt.nSamplesPerSec * fmt.nBlockAlign;

        IntPtr h;
        int rc = waveInOpen(out h, WAVE_MAPPER, ref fmt, IntPtr.Zero, IntPtr.Zero, 0);
        if (rc != 0) { Console.WriteLine("waveInOpen failed: " + rc); return; }

        // 4 rotating buffers of 250ms each
        int bufBytes = (int)(fmt.nAvgBytesPerSec / 4);
        int bufCount = 4;
        var hdrs = new WAVEHDR[bufCount];
        var mem = new IntPtr[bufCount];
        for (int i = 0; i < bufCount; i++)
        {
            mem[i] = Marshal.AllocHGlobal(bufBytes);
            hdrs[i] = new WAVEHDR { lpData = mem[i], dwBufferLength = (uint)bufBytes };
            waveInPrepareHeader(h, ref hdrs[i], Marshal.SizeOf(typeof(WAVEHDR)));
            waveInAddBuffer(h, ref hdrs[i], Marshal.SizeOf(typeof(WAVEHDR)));
        }

        var pcm = new MemoryStream();
        waveInStart(h);
        var until = DateTime.UtcNow.AddSeconds(seconds);
        var tmp = new byte[bufBytes];
        while (DateTime.UtcNow < until)
        {
            for (int i = 0; i < bufCount; i++)
            {
                if ((hdrs[i].dwFlags & WHDR_DONE) != 0)
                {
                    int len = (int)hdrs[i].dwBytesRecorded;
                    if (len > 0)
                    {
                        Marshal.Copy(hdrs[i].lpData, tmp, 0, len);
                        pcm.Write(tmp, 0, len);
                    }
                    waveInUnprepareHeader(h, ref hdrs[i], Marshal.SizeOf(typeof(WAVEHDR)));
                    hdrs[i].dwFlags = 0;
                    hdrs[i].dwBytesRecorded = 0;
                    waveInPrepareHeader(h, ref hdrs[i], Marshal.SizeOf(typeof(WAVEHDR)));
                    waveInAddBuffer(h, ref hdrs[i], Marshal.SizeOf(typeof(WAVEHDR)));
                }
            }
            Thread.Sleep(20);
        }
        waveInStop(h);
        waveInClose(h);
        for (int i = 0; i < bufCount; i++) Marshal.FreeHGlobal(mem[i]);

        byte[] data = pcm.ToArray();
        using (var fs = new FileStream(outPath, FileMode.Create))
        using (var w = new BinaryWriter(fs))
        {
            w.Write(System.Text.Encoding.ASCII.GetBytes("RIFF"));
            w.Write(36 + data.Length);
            w.Write(System.Text.Encoding.ASCII.GetBytes("WAVEfmt "));
            w.Write(16); w.Write((ushort)1); w.Write((ushort)1);
            w.Write(16000); w.Write(32000); w.Write((ushort)2); w.Write((ushort)16);
            w.Write(System.Text.Encoding.ASCII.GetBytes("data"));
            w.Write(data.Length);
            w.Write(data);
        }
        Console.WriteLine("wrote " + data.Length + " bytes pcm");
    }
}
