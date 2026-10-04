import { useEffect, useState } from 'react';
import { apiCall } from '../utils/apiCall';

const getDocumentUrl = (document) => `/api/v1/admin/documents/${document.id}/download`;

export const fetchPrivateDocumentBlob = async (document) => {
  const response = await apiCall(getDocumentUrl(document), 'GET');
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || payload?.detail || 'Unable to download document');
  }
  return response.blob();
};

export const downloadPrivateDocument = async (document) => {
  const blob = await fetchPrivateDocumentBlob(document);
  const objectUrl = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = objectUrl;
  link.download = document.file_name || 'document';
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};

const usePrivateDocumentFile = (document) => {
  const [fileUrl, setFileUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!document?.id) {
      setFileUrl('');
      setLoading(false);
      setError('');
      return undefined;
    }

    let isCurrent = true;
    let objectUrl = '';
    setFileUrl('');
    setLoading(true);
    setError('');

    fetchPrivateDocumentBlob(document)
      .then((blob) => {
        if (!isCurrent) return;
        objectUrl = URL.createObjectURL(blob);
        setFileUrl(objectUrl);
      })
      .catch((fetchError) => {
        if (isCurrent) setError(fetchError.message || 'Unable to load document');
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document]);

  return { fileUrl, loading, error };
};

export default usePrivateDocumentFile;
