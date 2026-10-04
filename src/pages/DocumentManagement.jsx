import React, { useEffect, useState } from 'react';
import ManagementTable from '../component/common/ManagementTable';
import toast from 'react-hot-toast';
import { FileText, Plus, Trash2, RefreshCw, Eye, Pencil, Download } from 'lucide-react';
import Modal from '../component/common/Modal';
import ConfirmDeleteModal from '../component/common/ConfirmDeleteModal';
import MediaViewerModal from '../component/common/MediaViewerModal';
import DragDropUpload from '../component/common/DragDropUpload';
import SelectField from '../component/common/SelectField';
import Pagination from '../component/common/PaginationComponent';
import ActionMenu from '../component/common/ActionMenu';
import { apiCall, handleApiError } from '../utils/apiCall';
import usePrivateDocumentFile, { downloadPrivateDocument } from '../hooks/usePrivateDocumentFile';

const documentTypes = ['ID_PROOF', 'ADDRESS_PROOF', 'TOUR_DOCUMENT', 'OTHER'];
const documentTypeOptions = documentTypes.map((type) => ({ value: type, label: type }));
const defaultFilters = {
  from_date: '',
  to_date: '',
  document_type: '',
  status: 'active',
  customer_id: '',
  uploaded_by: '',
};

const defaultForm = {
  customer_id: '',
  file: '',
  file_name: '',
  document_type: 'ID_PROOF',
  title: '',
  description: '',
};

const defaultEditForm = {
  id: '',
  document_type: 'ID_PROOF',
  title: '',
  description: '',
};

const CUSTOMER_PAGE_SIZE = 20;

const formatDate = (value) => {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return value;
  }
};

const getFileType = (url = '', fileName = '') => {
  const lower = (url + fileName).toLowerCase();
  if (lower.includes('.pdf')) return 'pdf';
  if (lower.match(/\.(mp4|mov|webm|ogg)/) || lower.includes('video/upload') || lower.includes('video')) return 'video';
  if (lower.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|avif)/)) return 'image';
  return 'image';
};

const buildCustomerLabel = (customer) => {
  if (!customer) return '';
  const parts = [customer.name].filter(Boolean);
  if (customer.mobile) parts.push(customer.mobile);
  return parts.join(' • ') || customer.customer_code || customer.id;
};

const DocumentPreviewContent = ({ doc }) => {
  const { fileUrl, loading, error } = usePrivateDocumentFile(doc);
  if (!doc) return null;
  const fileType = getFileType(doc.file_url || '', doc.file_name || '');
  return (
    <div
      style={{ background: '#000' }}
      className="flex min-h-full w-full flex-col"
    >
      {/* dark title strip */}
      <div
        style={{ background: 'rgba(0,0,0,0.7)' }}
        className="flex shrink-0 items-center justify-center px-12 py-2"
      >
        <span className="max-w-md truncate text-center text-xs font-medium text-slate-400">
          {doc.title || doc.file_name || 'Document preview'}
        </span>
      </div>

      {/* media area */}
      <div className="flex flex-1 items-center justify-center p-3">
        {loading ? (
          <p className="text-sm text-slate-300">Loading document...</p>
        ) : error ? (
          <p className="text-sm text-red-300">{error}</p>
        ) : !fileUrl ? null : fileType === 'pdf' ? (
          <iframe
            src={fileUrl}
            title={doc.title || 'PDF preview'}
            style={{ border: 'none', background: '#fff' }}
            className="h-[80vh] w-full max-w-5xl rounded-xl"
          />
        ) : fileType === 'video' ? (
          <video
            src={fileUrl}
            controls
            autoPlay
            className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-xl"
          />
        ) : (
          <img
            src={fileUrl}
            alt={doc.title || doc.file_name || 'Document'}
            className="max-h-[80vh] w-auto max-w-full rounded-xl object-contain shadow-xl"
          />
        )}
      </div>
    </div>
  );
};

const DocumentManagement = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState(defaultFilters);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState(defaultForm);
  const [previewDoc, setPreviewDoc] = useState(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(defaultEditForm);
  const [editSaving, setEditSaving] = useState(false);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ---- Customer select (paginated, lazy-loaded on menu open, more on scroll) ----
  const [customerOptions, setCustomerOptions] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedFilterCustomer, setSelectedFilterCustomer] = useState(null);
  const [customerPage, setCustomerPage] = useState(1);
  const [customerHasMore, setCustomerHasMore] = useState(true);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerLoaded, setCustomerLoaded] = useState(false);

  // ---- Fetch (server-side pagination) ----
  const loadDocuments = async (page = currentPage, limit = itemsPerPage, activeFilters = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(limit) });
      Object.entries(activeFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const response = await apiCall(`/api/v1/admin/documents?${params.toString()}`, 'GET');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.detail || 'Unable to fetch documents');
      }

      const data = Array.isArray(payload?.data) ? payload.data : [];
      const meta = payload?.pagination || {};
      const serverTotalPages = Number(meta.total_pages) || 1;

      // If we just deleted the last item(s) on a page, step back to the last valid page.
      if (data.length === 0 && page > 1 && page > serverTotalPages) {
        setLoading(false);
        await loadDocuments(serverTotalPages, limit);
        return;
      }

      setDocuments(data);
      setTotalItems(Number(meta.total_items) || 0);
      setTotalPages(serverTotalPages);
      setCurrentPage(Number(meta.current_page) || page);
      setSelectedIds(new Set());
    } catch (error) {
      handleApiError(error, 'Unable to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments(1, itemsPerPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePageChange = (page) => {
    loadDocuments(page, itemsPerPage);
  };

  const handleLimitChange = (limit) => {
    setItemsPerPage(limit);
    loadDocuments(1, limit);
  };

  const handleApplyFilters = () => {
    if (Boolean(filters.from_date) !== Boolean(filters.to_date)) {
      toast.error('Select both dates to filter by upload date');
      return;
    }
    if (filters.from_date && filters.to_date < filters.from_date) {
      toast.error('End date must be on or after start date');
      return;
    }
    loadDocuments(1, itemsPerPage, filters);
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    setSelectedFilterCustomer(null);
    loadDocuments(1, itemsPerPage, defaultFilters);
  };

  const handleDownload = async (doc) => {
    try {
      await downloadPrivateDocument(doc);
    } catch (error) {
      handleApiError(error, 'Unable to download document');
    }
  };

  // ---- Customers (for the customer select field) ----
  const loadCustomers = async (page = 1, append = false) => {
    if (customerLoading) return;
    setCustomerLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(CUSTOMER_PAGE_SIZE) });
      const response = await apiCall(`/api/v1/admin/customers?${params.toString()}`, 'GET');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.detail || 'Unable to fetch customers');
      }

      const data = Array.isArray(payload?.data) ? payload.data : [];
      const meta = payload?.pagination || {};

      const options = data.map((customer) => ({
        value: customer.id,
        label: buildCustomerLabel(customer),
      }));

      setCustomerOptions((current) => (append ? [...current, ...options] : options));
      setCustomerPage(Number(meta.current_page) || page);
      setCustomerHasMore(Boolean(meta.has_next));
      setCustomerLoaded(true);
    } catch (error) {
      handleApiError(error, 'Unable to load customers');
    } finally {
      setCustomerLoading(false);
    }
  };

  const handleCustomerMenuOpen = () => {
    if (!customerLoaded && !customerLoading) {
      loadCustomers(1, false);
    }
  };

  const handleCustomerMenuScrollToBottom = () => {
    if (customerHasMore && !customerLoading) {
      loadCustomers(customerPage + 1, true);
    }
  };

  const resetCustomerSelect = () => {
    setSelectedCustomer(null);
  };

  // ---- Upload (create) ----
  const handleFieldChange = (field, value) => {
    setFormState((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formState.customer_id || !formState.title || !formState.file) {
      toast.error('Customer, title and document file are required');
      return;
    }

    setSaving(true);

    try {
      const response = await apiCall('/api/v1/admin/documents', 'POST', {
        customer_id: formState.customer_id,
        file: formState.file,
        file_name: formState.file_name || 'document',
        document_type: formState.document_type,
        title: formState.title,
        description: formState.description || '',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.detail || 'Unable to upload document');
      }

      toast.success('Document uploaded successfully');
      setFormState(defaultForm);
      resetCustomerSelect();
      setIsModalOpen(false);
      await loadDocuments(1, itemsPerPage);
    } catch (error) {
      handleApiError(error, 'Unable to upload document');
    } finally {
      setSaving(false);
    }
  };

  const closeUploadModal = () => {
    setIsModalOpen(false);
    setFormState(defaultForm);
    resetCustomerSelect();
  };

  // ---- Edit (PATCH) ----
  const openEditModal = (doc) => {
    setEditForm({
      id: doc.id,
      document_type: doc.document_type || 'ID_PROOF',
      title: doc.title || '',
      description: doc.description || '',
    });
    setIsEditModalOpen(true);
  };

  const handleEditFieldChange = (field, value) => {
    setEditForm((current) => ({ ...current, [field]: value }));
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    if (!editForm.title) {
      toast.error('Title is required');
      return;
    }

    setEditSaving(true);
    try {
      const response = await apiCall(`/api/v1/admin/documents/${editForm.id}`, 'PATCH', {
        document_type: editForm.document_type,
        title: editForm.title,
        description: editForm.description || '',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.detail || 'Unable to update document');
      }

      toast.success('Document updated successfully');
      setIsEditModalOpen(false);
      setEditForm(defaultEditForm);
      await loadDocuments(currentPage, itemsPerPage);
    } catch (error) {
      handleApiError(error, 'Unable to update document');
    } finally {
      setEditSaving(false);
    }
  };

  // ---- Delete (bulk endpoint, used for single + multi delete) ----
  const deleteDocuments = async (ids) => {
    if (!ids.length) return;
    setBulkDeleting(true);
    try {
      const response = await apiCall('/api/v1/admin/documents/bulk', 'DELETE', { document_ids: ids });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.detail || 'Unable to delete document(s)');
      }
      toast.success(ids.length > 1 ? 'Documents deleted successfully' : 'Document deleted successfully');
      await loadDocuments(currentPage, itemsPerPage);
    } catch (error) {
      handleApiError(error, 'Unable to delete document(s)');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleDelete = (document) => {
    setDeleteTarget(document);
    setDeleteIds([document.id]);
    setIsDeleteModalOpen(true);
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setDeleteTarget(null);
    setDeleteIds(ids);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteDocuments = async () => {
    if (!deleteIds.length) return;
    setBulkDeleting(true);
    try {
      await deleteDocuments(deleteIds);
      setIsDeleteModalOpen(false);
      setDeleteIds([]);
      setDeleteTarget(null);
    } finally {
      setBulkDeleting(false);
    }
  };

  // ---- Selection ----
  const selectableDocuments = documents.filter((doc) => doc.is_active);
  const allOnPageSelected = selectableDocuments.length > 0
    && selectableDocuments.every((doc) => selectedIds.has(doc.id));

  const toggleSelectAll = () => {
    setSelectedIds((current) => {
      if (allOnPageSelected) return new Set();
      return new Set(selectableDocuments.map((doc) => doc.id));
    });
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const hasDocuments = documents.length > 0;

  return (
    <div className=" space-y-3 pb-6">
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!bulkDeleting) {
            setIsDeleteModalOpen(false);
            setDeleteIds([]);
            setDeleteTarget(null);
          }
        }}
        onConfirm={confirmDeleteDocuments}
        title={deleteIds.length > 1 ? 'Delete selected documents' : 'Delete document'}
        itemLabel={deleteTarget?.file_name || (deleteIds.length > 1 ? `${deleteIds.length} selected documents` : 'this document')}
        message={deleteIds.length > 1 ? `This will mark ${deleteIds.length} selected documents as deleted.` : `This will mark ${deleteTarget?.file_name || 'this document'} as deleted.`}
        confirming={bulkDeleting}
        confirmText={deleteIds.length > 1 ? 'Delete selected' : 'Delete document'}
      />

      <div className="px-2 text-slate-900 dark:text-slate-100">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mt-1 bg-gradient-to-r from-slate-900 via-violet-700 to-indigo-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent md:text-3xl dark:from-slate-100 dark:via-violet-300 dark:to-indigo-300">Document Management</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage all uploaded traveler and booking documents in one place.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Refresh documents"
              title="Refresh documents"
              onClick={() => loadDocuments(currentPage, itemsPerPage)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 sm:px-3 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              aria-label="Upload document"
              title="Upload document"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white p-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 sm:px-4"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Upload document</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 px-4">
        <div className="mb-4 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
            From date
            <input
              type="date"
              value={filters.from_date}
              onChange={(event) => setFilters((current) => ({ ...current, from_date: event.target.value }))}
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </label>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
            To date
            <input
              type="date"
              value={filters.to_date}
              onChange={(event) => setFilters((current) => ({ ...current, to_date: event.target.value }))}
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </label>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Document type
            <select
              value={filters.document_type}
              onChange={(event) => setFilters((current) => ({ ...current, document_type: event.target.value }))}
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="">All types</option>
              {documentTypes.map((type) => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Status
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="active">Active</option>
              <option value="deleted">Deleted</option>
              <option value="all">All</option>
            </select>
          </label>
          <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Customer
            <SelectField
              options={customerOptions}
              value={selectedFilterCustomer}
              onChange={(selected) => {
                setSelectedFilterCustomer(selected);
                setFilters((current) => ({ ...current, customer_id: selected?.value || '' }));
              }}
              onMenuOpen={handleCustomerMenuOpen}
              onMenuScrollToBottom={handleCustomerMenuScrollToBottom}
              isLoading={customerLoading}
              isSearchable
              isClearable
              placeholder="All customers"
              noOptionsMessage={() => (customerLoading ? 'Loading...' : 'No customers found')}
              menuPlacement="auto"
              classNamePrefix="react-select"
            />
          </div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Uploaded by
            <select
              value={filters.uploaded_by}
              onChange={(event) => setFilters((current) => ({ ...current, uploaded_by: event.target.value }))}
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="">Anyone</option>
              <option value="CUSTOMER">Customer</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="button" onClick={handleApplyFilters} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Apply filters</button>
            <button type="button" onClick={handleResetFilters} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">Reset</button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          {selectedIds.size > 0 ? (
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-900/20 dark:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
              {bulkDeleting ? 'Deleting...' : `Delete selected (${selectedIds.size})`}
            </button>
          ) : (
            <span />
          )}
          <div className="text-sm text-gray-600 dark:text-gray-300">{totalItems} total records</div>
        </div>
      </div>

      <div className="overflow-hidden md:rounded-2xl md:border md:border-gray-200 md:bg-white md:shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading documents...</div>
        ) : !hasDocuments ? (
          <div className="p-12 text-center text-sm text-gray-500">No documents uploaded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <ManagementTable><table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/70">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Document</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Customer</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Uploaded by</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Type</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Uploaded</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Size</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => doc.is_active && doc.file_url && setPreviewDoc(doc)}
                    className={`transition-colors ${doc.is_active && doc.file_url ? 'cursor-pointer hover:bg-emerald-50/60 dark:hover:bg-emerald-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
                  >
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(doc.id)}
                        onChange={() => toggleSelectOne(doc.id)}
                        disabled={!doc.is_active}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">{doc.title || doc.file_name || 'Untitled document'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{doc.file_name || 'N/A'}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">
                      <div className="font-medium">{doc.customer_name || doc.customer_id || 'N/A'}</div>
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">
                      <div className="font-medium">{doc.uploader_name || 'N/A'}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {doc.type === 'incoming' ? 'Customer upload' : 'Admin upload'}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        {doc.document_type || 'N/A'}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-xs text-gray-500 dark:text-gray-400">{formatDate(doc.uploaded_at)}</td>
                    <td className="px-4 py-4 text-xs text-gray-500 dark:text-gray-400">{doc.file_size ? `${Math.round(doc.file_size / 1024)} KB` : 'N/A'}</td>

                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end">
                        <ActionMenu
                          menuId={doc.id}
                          actions={[
                            {
                              label: 'Preview Document',
                              icon: <Eye className="h-4 w-4 text-emerald-500" />,
                              onClick: () => doc.is_active && doc.file_url && setPreviewDoc(doc),
                              disabled: !doc.is_active || !doc.file_url,
                            },
                            {
                              label: 'Download Document',
                              icon: <Download className="h-4 w-4 text-sky-500" />,
                              onClick: () => handleDownload(doc),
                              disabled: !doc.is_active,
                            },
                            {
                              label: 'Edit Document',
                              icon: <Pencil className="h-4 w-4 text-indigo-500" />,
                              onClick: () => openEditModal(doc),
                              disabled: !doc.is_active,
                            },
                            {
                              label: 'Delete Document',
                              icon: <Trash2 className="h-4 w-4 text-red-500" />,
                              className: 'text-red-600 hover:text-red-700 dark:text-red-400',
                              onClick: () => handleDelete(doc),
                              disabled: !doc.is_active,
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></ManagementTable>
          </div>
        )}

      </div>

      {/* Pagination */}
      {totalItems > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
        />
      )}

      {/* Document file preview modal — image / video / PDF */}
      <MediaViewerModal isOpen={!!previewDoc} onClose={() => setPreviewDoc(null)}>
        <DocumentPreviewContent doc={previewDoc} />
      </MediaViewerModal>

      {/* Upload modal (POST) */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeUploadModal}
        title="Upload document"
        icon={FileText}
        size="lg"
        footer={(
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={closeUploadModal} className="rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
              Cancel
            </button>
            <button type="submit" form="document-form" disabled={saving} className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? 'Uploading...' : 'Upload document'}
            </button>
          </div>
        )}
      >
        <form id="document-form" onSubmit={handleSubmit} className="space-y-5 p-1">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Customer</label>
              <SelectField
                options={customerOptions}
                value={selectedCustomer}
                onChange={(selected) => {
                  setSelectedCustomer(selected);
                  handleFieldChange('customer_id', selected?.value || '');
                }}
                onMenuOpen={handleCustomerMenuOpen}
                onMenuScrollToBottom={handleCustomerMenuScrollToBottom}
                isLoading={customerLoading}
                isSearchable
                isClearable
                placeholder="Select customer"
                noOptionsMessage={() => (customerLoading ? 'Loading...' : 'No customers found')}
                menuPlacement="auto"
                classNamePrefix="react-select"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Document type</label>
              <SelectField
                options={documentTypeOptions}
                value={documentTypeOptions.find((option) => option.value === formState.document_type) || null}
                onChange={(selected) => handleFieldChange('document_type', selected?.value || '')}
                isSearchable={false}
                placeholder="Select document type"
                menuPlacement="auto"
                classNamePrefix="react-select"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
              <input
                value={formState.title}
                onChange={(event) => handleFieldChange('title', event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                placeholder="Enter title"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea
                value={formState.description}
                onChange={(event) => handleFieldChange('description', event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                placeholder="Optional description"
              />
            </div>

            <div className="md:col-span-2">
              <DragDropUpload
                label="Document file"
                value={formState.file}
                onChange={(url, _uploadResult, file) => {
                  handleFieldChange('file', url);
                  handleFieldChange('file_name', file?.name || '');
                }}
                accept="application/pdf,image/*"
                helperText="PDF, JPG, PNG, TIFF"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit modal (PATCH) — metadata only, file is not editable */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit document"
        icon={Pencil}
        size="lg"
        footer={(
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => setIsEditModalOpen(false)} className="rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
              Cancel
            </button>
            <button type="submit" form="document-edit-form" disabled={editSaving} className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
              {editSaving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        )}
      >
        <form id="document-edit-form" onSubmit={handleEditSubmit} className="space-y-5 p-1">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Document type</label>
              <SelectField
                options={documentTypeOptions}
                value={documentTypeOptions.find((option) => option.value === editForm.document_type) || null}
                onChange={(selected) => handleEditFieldChange('document_type', selected?.value || '')}
                isSearchable={false}
                placeholder="Select document type"
                menuPlacement="auto"
                classNamePrefix="react-select"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
              <input
                value={editForm.title}
                onChange={(event) => handleEditFieldChange('title', event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                placeholder="Enter title"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea
                value={editForm.description}
                onChange={(event) => handleEditFieldChange('description', event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                placeholder="Optional description"
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DocumentManagement;