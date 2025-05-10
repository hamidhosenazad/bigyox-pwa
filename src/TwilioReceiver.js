import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Device } from '@twilio/voice-sdk';
import { useParams, Navigate } from 'react-router-dom';
import useBackgroundServiceManager from './BackgroundServiceManager';

const TwilioReceiver = () => {
  const { userId } = useParams();
  const [device, setDevice] = useState(null);
  // Use the background service manager
  const backgroundService = useBackgroundServiceManager();
  const [isConnected, setIsConnected] = useState(false);
  const [incomingConnection, setIncomingConnection] = useState(null);
  const [activeConnection, setActiveConnection] = useState(null);
  const [callStartTime, setCallStartTime] = useState(null);
  const [callDuration, setCallDuration] = useState('00:00');
  const [hasMicPermission, setHasMicPermission] = useState(false);
  const ringtoneRef = useRef(null);
  const durationTimer = useRef(null);
  const isConnecting = useRef(false);

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: false 
      });
      
      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop());
      }, 1000);
      
      setHasMicPermission(true);
      return true;
    } catch (err) {
      setHasMicPermission(false);
      return false;
    }
  };

  const getAccessToken = async () => {
    if (!userId) {
      throw new Error('User ID is required');
    }
    try {
      const response = await fetch(`https://getcredentials-3757.twil.io/getCredentials?userId=${userId}`);
      const data = await response.json();
      if (!data.token) {
        throw new Error('No token received from server');
      }
      return data.token;
    } catch (error) {
      throw error;
    }
  };

  const connectToTwilio = useCallback(async () => {
    if (!userId || isConnecting.current || device) return;

    try {
      isConnecting.current = true;
      const hasMicPermission = await requestMicrophonePermission();
      if (!hasMicPermission) {
        return;
      }
      
      // Ensure we have a wake lock to keep the device awake
      backgroundService.acquireWakeLock();

      const token = await getAccessToken();

      const twilioDevice = new Device(token, {
        enableRingingState: true,
        edge: ['ashburn', 'sydney', 'roaming', 'frankfurt', 'dublin'],
        region: 'gll',
        sounds: { incoming: null },
        allowIncomingWhileBusy: true
      });

      twilioDevice.on('registered', () => {
        setIsConnected(true);
        // Register for background sync when device is registered
        backgroundService.registerBackgroundSync();
      });
      twilioDevice.on('unregistered', () => setIsConnected(false));
      twilioDevice.on('ready', () => {
        setIsConnected(true);
        // Register for periodic sync when device is ready
        backgroundService.registerPeriodicSync();
      });
      twilioDevice.on('error', () => setIsConnected(false));

      twilioDevice.on('incoming', async (connection) => {
        const hasMicPermission = await requestMicrophonePermission();
        if (!hasMicPermission) {
          connection.reject();
          return;
        }

        if (ringtoneRef.current) {
          ringtoneRef.current.play().catch(() => {});
        }

        connection.on('cancel', () => {
          stopRingtone();
          setIncomingConnection(null);
        });

        connection.on('disconnect', () => {
          stopRingtone();
          setIncomingConnection(null);
          setActiveConnection(null);
          setCallDuration('00:00');
          clearInterval(durationTimer.current);
        });

        setIncomingConnection(connection);
      });

      await twilioDevice.register();
      setDevice(twilioDevice);

    } catch (err) {
      setIsConnected(false);
    } finally {
      isConnecting.current = false;
    }
  }, [userId, device]);

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

      incomingConnection.on('disconnect', () => {
        setActiveConnection(null);
        setCallDuration('00:00');
        clearInterval(durationTimer.current);
      });

      setActiveConnection(incomingConnection);
      setIncomingConnection(null);
      setCallStartTime(Date.now());
    }
  };

  const handleReject = () => {
    if (incomingConnection) {
      stopRingtone();
      incomingConnection.reject();
      setIncomingConnection(null);
    }
  };

  const handleHangUp = () => {
    if (activeConnection) {
      activeConnection.disconnect();
      setActiveConnection(null);
      setCallDuration('00:00');
      clearInterval(durationTimer.current);
    }
  };

  useEffect(() => {
    if (userId) {
      // Store the user ID in localStorage for persistent connection
      localStorage.setItem('twilioUserId', userId);
      
      connectToTwilio();
      
      // Send heartbeat to keep service worker alive
      backgroundService.sendHeartbeat();
      
      // Set up a reconnection interval to ensure we stay connected
      const reconnectionInterval = setInterval(() => {
        if (!isConnected) {
          console.log('Reconnection check: Not connected, attempting to reconnect...');
          connectToTwilio();
        } else {
          console.log('Reconnection check: Already connected');
        }
      }, 3 * 60 * 1000); // Check every 3 minutes
      
      return () => {
        // Don't destroy the device on component unmount to keep it running in the background
        // Instead, just clear the interval
        clearInterval(reconnectionInterval);
        stopRingtone();
        clearInterval(durationTimer.current);
      };
    }
    
    return () => {
      stopRingtone();
      clearInterval(durationTimer.current);
    };
  }, [userId, connectToTwilio, backgroundService, isConnected]);

  useEffect(() => {
    if (callStartTime) {
      durationTimer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const seconds = String(elapsed % 60).padStart(2, '0');
        setCallDuration(`${minutes}:${seconds}`);
      }, 1000);
    } else {
      clearInterval(durationTimer.current);
      setCallDuration('00:00');
    }
    return () => clearInterval(durationTimer.current);
  }, [callStartTime]);

  if (!userId) {
    return <Navigate to="/" replace />;
  }

  const containerStyle = {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '20px',
    gap: '10px'
  };

  const indicatorStyle = (color) => ({
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: color,
    transition: 'background-color 0.3s ease',
    boxShadow: '0 0 10px rgba(0,0,0,0.1)'
  });

  const tooltipStyle = {
    position: 'absolute',
    top: '100%',
    right: '0',
    backgroundColor: '#333',
    color: 'white',
    padding: '5px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    whiteSpace: 'nowrap',
    marginTop: '5px',
    display: 'none'
  };

  const indicatorContainerStyle = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
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
        <div style={indicatorContainerStyle}>
          <div 
            style={indicatorStyle(
              hasMicPermission && isConnected ? '#4CAF50' : 
              !hasMicPermission ? '#ff4444' : 
              '#ffa500'
            )}
            title={
              hasMicPermission && isConnected ? 'Connected and ready' :
              !hasMicPermission ? 'Microphone permission required' :
              'Waiting for connection'
            }
          />
        </div>
      </div>

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

      {activeConnection && (
        <div style={callOverlayStyle}>
          <h2>Call in Progress</h2>
          <p>Duration: {callDuration}</p>
          <button style={buttonStyle('#f44336')} onClick={handleHangUp}>Hang Up</button>
        </div>
      )}
    </>
  );
};

export default TwilioReceiver;
