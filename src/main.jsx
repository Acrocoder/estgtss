import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PwaInstallExperience from './PwaInstallExperience.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <>
      <App />
      <PwaInstallExperience />
    </>
  </StrictMode>,
)
