import React, { useCallback, useEffect, useState } from 'react';
import ManagementTable from '../component/common/ManagementTable';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  User,
  FileText,
  HelpCircle,
  Plane,
  Star,
  Share2,
  Receipt,
  Mail,
  Phone,
  Shield,
  UserCheck,
  Pencil,
  Trash2,
  Plus,
  RefreshCw,
  Eye,
  Download,
  Heart,
  BookOpen,
} from 'lucide-react';
import Modal from '../component/common/Modal';
import ConfirmDeleteModal from '../component/common/ConfirmDeleteModal';
import DragDropUpload from '../component/common/DragDropUpload';
import MediaPreviewModal from '../component/common/MediaPreviewModal';
import MediaViewerModal from '../component/common/MediaViewerModal';
import SelectField from '../component/common/SelectField';
import ActionMenu from '../component/common/ActionMenu';
import Pagination from '../component/common/PaginationComponent';
import { apiCall, handleApiError } from '../utils/apiCall';
import { useEnums } from '../context/EnumsContext';
import usePrivateDocumentFile, { downloadPrivateDocument } from '../hooks/usePrivateDocumentFile';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'details', label: 'Details', icon: User },
  { key: 'documents', label: 'Documents', icon: FileText, tabParam: 'documents' },
  { key: 'enquiries', label: 'Enquiries', icon: HelpCircle, tabParam: 'enquiry' },
  { key: 'tours', label: 'Trips & Tours', icon: Plane, tabParam: 'tours' },
  { key: 'reviews', label: 'Reviews', icon: Star, tabParam: 'review' },
  { key: 'referrals', label: 'Refers', icon: Share2, tabParam: 'referral' },
  { key: 'wishlist', label: 'Wishlist', icon: Heart, tabParam: 'wishlist' },
  { key: 'invoices', label: 'Invoices', icon: Receipt, tabParam: 'invoice' },
  { key: 'ledger', label: 'Ledger', icon: BookOpen, tabParam: 'ledger' },
];

const sourceColors = {
  WEBSITE: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  WHATSAPP: 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300',
  PHONE: 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  EMAIL: 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  OFFLINE: 'border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
  IMPORT: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  REFERRAL: 'border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  OTHER: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const handleDocumentDownload = async (doc) => {
  try {
    await downloadPrivateDocument(doc);
  } catch (error) {
    handleApiError(error, 'Unable to download document');
  }
};

const statusColors = {
  NEW: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  CONVERTED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (value) => {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
};

const formatShortDate = (value) => {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
};

const formatFileSize = (bytes) => {
  if (!bytes || Number.isNaN(bytes)) return 'N/A';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || '')
    .join('');

const formatTabValue = (value) => {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map((item) => (typeof item === 'object' ? JSON.stringify(item) : item)).join(', ') || '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const formatCurrencyAmount = (value, currency = 'INR') => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return formatTabValue(value);
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }
};

const parseCostBreakdown = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const getInvoiceStatusClass = (status = '') => {
  const normalized = status.toUpperCase();
  if (['PAID', 'COMPLETED'].includes(normalized)) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  if (normalized.includes('CANCEL')) return 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
  if (normalized.includes('PARTIAL') || normalized.includes('PENDING') || normalized.includes('DUE')) return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
};

const getFileType = (url = '', fileName = '') => {
  const lower = (url + fileName).toLowerCase();
  if (lower.includes('.pdf')) return 'pdf';
  if (lower.match(/\.(mp4|mov|webm|ogg)/) || lower.includes('video/upload') || lower.includes('video')) return 'video';
  if (lower.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|avif)/)) return 'image';
  return 'image';
};

const CustomerDocumentPreviewContent = ({ doc }) => {
  const fileType = getFileType(doc.file_url || '', doc.file_name || '');
  const { fileUrl, loading, error } = usePrivateDocumentFile(doc);

  return (
    <div style={{ background: '#000' }} className="flex min-h-full w-full flex-col">
      <div
        style={{ background: 'rgba(0,0,0,0.7)' }}
        className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-3"
      >
        <div className="min-w-0 pr-4">
          <p className="truncate text-sm font-semibold text-white">{doc.title || doc.file_name || 'Document preview'}</p>
          {doc.description && <p className="truncate text-xs text-slate-400">{doc.description}</p>}
        </div>
        <span className="shrink-0 text-xs text-slate-400">
          {doc.document_type} · {formatFileSize(doc.file_size)}
        </span>
      </div>
      <div className="flex flex-1 items-center justify-center p-3">
        {loading ? (
          <p className="text-sm text-slate-300">Loading document...</p>
        ) : error ? (
          <p className="text-sm text-red-300">{error}</p>
        ) : !fileUrl ? null : fileType === 'pdf' ? (
          <iframe src={fileUrl} title={doc.title || 'PDF preview'} style={{ border: 'none', background: '#fff' }} className="h-[80vh] w-full max-w-5xl rounded-xl" />
        ) : fileType === 'video' ? (
          <video src={fileUrl} controls autoPlay className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-xl" />
        ) : (
          <img src={fileUrl} alt={doc.title || doc.file_name || 'Document'} className="max-h-[80vh] w-auto max-w-full rounded-xl object-contain shadow-xl" />
        )}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const CustomerDetails = () => {
  const { getEnumOptions } = useEnums();
  const sourceOptions = getEnumOptions('LeadSource');
  const { customerId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [customer, setCustomer] = useState(location.state?.customer || null);
  const [activeTab, setActiveTab] = useState('details');
  const [loading, setLoading] = useState(!customer);
  const [tabLoading, setTabLoading] = useState(false);
  const [tabPage, setTabPage] = useState(1);
  const [tabPageSize, setTabPageSize] = useState(10);
  const [tabError, setTabError] = useState('');
  const [tabData, setTabData] = useState({});
  const [tabPagination, setTabPagination] = useState({});

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    mobile: '',
    email: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_mobile: '',
    profile_pic: '',
    source: 'WEBSITE',
    is_active: true,
  });

  // Row Details Modals
  const [previewDoc, setPreviewDoc] = useState(null);
  const [isDocumentUploadOpen, setIsDocumentUploadOpen] = useState(false);
  const [documentUploadSaving, setDocumentUploadSaving] = useState(false);
  const [documentUploadForm, setDocumentUploadForm] = useState({
    file: '',
    file_name: '',
    document_type: 'ID_PROOF',
    title: '',
    description: '',
  });
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedReview, setSelectedReview] = useState(null);
  const [selectedReferral, setSelectedReferral] = useState(null);

  // ── Load Customer Profile ────────────────────────────────────────────────────

  const loadCustomer = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const response = await apiCall(`/api/v1/admin/customers/${customerId}`, 'GET');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.detail || 'Unable to load customer details');
      }
      const custData = payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
        ? (payload.data.customer || payload.data)
        : payload?.data || null;
      setCustomer(custData);
    } catch (error) {
      handleApiError(error, 'Unable to fetch customer profile');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  // ── Load Tab Data (extracts data.items cleanly) ──────────────────────────────

  const loadTabData = useCallback(async (tabKey, page = tabPage, pageSize = tabPageSize) => {
    const tabConfig = TABS.find((t) => t.key === tabKey);
    if (!tabConfig || !tabConfig.tabParam || !customerId) return;

    setTabLoading(true);
    setTabError('');
    try {
      const isDocumentsTab = tabKey === 'documents';
      const params = new URLSearchParams(
        isDocumentsTab
          ? { page: String(page), page_size: String(pageSize), status: 'active', customer_id: customerId }
          : { tab: tabConfig.tabParam, page: String(page), page_size: String(pageSize) }
      );
      const endpoint = isDocumentsTab
        ? `/api/v1/admin/documents?${params}`
        : `/api/v1/admin/customers/${customerId}?${params}`;
      const response = await apiCall(endpoint, 'GET');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || payload?.detail || `Unable to load ${tabConfig.label.toLowerCase()}`);
      }

      const result = payload?.data;
      const rawItems = Array.isArray(result)
        ? result
        : Array.isArray(result?.items)
          ? result.items
          : Array.isArray(result?.[tabConfig.tabParam])
            ? result[tabConfig.tabParam]
            : Array.isArray(result?.data)
              ? result.data
              : [];
      const pagination = result?.pagination || result?.meta || payload?.pagination || payload?.meta || {};
      const totalItems = Number(pagination.total_items ?? pagination.total ?? pagination.count ?? result?.total_items ?? result?.total ?? rawItems.length);
      const responsePageSize = Number(pagination.page_size ?? pagination.limit ?? result?.page_size ?? pageSize) || pageSize;
      const totalPages = Number(pagination.total_pages ?? result?.total_pages) || Math.ceil(totalItems / responsePageSize) || 1;

      setTabData((previous) => ({ ...previous, [tabKey]: rawItems }));
      setTabPagination((previous) => ({
        ...previous,
        [tabKey]: {
          page: Number(pagination.current_page ?? pagination.page ?? result?.page ?? page) || page,
          page_size: responsePageSize,
          total_items: totalItems,
          total_pages: totalPages,
        },
      }));
    } catch (error) {
      setTabError(error.message || `Unable to load ${tabConfig.label.toLowerCase()}`);
    } finally {
      setTabLoading(false);
    }
  }, [customerId, tabPage, tabPageSize]);

  const handleDocumentUpload = async (event) => {
    event.preventDefault();
    if (!documentUploadForm.file || !documentUploadForm.title.trim()) {
      toast.error('Title and document file are required');
      return;
    }

    setDocumentUploadSaving(true);
    try {
      const response = await apiCall('/api/v1/admin/documents', 'POST', {
        customer_id: customerId,
        file: documentUploadForm.file,
        file_name: documentUploadForm.file_name || 'document',
        document_type: documentUploadForm.document_type,
        title: documentUploadForm.title,
        description: documentUploadForm.description || '',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.detail || 'Unable to upload document');
      }

      toast.success('Document uploaded successfully');
      setIsDocumentUploadOpen(false);
      setDocumentUploadForm({ file: '', file_name: '', document_type: 'ID_PROOF', title: '', description: '' });
      await loadTabData('documents');
    } catch (error) {
      handleApiError(error, 'Unable to upload document');
    } finally {
      setDocumentUploadSaving(false);
    }
  };

  const closeDocumentUpload = () => {
    setIsDocumentUploadOpen(false);
    setDocumentUploadForm({ file: '', file_name: '', document_type: 'ID_PROOF', title: '', description: '' });
  };

  useEffect(() => {
    if (activeTab !== 'details') {
      loadTabData(activeTab, tabPage, tabPageSize);
    }
  }, [activeTab, tabPage, tabPageSize, loadTabData]);

  // ── Edit Handlers ────────────────────────────────────────────────────────────

  const openEditModal = () => {
    if (!customer) return;
    setEditForm({
      name: customer.name || '',
      mobile: customer.mobile || '',
      email: customer.email || '',
      address: customer.address || '',
      emergency_contact_name: customer.emergency_contact_name || '',
      emergency_contact_mobile: customer.emergency_contact_mobile || '',
      profile_pic: customer.profile_pic || '',
      source: customer.source || 'WEBSITE',
      is_active: customer.is_active !== false,
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      toast.error('Customer name is required');
      return;
    }
    setSaving(true);
    const body = {
      name: editForm.name.trim(),
      mobile: editForm.mobile?.trim() || '',
      email: editForm.email?.trim() || '',
      address: editForm.address?.trim() || '',
      emergency_contact_name: editForm.emergency_contact_name?.trim() || '',
      emergency_contact_mobile: editForm.emergency_contact_mobile?.trim() || '',
      profile_pic: editForm.profile_pic || '',
      source: editForm.source || 'WEBSITE',
      is_active: Boolean(editForm.is_active),
    };

    try {
      const response = await apiCall(`/api/v1/admin/customers/${customerId}`, 'PATCH', body);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.detail || 'Unable to update customer');
      }
      toast.success(payload?.message || 'Customer updated successfully');
      setIsEditOpen(false);
      loadCustomer();
    } catch (error) {
      handleApiError(error, 'Unable to update customer');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    setDeleteTarget(customer);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteCustomer = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await apiCall(`/api/v1/admin/customers/${customerId}`, 'DELETE');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.detail || 'Unable to delete customer');
      }
      toast.success(payload?.message || 'Customer deleted successfully');
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      navigate('/customers');
    } catch (error) {
      handleApiError(error, 'Unable to delete customer');
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 pb-12">
      {/* ── Page Header ── */}
      <div className="px-2 text-slate-900 dark:text-slate-100">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => navigate('/customers')}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to customers</span>
            </button>

            <div>
              <h1 className="mt-1 bg-gradient-to-r from-slate-900 via-violet-700 to-indigo-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent dark:from-slate-100 dark:via-violet-300 dark:to-indigo-300 md:text-3xl">
                {customer?.name || 'Customer Details'}
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Code: <span className="font-semibold text-slate-700 dark:text-slate-300">{customer?.customer_code || customer?.id || '—'}</span>
                {' · '}Joined {formatShortDate(customer?.created_at)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={[
                'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                customer?.is_active === false
                  ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
              ].join(' ')}
            >
              {customer?.is_active === false ? 'Inactive' : 'Active Account'}
            </span>

            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                sourceColors[customer?.source] || sourceColors.OTHER
              }`}
            >
              {customer?.source || 'N/A'}
            </span>

            <button
              type="button"
              onClick={openEditModal}
              aria-label="Edit profile"
              title="Edit profile"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 shadow-sm"
            >
              <Pencil className="h-4 w-4 text-indigo-500" />
              <span className="hidden sm:inline">Edit Profile</span>
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Delete customer"
              title="Delete customer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-60 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300 shadow-sm"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">{deleting ? 'Deleting...' : 'Delete'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs Bar ── */}
      <div className="space-y-4">
        <div className="mt-2 px-2">
          <div
            role="tablist"
            className="flex items-center gap-1 overflow-x-auto pb-1"
          >
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeTab === key}
                onClick={() => {
                  setActiveTab(key);
                  setTabPage(1);
                }}
                aria-label={label}
                title={label}
                className={[
                  'flex shrink-0 items-center gap-2 rounded-xl px-2.5 py-2.5 text-left text-sm font-medium transition sm:px-3.5',
                  activeTab === key
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-semibold'
                    : 'border-transparent text-gray-600 hover:bg-gray-100/70 dark:text-gray-300 dark:hover:bg-gray-800',
                ].join(' ')}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Main Tab Content Panel ── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {TABS.find((t) => t.key === activeTab)?.label}
            </h2>
            <button
              type="button"
              onClick={activeTab === 'details' ? loadCustomer : () => loadTabData(activeTab)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading || tabLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {tabError && activeTab !== 'details' && (
            <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              {tabError}
            </p>
          )}

          {loading && activeTab === 'details' ? (
            <div className="p-12 text-center text-sm text-gray-400">Loading customer details...</div>
          ) : null}

          {/* ── TAB 1: DETAILS ── */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Profile summary header row */}
              <div className="flex flex-col gap-4 pb-6 border-b border-gray-100 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  {customer?.profile_pic ? (
                    <MediaPreviewModal
                      src={customer.profile_pic}
                      alt={customer.name}
                      type="image"
                      thumbnailClassName="h-16 w-16 rounded-2xl object-cover ring-2 ring-indigo-200 dark:ring-indigo-800 shadow-sm"
                      className="block shrink-0"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xl font-bold text-white shadow-sm">
                      {getInitials(customer?.name) || 'C'}
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{customer?.name || 'Customer'}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{customer?.email || 'No email on file'} · {customer?.mobile || 'No mobile on file'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {customer?.email && (
                    <a
                      href={`mailto:${customer.email}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    >
                      <Mail className="h-3.5 w-3.5 text-indigo-500" />
                      Email
                    </a>
                  )}
                  {customer?.mobile && (
                    <a
                      href={`tel:${customer.mobile}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    >
                      <Phone className="h-3.5 w-3.5 text-emerald-500" />
                      Call
                    </a>
                  )}
                </div>
              </div>

              {/* Clean flat definition sections */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                    Personal & Contact Information
                  </h4>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Full Name</dt>
                      <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{customer?.name || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Email Address</dt>
                      <dd className="mt-1 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                        {customer?.email ? (
                          <a href={`mailto:${customer.email}`} className="hover:underline">{customer.email}</a>
                        ) : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Mobile Number</dt>
                      <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                        {customer?.mobile ? (
                          <a href={`tel:${customer.mobile}`} className="hover:underline">{customer.mobile}</a>
                        ) : '—'}
                      </dd>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Residential Address</dt>
                      <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{customer?.address || '—'}</dd>
                    </div>
                  </dl>
                </div>

                <hr className="border-gray-100 dark:border-gray-800" />

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                    Emergency Contact
                  </h4>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Contact Name</dt>
                      <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{customer?.emergency_contact_name || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Contact Phone</dt>
                      <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                        {customer?.emergency_contact_mobile ? (
                          <a href={`tel:${customer.emergency_contact_mobile}`} className="hover:underline">{customer.emergency_contact_mobile}</a>
                        ) : '—'}
                      </dd>
                    </div>
                  </dl>
                </div>

                <hr className="border-gray-100 dark:border-gray-800" />

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                    Account & System Metadata
                  </h4>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Customer Code</dt>
                      <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{customer?.customer_code || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Registration Source</dt>
                      <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{customer?.source || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Account Status</dt>
                      <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{customer?.is_active ? 'Active' : 'Inactive'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Imported Record</dt>
                      <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{customer?.is_imported ? 'Yes' : 'No'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Joined Date</dt>
                      <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{formatDate(customer?.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Last Modified</dt>
                      <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{formatDate(customer?.updated_at)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: DOCUMENTS TABLE ── */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">
                  {tabData.documents?.length || 0} Documents Uploaded
                </p>
                <button
                  type="button"
                  onClick={() => setIsDocumentUploadOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-indigo-400 shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" /> Upload document
                </button>
              </div>

              {tabLoading ? (
                <div className="p-12 text-center text-sm text-gray-400">
                  <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-indigo-600" />
                  Loading documents...
                </div>
              ) : !tabData.documents || tabData.documents.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400 dark:border-gray-700">
                  No documents uploaded for this customer yet.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                  <ManagementTable><table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-800">
                    <thead className="bg-gray-50 dark:bg-gray-800/70">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Document</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Type</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Uploaded By</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Uploaded Date</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Size</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {tabData.documents.map((doc) => (
                        <tr
                          key={doc.id || doc.file_url}
                          onClick={() => setPreviewDoc(doc)}
                          className="cursor-pointer transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10"
                        >
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                                <FileText className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 dark:text-white truncate">
                                  {doc.title || doc.file_name || 'Untitled document'}
                                </p>
                                <p className="text-xs text-gray-400 truncate">{doc.file_name || 'N/A'}</p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                              {doc.document_type || 'ID_PROOF'}
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="text-xs">
                              <p className="font-medium text-gray-800 dark:text-gray-200">{doc.uploader_name || doc.customer_name || 'Customer'}</p>
                              <p className="text-gray-400">{doc.type === 'incoming' ? 'Customer' : 'Admin'}</p>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(doc.uploaded_at || doc.created_at)}
                          </td>

                          <td className="px-4 py-3.5 text-xs text-gray-500 dark:text-gray-400">
                            {formatFileSize(doc.file_size)}
                          </td>

                          <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end">
                              <ActionMenu
                                menuId={`doc-${doc.id || doc.file_url}`}
                                actions={[
                                  {
                                    label: 'Preview Document',
                                    icon: <Eye className="h-4 w-4 text-indigo-500" />,
                                    onClick: () => setPreviewDoc(doc),
                                  },
                                  {
                                    label: 'Download Document',
                                    icon: <Download className="h-4 w-4 text-sky-500" />,
                                    onClick: () => handleDocumentDownload(doc),
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
          )}

          {/* ── TAB 3: ENQUIRIES TABLE ── */}
          {activeTab === 'enquiries' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">
                  {tabData.enquiries?.length || 0} Enquiries Recorded
                </p>
              </div>

              {tabLoading ? (
                <div className="p-12 text-center text-sm text-gray-400">
                  <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-indigo-600" />
                  Loading enquiries...
                </div>
              ) : !tabData.enquiries || tabData.enquiries.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400 dark:border-gray-700">
                  No enquiry records found for this customer.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                  <ManagementTable><table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-800">
                    <thead className="bg-gray-50 dark:bg-gray-800/70">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Enquiry Code</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Subject / Type</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Channel</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Status</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Travel Date</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Created</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {tabData.enquiries.map((enq) => (
                        <tr
                          key={enq.id || enq.enquiry_code}
                          onClick={() => setSelectedEnquiry(enq)}
                          className="cursor-pointer transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10"
                        >
                          <td className="px-4 py-3.5 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                            {enq.enquiry_code || enq.id?.slice(0, 8) || '—'}
                          </td>

                          <td className="px-4 py-3.5">
                            <p className="font-semibold text-gray-900 dark:text-white truncate max-w-xs">
                              {enq.subject || enq.destination || 'General Enquiry'}
                            </p>
                            <p className="text-xs text-gray-400 capitalize">{enq.enquiry_type?.replace(/_/g, ' ') || 'Fixed Tour'}</p>
                          </td>

                          <td className="px-4 py-3.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                            {enq.channel || 'WEBSITE'}
                          </td>

                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                statusColors[enq.status] || statusColors.NEW
                              }`}
                            >
                              {enq.status || 'NEW'}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-xs text-gray-500 dark:text-gray-400">
                            {enq.travel_date ? formatShortDate(enq.travel_date) : 'Flexible'}
                          </td>

                          <td className="px-4 py-3.5 text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(enq.created_at)}
                          </td>

                          <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end">
                              <ActionMenu
                                menuId={`enq-${enq.id || enq.enquiry_code}`}
                                actions={[
                                  {
                                    label: 'View Details',
                                    icon: <Eye className="h-4 w-4 text-indigo-500" />,
                                    onClick: () => setSelectedEnquiry(enq),
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
          )}

          {/* ── TAB 4: TRIPS & TOURS TABLE ── */}
          {activeTab === 'tours' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">
                  {tabData.tours?.length || 0} Trips & Tours
                </p>
              </div>

              {tabLoading ? (
                <div className="p-12 text-center text-sm text-gray-400">
                  <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-indigo-600" />
                  Loading trips...
                </div>
              ) : !tabData.tours || tabData.tours.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400 dark:border-gray-700">
                  No booked trips or tour packages found for this customer.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                  <ManagementTable><table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-800">
                    <thead className="bg-gray-50 dark:bg-gray-800/70">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Tour Package</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Variant</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Departure Date</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Travelers</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Amount</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Status</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {tabData.tours.map((trip, idx) => (
                        <tr
                          key={trip.id || idx}
                          onClick={() => setSelectedTrip(trip)}
                          className="cursor-pointer transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10"
                        >
                          <td className="px-4 py-3.5 font-semibold text-gray-900 dark:text-white">
                            {trip.title || trip.package_name || 'Tour Package'}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-gray-600 dark:text-gray-300">
                            {trip.variant_name || 'Standard Package'}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-gray-500 dark:text-gray-400">
                            {formatShortDate(trip.departure_date)}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-gray-600 dark:text-gray-300">
                            {trip.travelers_count || trip.pax_no || 1} Pax
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-gray-900 dark:text-white">
                            {trip.amount ? `₹${trip.amount}` : '—'}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                statusColors[trip.status] || statusColors.CONFIRMED
                              }`}
                            >
                              {trip.status || 'CONFIRMED'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end">
                              <ActionMenu
                                menuId={`trip-${trip.id || idx}`}
                                actions={[
                                  {
                                    label: 'View Trip Details',
                                    icon: <Eye className="h-4 w-4 text-indigo-500" />,
                                    onClick: () => setSelectedTrip(trip),
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
          )}

          {/* ── TAB 5: REVIEWS TABLE ── */}
          {activeTab === 'reviews' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">
                  {tabData.reviews?.length || 0} Customer Reviews
                </p>
              </div>

              {tabLoading ? (
                <div className="p-12 text-center text-sm text-gray-400">
                  <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-indigo-600" />
                  Loading reviews...
                </div>
              ) : !tabData.reviews || tabData.reviews.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400 dark:border-gray-700">
                  No reviews submitted by this customer.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                  <ManagementTable><table className="w-full table-fixed divide-y divide-gray-200 text-left text-sm dark:divide-gray-800">
                    <thead className="bg-gray-50 dark:bg-gray-800/70">
                      <tr>
                        <th className="w-[18%] break-words px-1 py-3 font-semibold text-gray-700 dark:text-gray-200 sm:px-2 lg:px-4">Reviewer</th>
                        <th className="w-[12%] break-words px-1 py-3 font-semibold text-gray-700 dark:text-gray-200 sm:px-2 lg:px-4">Rating</th>
                        <th className="w-[15%] break-words px-1 py-3 font-semibold text-gray-700 dark:text-gray-200 sm:px-2 lg:px-4">Package ID</th>
                        <th className="w-[13%] break-words px-1 py-3 font-semibold text-gray-700 dark:text-gray-200 sm:px-2 lg:px-4">Review</th>
                        <th className="w-[12%] break-words px-1 py-3 font-semibold text-gray-700 dark:text-gray-200 sm:px-2 lg:px-4">Gallery</th>
                        <th className="w-[12%] break-words px-1 py-3 font-semibold text-gray-700 dark:text-gray-200 sm:px-2 lg:px-4">Status</th>
                        <th className="w-[8%] break-words px-1 py-3 font-semibold text-gray-700 dark:text-gray-200 sm:px-2 lg:px-4">Date</th>
                        <th className="w-[10%] break-words px-1 py-3 text-right font-semibold text-gray-700 dark:text-gray-200 sm:px-2 lg:px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {tabData.reviews.map((rev, idx) => (
                        <tr
                          key={rev.id || idx}
                          onClick={() => setSelectedReview(rev)}
                          className="cursor-pointer transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10"
                        >
                          <td className="min-w-0 px-1 py-3.5 sm:px-2 lg:px-4">
                            <div className="flex items-center gap-2.5">
                              {rev.customer_profile_picture ? (
                                <img src={rev.customer_profile_picture} alt={rev.name || 'Reviewer'} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                              ) : (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                  {(rev.name || 'C').charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="max-w-40 truncate font-semibold text-gray-900 dark:text-white">{rev.name || 'Anonymous'}</p>
                                <p className="max-w-40 truncate font-mono text-[10px] text-gray-400" title={rev.customer_id}>{rev.customer_id || '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-1 py-3.5 sm:px-2 lg:px-4">
                            <div className="flex flex-wrap items-center gap-0.5 text-amber-500" title={`${rev.rating || 0} out of 5`}>
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3.5 w-3.5 ${i < (rev.rating || 5) ? 'fill-current' : 'opacity-30'}`}
                                />
                              ))}
                            </div>
                          </td>
                          <td className="break-all px-1 py-3.5 font-mono text-xs text-gray-600 dark:text-gray-300 sm:px-2 lg:px-4" title={rev.package_id}>
                            {rev.package_id || '—'}
                          </td>
                          <td className="px-1 py-3.5 text-xs text-gray-600 dark:text-gray-300 sm:px-2 lg:px-4">
                            <p className="line-clamp-2 break-words">{rev.review || 'No written text'}</p>
                          </td>
                          <td className="min-w-0 px-1 py-3.5 text-xs text-gray-600 dark:text-gray-300 sm:px-2 lg:px-4">
                            {Array.isArray(rev.review_gallery) && rev.review_gallery.length > 0 ? (
                              <div className="flex min-w-0 flex-wrap items-center gap-1">
                                {rev.review_gallery.slice(0, 1).map((media, mediaIndex) => {
                                  const url = typeof media === 'string' ? media : media?.url;
                                  const isVideo = media?.type === 'video' || /\.(mp4|mov|webm|ogg)(\?|$)/i.test(url || '');
                                  return url ? (
                                    isVideo ? (
                                      <video key={media.id || url} src={url} className="h-9 w-12 rounded object-cover" />
                                    ) : (
                                      <img key={media.id || url} src={url} alt={media?.alt || `Review media ${mediaIndex + 1}`} className="h-9 w-12 rounded object-cover" />
                                    )
                                  ) : null;
                                })}
                                <span>{rev.review_gallery.length} {rev.review_gallery.length === 1 ? 'file' : 'files'}</span>
                              </div>
                            ) : 'None'}
                          </td>
                          <td className="px-1 py-3.5 sm:px-2 lg:px-4">
                            <div className="flex flex-col items-start gap-1">
                              <span title={rev.is_verified ? 'Verified' : 'Unverified'} className={`max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-semibold ${rev.is_verified ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                                {rev.is_verified ? 'Verified' : 'Unverified'}
                              </span>
                              <span title={rev.is_published ? 'Published' : 'Unpublished'} className={`max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-semibold ${rev.is_published ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                                {rev.is_published ? 'Published' : 'Unpublished'}
                              </span>
                            </div>
                          </td>
                          <td className="break-words px-1 py-3.5 text-xs text-gray-500 dark:text-gray-400 sm:px-2 lg:px-4">
                            {formatShortDate(rev.created_at)}
                          </td>
                          <td className="px-1 py-3.5 text-right sm:px-2 lg:px-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end">
                              <ActionMenu
                                menuId={`rev-${rev.id || idx}`}
                                actions={[
                                  {
                                    label: 'View Review',
                                    icon: <Eye className="h-4 w-4 text-indigo-500" />,
                                    onClick: () => setSelectedReview(rev),
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
          )}

          {/* ── TAB 6: REFERRALS TABLE ── */}
          {activeTab === 'referrals' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">
                  {tabData.referrals?.length || 0} Referrals
                </p>
              </div>

              {tabLoading ? (
                <div className="p-12 text-center text-sm text-gray-400">
                  <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-indigo-600" />
                  Loading referrals...
                </div>
              ) : !tabData.referrals || tabData.referrals.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400 dark:border-gray-700">
                  No referrals recorded for this customer.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                  <ManagementTable><table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-800">
                    <thead className="bg-gray-50 dark:bg-gray-800/70">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Referred Contact</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Status</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Reward Points</th>
                        <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Date</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {tabData.referrals.map((ref, idx) => (
                        <tr
                          key={ref.id || idx}
                          onClick={() => setSelectedReferral(ref)}
                          className="cursor-pointer transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10"
                        >
                          <td className="px-4 py-3.5 font-medium text-gray-900 dark:text-white">
                            {ref.referred_name || ref.contact || 'Referee'}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                              {ref.status || 'CONVERTED'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                            {ref.reward_points || 0} pts
                          </td>
                          <td className="px-4 py-3.5 text-xs text-gray-500 dark:text-gray-400">
                            {formatShortDate(ref.created_at)}
                          </td>
                          <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end">
                              <ActionMenu
                                menuId={`ref-${ref.id || idx}`}
                                actions={[
                                  {
                                    label: 'View Referral Details',
                                    icon: <Eye className="h-4 w-4 text-indigo-500" />,
                                    onClick: () => setSelectedReferral(ref),
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
          )}

          {['wishlist', 'invoices', 'ledger'].includes(activeTab) && (
            <div className="space-y-4">
              {tabLoading ? (
                <div className="p-12 text-center text-sm text-gray-400">
                  <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-indigo-600" />
                  Loading {TABS.find((tab) => tab.key === activeTab)?.label.toLowerCase()}...
                </div>
              ) : !tabData[activeTab]?.length ? (
                <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400 dark:border-gray-700">
                  No {TABS.find((tab) => tab.key === activeTab)?.label.toLowerCase()} records found for this customer.
                </p>
              ) : activeTab === 'invoices' ? (
                <div className="space-y-3">
                  {tabData.invoices.map((invoice, index) => {
                    const breakdown = parseCostBreakdown(invoice.cost_breakdown);
                    const currency = invoice.currency || breakdown.currency || 'INR';
                    const status = invoice.status || 'Invoice';
                    const amountRows = [
                      { label: 'Subtotal', value: breakdown.subtotal },
                      { label: 'Discount', value: breakdown.discount_amount },
                      { label: 'Tax', value: breakdown.tax_amount },
                      { label: 'Total', value: breakdown.total_amount, strong: true },
                      { label: 'Paid', value: breakdown.paid_amount },
                      { label: 'Balance due', value: breakdown.due_amount, due: Number(breakdown.due_amount) > 0 },
                    ].filter((item) => item.value !== undefined && item.value !== null && item.value !== '');
                    const lineItems = Array.isArray(breakdown.items) ? breakdown.items : [];

                    return (
                      <article key={invoice.id || invoice.booking_id || invoice.invoice_id || index} className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                        <div className="flex flex-col justify-between gap-3 border-b border-gray-100 bg-gray-50/70 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/40 sm:flex-row sm:items-center">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">{invoice.booking_code || invoice.invoice_number || 'Booking invoice'}</p>
                            <h3 className="mt-1 truncate text-sm font-bold text-gray-900 dark:text-white">{invoice.tour_name || invoice.package_name || 'Travel booking'}</h3>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                              {invoice.booking_id && <span title={invoice.booking_id}>Booking ID: {invoice.booking_id.slice(0, 8)}…</span>}
                              {invoice.passenger_count != null && <span>{invoice.passenger_count} passengers</span>}
                            </div>
                          </div>
                          <span className={`inline-flex w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${getInvoiceStatusClass(status)}`}>{status.replace(/_/g, ' ')}</span>
                        </div>

                        <div className="space-y-4 p-4">
                          {lineItems.length > 0 && (
                            <div className="divide-y divide-gray-100 rounded-lg border border-gray-100 px-3 dark:divide-gray-800 dark:border-gray-800">
                              {lineItems.map((item, itemIndex) => (
                                <div key={item.id || itemIndex} className="flex items-center justify-between gap-3 py-2 text-sm">
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-gray-800 dark:text-gray-200">{item.name || item.description || item.title || `Charge ${itemIndex + 1}`}</p>
                                    {item.quantity != null && <p className="text-xs text-gray-500">Qty {item.quantity}</p>}
                                  </div>
                                  {(item.amount != null || item.total_price != null || item.price != null) && <span className="shrink-0 font-semibold text-gray-900 dark:text-white">{formatCurrencyAmount(item.amount ?? item.total_price ?? item.price, currency)}</span>}
                                </div>
                              ))}
                            </div>
                          )}

                          {amountRows.length > 0 ? (
                            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                              {amountRows.map((item) => (
                                <div key={item.label} className={`min-w-0 rounded-lg px-3 py-2 ${item.strong ? 'bg-indigo-50 dark:bg-indigo-900/20' : item.due ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-gray-50 dark:bg-gray-800/60'}`}>
                                  <dt className="truncate text-xs text-gray-500 dark:text-gray-400">{item.label}</dt>
                                  <dd className={`mt-1 break-words text-sm font-semibold ${item.due ? 'text-amber-700 dark:text-amber-300' : 'text-gray-900 dark:text-white'}`}>{formatCurrencyAmount(item.value, currency)}</dd>
                                </div>
                              ))}
                            </dl>
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">No price breakdown available.</p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {tabData[activeTab].map((record, index) => {
                    const fields = Object.entries(record || {});
                    return (
                      <dl key={record?.id || record?.invoice_id || record?.entry_id || index} className="grid grid-cols-1 gap-x-6 gap-y-3 py-4 first:pt-0 sm:grid-cols-2 lg:grid-cols-3">
                        {fields.length ? fields.map(([key, value]) => (
                          <div key={key} className="min-w-0">
                            <dt className="text-xs capitalize text-gray-500 dark:text-gray-400">{key.replace(/_/g, ' ')}</dt>
                            <dd className="mt-1 break-words text-sm font-medium text-gray-900 dark:text-white">{formatTabValue(value)}</dd>
                          </div>
                        )) : (
                          <div className="sm:col-span-2 lg:col-span-3">
                            <dt className="text-xs text-gray-500 dark:text-gray-400">Record</dt>
                            <dd className="mt-1 break-all font-mono text-xs text-gray-700 dark:text-gray-300">{JSON.stringify(record)}</dd>
                          </div>
                        )}
                      </dl>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab !== 'details' && TABS.find((tab) => tab.key === activeTab)?.tabParam && (
            <Pagination
              currentPage={tabPagination[activeTab]?.page || tabPage}
              totalItems={tabPagination[activeTab]?.total_items ?? tabData[activeTab]?.length ?? 0}
              itemsPerPage={tabPagination[activeTab]?.page_size || tabPageSize}
              onPageChange={setTabPage}
              onLimitChange={(size) => {
                setTabPageSize(size);
                setTabPage(1);
              }}
              availableLimits={[10, 20, 50, 100]}
              className="mt-5"
            />
          )}
        </div>
      </div>

      <Modal
        isOpen={isDocumentUploadOpen}
        onClose={closeDocumentUpload}
        title="Upload customer document"
        icon={FileText}
        size="lg"
        footer={(
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={closeDocumentUpload} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
              Cancel
            </button>
            <button type="submit" form="customer-document-form" disabled={documentUploadSaving} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {documentUploadSaving ? 'Uploading...' : 'Upload document'}
            </button>
          </div>
        )}
      >
        <form id="customer-document-form" onSubmit={handleDocumentUpload} className="space-y-4 p-1">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Document type</label>
            <SelectField
              options={['ID_PROOF', 'ADDRESS_PROOF', 'TOUR_DOCUMENT', 'OTHER'].map((type) => ({ value: type, label: type }))}
              value={{ value: documentUploadForm.document_type, label: documentUploadForm.document_type }}
              onChange={(selected) => setDocumentUploadForm((current) => ({ ...current, document_type: selected?.value || 'ID_PROOF' }))}
              isSearchable={false}
              placeholder="Select document type"
              menuPlacement="auto"
              classNamePrefix="react-select"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
            <input
              value={documentUploadForm.title}
              onChange={(event) => setDocumentUploadForm((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              placeholder="Enter title"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              value={documentUploadForm.description}
              onChange={(event) => setDocumentUploadForm((current) => ({ ...current, description: event.target.value }))}
              rows={3}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              placeholder="Optional description"
            />
          </div>
          <DragDropUpload
            label="Document file"
            value={documentUploadForm.file}
            onChange={(url, _uploadResult, file) => setDocumentUploadForm((current) => ({
              ...current,
              file: url,
              file_name: file?.name || '',
            }))}
            accept="application/pdf,image/*"
            helperText="PDF, JPG, PNG, TIFF"
          />
        </form>
      </Modal>

      {/* ── Document Preview Modal (MediaViewerModal) ── */}
      <MediaViewerModal isOpen={!!previewDoc} onClose={() => setPreviewDoc(null)}>
        {previewDoc && <CustomerDocumentPreviewContent doc={previewDoc} />}
      </MediaViewerModal>

      {/* ── Enquiry Details Modal ── */}
      <Modal
        isOpen={!!selectedEnquiry}
        onClose={() => setSelectedEnquiry(null)}
        title="Enquiry Details"
        icon={HelpCircle}
        size="lg"
        footer={(
          <div className="flex w-full items-center justify-end">
            <button
              type="button"
              onClick={() => setSelectedEnquiry(null)}
              className="rounded-2xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              Close
            </button>
          </div>
        )}
      >
        {selectedEnquiry && (
          <div className="space-y-5 p-1">
            {/* Header Badge Row */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {selectedEnquiry.enquiry_code || selectedEnquiry.id}
                </span>
                <h3 className="mt-0.5 text-base font-bold text-gray-900 dark:text-white">
                  {selectedEnquiry.subject || 'Travel Enquiry'}
                </h3>
              </div>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                  statusColors[selectedEnquiry.status] || statusColors.NEW
                }`}
              >
                {selectedEnquiry.status || 'NEW'}
              </span>
            </div>

            {/* Message Content */}
            {selectedEnquiry.message && (
              <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 mb-1">Message / Notes</p>
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{selectedEnquiry.message}</p>
              </div>
            )}

            {/* Structured Fields */}
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">Enquirer Name</dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">{selectedEnquiry.enquirer_name || customer?.name || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">Enquirer Phone</dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">{selectedEnquiry.enquirer_phone || customer?.mobile || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">Enquiry Type</dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white capitalize">{selectedEnquiry.enquiry_type?.replace(/_/g, ' ') || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">Channel</dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">{selectedEnquiry.channel || 'WEBSITE'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">Destination</dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">{selectedEnquiry.destination || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">Travel Date</dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">{selectedEnquiry.travel_date ? formatShortDate(selectedEnquiry.travel_date) : 'Flexible'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">Duration</dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                  {selectedEnquiry.travel_duration_day ? `${selectedEnquiry.travel_duration_day} Days / ${selectedEnquiry.travel_duration_night || 0} Nights` : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">Pax Count</dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">{selectedEnquiry.pax_no || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">Rooms Required</dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">{selectedEnquiry.no_room || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">Vehicle Type</dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">{selectedEnquiry.vehicle_type || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">Meal Plan</dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">{selectedEnquiry.meal_plan || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">Special Requirements</dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">{selectedEnquiry.special_requirements || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">Submitted At</dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">{formatDate(selectedEnquiry.created_at)}</dd>
              </div>
            </dl>
          </div>
        )}
      </Modal>

      {/* ── Trip Details Modal ── */}
      <Modal
        isOpen={!!selectedTrip}
        onClose={() => setSelectedTrip(null)}
        title="Trip / Tour Details"
        icon={Plane}
        size="md"
        footer={(
          <div className="flex w-full items-center justify-end">
            <button
              type="button"
              onClick={() => setSelectedTrip(null)}
              className="rounded-2xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              Close
            </button>
          </div>
        )}
      >
        {selectedTrip && (
          <div className="space-y-4 p-1">
            <div className="pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {selectedTrip.title || selectedTrip.package_name || 'Tour Package'}
              </h3>
              <p className="text-xs text-gray-500">{selectedTrip.variant_name || 'Standard Variant'}</p>
            </div>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-gray-500">Departure Date</dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">{formatShortDate(selectedTrip.departure_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Travelers</dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">{selectedTrip.travelers_count || 1} Pax</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Booking Amount</dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">{selectedTrip.amount ? `₹${selectedTrip.amount}` : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Status</dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">{selectedTrip.status || 'CONFIRMED'}</dd>
              </div>
            </dl>
          </div>
        )}
      </Modal>

      {/* ── Review Details Modal ── */}
      <Modal
        isOpen={!!selectedReview}
        onClose={() => setSelectedReview(null)}
        title="Customer Review"
        icon={Star}
        size="md"
        footer={(
          <div className="flex w-full items-center justify-end">
            <button
              type="button"
              onClick={() => setSelectedReview(null)}
              className="rounded-2xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              Close
            </button>
          </div>
        )}
      >
        {selectedReview && (
          <div className="space-y-4 p-1">
            <div className="flex items-center gap-3">
              {selectedReview.customer_profile_picture ? (
                <img src={selectedReview.customer_profile_picture} alt={selectedReview.name || 'Reviewer'} className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                  {(selectedReview.name || 'C').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white">{selectedReview.name || 'Anonymous'}</p>
                <p className="break-all font-mono text-[10px] text-gray-400">Customer ID: {selectedReview.customer_id || '—'}</p>
              </div>
            </div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-1 text-amber-500">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i < (selectedReview.rating || 5) ? 'fill-current' : 'opacity-30'}`}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-400">{formatShortDate(selectedReview.created_at)}</span>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-400">Review ID: <span className="font-mono">{selectedReview.id || '—'}</span></p>
              <p className="text-xs text-gray-400">Package ID: <span className="font-mono">{selectedReview.package_id || '—'}</span></p>
              <p className="text-xs text-gray-400">Status: {selectedReview.is_verified ? 'Verified' : 'Unverified'} · {selectedReview.is_published ? 'Published' : 'Unpublished'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-gray-800/60">
              <p className="text-xs text-gray-400 mb-1">Review</p>
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{selectedReview.review || 'No written review'}</p>
            </div>
            {Array.isArray(selectedReview.review_gallery) && selectedReview.review_gallery.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Review gallery</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {selectedReview.review_gallery.map((media, index) => {
                    const url = typeof media === 'string' ? media : media?.url;
                    if (!url) return null;
                    const isVideo = media?.type === 'video' || /\.(mp4|mov|webm|ogg)(\?|$)/i.test(url);
                    return isVideo ? (
                      <video key={media.id || url} src={url} controls className="aspect-square w-full rounded-lg bg-black object-contain" />
                    ) : (
                      <img key={media.id || url} src={url} alt={media?.alt || `Review gallery item ${index + 1}`} className="aspect-square w-full rounded-lg object-cover" />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Referral Details Modal ── */}
      <Modal
        isOpen={!!selectedReferral}
        onClose={() => setSelectedReferral(null)}
        title="Referral Details"
        icon={Share2}
        size="md"
        footer={(
          <div className="flex w-full items-center justify-end">
            <button
              type="button"
              onClick={() => setSelectedReferral(null)}
              className="rounded-2xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              Close
            </button>
          </div>
        )}
      >
        {selectedReferral && (
          <div className="space-y-4 p-1">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-gray-500">Referee Contact</dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">{selectedReferral.referred_name || selectedReferral.contact || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Status</dt>
                <dd className="mt-0.5 text-sm font-semibold text-emerald-600">{selectedReferral.status || 'CONVERTED'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Reward Points</dt>
                <dd className="mt-0.5 text-sm font-semibold text-indigo-600">{selectedReferral.reward_points || 0} pts</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Referral Date</dt>
                <dd className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">{formatShortDate(selectedReferral.created_at)}</dd>
              </div>
            </dl>
          </div>
        )}
      </Modal>

      {/* ── Edit Customer Modal ── */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Customer Profile"
        icon={User}
        size="lg"
        footer={(
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="customer-edit-form"
              disabled={saving}
              className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      >
        <form id="customer-edit-form" onSubmit={handleEditSubmit} className="space-y-5 p-1">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Full name <span className="text-red-500">*</span>
              </label>
              <input
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                placeholder="Enter full name"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Source</label>
              <SelectField
                options={sourceOptions}
                value={sourceOptions.find((o) => o.value === editForm.source) || null}
                onChange={(selected) => setEditForm((prev) => ({ ...prev, source: selected?.value || 'WEBSITE' }))}
                isSearchable={false}
                placeholder="Select source"
                menuPlacement="auto"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Mobile</label>
              <input
                value={editForm.mobile}
                onChange={(e) => setEditForm((prev) => ({ ...prev, mobile: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                placeholder="e.g. +91 9876543210"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                placeholder="customer@email.com"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
              <input
                value={editForm.address}
                onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                placeholder="Street, City, State"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Emergency contact name</label>
              <input
                value={editForm.emergency_contact_name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, emergency_contact_name: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                placeholder="Contact person name"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Emergency contact mobile</label>
              <input
                value={editForm.emergency_contact_mobile}
                onChange={(e) => setEditForm((prev) => ({ ...prev, emergency_contact_mobile: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                placeholder="+91 9876543210"
              />
            </div>

            <div className="flex items-center gap-6 md:col-span-2">
              <label className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <UserCheck className="h-4 w-4" />
                Active account
              </label>
            </div>

            <div className="md:col-span-2">
              <DragDropUpload
                label="Profile picture"
                value={editForm.profile_pic}
                onChange={(url) => setEditForm((prev) => ({ ...prev, profile_pic: url }))}
                helperText="Recommended: square image, JPG or PNG"
                accept="image/*"
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CustomerDetails;
