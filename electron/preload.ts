import { contextBridge, ipcRenderer } from 'electron'
import type { ChatMessage, EchoFlowApi, SessionResult } from './types'

const api: EchoFlowApi = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (partial) => ipcRenderer.invoke('settings:update', partial),
  testGeminiKey: () => ipcRenderer.invoke('gemini:test'),
  listAliases: () => ipcRenderer.invoke('aliases:list'),
  saveAlias: (alias) => ipcRenderer.invoke('aliases:save', alias),
  deleteAlias: (id) => ipcRenderer.invoke('aliases:delete', id),
  listMacros: () => ipcRenderer.invoke('macros:list'),
  saveMacro: (macro) => ipcRenderer.invoke('macros:save', macro),
  deleteMacro: (id) => ipcRenderer.invoke('macros:delete', id),
  listSnippets: () => ipcRenderer.invoke('snippets:list'),
  saveSnippet: (snippet) => ipcRenderer.invoke('snippets:save', snippet),
  deleteSnippet: (id) => ipcRenderer.invoke('snippets:delete', id),
  listHistory: () => ipcRenderer.invoke('history:list'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  listChromeProfiles: () => ipcRenderer.invoke('chrome:list-profiles'),
  listInstalledApps: () => ipcRenderer.invoke('apps:list-installed'),
  listConnectedApps: () => ipcRenderer.invoke('apps:list-connected'),
  connectApp: (app) => ipcRenderer.invoke('apps:connect', app),
  disconnectApp: (appId) => ipcRenderer.invoke('apps:disconnect', appId),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  showHub: () => ipcRenderer.invoke('app:show-hub'),
  startListening: () => ipcRenderer.invoke('voice:manual-start'),
  stopListening: () => ipcRenderer.invoke('voice:manual-stop'),
  sendTranscript: (text) => ipcRenderer.invoke('voice:transcript', text),
  sendPartial: (text) => ipcRenderer.invoke('voice:partial', text),
  sendAudio: (base64, mimeType) =>
    ipcRenderer.invoke('voice:audio', { base64, mimeType }),
  getChatMessages: () => ipcRenderer.invoke('chat:list'),
  clearChat: () => ipcRenderer.invoke('chat:clear'),
  cancelClarify: () => ipcRenderer.invoke('chat:cancel-clarify'),
  getPendingQuestion: () => ipcRenderer.invoke('chat:pending'),
  onVoiceStart: (cb) => {
    const handler = () => cb()
    ipcRenderer.on('voice:start', handler)
    return () => ipcRenderer.removeListener('voice:start', handler)
  },
  onVoiceStop: (cb) => {
    const handler = () => cb()
    ipcRenderer.on('voice:stop', handler)
    return () => ipcRenderer.removeListener('voice:stop', handler)
  },
  onOverlayState: (cb) => {
    const handler = (_: unknown, state: Parameters<typeof cb>[0]) => cb(state)
    ipcRenderer.on('overlay:state', handler)
    return () => ipcRenderer.removeListener('overlay:state', handler)
  },
  onSessionResult: (cb) => {
    const handler = (_: unknown, result: SessionResult) => cb(result)
    ipcRenderer.on('session:result', handler)
    return () => ipcRenderer.removeListener('session:result', handler)
  },
  onHistoryUpdated: (cb) => {
    const handler = () => cb()
    ipcRenderer.on('history:updated', handler)
    return () => ipcRenderer.removeListener('history:updated', handler)
  },
  onChatUpdated: (cb) => {
    const handler = (_: unknown, messages: ChatMessage[]) => cb(messages)
    ipcRenderer.on('chat:updated', handler)
    return () => ipcRenderer.removeListener('chat:updated', handler)
  },
  onNavigate: (cb) => {
    const handler = (_: unknown, route: string) => cb(String(route ?? ''))
    ipcRenderer.on('app:navigate', handler)
    return () => ipcRenderer.removeListener('app:navigate', handler)
  },
  getVoiceStudio: () => ipcRenderer.invoke('voice-studio:get'),
  saveVoiceProfile: (input) => ipcRenderer.invoke('voice-studio:save', input),
  activateVoiceProfile: (id) => ipcRenderer.invoke('voice-studio:activate', id),
  deleteVoiceProfile: (id) => ipcRenderer.invoke('voice-studio:delete', id),
  getMembership: () => ipcRenderer.invoke('membership:get'),
  chooseMembership: (choice) => ipcRenderer.invoke('membership:choose', choice),
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowToggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
}

contextBridge.exposeInMainWorld('echoflow', api)
