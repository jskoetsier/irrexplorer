import React, { useState } from 'react';
import { exportToCSV, exportToJSON } from '../services/exportService';
import './exportButtons.css';

const ExportButtons = ({ query, queryType = 'auto' }) => {
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState(null);
  const [error, setError] = useState(null);

  const handleExport = async (format) => {
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
      setError(`Failed to export as ${format.toUpperCase()}: ${err.message}`);
    } finally {
      setExporting(false);
      setExportType(null);
    }
  };

  return (
    <div className="export-buttons">
      <div className="btn-group" role="group" aria-label="Export options">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => handleExport('csv')}
          disabled={exporting}
        >
          {exporting && exportType === 'csv' ? (
            <>
              <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
              Exporting...
            </>
          ) : (
            <>
              <i className="fas fa-file-csv me-1"></i>
              Export CSV
            </>
          )}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => handleExport('json')}
          disabled={exporting}
        >
          {exporting && exportType === 'json' ? (
            <>
              <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
              Exporting...
            </>
          ) : (
            <>
              <i className="fas fa-file-code me-1"></i>
              Export JSON
            </>
          )}
        </button>
      </div>
      {error && (
        <div className="alert alert-danger alert-sm mt-2 mb-0" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};

export default ExportButtons;
