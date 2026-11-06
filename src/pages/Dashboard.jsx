import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Bus, Calendar, CheckCircle2, Clock, Compass, Hotel, MapPin, RefreshCw, Star, TrendingUp, XCircle } from 'lucide-react';
import ManagementTable from '../component/common/ManagementTable';
import { apiCall } from '../utils/apiCall';

const statusConfig = {
  confirmed: { label: 'Confirmed', icon: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800' },
  pending: { label: 'Pending', icon: Clock, cls: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800' },
  cancelled: { label: 'Cancelled', icon: XCircle, cls: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800' },
};

const colorMap = {
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-200 dark:ring-emerald-800' },
  blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-200 dark:ring-blue-800' },
  violet: { bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-600 dark:text-violet-400', ring: 'ring-violet-200 dark:ring-violet-800' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-200 dark:ring-amber-800' },
  rose: { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-600 dark:text-rose-400', ring: 'ring-rose-200 dark:ring-rose-800' },
  cyan: { bg: 'bg-cyan-50 dark:bg-cyan-900/20', text: 'text-cyan-600 dark:text-cyan-400', ring: 'ring-cyan-200 dark:ring-cyan-800' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', ring: 'ring-orange-200 dark:ring-orange-800' },
  yellow: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400', ring: 'ring-yellow-200 dark:ring-yellow-800' },
};

const formatNumber = value => Number(value || 0).toLocaleString('en-IN');

const formatCurrency = (amount, currency) => {
  const value = Number(amount || 0);
  const code = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: code.length === 3 ? code : 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency || ''} ${formatNumber(value)}`.trim();
  }
};

const formatDate = value => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatGrowth = value => {
  const growth = Number(value || 0);
  return `${growth > 0 ? '+' : ''}${growth}%`;
};

const Dashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiCall('/api/v1/admin/dashboard', 'GET');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || payload?.detail || `Dashboard request failed (${response.status})`);
      }
      setDashboard(payload?.data || {});
    } catch (requestError) {
      setError(requestError.message || 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const currentDateLabel = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (loading && !dashboard) {
    return <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-gray-500 dark:text-gray-400"><RefreshCw className="h-4 w-4 animate-spin" />Loading dashboard...</div>;
  }

  if (error && !dashboard) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        <button type="button" onClick={loadDashboard} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  const summary = dashboard?.summary || {};
  const platform = dashboard?.platform_metrics || {};
  const analytics = dashboard?.revenue_analytics || {};
  const monthlyHistory = Array.isArray(analytics.monthly_history) ? analytics.monthly_history : [];
  const destinations = Array.isArray(dashboard?.top_destinations) ? dashboard.top_destinations : [];
  const bookings = Array.isArray(dashboard?.recent_bookings) ? dashboard.recent_bookings : [];
  const filteredBookings = activeTab === 'all'
    ? bookings
    : bookings.filter(booking => String(booking.status || '').toLowerCase() === activeTab);

  const stats = [
    { id: 'revenue', label: 'Total Revenue', value: formatCurrency(summary.total_revenue?.amount, summary.total_revenue?.currency), change: summary.total_revenue?.growth_percentage, sub: summary.total_revenue?.comparison_period, color: 'emerald' },
    { id: 'bookings', label: 'Total Bookings', value: formatNumber(summary.total_bookings?.count), change: summary.total_bookings?.growth_percentage, sub: summary.total_bookings?.comparison_period, color: 'blue' },
    { id: 'users', label: 'Registered Users', value: formatNumber(summary.registered_users?.count), change: summary.registered_users?.growth_percentage, sub: summary.registered_users?.comparison_period, color: 'violet' },
    { id: 'trips', label: 'Active Trips', value: formatNumber(summary.active_trips?.count), change: summary.active_trips?.growth_percentage, sub: summary.active_trips?.comparison_period, color: 'amber' },
    { id: 'due', label: 'Due Amount', value: formatCurrency(summary.due_amount, summary.total_revenue?.currency), color: 'rose' },
  ];
  const quickStats = [
    { label: 'Hotels Listed', value: platform.hotels_listed, icon: Hotel, color: 'rose' },
    { label: 'Tour Packages', value: platform.tour_packages, icon: Compass, color: 'cyan' },
    { label: 'Bus Routes', value: platform.bus_routes, icon: Bus, color: 'orange' },
    { label: 'Average Rating', value: platform.average_rating, icon: Star, color: 'yellow' },
  ];
  const maxRevenue = Math.max(...monthlyHistory.map(item => Number(item.revenue) || 0), 0);
  const bookingCurrency = bookings.find(booking => booking.currency)?.currency || summary.total_revenue?.currency;

  return (
    <div className="space-y-3 pb-6">
      <div className="text-slate-900 dark:text-slate-100">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="mt-1 bg-gradient-to-r from-slate-900 via-violet-700 to-indigo-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent dark:from-slate-100 dark:via-violet-300 dark:to-indigo-300 md:text-3xl">Travel Operations Overview</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{currentDateLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {[
              { label: "Today's Bookings", value: formatNumber(summary.today_bookings) },
              { label: "Today's Revenue", value: formatCurrency(summary.today_revenue, bookingCurrency) },
              { label: 'Pending Actions', value: formatNumber(summary.pending_actions) },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center dark:border-slate-700 dark:bg-slate-800">
                <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(stat => {
          const color = colorMap[stat.color];
          const growth = Number(stat.change || 0);
          const GrowthIcon = growth < 0 ? ArrowDownRight : ArrowUpRight;
          return (
            <div key={stat.id} className="group rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{stat.label}</span>
                <div className={`rounded-xl p-2.5 ${color.bg} ${color.text} ring-1 ${color.ring}`}><TrendingUp className="h-4 w-4" /></div>
              </div>
              <div className="mt-3"><span className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</span></div>
              {stat.change !== undefined && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <GrowthIcon className={`h-3.5 w-3.5 ${growth < 0 ? 'text-rose-500' : 'text-emerald-500'}`} />
                  <span className={`text-xs font-semibold ${growth < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{formatGrowth(growth)}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{stat.sub || ''}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {quickStats.map(item => {
          const Icon = item.icon;
          const color = colorMap[item.color];
          return (
            <div key={item.label} className="flex items-center gap-4 rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className={`shrink-0 rounded-xl p-3 ${color.bg} ${color.text}`}><Icon className="h-5 w-5" /></div>
              <div><p className="text-xl font-bold text-gray-900 dark:text-white">{item.value ?? '-'}</p><p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{item.label}</p></div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:col-span-3">
          <div className="mb-2 flex items-center justify-between">
            <div><h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white"><TrendingUp className="h-4 w-4 text-blue-500" />Revenue Analytics</h2><p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Monthly revenue history</p></div>
            <div className="text-right"><p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(analytics.current_month_revenue, summary.total_revenue?.currency)}</p><p className={`flex items-center justify-end gap-1 text-xs font-medium ${Number(analytics.growth_this_month_percentage) < 0 ? 'text-rose-500' : 'text-emerald-500'}`}><ArrowUpRight className="h-3 w-3" />{formatGrowth(analytics.growth_this_month_percentage)} this month</p></div>
          </div>
          {monthlyHistory.length ? (
            <div className="flex h-36 items-end gap-3 px-2 pt-4">
              {monthlyHistory.map((item, index) => {
                const revenue = Number(item.revenue) || 0;
                const height = maxRevenue ? Math.max((revenue / maxRevenue) * 100, 2) : 2;
                return <div key={`${item.month}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" title={formatCurrency(revenue, summary.total_revenue?.currency)}><span className="max-w-full truncate text-[10px] font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(revenue, summary.total_revenue?.currency)}</span><div className="relative w-full overflow-hidden rounded-t-md" style={{ height: `${height}px` }}><div className={`absolute inset-0 rounded-t-md ${index === monthlyHistory.length - 1 ? 'bg-gradient-to-t from-blue-600 to-indigo-400' : 'bg-gradient-to-t from-blue-200 to-blue-100 dark:from-blue-900 dark:to-blue-800'}`} /></div><span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{item.month}</span></div>;
              })}
            </div>
          ) : <p className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">No revenue history available</p>}
          <div className="mt-4 grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100 pt-4 dark:divide-gray-800 dark:border-gray-800">
            {[
              { label: 'Avg / Month', value: formatCurrency(analytics.average_monthly_revenue, summary.total_revenue?.currency) },
              { label: 'Peak Month', value: analytics.peak_month || '-' },
              { label: 'Growth YoY', value: formatGrowth(analytics.yoy_growth_percentage) },
            ].map(item => <div key={item.label} className="px-4 text-center first:pl-0 last:pr-0"><p className="text-sm font-bold text-gray-900 dark:text-white">{item.value}</p><p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{item.label}</p></div>)}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:col-span-2">
          <h2 className="mb-5 flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white"><MapPin className="h-4 w-4 text-violet-500" />Top Destinations</h2>
          {destinations.length ? <div className="space-y-4">{destinations.map((destination, index) => {
            const maxBookings = Math.max(...destinations.map(item => Number(item.total_bookings) || 0), 0);
            const width = maxBookings ? (Number(destination.total_bookings || 0) / maxBookings) * 100 : 0;
            return <div key={`${destination.rank}-${destination.name}`}><div className="mb-1.5 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2">{destination.image_url ? <img src={destination.image_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800"><MapPin className="h-4 w-4" /></span>}<span className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">{destination.name}</span><span className="text-[10px] font-bold text-gray-400">#{destination.rank ?? index + 1}</span></div><span className="shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400">{formatNumber(destination.total_bookings)}</span></div><div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-700" style={{ width: `${width}%` }} /></div></div>;
          })}</div> : <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">No destination data available</p>}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col justify-between gap-4 border-b border-gray-100 p-6 dark:border-gray-800 sm:flex-row sm:items-center">
          <div><h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white"><Calendar className="h-4 w-4 text-blue-500" />Recent Bookings</h2><p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Latest travel reservations across the platform</p></div>
          <div className="flex gap-2 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">{['all', 'confirmed', 'pending', 'cancelled'].map(tab => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-2xl px-3 py-1.5 text-xs font-semibold capitalize transition-all ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>{tab}</button>)}</div>
        </div>
        <div className="overflow-x-auto"><ManagementTable><table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200/60 bg-gray-50/80 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:bg-gray-800/60 dark:text-gray-400"><tr><th className="px-6 py-4">Booking ID</th><th className="px-6 py-4">Traveller</th><th className="px-6 py-4">Destination</th><th className="px-6 py-4">Package</th><th className="px-6 py-4">Amount</th><th className="px-6 py-4">Date</th><th className="px-6 py-4">Status</th></tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">{filteredBookings.length === 0 ? <tr><td colSpan="7" className="px-6 py-12 text-center text-sm text-gray-400 dark:text-gray-500">No bookings found</td></tr> : filteredBookings.map(booking => {
            const status = statusConfig[String(booking.status || '').toLowerCase()] || { label: booking.status || 'Unknown', icon: Clock, cls: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300' };
            const StatusIcon = status.icon;
            return <tr key={booking.booking_id} className="transition-colors hover:bg-gray-50/60 dark:hover:bg-gray-800/40"><td className="px-6 py-4 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">{booking.booking_id}</td><td className="px-6 py-4"><div className="flex items-center gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{booking.customer?.initials || '—'}</div><span className="text-sm font-semibold text-gray-900 dark:text-white">{booking.customer?.name || '-'}</span></div></td><td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{booking.destination || '-'}</td><td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">{booking.package_name || '-'}</td><td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{formatCurrency(booking.amount, booking.currency)}</td><td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">{formatDate(booking.booking_date)}</td><td className="px-6 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${status.cls}`}><StatusIcon className="h-3 w-3" />{status.label}</span></td></tr>;
          })}</tbody>
        </table></ManagementTable></div>
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3 dark:border-gray-800"><p className="text-xs text-gray-500 dark:text-gray-400">Showing {filteredBookings.length} of {bookings.length} bookings</p><button type="button" aria-label="Refresh dashboard" title="Refresh dashboard" onClick={loadDashboard} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /><span className="hidden sm:inline">Refresh</span></button></div>
      </div>
    </div>
  );
};

export default Dashboard;
