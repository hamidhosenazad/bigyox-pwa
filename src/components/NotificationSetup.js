import React, { useEffect, useState } from 'react';
import { requestNotificationPermission } from '../firebase-init';

const NotificationSetup = () => {
  const [fcmToken, setFcmToken] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const setupNotifications = async () => {
      try {
        const token = await requestNotificationPermission();
        if (token) {
          setFcmToken(token);
          // Here you would typically send this token to your backend
          // to associate it with the user's Twilio identity
          console.log('FCM Token ready to be sent to backend:', token);
        }
      } catch (err) {
        setError('Failed to setup notifications: ' + err.message);
      }
    };

    setupNotifications();
  }, []);

  return (
    <div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {fcmToken ? (
        <p>Notifications are enabled! Token: {fcmToken.substring(0, 20)}...</p>
      ) : (
        <p>Requesting notification permission...</p>
      )}
    </div>
  );
};

export default NotificationSetup; 