import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ManagementTable from '../component/common/ManagementTable';
import toast from 'react-hot-toast';
import {
  Plus,
  MapPin,
  Pencil,
  Trash2,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  LoaderCircle,
  Globe,
  Home,
  Star,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import Modal from '../component/common/Modal';
import ConfirmDeleteModal from '../component/common/ConfirmDeleteModal';
import DragDropUpload from '../component/common/DragDropUpload';
import MediaPreviewModal from '../component/common/MediaPreviewModal';
import Pagination from '../component/common/PaginationComponent';
import ActionMenu from '../component/common/ActionMenu';
import { apiCall, handleApiError } from '../utils/apiCall';

const defaultForm = {
  name: '',
  slug: '',
  country: '',
  description: '',
  image_url: '',
  is_domestic: true,
  is_featured: false,
};

const DestinationManagement = () => {
  const navigate = useNavigate();
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDestination, setEditingDestination] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingDestination, setDeletingDestination] = useState(false);
  const [updatingStatusIds, setUpdatingStatusIds] = useState(() => new Set());
  const [formState, setFormState] = useState(defaultForm);

  const loadDestinations = useCallback(
    async (page = currentPage, limit = itemsPerPage) => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({ page, page_size: limit });
        const response = await apiCall(
          `/api/v1/admin/destinations?${queryParams.toString()}`,
          'GET'
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            payload?.message || payload?.detail || 'Unable to fetch destinations'
          );
        }
        const data = Array.isArray(payload?.data) ? payload.data : [];
        setDestinations(data);
        if (payload?.pagination) {
          setTotalItems(payload.pagination.total_items ?? data.length);
        } else {
          setTotalItems(data.length);
        }
      } catch (error) {
        handleApiError(error, 'Unable to fetch destinations');
      } finally {
        setLoading(false);
      }
    },
    [currentPage, itemsPerPage]
  );

  useEffect(() => {
    loadDestinations(currentPage, itemsPerPage);
  }, [loadDestinations, currentPage, itemsPerPage]);

  const resetForm = () => {
    setFormState(defaultForm);
    setEditingDestination(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (row) => {
    setEditingDestination(row);
    setFormState({
      name: row?.name || '',
      slug: row?.slug || '',
      country: row?.country || '',
      description: row?.description || '',
      image_url: row?.image_url || '',
      is_domestic: row?.is_domestic !== false,
      is_featured: Boolean(row?.is_featured),
    });
    setIsModalOpen(true);
  };

  const handleFieldChange = (field, value) => {
    setFormState((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: formState.name,
        slug: formState.slug,
        country: formState.country,
        description: formState.description,
        image_url: formState.image_url,
        is_domestic: Boolean(formState.is_domestic),
        is_featured: Boolean(formState.is_featured),
      };

      const endpoint = editingDestination
        ? `/api/v1/admin/destinations/${editingDestination.id}`
        : '/api/v1/admin/destinations';
      const method = editingDestination ? 'PATCH' : 'POST';

      const response = await apiCall(endpoint, method, payload);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          result?.message || result?.detail || 'Unable to save destination'
        );
      }

      toast.success(
        result?.message ||
          (editingDestination
            ? 'Destination updated successfully'
            : 'Destination created successfully')
      );
      setIsModalOpen(false);
      resetForm();
      await loadDestinations(currentPage, itemsPerPage);
    } catch (error) {
      handleApiError(
        error,
        editingDestination ? 'Unable to update destination' : 'Unable to create destination'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (row) => {
    setDeleteTarget(row);
    setIsDeleteModalOpen(true);
  };

  const handleToggleActive = async (destination) => {
    const newStatus = destination.is_active === false;
    setUpdatingStatusIds((previous) => new Set(previous).add(destination.id));
    try {
      const response = await apiCall(
        `/api/v1/admin/destinations/${destination.id}`,
        'PATCH',
        { is_active: newStatus }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.message || result?.detail || 'Failed to update destination status');
      }

      setDestinations((previous) => previous.map((item) => (
        item.id === destination.id ? { ...item, is_active: newStatus } : item
      )));
      toast.success(`Destination ${newStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      handleApiError(error, 'Unable to update destination status');
    } finally {
      setUpdatingStatusIds((previous) => {
        const next = new Set(previous);
        next.delete(destination.id);
        return next;
      });
    }
  };

  const confirmDeleteDestination = async () => {
    if (!deleteTarget) return;
    setDeletingDestination(true);
    try {
      const response = await apiCall(
        `/api/v1/admin/destinations/${deleteTarget.id}`,
        'DELETE'
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          result?.message || result?.detail || 'Unable to delete destination'
        );
      }
      toast.success(result?.message || 'Destination deleted successfully');
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      await loadDestinations(currentPage, itemsPerPage);
    } catch (error) {
      handleApiError(error, 'Unable to delete destination');
    } finally {
      setDeletingDestination(false);
    }
  };

  const filteredDestinations = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return destinations.filter((item) => {
      if (!term) return true;
      return [item.name, item.slug, item.country]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [destinations, searchTerm]);

  const handleDestinationCountClick = (destination, type) => {
    const route = type === 'hotel' ? '/hotels' : '/tour-packages';
    const params = new URLSearchParams({ destination_id: destination.id });
    navigate(`${route}?${params.toString()}`);
  };

  const inputClass =
    'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200';

  const labelClass = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300';

  return (
    <div className="space-y-3 pb-6">
      {/* Header */}
      <div className="px-2 text-slate-900 dark:text-slate-100">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mt-1 bg-gradient-to-r from-slate-900 via-emerald-700 to-teal-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent md:text-3xl dark:from-slate-100 dark:via-emerald-300 dark:to-teal-300">
              Destinations
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Manage travel destinations — domestic and international locations for your tour catalog.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Refresh destinations"
              title="Refresh destinations"
              onClick={() => loadDestinations(currentPage, itemsPerPage)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 sm:px-3 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              aria-label="Add destination"
              title="Add destination"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white p-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 sm:px-4"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add destination</span>
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
              placeholder="Search destinations..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>

          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-dashed border-gray-300 px-2.5 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 sm:px-3"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          <span className="hidden shrink-0 text-sm text-gray-500 dark:text-gray-400 sm:block">
            {filteredDestinations.length} record{filteredDestinations.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden md:rounded-2xl md:border md:border-gray-200 md:bg-white md:shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">
            Loading destinations...
          </div>
        ) : filteredDestinations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-400 dark:bg-emerald-900/20">
              <MapPin className="h-6 w-6" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchTerm ? 'No destinations match your search.' : 'No destinations added yet.'}
            </p>
            {!searchTerm && (
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Add your first destination
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <ManagementTable><table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/70">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                    Destination
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                    Country / Slug
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                    Type
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                    Linked Records
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredDestinations.map((dest) => (
                  <tr
                    key={dest.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    {/* Name + image */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {dest.image_url ? (
                          <MediaPreviewModal
                            src={dest.image_url}
                            alt={dest.name}
                            type="image"
                            thumbnailClassName="h-10 w-10 rounded-xl object-cover ring-2 ring-emerald-100 dark:ring-emerald-950"
                            className="block"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20">
                            <ImageIcon className="h-4 w-4" />
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {dest.name || 'Untitled'}
                          </div>
                          {dest.is_featured && (
                            <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:bg-amber-900/20 dark:text-amber-300">
                              <Star className="h-2.5 w-2.5" />
                              Featured
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Country / Slug */}
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-800 dark:text-gray-200">
                        {dest.country || '—'}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        /{dest.slug || '—'}
                      </div>
                    </td>

                    {/* Domestic / International */}
                    <td className="px-4 py-4">
                      <span
                        className={[
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                          dest.is_domestic
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
                        ].join(' ')}
                      >
                        {dest.is_domestic ? (
                          <Home className="h-3 w-3" />
                        ) : (
                          <Globe className="h-3 w-3" />
                        )}
                        {dest.is_domestic ? 'Domestic' : 'International'}
                      </span>
                    </td>

                    {/* Linked Records */}
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDestinationCountClick(dest, 'hotel')}
                          className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-900/40 dark:bg-indigo-900/20 dark:text-indigo-300"
                        >
                          <Home className="h-3 w-3" />
                          {Number(dest.hotel_count || 0)} Hotels
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDestinationCountClick(dest, 'tour')}
                          className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 dark:border-violet-900/40 dark:bg-violet-900/20 dark:text-violet-300"
                        >
                          <MapPin className="h-3 w-3" />
                          {Number(dest.tour_package_count || 0)} Packages
                        </button>
                      </div>
                    </td>

                    {/* Active / Inactive */}
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(dest)}
                        disabled={updatingStatusIds.has(dest.id)}
                        aria-label={`${dest.is_active === false ? 'Activate' : 'Deactivate'} ${dest.name}`}
                        aria-pressed={dest.is_active !== false}
                        title="Click to toggle status"
                        className={[
                          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60',
                          dest.is_active === false
                            ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300',
                        ].join(' ')}
                      >
                        {updatingStatusIds.has(dest.id) ? (
                          <LoaderCircle className="h-3 w-3 animate-spin" />
                        ) : dest.is_active === false ? (
                          <XCircle className="h-3 w-3" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        {dest.is_active === false ? 'Inactive' : 'Active'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end">
                        <ActionMenu
                          menuId={dest.id}
                          actions={[
                            {
                              label: 'Edit Destination',
                              icon: <Pencil className="h-4 w-4 text-blue-500" />,
                              onClick: () => openEditModal(dest),
                            },
                            {
                              label: dest.is_active === false ? 'Activate Destination' : 'Deactivate Destination',
                              icon: dest.is_active === false
                                ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                : <XCircle className="h-4 w-4 text-amber-500" />,
                              disabled: updatingStatusIds.has(dest.id),
                              onClick: () => handleToggleActive(dest),
                            },
                            {
                              label: 'Delete Destination',
                              icon: <Trash2 className="h-4 w-4 text-red-500" />,
                              className: 'text-red-600 hover:text-red-700 dark:text-red-400',
                              onClick: () => handleDelete(dest),
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
          onPageChange={(page) => setCurrentPage(page)}
          onLimitChange={(limit) => {
            setItemsPerPage(limit);
            setCurrentPage(1);
          }}
        />
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        title={editingDestination ? 'Edit destination' : 'Add destination'}
        icon={MapPin}
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}
              className="rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="destination-form"
              disabled={saving}
              className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? 'Saving...'
                : editingDestination
                ? 'Save changes'
                : 'Create destination'}
            </button>
          </div>
        }
      >
        <form id="destination-form" onSubmit={handleSubmit} className="space-y-5 p-1">
          <div className="grid gap-5 md:grid-cols-2">
            {/* Name */}
            <div>
              <label className={labelClass}>Name</label>
              <input
                value={formState.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                className={inputClass}
                placeholder="e.g. Darjeeling"
                required
              />
            </div>

            {/* Slug */}
            <div>
              <label className={labelClass}>Slug</label>
              <input
                value={formState.slug}
                onChange={(e) => handleFieldChange('slug', e.target.value)}
                className={inputClass}
                placeholder="darjeeling"
                required
              />
            </div>

            {/* Country */}
            <div>
              <label className={labelClass}>Country</label>
              <input
                value={formState.country}
                onChange={(e) => handleFieldChange('country', e.target.value)}
                className={inputClass}
                placeholder="India"
                required
              />
            </div>

            {/* Image upload */}
            <div className="md:col-span-2">
              <DragDropUpload
                label="Destination Image"
                value={formState.image_url}
                onChange={(url) => handleFieldChange('image_url', url)}
                accept="image/*"
                helperText="JPG, PNG, WEBP up to 10MB"
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className={labelClass}>Description</label>
              <textarea
                value={formState.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                rows={3}
                className={inputClass}
                placeholder="Brief description of the destination..."
              />
            </div>

            {/* Flags */}
            <div className="md:col-span-2 flex flex-wrap gap-4">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={formState.is_domestic}
                  onChange={(e) => handleFieldChange('is_domestic', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                Domestic
              </label>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={formState.is_featured}
                  onChange={(e) => handleFieldChange('is_featured', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                Featured
              </label>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!deletingDestination) {
            setIsDeleteModalOpen(false);
            setDeleteTarget(null);
          }
        }}
        onConfirm={confirmDeleteDestination}
        confirming={deletingDestination}
        itemLabel={deleteTarget?.name || 'this destination'}
        title="Delete destination"
        message="This destination will be permanently removed from the catalog."
        confirmText="Delete destination"
      />
    </div>
  );
};

export default DestinationManagement;
