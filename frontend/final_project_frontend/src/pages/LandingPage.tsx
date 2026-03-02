type LandingPageProps = {
  onEnterHome: () => void
}

function LandingPage({ onEnterHome }: LandingPageProps) {
  return (
    <main className="landing-page">
      <div className="landing-card">
        <h1>Landing Page</h1>
        <p>Mock entry screen for the webapp.</p>
        <button type="button" onClick={onEnterHome}>
          Go To Home
        </button>
      </div>
    </main>
  )
}

export { LandingPage }
