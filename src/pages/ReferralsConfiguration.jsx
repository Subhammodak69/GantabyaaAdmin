import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Sliders,
  RefreshCw,
  Save,
  Calendar,
  Clock,
  User,
  ShieldCheck,
} from 'lucide-react';
import ReferralTabs from '../component/referrals/ReferralTabs';
import { apiCall, handleApiError } from '../utils/apiCall';
import { sanitizeNumericInput } from '../utils/inputValidation';

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

const ReferralsConfiguration = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [defaultRewardAmount, setDefaultRewardAmount] = useState('');
  const [bookingWindowDays, setBookingWindowDays] = useState('');

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiCall('/api/v1/admin/referrals/config', 'GET');
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message || payload?.detail || 'Failed to fetch referral configuration');
      }

      const data = payload?.data || {};
      setConfig(data);
      setDefaultRewardAmount(data.default_reward_amount !== undefined && data.default_reward_amount !== null ? data.default_reward_amount : '');
      setBookingWindowDays(data.booking_window_days !== undefined && data.booking_window_days !== null ? data.booking_window_days : '');
    } catch (error) {
      handleApiError(error, 'Unable to load referral configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (defaultRewardAmount === '' || isNaN(Number(defaultRewardAmount))) {
      toast.error('Please enter a valid default reward amount');
      return;
    }

    if (bookingWindowDays === '' || isNaN(Number(bookingWindowDays))) {
      toast.error('Please enter valid booking window days');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        default_reward_amount: Number(defaultRewardAmount),
        booking_window_days: Number(bookingWindowDays),
      };

      const response = await apiCall('/api/v1/admin/referrals/config', 'PATCH', payload);
      const resJson = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(resJson?.message || resJson?.detail || 'Failed to update referral configuration');
      }

      toast.success(resJson?.message || 'Referral configuration updated successfully');
      await fetchConfig();
    } catch (error) {
      handleApiError(error, 'Unable to update referral configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="px-1">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="bg-gradient-to-r from-slate-900 via-blue-700 to-indigo-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent md:text-3xl dark:from-slate-100 dark:via-blue-300 dark:to-indigo-300">
              Referral Configuration
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Configure baseline reward amounts, booking conversion windows, and referral policies.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Refresh configuration"
              onClick={fetchConfig}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:px-3 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition"
              title="Refresh configuration"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <ReferralTabs activeTab="configuration" />

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings Form */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 shadow-sm">
            <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-4 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  General Referral Rules
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  These parameters will be automatically applied to new referral conversions.
                </p>
              </div>
            </div>

            {loading && !config ? (
              <div className="py-16 text-center text-sm text-gray-400">
                <RefreshCw className="mx-auto mb-2.5 h-6 w-6 animate-spin text-blue-600" />
                Loading referral configuration...
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-800 dark:text-gray-200">
                    Default Reward Amount (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 font-medium">
                      ₹
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      required
                      value={defaultRewardAmount}
                      onChange={(e) => setDefaultRewardAmount(sanitizeNumericInput(e.target.value))}
                      placeholder="e.g. 500"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    The default payout/reward amount in INR credited or approved per successful qualified referral.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-800 dark:text-gray-200">
                    Booking Window (Days)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 font-medium">
                      <Calendar className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      required
                      value={bookingWindowDays}
                      onChange={(e) => setBookingWindowDays(sanitizeNumericInput(e.target.value))}
                      placeholder="e.g. 30"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    The maximum number of days a referred customer has after registering/converting to complete their booking for the referrer to qualify for rewards.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-60 transition"
                  >
                    <Save className="h-4 w-4" />
                    <span>{saving ? 'Saving Changes…' : 'Save Configuration'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Configuration Meta & Summary Sidebar */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
              Audit & Update Info
            </h3>

            {config ? (
              <div className="space-y-4">
                {/* Last updated by */}
                <div>
                  <span className="text-xs text-gray-400 block mb-1.5">Last Updated By</span>
                  <div className="flex items-center gap-3">
                    {config.updated_by_profile_image ? (
                      <img
                        src={config.updated_by_profile_image}
                        alt=""
                        className="h-9 w-9 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                        {config.updated_by_name ? config.updated_by_name[0].toUpperCase() : <User className="h-4 w-4" />}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-sm text-gray-900 dark:text-white">
                        {config.updated_by_name || 'Admin'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Last updated at */}
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-xs text-gray-400 block mb-1">Last Updated At</span>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    {formatDate(config.updated_at)}
                  </p>
                </div>

              </div>
            ) : (
              <p className="text-xs text-gray-400">No configuration loaded yet.</p>
            )}
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5 dark:border-blue-900/40 dark:bg-blue-950/20">
            <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300 flex items-center gap-2 mb-2">
              <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Policy Guidance
            </h4>
            <p className="text-xs text-blue-800 dark:text-blue-300/80 leading-relaxed">
              Modifying these values immediately affects all newly created referral transactions. Existing pending referrals retain their initial snapshot default values unless manually adjusted during status approval.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferralsConfiguration;
