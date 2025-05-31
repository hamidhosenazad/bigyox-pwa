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
        <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: status.includes('Error') || status.includes('❌') ? '#f8d7da' : '#d4edda', border: '1px solid ' + (status.includes('Error') || status.includes('❌') ? '#f5c6cb' : '#c3e6cb'), borderRadius: '5px' }}>
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
        <h4>📱 Simplified Call Flow:</h4>
        <ol>
          <li><strong>PWA Ready:</strong> FCM token generated, waiting for notifications</li>
          <li><strong>Twilio Call Comes In:</strong> Flex agent triggers call transfer</li>
          <li><strong>Notification Sent:</strong> Flex sends FCM notification directly to this device</li>
          <li><strong>PWA Responds:</strong> App receives notification and marks itself ready</li>
          <li><strong>Call Transferred:</strong> Twilio completes the call transfer</li>
        </ol>
        <p><strong>To test:</strong> Make sure Flex has the FCM token: <code>egRzJEptB6cBl8k2MwO2cR:APA91bGC2KGmntzNOe9uax0FmcVRHkEthKipUe9MPzWUi0UPWCmmvBzexCcpMH81Jye2Wt5mvSLl3eMY-Csp2Alg4e4iCLN45dAjKpKGe4Zm_kfyzNwGZn4</code></p>
        
        <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '5px' }}>
          <strong>🔧 Current Setup:</strong>
          <ul style={{ marginBottom: 0 }}>
            <li><strong>No Registration Required:</strong> PWA just waits for notifications</li>
            <li><strong>Direct FCM:</strong> Flex sends notifications using FCM token above</li>
            <li><strong>Auto-Ready:</strong> PWA marks itself ready when notification received</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CallMonitorPage; 