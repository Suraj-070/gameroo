import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
        flexDirection:'column', gap:'1rem', padding:'2rem', textAlign:'center',
        fontFamily:'var(--font-body)', background:'var(--bg)',
      }}>
        <div style={{ fontSize:'3rem' }}>💥</div>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.25rem', color:'var(--text)' }}>
          Something went wrong
        </h2>
        <p style={{ color:'var(--text-3)', fontSize:'0.875rem', maxWidth:320 }}>
          An unexpected error occurred. Your game session is saved — refresh to continue.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <pre style={{ fontSize:'0.7rem', color:'var(--red)', background:'var(--red-light)', padding:'0.75rem', borderRadius:8, maxWidth:500, overflow:'auto', textAlign:'left' }}>
            {this.state.error?.toString()}
          </pre>
        )}
        <button
          onClick={() => window.location.reload()}
          style={{
            padding:'0.75rem 1.75rem', background:'var(--grad-brand)', color:'#fff',
            border:'none', borderRadius:'var(--radius)', fontFamily:'var(--font-display)',
            fontWeight:700, fontSize:'0.9rem', cursor:'pointer',
          }}
        >
          Refresh Page
        </button>
        <button
          onClick={() => { this.setState({ hasError:false }); window.location.href='/' }}
          style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:'0.82rem' }}
        >
          Back to Home
        </button>
      </div>
    )
  }
}
