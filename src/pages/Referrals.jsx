import React, { useEffect, useState, useCallback } from 'react';
import ManagementTable from '../component/common/ManagementTable';
import toast from 'react-hot-toast';
import {
  Gift,
  RefreshCw,
  Edit,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Clock,
  User,
  ChevronRight,
  Filter,
  Search,
  X,
} from 'lucide-react';
import ReferralTabs from '../component/referrals/ReferralTabs';
import Modal from '../component/common/Modal';
import SelectField from '../component/common/SelectField';
import Pagination from '../component/common/PaginationComponent';
import ActionMenu from '../component/common/ActionMenu';
import { apiCall, handleApiError } from '../utils/apiCall';
import { sanitizeNumericInput } from '../utils/inputValidation';
import { useEnums } from '../context/EnumsContext';

const STATUS_STYLES = {
  PENDING: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
    label: 'Pending',
    icon: Clock,
  },
  REGISTERED: {
    badge: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800',
    label: 'Registered',
    icon: Clock,
  },
  BOOKING_COMPLETED: {
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800',
    label: 'Booking Completed',
    icon: CheckCircle2,
  },
  REWARD_ELIGIBLE: {
    badge: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800',
    label: 'Reward Eligible',
    icon: CheckCircle2,
  },
  REWARD_APPROVED: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
    label: 'Reward Approved',
    icon: CheckCircle2,
  },
  REWARD_CREDITED: {
    badge: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
    label: 'Reward Credited',
    icon: CheckCircle2,
  },
  EXPIRED: {
    badge: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    label: 'Expired',
    icon: Clock,
  },
  CANCELLED: {
    badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
    label: 'Canceled',
    icon: XCircle,
  },
  BLOCKED: {
    badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
    label: 'Blocked',
    icon: ShieldAlert,
  },
};

const formatDate = (val) => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return val;
  }
};

const formatCurrency = (val) => {
  if (val === null || val === undefined || val === '') return '—';
  const num = Number(val);
  if (isNaN(num)) return val;
  return `₹${num.toLocaleString('en-IN')}`;
};

const Referrals = () => {
  const { getEnumOptions } = useEnums();
  const referralStatusOptions = getEnumOptions('ReferralStatus');
  const statusFilterOptions = [{ value: '', label: 'All Statuses' }, ...referralStatusOptions];
  const updateStatusOptions = referralStatusOptions.filter((option) => ['REWARD_APPROVED', 'CANCELLED', 'BLOCKED'].includes(option.value));
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  // Filter
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Update modal state
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState('REWARD_APPROVED');
  const [rewardAmount, setRewardAmount] = useState('');
  const [notes, setNotes] = useState('');

  // Details view modal
  const [detailsReferral, setDetailsReferral] = useState(null);

  const fetchReferrals = useCallback(async (page = currentPage, limit = pageSize, status = statusFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (page) params.set('page', page);
      if (limit) params.set('page_size', limit);
      if (status) params.set('status', status);

      const url = `/api/v1/admin/referrals${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await apiCall(url, 'GET');
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message || payload?.detail || 'Failed to load referrals');
      }

      setReferrals(Array.isArray(payload?.data) ? payload.data : []);
      if (payload?.pagination) {
        setTotalItems(payload.pagination.total_items ?? (payload?.data?.length || 0));
      } else {
        setTotalItems(payload?.data?.length || 0);
      }
    } catch (error) {
      handleApiError(error, 'Unable to fetch referrals');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, statusFilter]);

  useEffect(() => {
    fetchReferrals(currentPage, pageSize, statusFilter);
  }, [fetchReferrals, currentPage, pageSize, statusFilter]);

  const handleOpenUpdateModal = (item) => {
    setSelectedReferral(item);
    // Default update status option
    const initialStatus = updateStatusOptions.some((opt) => opt.value === item?.status)
      ? item.status
      : 'REWARD_APPROVED';
    setUpdateStatus(initialStatus);
    setRewardAmount(
      item?.approved_reward_amount !== undefined && item?.approved_reward_amount !== null && item?.approved_reward_amount !== ''
        ? item.approved_reward_amount
        : item?.default_reward_amount || ''
    );
    setNotes(item?.notes || '');
    setIsUpdateModalOpen(true);
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReferral?.id) return;

    setSaving(true);
    try {
      const payload = {
        status: updateStatus,
        reward_amount: rewardAmount === '' ? 0 : Number(rewardAmount),
        notes: notes.trim(),
      };

      const response = await apiCall(
        `/api/v1/admin/referrals/${selectedReferral.id}`,
        'PATCH',
        payload
      );

      const resJson = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(resJson?.message || resJson?.detail || 'Failed to update referral status');
      }

      toast.success(resJson?.message || 'Referral status updated successfully');
      setIsUpdateModalOpen(false);
      setSelectedReferral(null);
      await fetchReferrals(currentPage, pageSize, statusFilter);
    } catch (error) {
      handleApiError(error, 'Unable to update referral');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status) => {
    const conf = STATUS_STYLES[status] || {
      badge: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
      label: status || 'UNKNOWN',
    };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${conf.badge}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
        {conf.label}
      </span>
    );
  };

  const filteredReferrals = referrals.filter((item) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    const searchableFields = [
      item?.referrer_name,
      item?.referrer_code,
      item?.referrer_id,
      item?.referred_customer_name,
      item?.referred_customer_code,
      item?.referred_customer_id,
      item?.notes,
    ];
    return searchableFields.some((value) => String(value || '').toLowerCase().includes(q));
  });

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="px-1">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="bg-gradient-to-r from-slate-900 via-blue-700 to-indigo-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent md:text-3xl dark:from-slate-100 dark:via-blue-300 dark:to-indigo-300">
              Referral Management
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Track customer referrals, reward payouts, conversion stages, and referral configurations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Refresh referrals"
              onClick={() => fetchReferrals(currentPage, pageSize, statusFilter)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:px-3 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition"
              title="Refresh referrals list"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <ReferralTabs activeTab="referrals" />

      {/* Search & Filter Toolbar */}
      <div className="px-1">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search referrals by name, code, ID, or notes..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition sm:px-4 ${
              statusFilter !== ''
                ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filter</span>
            {statusFilter !== '' && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                1
              </span>
            )}
          </button>

          {(searchTerm || statusFilter !== '') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setCurrentPage(1);
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-dashed border-gray-300 px-2.5 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 sm:px-3"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          <span className="hidden shrink-0 text-sm text-gray-500 dark:text-gray-400 sm:block">
            {filteredReferrals.length} record{filteredReferrals.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Filter Modal */}
      <Modal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="Filter Referrals"
        icon={Filter}
        size="sm"
        footer={(
          <div className="flex w-full gap-3">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('');
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
              className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        )}
      >
        <div className="space-y-4 p-1">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
            <SelectField
              options={statusFilterOptions}
              value={statusFilterOptions.find((opt) => opt.value === statusFilter) || statusFilterOptions[0]}
              onChange={(opt) => {
                setStatusFilter(opt ? opt.value : '');
                setCurrentPage(1);
              }}
              isClearable={false}
            />
          </div>
        </div>
      </Modal>

      {/* Table Container */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 shadow-sm">
        <div className="overflow-x-auto">
          <ManagementTable><table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-800">
            <thead className="bg-gray-50/80 dark:bg-gray-800/60 font-semibold text-gray-700 dark:text-gray-300">
              <tr>
                <th className="px-4 py-3.5">Referrer</th>
                <th className="px-4 py-3.5">Referred Customer</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Reward Amount</th>
                <th className="px-4 py-3.5">Converted At</th>
                <th className="px-4 py-3.5">Approved By</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {loading && referrals.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-16 text-center text-sm text-gray-400">
                    <RefreshCw className="mx-auto mb-2.5 h-6 w-6 animate-spin text-blue-600" />
                    Loading referral records...
                  </td>
                </tr>
              ) : filteredReferrals.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-16 text-center text-sm text-gray-400">
                    <Gift className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
                    <p className="font-medium text-gray-600 dark:text-gray-300">No referral records found</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {statusFilter || searchTerm ? 'Try clearing your filters' : 'Referrals will appear here as users invite customers'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredReferrals.map((item) => {
                  const referrerAvatar = item.referrer_profile_image;
                  const referredAvatar = item.referred_customer_profile_image;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setDetailsReferral(item)}
                      className="cursor-pointer transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-900/10"
                    >
                      {/* Referrer */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          {referrerAvatar ? (
                            <img
                              src={referrerAvatar}
                              alt=""
                              className="h-9 w-9 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                            />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-semibold text-xs">
                              {item.referrer_name ? item.referrer_name.slice(0, 2).toUpperCase() : <User className="h-4 w-4" />}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-white truncate">
                              {item.referrer_name || 'Unknown Referrer'}
                            </p>
                            <p className="text-xs text-gray-400 font-mono">
                              Code: {item.referrer_code || '—'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Referred Customer */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          {referredAvatar ? (
                            <img
                              src={referredAvatar}
                              alt=""
                              className="h-9 w-9 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                            />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-semibold text-xs">
                              {item.referred_customer_name ? item.referred_customer_name.slice(0, 2).toUpperCase() : <User className="h-4 w-4" />}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {item.referred_customer_name || 'Unknown Customer'}
                            </p>
                            <p className="text-xs text-gray-400 font-mono">
                              Code: {item.referred_customer_code || '—'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        {getStatusBadge(item.status)}
                      </td>

                      {/* Reward Amount */}
                      <td className="px-4 py-3.5 font-medium text-gray-900 dark:text-white">
                        <div className="flex flex-col">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(item.approved_reward_amount ?? item.default_reward_amount)}
                          </span>
                          {item.approved_reward_amount !== null &&
                            item.approved_reward_amount !== undefined &&
                            item.default_reward_amount !== null &&
                            item.default_reward_amount !== undefined &&
                            Number(item.approved_reward_amount) !== Number(item.default_reward_amount) && (
                            <span className="text-[11px] text-gray-400 line-through">
                              Def: {formatCurrency(item.default_reward_amount)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Converted At */}
                      <td className="px-4 py-3.5 text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(item.converted_at)}
                      </td>

                      {/* Approved By */}
                      <td className="px-4 py-3.5 text-xs">
                        {item.reward_approved_by_name ? (
                          <div className="flex items-center gap-2">
                            {item.reward_approved_by_profile_image ? (
                              <img
                                src={item.reward_approved_by_profile_image}
                                alt=""
                                className="h-5 w-5 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold">
                                {item.reward_approved_by_name.slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              {item.reward_approved_by_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <ActionMenu
                            menuId={`referral-${item.id}`}
                            actions={[
                              {
                                label: 'Update Status',
                                icon: <Edit className="h-4 w-4 text-blue-600" />,
                                onClick: () => handleOpenUpdateModal(item),
                              },
                              {
                                label: 'View Details',
                                icon: <ChevronRight className="h-4 w-4 text-gray-500" />,
                                onClick: () => setDetailsReferral(item),
                              },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table></ManagementTable>
        </div>

        {/* Pagination footer */}
        {totalItems > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-800 p-3">
            <Pagination
              currentPage={currentPage}
              totalItems={totalItems}
              itemsPerPage={pageSize}
              onPageChange={(page) => setCurrentPage(page)}
              onLimitChange={(limit) => {
                setPageSize(limit);
                setCurrentPage(1);
              }}
              availableLimits={[5, 10, 20, 50]}
            />
          </div>
        )}
      </div>

      {/* ── UPDATE STATUS MODAL ── */}
      <Modal
        isOpen={isUpdateModalOpen}
        onClose={() => {
          setIsUpdateModalOpen(false);
          setSelectedReferral(null);
        }}
        title="Update Referral Status"
        icon={Edit}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <button
              type="button"
              onClick={() => {
                setIsUpdateModalOpen(false);
                setSelectedReferral(null);
              }}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="referral-update-form"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition"
            >
              {saving ? 'Updating…' : 'Save Status'}
            </button>
          </div>
        }
      >
        {selectedReferral && (
          <form id="referral-update-form" onSubmit={handleUpdateSubmit} className="space-y-4 p-1">
            <div className="rounded-xl bg-blue-50/70 p-3 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50">
              <div className="flex items-center justify-between text-xs text-blue-900 dark:text-blue-200">
                <span>
                  Referrer: <strong className="font-semibold">{selectedReferral.referrer_name || '—'}</strong>
                </span>
                <span>
                  Referee: <strong className="font-semibold">{selectedReferral.referred_customer_name || '—'}</strong>
                </span>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Referral Status <span className="text-red-500">*</span>
              </label>
              <SelectField
                options={updateStatusOptions}
                value={updateStatusOptions.find((opt) => opt.value === updateStatus)}
                onChange={(opt) => setUpdateStatus(opt ? opt.value : 'REWARD_APPROVED')}
                isClearable={false}
              />
              <p className="mt-1 text-xs text-gray-400">
                Options available: Reward Approve, Canceled, Blocked.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Reward Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  ₹
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={rewardAmount}
                  onChange={(e) => setRewardAmount(sanitizeNumericInput(e.target.value))}
                  placeholder="e.g. 500"
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Default reward: {formatCurrency(selectedReferral.default_reward_amount)}
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes or reasons for status update..."
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
          </form>
        )}
      </Modal>

      {/* ── DETAILS MODAL ── */}
      <Modal
        isOpen={!!detailsReferral}
        onClose={() => setDetailsReferral(null)}
        title="Referral Details"
        icon={Gift}
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => {
                const r = detailsReferral;
                setDetailsReferral(null);
                handleOpenUpdateModal(r);
              }}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
            >
              Update Status
            </button>
            <button
              type="button"
              onClick={() => setDetailsReferral(null)}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 transition"
            >
              Close
            </button>
          </div>
        }
      >
        {detailsReferral && (
          <div className="space-y-4 p-1">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <div className="mt-1">{getStatusBadge(detailsReferral.status)}</div>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-400 block">Reward Amount</span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(detailsReferral.approved_reward_amount ?? detailsReferral.default_reward_amount)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Referrer card */}
              <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 block mb-2">
                  Referrer Details
                </span>
                <div className="flex items-center gap-3">
                  {detailsReferral.referrer_profile_image ? (
                    <img
                      src={detailsReferral.referrer_profile_image}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                      {detailsReferral.referrer_name ? detailsReferral.referrer_name[0].toUpperCase() : 'R'}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {detailsReferral.referrer_name || '—'}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">
                      Code: {detailsReferral.referrer_code || '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Referred customer card */}
              <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 block mb-2">
                  Referred Customer
                </span>
                <div className="flex items-center gap-3">
                  {detailsReferral.referred_customer_profile_image ? (
                    <img
                      src={detailsReferral.referred_customer_profile_image}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                      {detailsReferral.referred_customer_name ? detailsReferral.referred_customer_name[0].toUpperCase() : 'C'}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {detailsReferral.referred_customer_name || '—'}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">
                      Code: {detailsReferral.referred_customer_code || '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Timestamps and details */}
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 bg-white dark:bg-gray-800">
                <dt className="text-xs text-gray-400">Referral Sent At</dt>
                <dd className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                  {formatDate(detailsReferral.referral_sent_at)}
                </dd>
              </div>

              <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 bg-white dark:bg-gray-800">
                <dt className="text-xs text-gray-400">Referral Accepted At</dt>
                <dd className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                  {formatDate(detailsReferral.referral_accepted_at)}
                </dd>
              </div>

              <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 bg-white dark:bg-gray-800">
                <dt className="text-xs text-gray-400">Booking Created At</dt>
                <dd className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                  {formatDate(detailsReferral.booking_created_at)}
                </dd>
              </div>

              <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 bg-white dark:bg-gray-800">
                <dt className="text-xs text-gray-400">Converted At</dt>
                <dd className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                  {formatDate(detailsReferral.converted_at)}
                </dd>
              </div>

              <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 bg-white dark:bg-gray-800">
                <dt className="text-xs text-gray-400">Booking Completed At</dt>
                <dd className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                  {formatDate(detailsReferral.booking_completed_at)}
                </dd>
              </div>

              <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 bg-white dark:bg-gray-800">
                <dt className="text-xs text-gray-400">Reward Credited At</dt>
                <dd className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                  {formatDate(detailsReferral.reward_credited_at)}
                </dd>
              </div>

              <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 bg-white dark:bg-gray-800">
                <dt className="text-xs text-gray-400">Booking Window (Days)</dt>
                <dd className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                  {detailsReferral.booking_window_days ?? '—'} days
                </dd>
              </div>

              <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 bg-white dark:bg-gray-800">
                <dt className="text-xs text-gray-400">Approved By</dt>
                <dd className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                  {detailsReferral.reward_approved_by_name || '—'}
                </dd>
              </div>

              <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 bg-white dark:bg-gray-800">
                <dt className="text-xs text-gray-400">Default Reward</dt>
                <dd className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                  {formatCurrency(detailsReferral.default_reward_amount)}
                </dd>
              </div>
            </dl>

            {/* Notes */}
            {detailsReferral.notes && (
              <div className="rounded-xl bg-slate-50 dark:bg-gray-800/60 p-3.5 border border-gray-100 dark:border-gray-800">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                  {detailsReferral.notes}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Referrals;
