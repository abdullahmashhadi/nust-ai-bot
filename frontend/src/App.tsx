import ChatWidget from './components/ChatWidget';
import './App.css';

function App() {
  // Get backend URL from environment variable or use default
  const serverUrl = import.meta.env.VITE_API_URL || 'https://nust-ai-bot.onrender.com';

  return (
    <div className="app-container">
      <ChatWidget
        serverUrl={serverUrl}
        position="center"
        theme="light"
        title="NUST Help Assistant"
        primaryColor="#1e40af"
      />
    </div>
  )
}

export default App