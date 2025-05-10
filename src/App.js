// src/App.js
import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useLocation, Navigate, useParams } from 'react-router-dom';
import TwilioReceiver from './TwilioReceiver';
import useBackgroundServiceManager from './BackgroundServiceManager';

// Component to handle background services
const BackgroundServices = () => {
  // Use the background service manager hook
  useBackgroundServiceManager();
  return null;
};

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

  return <TwilioReceiver />;
};

function App() {
  return (
    <Router>
      <div className="App">
        <DirectPathHandler />
        <RootPathHandler />
        <BackgroundServices />
        <Routes>
          <Route path="/:userId" element={<ValidatedTwilioReceiver />} />
          <Route path="/" element={<div>Please provide a user ID in the URL (e.g., /#/228)</div>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
