import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ManagementTable from '../component/common/ManagementTable';
import toast from 'react-hot-toast';
import {
  Plus,
  Building2,
  Pencil,
  Trash2,
  Search,
  RefreshCw,
  MapPin,
  Phone,
  Filter,
  X,
  UploadCloud,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import Modal from '../component/common/Modal';
import ConfirmDeleteModal from '../component/common/ConfirmDeleteModal';
import SelectField from '../component/common/SelectField';
import Pagination from '../component/common/PaginationComponent';
import ActionMenu from '../component/common/ActionMenu';
import MediaPreviewModal from '../component/common/MediaPreviewModal';
import { apiCall, handleApiError, uploadFile } from '../utils/apiCall';
import { useEnums } from '../context/EnumsContext';

const defaultForm = {
  name: '',
  destination_id: '',
  category: 'BUDGET',
  address: '',
  contact: '',
  description: '',
  image: [],
  is_active: true,
};

const HotelManagement = () => {
  const { getEnumOptions } = useEnums();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryOptions = getEnumOptions('HotelCategory');
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHotel, setEditingHotel] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [destinationFilter, setDestinationFilter] = useState(() => searchParams.get('destination_id') || 'ALL');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingHotel, setDeletingHotel] = useState(false);

  // Form state
  const [formState, setFormState] = useState(defaultForm);
  const [destinations, setDestinations] = useState([]);
  const [destLoading, setDestLoading] = useState(false);

  // Image upload in modal
  const [uploadingImage, setUploadingImage] = useState(false);
  const [newImageAlt, setNewImageAlt] = useState('');

  // Destination map for fast lookup: id -> name
  const destinationMap = useMemo(() => {
    const map = {};
    destinations.forEach((d) => {
      map[d.value] = d.label;
    });
    return map;
  }, [destinations]);

  // Load Hotels from API
  const loadHotels = useCallback(
    async (page = currentPage, limit = itemsPerPage, destinationId = destinationFilter) => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({ page, page_size: limit });
        if (destinationId && destinationId !== 'ALL') {
          queryParams.set('destination_id', destinationId);
        }
        const response = await apiCall(`/api/v1/admin/hotels?${queryParams.toString()}`, 'GET');
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || payload?.detail || 'Unable to fetch hotels');
        }
        const data = Array.isArray(payload?.data) ? payload.data : [];
        setHotels(data);
        if (payload?.pagination) {
          setTotalItems(payload.pagination.total_items ?? data.length);
        } else {
          setTotalItems(data.length);
        }
      } catch (error) {
        handleApiError(error, 'Unable to fetch hotels');
      } finally {
        setLoading(false);
      }
    },
    [currentPage, destinationFilter, itemsPerPage]
  );

  // Load Destinations for Dropdowns
  const loadDestinations = useCallback(async () => {
    setDestLoading(true);
    try {
      const response = await apiCall('/api/v1/admin/destinations?page=1&page_size=100', 'GET');
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        const data = Array.isArray(payload?.data) ? payload.data : [];
        setDestinations(data.map((d) => ({ value: d.id, label: d.name })));
      }
    } catch {
      // silently ignore destination fetch errors
    } finally {
      setDestLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHotels(currentPage, itemsPerPage, destinationFilter);
  }, [loadHotels, currentPage, destinationFilter, itemsPerPage]);

  useEffect(() => {
    const nextDestination = searchParams.get('destination_id') || 'ALL';
    setDestinationFilter((current) => (current === nextDestination ? current : nextDestination));
  }, [searchParams]);

  useEffect(() => {
    loadDestinations();
  }, [loadDestinations]);

  const syncDestinationFilter = useCallback((nextValue) => {
    const normalized = nextValue && nextValue !== 'ALL' ? nextValue : 'ALL';
    setDestinationFilter(normalized);
    const nextParams = new URLSearchParams(searchParams);
    if (normalized === 'ALL') {
      nextParams.delete('destination_id');
    } else {
      nextParams.set('destination_id', normalized);
    }
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const resetForm = () => {
    setFormState(defaultForm);
    setEditingHotel(null);
    setNewImageAlt('');
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (row) => {
    setEditingHotel(row);
    // Normalize existing images array
    const existingImages = Array.isArray(row?.image)
      ? row.image.map((img, idx) => ({
          id: img?.id || `img-${Date.now()}-${idx}`,
          alt: img?.alt || row?.name || '',
          url: img?.url || '',
          type: img?.type || 'image',
          display_order: img?.display_order ?? idx + 1,
          additionalProperty: img?.additionalProperty || 'anything',
        }))
      : [];

    setFormState({
      name: row?.name || '',
      destination_id: row?.destination_id || '',
      category: row?.category || 'BUDGET',
      address: row?.address || '',
      contact: row?.contact || '',
      description: row?.description || '',
      image: existingImages,
      is_active: row?.is_active !== false,
    });
    setNewImageAlt('');
    setIsModalOpen(true);
  };

  const handleFieldChange = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  // Hotel gallery media handling
  const handleImageFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const res = await uploadFile(file);
      const url = res?.url || res?.data?.url || '';
      if (!url) throw new Error('Uploaded file URL not found in response');

      const nextOrder = (formState.image || []).length + 1;
      const mediaType = file.type?.startsWith('video/') ? 'video' : 'image';
      const newImg = {
        id: `img-${Date.now()}`,
        alt: newImageAlt.trim() || formState.name || file.name || 'Hotel media',
        url,
        type: mediaType,
        display_order: nextOrder,
        additionalProperty: 'anything',
      };

      setFormState((prev) => ({
        ...prev,
        image: [...(prev.image || []), newImg],
      }));
      setNewImageAlt('');
      toast.success('Media uploaded successfully');
    } catch (err) {
      toast.error(err?.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  const removeImage = (index) => {
    setFormState((prev) => {
      const updated = (prev.image || []).filter((_, idx) => idx !== index);
      return {
        ...prev,
        image: updated.map((img, idx) => ({ ...img, display_order: idx + 1 })),
      };
    });
  };

  const updateImageAlt = (index, alt) => {
    setFormState((prev) => {
      const updated = [...(prev.image || [])];
      if (updated[index]) {
        updated[index] = { ...updated[index], alt };
      }
      return { ...prev, image: updated };
    });
  };

  // Submit create or update
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formState.name.trim()) {
      toast.error('Please provide a hotel name');
      return;
    }
    if (uploadingImage) {
      toast.error('Please wait for the image upload to finish');
      return;
    }
    if (!formState.image?.some((image) => image?.url)) {
      toast.error('Please upload at least one hotel image or video');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formState.name.trim(),
        destination_id: formState.destination_id || '',
        category: formState.category || 'BUDGET',
        address: formState.address.trim(),
        contact: formState.contact.trim(),
        description: formState.description.trim(),
        image: (formState.image || []).map((img, idx) => ({
          id: img.id || `img-${idx + 1}`,
          alt: img.alt || '',
          url: img.url || '',
          type: img.type || 'image',
          display_order: img.display_order ?? idx + 1,
          additionalProperty: img.additionalProperty || 'anything',
        })),
      };

      const endpoint = editingHotel
        ? `/api/v1/admin/hotels/${editingHotel.id}`
        : '/api/v1/admin/hotels';
      const method = editingHotel ? 'PATCH' : 'POST';

      const response = await apiCall(endpoint, method, payload);
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result?.message || result?.detail || 'Unable to save hotel');
      }

      toast.success(
        result?.message ||
          (editingHotel ? 'Hotel updated successfully' : 'Hotel created successfully')
      );
      setIsModalOpen(false);
      resetForm();
      await loadHotels(currentPage, itemsPerPage);
    } catch (error) {
      handleApiError(error, editingHotel ? 'Unable to update hotel' : 'Unable to create hotel');
    } finally {
      setSaving(false);
    }
  };

  // Toggle active status via PATCH
  const handleToggleActive = async (hotel) => {
    try {
      const newStatus = !hotel.is_active;
      const response = await apiCall(`/api/v1/admin/hotels/${hotel.id}`, 'PATCH', {
        name: hotel.name,
        destination_id: hotel.destination_id,
        category: hotel.category,
        address: hotel.address,
        contact: hotel.contact,
        description: hotel.description,
        image: hotel.image || [],
        is_active: newStatus,
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.message || result?.detail || 'Failed to update status');
      }

      toast.success(`Hotel ${newStatus ? 'activated' : 'deactivated'} successfully`);
      setHotels((prev) =>
        prev.map((h) => (h.id === hotel.id ? { ...h, is_active: newStatus } : h))
      );
    } catch (error) {
      handleApiError(error, 'Unable to update status');
    }
  };

  // Delete hotel
  const handleDelete = (row) => {
    setDeleteTarget(row);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteHotel = async () => {
    if (!deleteTarget) return;
    setDeletingHotel(true);
    try {
      const response = await apiCall(`/api/v1/admin/hotels/${deleteTarget.id}`, 'DELETE');
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.message || result?.detail || 'Unable to delete hotel');
      }
      toast.success(result?.message || 'Hotel deleted successfully');
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      await loadHotels(currentPage, itemsPerPage);
    } catch (error) {
      handleApiError(error, 'Unable to delete hotel');
    } finally {
      setDeletingHotel(false);
    }
  };

  // Filtered hotels based on search & selectors
  const filteredHotels = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return hotels.filter((item) => {
      const matchesSearch =
        !term ||
        [item.name, item.address, item.contact, item.description, item.category]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term);

      const matchesCategory =
        categoryFilter === 'ALL' || item.category?.toUpperCase() === categoryFilter.toUpperCase();

      const matchesDest =
        destinationFilter === 'ALL' || item.destination_id === destinationFilter;

      return matchesSearch && matchesCategory && matchesDest;
    });
  }, [hotels, searchTerm, categoryFilter, destinationFilter]);

  const categoryBadgeColors = {
    BUDGET: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    STANDARD: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    DELUXE: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
    LUXURY: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
    PREMIUM: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    RESORT: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
    HERITAGE: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  };

  return (
    <div className="space-y-3 pb-6">
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!deletingHotel) {
            setIsDeleteModalOpen(false);
            setDeleteTarget(null);
          }
        }}
        onConfirm={confirmDeleteHotel}
        title="Delete hotel"
        itemLabel={deleteTarget?.name || 'this hotel'}
        message="This will permanently remove the selected hotel from the system."
        confirming={deletingHotel}
      />

      {/* Header */}
      <div className="px-2 text-slate-900 dark:text-slate-100">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mt-1 bg-gradient-to-r from-slate-900 via-indigo-600 to-violet-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent md:text-3xl dark:from-slate-100 dark:via-indigo-300 dark:to-violet-300">
              Hotel Management
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Manage hotels, resorts, categories, gallery photos, and destination assignments.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Refresh hotels"
              title="Refresh hotels"
              onClick={() => loadHotels(currentPage, itemsPerPage)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 sm:px-3 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              aria-label="Add hotel"
              title="Add hotel"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white p-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 shadow-xs border border-gray-200 sm:px-4 dark:border-gray-700 dark:bg-gray-800 dark:text-indigo-400 dark:hover:bg-gray-700"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add hotel</span>
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
              placeholder="Search hotels..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition sm:px-4 ${
              categoryFilter !== 'ALL' || destinationFilter !== 'ALL'
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filter</span>
            {(categoryFilter !== 'ALL' || destinationFilter !== 'ALL') && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {[categoryFilter !== 'ALL', destinationFilter !== 'ALL'].filter(Boolean).length}
              </span>
            )}
          </button>

          {(searchTerm || categoryFilter !== 'ALL' || destinationFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('ALL');
                syncDestinationFilter('ALL');
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-dashed border-gray-300 px-2.5 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 sm:px-3"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          <span className="hidden shrink-0 text-sm text-gray-500 dark:text-gray-400 sm:block">
            {filteredHotels.length} record{filteredHotels.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Filter Modal */}
      <Modal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="Filter Hotels"
        icon={Filter}
        size="sm"
        footer={(
          <div className="flex w-full gap-3">
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('ALL');
                syncDestinationFilter('ALL');
                setIsFilterOpen(false);
              }}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={() => setIsFilterOpen(false)}
              className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Apply
            </button>
          </div>
        )}
      >
        <div className="space-y-4 p-1">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
            <SelectField
              options={[{ value: 'ALL', label: 'All Categories' }, ...categoryOptions]}
              value={[{ value: 'ALL', label: 'All Categories' }, ...categoryOptions].find((o) => o.value === categoryFilter)}
              onChange={(sel) => setCategoryFilter(sel?.value || 'ALL')}
              isSearchable={false}
              placeholder="Filter category"
              menuPlacement="auto"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Destination</label>
            <SelectField
              options={[{ value: 'ALL', label: 'All Destinations' }, ...destinations]}
              value={[{ value: 'ALL', label: 'All Destinations' }, ...destinations].find((d) => d.value === destinationFilter)}
              onChange={(sel) => syncDestinationFilter(sel?.value || 'ALL')}
              isLoading={destLoading}
              placeholder="Filter destination"
              menuPlacement="auto"
            />
          </div>
        </div>
      </Modal>

      {/* Hotel Cards / Table */}
      <div className="overflow-hidden md:rounded-2xl md:border md:border-gray-200 md:bg-white md:shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">
            Loading hotels...
          </div>
        ) : filteredHotels.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-400">
              <Building2 className="h-6 w-6" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchTerm || categoryFilter !== 'ALL' || destinationFilter !== 'ALL'
                ? 'No hotels match your filters.'
                : 'No hotels registered yet.'}
            </p>
            {!searchTerm && categoryFilter === 'ALL' && destinationFilter === 'ALL' && (
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Add your first hotel
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <ManagementTable><table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/70">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Hotel & Gallery</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Category</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Destination</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Contact & Address</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredHotels.map((hotel) => {
                  const images = Array.isArray(hotel.image) ? hotel.image : [];
                  const primaryMedia = images[0];
                  const primaryImg = primaryMedia?.url;
                  const destName = destinationMap[hotel.destination_id] || '—';
                  const badgeClass =
                    categoryBadgeColors[hotel.category?.toUpperCase()] ||
                    'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';

                  return (
                    <tr
                      key={hotel.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      {/* Hotel Info + Primary Image */}
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-3">
                          {primaryImg ? (
                            <div className="relative group shrink-0">
                              <MediaPreviewModal
                                src={primaryImg}
                                alt={hotel.name}
                                type={primaryMedia?.type || 'image'}
                                thumbnailClassName="h-12 w-12 rounded-xl object-cover ring-2 ring-indigo-100 dark:ring-indigo-950"
                                className="block"
                              />
                              {images.length > 1 && (
                                <span className="absolute bottom-0.5 right-0.5 rounded-md bg-black/70 px-1 py-0.2 text-[9px] font-medium text-white">
                                  +{images.length - 1}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-400">
                              <Building2 className="h-5 w-5" />
                            </div>
                          )}

                          <div className="min-w-0">
                            <h4
                              className="font-semibold text-gray-900 dark:text-white truncate max-w-xs"
                            >
                              {hotel.name || 'Untitled Hotel'}
                            </h4>
                            {hotel.description && (
                              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500 line-clamp-1 max-w-sm">
                                {hotel.description}
                              </p>
                            )}
                            <div className="mt-0.5 text-[11px] text-gray-400">
                              {images.length} {images.length === 1 ? 'media item' : 'media items'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}
                        >
                          {hotel.category || 'BUDGET'}
                        </span>
                      </td>

                      {/* Destination */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 text-gray-800 dark:text-gray-200">
                          <MapPin className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                          <span className="text-sm font-medium">{destName}</span>
                        </div>
                      </td>

                      {/* Contact & Address */}
                      <td className="px-4 py-4 max-w-xs">
                        {hotel.contact && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 font-medium">
                            <Phone className="h-3 w-3 text-emerald-500 shrink-0" />
                            <span className="truncate">{hotel.contact}</span>
                          </div>
                        )}
                        {hotel.address ? (
                          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500 line-clamp-1">
                            {hotel.address}
                          </p>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No address provided</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(hotel)}
                          className={[
                            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition cursor-pointer',
                            hotel.is_active === false
                              ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300',
                          ].join(' ')}
                          title="Click to toggle status"
                        >
                          {hotel.is_active === false ? (
                            <>
                              <XCircle className="h-3 w-3" /> Inactive
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3 w-3" /> Active
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <ActionMenu
                          menuId={hotel.id}
                          actions={[
                            {
                              label: 'Edit Hotel',
                              icon: <Pencil className="h-4 w-4 text-blue-500" />,
                              onClick: () => openEditModal(hotel),
                            },
                            {
                              label: 'Delete Hotel',
                              icon: <Trash2 className="h-4 w-4 text-red-500" />,
                              onClick: () => handleDelete(hotel),
                              danger: true,
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></ManagementTable>
          </div>
        )}

      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={(page) => setCurrentPage(page)}
        onLimitChange={(size) => {
          setItemsPerPage(size);
          setCurrentPage(1);
        }}
      />

      {/* Create / Edit Modal using Modal's standard footer prop */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          if (!saving) {
            setIsModalOpen(false);
            resetForm();
          }
        }}
        title={editingHotel ? 'Edit Hotel' : 'Add New Hotel'}
        icon={Building2}
        size="2xl"
        footer={(
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}
              className="rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="hotel-form"
              disabled={saving || uploadingImage}
              className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 transition"
            >
              {uploadingImage ? 'Uploading image...' : saving ? 'Saving...' : editingHotel ? 'Save changes' : 'Create hotel'}
            </button>
          </div>
        )}
      >
        <form id="hotel-form" onSubmit={handleSubmit} className="space-y-4 p-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hotel Name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Hotel name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formState.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder="e.g. Grand Palace Resort"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
            </div>

            {/* Destination */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Destination</label>
              <SelectField
                options={destinations}
                isLoading={destLoading}
                placeholder={destLoading ? 'Loading destinations...' : 'Select destination'}
                value={destinations.find((d) => d.value === formState.destination_id) || null}
                onChange={(selected) => handleFieldChange('destination_id', selected ? selected.value : '')}
                isClearable
                menuPlacement="auto"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
              <SelectField
                options={categoryOptions}
                value={categoryOptions.find((c) => c.value === formState.category) || null}
                onChange={(selected) => handleFieldChange('category', selected?.value || 'BUDGET')}
                isSearchable={false}
                placeholder="Select category"
                menuPlacement="auto"
              />
            </div>

            {/* Contact Phone / Email */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Contact info</label>
              <input
                type="text"
                value={formState.contact}
                onChange={(e) => handleFieldChange('contact', e.target.value)}
                placeholder="e.g. +91 9876543210 / info@hotel.com"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Full address</label>
            <textarea
              rows={2}
              value={formState.address}
              onChange={(e) => handleFieldChange('address', e.target.value)}
              placeholder="e.g. Mall Road, Near Clock Tower, Manali, HP 175131"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Description & amenities</label>
            <textarea
              rows={3}
              value={formState.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder="Describe room amenities, dining, location perks, view, check-in policy..."
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>

          {/* Status Toggle (For Edit) */}
          {/* Image Gallery Management */}
          <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Hotel gallery ({formState.image?.length || 0}) <span className="text-red-500">*</span>
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  At least one image or video is required. Add photos and videos representing the property.
                </p>
              </div>
            </div>

            {/* Quick Upload Input */}
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <input
                type="text"
                placeholder="Optional caption / alt text..."
                value={newImageAlt}
                onChange={(e) => setNewImageAlt(e.target.value)}
                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
              <label
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-medium text-indigo-600 cursor-pointer hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300 transition ${
                  uploadingImage ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <UploadCloud className="h-4 w-4" />
                {uploadingImage ? 'Uploading...' : 'Upload media'}
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleImageFileUpload}
                  disabled={uploadingImage}
                  className="hidden"
                />
              </label>
            </div>

            {/* Existing Images Grid */}
            {formState.image && formState.image.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-56 overflow-y-auto p-1">
                {formState.image.map((img, idx) => (
                  <div
                    key={img.id || idx}
                    className="group relative rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800 shadow-xs"
                  >
                    <MediaPreviewModal
                      src={img.url}
                      alt={img.alt || `Hotel ${idx + 1}`}
                      type={img.type || 'image'}
                      thumbnailClassName="h-24 w-full object-cover"
                      className="block w-full"
                    />
                    <div className="space-y-1 p-1.5">
                      <input
                        type="text"
                        value={img.alt || ''}
                        onChange={(e) => updateImageAlt(idx, e.target.value)}
                        placeholder="Caption/Alt"
                        className="w-full text-[11px] rounded px-1 py-0.5 border border-transparent hover:border-gray-300 focus:border-indigo-500 bg-transparent text-gray-700 dark:text-gray-300 outline-none"
                      />
                      <span className="inline-flex rounded-md bg-gray-100 px-2 py-1 text-[10px] font-semibold capitalize text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {img.type === 'video' ? 'Video' : 'Image'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 rounded-full bg-red-600/90 text-white p-1 hover:bg-red-700 transition shadow-sm"
                      title="Remove media"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <span className="absolute top-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[9px] font-medium text-white">
                      #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 p-4 text-center text-xs text-gray-400">
                No media added yet. Click &quot;Upload media&quot; to add hotel photos or videos.
              </div>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default HotelManagement;
