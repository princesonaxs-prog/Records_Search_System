
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cloud, RefreshCw, CheckCircle, Database, AlertCircle, PlayCircle, Loader2 } from 'lucide-react';
import { useGoogleDrive } from '../hooks/useGoogleDrive';
import { driveService, DriveFile } from '../services/driveService';
import { performOCR } from '../services/ocrService';

export const DriveSyncPanel = () => {
  const { accessToken, login, logout, isAuthenticated } = useGoogleDrive();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState({ total: 0, transcribed: 0 });
  const [currentAction, setCurrentAction] = useState('');

  const fetchDriveStats = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const { images, texts } = await driveService.listFiles(accessToken);
      setStats({
        total: images.length,
        transcribed: texts.size
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchDriveStats();
  }, [isAuthenticated]);

  const osBaseName = (name: string) => name.split('.').slice(0, -1).join('.').toLowerCase();

  const startAutomatedTranscription = async () => {
    if (!accessToken) return;
    setSyncing(true);
    setCurrentAction('Scanning images...');
    
    try {
      const { images, texts } = await driveService.listFiles(accessToken);
      const pending = images.filter(img => !texts.has(osBaseName(img.name)));
      
      let count = 0;
      for (const img of pending) {
        count++;
        setCurrentAction(`Transcribing (${count}/${pending.length}): ${img.name}`);
        
        // 1. Download image
        const imgResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${img.id}?alt=media`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const blob = await imgResponse.blob();
        
        // 2. Perform OCR via Gemini
        const transcription = await performOCR(blob);
        
        // 3. Save TXT back to Drive
        const txtName = `${osBaseName(img.name)}.txt`;
        await driveService.saveTranscription(accessToken, txtName, transcription);
        
        setStats(prev => ({ ...prev, transcribed: prev.transcribed + 1 }));
      }
      setCurrentAction('All documents synced successfully!');
      setTimeout(() => setCurrentAction(''), 3000);
    } catch (error) {
      console.error(error);
      setCurrentAction('Error occurred during sync.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-white border border-emerald-100 rounded-2xl p-6 shadow-sm mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <Cloud className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">ربط أرشيف جوجل درايف</h3>
            <p className="text-xs text-gray-500">سيتم استخراج النصوص وحفظها كملفات .txt في نفس المجلد</p>
          </div>
        </div>
        
        {!isAuthenticated ? (
          <div className="flex flex-col items-end gap-2">
            <button 
              onClick={login}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
            >
              <Database className="w-4 h-4" />
              تسجيل الدخول بالحساب (Account B)
            </button>
            <p className="text-[10px] text-gray-400 max-w-[200px] text-left leading-tight">
              إذا ظهر خطأ <span className="text-red-400 font-bold">invalid_client</span>، يرجى إضافة رابط هذا الموقع إلى قائمة الـ Origins في منصة جوجل السحابية الخاصة بالحساب الثاني.
            </p>
            <div className="mt-2 flex flex-col gap-1">
              <div className="text-[9px] bg-gray-50 border border-gray-100 p-2 rounded text-gray-400 font-mono break-all">
                ID: {import.meta.env.VITE_GOOGLE_CLIENT_ID?.substring(0, 20)}...
              </div>
              <button 
                onClick={() => {
                  const url = window.location.origin;
                  navigator.clipboard.writeText(url);
                  alert(`تم نسخ الرابط:\n${url}\n\nقم بلصقه في Authorized JavaScript origins في Google Console.`);
                }}
                className="text-[9px] text-emerald-600 hover:underline text-left"
              >
                📋 نسخ هذا الرابط لـ Google Console
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
             <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">متصل الآن</span>
             <button 
              onClick={logout}
              className="text-xs text-red-400 hover:text-red-600 transition-colors"
            >
              قطع الاتصال
            </button>
          </div>
        )}
      </div>

      {isAuthenticated && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100 shadow-inner">
            <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-2">إجمالي الصور</div>
            <div className="text-3xl font-black text-gray-900">{loading ? '...' : stats.total}</div>
          </div>
          
          <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-inner">
            <div className="text-[10px] text-emerald-600 uppercase tracking-widest font-bold mb-2">ملفات التدريب (.txt)</div>
            <div className="text-3xl font-black text-emerald-700">{loading ? '...' : stats.transcribed}</div>
          </div>

          <div className="flex flex-col justify-center">
            <button
              onClick={startAutomatedTranscription}
              disabled={syncing || loading}
              className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all transform active:scale-95 ${
                syncing 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-xl shadow-emerald-200'
              }`}
            >
              {syncing ? <Loader2 className="w-6 h-6 animate-spin" /> : <PlayCircle className="w-6 h-6" />}
              {syncing ? 'جاري الاستخراج...' : 'بدأ المعالجة الآلية'}
            </button>
            <p className="text-[10px] text-gray-400 mt-3 text-center leading-tight">
              سيقوم Gemini بفحص الصور الجديدة وتوليد "الأوزان النصية" (Ground Truth) وحفظها تلقائياً.
            </p>
          </div>
        </div>
      )}

      <AnimatePresence>
        {currentAction && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 p-3 bg-emerald-900 text-emerald-50 text-sm rounded-lg flex items-center gap-2"
          >
            {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {currentAction}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
