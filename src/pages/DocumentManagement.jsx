import React, { useEffect, useRef, useState } from 'react';
import ManagementTable from '../component/common/ManagementTable';
import toast from 'react-hot-toast';
import { FileText, Plus, Trash2, RefreshCw, Eye, Pencil, Download, Filter } from 'lucide-react';
import Modal from '../component/common/Modal';
import ConfirmDeleteModal from '../component/common/ConfirmDeleteModal';
import MediaViewerModal from '../component/common/MediaViewerModal';
import DragDropUpload from '../component/common/DragDropUpload';
import SelectField from '../component/common/SelectField';
import Pagination from '../component/common/PaginationComponent';
import ActionMenu from '../component/common/ActionMenu';
import { apiCall, handleApiError } from '../utils/apiCall';
import usePrivateDocumentFile, { downloadPrivateDocument } from '../hooks/usePrivateDocumentFile';

const documentTypes = {
  identity: ['ID_PROOF', 'ADDRESS_PROOF'],
  booking: ['TOUR_DOCUMENT', 'FLIGHT_TICKET', 'TRAIN_TICKET', 'HOTEL_VOUCHER', 'OTHER'],
};
const defaultFilters = {
  from_date: '',
  to_date: '',
  document_type: '',
  status: 'active',
  customer_id: '',
  booking_id: '',
  uploaded_by: '',
};

const defaultForm = {
  customer_id: '',
  booking_id: '',
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
const BOOKING_DOCUMENT_TYPES = documentTypes.booking;
const documentTypeFilterOptions = (scope) => [
  { value: '', label: 'All types' },
  ...documentTypes[scope].map((type) => ({ value: type, label: type.replace(/_/g, ' ') })),
];
const statusFilterOptions = [
  { value: 'active', label: 'Active' },
  { value: 'deleted', label: 'Deleted' },
  { value: 'all', label: 'All' },
];
const uploadedByFilterOptions = [
  { value: '', label: 'Anyone' },
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'ADMIN', label: 'Admin' },
];

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
  const { fileUrl, mimeType, loading, error } = usePrivateDocumentFile(doc);
  if (!doc) return null;
  const fileType = mimeType.includes('pdf') ? 'pdf' : mimeType.startsWith('video/') ? 'video' : getFileType(doc.file_url || '', doc.file_name || '');
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
  const [documentScope, setDocumentScope] = useState('identity');
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState(defaultFilters);
  const [filterDraft, setFilterDraft] = useState(defaultFilters);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

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
  const [filterCustomerOptions, setFilterCustomerOptions] = useState([]);
  const [filterSelectedCustomer, setFilterSelectedCustomer] = useState(null);
  const [filterCustomerSearch, setFilterCustomerSearch] = useState('');
  const [filterCustomerLoading, setFilterCustomerLoading] = useState(false);
  const [filterCustomerPage, setFilterCustomerPage] = useState(1);
  const [filterCustomerHasMore, setFilterCustomerHasMore] = useState(true);
  const filterCustomerRequest = useRef(0);
  const filterCustomerSearchTimeout = useRef(null);
  const [customerPage, setCustomerPage] = useState(1);
  const [customerHasMore, setCustomerHasMore] = useState(true);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerLoaded, setCustomerLoaded] = useState(false);
  const [bookingOptions, setBookingOptions] = useState([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingLoaded, setBookingLoaded] = useState(false);

  // ---- Fetch (server-side pagination) ----
  const loadDocuments = async (page = currentPage, limit = itemsPerPage, activeFilters = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(limit) });
      Object.entries(activeFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const response = await apiCall(`/api/v1/admin/documents/${documentScope}?${params.toString()}`, 'GET');
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
        await loadDocuments(serverTotalPages, limit, activeFilters);
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
  }, [documentScope]);

  const handlePageChange = (page) => {
    loadDocuments(page, itemsPerPage);
  };

  const handleLimitChange = (limit) => {
    setItemsPerPage(limit);
    loadDocuments(1, limit);
  };

  const handleApplyFilters = (nextFilters = filterDraft) => {
    if (Boolean(nextFilters.from_date) !== Boolean(nextFilters.to_date)) {
      toast.error('Select both dates to filter by upload date');
      return;
    }
    if (nextFilters.from_date && nextFilters.to_date < nextFilters.from_date) {
      toast.error('End date must be on or after start date');
      return;
    }
    setFilters(nextFilters);
    loadDocuments(1, itemsPerPage, nextFilters);
    setIsFilterModalOpen(false);
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    setFilterDraft(defaultFilters);
    setFilterSelectedCustomer(null);
    setFilterCustomerSearch('');
    loadDocuments(1, itemsPerPage, defaultFilters);
    setIsFilterModalOpen(false);
  };

  const handlePrimaryFilterChange = (key, value) => {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    setFilterDraft(nextFilters);
    loadDocuments(1, itemsPerPage, nextFilters);
  };

  const openFilterModal = () => {
    setFilterDraft(filters);
    setFilterSelectedCustomer(
      filterCustomerOptions.find((option) => option.value === filters.customer_id) || filterSelectedCustomer
    );
    setIsFilterModalOpen(true);
  };

  const loadFilterCustomers = async (page = 1, search = filterCustomerSearch, append = false) => {
    const requestId = filterCustomerRequest.current + 1;
    filterCustomerRequest.current = requestId;
    setFilterCustomerLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(CUSTOMER_PAGE_SIZE) });
      if (search) params.set('search', search);
      const response = await apiCall(`/api/v1/admin/customers?${params.toString()}`, 'GET');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.detail || 'Unable to fetch customers');
      }
      if (requestId !== filterCustomerRequest.current) return;

      const options = (Array.isArray(payload?.data) ? payload.data : []).map((customer) => ({
        value: customer.id,
        label: buildCustomerLabel(customer),
      }));
      setFilterCustomerOptions((current) => (append ? [...current, ...options] : options));
      setFilterCustomerPage(Number(payload?.pagination?.current_page) || page);
      setFilterCustomerHasMore(Boolean(payload?.pagination?.has_next));
    } catch (error) {
      if (requestId === filterCustomerRequest.current) {
        handleApiError(error, 'Unable to search customers');
      }
    } finally {
      if (requestId === filterCustomerRequest.current) setFilterCustomerLoading(false);
    }
  };

  const handleFilterCustomerSearch = (value, { action }) => {
    if (action !== 'input-change') return value;
    setFilterCustomerSearch(value);
    if (filterCustomerSearchTimeout.current) clearTimeout(filterCustomerSearchTimeout.current);
    filterCustomerSearchTimeout.current = setTimeout(() => {
      loadFilterCustomers(1, value, false);
    }, 300);
    return value;
  };

  const handleFilterCustomerMenuScroll = () => {
    if (filterCustomerHasMore && !filterCustomerLoading) {
      loadFilterCustomers(filterCustomerPage + 1, filterCustomerSearch, true);
    }
  };

  useEffect(() => () => {
    if (filterCustomerSearchTimeout.current) clearTimeout(filterCustomerSearchTimeout.current);
    filterCustomerRequest.current += 1;
  }, []);

  const loadBookings = async () => {
    if (bookingLoaded || bookingLoading) return;
    setBookingLoading(true);
    try {
      const response = await apiCall('/api/v1/admin/bookings?page=1&page_size=100', 'GET');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.detail || 'Unable to fetch bookings');
      }
      const options = (Array.isArray(payload?.data) ? payload.data : []).map((booking) => ({
        id: booking.id,
        value: booking.id,
        customer_id: booking.customer?.id,
        label: [booking.booking_code, booking.customer?.name].filter(Boolean).join(' • ') || booking.id,
      }));
      setBookingOptions(options);
      setBookingLoaded(true);
    } catch (error) {
      handleApiError(error, 'Unable to load bookings');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleScopeChange = (scope) => {
    if (scope === documentScope) return;
    setDocumentScope(scope);
    const nextFilters = { ...filters, document_type: '', booking_id: '' };
    setFilters(nextFilters);
    setFilterDraft(nextFilters);
    setFormState((current) => ({
      ...current,
      customer_id: '',
      booking_id: '',
      document_type: scope === 'booking' ? BOOKING_DOCUMENT_TYPES[0] : documentTypes.identity[0],
    }));
    setSelectedCustomer(null);
    setSelectedIds(new Set());
    if (scope === 'booking') loadBookings();
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
    if ((!formState.customer_id && !formState.booking_id) || (documentScope === 'booking' && !formState.booking_id) || !formState.title || !formState.file) {
      toast.error(`${documentScope === 'booking' ? 'Booking' : 'Customer'}, title and document file are required`);
      return;
    }

    setSaving(true);

    try {
      const response = await apiCall('/api/v1/admin/documents', 'POST', {
        customer_id: formState.customer_id || null,
        booking_id: formState.booking_id || null,
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
      setFormState({ ...defaultForm, document_type: documentTypes[documentScope][0] });
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
    setFormState({ ...defaultForm, document_type: documentTypes[documentScope][0] });
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
              onClick={() => {
                setIsModalOpen(true);
                if (documentScope === 'booking') loadBookings();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white p-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 sm:px-4"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Upload document</span>
            </button>
          </div>
        </div>
        <div className="mt-4 flex gap-2 border-b border-gray-200 dark:border-gray-700">
          {[
            { key: 'identity', label: 'Identity documents' },
            { key: 'booking', label: 'Booking documents' },
          ].map((scope) => (
            <button
              key={scope.key}
              type="button"
              onClick={() => handleScopeChange(scope.key)}
              className={`border-b-2 px-3 py-2 text-sm font-semibold transition ${
                documentScope === scope.key
                  ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {scope.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="w-full text-xs font-medium text-gray-600 dark:text-gray-300 sm:w-52">
            Status
            <SelectField
              className="mt-1"
              options={statusFilterOptions}
              value={statusFilterOptions.find((option) => option.value === filters.status) || statusFilterOptions[0]}
              onChange={(option) => handlePrimaryFilterChange('status', option?.value || '')}
              isSearchable={false}
              menuPlacement="auto"
            />
          </label>
          <label className="w-full text-xs font-medium text-gray-600 dark:text-gray-300 sm:w-60">
            Document type
            <SelectField
              className="mt-1"
              options={documentTypeFilterOptions(documentScope)}
              value={documentTypeFilterOptions(documentScope).find((option) => option.value === filters.document_type) || documentTypeFilterOptions(documentScope)[0]}
              onChange={(option) => handlePrimaryFilterChange('document_type', option?.value || '')}
              isSearchable={false}
              menuPlacement="auto"
            />
          </label>
          <button
            type="button"
            onClick={openFilterModal}
            aria-label="More filters"
            title="More filters"
            className="relative ml-auto inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <Filter className="h-4 w-4" />
            {(filters.from_date || filters.to_date || filters.customer_id || filters.booking_id || filters.uploaded_by) && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-gray-900" />
            )}
          </button>
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
                  {documentScope === 'booking' && <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Booking</th>}
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Customer</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Uploaded by</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Type</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Uploaded</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => doc.is_active && setPreviewDoc(doc)}
                    className={`transition-colors ${doc.is_active ? 'cursor-pointer hover:bg-emerald-50/60 dark:hover:bg-emerald-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
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
                          {doc.description && (
                            <div className="max-w-xs truncate text-xs text-gray-500 dark:text-gray-400">{doc.description}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {documentScope === 'booking' && (
                      <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">
                        <div className="font-medium">{doc.booking_code || 'Booking'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{doc.booking_id || 'N/A'}</div>
                      </td>
                    )}

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
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end">
                        <ActionMenu
                          menuId={doc.id}
                          actions={[
                            {
                              label: 'Preview Document',
                              icon: <Eye className="h-4 w-4 text-emerald-500" />,
                              onClick: () => doc.is_active && setPreviewDoc(doc),
                              disabled: !doc.is_active,
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

      <Modal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        title="More filters"
        icon={Filter}
        size="lg"
        footer={(
          <div className="flex w-full flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setIsFilterModalOpen(false)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-200">
              Cancel
            </button>
            <button type="button" onClick={handleResetFilters} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-200">
              Reset
            </button>
            <button type="button" onClick={() => handleApplyFilters(filterDraft)} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
              Apply filters
            </button>
          </div>
        )}
      >
        <div className="grid gap-4 p-1 sm:grid-cols-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            From date
            <input
              type="date"
              value={filterDraft.from_date}
              onChange={(event) => setFilterDraft((current) => ({ ...current, from_date: event.target.value }))}
              className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </label>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            To date
            <input
              type="date"
              value={filterDraft.to_date}
              onChange={(event) => setFilterDraft((current) => ({ ...current, to_date: event.target.value }))}
              className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </label>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Customer
            <SelectField
              className="mt-1"
              options={filterCustomerOptions}
              value={filterSelectedCustomer}
              onChange={(selected) => {
                setFilterSelectedCustomer(selected);
                setFilterCustomerSearch('');
                setFilterDraft((current) => ({ ...current, customer_id: selected?.value || '' }));
              }}
              onMenuOpen={() => {
                if (filterCustomerOptions.length === 0) loadFilterCustomers(1, '', false);
              }}
              onInputChange={handleFilterCustomerSearch}
              onMenuScrollToBottom={handleFilterCustomerMenuScroll}
              isLoading={filterCustomerLoading}
              isSearchable
              isClearable
              placeholder="All customers"
              noOptionsMessage={() => (filterCustomerLoading ? 'Searching customers...' : 'No customers found')}
              loadingMessage={() => 'Searching customers...'}
              menuPlacement="auto"
              classNamePrefix="react-select"
            />
          </div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Uploaded by
            <SelectField
              className="mt-1"
              options={uploadedByFilterOptions}
              value={uploadedByFilterOptions.find((option) => option.value === filterDraft.uploaded_by) || uploadedByFilterOptions[0]}
              onChange={(option) => setFilterDraft((current) => ({ ...current, uploaded_by: option?.value || '' }))}
              isSearchable={false}
              menuPlacement="auto"
            />
          </label>
          {documentScope === 'booking' && (
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 sm:col-span-2">
              Booking
              <SelectField
                className="mt-1"
                options={bookingOptions}
                value={bookingOptions.find((option) => option.value === filterDraft.booking_id) || null}
                onChange={(option) => setFilterDraft((current) => ({ ...current, booking_id: option?.value || '' }))}
                onMenuOpen={loadBookings}
                isLoading={bookingLoading}
                isSearchable
                isClearable
                placeholder="All bookings"
                noOptionsMessage={() => (bookingLoading ? 'Loading bookings...' : 'No bookings found')}
                menuPlacement="auto"
                classNamePrefix="react-select"
              />
            </label>
          )}
        </div>
      </Modal>

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
            {documentScope === 'identity' ? <div>
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
            </div> : (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Booking</label>
                <SelectField
                  options={bookingOptions}
                  value={bookingOptions.find((option) => option.value === formState.booking_id) || null}
                  onMenuOpen={loadBookings}
                  onChange={(selected) => {
                    const booking = bookingOptions.find((option) => option.value === selected?.value);
                    setFormState((current) => ({ ...current, booking_id: selected?.value || '', customer_id: booking?.customer_id || '' }));
                  }}
                  required
                  isLoading={bookingLoading}
                  isSearchable
                  isClearable
                  placeholder={bookingLoading ? 'Loading bookings...' : 'Select booking'}
                  noOptionsMessage={() => (bookingLoading ? 'Loading bookings...' : 'No bookings found')}
                  menuPlacement="auto"
                  classNamePrefix="react-select"
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Document type</label>
              <SelectField
                options={documentTypes[documentScope].map((type) => ({ value: type, label: type.replace(/_/g, ' ') }))}
                value={documentTypes[documentScope].map((type) => ({ value: type, label: type.replace(/_/g, ' ') })).find((option) => option.value === formState.document_type) || null}
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
                options={documentTypes[documentScope].map((type) => ({ value: type, label: type.replace(/_/g, ' ') }))}
                value={documentTypes[documentScope].map((type) => ({ value: type, label: type.replace(/_/g, ' ') })).find((option) => option.value === editForm.document_type) || null}
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