import React, { useState, useEffect, useRef } from 'react';
import { Device } from '@twilio/voice-sdk';

const TwilioReceiver = () => {
  const [device, setDevice] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [incomingConnection, setIncomingConnection] = useState(null);
  const ringtoneRef = useRef(null);

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err) {
      console.error('Microphone permission error:', err);
      return false;
    }
  };

  const connectToTwilio = async () => {
    try {
      const hasMicPermission = await requestMicrophonePermission();
      if (!hasMicPermission) {
        console.error('Mic permission denied');
        return;
      }

      const token = await getAccessToken();

      const twilioDevice = new Device(token, {
        debug: true,
        enableRingingState: true,
        edge: ['ashburn', 'sydney', 'roaming'],
        region: 'gll'
      });

      twilioDevice.on('registered', () => setIsConnected(true));
      twilioDevice.on('unregistered', () => setIsConnected(false));
      twilioDevice.on('ready', () => setIsConnected(true));
      twilioDevice.on('error', (error) => {
        console.error('Twilio.Device Error:', error);
        setIsConnected(false);
      });

      twilioDevice.on('incoming', async (connection) => {
        const hasMicPermission = await requestMicrophonePermission();
        if (!hasMicPermission) {
          connection.reject();
          return;
        }

        // Start ringtone
        if (ringtoneRef.current) {
          ringtoneRef.current.play().catch(err => {
            console.warn('Ringtone playback blocked:', err);
          });
        }

        setIncomingConnection(connection);
      });

      await twilioDevice.register();
      setDevice(twilioDevice);

    } catch (err) {
      console.error('Connection error:', err);
      setIsConnected(false);
    }
  };

  useEffect(() => {
    connectToTwilio();
    return () => {
      if (device) device.destroy();
    };
  }, []);

  const getAccessToken = async () => {
    const response = await fetch('https://getcredentials-3757.twil.io/getCredentials');
    const data = await response.json();
    return data.token;
  };

  const stopRingtone = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
  };

  const handleAccept = () => {
    if (incomingConnection) {
      stopRingtone();
      incomingConnection.accept();
      setIncomingConnection(null);
    }
  };

  const handleReject = () => {
    if (incomingConnection) {
      stopRingtone();
      incomingConnection.reject();
      setIncomingConnection(null);
    }
  };

  const containerStyle = {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '20px'
  };

  const indicatorStyle = {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: isConnected ? '#4CAF50' : '#ff4444',
    transition: 'background-color 0.3s ease',
    boxShadow: '0 0 10px rgba(0,0,0,0.1)'
  };

  const callOverlayStyle = {
    position: 'fixed',
    top: '20%',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: '12px',
    padding: '30px',
    zIndex: 9999,
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    textAlign: 'center'
  };

  const buttonStyle = (bg) => ({
    margin: '10px',
    padding: '10px 20px',
    fontSize: '16px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    backgroundColor: bg,
    color: '#fff'
  });

  return (
    <>
      <div style={containerStyle}>
        <div style={indicatorStyle} />
      </div>

      {/* Ringtone Audio */}
      <audio ref={ringtoneRef} loop preload="auto">
        <source src="https://actions.google.com/sounds/v1/alarms/phone_alerts_and_rings.ogg" type="audio/ogg" />
        <source src="https://actions.google.com/sounds/v1/alarms/phone_alerts_and_rings.mp3" type="audio/mp3" />
        Your browser does not support the audio element.
      </audio>

      {incomingConnection && (
        <div style={callOverlayStyle}>
          <h2>Incoming Call</h2>
          <p>Do you want to accept it?</p>
          <button style={buttonStyle('#4CAF50')} onClick={handleAccept}>Accept</button>
          <button style={buttonStyle('#f44336')} onClick={handleReject}>Reject</button>
        </div>
      )}
    </>
  );
};

export default TwilioReceiver;
