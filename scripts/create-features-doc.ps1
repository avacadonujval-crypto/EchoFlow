$outPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'EchoFlow - Everything It Can Do.docx'

$content = @'
ECHOFLOW — EVERYTHING IT CAN DO

EchoFlow is a Windows desktop voice assistant. Hold Ctrl + Alt anywhere, speak, and it types what you say or runs what you ask.

Website: https://timely-manatee-98c8b3.netlify.app


HOW TO USE
• Hold Ctrl + Alt on your keyboard, speak your command or dictation, then release.
• Or open EchoFlow Hub and tap "Tap to speak".
• Or type a task in the Apps page "Run a task" box (same as speaking).


VOICE & LISTENING
• Push-to-talk works globally — in any app, anywhere on Windows.
• Pre-warmed microphone capture so your first word is never clipped.
• Works with whispers and quiet speech (gain boost + smart silence trimming).
• Detects if your mic is muted at Windows level and warns you instead of guessing.
• Floating overlay shows listening / processing status.
• Speech-to-text powered by Google Gemini with automatic model fallback for speed and reliability.


DICTATION (TYPE WHAT YOU SAY)
• Speaks into any text field — Word, Notepad, browser, Slack, email, etc.
• Auto-paste into the focused field (can be turned off in Settings).
• Plain dictation is never changed or executed as a command — your words are kept exactly.
• Can compose content for you: poems, emails, notes, lists — and type them into the active app.
• Say "and send it" (or Kannada/Hindi/Tamil equivalents) to press Enter after typing.


OPEN APPS & SOFTWARE
• Opens ANY installed app on your PC — 140+ apps indexed from the Start Menu.
• Win32 apps and Microsoft Store apps (WhatsApp, Spotify, Camera, etc.).
• Fuzzy name matching — say the app roughly how you think of it.
• Examples: "open WhatsApp", "open calculator", "open Chrome", "open File Explorer", "open Word".
• Refreshes app list automatically after you install something new.


WEB & BROWSER
• Open any website or URL — "go to github.com".
• YouTube search — "open YouTube and search lo-fi beats".
• Google / web search — "search for programming tutorials".
• Smart browser search — opens a fresh guest/private Chrome or Edge window so existing tabs do not block your search.
• Firefox private window support too.


SYSTEM CONTROLS
• Take a screenshot.
• Volume up and volume down.
• Mute / unmute system audio.
• Lock your PC.


CHAT & MESSAGING
• Send WhatsApp messages by voice — "open WhatsApp and send a message to Rahul saying I will be late".
• Telegram message automation supported.
• Finds the contact, opens the chat, types the message, and sends it.
• Works with "and send it" to auto-press Enter.


EMAIL (GMAIL & OUTLOOK)
• Send email by voice — "send an email to alex at gmail dot com saying I'll be late".
• Opens Gmail (default) or Outlook in the browser with To, Subject, and Body filled in.
• Understands spoken email addresses — "name at gmail dot com" becomes name@gmail.com.
• Shortcuts: say "my email" or "email of mine" if you saved your address in Settings.
• If something is missing (address, Gmail vs Outlook), EchoFlow opens Chat and asks you — then continues sending.


DOWNLOAD, INSTALL & UNINSTALL APPS
• "Download Telegram" or "install VLC" — finds the app via winget (official repo, not Microsoft Store) and installs in a visible terminal.
• Detects if the app is already installed and tells you to open it instead.
• Falls back to Google search in Chrome for the official download if winget has no match.
• "Uninstall Spotify" or "remove VLC" — uninstalls via winget in a visible window.
• Opens Windows Installed Apps settings if it cannot match the app name.


MULTI-STEP WORKFLOWS (DO SEVERAL THINGS IN ONE COMMAND)
• "Open Notepad and write a poem about rain" — opens app, types the poem.
• "Open Notepad, write hello and save it" — opens, types, presses Ctrl+S.
• "Open calculator and search what 2 plus 2 is" — opens Calculator, types 2+2=.
• "Open CMD and show my IP address" — opens Command Prompt, runs ipconfig.
• "Take a screenshot and open Paint" — screenshot then opens Paint.
• "Open Chrome and search Nike shoes" — guest browser search.
• Works inside connected apps: type text, press shortcuts (Ctrl+S, Ctrl+N, etc.).


FILE SEARCH
• "Open File Explorer and see if I have a document called budget" — searches your files via Windows search.


MULTILINGUAL (15+ LANGUAGES)
• Speak in Kannada, Hindi, Tamil, Telugu, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Urdu, English, Spanish, French, German, Arabic, Japanese, Korean, Chinese, and more.
• Auto-detect language or pick your language in Settings → Speech language.
• Commands work in your language — e.g. Kannada "ನೋಟ್ಪ್ಯಾಡ್ ತೆರೆ" opens Notepad.
• Dictation stays in your script — Kannada types as Kannada, not translated to English.
• Mixed speech works — e.g. "open Notepad and type ನಮಸ್ಕಾರ".


APP CONNECTOR (HUB → APPS PAGE)
• See all installed apps, search and connect your favorites.
• Connected apps get smarter automation — EchoFlow knows you use them and plans in-app tasks.
• Run any task by typing in the task box (no voice needed).


CUSTOMIZATION (SETTINGS)
• Custom aliases — map your own phrase to an action (e.g. "open my mail" → Gmail).
• Custom macros — chain multiple steps under one phrase you define.
• Default email app: Gmail, Outlook, or always ask in Chat.
• My email address — for "my email" / "email of mine" shortcuts.
• Speech language — auto-detect or fixed language.
• Auto-paste dictation on/off.
• Show/hide listening overlay.
• Launch EchoFlow at Windows startup.
• Command history — last 200 voice sessions stored locally.


CHAT ASSISTANT
• When EchoFlow needs a detail (email address, Gmail vs Outlook, etc.), it opens the Chat page and asks.
• Type your answer and it continues the task automatically.


PRIVACY & DATA
• Microphone is ONLY active while you hold Ctrl + Alt (or tap to speak).
• No always-on listening.
• Command history, aliases, and settings stored locally on your PC.
• Gemini API key stays in the main process — never shown in the app UI.
• Does not read your screen — only listens when you trigger it.


EXAMPLE PHRASES YOU CAN TRY
• "Open WhatsApp"
• "Search YouTube for programming tutorials"
• "Open Chrome and search best Nike shoes to buy"
• "Send a message to Mom saying good night and send it"
• "Send an email to my email saying test message"
• "Download Telegram"
• "Uninstall Spotify"
• "Take a screenshot"
• "Lock my computer"
• "Open Notepad and write a short poem about rain and save it"
• "ನೋಟ್ಪ್ಯಾಡ್ ತೆರೆ" (Kannada — open Notepad)
• "कैलकुलेटर खोलो" (Hindi — open Calculator)


REQUIREMENTS
• Windows 10 or 11 (64-bit)
• Microphone
• Internet connection for AI speech recognition and smart commands (basic offline matching for some English commands)


© EchoFlow — Speak. Type. Act.
'@

try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $doc = $word.Documents.Add()
  $doc.Content.Text = $content

  # Basic formatting: title bold + larger
  $range = $doc.Content
  $range.Find.Execute('ECHOFLOW — EVERYTHING IT CAN DO')
  if ($range.Found) {
    $range.Font.Bold = $true
    $range.Font.Size = 18
  }

  # Section headers bold
  $headers = @(
    'HOW TO USE', 'VOICE & LISTENING', 'DICTATION', 'OPEN APPS', 'WEB & BROWSER',
    'SYSTEM CONTROLS', 'CHAT & MESSAGING', 'EMAIL', 'DOWNLOAD', 'MULTI-STEP',
    'FILE SEARCH', 'MULTILINGUAL', 'APP CONNECTOR', 'CUSTOMIZATION', 'CHAT ASSISTANT',
    'PRIVACY', 'EXAMPLE PHRASES', 'REQUIREMENTS'
  )
  foreach ($h in $headers) {
    $r = $doc.Content
    $r.Find.Execute($h)
    if ($r.Found) { $r.Font.Bold = $true; $r.Font.Size = 13 }
  }

  if (Test-Path $outPath) { Remove-Item $outPath -Force }
  $doc.SaveAs([ref]$outPath, [ref]16) # wdFormatDocumentDefault = 16 (.docx)
  $doc.Close()
  $word.Quit()
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
  Write-Output "Saved: $outPath"
} catch {
  # Fallback: RTF on desktop if Word is not installed
  $rtfPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'EchoFlow - Everything It Can Do.rtf'
  $escaped = $content -replace '\\', '\\\\' -replace '\{', '\{' -replace '\}', '\}'
  $rtf = "{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Calibri;}}\\f0\\fs22 $escaped}"
  $rtf = $rtf -replace "`n", '\par '
  [System.IO.File]::WriteAllText($rtfPath, $rtf)
  Write-Output "Word not available. Saved RTF instead: $rtfPath"
  exit 1
}
