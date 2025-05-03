// src/App.js
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate, useParams } from 'react-router-dom';
import TwilioReceiver from './TwilioReceiver';

// Component to handle root path check
const RootPathHandler = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/' || location.pathname === '/bigyox-pwa') {
      alert('No user ID provided. Please provide a user ID in the URL (e.g., /123)');
    }
  }, [location]);

  return null;
};

// Wrapper component to validate userId
const ValidatedTwilioReceiver = () => {
  const location = useLocation();
  const { userId } = useParams();
  
  // Check if we're at the root path of GitHub Pages
  if (location.pathname === '/bigyox-pwa' || location.pathname === '/') {
    return <Navigate to="/" replace />;
  }

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
        <RootPathHandler />
        <Routes>
          <Route path="/:userId" element={<ValidatedTwilioReceiver />} />
          <Route path="/" element={<div>Please provide a user ID in the URL (e.g., /123)</div>} />
          <Route path="/bigyox-pwa" element={<div>Please provide a user ID in the URL (e.g., /123)</div>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;