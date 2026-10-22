import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Download, RefreshCw, Share, X } from 'lucide-react'
import './PwaInstallExperience.css'

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
}

export default function PwaInstallExperience() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(isStandalone)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [iosInstructionsOpen, setIosInstructionsOpen] = useState(false)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('etg-tss-install-dismissed') === 'true')
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({ immediate: true })

  useEffect(() => {
    function onBeforeInstallPrompt(event) {
      event.preventDefault()
      setDeferredPrompt(event)
    }
    function onInstalled() {
      setInstalled(true)
      setDeferredPrompt(null)
      setDismissed(true)
      localStorage.removeItem('etg-tss-install-dismissed')
    }
    function onOnline() { setOffline(false) }
    function onOffline() { setOffline(true) }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  async function installApp() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  function dismissInstall() {
    setDismissed(true)
    localStorage.setItem('etg-tss-install-dismissed', 'true')
  }

  const canInstall = !installed && (Boolean(deferredPrompt) || (isIosDevice() && !isStandalone()))
  return <>
    {offline && <div className="pwa-status-banner pwa-offline" role="status"><strong>You’re offline.</strong><span>The app shell may open, but student records and other live data need the school server and an internet connection.</span></div>}
    {needRefresh && <div className="pwa-status-banner pwa-update" role="status"><span>A new version of ESTG TSS is ready.</span><button className="pwa-action" onClick={() => updateServiceWorker(true)}><RefreshCw size={15} />Update</button></div>}
    {canInstall && !dismissed && <aside className="pwa-install-banner" aria-label="Install ESTG TSS">
      <img src="/icons/etg-tss-192.png" alt="" width="40" height="40" />
      <div className="pwa-install-copy"><strong>Install ESTG TSS App</strong><span>Keep the school workspace one tap away.</span></div>
      {deferredPrompt
        ? <button className="pwa-action" onClick={installApp}><Download size={16} />Install</button>
        : <button className="pwa-action" onClick={() => setIosInstructionsOpen(true)}><Share size={16} />How to install</button>}
      <button className="pwa-dismiss" aria-label="Dismiss install suggestion" onClick={dismissInstall}><X size={17} /></button>
    </aside>}
    {iosInstructionsOpen && <div className="pwa-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIosInstructionsOpen(false) }}>
      <section className="pwa-modal" role="dialog" aria-modal="true" aria-labelledby="pwa-ios-title">
        <header><h2 id="pwa-ios-title">Add ESTG TSS to your Home Screen</h2><button className="pwa-dismiss" aria-label="Close instructions" onClick={() => setIosInstructionsOpen(false)}><X size={18} /></button></header>
        <ol>
          <li>Open the ESTG TSS website in <strong>Safari</strong>. Home Screen installation is not available from every iPhone browser.</li>
          <li>Tap Safari’s <strong>Share</strong> button (the square with an arrow pointing up).</li>
          <li>Scroll down and tap <strong>Add to Home Screen</strong>. On some iOS versions, tap <strong>Edit Actions</strong> if the option is not shown.</li>
          <li>Keep the name <strong>ESTG TSS</strong>, then tap <strong>Add</strong>.</li>
        </ol>
        <p>Open the new Home Screen icon to launch ESTG TSS in its app window. A secure HTTPS website is required.</p>
        <button className="pwa-action" onClick={() => setIosInstructionsOpen(false)}>Got it</button>
      </section>
    </div>}
  </>
}
