import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Device } from 'twilio-client';

function TwilioReceiver() {
  const { userId } = useParams();
  const [device, setDevice] = useState(null);
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    const initializeDevice = async () => {
      try {
        // Get token from your backend
        const response = await fetch(`/api/token?userId=${userId}`);
        const data = await response.json();
        
        if (!data.token) {
          throw new Error('No token received');
        }

        // Initialize Twilio Device
        const newDevice = new Device(data.token, {
          codecPreferences: ['opus', 'pcmu'],
          fakeLocalDTMF: true,
          enableRingingState: true,
        });

        // Set up event listeners
        newDevice.on('ready', () => {
          setStatus('Ready to receive calls');
        });

        newDevice.on('error', (error) => {
          setStatus(`Error: ${error.message}`);
        });

        newDevice.on('incoming', (connection) => {
          setStatus('Incoming call...');
          connection.accept();
        });

        // Register the device
        await newDevice.register();
        setDevice(newDevice);
      } catch (error) {
        setStatus(`Error: ${error.message}`);
      }
    };

    initializeDevice();

    // Cleanup
    return () => {
      if (device) {
        device.destroy();
      }
    };
  }, [userId]);

  return (
    <div className="twilio-receiver">
      <h2>Twilio Voice Receiver</h2>
      <p>User ID: {userId}</p>
      <p>Status: {status}</p>
    </div>
  );
}

export default TwilioReceiver; 