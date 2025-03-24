import React from 'react';
import { Message } from '../types';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import '../styles/MessageDisplay.css';

interface MessageDisplayProps {
  message: Message;
  onRetry?: () => void;
  darkMode?: boolean;
}

const MessageDisplay: React.FC<MessageDisplayProps> = ({ message, onRetry, darkMode }) => {
  const themeClass = darkMode ? 'dark-theme' : 'light-theme';

  if (message.role === 'user') {
    return (
      <div className={`message-container user-message ${themeClass}`}>
        <div className="message-content">
          <Typography variant="body1">{message.content}</Typography>
        </div>
      </div>
    );
  }

  // AI message loading state
  if (message.status === 'loading') {
    return (
      <div className={`message-container ai-message ${themeClass}`}>
        <div className="message-content loading-content">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={16} thickness={6} color="inherit" />
            <Typography variant="body1">FinWise is thinking...</Typography>
          </Box>
        </div>
      </div>
    );
  }

  // AI message error state
  if (message.status === 'error') {
    return (
      <div className={`message-container ai-message error-message ${themeClass}`}>
        <div className="message-content">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="body1" color="error">
              <span role="img" aria-label="warning">⚠️</span> {message.content}
            </Typography>
            {onRetry && (
              <Button 
                startIcon={<RefreshIcon />} 
                onClick={onRetry}
                size="small"
                variant="outlined"
                color="primary"
              >
                Try again
              </Button>
            )}
          </Box>
        </div>
      </div>
    );
  }

  // AI message complete state
  return (
    <div className={`message-container ai-message ${themeClass}`}>
      <div className="message-content">
        <Typography variant="body1" component="div" className="ai-response">
          {message.content.split('\n').map((line, index) => (
            <React.Fragment key={index}>
              {line}
              {index < message.content.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </Typography>
      </div>
    </div>
  );
};

export default MessageDisplay; 