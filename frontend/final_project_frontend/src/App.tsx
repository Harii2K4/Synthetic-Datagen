import { useState } from 'react'
import { HomePage } from './pages/HomePage'
import { LandingPage } from './pages/LandingPage'
import './App.css'

function App() {
  const [isHomeVisible, setIsHomeVisible] = useState(false)

  return isHomeVisible ? (
    <HomePage onBackToLanding={() => setIsHomeVisible(false)} />
  ) : (
    <LandingPage onEnterHome={() => setIsHomeVisible(true)} />
  )
}

export default App
