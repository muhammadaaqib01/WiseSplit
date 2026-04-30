import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { User } from 'firebase/auth';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  Info
} from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency, cn } from '../lib/utils';

interface ImportDataProps {
  user: User;
  onComplete: () => void;
}

interface PreviewItem {
  date: string;
  type: 'received' | 'spent';
  amount: number;
  description: string;
  paid_to?: string;
  isValid: boolean;
}

export default function ImportData({ user, onComplete }: ImportDataProps) {
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const parsed: PreviewItem[] = data.map((row: any) => {
          // Normalize column names
          const date = row.Date || row.date || row.DATE;
          const type = (row.Type || row.type || row.TYPE || '').toLowerCase();
          const amount = parseFloat(row.Amount || row.amount || row.AMOUNT || '0');
          const description = row.Description || row.description || row.DESCRIPTION || '';
          const paid_to = row.PaidTo || row.paid_to || row.PAID_TO || row.Vendor || '';

          let formattedDate = '';
          try {
            if (date instanceof Date) {
              formattedDate = format(date, 'yyyy-MM-dd');
            } else {
              formattedDate = format(new Date(date), 'yyyy-MM-dd');
            }
          } catch (e) {
            formattedDate = 'Invalid Date';
          }

          return {
            date: formattedDate,
            type: type === 'received' || type === 'income' ? 'received' : 'spent',
            amount: Math.abs(amount),
            description: String(description),
            paid_to: String(paid_to),
            isValid: formattedDate !== 'Invalid Date' && amount > 0 && description.length > 0
          };
        });

        setPreview(parsed);
      } catch (err) {
        setError('Failed to parse Excel file. Please ensure it follows a standard format.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    const validItems = preview.filter(p => p.isValid);
    if (validItems.length === 0) return;

    setLoading(true);
    try {
      // Using batch writes for efficiency (Firebase limit is 500 per batch)
      const batches = [];
      for (let i = 0; i < validItems.length; i += 500) {
        const batch = writeBatch(db);
        validItems.slice(i, i + 500).forEach(item => {
          const docRef = doc(collection(db, 'transactions'));
          batch.set(docRef, {
            ...item,
            month: format(new Date(item.date), 'yyyy-MM'),
            userId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        });
        batches.push(batch.commit());
      }
      
      await Promise.all(batches);
      onComplete();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'transactions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Import Data</h1>
          <p className="text-slate-500">Upload your bank statements or Excel sheets.</p>
        </div>
      </div>

      {!preview.length ? (
        <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center">
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-600">
            <Upload className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Select Excel File</h2>
          <p className="text-slate-500 mb-8 max-w-sm mx-auto leading-relaxed">
            Upload a .xlsx file with columns for <b>Date, Amount, Description,</b> and <b>Type</b>.
          </p>
          
          <label className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold cursor-pointer transition-all shadow-lg shadow-blue-200 dark:shadow-none inline-block">
            Choose File
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
          </label>
          
          <div className="mt-12 flex items-center justify-center gap-6 text-slate-400 opacity-50">
            <FileSpreadsheet className="w-8 h-8" />
            <div className="w-px h-8 bg-slate-300 dark:bg-slate-700"></div>
            <Info className="w-8 h-8" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-sm">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <h3 className="font-bold">File Parsed Successfully</h3>
                <p className="text-sm text-slate-500">{preview.filter(p => p.isValid).length} valid transactions found</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setPreview([])}
                className="px-6 py-3 border border-slate-200 dark:border-slate-800 rounded-xl font-bold hover:bg-white dark:hover:bg-slate-900"
              >
                Clear
              </button>
              <button
                onClick={handleImport}
                disabled={loading || preview.filter(p => p.isValid).length === 0}
                className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? 'Importing...' : 'Start Import'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 p-4 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Date</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Description</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Type</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 text-right">Amount</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {preview.map((item, i) => (
                  <tr key={i} className={cn("hover:bg-slate-50 transition-colors", !item.isValid && "bg-red-50/50 dark:bg-red-900/10 opacity-60")}>
                    <td className="px-6 py-3 text-sm">{item.date}</td>
                    <td className="px-6 py-3 text-sm font-medium">{item.description}</td>
                    <td className="px-6 py-3 text-sm uppercase font-bold text-xs">
                      <span className={item.type === 'received' ? "text-green-600" : "text-red-500"}>{item.type}</span>
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-bold">{formatCurrency(item.amount)}</td>
                    <td className="px-6 py-3 text-center">
                      {item.isValid ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-500 mx-auto" title="Invalid data - will be skipped" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
