(function () {
  const link = document.getElementById('installer-link')
  const status = document.getElementById('installer-status')
  const sizeEl = document.getElementById('installer-size')
  const versionEl = document.getElementById('installer-version')
  const platformNotice = document.getElementById('platform-notice')
  const platformSteps = document.getElementById('platform-steps')
  const downloadExtra = document.getElementById('download-extra')
  const copyLinkBtn = document.getElementById('copy-link-btn')
  const shareLinkBtn = document.getElementById('share-link-btn')
  const copyStatus = document.getElementById('copy-status')
  const downloadBtn = document.getElementById('download-btn')
  const headerCta = document.querySelector('.header-cta')

  const INSTALLER_HOST = 'https://avacadonujval-crypto.github.io/EchoFlow'
  let VERSION = '1.0.0'
  let INSTALLER = `EchoFlow-Setup-${VERSION}.exe`
  let installerPath = `${INSTALLER_HOST}/downloads/${INSTALLER}`
  let listedSize = ''

  function detectPlatform() {
    const ua = navigator.userAgent
    const isAndroid = /Android/i.test(ua)
    const isIOS = /iPhone|iPad|iPod/i.test(ua)
    const isMobile =
      isAndroid ||
      isIOS ||
      /webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
      window.matchMedia('(max-width: 768px) and (pointer: coarse)').matches
    const isWindows = /Windows/i.test(ua)
    const isMac = /Macintosh|Mac OS X/i.test(ua) && !isIOS
    const isLinux = /Linux/i.test(ua) && !isAndroid

    let os = 'unknown'
    if (isAndroid) os = 'android'
    else if (isIOS) os = 'ios'
    else if (isWindows) os = 'windows'
    else if (isMac) os = 'mac'
    else if (isLinux) os = 'linux'

    const canInstallHere = isWindows && !isMobile
    return { isAndroid, isIOS, isMobile, isWindows, isMac, isLinux, os, canInstallHere }
  }

  const platform = detectPlatform()

  async function loadManifest() {
    try {
      const res = await fetch(`${INSTALLER_HOST}/downloads/manifest.json`)
      if (res.ok) {
        const m = await res.json()
        if (m.version) VERSION = m.version
        if (m.file) INSTALLER = m.file
        if (m.sizeBytes) listedSize = `${Math.round(m.sizeBytes / (1024 * 1024))} MB`
        if (m.url) {
          installerPath = m.url
          if (versionEl) versionEl.textContent = `v${VERSION} · Windows`
          return installerPath
        }
      }
    } catch {
      // use defaults
    }
    if (versionEl) versionEl.textContent = `v${VERSION} · Windows`
    installerPath = `${INSTALLER_HOST}/downloads/${INSTALLER}`
    return installerPath
  }

  function pageUrl() {
    return `${window.location.origin}${window.location.pathname}#download`
  }

  function applyInstallerLink(sizeText) {
    if (link) {
      link.href = installerPath
      link.removeAttribute('download')
    }
    if (headerCta && document.body.classList.contains('download-page')) {
      headerCta.href = installerPath
      headerCta.removeAttribute('download')
    }
    if (status) {
      status.textContent = 'Windows 10 and 11'
      status.style.color = ''
    }
    if (sizeText && sizeEl) sizeEl.textContent = sizeText
  }

  function configureDownloadUI() {
    if (platform.canInstallHere) {
      if (downloadBtn) {
        downloadBtn.textContent = 'Download for Windows'
        downloadBtn.href = 'download.html'
      }
      if (headerCta) headerCta.textContent = 'Download'
      if (platformNotice) platformNotice.hidden = true
      if (platformSteps) platformSteps.hidden = true
      if (downloadExtra) downloadExtra.hidden = true
      return
    }

    if (platformNotice) {
      platformNotice.hidden = false
      platformNotice.textContent = 'EchoFlow is for Windows 10 and 11.'
    }

    if (platformSteps) platformSteps.hidden = true

    if (downloadExtra) downloadExtra.hidden = false

    if (downloadBtn) {
      downloadBtn.textContent = 'Download for Windows'
      downloadBtn.href = 'download.html'
    }
    if (headerCta) headerCta.textContent = 'Download'
  }

  configureDownloadUI()

  async function checkInstaller() {
    await loadManifest()

    let sizeText = ''
    let ready = false
    try {
      const res = await fetch(installerPath, { method: 'HEAD' })
      if (res.ok) {
        ready = true
        const len = res.headers.get('content-length')
        if (len) {
          sizeText = `${Math.round(Number(len) / (1024 * 1024))} MB`
        }
      }
    } catch {
      ready = false
    }

    applyInstallerLink(sizeText || listedSize)
  }

  async function copyPageLink() {
    const url = pageUrl()
    try {
      await navigator.clipboard.writeText(url)
      if (copyStatus) {
        copyStatus.textContent = 'Link copied!'
        copyStatus.style.color = '#000'
      }
    } catch {
      if (copyStatus) {
        copyStatus.textContent = url
        copyStatus.style.color = ''
      }
    }
  }

  async function sharePage() {
    const url = pageUrl()
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'EchoFlow — Windows voice assistant',
          text: 'Download EchoFlow for Windows (speak to type and control apps).',
          url,
        })
        return
      } catch {
        // user cancelled or failed
      }
    }
    void copyPageLink()
  }

  copyLinkBtn?.addEventListener('click', () => void copyPageLink())
  shareLinkBtn?.addEventListener('click', () => void sharePage())

  link?.addEventListener('click', () => {
    if (status && platform.canInstallHere) {
      status.textContent = 'Downloading. If the browser pauses it, choose Keep.'
    }
  })

  // ── Rotating hero demo phrases ──
  const demoText = document.getElementById('demo-text')
  const demoPhrases = [
    '“Open Chrome and search Nike shoes to buy…”',
    '“Send an email to alex at gmail dot com saying I\'ll be late”',
    '“Open Notepad and write a poem about rain and save it”',
    '“Download Telegram”',
    '“Open WhatsApp and send a message to Mom saying good night”',
    '“Take a screenshot”',
    '“Lock my computer”',
    '“Open Notepad in Kannada”',
  ]
  let demoIdx = 0
  if (demoText) {
    setInterval(() => {
      demoIdx = (demoIdx + 1) % demoPhrases.length
      demoText.style.opacity = '0'
      demoText.style.transform = 'translateY(4px)'
      setTimeout(() => {
        demoText.textContent = demoPhrases[demoIdx]
        demoText.style.opacity = '1'
        demoText.style.transform = 'translateY(0)'
      }, 280)
    }, 3800)
  }

  void checkInstaller()
})()
