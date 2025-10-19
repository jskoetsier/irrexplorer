import axios from 'axios';
import config from '../config.json';

const API_BASE = config.api_url;

export const exportToCSV = async (query, type = 'auto') => {
  const response = await axios.post(
    `${API_BASE}/api/export/csv`,
    { query, type },
    { responseType: 'blob' }
  );

  // Create download link
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `irrexplorer_${query.replace(/\//g, '_')}_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();

  return response;
};

export const exportToJSON = async (query, type = 'auto') => {
  const response = await axios.post(
    `${API_BASE}/api/export/json`,
    { query, type },
    { responseType: 'blob' }
  );

  // Create download link
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `irrexplorer_${query.replace(/\//g, '_')}_${Date.now()}.json`);
  document.body.appendChild(link);
  link.click();
  link.remove();

  return response;
};

export const bulkQuery = async (queries) => {
  const response = await axios.post(`${API_BASE}/api/bulk-query`, { queries });
  return response.data;
};
