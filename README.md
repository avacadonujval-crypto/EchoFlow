# EchoFlow

Desktop voice assistant for Windows. Dictate into any text field, or speak a command to open apps, search, send messages, and run workflows.

## Features

- **Push-to-talk**: Hold `Ctrl` + `Alt`, speak, release
- **Dictation**: Transcript pastes into the focused app
- **On-device commands**: open apps and URLs, search, volume, lock, screenshot
- **Language service**: used only when a request needs more than the on-device matcher
- **Aliases and macros**, command history, tray app, listening overlay
- **Privacy-first**: no always-on mic, no screen reading, no credentials shown in the app

## Quick start

```bash
npm install
npm start
```

Build the Windows installer and stage it for the download site:

```bash
npm run build:release
```

The installer is placed in `release/` and copied to `website/downloads/`.

### Download website

```bash
npm run website:dev
```

Open http://localhost:8080. Deploy the `website/` folder with your hosting provider.

## Example commands

| You say | EchoFlow does |
| --- | --- |
| *(any sentence)* | Types into the active text field |
| Open Chrome | Launches Chrome |
| Open YouTube and search for the best video which teaches us programming | Opens YouTube search results |
| Search for React hooks | Google search |
| Take a screenshot | Win+Shift+S |
| Volume up / mute / lock screen | System actions |
| Start my workday *(after adding macro)* | Opens Chrome → Gmail → Slack |

## How a command runs

1. Hold **Ctrl + Alt** and speak
2. EchoFlow turns that clip into text
3. Simple commands run on the PC
4. Anything else goes to the language service, or the text is pasted as dictation

## Privacy

See in-app **Privacy** and `privacy-policy.html`.

## Requirements

- Windows 10/11
- Node.js 20+
- Microphone access
