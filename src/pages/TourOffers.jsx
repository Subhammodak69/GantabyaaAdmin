import React, { useEffect, useState } from 'react';
import ManagementTable from '../component/common/ManagementTable';
import toast from 'react-hot-toast';
import { BadgePercent, BookOpen, Layers, Pencil, Plus, RefreshCw, Trash2, Search, Filter, X } from 'lucide-react';
import Modal from '../component/common/Modal';
import ConfirmDeleteModal from '../component/common/ConfirmDeleteModal';
import CustomDatePicker from '../component/common/CustomDatePicker';
import SelectField from '../component/common/SelectField';
import ActionMenu from '../component/common/ActionMenu';
import { apiCall, handleApiError } from '../utils/apiCall';
import { sanitizeNumericInput } from '../utils/inputValidation';

const discountTypes = ['PERCENTAGE', 'FIXED_AMOUNT'];
const statuses = ['DRAFT', 'ACTIVE', 'INACTIVE', 'EXPIRED'];
const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200';

const defaultForm = {
  name: '',
  description: '',
  discount_type: 'PERCENTAGE',
  discount_value: 0,
  max_discount_amount: 0,
  min_booking_amount: 0,
  usage_limit: 1,
  per_customer_limit: 1,
  valid_from: '',
  valid_until: '',
  status: 'DRAFT',
};

const formatAmount = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const formatDate = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';
const toDateTimeLocal = (value) => value ? new Date(value).toISOString().slice(0, 16) : '';

const fetchAllPages = async (endpoint, errorMessage) => {
  const firstResponse = await apiCall(endpoint, 'GET');
  const firstPayload = await firstResponse.json().catch(() => ({}));
  if (!firstResponse.ok) {
    throw new Error(firstPayload?.message || firstPayload?.detail || errorMessage);
  }

  const firstPage = Array.isArray(firstPayload?.data) ? firstPayload.data : [];
  const pagination = firstPayload?.pagination || {};
  const currentPage = Number(pagination.current_page) || 1;
  const totalPages = Number(pagination.total_pages) || 1;
  const pageSize = Number(pagination.page_size) || firstPage.length || 10;

  if (totalPages <= currentPage) return firstPage;

  const remainingResponses = await Promise.all(
    Array.from({ length: totalPages - currentPage }, (_, index) => apiCall(
      `${endpoint}${endpoint.includes('?') ? '&' : '?'}page=${currentPage + index + 1}&page_size=${pageSize}`,
      'GET',
    )),
  );
  const remainingPayloads = await Promise.all(remainingResponses.map(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message || payload?.detail || errorMessage);
    return Array.isArray(payload?.data) ? payload.data : [];
  }));

  return [...firstPage, ...remainingPayloads.flat()];
};

const TourOffers = () => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingOffer, setDeletingOffer] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editingOffer, setEditingOffer] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [variantsOffer, setVariantsOffer] = useState(null);
  const [chosenVariants, setChosenVariants] = useState([]);
  const [packageOptions, setPackageOptions] = useState([]);
  const [isAddingVariants, setIsAddingVariants] = useState(false);
  const [variantPackage, setVariantPackage] = useState(null);
  const [packageVariantChoices, setPackageVariantChoices] = useState([]);
  const [pendingVariantIds, setPendingVariantIds] = useState(new Set());
  const [variantSearch, setVariantSearch] = useState('');
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantsSaving, setVariantsSaving] = useState(false);

  const [bookingsOffer, setBookingsOffer] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  const filteredPackageVariantChoices = packageVariantChoices.filter((variant) => {
    const term = variantSearch.trim().toLowerCase();
    if (!term) return true;
    return [variant.name, variant.slug, variant.season_name, variant.badge]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(term);
  });

  const loadOffers = async () => {
    setLoading(true);
    try {
      const response = await apiCall('/api/v1/admin/tour-offers', 'GET');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || payload?.detail || 'Unable to fetch tour offers');
      setOffers(Array.isArray(payload?.data) ? payload.data : []);
    } catch (error) {
      handleApiError(error, 'Unable to load tour offers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOffers(); }, []);

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingOffer(null);
    setForm(defaultForm);
  };

  const openCreate = () => {
    setEditingOffer(null);
    setForm(defaultForm);
    setIsFormOpen(true);
  };

  const openEdit = (offer) => {
    setEditingOffer(offer);
    setForm({
      name: offer.name || '',
      description: offer.description || '',
      discount_type: offer.discount_type || 'PERCENTAGE',
      discount_value: offer.discount_value ?? 0,
      max_discount_amount: offer.max_discount_amount ?? 0,
      min_booking_amount: offer.min_booking_amount ?? 0,
      usage_limit: offer.usage_limit ?? 1,
      per_customer_limit: offer.per_customer_limit ?? 1,
      valid_from: toDateTimeLocal(offer.valid_from),
      valid_until: toDateTimeLocal(offer.valid_until),
      status: offer.status || 'DRAFT',
    });
    setIsFormOpen(true);
  };

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const saveOffer = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.valid_from || !form.valid_until) {
      toast.error('Name, valid-from date, and valid-until date are required');
      return;
    }
    if (new Date(form.valid_until) <= new Date(form.valid_from)) {
      toast.error('The end date must be after the start date');
      return;
    }

    const payload = {
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
      discount_value: Number(form.discount_value),
      max_discount_amount: Number(form.max_discount_amount),
      min_booking_amount: Number(form.min_booking_amount),
      usage_limit: Number(form.usage_limit),
      per_customer_limit: Number(form.per_customer_limit),
      valid_from: new Date(form.valid_from).toISOString(),
      valid_until: new Date(form.valid_until).toISOString(),
    };

    setSaving(true);
    try {
      const endpoint = editingOffer ? `/api/v1/admin/tour-offers/${editingOffer.id}` : '/api/v1/admin/tour-offers';
      const response = await apiCall(endpoint, editingOffer ? 'PATCH' : 'POST', payload);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || result?.detail || 'Unable to save tour offer');
      toast.success(result?.message || (editingOffer ? 'Tour offer updated successfully' : 'Tour offer created successfully'));
      closeForm();
      await loadOffers();
    } catch (error) {
      handleApiError(error, editingOffer ? 'Unable to update tour offer' : 'Unable to create tour offer');
    } finally {
      setSaving(false);
    }
  };

  const deleteOffer = (offer) => {
    setDeleteTarget(offer);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteOffer = async () => {
    if (!deleteTarget) return;
    setDeletingOffer(true);
    try {
      const response = await apiCall(`/api/v1/admin/tour-offers/${deleteTarget.id}`, 'DELETE');
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || result?.detail || 'Unable to delete tour offer');
      toast.success(result?.message || 'Tour offer deleted successfully');
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      await loadOffers();
    } catch (error) {
      handleApiError(error, 'Unable to delete tour offer');
    } finally {
      setDeletingOffer(false);
    }
  };

  const openVariants = async (offer) => {
    setVariantsOffer(offer);
    setChosenVariants([]);
    setPackageOptions([]);
    setIsAddingVariants(false);
    setVariantPackage(null);
    setPackageVariantChoices([]);
    setPendingVariantIds(new Set());
    setVariantSearch('');
    setVariantsLoading(true);
    try {
      const [assignedResponse, activePackages] = await Promise.all([
        apiCall(`/api/v1/admin/tour-offers/${offer.id}/variants`, 'GET'),
        fetchAllPages('/api/v1/admin/tour-packages?is_active=true', 'Unable to fetch active tour packages'),
      ]);
      const assignedPayload = await assignedResponse.json().catch(() => ({}));
      if (!assignedResponse.ok) throw new Error(assignedPayload?.message || assignedPayload?.detail || 'Unable to fetch offer variants');

      const assigned = Array.isArray(assignedPayload?.data) ? assignedPayload.data : [];
      setChosenVariants(assigned);
      setPackageOptions(activePackages.map((tourPackage) => ({
        value: tourPackage.id,
        label: tourPackage.title || tourPackage.tour_code || tourPackage.slug || 'Unnamed package',
      })));
    } catch (error) {
      handleApiError(error, 'Unable to load offer variants');
    } finally {
      setVariantsLoading(false);
    }
  };

  const chooseVariantPackage = async (tourPackage) => {
    if (!tourPackage) return;
    setVariantPackage(tourPackage);
    setPackageVariantChoices([]);
    setPendingVariantIds(new Set());
    setVariantSearch('');
    setVariantsLoading(true);
    try {
      const loadedVariants = await fetchAllPages(
        `/api/v1/admin/tour-packages/${encodeURIComponent(tourPackage.value)}/variants`,
        `Unable to fetch variants for ${tourPackage.label}`,
      );
      setPackageVariantChoices(loadedVariants);
    } catch (error) {
      handleApiError(error, 'Unable to load selected package variants');
    } finally {
      setVariantsLoading(false);
    }
  };

  const togglePendingVariant = (id) => {
    setPendingVariantIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addPendingVariants = () => {
    setChosenVariants((current) => [
      ...new Map([...current, ...packageVariantChoices.filter((variant) => pendingVariantIds.has(variant.id))].map((variant) => [variant.id, variant])).values(),
    ]);
    setIsAddingVariants(false);
    setVariantPackage(null);
    setPackageVariantChoices([]);
    setPendingVariantIds(new Set());
    setVariantSearch('');
  };

  const removeChosenVariant = (id) => {
    setChosenVariants((current) => current.filter((variant) => variant.id !== id));
  };

  const saveVariants = async () => {
    if (!variantsOffer) return;
    setVariantsSaving(true);
    try {
      const response = await apiCall(`/api/v1/admin/tour-offers/${variantsOffer.id}/variants`, 'PATCH', {
        variant_ids: chosenVariants.map((variant) => variant.id),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || result?.detail || 'Unable to update offer variants');
      toast.success(result?.message || 'Offer variants updated successfully');
      setVariantsOffer(null);
    } catch (error) {
      handleApiError(error, 'Unable to update offer variants');
    } finally {
      setVariantsSaving(false);
    }
  };

  const openBookings = async (offer) => {
    setBookingsOffer(offer);
    setBookings([]);
    setBookingsLoading(true);
    try {
      const response = await apiCall(`/api/v1/admin/tour-offers/${offer.id}/bookings`, 'GET');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || payload?.detail || 'Unable to fetch offer bookings');
      setBookings(Array.isArray(payload?.data) ? payload.data : []);
    } catch (error) {
      handleApiError(error, 'Unable to load offer bookings');
    } finally {
      setBookingsLoading(false);
    }
  };

  const filteredOffers = offers.filter((offer) => {
    if (statusFilter !== 'ALL' && offer.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchName = (offer.name || '').toLowerCase().includes(q);
      const matchDesc = (offer.description || '').toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }
    return true;
  });

  return (
    <div className="space-y-3 pb-6">
      <div className="px-2 text-slate-900 dark:text-slate-100">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mt-1 bg-gradient-to-r from-slate-900 via-amber-600 to-orange-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent md:text-3xl dark:from-slate-100 dark:via-amber-300 dark:to-orange-300">Tour Offers</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Create promotions, assign tour variants, and review discounted bookings.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Refresh offers" title="Refresh offers" onClick={loadOffers} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 sm:px-3 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> <span className="hidden sm:inline">Refresh</span>
            </button>
            <button type="button" aria-label="Add offer" title="Add offer" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white p-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 sm:px-4">
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add offer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="mt-5 px-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search offers..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition sm:px-4 ${
              statusFilter !== 'ALL'
                ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filter</span>
            {statusFilter !== 'ALL' && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white">
                1
              </span>
            )}
          </button>

          {(searchTerm || statusFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-dashed border-gray-300 px-2.5 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 sm:px-3"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          <span className="hidden shrink-0 text-sm text-gray-500 dark:text-gray-400 sm:block">
            {filteredOffers.length} record{filteredOffers.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Filter Modal */}
      <Modal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="Filter Tour Offers"
        icon={Filter}
        size="sm"
        footer={(
          <div className="flex w-full gap-3">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setIsFilterOpen(false);
              }}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={() => setIsFilterOpen(false)}
              className="flex-1 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
            >
              Apply
            </button>
          </div>
        )}
      >
        <div className="space-y-4 p-1">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
            <div className="grid grid-cols-2 gap-2">
              {['ALL', ...statuses].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-xl border py-2 text-xs font-semibold transition ${
                    statusFilter === st
                      ? 'border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-300'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  {st === 'ALL' ? 'All Statuses' : st}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <div className="overflow-hidden md:rounded-2xl md:border md:border-gray-200 md:bg-white md:shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {loading ? <div className="p-12 text-center text-sm text-gray-500">Loading offers...</div> : filteredOffers.length === 0 ? <div className="p-12 text-center text-sm text-gray-500">No tour offers found.</div> : (
          <div className="overflow-x-auto">
            <ManagementTable><table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/70"><tr>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Offer</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Discount</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Usage</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Validity</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredOffers.map((offer) => (
                  <tr key={offer.id} className="hover:bg-amber-50/40 dark:hover:bg-amber-900/10">
                    <td className="px-4 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300"><BadgePercent className="h-4 w-4" /></span><div><p className="font-semibold text-gray-900 dark:text-white">{offer.name}</p><p className="max-w-xs truncate text-xs text-gray-500 dark:text-gray-400">{offer.description || 'No description'}</p></div></div></td>
                    <td className="px-4 py-4 text-gray-700 dark:text-gray-300"><p className="font-semibold">{offer.discount_type === 'PERCENTAGE' ? `${offer.discount_value}%` : formatAmount(offer.discount_value)}</p><p className="text-xs text-gray-500">Min. {formatAmount(offer.min_booking_amount)}</p></td>
                    <td className="px-4 py-4 text-gray-700 dark:text-gray-300">{offer.usage_count || 0} / {offer.usage_limit ?? '∞'}<p className="text-xs text-gray-500">{offer.per_customer_limit ?? 0} per customer</p></td>
                    <td className="px-4 py-4 text-xs text-gray-500 dark:text-gray-400">{formatDate(offer.valid_from)}<br />to {formatDate(offer.valid_until)}</td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${offer.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : offer.status === 'DRAFT' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>{offer.status || 'DRAFT'}</span></td>
                    <td className="px-4 py-4"><div className="flex justify-end"><ActionMenu menuId={offer.id} actions={[
                      { label: 'Manage variants', icon: <Layers className="h-4 w-4 text-amber-500" />, onClick: () => openVariants(offer) },
                      { label: 'View bookings', icon: <BookOpen className="h-4 w-4 text-cyan-500" />, onClick: () => openBookings(offer) },
                      { label: 'Edit offer', icon: <Pencil className="h-4 w-4 text-indigo-500" />, onClick: () => openEdit(offer) },
                      { label: 'Delete offer', icon: <Trash2 className="h-4 w-4 text-red-500" />, className: 'text-red-600 hover:text-red-700 dark:text-red-400', onClick: () => deleteOffer(offer) },
                    ]} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table></ManagementTable>
          </div>
        )}
      </div>

      <Modal isOpen={isFormOpen} onClose={closeForm} title={editingOffer ? 'Edit tour offer' : 'Add tour offer'} icon={BadgePercent} size="xl" footer={<div className="flex justify-end gap-3"><button type="button" onClick={closeForm} className="rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">Cancel</button><button type="submit" form="tour-offer-form" disabled={saving} className="rounded-2xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">{saving ? 'Saving...' : editingOffer ? 'Save changes' : 'Create offer'}</button></div>}>
        <form id="tour-offer-form" onSubmit={saveOffer} className="space-y-5 p-1">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2"><label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Offer name</label><input value={form.name} onChange={(event) => updateForm('name', event.target.value)} className={inputClass} placeholder="e.g. Summer Escape" required /></div>
            <div className="md:col-span-2"><label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label><textarea value={form.description} onChange={(event) => updateForm('description', event.target.value)} className={inputClass} rows={3} placeholder="Optional offer details" /></div>
            <div><label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Discount type</label><SelectField options={discountTypes.map((value) => ({ value, label: value === 'FIXED_AMOUNT' ? 'Fixed amount' : 'Percentage' }))} value={{ value: form.discount_type, label: form.discount_type === 'FIXED_AMOUNT' ? 'Fixed amount' : 'Percentage' }} onChange={(item) => updateForm('discount_type', item?.value || 'PERCENTAGE')} isSearchable={false} menuPlacement="auto" classNamePrefix="react-select" /></div>
            <NumberField label={form.discount_type === 'PERCENTAGE' ? 'Discount percentage' : 'Discount amount'} value={form.discount_value} onChange={(value) => updateForm('discount_value', value)} />
            <NumberField label="Maximum discount amount" value={form.max_discount_amount} onChange={(value) => updateForm('max_discount_amount', value)} />
            <NumberField label="Minimum booking amount" value={form.min_booking_amount} onChange={(value) => updateForm('min_booking_amount', value)} />
            <NumberField label="Total usage limit" value={form.usage_limit} onChange={(value) => updateForm('usage_limit', value)} integer min="1" />
            <NumberField label="Per-customer limit" value={form.per_customer_limit} onChange={(value) => updateForm('per_customer_limit', value)} integer min="1" />
            <DateField label="Valid from" value={form.valid_from} onChange={(value) => updateForm('valid_from', value)} />
            <DateField label="Valid until" value={form.valid_until} onChange={(value) => updateForm('valid_until', value)} />
            <div><label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label><SelectField options={statuses.map((value) => ({ value, label: value }))} value={{ value: form.status, label: form.status }} onChange={(item) => updateForm('status', item?.value || 'DRAFT')} isSearchable={false} menuPlacement="auto" classNamePrefix="react-select" /></div>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!variantsOffer} onClose={() => setVariantsOffer(null)} title={`Variants · ${variantsOffer?.name || ''}`} icon={Layers} size="3xl" footer={<div className="flex justify-end gap-3"><button type="button" onClick={() => setVariantsOffer(null)} className="rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">Cancel</button><button type="button" onClick={saveVariants} disabled={variantsSaving || variantsLoading || isAddingVariants} className="rounded-2xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">{variantsSaving ? 'Saving...' : 'Save variants'}</button></div>}>
        <div className="space-y-5 p-1">
          <section className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
            <div className="mb-3 flex items-center justify-between gap-3"><div><h4 className="font-semibold text-gray-900 dark:text-white">Added variants</h4><p className="text-xs text-gray-500">{chosenVariants.length} variant{chosenVariants.length === 1 ? '' : 's'} will be saved with this offer.</p></div>{!isAddingVariants && <button type="button" onClick={() => setIsAddingVariants(true)} className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300">Add more variants</button>}</div>
            {chosenVariants.length === 0 ? <p className="py-4 text-center text-sm text-gray-500">No variants added yet.</p> : <div className="max-h-52 overflow-y-auto pr-1"><div className="grid gap-2 md:grid-cols-2">{chosenVariants.map((variant) => <div key={variant.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700"><div className="min-w-0"><p className="truncate font-medium text-gray-900 dark:text-white">{variant.name}</p><p className="text-xs text-gray-500">{variant.season_name || 'No season'} · {variant.duration_days ?? 0}D / {variant.duration_nights ?? 0}N</p></div><button type="button" onClick={() => removeChosenVariant(variant.id)} className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400">Remove</button></div>)}</div></div>}
          </section>

          {isAddingVariants && <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900/50 dark:bg-amber-900/10">
            <div className="mb-3 flex items-center justify-between"><h4 className="font-semibold text-gray-900 dark:text-white">Add variants from a package</h4><button type="button" onClick={() => { setIsAddingVariants(false); setVariantPackage(null); setPackageVariantChoices([]); setPendingVariantIds(new Set()); setVariantSearch(''); }} className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Cancel</button></div>
            <SelectField options={packageOptions} value={variantPackage} onChange={chooseVariantPackage} isSearchable isLoading={variantsLoading && packageOptions.length === 0} placeholder="Search and select an active tour package" noOptionsMessage={() => (packageOptions.length ? 'No matching packages' : 'No active packages available')} menuPlacement="auto" classNamePrefix="react-select" />
            {variantsLoading && variantPackage ? <div className="py-6 text-center text-sm text-gray-500">Loading package variants...</div> : packageVariantChoices.length > 0 && <div className="mt-4 space-y-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-gray-700 dark:text-gray-300">Select variants to add</p><p className="text-xs text-gray-500">Showing {filteredPackageVariantChoices.length} of {packageVariantChoices.length} variants · {pendingVariantIds.size} selected</p></div><div className="flex gap-3"><button type="button" onClick={() => setPendingVariantIds((current) => new Set([...current, ...filteredPackageVariantChoices.map((variant) => variant.id)]))} className="text-xs font-semibold text-amber-700 hover:underline dark:text-amber-300">Select shown</button><button type="button" onClick={() => setPendingVariantIds((current) => new Set([...current].filter((id) => !filteredPackageVariantChoices.some((variant) => variant.id === id))))} className="text-xs font-semibold text-gray-500 hover:underline">Clear shown</button></div></div><input value={variantSearch} onChange={(event) => setVariantSearch(event.target.value)} placeholder="Search variants by name, season, badge, or slug..." className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" />{filteredPackageVariantChoices.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">No variants match this search.</p> : <div className="max-h-[42vh] overflow-y-auto pr-1"><div className="grid gap-2 md:grid-cols-2">{filteredPackageVariantChoices.map((variant) => <label key={variant.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 hover:bg-amber-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-amber-900/10"><input type="checkbox" checked={pendingVariantIds.has(variant.id)} onChange={() => togglePendingVariant(variant.id)} className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500" /><div className="min-w-0 flex-1"><p className="font-medium text-gray-900 dark:text-white">{variant.name}</p><p className="text-xs text-gray-500">{variant.season_name || 'No season'} · {variant.duration_days ?? 0}D / {variant.duration_nights ?? 0}N · {formatAmount(variant.selling_price)}</p></div></label>)}</div></div>}<div className="flex justify-end"><button type="button" onClick={addPendingVariants} disabled={pendingVariantIds.size === 0} className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60">Done · Add selected ({pendingVariantIds.size})</button></div></div>}
          </section>}
        </div>
      </Modal>

      <Modal isOpen={!!bookingsOffer} onClose={() => setBookingsOffer(null)} title={`Bookings · ${bookingsOffer?.name || ''}`} icon={BookOpen} size="2xl">
        {bookingsLoading ? <div className="p-8 text-center text-sm text-gray-500">Loading bookings...</div> : bookings.length === 0 ? <div className="p-8 text-center text-sm text-gray-500">No bookings have used this offer.</div> : <div className="overflow-x-auto"><ManagementTable><table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-800"><tr><th className="px-3 py-2">Booking</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Discount</th><th className="px-3 py-2">Total</th><th className="px-3 py-2">Created</th></tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-700">{bookings.map((booking) => <tr key={booking.id}><td className="px-3 py-3 font-medium text-gray-900 dark:text-white">{booking.booking_code || 'Booking'}</td><td className="px-3 py-3">{booking.customer_name || booking.customer_mobile || 'N/A'}</td><td className="px-3 py-3">{booking.status || 'N/A'}</td><td className="px-3 py-3">{formatAmount(booking.discount_amount)}</td><td className="px-3 py-3">{formatAmount(booking.total_amount)}</td><td className="px-3 py-3 text-xs text-gray-500">{formatDate(booking.created_at)}</td></tr>)}</tbody></table></ManagementTable></div>}
      </Modal>
    </div>
  );
};

const NumberField = ({ label, value, onChange, integer = false }) => <div><label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label><input type="text" inputMode={integer ? 'numeric' : 'decimal'} value={value} onChange={(event) => onChange(sanitizeNumericInput(event.target.value))} className={inputClass} required /></div>;
const DateField = ({ label, value, onChange }) => <div><label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label><CustomDatePicker value={value} onChange={onChange} /></div>;

export default TourOffers;
