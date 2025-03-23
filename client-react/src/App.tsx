import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  useMediaQuery,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import ExploreIcon from '@mui/icons-material/Explore';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import SendIcon from '@mui/icons-material/Send';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import LanguageIcon from '@mui/icons-material/Language';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './App.css';

interface Message {
  role: 'user' | 'model';
  content: string;
}

function App() {
  const [input, setInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(true);
  const [activeNavItem, setActiveNavItem] = useState('home');
  const [windowHeight, setWindowHeight] = useState(0);
  const [darkMode, setDarkMode] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useMediaQuery('(max-width:768px)');

  // Initialize dark mode based on system preference
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(prefersDark);
    
    // Listen for changes in system preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setDarkMode(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Effect to set window height
  useEffect(() => {
    setWindowHeight(window.innerHeight);
    
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Focus input on load
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Apply dark mode
  useEffect(() => {
    if (darkMode === null) return;
    
    if (darkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  }, [darkMode]);

  // Effect to initialize the app
  useEffect(() => {
    // Test API connection
    const testConnection = async () => {
      try {
        // Try a simple ping to the server with different URL approaches
        let apiBase;
        
        // First try: Direct access
        apiBase = window.location.hostname === 'localhost' 
                  ? 'http://localhost:9000' 
                  : `//${window.location.hostname}:9000`;
                  
        console.log(`Testing API connection at ${apiBase}/ping`);
        const response = await fetch(`${apiBase}/ping`, { method: 'GET' });
        
        if (response.ok) {
          console.log(`Successfully connected to API at ${apiBase}`);
          // Store the working base URL in localStorage for future use
          localStorage.setItem('apiBase', apiBase);
        } else {
          throw new Error(`API ping failed with status ${response.status}`);
        }
      } catch (error) {
        console.error('API connection test failed:', error);
        
        // Second try: API prefix
        try {
          const apiBase2 = `/api`;
          console.log(`Trying alternate API URL: ${apiBase2}/ping`);
          const response2 = await fetch(`${apiBase2}/ping`, { method: 'GET' });
          
          if (response2.ok) {
            console.log(`Successfully connected to API at ${apiBase2}`);
            localStorage.setItem('apiBase', apiBase2);
          } else {
            console.error(`All API connection attempts failed`);
          }
        } catch (fallbackError) {
          console.error('Fallback API connection test failed:', fallbackError);
        }
      }
    };
    
    testConnection();
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const getApiBaseUrl = () => {
    try {
      // Try to get from localStorage first
      const savedApiBase = localStorage.getItem('apiBase');
      if (savedApiBase) return savedApiBase;
      
      // Fallback logic if localStorage is not available or empty
      if (window.location.hostname === 'localhost') {
        return 'http://localhost:9000';
      }
      
      // For production
      return `//${window.location.hostname}:9000`;
    } catch (e) {
      // Fallback if localStorage is not available (like in incognito)
      if (window.location.hostname === 'localhost') {
        return 'http://localhost:9000';
      }
      return `//${window.location.hostname}:9000`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message to chat
    const userMessage: Message = { role: 'user', content: input };
    setChatHistory([...chatHistory, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const historyForApi = chatHistory.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }));

      const endpoint = isStreaming ? '/stream' : '/chat';
      const apiUrl = `${getApiBaseUrl()}${endpoint}`;
      
      console.log(`Sending request to: ${apiUrl}`);
      
      if (isStreaming) {
        let response;
        try {
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'text/plain, application/json',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            },
            credentials: 'omit', // Don't send credentials in incognito
            body: JSON.stringify({
              chat: input,
              history: historyForApi
            }),
          });
          
          if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
          }
        } catch (fetchError) {
          console.error("Fetch error:", fetchError);
          setChatHistory(prev => [...prev, { 
            role: 'model', 
            content: `Sorry, there was an error connecting to the server: ${fetchError.message}` 
          }]);
          setIsTyping(false);
          return;
        }

        // Add an empty message from the model to start with
        setChatHistory(prev => [...prev, { role: 'model', content: '' }]);
        
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        
        if (reader) {
          let modelResponse = '';
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                if (!modelResponse.trim()) {
                  throw new Error('No response received from server');
                }
                break;
              }
              
              const chunk = decoder.decode(value);
              modelResponse += chunk;
              
              setChatHistory(prev => {
                const newHistory = [...prev];
                newHistory[newHistory.length - 1] = {
                  role: 'model', 
                  content: modelResponse
                };
                return newHistory;
              });
            }
          } catch (streamError) {
            console.error("Stream reading error:", streamError);
            setChatHistory(prev => {
              const newHistory = [...prev];
              if (!newHistory[newHistory.length - 1].content.trim()) {
                newHistory[newHistory.length - 1] = {
                  role: 'model', 
                  content: `Sorry, there was an error processing the response: ${streamError.message}`
                };
              }
              return newHistory;
            });
          } finally {
            reader.releaseLock();
          }
        }
      } else {
        // Non-streaming approach
        let response;
        try {
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            },
            credentials: 'omit',
            body: JSON.stringify({
              chat: input,
              history: historyForApi
            }),
          });
          
          if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
          }
          
          const data = await response.json();
          setChatHistory(prev => [...prev, { role: 'model', content: data.text }]);
        } catch (fetchError) {
          console.error("Fetch error:", fetchError);
          setChatHistory(prev => [...prev, { 
            role: 'model', 
            content: `Sorry, there was an error with the request: ${fetchError.message}` 
          }]);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setChatHistory(prev => [...prev, { 
        role: 'model', 
        content: 'Sorry, there was an error processing your request.' 
      }]);
    } finally {
      setIsTyping(false);
      
      // Focus back on input after response
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    // Automatically focus the input
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const renderMobileNavigation = () => (
    <div className="mobile-nav">
      <div className="mobile-nav-inner">
        <div 
          className={`mobile-nav-item ${activeNavItem === 'home' ? 'active' : ''}`}
          onClick={() => setActiveNavItem('home')}
        >
          <HomeIcon />
          <span>Home</span>
        </div>
        <div 
          className={`mobile-nav-item ${activeNavItem === 'discover' ? 'active' : ''}`}
          onClick={() => setActiveNavItem('discover')}
        >
          <ExploreIcon />
          <span>Discover</span>
        </div>
        <div 
          className={`mobile-nav-item ${activeNavItem === 'spaces' ? 'active' : ''}`}
          onClick={() => setActiveNavItem('spaces')}
        >
          <BookmarkIcon />
          <span>Spaces</span>
        </div>
        <div 
          className={`mobile-nav-item ${activeNavItem === 'account' ? 'active' : ''}`}
          onClick={() => setActiveNavItem('account')}
        >
          <PersonOutlineIcon />
          <span>Sign in</span>
        </div>
      </div>
    </div>
  );

  // Determine whether to show footer based on screen size
  const shouldShowFooter = !isMobile || windowHeight > 667;
  
  // Brand color - adjust based on dark mode
  const brandColor = darkMode ? '#6bb5ff' : '#0B0B45';

  const renderMessage = (message: Message) => {
    if (message.role === 'user') {
      return (
        <div className={`message user-message ${darkMode ? 'dark-mode' : ''}`}>
          <div className="message-content">
            {message.content}
          </div>
        </div>
      );
    }

    // Split the message into parts (main text, disclaimer, suggestions)
    const parts = message.content.split('\n\n');
    const mainText = parts.slice(0, -2).join('\n\n');
    const disclaimer = parts[parts.length - 2]?.includes('*') ? parts[parts.length - 2] : '';
    const suggestionsText = parts[parts.length - 1];

    // Extract suggestions (looking for lines starting with specific emojis)
    const suggestions = suggestionsText
      ?.split('\n')
      .filter(line => line.match(/^[🤔📈💰💡]/))
      .map(line => line.trim())
      .filter(line => line.length > 0);

    return (
      <div className={`message model-message ${darkMode ? 'dark-mode' : ''}`}>
        <div className="message-content">
          <div className="markdown-content">
            <ReactMarkdown>{mainText}</ReactMarkdown>
          </div>
          {disclaimer && (
            <div className="disclaimer">
              <ReactMarkdown>{disclaimer}</ReactMarkdown>
            </div>
          )}
        </div>
        {suggestions && suggestions.length > 0 && (
          <div className="suggestions-container">
            <div className="suggestions-scroll">
              {[...suggestions, ...suggestions].map((suggestion, index) => (
                <div
                  key={index}
                  className="suggestion-box"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`app-container ${darkMode ? 'dark-mode' : 'light-mode'}`}>
      {/* Left Sidebar - Hidden on mobile */}
      <aside className="sidebar">
        <div className="sidebar-logo" style={{ cursor: 'pointer' }} onClick={() => setChatHistory([])}>
          <MonetizationOnIcon sx={{ color: brandColor, fontSize: 24, mr: 1 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: brandColor }}>
            FinWise
          </Typography>
        </div>
        
        <nav className="sidebar-nav">
          <div 
            className={`nav-item ${activeNavItem === 'home' ? 'active' : ''}`}
            onClick={() => setActiveNavItem('home')}
          >
            <HomeIcon />
            Home
          </div>
          <div 
            className={`nav-item ${activeNavItem === 'discover' ? 'active' : ''}`}
            onClick={() => setActiveNavItem('discover')}
          >
            <ExploreIcon />
            Discover
          </div>
          <div 
            className={`nav-item ${activeNavItem === 'spaces' ? 'active' : ''}`}
            onClick={() => setActiveNavItem('spaces')}
          >
            <BookmarkIcon />
            Spaces
          </div>
        </nav>
        
        <div className="auth-buttons">
          <button 
            style={{
              width: '100%',
              padding: '8px 0',
              margin: '6px 0',
              backgroundColor: darkMode ? '#2a2a2a' : '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600
            }}
          >
            Sign Up
          </button>
          <button
            style={{
              width: '100%',
              padding: '8px 0',
              backgroundColor: 'transparent',
              color: darkMode ? '#999' : '#666',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Log in
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Mobile header */}
        {isMobile && (
          <div style={{ 
            padding: '16px 16px 0', 
            display: 'flex', 
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div 
              style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} 
              onClick={() => setChatHistory([])}
            >
              <MonetizationOnIcon sx={{ color: brandColor, fontSize: 24, mr: 1 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: brandColor }}>
                FinWise
              </Typography>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button
                onClick={toggleDarkMode}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  marginRight: '8px',
                  color: darkMode ? '#e6e6e6' : '#666'
                }}
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
              </button>
            </div>
          </div>
        )}
        
        {activeNavItem === 'discover' ? (
          <div className="discover-container">
            <h1 className="discover-title">Indian Markets</h1>
            
            <div className="market-grid">
              {/* Market indices card */}
              <div className="market-card">
                <h2>Key Indices</h2>
                <div className="index-row">
                  <div className="index-name">Nifty 50</div>
                  <div className="index-value">22,045.75</div>
                  <div className="index-change positive">+0.74%</div>
                </div>
                <div className="index-row">
                  <div className="index-name">Sensex</div>
                  <div className="index-value">72,643.27</div>
                  <div className="index-change positive">+0.68%</div>
                </div>
                <div className="index-row">
                  <div className="index-name">Nifty Bank</div>
                  <div className="index-value">48,273.90</div>
                  <div className="index-change negative">-0.21%</div>
                </div>
                <div className="index-row">
                  <div className="index-name">Nifty IT</div>
                  <div className="index-value">38,216.15</div>
                  <div className="index-change positive">+1.87%</div>
                </div>
              </div>
              
              {/* Top gainers card */}
              <div className="market-card">
                <h2>Top Gainers</h2>
                <div className="stock-row">
                  <div className="stock-name">Tata Motors</div>
                  <div className="stock-value">₹922.45</div>
                  <div className="stock-change positive">+3.81%</div>
                </div>
                <div className="stock-row">
                  <div className="stock-name">Infosys</div>
                  <div className="stock-value">₹1,587.30</div>
                  <div className="stock-change positive">+3.23%</div>
                </div>
                <div className="stock-row">
                  <div className="stock-name">TCS</div>
                  <div className="stock-value">₹3,967.75</div>
                  <div className="stock-change positive">+2.89%</div>
                </div>
                <div className="stock-row">
                  <div className="stock-name">HCL Tech</div>
                  <div className="stock-value">₹1,471.60</div>
                  <div className="stock-change positive">+2.75%</div>
                </div>
              </div>
              
              {/* Market sentiment gauge */}
              <div className="market-card">
                <h2>Market Sentiment</h2>
                <div className="sentiment-gauge">
                  <div className="gauge-label">Bullish</div>
                  <div className="gauge-bar">
                    <div className="gauge-fill" style={{ width: '65%' }}></div>
                  </div>
                  <div className="gauge-value">65</div>
                </div>
                <div className="sentiment-stats">
                  <div className="stat-item">
                    <div className="stat-label">Advance-Decline</div>
                    <div className="stat-value">1,822 : 814</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Market Breadth</div>
                    <div className="stat-value">Positive</div>
                  </div>
                </div>
              </div>
              
              {/* Market Calendar */}
              <div className="market-card">
                <h2>Upcoming Events</h2>
                <div className="calendar-item">
                  <div className="event-date">Jun 28</div>
                  <div className="event-details">
                    <div className="event-title">RBI Policy Meeting</div>
                    <div className="event-desc">Expected to maintain status quo on rates</div>
                  </div>
                </div>
                <div className="calendar-item">
                  <div className="event-date">Jul 12</div>
                  <div className="event-details">
                    <div className="event-title">Quarterly Results</div>
                    <div className="event-desc">TCS & Infosys Q1 results</div>
                  </div>
                </div>
                <div className="calendar-item">
                  <div className="event-date">Jul 15</div>
                  <div className="event-details">
                    <div className="event-title">CPI Inflation Data</div>
                    <div className="event-desc">June inflation numbers to be released</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {chatHistory.length === 0 ? (
              <div className="empty-state">
                <h1>What do you want to know?</h1>
                
                {/* Chat Input */}
                <div className="chat-input-container">
                  <form className="chat-input-form" onSubmit={handleSubmit}>
                    <input
                      ref={inputRef}
                      type="text"
                      className="chat-input"
                      placeholder="Ask anything..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                    />
                    <button 
                      type="submit" 
                      className="chat-submit" 
                      disabled={isTyping || !input.trim()}
                      aria-label="Send message"
                    >
                      <SendIcon />
                    </button>
                  </form>
                </div>
                
                {/* Suggestion Section */}
                <Box sx={{ width: '100%', mt: 4, maxWidth: '600px' }}>
                  <div className="suggestion-item" onClick={() => handleSuggestionClick("What are good mutual funds for long-term investment in India?")}>
                    "What are good mutual funds for long-term investment in India?"
                  </div>
                  <div className="suggestion-item" onClick={() => handleSuggestionClick("Explain the tax implications of short-term vs long-term capital gains in India")}>
                    "Explain the tax implications of short-term vs long-term capital gains in India"
                  </div>
                  <div className="suggestion-item" onClick={() => handleSuggestionClick("How should I diversify my portfolio in the current market conditions?")}>
                    "How should I diversify my portfolio in the current market conditions?"
                  </div>
                </Box>
              </div>
            ) : (
              <>
                <div className="message-list">
                  {chatHistory.map((message, index) => (
                    renderMessage(message))
                  )}
                  {isTyping && (
                    <div className="message-item ai-message">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CircularProgress size={16} thickness={6} sx={{ mr: 2, color: brandColor }} />
                        <Typography>Thinking...</Typography>
                      </Box>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                
                {/* Chat Input for conversations */}
                <div className="chat-input-container" style={{ margin: '20px auto 40px' }}>
                  <form className="chat-input-form" onSubmit={handleSubmit}>
                    <input
                      ref={inputRef}
                      type="text"
                      className="chat-input"
                      placeholder="Ask follow-up questions..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      disabled={isTyping}
                    />
                    <button 
                      type="submit" 
                      className="chat-submit" 
                      disabled={isTyping || !input.trim()}
                      aria-label="Send message"
                    >
                      <SendIcon />
                    </button>
                  </form>
                </div>
              </>
            )}
          </>
        )}
        
        {/* Footer - hidden on smaller mobiles */}
        {shouldShowFooter && (
          <footer className="footer">
            <a href="#" className="footer-link">Pro</a>
            <a href="#" className="footer-link">Blog</a>
            <a href="#" className="footer-link">Careers</a>
            <a href="#" className="footer-link">
              <LanguageIcon sx={{ fontSize: 16, mr: 0.5 }} />
              English
            </a>
            {!isMobile && (
              <a href="#" className="footer-link" style={{ marginLeft: 'auto' }} onClick={toggleDarkMode}>
                {darkMode ? <Brightness7Icon sx={{ fontSize: 18 }} /> : <Brightness4Icon sx={{ fontSize: 18 }} />}
              </a>
            )}
            <a href="#" className="footer-link" style={{ marginLeft: isMobile ? 'auto' : '8px' }}>
              <HelpOutlineIcon sx={{ fontSize: 18 }} />
            </a>
          </footer>
        )}
        
        {/* Mobile Navigation */}
        {isMobile && renderMobileNavigation()}
      </main>
    </div>
  );
}

export default App; 