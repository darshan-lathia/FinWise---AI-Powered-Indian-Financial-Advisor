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
import './styles/ScrollFix.css';
import MessageDisplay from './components/MessageDisplay';
import { Message } from './types';

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
    const userMessage: Message = { 
      role: 'user', 
      content: input,
      id: `user-${Date.now()}`,
      status: 'complete'
    };
    setChatHistory([...chatHistory, userMessage]);
    setInput('');

    // Add an initial response message with loading state
    const responseId = `ai-${Date.now()}`;
    const loadingMessage: Message = {
      role: 'model',
      content: '',
      id: responseId,
      status: 'loading'
    };
    setChatHistory(prev => [...prev, loadingMessage]);

    try {
      const historyForApi = chatHistory.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }));

      // Use non-streaming endpoint for improved reliability
      const apiUrl = `${getApiBaseUrl()}/chat`;
      
      console.log(`Sending request to: ${apiUrl}`);
      
      // Detect if user is on mobile or has slow connection
      // The navigator.connection API is experimental, so we need to check if it exists
      let connectionSpeed = 'fast';
      if ('connection' in navigator && (navigator as any).connection) {
        const netInfo = (navigator as any).connection;
        if (netInfo.effectiveType === '3g' || netInfo.effectiveType === '2g' || netInfo.saveData) {
          connectionSpeed = 'slow';
        }
      }
      
      const isMobileOrSlow = isMobile || connectionSpeed === 'slow';
      
      // Set a timeout based on device type
      const timeoutDuration = isMobileOrSlow ? 15000 : 30000;
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out')), timeoutDuration);
      });
      
      const controller = new AbortController();
      const signal = controller.signal;
      
      // Set up a timeout to abort the fetch if it takes too long
      const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
      
      const fetchPromise = fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        credentials: 'omit',
        signal,
        body: JSON.stringify({
          chat: input,
          history: historyForApi
        }),
      });
      
      try {
        // Use Promise.race to implement timeout
        const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
        
        // Clear the timeout since we got a response
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Update the loading message with the response content
        setChatHistory(prev => 
          prev.map(msg => 
            msg.id === responseId 
              ? { ...msg, content: data.text, status: 'complete' } 
              : msg
          )
        );
      } catch (error) {
        // Check if this was an abort error (from our own timeout)
        if (error.name === 'AbortError') {
          throw new Error('Request timed out');
        }
        throw error;
      }
    } catch (error) {
      console.error('Error:', error);
      
      // Update the loading message with error content
      setChatHistory(prev => 
        prev.map(msg => 
          msg.id === responseId 
            ? { 
                ...msg, 
                content: isMobile 
                  ? `Sorry, there was an error. Please try a shorter question or try again later.` 
                  : `Sorry, there was an error: ${error.message}`, 
                status: 'error' 
              } 
            : msg
        )
      );
    }
  };

  // Function to retry a failed message
  const handleRetry = (messageId: string, originalQuestion: string) => {
    // Find the failed message and remove it
    setChatHistory(prev => prev.filter(msg => msg.id !== messageId));
    
    // Set the input to the original question
    setInput(originalQuestion);
    
    // Optionally auto-submit
    // handleSubmit(new Event('submit') as React.FormEvent);
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

  // Render a message based on its type
  const renderMessage = (message: Message, index: number) => {
    // Find the preceding user message for retry functionality
    const userMessageIndex = message.role === 'model' ? 
      chatHistory.findIndex((msg, i) => i < index && msg.role === 'user') : -1;
    
    const userMessage = userMessageIndex >= 0 ? chatHistory[userMessageIndex].content : '';
    
    return (
      <div key={message.id || index} className="message-wrapper">
        <MessageDisplay 
          message={message} 
          darkMode={darkMode || false} 
          onRetry={message.status === 'error' && message.id ? 
            () => handleRetry(message.id as string, userMessage) : undefined} 
        />
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
          <div 
            className="nav-item dark-mode-toggle"
            onClick={toggleDarkMode}
            style={{ 
              marginTop: 'auto', 
              marginBottom: '20px',
              opacity: 0.8,
              cursor: 'pointer'
            }}
          >
            {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
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
          <div className="mobile-header">
            <div 
              style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} 
              onClick={() => setChatHistory([])}
            >
              <MonetizationOnIcon sx={{ color: brandColor, fontSize: 20, mr: 1 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: brandColor }}>
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
                  padding: '4px',
                  color: darkMode ? '#e6e6e6' : '#666'
                }}
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? <Brightness7Icon sx={{ fontSize: 20 }} /> : <Brightness4Icon sx={{ fontSize: 20 }} />}
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
                    <textarea
                      ref={inputRef as any}
                      className="chat-input"
                      placeholder="Ask anything..."
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        // Auto-adjust height
                        e.target.style.height = 'auto';
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit(e as any);
                        }
                      }}
                      rows={1}
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
                <div className="message-list" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingBottom: "80px" }}>
                  {chatHistory.map((message, index) => renderMessage(message, index))}
                  <div ref={messagesEndRef} />
                </div>
                
                {/* Chat Input for conversations */}
                <div className="chat-input-container" style={{ margin: '20px auto 40px' }}>
                  <form className="chat-input-form" onSubmit={handleSubmit}>
                    <textarea
                      ref={inputRef as any}
                      className="chat-input"
                      placeholder="Ask follow-up questions..."
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        // Auto-adjust height
                        e.target.style.height = 'auto';
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit(e as any);
                        }
                      }}
                      rows={1}
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
        
        {/* Mobile Navigation */}
        {isMobile && renderMobileNavigation()}
      </main>
    </div>
  );
}

export default App; 