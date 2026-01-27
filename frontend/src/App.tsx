import { useState } from 'react';
import ChatWidget from './components/ChatWidget';
import './App.css';

function App() {
  const [showChat, setShowChat] = useState(false);
  const serverUrl = import.meta.env.VITE_API_URL || 'https://nust-ai-bot.onrender.com';

  const features = [
    { icon: '📅', title: 'NET Schedule', desc: 'Get test dates for all series' },
    { icon: '💰', title: 'Fee Structure', desc: 'Detailed fee breakdowns' },
    { icon: '✅', title: 'Eligibility', desc: 'Check admission requirements' },
    { icon: '📝', title: 'Results', desc: 'NET result announcements' },
    { icon: '🎓', title: 'Programs', desc: 'Info about all programs' },
    { icon: '🏠', title: 'Campus Info', desc: 'Facilities and locations' },
  ];

  const queryExamples = [
    "When is NET Series-4 in Karachi?",
    "Can Pre-Med students apply for Engineering?",
    "What are the fees for Engineering programs?",
    "FSc Arts eligibility for NET?",
  ];

  return (
    <div className="app-wrapper">
      {!showChat && (
        <div className="landing-page">
          <div className="stars"></div>
          <div className="stars2"></div>
          <div className="stars3"></div>
          
          <div className="landing-content">
            <div className="hero-section">
              <div className="nust-badge">
                <span className="badge-dot"></span>
                NUST Admissions 2026
              </div>
              
              <h1 className="main-title">
                <span className="gradient-text">NUST AI Chatbot</span>
              </h1>
              
              <p className="subtitle">
                Your intelligent assistant for NUST admissions, powered by advanced AI
              </p>

              <button className="cta-button" onClick={() => setShowChat(true)}>
                <span className="button-shine"></span>
                <span className="button-text">Start Chatting</span>
                <svg className="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            <div className="features-grid">
              {features.map((feature, idx) => (
                <div key={idx} className="feature-card" style={{ animationDelay: `${idx * 0.1}s` }}>
                  <div className="feature-icon">{feature.icon}</div>
                  <h3 className="feature-title">{feature.title}</h3>
                  <p className="feature-desc">{feature.desc}</p>
                </div>
              ))}
            </div>

            <div className="examples-section">
              <h2 className="examples-title">Try asking:</h2>
              <div className="examples-grid">
                {queryExamples.map((query, idx) => (
                  <button 
                    key={idx} 
                    className="example-chip"
                    onClick={() => setShowChat(true)}
                  >
                    {query}
                  </button>
                ))}
              </div>
            </div>

            <div className="capabilities-section">
              <div className="capability">
                <span className="check-icon">✓</span>
                <span>Real-time NET schedule updates</span>
              </div>
              <div className="capability">
                <span className="check-icon">✓</span>
                <span>Handles Urdu-English mixed queries</span>
              </div>
              <div className="capability">
                <span className="check-icon">✓</span>
                <span>Accurate eligibility criteria</span>
              </div>
              <div className="capability">
                <span className="check-icon">✓</span>
                <span>Comprehensive program information</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Overlay */}
      {showChat && (
        <div className="chat-overlay">
          <div className="chat-overlay-backdrop" onClick={() => setShowChat(false)}></div>
          <div className="chat-overlay-content">
            <button className="chat-close-button" onClick={() => setShowChat(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChatWidget
                serverUrl={serverUrl}
                position="center"
                theme="light"
                title="NUST AI Assistant"
                primaryColor="#3B82F6"
                forceOpen={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App