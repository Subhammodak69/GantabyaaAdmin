export const downloadPdfResponse = async (response, fallbackFilename) => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/pdf')) {
    throw new Error('The server did not return a PDF file.');
  }

  const contentDisposition = response.headers.get('content-disposition') || '';
  const filename = contentDisposition.match(/filename="?([^";]+)"?/i)?.[1] || fallbackFilename;
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = window.document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};
