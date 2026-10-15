# EchoFlow — product status

EchoFlow is a Windows desktop voice assistant. Hold **Ctrl + Alt** anywhere, speak, and it either types what you said or does what you asked.

---

## How to run

```bash
npm install
npm start
```

Service credentials stay inside the app. They are never shown in Settings.

---

## What it does

### Voice
- Hold **Ctrl + Alt**, speak, release. Listening also works from the Hub.
- The microphone is ready before you speak, so the first word is not clipped.
- Quiet speech is boosted, silence is trimmed, and a muted microphone is rejected instead of inventing words.

### Understanding
- Common commands run on the PC immediately: open an app or URL, search, system actions, aliases, and macros.
- Anything else goes to EchoFlow’s language service, which decides whether you are giving an instruction or dictating text. Dictation is typed as spoken.

### Actions
| Action | Example |
|---|---|
| Dictation | "I think we should reschedule the meeting" |
| Open any app | "open WhatsApp", "open Word" |
| Open a site | "go to the company portal" |
| Search | "search for programming", "open YouTube and search lo-fi beats" |
| System | screenshot, volume, mute, lock |
| Chat | "open WhatsApp and send Rahul a message saying hello" |
| Workflows | "open Notepad, write a poem about rain, and save it" |
| Install or remove apps | "download Telegram", "uninstall Spotify" |
| Email | "send an email to alex at gmail dot com saying I'll be late" |
| Clarifying chat | If an address or mail app is missing, EchoFlow asks and then continues |
| Languages | Kannada, Hindi, Tamil, Telugu, and 15+ more, including mixed speech |

### Hub
- Home, Chat, Apps, Settings, and Privacy.
- Connect installed apps so later commands can work inside them.
- A small overlay shows listening and processing. It never names internal services.

---

## Privacy

Audio is captured only while you hold the shortcut or tap Speak. Simple commands stay on the PC. Complex commands may send the transcript, not the audio, to EchoFlow’s language service.
