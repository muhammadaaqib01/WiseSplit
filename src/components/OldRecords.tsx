import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Trash2, 
  FileText, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

interface OldRecord {
  id: string;
  fileName: string;
  fileSize: number;
  fileData: string; // Base64
  fileType: string;
  createdAt: Timestamp;
  userId: string;
}

interface OldRecordsProps {
  user: User;
}

export default function OldRecords({ user }: OldRecordsProps) {
  const [records, setRecords] = useState<OldRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'old_records'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as OldRecord[];
      setRecords(docs);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching records:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user.uid]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Firestore limit is 1MB per document. Base64 adds ~33% overhead.
    // So we limit to ~750KB to be safe.
    if (file.size > 750 * 1024) {
      setError("File is too large. Excel records must be under 750KB to be saved in the database.");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        
        await addDoc(collection(db, 'old_records'), {
          userId: user.uid,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          fileData: base64Data,
          createdAt: serverTimestamp()
        });

        setSuccess(`"${file.name}" uploaded successfully!`);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'old_records');
        setError("Failed to save file to database.");
      } finally {
        setUploading(false);
      }
    };

    reader.onerror = () => {
      setError("Failed to read the file.");
      setUploading(false);
    };

    reader.readAsDataURL(file);
  };

  const downloadFile = (record: OldRecord) => {
    const link = document.createElement('a');
    link.href = record.fileData;
    link.download = record.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteRecord = async (id: string, fileName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}"?`)) return;
    
    try {
      await deleteDoc(doc(db, 'old_records', id));
      setSuccess("Record deleted successfully.");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `old_records/${id}`);
      setError("Failed to delete record.");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Old Records</h1>
            <p className="text-slate-500">Archive and manage your legacy Excel spreadsheets</p>
          </div>
        </div>

        <label className={cn(
          "flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg cursor-pointer",
          uploading && "opacity-50 pointer-events-none"
        )}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Uploading...' : 'Upload record'}
          <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} disabled={uploading} />
        </label>
      </div>

      {(error || success) && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-4 rounded-2xl flex items-center gap-3 border",
            error ? "bg-red-50 dark:bg-red-900/20 text-red-600 border-red-100 dark:border-red-900/30" : 
                    "bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-100 dark:border-blue-900/30"
          )}
        >
          {error ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
          <p className="text-sm font-medium">{error || success}</p>
        </motion.div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          <p className="text-slate-500 font-medium animate-pulse">Scanning archives...</p>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center">
          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold mb-2">No records found</h3>
          <p className="text-slate-500 max-w-sm mx-auto">
            You haven't uploaded any old records yet. Upload your legacy spreadsheets to keep them all in one place.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {records.map((record) => (
              <motion.div
                key={record.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 transition-all flex items-start gap-4 shadow-sm hover:shadow-md"
              >
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600 flex-shrink-0">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-white truncate" title={record.fileName}>
                    {record.fileName}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {record.createdAt ? format(record.createdAt.toDate(), 'MMM d, yyyy') : 'Recently'}
                    </span>
                    <span>•</span>
                    <span>{formatFileSize(record.fileSize)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => downloadFile(record)}
                    className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteRecord(record.id, record.fileName)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
        <h4 className="font-bold flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4 text-blue-500" />
          Technical Note
        </h4>
        <p className="text-xs text-slate-500 leading-relaxed">
          Files are stored directly in your secure database. To ensure performance, we limit individual file sizes to 750KB. 
          For larger archives, we recommend splitting your Excel sheets by year or category.
        </p>
      </div>
    </div>
  );
}
