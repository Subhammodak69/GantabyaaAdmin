import React from 'react';
import usePrivateDocumentFile from '../../hooks/usePrivateDocumentFile';

const PrivateDocumentPreview = ({ document }) => {
  const { fileUrl, mimeType, loading, error } = usePrivateDocumentFile(document);
  const mediaType = (mimeType || document?.mime_type || '').toLowerCase();
  const fileName = (document?.file_name || document?.title || '').toLowerCase();
  const isPdf = mediaType.includes('pdf') || fileName.endsWith('.pdf');
  const isVideo = mediaType.startsWith('video/') || /\.(mp4|mov|webm|ogg)$/.test(fileName);
  const isImage = mediaType.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|avif)$/.test(fileName);

  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center bg-black p-4">
      <div className="mb-3 w-full max-w-5xl truncate text-center text-sm font-medium text-slate-300">
        {document?.title || document?.file_name || 'Document preview'}
      </div>
      {loading ? (
        <p className="text-sm text-slate-300">Loading document...</p>
      ) : error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : !fileUrl ? null : isPdf ? (
        <iframe
          src={fileUrl}
          title={document?.title || 'Document preview'}
          className="h-[75vh] w-full max-w-5xl rounded-xl bg-white"
        />
      ) : isVideo ? (
        <video src={fileUrl} controls className="max-h-[75vh] max-w-full rounded-xl object-contain" />
      ) : isImage ? (
        <img
          src={fileUrl}
          alt={document?.title || document?.file_name || 'Document'}
          className="max-h-[75vh] max-w-full rounded-xl object-contain"
        />
      ) : (
        <p className="text-sm text-slate-300">Preview is unavailable for this file type. You can download the document instead.</p>
      )}
    </div>
  );
};

export default PrivateDocumentPreview;
