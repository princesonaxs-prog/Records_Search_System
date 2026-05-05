
import { useState, useCallback, useEffect } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly';

export function useGoogleDrive() {
  const [accessToken, setAccessToken] = useState<string | null>(localStorage.getItem('google_access_token'));
  const [user, setUser] = useState<any>(null);

  const login = useCallback(() => {
    if (!CLIENT_ID || CLIENT_ID === "YOUR_CLIENT_ID_HERE") {
      alert("Please configure VITE_GOOGLE_CLIENT_ID in your environment secrets first.");
      return;
    }

    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response: any) => {
        if (response.access_token) {
          setAccessToken(response.access_token);
          localStorage.setItem('google_access_token', response.access_token);
        }
      },
    });
    client.requestAccessToken();
  }, []);

  const logout = useCallback(() => {
    setAccessToken(null);
    localStorage.removeItem('google_access_token');
  }, []);

  return { accessToken, login, logout, isAuthenticated: !!accessToken };
}
