$ErrorActionPreference = 'Stop'

# 1) Generate TTS wav "open notepad"
$wav = Join-Path $env:TEMP 'echoflow-e2e-open-notepad.wav'
Add-Type -AssemblyName System.Speech
$tts = New-Object System.Speech.Synthesis.SpeechSynthesizer
$tts.Rate = 0
$tts.Volume = 100
$tts.SetOutputToWaveFile($wav)
$tts.Speak('open notepad')
$tts.Dispose()

# 2) keybd_event for holding Ctrl+Alt
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class Kbd {
  [DllImport("user32.dll")]
  public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@
$KEYUP = 0x2

# 3) Hold Ctrl+Alt, play audio out loud, release
[Kbd]::keybd_event(0x11, 0, 0, [UIntPtr]::Zero)
[Kbd]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 400
$player = New-Object System.Media.SoundPlayer $wav
$player.PlaySync()
Start-Sleep -Milliseconds 400
[Kbd]::keybd_event(0x12, 0, $KEYUP, [UIntPtr]::Zero)
[Kbd]::keybd_event(0x11, 0, $KEYUP, [UIntPtr]::Zero)
Write-Output 'PTT session simulated'
