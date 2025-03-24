import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

// Mock the component to prevent API calls during testing
vi.mock('../components/Chat', () => ({
  default: () => <div data-testid="chat-component">Chat Component</div>,
}));

describe('App Component', () => {
  it('renders without crashing', () => {
    render(<App />);
    
    // Check if the chat component is rendered
    expect(screen.getByTestId('chat-component')).toBeInTheDocument();
  });
}); 