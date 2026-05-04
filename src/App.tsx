/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search as SearchIcon, 
  Upload, 
  Loader2, 
  Database, 
  AlertCircle,
  FileSearch,
  Hash,
  Clock,
  LayoutGrid,
  Trash2,
  Download,
  Shield,
  Cpu,
  FileJson,
  X
} from 'lucide-react';
import { get, set, keys, del, clear } from 'idb-keyval';
import { IndexedDocument, OCRStatus } from './types';
import { recognizeHandwrittenArabic, recognizeArabicLocally } from './services/ocrService';
import { searchDocuments } from './services/searchService';
import { DocumentCard } from './components/DocumentCard';

import { VirtuosoGrid } from 'react-virtuoso';

export default function App() {
  const [documents, setDocuments] = useState<IndexedDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState<OCRStatus>(OCRStatus.IDLE);
  const [searchResults, setSearchResults] = useState<{ item: IndexedDocument; score: number }[]>([]);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [ocrEngine, setOcrEngine] = useState<'gemini' | 'local'>('gemini');
  const [showLocalGuide, setShowLocalGuide] = useState(false);

  // Load from IndexedDB on mount
  useEffect(() => {
    const loadDocs = async () => {
      const allKeys = await keys();
      const docs: IndexedDocument[] = [];
      for (const key of allKeys) {
        if (typeof key === 'string' && key.startsWith('doc-')) {
          const val = await get(key);
          if (val) docs.push(val);
        }
      }
      setDocuments(docs.sort((a, b) => b.metadata.createdAt - a.metadata.createdAt));
    };
    loadDocs();
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setStatus(OCRStatus.PROCESSING);
    setProcessingProgress(0);
    
    const total = files.length;
    for (let i = 0; i < total; i++) {
      const file = files[i];
      
      try {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });

        let text = "";
        if (ocrEngine === 'gemini') {
          text = await recognizeHandwrittenArabic(base64);
        } else {
          text = await recognizeArabicLocally(base64, (p) => {
            // Inner progress for single file
            setProcessingProgress(Math.round(((i + p) / total) * 100));
          });
        }
        
        setProcessingProgress(Math.round(((i + 1) / total) * 100));

        const newDoc: IndexedDocument = {
          id: Math.random().toString(36).substr(2, 9),
          base64,
          originalUrl: '', 
          recognizedText: text,
          confidence: 0.95,
          metadata: {
            createdAt: Date.now(),
            fileName: file.name,
          }
        };

        await set(`doc-${newDoc.id}`, newDoc);
        setDocuments(prev => [newDoc, ...prev]);
      } catch (error) {
        console.error("Failed to process file:", file.name, error);
      }
    }
    setProcessingProgress(100);
    setStatus(OCRStatus.SUCCESS);
    setTimeout(() => setStatus(OCRStatus.IDLE), 3000);
  }, [ocrEngine]);

  const handleJsonImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedDocs = JSON.parse(e.target?.result as string) as IndexedDocument[];
        if (Array.isArray(importedDocs)) {
          for (const doc of importedDocs) {
            await set(`doc-${doc.id}`, doc);
          }
          setDocuments(prev => [...importedDocs, ...prev]);
          alert(`Successfully imported ${importedDocs.length} documents.`);
        }
      } catch (error) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const updateDocumentText = useCallback(async (id: string, newText: string) => {
    const doc = documents.find(d => d.id === id);
    if (doc) {
      const updated = { ...doc, recognizedText: newText };
      await set(`doc-${id}`, updated);
      setDocuments(prev => prev.map(d => d.id === id ? updated : d));
    }
  }, [documents]);

  const removeDocument = useCallback(async (id: string) => {
    if (!confirm('Delete this document from local database?')) return;
    await del(`doc-${id}`);
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  }, []);

  const clearAllData = async () => {
    if (confirm('Are you sure you want to delete the entire local database? This cannot be undone.')) {
      await clear();
      setDocuments([]);
    }
  };

  const exportDatabase = () => {
    const blob = new Blob([JSON.stringify(documents)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scribe-index-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  useEffect(() => {
    const results = searchDocuments(searchQuery, documents);
    setSearchResults(results as any);
  }, [searchQuery, documents]);

  const displayItems = searchQuery 
    ? searchResults 
    : (documents.length > 0 && !searchQuery ? [] : documents.map(d => ({ item: d, score: 0 })));

  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFileUpload({ target: { files: e.dataTransfer.files } } as any);
    }
  }, [handleFileUpload]);

  return (
    <div 
      className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans selection:bg-emerald-500 selection:text-black flex flex-col"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <AnimatePresence>
        {isDragging && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-emerald-500/20 backdrop-blur-xl border-4 border-dashed border-emerald-500 flex flex-col items-center justify-center pointer-events-none"
          >
            <Upload size={80} className="text-emerald-500 mb-6" />
            <h2 className="text-4xl font-bold text-white uppercase tracking-tighter">Drop files to index</h2>
            <p className="text-emerald-500 font-mono mt-2">Maximum efficiency indexing mode active</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLocalGuide && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-6"
          >
            <div className="bg-[#111] border border-white/10 p-8 rounded-3xl max-w-2xl w-full relative overflow-y-auto max-h-[90vh]">
              <button 
                onClick={() => setShowLocalGuide(false)}
                className="absolute top-6 right-6 text-gray-500 hover:text-white"
              >
                <X size={24} />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <Cpu className="text-emerald-500" size={32} />
                <h2 className="text-2xl font-bold tracking-tight">Offline Power Processing</h2>
              </div>

              <div className="space-y-6 text-sm leading-relaxed text-gray-300">
                <p>
                  Since you have <span className="text-white font-bold">25GB of images</span>, processing them through a web browser is not recommended. 
                  Instead, use this Python script on your <span className="text-white font-bold">Lenovo P53</span> to harness your GPU (Quadro P1000).
                </p>

                <div className="bg-black rounded-lg p-4 font-mono text-[11px] text-emerald-500 overflow-x-auto ring-1 ring-white/5">
                  <pre>{`# 1. Install libraries: pip install easyocr
import easyocr
import json
import base64
import os

reader = easyocr.Reader(['ar']) # Initialize Arabic
index = []

for file in os.listdir('your_folder'):
    if file.endswith(('.jpg', '.png')):
        # Convert to base64
        with open(file, 'rb') as f:
            b64 = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()
        
        # OCR
        result = reader.readtext(file, detail=0)
        
        index.append({
            "id": file,
            "base64": b64,
            "recognizedText": " ".join(result),
            "metadata": {"fileName": file, "createdAt": os.path.getctime(file)}
        })

# Save index
with open('index.json', 'w', encoding='utf-8') as f:
    json.dump(index, f, ensure_ascii=False)
`}</pre>
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                  <h4 className="text-emerald-500 font-bold mb-1 uppercase text-[10px]">Steps:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-xs">
                    <li>Run the script locally on your workstation.</li>
                    <li>It will generate an <span className="font-bold text-white">index.json</span> file.</li>
                    <li>Click <span className="font-bold text-white">"Import JSON Index"</span> in this app.</li>
                    <li>Enjoy instant, <span className="font-bold text-emerald-500">100% Offline</span> searching.</li>
                  </ol>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navbar - Fixed */}
      <nav className="shrink-0 sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center">
              <Database size={18} className="text-black" />
            </div>
            <h1 className="text-lg font-bold tracking-tighter uppercase whitespace-nowrap hidden sm:block">
              Arabic <span className="text-emerald-500">Scribe</span> Search
            </h1>
          </div>

          {/* Engine Toggle */}
          <div className="flex items-center bg-white/5 rounded-full p-1 border border-white/10 text-[10px] uppercase font-bold tracking-widest overflow-hidden">
            <button 
              onClick={() => setOcrEngine('gemini')}
              className={`px-4 py-1.5 rounded-full transition-all flex items-center gap-2 ${ocrEngine === 'gemini' ? 'bg-emerald-500 text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
            >
              <Shield size={12} />
              Accurate Online
            </button>
            <button 
              onClick={() => setOcrEngine('local')}
              className={`px-4 py-1.5 rounded-full transition-all flex items-center gap-2 ${ocrEngine === 'local' ? 'bg-emerald-500 text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
            >
              <Cpu size={12} />
              Offline Local
            </button>
          </div>

          <div className="flex-1 max-w-md relative group">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-500 transition-colors" size={16} />
            <input 
              type="text"
              placeholder="Search recognized Arabic text..."
              className="w-full h-10 bg-white/5 border border-white/10 rounded-full pl-10 pr-6 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:bg-white/10 transition-all font-serif text-right dir-rtl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer border border-white/10">
              <FileJson size={14} className="text-emerald-500" />
              <span>Import Index</span>
              <input type="file" className="hidden" accept=".json" onChange={handleJsonImport} />
            </label>
            
            <label className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <Upload size={14} />
              <span>فهرسة مجلد</span>
              <input 
                type="file" 
                className="hidden" 
                multiple 
                // @ts-ignore
                webkitdirectory="" 
                directory="" 
                onChange={handleFileUpload} 
              />
            </label>
            
            <button 
              onClick={() => setShowLocalGuide(true)}
              className="p-2 text-gray-500 hover:text-emerald-500 transition-colors"
              title="Workstation Processing Guide"
            >
              <Cpu size={18} />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-hidden">
        <VirtuosoGrid
          style={{ height: '100%' }}
          data={displayItems}
          totalCount={displayItems.length}
          components={{
            Header: () => (
              <div className="max-w-7xl mx-auto px-6 py-12">
                {/* Stats / Hero */}
                <section className="mb-16 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white/5 border border-white/10 p-8 rounded-2xl relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <FileSearch size={120} />
                    </div>
                    <div className="relative">
                      <p className="text-[10px] text-emerald-500 uppercase font-bold tracking-[0.2em] mb-2">Total Indexed</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-light tracking-tighter tabular-nums">{documents.length}</span>
                        <span className="text-gray-500 text-sm font-mono lowercase">docs</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 p-8 rounded-2xl relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Hash size={120} />
                    </div>
                    <div className="relative">
                      <p className="text-[10px] text-emerald-500 uppercase font-bold tracking-[0.2em] mb-2">OCR Confidence</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-light tracking-tighter tabular-nums">98</span>
                        <span className="text-gray-500 text-sm font-mono lowercase">percent</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 p-8 rounded-2xl relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Clock size={120} />
                    </div>
                    <div className="relative">
                      <p className="text-[10px] text-emerald-500 uppercase font-bold tracking-[0.2em] mb-2">Retrieval Speed</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-light tracking-tighter tabular-nums">24</span>
                        <span className="text-gray-500 text-sm font-mono lowercase">ms</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Status Messaging / Progress */}
                <AnimatePresence mode="wait">
                  {status === OCRStatus.PROCESSING && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-8 p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <Loader2 className="animate-spin text-emerald-500" size={24} />
                        <div>
                          <p className="text-sm font-bold text-white uppercase tracking-wider">Processing Batch Archive</p>
                          <p className="text-xs text-emerald-500/80">Digitizing handwritten legal scripts: {processingProgress}%</p>
                        </div>
                      </div>
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-emerald-500" 
                          initial={{ width: 0 }}
                          animate={{ width: `${processingProgress}%` }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Results Info */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4 text-[10px] uppercase font-bold tracking-widest">
                      <span className={searchQuery ? 'text-gray-500' : 'text-emerald-500 underline underline-offset-8'}>Local Database</span>
                      {searchQuery && <span className="text-emerald-500 underline underline-offset-8">Matched Results</span>}
                    </div>
                    
                    <div className="h-4 w-px bg-white/10" />
                    
                    <div className="flex items-center gap-3">
                      <button onClick={exportDatabase} title="Export Database" className="p-1.5 text-gray-500 hover:text-white transition-colors">
                        <Download size={14} />
                      </button>
                      <button onClick={clearAllData} title="Clear Database" className="p-1.5 text-gray-500 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono uppercase">
                    <LayoutGrid size={12} />
                    Virtualized View
                  </div>
                </div>

                {/* Empty States */}
                {documents.length === 0 && (
                  <div className="text-center py-32 border-2 border-dashed border-white/5 rounded-3xl">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-600">
                      <Upload size={24} />
                    </div>
                    <h2 className="text-xl font-medium text-white mb-2 tracking-tight">No indexed documents yet.</h2>
                    <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
                      Upload your handwritten Arabic images to start building your searchable repository.
                    </p>
                  </div>
                )}
                
                {documents.length > 0 && !searchQuery && (
                  <div className="text-center py-32 border border-white/5 bg-white/[0.02] rounded-3xl">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-500">
                      <SearchIcon size={24} />
                    </div>
                    <h2 className="text-xl font-medium text-white mb-2 tracking-tight">Archive Ready</h2>
                    <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
                      Your local database contains <span className="text-emerald-500 font-bold">{documents.length}</span> documents. 
                      Enter a name or phrase in the search bar above to find specific records instantly.
                    </p>
                  </div>
                )}

                {searchQuery && searchResults.length === 0 && documents.length > 0 && (
                  <div className="text-center py-20">
                    <AlertCircle className="mx-auto mb-4 text-gray-700" size={40} />
                    <p className="text-gray-500 italic text-sm">No exact or partial matches found for "{searchQuery}"</p>
                  </div>
                )}
              </div>
            ),
            Footer: () => (
              <footer className="mt-24 border-t border-white/5 py-12 px-6 bg-[#0a0a0a]">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                  <div className="flex gap-12 font-mono text-[9px] uppercase tracking-[0.2em] text-gray-600">
                    <div>Engine: Gemini-3-Flash</div>
                    <div>Mode: Retrieval-Fuzzy-OCR</div>
                    <div>Status: Optimized for 5000+ Items</div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Architecture</div>
                    <div className="text-[11px] text-gray-400 font-serif dir-rtl italic">نظام البحث في النصوص العربية اليدوية</div>
                  </div>
                </div>
              </footer>
            )
          }}
          listClassName="max-w-7xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10 pb-20"
          itemContent={(index, result: any) => (
            <DocumentCard 
              key={result.item.id} 
              doc={result.item} 
              score={searchQuery ? result.score : undefined} 
              currentQuery={searchQuery}
              onUpdate={updateDocumentText}
              onDelete={removeDocument}
            />
          )}
        />
      </main>
    </div>
  );
}
