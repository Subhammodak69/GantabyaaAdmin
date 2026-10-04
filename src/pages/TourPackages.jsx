import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ManagementTable from '../component/common/ManagementTable';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Package2, Pencil, Trash2, Search, RefreshCw, Layers, Filter, X } from 'lucide-react';
import Modal from '../component/common/Modal';
import ConfirmDeleteModal from '../component/common/ConfirmDeleteModal';
import SelectField from '../component/common/SelectField';
import Pagination from '../component/common/PaginationComponent';
import ActionMenu from '../component/common/ActionMenu';
import { apiCall, handleApiError } from '../utils/apiCall';
import { getPackageVariantsPath } from '../utils/tourNavigation';

const packageTypes = ['DOMESTIC', 'INTERNATIONAL'];
const packageTypeOptions = packageTypes.map((type) => ({ value: type, label: type }));

const defaultForm = {
  tour_code: '',
  slug: '',
  title: '',
  destination_id: '',
  type: 'DOMESTIC',
  description: '',
  is_featured: false,
  is_active: true,
};

const TourPackages = () => {
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingPackage, setDeletingPackage] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [formState, setFormState] = useState(defaultForm);
  const [destinations, setDestinations] = useState([]);
  const [destLoading, setDestLoading] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const loadPackages = useCallback(async (page = currentPage, limit = itemsPerPage, destinationId = selectedDestination) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({ page: String(page), page_size: String(limit) });
      if (destinationId) {
        queryParams.set('destination_id', destinationId);
      }
      const response = await apiCall(`/api/v1/admin/tour-packages?${queryParams.toString()}`, 'GET');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.detail || 'Unable to fetch tour packages');
      }
      const data = Array.isArray(payload?.data) ? payload.data : [];
      setPackages(data);
      if (payload?.pagination) {
        setTotalItems(payload.pagination.total_items ?? data.length);
      } else {
        setTotalItems(data.length);
      }
    } catch (error) {
      handleApiError(error, 'Unable to fetch tour packages');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, selectedDestination]);

  // Load all destinations for the select dropdown (unpaged, large limit)
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
    loadPackages(currentPage, itemsPerPage);
  }, [loadPackages, currentPage, itemsPerPage]);

  useEffect(() => {
    loadDestinations();
  }, [loadDestinations]);

  const resetForm = () => {
    setFormState(defaultForm);
    setEditingPackage(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (row) => {
    setEditingPackage(row);
    setFormState({
      tour_code: row?.tour_code || '',
      slug: row?.slug || '',
      title: row?.title || '',
      destination_id: row?.destination_id || '',
      type: row?.type || 'DOMESTIC',
      description: row?.description || '',
      is_featured: Boolean(row?.is_featured),
      is_active: row?.is_active !== false,
    });
    setIsModalOpen(true);
  };

  // Navigates to the package's variants list. Selecting a package should
  // open the related variant catalog before the user can open any details.
  const goToPackageVariants = (row) => {
    navigate(getPackageVariantsPath(row.id), { state: { package: row } });
  };

  const handleFieldChange = (field, value) => {
    setFormState((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const destinationVal = formState.destination_id || '';
      const payload = {
        tour_code: formState.tour_code,
        slug: formState.slug,
        title: formState.title,
        destination_id: destinationVal,
        type: formState.type,
        description: formState.description,
        is_featured: Boolean(formState.is_featured),
        is_active: Boolean(formState.is_active),
      };

      const endpoint = editingPackage ? `/api/v1/admin/tour-packages/${editingPackage.id}` : '/api/v1/admin/tour-packages';
      const method = editingPackage ? 'PATCH' : 'POST';
      const response = await apiCall(endpoint, method, payload);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.message || result?.detail || 'Unable to save tour package');
      }

      toast.success(result?.message || (editingPackage ? 'Tour package updated successfully' : 'Tour package created successfully'));
      setIsModalOpen(false);
      resetForm();
      await loadPackages(currentPage, itemsPerPage);
    } catch (error) {
      handleApiError(error, editingPackage ? 'Unable to update package' : 'Unable to create package');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (row) => {
    setDeleteTarget(row);
    setIsDeleteModalOpen(true);
  };

  const confirmDeletePackage = async () => {
    if (!deleteTarget) return;
    setDeletingPackage(true);
    try {
      const response = await apiCall(`/api/v1/admin/tour-packages/${deleteTarget.id}`, 'DELETE');
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.message || result?.detail || 'Unable to delete tour package');
      }
      toast.success(result?.message || 'Tour package deleted successfully');
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      await loadPackages(currentPage, itemsPerPage);
    } catch (error) {
      handleApiError(error, 'Unable to delete tour package');
    } finally {
      setDeletingPackage(false);
    }
  };

  const filteredPackages = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return packages.filter((item) => {
      if (!term) return true;
      return [item.title, item.destination, item.tour_code, item.slug, item.type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [packages, searchTerm]);

  return (
    <div className=" space-y-3 pb-6">
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!deletingPackage) {
            setIsDeleteModalOpen(false);
            setDeleteTarget(null);
          }
        }}
        onConfirm={confirmDeletePackage}
        title="Delete tour package"
        itemLabel={deleteTarget?.title || deleteTarget?.tour_code || 'this tour package'}
        message="This will permanently delete the selected tour package from the catalog."
        confirming={deletingPackage}
      />

      <div className="px-2 text-slate-900 dark:text-slate-100">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mt-1 bg-gradient-to-r from-slate-900 via-violet-700 to-indigo-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent md:text-3xl dark:from-slate-100 dark:via-violet-300 dark:to-indigo-300">Tour Packages</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Create, update, and manage the main travel packages for your catalog.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Refresh tour packages"
              title="Refresh tour packages"
              onClick={() => loadPackages(currentPage, itemsPerPage, selectedDestination)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 sm:px-3 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              aria-label="Add package"
              title="Add package"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white p-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 sm:px-4"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add package</span>
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
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search packages..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition sm:px-4 ${
              selectedDestination
                ? 'border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-300'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filter</span>
            {selectedDestination && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
                1
              </span>
            )}
          </button>

          {(searchTerm || selectedDestination) && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedDestination('');
                setCurrentPage(1);
                loadPackages(1, itemsPerPage, '');
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-dashed border-gray-300 px-2.5 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 sm:px-3"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          <span className="hidden shrink-0 text-sm text-gray-500 dark:text-gray-400 sm:block">
            {totalItems} record{totalItems === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Filter Modal */}
      <Modal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="Filter Tour Packages"
        icon={Filter}
        size="sm"
        footer={(
          <div className="flex w-full gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedDestination('');
                setCurrentPage(1);
                loadPackages(1, itemsPerPage, '');
                setIsFilterOpen(false);
              }}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={() => setIsFilterOpen(false)}
              className="flex-1 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Apply
            </button>
          </div>
        )}
      >
        <div className="space-y-4 p-1">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Destination</label>
            <SelectField
              options={[{ value: '', label: 'All Destinations' }, ...destinations]}
              value={
                selectedDestination
                  ? destinations.find((d) => d.value === selectedDestination) || { value: selectedDestination, label: 'Selected Destination' }
                  : { value: '', label: 'All Destinations' }
              }
              onChange={(selected) => {
                const newDest = selected?.value || '';
                setSelectedDestination(newDest);
                setCurrentPage(1);
                loadPackages(1, itemsPerPage, newDest);
              }}
              isSearchable
              isLoading={destLoading}
              placeholder={destLoading ? 'Loading destinations...' : 'Filter by Destination'}
              menuPlacement="auto"
              isClearable={false}
              classNamePrefix="react-select"
            />
          </div>
        </div>
      </Modal>

      <div className="overflow-hidden md:rounded-2xl md:border md:border-gray-200 md:bg-white md:shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading packages...</div>
        ) : filteredPackages.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">No tour packages found.</div>
        ) : (
          <div className="overflow-x-auto">
            <ManagementTable><table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/70">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Package</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Destination</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Type</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredPackages.map((tour) => (
                  <tr
                    key={tour.id}
                    onClick={() => goToPackageVariants(tour)}
                    title="Click to view tour variants"
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300">
                          <Package2 className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">{tour.title}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{tour.tour_code || tour.slug || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">{tour.destination || 'N/A'}</td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                        {tour.type || 'DOMESTIC'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={[
                          'inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold',
                          tour.is_active === false
                            ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300',
                        ].join(' ')}>
                          {tour.is_active === false ? 'Inactive' : 'Active'}
                        </span>
                        {tour.is_featured && (
                          <span className="inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
                            Featured
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center justify-end">
                        <ActionMenu
                          menuId={tour.id}
                          actions={[
                            {
                              label: 'Manage Variants',
                              icon: <Layers className="h-4 w-4 text-violet-500" />,
                              onClick: () => navigate(getPackageVariantsPath(tour.id)),
                            },
                            {
                              label: 'Edit Package',
                              icon: <Pencil className="h-4 w-4 text-blue-500" />,
                              onClick: () => openEditModal(tour),
                            },
                            {
                              label: 'Delete Package',
                              icon: <Trash2 className="h-4 w-4 text-red-500" />,
                              className: 'text-red-600 hover:text-red-700 dark:text-red-400',
                              onClick: () => handleDelete(tour),
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

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        title={editingPackage ? 'Edit tour package' : 'Add tour package'}
        icon={Package2}
        size="lg"
        footer={(
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => {
              setIsModalOpen(false);
              resetForm();
            }} className="rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
              Cancel
            </button>
            <button type="submit" form="tour-package-form" disabled={saving} className="rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? 'Saving...' : editingPackage ? 'Save changes' : 'Create package'}
            </button>
          </div>
        )}
      >
        <form id="tour-package-form" onSubmit={handleSubmit} className="space-y-5 p-1">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Tour code</label>
              <input
                value={formState.tour_code}
                onChange={(event) => handleFieldChange('tour_code', event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                placeholder="e.g. COB-HT-101"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Slug</label>
              <input
                value={formState.slug}
                onChange={(event) => handleFieldChange('slug', event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                placeholder="darjeeling-hill-escape"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
              <input
                value={formState.title}
                onChange={(event) => handleFieldChange('title', event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                placeholder="Package title"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Destination</label>
              <SelectField
                options={destinations}
                value={destinations.find((d) => d.value === formState.destination_id) || null}
                onChange={(selected) => handleFieldChange('destination_id', selected?.value || '')}
                isSearchable
                isLoading={destLoading}
                placeholder={destLoading ? 'Loading destinations...' : 'Select destination'}
                menuPlacement="auto"
                classNamePrefix="react-select"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
              <SelectField
                options={packageTypeOptions}
                value={packageTypeOptions.find((option) => option.value === formState.type) || null}
                onChange={(selected) => handleFieldChange('type', selected?.value || '')}
                isSearchable={false}
                placeholder="Select type"
                menuPlacement="auto"
                classNamePrefix="react-select"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea
                value={formState.description}
                onChange={(event) => handleFieldChange('description', event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                placeholder="Package description"
              />
            </div>

            <div className="md:col-span-2 flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={formState.is_featured}
                  onChange={(event) => handleFieldChange('is_featured', event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                Featured
              </label>

              <label className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={formState.is_active}
                  onChange={(event) => handleFieldChange('is_active', event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                Active
              </label>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TourPackages;