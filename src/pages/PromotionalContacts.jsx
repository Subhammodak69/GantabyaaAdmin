import React, { useCallback, useEffect, useState } from 'react';
import { Download, Mail, Pencil, Plus, RefreshCw, Search, Trash2, UploadCloud, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import ActionMenu from '../component/common/ActionMenu';
import ConfirmDeleteModal from '../component/common/ConfirmDeleteModal';
import ManagementTable from '../component/common/ManagementTable';
import Modal from '../component/common/Modal';
import Pagination from '../component/common/PaginationComponent';
import { apiCall, handleApiError } from '../utils/apiCall';

const emptyContact = { name: '', mobile: '', email: '' };
const inputClass = 'mt-1 h-[42px] w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200';
const getRows = payload => Array.isArray(payload?.data) ? payload.data : [];

const PromotionalContacts = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [contactForm, setContactForm] = useState(emptyContact);
  const [loadingContact, setLoadingContact] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importFormat, setImportFormat] = useState('csv');
  const [importing, setImporting] = useState(false);
  const [exportFormat, setExportFormat] = useState('csv');
  const [exporting, setExporting] = useState(false);

  const loadContacts = useCallback(async (page = currentPage, limit = pageSize) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(limit) });
      if (search.trim()) params.set('search', search.trim());
      const response = await apiCall(`/api/v1/admin/promotional-contacts?${params}`, 'GET');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || payload?.detail || 'Unable to load promotional contacts');
      const rows = getRows(payload);
      setContacts(rows);
      setTotalItems(Number(payload?.pagination?.total_items ?? rows.length));
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, search]);

  useEffect(() => {
    loadContacts(currentPage, pageSize);
  }, [loadContacts, currentPage, pageSize]);

  const openCreateModal = () => {
    setEditingContact(null);
    setContactForm(emptyContact);
    setIsModalOpen(true);
  };

  const openEditModal = async contact => {
    setEditingContact(contact);
    setContactForm(emptyContact);
    setIsModalOpen(true);
    setLoadingContact(true);
    try {
      const response = await apiCall(`/api/v1/admin/promotional-contacts/${contact.id}`, 'GET');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || payload?.detail || 'Unable to load contact details');
      setContactForm({
        name: payload?.data?.name || '',
        mobile: payload?.data?.mobile || '',
        email: payload?.data?.email || '',
      });
    } catch (error) {
      handleApiError(error);
      setIsModalOpen(false);
      setEditingContact(null);
    } finally {
      setLoadingContact(false);
    }
  };

  const closeModal = () => {
    if (saving || loadingContact) return;
    setIsModalOpen(false);
    setEditingContact(null);
    setContactForm(emptyContact);
  };

  const handleSubmit = async event => {
    event.preventDefault();
    const payload = Object.fromEntries(
      Object.entries(contactForm).map(([key, value]) => [key, value.trim() || null])
    );
    if (!Object.values(payload).some(Boolean)) {
      toast.error('Enter at least one of name, mobile, or email');
      return;
    }

    setSaving(true);
    try {
      const endpoint = editingContact
        ? `/api/v1/admin/promotional-contacts/${editingContact.id}`
        : '/api/v1/admin/promotional-contacts';
      const response = await apiCall(endpoint, editingContact ? 'PATCH' : 'POST', payload);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || result?.detail || 'Unable to save contact');
      toast.success(result?.message || (editingContact ? 'Contact updated' : 'Contact created'));
      setIsModalOpen(false);
      setEditingContact(null);
      setContactForm(emptyContact);
      await loadContacts(currentPage, pageSize);
    } catch (error) {
      handleApiError(error);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await apiCall(`/api/v1/admin/promotional-contacts/${deleteTarget.id}`, 'DELETE');
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || result?.detail || 'Unable to delete contact');
      toast.success(result?.message || 'Contact deleted');
      setDeleteTarget(null);
      const nextPage = contacts.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      setCurrentPage(nextPage);
      await loadContacts(nextPage, pageSize);
    } catch (error) {
      handleApiError(error);
    } finally {
      setDeleting(false);
    }
  };

  const importContacts = async event => {
    event.preventDefault();
    if (!importFile) {
      toast.error('Choose a file to import');
      return;
    }
    const formData = new FormData();
    formData.append('file', importFile);
    setImporting(true);
    try {
      const response = await apiCall(`/api/v1/admin/promotional-contacts/import?format=${importFormat}`, 'POST', formData);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || result?.detail || 'Unable to import contacts');
      toast.success(result?.message || `${result?.data?.imported_count ?? 0} contacts imported`);
      setImportFile(null);
      event.target.reset();
      await loadContacts(1, pageSize);
      setCurrentPage(1);
    } catch (error) {
      handleApiError(error);
    } finally {
      setImporting(false);
    }
  };

  const exportContacts = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format: exportFormat });
      if (search.trim()) params.set('search', search.trim());
      const response = await apiCall(`/api/v1/admin/promotional-contacts/export?${params}`, 'GET');
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.message || errorPayload?.detail || 'Unable to export contacts');
      }
      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition') || '';
      const filename = contentDisposition.match(/filename="?([^";]+)"?/i)?.[1] || `promotional-contacts.${exportFormat}`;
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      handleApiError(error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5 pb-8">
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
        title="Delete promotional contact"
        itemLabel={deleteTarget?.name || deleteTarget?.email || deleteTarget?.mobile || 'this contact'}
        message="This will permanently remove the selected promotional contact."
        confirming={deleting}
      />

      <header className="flex flex-col gap-3 px-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Promotional contacts</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage the contacts used for promotional outreach.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => loadContacts(currentPage, pageSize)} className="inline-flex h-[42px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button type="button" onClick={openCreateModal} className="inline-flex h-[42px] items-center gap-2 rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white hover:bg-cyan-700">
            <Plus className="h-4 w-4" /> Add contact
          </button>
        </div>
      </header>

      <section className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:grid-cols-[minmax(220px,1fr)_auto_auto]">
        <label className="relative block">
          <span className="sr-only">Search promotional contacts</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={event => {
              setSearch(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search name, mobile, or email"
            className={`${inputClass} !mt-0 pl-9`}
          />
        </label>

        <form onSubmit={importContacts} className="flex flex-wrap items-center gap-2">
          <select aria-label="Import format" value={importFormat} onChange={event => setImportFormat(event.target.value)} className="h-[42px] rounded-xl border border-gray-200 bg-white px-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
            <option value="csv">CSV</option><option value="xlsx">XLSX</option><option value="json">JSON</option>
          </select>
          <label className="inline-flex h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">
            <UploadCloud className="h-4 w-4" />
            <span className="max-w-28 truncate">{importFile?.name || 'Choose file'}</span>
            <input type="file" accept=".csv,.xlsx,.json" className="hidden" onChange={event => setImportFile(event.target.files?.[0] || null)} />
          </label>
          <button type="submit" disabled={!importFile || importing} className="h-[42px] rounded-xl bg-slate-700 px-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-slate-600">
            {importing ? 'Importing...' : 'Import'}
          </button>
        </form>

        <div className="flex items-center gap-2">
          <select aria-label="Export format" value={exportFormat} onChange={event => setExportFormat(event.target.value)} className="h-[42px] rounded-xl border border-gray-200 bg-white px-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
            <option value="csv">CSV</option><option value="xlsx">XLSX</option><option value="json">JSON</option>
          </select>
          <button type="button" onClick={exportContacts} disabled={exporting} className="inline-flex h-[42px] items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-700 disabled:opacity-50 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-300">
            <Download className="h-4 w-4" /> {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-gray-500"><RefreshCw className="h-4 w-4 animate-spin" />Loading contacts...</div>
        ) : contacts.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-2 text-center">
            <Users className="h-9 w-9 text-gray-300" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">No promotional contacts found</p>
            <p className="text-xs text-gray-500">Add a contact or import a list to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <ManagementTable><table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800/70 dark:text-gray-400">
                <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Mobile</th><th className="px-4 py-3">Email</th><th className="px-4 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {contacts.map(contact => (
                  <tr key={contact.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{contact.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{contact.mobile || '—'}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{contact.email || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <ActionMenu menuId={`promotional-contact-${contact.id}`} actions={[
                        { label: 'Edit contact', icon: <Pencil className="h-4 w-4 text-blue-600" />, onClick: () => openEditModal(contact) },
                        { label: 'Delete contact', icon: <Trash2 className="h-4 w-4 text-rose-600" />, onClick: () => setDeleteTarget(contact), className: 'text-rose-600 dark:text-rose-400' },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></ManagementTable>
          </div>
        )}
      </section>

      <Pagination
        currentPage={currentPage}
        totalItems={totalItems}
        itemsPerPage={pageSize}
        onPageChange={setCurrentPage}
        onLimitChange={limit => {
          setPageSize(limit);
          setCurrentPage(1);
        }}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingContact ? 'Edit promotional contact' : 'Add promotional contact'}
        icon={Mail}
        size="md"
        footer={(
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={closeModal} disabled={saving || loadingContact} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-200">Cancel</button>
            <button type="submit" form="promotional-contact-form" disabled={saving || loadingContact} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50">
              {loadingContact ? 'Loading...' : saving ? 'Saving...' : editingContact ? 'Save changes' : 'Create contact'}
            </button>
          </div>
        )}
      >
        <form id="promotional-contact-form" onSubmit={handleSubmit} className="space-y-4 p-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Name
            <input value={contactForm.name} onChange={event => setContactForm(current => ({ ...current, name: event.target.value }))} className={inputClass} maxLength={255} />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Mobile
            <input value={contactForm.mobile} onChange={event => setContactForm(current => ({ ...current, mobile: event.target.value }))} className={inputClass} maxLength={20} />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Email
            <input type="email" value={contactForm.email} onChange={event => setContactForm(current => ({ ...current, email: event.target.value }))} className={inputClass} />
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">At least one field is required.</p>
        </form>
      </Modal>
    </div>
  );
};

export default PromotionalContacts;
