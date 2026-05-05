/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { FileText, Calendar, Info, Edit3, Check, X, Trash2 } from 'lucide-react';
import { IndexedDocument } from '../types';

interface DocumentCardProps {
  doc: IndexedDocument;
  score?: number;
  currentQuery?: string;
  onUpdate?: (id: string, newText: string) => void;
  onDelete?: (id: string) => void;
}

export function DocumentCard({ doc, score, currentQuery, onUpdate, onDelete }: DocumentCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(doc.recognizedText);
  const isMatch = score !== undefined && score < 0.4;
  
  const handleSave = () => {
    onUpdate?.(doc.id, editedText);
    setIsEditing(false);
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query || query.length < 2) return text;
    // Escape regex special characters
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() 
            ? <span key={i} className="bg-emerald-500/30 text-emerald-400 px-0.5 rounded">{part}</span> 
            : part
        )}
      </>
    );
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group relative flex flex-col bg-[#1a1a1a] border border-[#333] hover:border-emerald-500/50 transition-all duration-300 rounded-lg overflow-hidden ${isMatch ? 'ring-1 ring-emerald-500' : ''}`}
      id={`doc-${doc.id}`}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-black">
        <img 
          src={doc.base64} 
          alt={doc.metadata.fileName}
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
          referrerPolicy="no-referrer"
        />
        {score !== undefined && (
          <div className="absolute top-2 right-2 bg-emerald-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
            {Math.round((1 - score) * 100)}% Match
          </div>
        )}
        <button 
          className="absolute top-2 left-2 p-2 bg-black/50 hover:bg-red-500 hover:text-white text-white rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100"
          title="Delete Document"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(doc.id);
          }}
        >
          <Trash2 size={14} />
        </button>
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className="absolute bottom-2 right-2 p-2 bg-black/50 hover:bg-emerald-500 hover:text-black text-white rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100"
        >
          <Edit3 size={14} />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium text-white truncate max-w-[150px]">
              {doc.metadata.fileName}
            </h3>
            <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono">
              <Calendar size={12} />
              {new Date(doc.metadata.createdAt).toLocaleDateString()}
            </div>
          </div>
          <FileText size={18} className="text-emerald-500 opacity-50 group-hover:opacity-100 transition-opacity" />
        </div>

        <div className="relative min-h-[60px]">
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <textarea 
                className="w-full h-32 bg-black/40 border border-emerald-500/30 rounded p-2 text-xs text-white font-serif text-right dir-rtl focus:outline-none focus:border-emerald-500"
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setIsEditing(false)} className="p-1 hover:bg-white/5 rounded text-gray-500"><X size={16} /></button>
                <button onClick={handleSave} className="p-1 hover:bg-emerald-500/10 rounded text-emerald-500 flex items-center gap-1 text-[10px] font-bold uppercase"><Check size={16} /> Save</button>
              </div>
            </div>
          ) : (
            <>
              <div className="line-clamp-4 text-right dir-rtl leading-relaxed text-xs text-gray-400 font-serif">
                {highlightMatch(doc.recognizedText, currentQuery || '')}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] to-transparent pointer-events-none" />
            </>
          )}
        </div>

        <button 
          className="mt-2 w-full py-2 bg-white/5 hover:bg-white/10 text-[10px] text-gray-300 font-semibold uppercase tracking-widest border border-white/10 rounded transition-colors flex items-center justify-center gap-2"
          onClick={() => {
            const win = window.open();
            win?.document.write(`
              <html>
                <header><title>Document Preview</title></header>
                <body style="background:#0a0a0a; color:white; display:flex; flex-direction:column; align-items:center; padding:40px; font-family:sans-serif;">
                  <img src="${doc.base64}" style="max-width:800px; border:1px solid #333;"/>
                  <div style="margin-top:20px; max-width:800px; line-height:1.8; text-align:right; direction:rtl;">
                    <h3>Recognized Text:</h3>
                    <p>${doc.recognizedText.replace(/\n/g, '<br>')}</p>
                  </div>
                </body>
              </html>
            `);
          }}
        >
          <Info size={12} />
          View Details
        </button>
      </div>
    </motion.div>
  );
}
