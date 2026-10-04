import React, { useEffect, useState, useCallback } from 'react';
import ManagementTable from '../component/common/ManagementTable';
import toast from 'react-hot-toast';
import { Plus, UserCog, Pencil, Trash2, Mail, Phone, ShieldCheck, Search, RefreshCw, KeyRound, AlertTriangle, Filter, X } from 'lucide-react';
import Modal from '../component/common/Modal';
import DragDropUpload from '../component/common/DragDropUpload';
import MediaPreviewModal from '../component/common/MediaPreviewModal';
import SelectField from '../component/common/SelectField';
import Pagination from '../component/common/PaginationComponent';
import ActionMenu from '../component/common/ActionMenu';
import { apiCall, handleApiError } from '../utils/apiCall';
import { useAuth } from '../context/AuthContext';

const roleOptions = ['ADMIN','STAFF'];
const roleSelectOptions = roleOptions.map((option) => ({ value: option, label: option }));
const staffRoleSelectOptions = roleOptions
  .map((option) => ({ value: option, label: option }));

const defaultForm = {
  name: '',
  email: '',
  mobile: '',
  role: 'STAFF',
  profile_pic: '',
  is_active: true,
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return value;
  }
};

const StaffManagement = () => {
  const { user } = useAuth();
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [formState, setFormState] = useState(defaultForm);
  const [serverPagination, setServerPagination] = useState(null);

  // Delete modal with OTP states
  const [deletingStaff, setDeletingStaff] = useState(null);
  const [deleteIdentifier, setDeleteIdentifier] = useState('');
  const [deleteOtp, setDeleteOtp] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  useEffect(() => {
    let timer;
    if (otpCooldown > 0) {
      timer = setInterval(() => {
        setOtpCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpCooldown]);

  const loadStaff = useCallback(async (page = currentPage, limit = itemsPerPage) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (page) params.set('page', page);
      if (limit) params.set('page_size', limit);

      const url = `/api/v1/admin/account${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await apiCall(url, 'GET');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.detail || 'Failed to load staff');
      }
      const records = Array.isArray(payload?.data) ? payload.data : [];
      setStaffList(records);
      if (payload?.pagination) {
        setServerPagination(payload.pagination);
      }
    } catch (error) {
      handleApiError(error, 'Unable to fetch staff records');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage]);

  useEffect(() => {
    loadStaff(currentPage, itemsPerPage);
  }, [loadStaff, currentPage, itemsPerPage]);

  const resetForm = () => {
    setFormState(defaultForm);
    setEditingStaff(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (staff) => {
    setEditingStaff(staff);
    setFormState({
      name: staff?.name || '',
      email: staff?.email || '',
      mobile: staff?.mobile || '',
      role: staff?.role || 'STAFF',
      profile_pic: staff?.profile_pic || '',
      is_active: staff?.is_active !== false,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    resetForm();
    setIsModalOpen(false);
  };

  const handleFieldChange = (field, value) => {
    setFormState((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    const payload = {
      name: formState.name,
      email: formState.email,
      mobile: formState.mobile.trim() || null,
      role: formState.role,
      profile_pic: formState.profile_pic,
      is_active: formState.is_active,
    };

    try {
      const endpoint = editingStaff ? `/api/v1/admin/account/${editingStaff.id}` : '/api/v1/admin/account';
      const method = editingStaff ? 'PATCH' : 'POST';
      const response = await apiCall(endpoint, method, payload);
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result?.message || result?.detail || 'Unable to save staff');
      }

      toast.success(result?.message || (editingStaff ? 'Staff updated successfully' : 'Staff created successfully'));
      closeModal();
      await loadStaff(currentPage, itemsPerPage);
    } catch (error) {
      handleApiError(error, editingStaff ? 'Unable to update staff' : 'Unable to create staff');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = (staff) => {
    setDeletingStaff(staff);
    const defaultId = user?.email || user?.mobile || staff?.email || staff?.mobile || '';
    setDeleteIdentifier(defaultId);
    setDeleteOtp('');
    setOtpCooldown(0);
    setIsDeleteModalOpen(true);
  };

  const handleRequestDeleteOtp = async () => {
    const id = deleteIdentifier.trim();
    if (!id) {
      toast.error('Please enter an identifier to receive the OTP');
      return;
    }
    setOtpSending(true);
    try {
      const response = await apiCall('/api/v1/admin/auth/otp/request', 'POST', {
        identifier: id,
        purpose: 'LOGIN',
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        toast.success(data?.message || 'OTP sent successfully!');
        setOtpCooldown(60);
      } else {
        toast.error(data?.detail || data?.message || 'Failed to send OTP');
      }
    } catch (err) {
      handleApiError(err, 'Failed to request OTP');
    } finally {
      setOtpSending(false);
    }
  };

  const handleConfirmDelete = async (e) => {
    if (e) e.preventDefault();
    if (!deletingStaff) return;
    setDeleting(true);

    try {
      const response = await apiCall(`/api/v1/admin/account/${deletingStaff.id}`, 'DELETE', {
        identifier: deleteIdentifier.trim(),
        otp: deleteOtp.trim(),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.message || result?.detail || 'Unable to delete staff');
      }
      toast.success(result?.message || 'Staff deleted successfully');
      setIsDeleteModalOpen(false);
      setDeletingStaff(null);
      await loadStaff(currentPage, itemsPerPage);
    } catch (error) {
      handleApiError(error, 'Unable to delete staff');
    } finally {
      setDeleting(false);
    }
  };

  const filteredStaff = staffList.filter((staff) => {
    if (roleFilter !== 'ALL' && staff?.role !== roleFilter) return false;
    if (statusFilter === 'ACTIVE' && !staff?.is_active) return false;
    if (statusFilter === 'INACTIVE' && staff?.is_active) return false;
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    return [staff?.name, staff?.email, staff?.mobile, staff?.role]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(term);
  });

  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedStaff = filteredStaff.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className=" space-y-3 pb-6">
      <div className="px-2 text-slate-900 dark:text-slate-100">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mt-1 bg-gradient-to-r from-slate-900 via-violet-700 to-indigo-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent md:text-3xl dark:from-slate-100 dark:via-violet-300 dark:to-indigo-300">Staff Management</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">View, invite, and manage your admin and operations team members.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Refresh staff"
              title="Refresh staff"
              onClick={loadStaff}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 sm:px-3 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              aria-label="Add staff"
              title="Add staff"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white p-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 sm:px-4"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add staff</span>
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
              placeholder="Search staff by name, email, mobile, role..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition sm:px-4 ${
              roleFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filter</span>
            {(roleFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {[roleFilter !== 'ALL', statusFilter !== 'ALL'].filter(Boolean).length}
              </span>
            )}
          </button>

          {(searchTerm || roleFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setRoleFilter('ALL');
                setStatusFilter('ALL');
                setCurrentPage(1);
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-dashed border-gray-300 px-2.5 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 sm:px-3"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          <span className="hidden shrink-0 text-sm text-gray-500 dark:text-gray-400 sm:block">
            {filteredStaff.length} record{filteredStaff.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Filter Modal */}
      <Modal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="Filter Staff"
        icon={Filter}
        size="sm"
        footer={(
          <div className="flex w-full gap-3">
            <button
              type="button"
              onClick={() => {
                setRoleFilter('ALL');
                setStatusFilter('ALL');
                setCurrentPage(1);
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
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
            <SelectField
              options={[{ value: 'ALL', label: 'All Roles' }, ...roleSelectOptions]}
              value={[{ value: 'ALL', label: 'All Roles' }, ...roleSelectOptions].find((r) => r.value === roleFilter)}
              onChange={(sel) => {
                setRoleFilter(sel?.value || 'ALL');
                setCurrentPage(1);
              }}
              isSearchable={false}
              placeholder="Filter by role"
              menuPlacement="auto"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
            <div className="flex overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
              {[
                ['ALL', 'All'],
                ['ACTIVE', 'Active'],
                ['INACTIVE', 'Inactive'],
              ].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setStatusFilter(val);
                    setCurrentPage(1);
                  }}
                  className={`flex-1 py-2 text-xs font-semibold transition ${
                    statusFilter === val
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <div className="overflow-hidden md:rounded-2xl md:border md:border-gray-200 md:bg-white md:shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-sm text-gray-500">Loading staff...</div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">No staff records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <ManagementTable><table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/70">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Staff</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Contact</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Role</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Status</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Last Login</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {staff.profile_pic ? (
                          <MediaPreviewModal
                            src={staff.profile_pic}
                            alt={staff.name}
                            type="image"
                            thumbnailClassName="h-10 w-10 rounded-full object-cover ring-2 ring-indigo-100 dark:ring-indigo-950"
                            className="block"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-sm font-bold text-white">
                            {staff.name?.[0]?.toUpperCase() || 'S'}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">{staff.name || 'Unnamed staff'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{staff.user_code || staff.id}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                        <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {staff.email || 'N/A'}</div>
                        <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {staff.mobile || 'N/A'}</div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                        {staff.role || 'STAFF'}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <span className={[
                        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                        staff.is_active === false
                          ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300',
                      ].join(' ')}>
                        {staff.is_active === false ? 'Inactive' : 'Active'}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-xs text-gray-500 dark:text-gray-400">
                      <div>{formatDate(staff.last_login)}</div>
                      {staff.created_at && (
                        <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                          Created: {formatDate(staff.created_at)}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end">
                        <ActionMenu
                          menuId={staff.id}
                          actions={[
                            {
                              label: 'Edit Staff',
                              icon: <Pencil className="h-4 w-4 text-blue-500" />,
                              onClick: () => openEditModal(staff),
                            },
                            {
                              label: 'Delete Staff',
                              icon: <Trash2 className="h-4 w-4 text-red-500" />,
                              className: 'text-red-600 hover:text-red-700 dark:text-red-400',
                              onClick: () => openDeleteModal(staff),
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
      {(serverPagination ? serverPagination.total_items : filteredStaff.length) > 0 && (
        <Pagination
          currentPage={safePage}
          totalItems={serverPagination ? serverPagination.total_items : filteredStaff.length}
          itemsPerPage={itemsPerPage}
          onPageChange={(page) => {
            setCurrentPage(page);
            loadStaff(page, itemsPerPage);
          }}
          onLimitChange={(limit) => {
            setItemsPerPage(limit);
            setCurrentPage(1);
            loadStaff(1, limit);
          }}
        />
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingStaff ? 'Edit staff member' : 'Add new staff member'}
        icon={UserCog}
        size="lg"
        footer={(
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={closeModal} className="rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
              Cancel
            </button>
            <button type="submit" form="staff-form" disabled={saving} className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? 'Saving...' : editingStaff ? 'Save changes' : 'Create staff'}
            </button>
          </div>
        )}
      >
        <form id="staff-form" onSubmit={handleSubmit} className="space-y-5 p-1">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Full name</label>
              <input
                value={formState.name}
                onChange={(event) => handleFieldChange('name', event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                placeholder="Enter full name"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
              <SelectField
                options={staffRoleSelectOptions}
                value={staffRoleSelectOptions.find((option) => option.value === formState.role) || null}
                onChange={(selected) => handleFieldChange('role', selected?.value || '')}
                isSearchable={false}
                placeholder="Select role"
                menuPlacement="auto"
                classNamePrefix="react-select"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <input
                type="email"
                value={formState.email}
                onChange={(event) => handleFieldChange('email', event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                placeholder="Enter email"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Mobile</label>
              <input
                value={formState.mobile}
                onChange={(event) => handleFieldChange('mobile', event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                placeholder="Enter mobile"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <ShieldCheck className="h-4 w-4" />
                Status
              </label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={formState.is_active}
                  onChange={(event) => handleFieldChange('is_active', event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Active account
              </label>
            </div>

            <div className="md:col-span-2">
              <DragDropUpload
                label="Profile picture"
                value={formState.profile_pic}
                onChange={(url) => handleFieldChange('profile_pic', url)}
                helperText="Recommended: square image, JPG or PNG"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Staff Confirmation Modal with OTP */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!deleting) {
            setIsDeleteModalOpen(false);
            setDeletingStaff(null);
          }
        }}
        title="Delete Staff Member"
        icon={Trash2}
        size="md"
        footer={(
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setDeletingStaff(null);
              }}
              disabled={deleting}
              className="rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="delete-staff-form"
              disabled={deleting}
              className="rounded-2xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60 shadow-md shadow-rose-500/20"
            >
              {deleting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  <span>Confirm Delete</span>
                </>
              )}
            </button>
          </div>
        )}
      >
        <form id="delete-staff-form" onSubmit={handleConfirmDelete} className="space-y-4 p-1">
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
            <p className="font-semibold text-sm mb-1 text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              Permanently delete account?
            </p>
            <p>
              You are about to delete <span className="font-bold">{deletingStaff?.name || 'this staff member'}</span> ({deletingStaff?.role || 'STAFF'} &bull; {deletingStaff?.email || deletingStaff?.mobile}). This action cannot be undone.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
              Admin Identifier (Email / Mobile)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={deleteIdentifier}
                onChange={(e) => setDeleteIdentifier(e.target.value)}
                placeholder="Enter email or mobile"
                required
                className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
              <button
                type="button"
                onClick={handleRequestDeleteOtp}
                disabled={otpSending || otpCooldown > 0 || !deleteIdentifier.trim()}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1.5"
              >
                {otpSending ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {otpCooldown > 0 ? `${otpCooldown}s` : 'Send OTP'}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              Security requirement: Deletion requires OTP verification sent to an authorized administrator.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
              OTP Verification Code
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={deleteOtp}
                onChange={(e) => setDeleteOtp(e.target.value)}
                placeholder="Enter 6-digit OTP passcode"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-mono tracking-widest text-gray-700 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default StaffManagement;
