import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/globals.css'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { getInitialTheme, applyTheme } from '@/utils/theme.util'
import App from '@/App.tsx'

// Synchronous theme init before React renders to prevent flash of wrong theme on page load
const initTheme = () => {
  const theme = getInitialTheme()
  applyTheme(theme)
}
initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
