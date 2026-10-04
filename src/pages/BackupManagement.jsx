import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, Archive, Check, Download, FileUp, Upload } from 'lucide-react';
import Modal from '../component/common/Modal';
import SelectField from '../component/common/SelectField';
import { apiCall, handleApiError } from '../utils/apiCall';

const backupGroups = [
  { value: 'customers', label: 'Customers' },
  { value: 'staff', label: 'Staff' },
  { value: 'tours', label: 'Tours' },
  { value: 'destinations', label: 'Destinations' },
  { value: 'hotels', label: 'Hotels' },
  { value: 'vendors', label: 'Vendors' },
  { value: 'vehicles', label: 'Vehicles' },
];
const backupFormats = [
  { value: 'json', label: 'JSON', extension: '.json' },
  { value: 'csv', label: 'CSV', extension: '.csv' },
  { value: 'xlsx', label: 'Excel (XLSX)', extension: '.xlsx' },
];

const getFilename = (contentDisposition, fallback) => {
  const encodedName = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encodedName) {
    try { return decodeURIComponent(encodedName); } catch { return encodedName; }
  }
  return contentDisposition.match(/filename="?([^";]+)"?/i)?.[1] || fallback;
};

const BackupManagement = () => {
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [exportFormat, setExportFormat] = useState('json');
  const [importFormat, setImportFormat] = useState('json');
  const [selectedFile, setSelectedFile] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const fileInputRef = useRef(null);

  const toggleGroup = (group) => {
    setSelectedGroups((current) => current.includes(group)
      ? current.filter((item) => item !== group)
      : [...current, group]);
  };

  const exportBackup = async () => {
    if (!selectedGroups.length) {
      toast.error('Select at least one data group to export.');
      return;
    }
    setExporting(true);
    try {
      const params = new URLSearchParams();
      selectedGroups.forEach((group) => params.append('groups', group));
      params.set('format', exportFormat);
      const response = await apiCall(`/api/v1/admin/backups/export?${params.toString()}`, 'GET');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || payload?.detail || 'Unable to export backup.');
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error('The export response contained no backup data.');
      const fallbackName = `admin-backup-${new Date().toISOString().slice(0, 10)}.${exportFormat}`;
      const filename = getFilename(response.headers.get('content-disposition') || '', fallbackName);
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      toast.success('Backup exported successfully.');
    } catch (error) {
      handleApiError(error, 'Unable to export backup.');
    } finally {
      setExporting(false);
    }
  };

  const openImportConfirmation = () => {
    if (!selectedFile) {
      toast.error('Choose a backup file to import.');
      return;
    }
    const expectedExtension = backupFormats.find((format) => format.value === importFormat)?.extension;
    if (expectedExtension && !selectedFile.name.toLowerCase().endsWith(expectedExtension)) {
      toast.error(`Choose a ${expectedExtension} file for the selected import format.`);
      return;
    }
    setConfirmImportOpen(true);
  };

  const importBackup = async () => {
    if (!selectedFile) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const response = await apiCall(`/api/v1/admin/backups/import?format=${encodeURIComponent(importFormat)}`, 'POST', formData);
      const contentType = response.headers.get('content-type') || '';
      const result = contentType.includes('application/json')
        ? await response.json().catch(() => ({}))
        : {};
      if (!response.ok || result?.success === false) {
        throw new Error(result?.message || result?.detail || 'Unable to import backup.');
      }
      toast.success(result?.message || 'Backup imported successfully.');
      setConfirmImportOpen(false);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      handleApiError(error, 'Unable to import backup.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
            <Archive className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Backup &amp; restore</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              Export selected admin data or restore data from a supported JSON, CSV, or Excel backup file.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"><Download className="h-5 w-5" /></span>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Export data</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Choose one or more groups to include.</p>
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Data groups</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {backupGroups.map((group) => {
                const checked = selectedGroups.includes(group.value);
                return (
                  <label key={group.value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${checked ? 'border-cyan-400 bg-cyan-50/70 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-100' : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleGroup(group.value)} className="sr-only" />
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? 'border-cyan-600 bg-cyan-600 text-white' : 'border-slate-300 dark:border-gray-600'}`}>{checked && <Check className="h-3.5 w-3.5" />}</span>
                    {group.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="backup-export-format" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Export format</label>
            <SelectField
              inputId="backup-export-format"
              options={backupFormats}
              value={backupFormats.find((format) => format.value === exportFormat) || null}
              onChange={(option) => setExportFormat(option?.value || 'json')}
              isSearchable={false}
              menuPlacement="auto"
            />
          </div>
          <button type="button" onClick={exportBackup} disabled={exporting || !selectedGroups.length} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Download className={`h-4 w-4 ${exporting ? 'animate-bounce' : ''}`} />
            {exporting ? 'Preparing export…' : 'Export selected data'}
          </button>
        </section>

        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"><Upload className="h-5 w-5" /></span>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Import backup</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Upload a backup file to restore admin data.</p>
            </div>
          </div>

          <div>
            <label htmlFor="backup-import-format" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">File format</label>
            <SelectField
              inputId="backup-import-format"
              options={backupFormats}
              value={backupFormats.find((format) => format.value === importFormat) || null}
              onChange={(option) => setImportFormat(option?.value || 'json')}
              isSearchable={false}
              menuPlacement="auto"
            />
          </div>

          <button type="button" onClick={() => fileInputRef.current?.click()} className="flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-cyan-400 hover:bg-cyan-50/50 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-cyan-700 dark:hover:bg-cyan-950/20">
            <FileUp className="h-7 w-7 text-slate-400" />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{selectedFile ? selectedFile.name : 'Choose a backup file'}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : `Accepted format: ${importFormat.toUpperCase()}`}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={backupFormats.find((format) => format.value === importFormat)?.extension}
            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            className="sr-only"
          />
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Importing restores data from the uploaded file. Review the file and format carefully before confirming.</p>
          </div>
          <button type="button" onClick={openImportConfirmation} disabled={importing || !selectedFile} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700">
            <Upload className="h-4 w-4" />
            Import backup
          </button>
        </section>
      </div>

      <Modal
        isOpen={confirmImportOpen}
        onClose={() => { if (!importing) setConfirmImportOpen(false); }}
        title="Confirm backup import"
        icon={AlertTriangle}
        size="md"
        footer={(
          <div className="flex w-full justify-end gap-3">
            <button type="button" onClick={() => setConfirmImportOpen(false)} disabled={importing} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200">Cancel</button>
            <button type="button" onClick={importBackup} disabled={importing} className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{importing ? 'Importing…' : 'Confirm import'}</button>
          </div>
        )}
      >
        <div className="space-y-3 p-1 text-sm text-slate-700 dark:text-slate-300">
          <p>You are about to import <strong>{selectedFile?.name}</strong> as <strong>{importFormat.toUpperCase()}</strong>.</p>
          <p className="text-amber-700 dark:text-amber-300">Make sure this is the intended backup before proceeding.</p>
        </div>
      </Modal>
    </div>
  );
};

export default BackupManagement;
