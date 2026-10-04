import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Award,
  Coins,
  History,
  Pencil,
  RefreshCw,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import ManagementTable from '../component/common/ManagementTable';
import Modal from '../component/common/Modal';
import Pagination from '../component/common/PaginationComponent';
import SelectField from '../component/common/SelectField';
import { apiCall, handleApiError } from '../utils/apiCall';

const BASE_ENDPOINT = '/api/v1/admin/points';
const tourTypes = [
  { value: 'DOMESTIC', label: 'Domestic' },
  { value: 'INTERNATIONAL', label: 'International' },
];
const views = [
  { id: 'configuration', label: 'Configuration', icon: Coins },
  { id: 'history', label: 'Change history', icon: History },
  { id: 'transactions', label: 'Transactions', icon: Wallet },
  { id: 'rankings', label: 'Rankings', icon: Trophy },
];
const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200';
const cardClass = 'overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900';
const headingClass = 'px-4 py-3 font-semibold text-gray-700 dark:text-gray-200';
const cellClass = 'px-4 py-4 text-gray-700 dark:text-gray-300';

const formatDate = (value, withTime = true) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, withTime
    ? { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatNumber = (value, maximumFractionDigits = 2) => {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString('en-IN', { maximumFractionDigits })
    : String(value);
};

const formatCurrency = (value) => {
  const number = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(number)) return '—';
  return `₹${number.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const readListResponse = async (response, fallbackMessage) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || payload?.detail || fallbackMessage);
  }
  if (!Array.isArray(payload?.data)) {
    throw new Error('The points API returned an invalid response');
  }
  return payload;
};

const CustomerIdentity = ({ name, code, email, mobile, picture }) => (
  <div className="flex min-w-0 items-center gap-3">
    {picture ? (
      <img src={picture} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
    ) : (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
        {(name || 'C').trim().charAt(0).toUpperCase()}
      </span>
    )}
    <div className="min-w-0">
      <p className="truncate font-semibold text-gray-900 dark:text-white">{name || 'Customer'}</p>
      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
        {[code, email || mobile].filter(Boolean).join(' · ') || '—'}
      </p>
    </div>
  </div>
);

const PointsManagement = () => {
  const [activeView, setActiveView] = useState('configuration');
  const [configurations, setConfigurations] = useState([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTourType, setHistoryTourType] = useState('DOMESTIC');
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactionsPageSize, setTransactionsPageSize] = useState(20);
  const [transactionsTotal, setTransactionsTotal] = useState(0);
  const [rankings, setRankings] = useState([]);
  const [rankingsLoading, setRankingsLoading] = useState(false);
  const [rankingsPage, setRankingsPage] = useState(1);
  const [rankingsPageSize, setRankingsPageSize] = useState(20);
  const [rankingsTotal, setRankingsTotal] = useState(0);
  const [editingConfig, setEditingConfig] = useState(null);
  const [amountPerPoint, setAmountPerPoint] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  const loadConfigurations = useCallback(async () => {
    setConfigLoading(true);
    try {
      const response = await apiCall(`${BASE_ENDPOINT}/config`, 'GET');
      const payload = await readListResponse(response, 'Unable to load points configuration');
      setConfigurations(payload.data);
    } catch (error) {
      handleApiError(error, 'Unable to load points configuration');
    } finally {
      setConfigLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ tour_type: historyTourType });
      const response = await apiCall(`${BASE_ENDPOINT}/config/history?${params}`, 'GET');
      const payload = await readListResponse(response, 'Unable to load points configuration history');
      setHistory(payload.data);
    } catch (error) {
      handleApiError(error, 'Unable to load points configuration history');
    } finally {
      setHistoryLoading(false);
    }
  }, [historyTourType]);

  const loadTransactions = useCallback(async () => {
    setTransactionsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(transactionsPage),
        page_size: String(transactionsPageSize),
      });
      const response = await apiCall(`${BASE_ENDPOINT}/transactions?${params}`, 'GET');
      const payload = await readListResponse(response, 'Unable to load points transactions');
      setTransactions(payload.data);
      setTransactionsTotal(Number(payload?.pagination?.total_items ?? payload.data.length));
    } catch (error) {
      handleApiError(error, 'Unable to load points transactions');
    } finally {
      setTransactionsLoading(false);
    }
  }, [transactionsPage, transactionsPageSize]);

  const loadRankings = useCallback(async () => {
    setRankingsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(rankingsPage),
        page_size: String(rankingsPageSize),
      });
      const response = await apiCall(`${BASE_ENDPOINT}/rankings?${params}`, 'GET');
      const payload = await readListResponse(response, 'Unable to load points rankings');
      setRankings(payload.data);
      setRankingsTotal(Number(payload?.pagination?.total_items ?? payload.data.length));
    } catch (error) {
      handleApiError(error, 'Unable to load points rankings');
    } finally {
      setRankingsLoading(false);
    }
  }, [rankingsPage, rankingsPageSize]);

  useEffect(() => { loadConfigurations(); }, [loadConfigurations]);
  useEffect(() => {
    if (activeView === 'history') loadHistory();
  }, [activeView, loadHistory]);
  useEffect(() => {
    if (activeView === 'transactions') loadTransactions();
  }, [activeView, loadTransactions]);
  useEffect(() => {
    if (activeView === 'rankings') loadRankings();
  }, [activeView, loadRankings]);

  const refreshActiveView = () => {
    if (activeView === 'configuration') loadConfigurations();
    if (activeView === 'history') loadHistory();
    if (activeView === 'transactions') loadTransactions();
    if (activeView === 'rankings') loadRankings();
  };

  const openConfigEditor = (configuration) => {
    setEditingConfig(configuration);
    setAmountPerPoint(String(configuration.amount_per_point ?? ''));
  };

  const saveConfiguration = async (event) => {
    event.preventDefault();
    const amount = Number(amountPerPoint);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter an amount per point greater than zero');
      return;
    }

    setSavingConfig(true);
    try {
      const response = await apiCall(
        `${BASE_ENDPOINT}/config/${encodeURIComponent(editingConfig.tour_type)}`,
        'PUT',
        { amount_per_point: amount },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || payload?.detail || 'Unable to update points configuration');
      }
      toast.success(payload?.message || 'Points configuration updated successfully');
      setEditingConfig(null);
      await loadConfigurations();
      if (activeView === 'history' && historyTourType === editingConfig.tour_type) await loadHistory();
    } catch (error) {
      handleApiError(error, 'Unable to update points configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const currentLoading = activeView === 'configuration'
    ? configLoading
    : activeView === 'history'
      ? historyLoading
      : activeView === 'transactions'
        ? transactionsLoading
        : rankingsLoading;

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="bg-gradient-to-r from-slate-900 via-blue-700 to-indigo-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent md:text-3xl dark:from-slate-100 dark:via-blue-300 dark:to-indigo-300">
            Points &amp; Loyalty
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Configure point values, review activity, and see your top customers.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshActiveView}
          disabled={currentLoading}
          aria-label="Refresh points data"
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-gray-200 bg-white p-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 sm:self-auto sm:px-3 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <RefreshCw className={`h-4 w-4 ${currentLoading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Tour categories', value: tourTypes.length, icon: Award, color: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300' },
          { label: 'Current configurations', value: configurations.length, icon: Coins, color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' },
          { label: 'Transactions', value: transactionsTotal, icon: Wallet, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300' },
          { label: 'Ranked customers', value: rankingsTotal, icon: Users, color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}><Icon className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatNumber(value, 0)}</p>
            </div>
          </div>
        ))}
      </div>

      <nav className="flex gap-2 overflow-x-auto border-b border-gray-200 pb-2 dark:border-gray-800" aria-label="Points management sections">
        {views.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveView(id)}
            aria-current={activeView === id ? 'page' : undefined}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeView === id
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-white'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      {activeView === 'configuration' && (
        <section className={cardClass}>
          <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white">Points configuration</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Set the amount customers must spend to earn one point for each tour type.</p>
          </div>
          {configLoading ? (
            <div className="p-12 text-center text-sm text-gray-500"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-blue-600" />Loading configuration...</div>
          ) : configurations.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">No points configuration was returned.</div>
          ) : (
            <ManagementTable>
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800/70"><tr>
                    <th className={headingClass}>Tour type</th>
                    <th className={headingClass}>Amount per point</th>
                    <th className={headingClass}>Last updated</th>
                    <th className={`${headingClass} text-right`}>Action</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {configurations.map((configuration) => (
                      <tr key={configuration.id || configuration.tour_type} className="hover:bg-blue-50/40 dark:hover:bg-blue-900/10">
                        <td className={cellClass}><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${configuration.tour_type === 'INTERNATIONAL' ? 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>{configuration.tour_type}</span></td>
                        <td className={cellClass}><span className="font-semibold">{formatCurrency(configuration.amount_per_point)}</span><span className="ml-1 text-xs text-gray-500">per point</span></td>
                        <td className={cellClass}>{formatDate(configuration.updated_at)}</td>
                        <td className={`${cellClass} text-right`}>
                          <button type="button" onClick={() => openConfigEditor(configuration)} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-700 dark:text-gray-200 dark:hover:border-blue-700 dark:hover:bg-blue-950/30 dark:hover:text-blue-300">
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </ManagementTable>
          )}
        </section>
      )}

      {activeView === 'history' && (
        <section className={cardClass}>
          <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Configuration change history</h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Review previous point values and the administrator who changed them.</p>
            </div>
            <div className="w-full sm:w-52">
              <SelectField
                options={tourTypes}
                value={tourTypes.find((option) => option.value === historyTourType)}
                onChange={(option) => setHistoryTourType(option?.value || 'DOMESTIC')}
                isSearchable={false}
                aria-label="Filter history by tour type"
                classNamePrefix="react-select"
              />
            </div>
          </div>
          {historyLoading ? (
            <div className="p-12 text-center text-sm text-gray-500"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-blue-600" />Loading change history...</div>
          ) : history.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">No configuration changes found for this tour type.</div>
          ) : (
            <ManagementTable>
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800/70"><tr>
                    <th className={headingClass}>Changed by</th>
                    <th className={headingClass}>Previous amount</th>
                    <th className={headingClass}>New amount</th>
                    <th className={headingClass}>Changed at</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {history.map((entry) => (
                      <tr key={entry.id}>
                        <td className={cellClass}><CustomerIdentity name={entry.changed_by_account_name} email={entry.changed_by_account_email} mobile={entry.changed_by_account_mobile} picture={entry.changed_by_account_profile_pic} /></td>
                        <td className={cellClass}>{formatCurrency(entry.previous_amount_per_point)}</td>
                        <td className={cellClass}><span className="font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(entry.amount_per_point)}</span></td>
                        <td className={cellClass}>{formatDate(entry.changed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </ManagementTable>
          )}
        </section>
      )}

      {activeView === 'transactions' && (
        <section className={cardClass}>
          <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white">Points transactions</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Browse points earned from bookings and the resulting customer balances.</p>
          </div>
          {transactionsLoading ? (
            <div className="p-12 text-center text-sm text-gray-500"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-blue-600" />Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">No points transactions found.</div>
          ) : (
            <>
              <ManagementTable>
                  <table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800/70"><tr>
                      <th className={headingClass}>Customer</th>
                      <th className={headingClass}>Transaction</th>
                      <th className={headingClass}>Booking / tour</th>
                      <th className={headingClass}>Points</th>
                      <th className={headingClass}>Balance</th>
                      <th className={headingClass}>Date</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {transactions.map((transaction) => (
                        <tr key={transaction.id}>
                          <td className={cellClass}><CustomerIdentity name={transaction.customer_name} code={transaction.customer_code} email={transaction.customer_email} mobile={transaction.customer_mobile} picture={transaction.customer_profile_pic} /></td>
                          <td className={cellClass}>
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${String(transaction.transaction_type).includes('EARNED') ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>{String(transaction.transaction_type || '—').replaceAll('_', ' ')}</span>
                            {transaction.reason && <p className="mt-1 max-w-48 truncate text-xs text-gray-500 dark:text-gray-400" title={transaction.reason}>{transaction.reason}</p>}
                          </td>
                          <td className={cellClass}>
                            <p className="font-medium">{transaction.booking_code || '—'}</p>
                            <p className="max-w-48 truncate text-xs text-gray-500 dark:text-gray-400">{transaction.tour_title || '—'}</p>
                          </td>
                          <td className={`${cellClass} font-semibold`}>{formatNumber(transaction.points)}</td>
                          <td className={cellClass}><p>{formatNumber(transaction.balance_after)}</p><p className="text-xs text-gray-500 dark:text-gray-400">from {formatNumber(transaction.balance_before)}</p></td>
                          <td className={`${cellClass} whitespace-nowrap text-xs`}>{formatDate(transaction.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </ManagementTable>
              <div className="border-t border-gray-200 py-3 dark:border-gray-800">
                <Pagination
                  currentPage={transactionsPage}
                  totalItems={transactionsTotal}
                  itemsPerPage={transactionsPageSize}
                  onPageChange={setTransactionsPage}
                  onLimitChange={(limit) => { setTransactionsPageSize(limit); setTransactionsPage(1); }}
                />
              </div>
            </>
          )}
        </section>
      )}

      {activeView === 'rankings' && (
        <section className={cardClass}>
          <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white">Customer rankings</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Customers ranked by their accumulated loyalty points.</p>
          </div>
          {rankingsLoading ? (
            <div className="p-12 text-center text-sm text-gray-500"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-blue-600" />Loading rankings...</div>
          ) : rankings.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">No ranked customers found.</div>
          ) : (
            <>
              <ManagementTable>
                  <table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800/70"><tr>
                      <th className={headingClass}>Rank</th>
                      <th className={headingClass}>Customer</th>
                      <th className={headingClass}>Points</th>
                      <th className={headingClass}>Money spent</th>
                      <th className={headingClass}>Joined</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {rankings.map((customer) => (
                        <tr key={customer.customer_id}>
                          <td className={cellClass}>
                            <span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-bold ${customer.rank <= 3 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
                              {customer.rank}
                            </span>
                          </td>
                          <td className={cellClass}><CustomerIdentity name={customer.customer_name} code={customer.customer_code} picture={customer.customer_profile_picture} /></td>
                          <td className={`${cellClass} font-semibold text-blue-700 dark:text-blue-300`}>{formatNumber(customer.points)}</td>
                          <td className={cellClass}>{formatCurrency(customer.money_spends)}</td>
                          <td className={`${cellClass} whitespace-nowrap text-xs`}>{formatDate(customer.customer_joined_at, false)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </ManagementTable>
              <div className="border-t border-gray-200 py-3 dark:border-gray-800">
                <Pagination
                  currentPage={rankingsPage}
                  totalItems={rankingsTotal}
                  itemsPerPage={rankingsPageSize}
                  onPageChange={setRankingsPage}
                  onLimitChange={(limit) => { setRankingsPageSize(limit); setRankingsPage(1); }}
                />
              </div>
            </>
          )}
        </section>
      )}

      <Modal
        isOpen={Boolean(editingConfig)}
        onClose={() => !savingConfig && setEditingConfig(null)}
        title={`Edit ${editingConfig?.tour_type || ''} points`}
        icon={Coins}
        size="md"
        footer={(
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setEditingConfig(null)} disabled={savingConfig} className="rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">Cancel</button>
            <button type="submit" form="points-config-form" disabled={savingConfig} className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{savingConfig ? 'Saving...' : 'Save configuration'}</button>
          </div>
        )}
      >
        <form id="points-config-form" onSubmit={saveConfiguration} className="space-y-5 p-1">
          <div>
            <label htmlFor="config-tour-type" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Tour type</label>
            <SelectField
              inputId="config-tour-type"
              options={tourTypes}
              value={tourTypes.find((option) => option.value === editingConfig?.tour_type)}
              onChange={(option) => {
                const nextConfiguration = configurations.find((item) => item.tour_type === option?.value);
                if (nextConfiguration) {
                  setEditingConfig(nextConfiguration);
                  setAmountPerPoint(String(nextConfiguration.amount_per_point ?? ''));
                }
              }}
              isSearchable={false}
              classNamePrefix="react-select"
            />
          </div>
          <div>
            <label htmlFor="amount-per-point" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Amount per point (₹)</label>
            <input id="amount-per-point" type="number" min="0.01" step="any" value={amountPerPoint} onChange={(event) => setAmountPerPoint(event.target.value)} className={inputClass} placeholder="e.g. 10000" required />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">The spend amount required to earn one loyalty point.</p>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PointsManagement;
