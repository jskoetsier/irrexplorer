import axios from 'axios';
import config from '../config.json';

const API_BASE = config.api_url || '';

export const exportToCSV = async (query: string, type = 'auto'): Promise<void> => {
  const response = await axios.post(
    `${API_BASE}/api/export/csv`,
    { query, type },
    { responseType: 'blob' }
  );

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `irrexplorer_${query.replace(/\//g, '_')}_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export const exportToJSON = async (query: string, type = 'auto'): Promise<void> => {
  const response = await axios.post(
    `${API_BASE}/api/export/json`,
    { query, type },
    { responseType: 'blob' }
  );

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `irrexplorer_${query.replace(/\//g, '_')}_${Date.now()}.json`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export const bulkQuery = async (queries: string[]): Promise<unknown> => {
  const response = await axios.post(`${API_BASE}/api/bulk-query`, { queries });
  return response.data;
};
