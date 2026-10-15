$job = Start-Job {
  Add-Type -AssemblyName System.Speech
  Start-Sleep -Milliseconds 800
  $tts = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $tts.Rate = 0
  $tts.Volume = 100
  $tts.Speak('open notepad')
  $tts.Dispose()
}
$ffmpeg = 'C:\Users\Ujval\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe'
& $ffmpeg -hide_banner -f dshow -i audio='Microphone Array (Realtek(R) Audio)' -t 4 -af volumedetect -f null NUL 2>&1 | Select-String 'mean_volume|max_volume'
Wait-Job $job | Out-Null
Remove-Job $job
