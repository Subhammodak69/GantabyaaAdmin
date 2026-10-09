import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiCall } from '../utils/apiCall';

const getDocumentUrl = (document) => `/api/v1/admin/documents/${document.id}/download`;

const fetchPrivateDocumentResponse = async (document) => {
  const response = await apiCall(getDocumentUrl(document), 'GET');
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || payload?.detail || 'Unable to download document');
  }
  return response;
};

const getDownloadFilename = (contentDisposition) => {
  const encodedName = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const quotedName = contentDisposition?.match(/filename="([^"]+)"/i)?.[1];
  let rawName = quotedName;
  if (encodedName) {
    try {
      rawName = decodeURIComponent(encodedName);
    } catch {
      rawName = quotedName;
    }
  }
  return rawName?.split(/[\\/]/).pop();
};

export const fetchPrivateDocumentBlob = async (document) => {
  const response = await fetchPrivateDocumentResponse(document);
  return response.blob();
};

export const downloadPrivateDocument = async (document) => {
  const toastId = toast.loading('Downloading document...');
  let objectUrl = '';
  try {
    const response = await fetchPrivateDocumentResponse(document);
    const blob = await response.blob();
    objectUrl = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = objectUrl;
    link.download = getDownloadFilename(response.headers.get('content-disposition'))
      || document.file_name
      || document.title
      || 'document';
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success('Document downloaded successfully', { id: toastId });
  } catch (error) {
    toast.dismiss(toastId);
    throw error;
  } finally {
    if (objectUrl) window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
};

const usePrivateDocumentFile = (document) => {
  const [fileUrl, setFileUrl] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!document?.id) {
      setFileUrl('');
      setMimeType('');
      setLoading(false);
      setError('');
      return undefined;
    }

    let isCurrent = true;
    let objectUrl = '';
    setFileUrl('');
    setMimeType('');
    setLoading(true);
    setError('');

    fetchPrivateDocumentBlob(document)
      .then((blob) => {
        if (!isCurrent) return;
        objectUrl = URL.createObjectURL(blob);
        setFileUrl(objectUrl);
        setMimeType(blob.type || '');
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

  return { fileUrl, mimeType, loading, error };
};

export default usePrivateDocumentFile;
