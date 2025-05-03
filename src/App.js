// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import TwilioReceiver from './components/TwilioReceiver';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/:userId" element={<TwilioReceiver />} />
          <Route path="/" element={<Navigate to="/default" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;