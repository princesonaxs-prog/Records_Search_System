
import { useState, useCallback, useEffect } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly';

export function useGoogleDrive() {
  const [accessToken, setAccessToken] = useState<string | null>(localStorage.getItem('google_access_token'));

  const login = useCallback(() => {
    if (!CLIENT_ID || CLIENT_ID === "YOUR_CLIENT_ID_HERE" || CLIENT_ID.includes("YOUR_")) {
      alert("❌ خطأ: يرجى إعداد VITE_GOOGLE_CLIENT_ID في قائمة Settings داخل AI Studio أولاً.");
      console.error("Missing Client ID. Current value:", CLIENT_ID);
      return;
    }

    try {
      console.log("Attempting login with Client ID:", CLIENT_ID);
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        prompt: 'select_account', 
        ux_mode: 'popup',
        callback: (response: any) => {
          if (response.error) {
            console.error("Auth Error Full Response:", response);
            const errorMsg = response.error === 'invalid_client' 
              ? 'رمز العميل (Client ID) غير صحيح أو غير مفعل لهذا النطاق (Origin).'
              : response.error;
            alert(`❌ خطأ في المصادقة: ${errorMsg}\n\nتأكد من:\n1. أن الـ Client ID صحيح ومطابق للحساب B.\n2. أن الرابط الحالي مضاف في Authorized JavaScript origins.`);
            return;
          }
          if (response.access_token) {
            setAccessToken(response.access_token);
            localStorage.setItem('google_access_token', response.access_token);
          }
        },
      });
      client.requestAccessToken();
    } catch (err) {
      console.error("GSI Client Init Failed:", err);
      alert("فشل بدء عميل جوجل. تأكد من اتصال الإنترنت.");
    }
  }, []);

  const logout = useCallback(() => {
    setAccessToken(null);
    localStorage.removeItem('google_access_token');
  }, []);

  return { accessToken, login, logout, isAuthenticated: !!accessToken };
}
