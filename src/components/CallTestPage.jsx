import React, { useState, useEffect } from 'react';
import { markPwaReady } from '../utils/twilioUtils';

const CallMonitorPage = () => {
  const [userId, setUserId] = useState('238');
  const [status, setStatus] = useState('');
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const getUserIdFromUrl = () => {
    const hash = window.location.hash;
    if (hash && hash.length > 1) {
      return hash.substring(1);
    }
    return '238'; // default
  };

  useEffect(() => {
    const urlUserId = getUserIdFromUrl();
    setUserId(urlUserId);
    addLog(`PWA ready for incoming calls. Extension: ${urlUserId}`);
    setStatus(`Ready to receive calls for extension ${urlUserId}`);
  }, []);

  const handleCleanup = async () => {
    setStatus('Cleaning up old calls...');
    addLog('Cleaning up old calls...');
    
    try {
      const response = await fetch('https://getcredentials-3757.twil.io/cleanupOldCalls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxAgeMinutes: 5 // Clean up calls older than 5 minutes
        }),
      });

      const result = await response.json();
      setStatus(`Cleanup complete: ${result.message}`);
      addLog(`Cleanup result: ${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
      addLog(`Error during cleanup: ${error.message}`);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setStatus(`Ready to receive calls for extension ${userId}`);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>📞 Call Monitor - Live System</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <label>
          Extension: 
          <input 
            type="text" 
            value={userId} 
            onChange={(e) => setUserId(e.target.value)}
            style={{ marginLeft: '10px', padding: '5px' }}
            disabled
          />
        </label>
        <p style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
          Extension is automatically set from URL hash (e.g., /#/238)
        </p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={handleCleanup}
          style={{ marginRight: '10px', padding: '10px 15px', backgroundColor: '#ffc107', color: 'black', border: 'none', borderRadius: '5px' }}
        >
          🧹 Cleanup Old Calls
        </button>
        
        <button 
          onClick={clearLogs}
          style={{ padding: '10px 15px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          🗑️ Clear Logs
        </button>
      </div>

      {status && (
        <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: status.includes('Error') ? '#f8d7da' : '#d4edda', border: '1px solid ' + (status.includes('Error') ? '#f5c6cb' : '#c3e6cb'), borderRadius: '5px' }}>
          <strong>Status:</strong> {status}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <h3>📋 Activity Logs</h3>
        <div style={{ height: '300px', overflowY: 'scroll', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '5px', padding: '10px' }}>
          {logs.length === 0 ? (
            <p>No activity yet... Waiting for real calls.</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} style={{ marginBottom: '5px', fontFamily: 'monospace', fontSize: '12px' }}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ backgroundColor: '#e7f3ff', border: '1px solid #b3d9ff', borderRadius: '5px', padding: '15px' }}>
        <h4>📱 Real Call Flow:</h4>
        <ol>
          <li><strong>PWA Ready:</strong> This PWA is registered and waiting for real calls</li>
          <li><strong>Twilio Call Comes In:</strong> Flex agent transfers call to your extension</li>
          <li><strong>Notification Sent:</strong> FCM push notification is sent to this PWA</li>
          <li><strong>PWA Responds:</strong> This app automatically marks itself as ready</li>
          <li><strong>Call Transferred:</strong> Twilio transfers the call to your phone/device</li>
        </ol>
        <p><strong>To test:</strong> Have someone call your Twilio number and ask an agent to transfer to extension <strong>{userId}</strong></p>
      </div>
    </div>
  );
};

export default CallMonitorPage; 