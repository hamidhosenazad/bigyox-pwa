// src/App.js
import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useLocation, Navigate, useParams, Link } from 'react-router-dom';
import TwilioReceiver from './TwilioReceiver';
import CallMonitorPage from './components/CallMonitorPage';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { registerFCMToken, handleCallNotification } from './utils/twilioUtils';
import firebaseConfig from './firebase-init';

// Component to handle direct path access
const DirectPathHandler = () => {
  useEffect(() => {
    // Check if we're using direct path instead of hash
    const path = window.location.pathname;
    if (path !== '/' && !window.location.hash) {
      // Extract userId from path
      const userId = path.substring(1); // Remove leading slash
      if (userId) {
        // Redirect to hash-based URL
        window.location.href = `${window.location.origin}/#/${userId}`;
      }
    }
  }, []);

  return null;
};

// Component to handle root path check
const RootPathHandler = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/') {
      alert('No user ID provided. Please provide a user ID in the URL (e.g., /#/228)');
    }
  }, [location]);

  return null;
};

// Wrapper component to validate userId
const ValidatedTwilioReceiver = () => {
  const location = useLocation();
  const { userId } = useParams();
  
  // Ensure userId exists and is valid
  if (!userId || userId.trim() === '') {
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
        <Link to={`/monitor/${userId}`} style={{ marginRight: '10px', color: '#007bff', textDecoration: 'none' }}>
          📊 Call Monitor
        </Link>
        <span style={{ color: '#6c757d' }}>| Current User: {userId}</span>
      </div>
      <TwilioReceiver />
    </div>
  );
};

// Wrapper for monitor page
const ValidatedMonitorPage = () => {
  const { userId } = useParams();
  
  if (!userId || userId.trim() === '') {
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
        <Link to={`/${userId}`} style={{ marginRight: '10px', color: '#007bff', textDecoration: 'none' }}>
          ← Back to Main App
        </Link>
        <span style={{ color: '#6c757d' }}>| Call Monitor for User: {userId}</span>
      </div>
      <CallMonitorPage />
    </div>
  );
};

function App() {
  useEffect(() => {
    // ... existing code ...
  }, []);

  return (
    <Router>
      <div className="App">
        <DirectPathHandler />
        <RootPathHandler />
        <Routes>
          <Route path="/monitor/:userId" element={<ValidatedMonitorPage />} />
          <Route path="/:userId" element={<ValidatedTwilioReceiver />} />
          <Route path="/" element={<div>Please provide a user ID in the URL (e.g., /#/228)</div>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;