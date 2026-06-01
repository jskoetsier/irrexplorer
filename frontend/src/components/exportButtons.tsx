import { useState } from 'react';
import { exportToCSV, exportToJSON } from '../services/exportService';
import type { QueryCategory } from '../types';

interface ExportButtonsProps {
  query: string;
  queryType?: QueryCategory;
}

export default function ExportButtons({ query, queryType = 'prefix' }: ExportButtonsProps) {
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    setExportType(format);
    setError(null);

    try {
      if (format === 'csv') {
        await exportToCSV(query, queryType);
      } else if (format === 'json') {
        await exportToJSON(query, queryType);
      }
    } catch (err) {
      setError(`Failed to export as ${format.toUpperCase()}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setExporting(false);
      setExportType(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2" role="group" aria-label="Export options">
        <button
          type="button"
          onClick={() => handleExport('csv')}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#3d4a3d]/40 rounded-lg text-xs font-label-caps font-bold hover:bg-[#333539]/30 hover:border-primary/50 text-on-surface-variant hover:text-on-surface transition-all select-none disabled:opacity-50"
        >
          {exporting && exportType === 'csv' ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border border-primary border-t-transparent"></div>
              <span>EXPORTING...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[15px]">download</span>
              <span>CSV</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleExport('json')}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#3d4a3d]/40 rounded-lg text-xs font-label-caps font-bold hover:bg-[#333539]/30 hover:border-primary/50 text-on-surface-variant hover:text-on-surface transition-all select-none disabled:opacity-50"
        >
          {exporting && exportType === 'json' ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border border-primary border-t-transparent"></div>
              <span>EXPORTING...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[15px]">code</span>
              <span>JSON</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="text-[11px] font-data-mono text-red-400 bg-red-950/20 border border-red-900/30 p-2 rounded-lg" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
