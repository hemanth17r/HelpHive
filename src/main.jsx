import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Register Service Worker
import { registerSW } from 'virtual:pwa-register'
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Automatically reload the page when a new version of the PWA is available
    if (confirm("New content available. Reload?")) {
      updateSW(true);
    } else {
      // Force it anyway to avoid the bugs the user reported
      updateSW(true);
    }
  }
})
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
