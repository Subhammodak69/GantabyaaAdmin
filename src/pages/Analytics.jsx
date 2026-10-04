import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Globe2,
  MapPin,
  RefreshCw,
  Search,
  Target,
  Users,
  X,
} from 'lucide-react';
import {
  fetchAnalyticsDashboard,
  fetchAnalyticsOverview,
  fetchConversionFunnel,
  fetchLeadScoreDistribution,
  fetchTopEvents,
  fetchTopPages,
  fetchUtmPerformance,
  fetchVisitorDetails,
  fetchVisitors,
} from '../api/analytics';

const numberFormat = value => Number(value || 0).toLocaleString('en-IN');
const dateFormat = value => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};
const durationFormat = value => {
  const seconds = Number(value || 0);
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
};
const moneyFormat = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const ANALYTICS_REALTIME_EVENTS = new Set([
  'visitor_connected',
  'visitor_disconnected',
  'visitor_identified',
  'visitor_location_updated',
  'page_view',
  'page_navigation',
  'activity',
  'click',
  'session_updated',
  'live_stats',
  'analytics:visitor_identified',
  'analytics.visitor_identified',
  'analytics:session_started',
  'analytics.session_started',
  'analytics:session_heartbeat',
  'analytics.session_heartbeat',
  'analytics:session_ended',
  'analytics.session_ended',
  'analytics:visitor_event',
  'analytics.visitor_event',
]);

function Card({ children, className = '' }) {
  return <section className={`rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 ${className}`}>{children}</section>;
}

function SectionTitle({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"><Icon className="h-4 w-4" /></div>
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ message = 'No data available for this period.' }) {
  return <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">{message}</div>;
}

const Analytics = () => {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState(null);
  const [businessDashboard, setBusinessDashboard] = useState(null);
  const [topPages, setTopPages] = useState([]);
  const [topEvents, setTopEvents] = useState([]);
  const [utmPerformance, setUtmPerformance] = useState([]);
  const [scoreDistribution, setScoreDistribution] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [visitorPagination, setVisitorPagination] = useState({});
  const [visitorPage, setVisitorPage] = useState(1);
  const [visitorSearch, setVisitorSearch] = useState('');
  const [visitorSearchInput, setVisitorSearchInput] = useState('');
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visitorsLoading, setVisitorsLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastRealtimeEvent, setLastRealtimeEvent] = useState(null);
  const realtimeRefreshTimer = useRef(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    const results = await Promise.allSettled([
      fetchAnalyticsOverview(),
      fetchAnalyticsDashboard(),
      fetchTopPages(days),
      fetchTopEvents(days),
      fetchUtmPerformance(days),
      fetchLeadScoreDistribution(),
      fetchConversionFunnel(days),
    ]);

    const [overviewResult, dashboardResult, pagesResult, eventsResult, utmResult, scoresResult, funnelResult] = results;
    if (overviewResult.status === 'fulfilled') setOverview(overviewResult.value);
    if (dashboardResult.status === 'fulfilled') setBusinessDashboard(dashboardResult.value);
    if (pagesResult.status === 'fulfilled') setTopPages(pagesResult.value);
    if (eventsResult.status === 'fulfilled') setTopEvents(eventsResult.value);
    if (utmResult.status === 'fulfilled') setUtmPerformance(utmResult.value);
    if (scoresResult.status === 'fulfilled') setScoreDistribution(scoresResult.value);
    if (funnelResult.status === 'fulfilled') setFunnel(funnelResult.value);

    const firstFailure = results.find(result => result.status === 'rejected');
    if (firstFailure) setError(firstFailure.reason?.message || 'Some analytics data could not be loaded.');
    setLoading(false);
  }, [days]);

  const loadVisitors = useCallback(async () => {
    setVisitorsLoading(true);
    try {
      const result = await fetchVisitors({ search: visitorSearch, page: visitorPage, pageSize: 20 });
      setVisitors(result.items);
      setVisitorPagination(result.pagination);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load visitors.');
    } finally {
      setVisitorsLoading(false);
    }
  }, [visitorPage, visitorSearch]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);
  useEffect(() => { loadVisitors(); }, [loadVisitors]);

  useEffect(() => {
    const handleRealtimeEvent = event => {
      const detail = event.detail || {};
      setLastRealtimeEvent({ event: detail.event, payload: detail.payload, receivedAt: new Date() });
      if (ANALYTICS_REALTIME_EVENTS.has(detail.event)) {
        window.clearTimeout(realtimeRefreshTimer.current);
        realtimeRefreshTimer.current = window.setTimeout(() => {
          loadAnalytics();
          loadVisitors();
        }, 250);
      }
    };
    window.addEventListener('cobtravels:realtime:event', handleRealtimeEvent);
    return () => {
      window.removeEventListener('cobtravels:realtime:event', handleRealtimeEvent);
      window.clearTimeout(realtimeRefreshTimer.current);
    };
  }, [loadAnalytics, loadVisitors]);

  const openVisitor = async visitor => {
    setDetailsLoading(true);
    try {
      setSelectedVisitor(await fetchVisitorDetails(visitor.id));
    } catch (requestError) {
      setError(requestError.message || 'Unable to load visitor details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const maxScoreCount = Math.max(...scoreDistribution.map(item => Number(item.count) || 0), 1);
  const maxFunnelCount = Math.max(...funnel.map(item => Number(item.visitor_count) || 0), 1);
  const maxPageViews = Math.max(...topPages.map(item => Number(item.views) || 0), 1);
  const maxEventCount = Math.max(...topEvents.map(item => Number(item.count) || 0), 1);
  const pageTotal = visitorPagination.total_pages || 1;

  const statCards = useMemo(() => [
    { label: 'Total Visitors', value: overview?.total_visitors, icon: Users, color: 'indigo' },
    { label: 'Visitors Today', value: overview?.visitors_today, icon: Eye, color: 'blue' },
    { label: 'Active Sessions', value: overview?.active_sessions, icon: Activity, color: 'emerald' },
    { label: 'Events Today', value: overview?.total_events_today, icon: BarChart3, color: 'violet' },
    { label: 'Average Lead Score', value: Number(overview?.average_lead_score || 0).toFixed(2), icon: Target, color: 'amber' },
    { label: 'High-intent Visitors', value: overview?.high_intent_visitors_count, icon: Target, color: 'rose' },
  ], [overview]);

  return (
    <div className="space-y-5 pb-8 text-gray-900 dark:text-gray-100">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Visitor intelligence</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Understand traffic, intent, conversion, and live visitor activity.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={days} onChange={event => setDays(Number(event.target.value))} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium outline-none dark:border-gray-700 dark:bg-gray-900">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
          <button type="button" onClick={() => { loadAnalytics(); loadVisitors(); }} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800">
            <RefreshCw className={`h-4 w-4 ${loading || visitorsLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">{error}</div>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {statCards.map(card => {
          const Icon = card.icon;
          return <Card key={card.label} className="p-4"><div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{card.label}</span><Icon className="h-4 w-4 text-indigo-500" /></div><p className="mt-3 text-2xl font-bold">{loading && !overview ? '—' : numberFormat(card.value)}</p></Card>;
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle icon={Target} title="Conversion funnel" subtitle={`Visitor movement across the last ${days} days`} />
          {funnel.length ? <div className="space-y-4">{funnel.map(item => <div key={item.stage}><div className="mb-1 flex justify-between text-xs"><span className="font-semibold">{item.stage}</span><span className="text-gray-500">{numberFormat(item.visitor_count)} · {Number(item.conversion_rate || 0).toFixed(1)}%</span></div><div className="h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400" style={{ width: `${Math.max(2, (Number(item.visitor_count) / maxFunnelCount) * 100)}%` }} /></div></div>)}</div> : <EmptyState />}
        </Card>

        <Card>
          <SectionTitle icon={Target} title="Lead-score distribution" subtitle="Current lead intent" />
          {scoreDistribution.length ? <div className="space-y-4">{scoreDistribution.map(item => <div key={item.score_range}><div className="mb-1 flex justify-between text-xs"><span>{item.score_range}</span><strong>{numberFormat(item.count)}</strong></div><div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.max(2, (Number(item.count) / maxScoreCount) * 100)}%` }} /></div></div>)}</div> : <EmptyState />}
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <SectionTitle icon={Globe2} title="Top pages" subtitle={`Most viewed pages in the last ${days} days`} />
          {topPages.length ? <div className="space-y-3">{topPages.map(item => <div key={item.page}><div className="flex items-center justify-between gap-3 text-xs"><span className="truncate font-medium" title={item.page}>{item.page}</span><span className="shrink-0 text-gray-500">{numberFormat(item.views)} views · {numberFormat(item.unique_visitors)} unique</span></div><div className="mt-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(2, (Number(item.views) / maxPageViews) * 100)}%` }} /></div></div>)}</div> : <EmptyState />}
        </Card>

        <Card>
          <SectionTitle icon={Activity} title="Top events" subtitle={`Most frequent telemetry events in the last ${days} days`} />
          {topEvents.length ? <div className="space-y-3">{topEvents.map(item => <div key={item.event_name} className="flex items-center gap-3"><span className="min-w-0 flex-1 truncate text-xs font-medium">{item.event_name}</span><span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">{item.category || 'Other'}</span><div className="w-24"><div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.max(4, (Number(item.count) / maxEventCount) * 100)}%` }} /></div></div><strong className="w-12 text-right text-xs">{numberFormat(item.count)}</strong></div>)}</div> : <EmptyState />}
        </Card>
      </div>

      <Card>
        <SectionTitle icon={MapPin} title="UTM performance" subtitle={`Campaign sessions and conversion in the last ${days} days`} />
        {utmPerformance.length ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-500 dark:border-gray-800"><tr><th className="pb-3">Source</th><th className="pb-3">Medium</th><th className="pb-3">Campaign</th><th className="pb-3 text-right">Sessions</th><th className="pb-3 text-right">Conversions</th><th className="pb-3 text-right">Avg. duration</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{utmPerformance.map((item, index) => <tr key={`${item.utm_source}-${item.utm_medium}-${item.utm_campaign}-${index}`}><td className="py-3 font-semibold">{item.utm_source || '—'}</td><td className="py-3">{item.utm_medium || '—'}</td><td className="py-3">{item.utm_campaign || '—'}</td><td className="py-3 text-right">{numberFormat(item.session_count)}</td><td className="py-3 text-right font-semibold text-emerald-600">{numberFormat(item.conversion_count)}</td><td className="py-3 text-right">{durationFormat(item.avg_duration_seconds)}</td></tr>)}</tbody></table></div> : <EmptyState />}
      </Card>

      <Card>
        <SectionTitle icon={BarChart3} title="Business snapshot" subtitle="Analytics dashboard totals from the backend" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['New enquiries today', businessDashboard?.today?.new_enquiries],
            ['New bookings today', businessDashboard?.today?.new_bookings],
            ['Today revenue', moneyFormat(businessDashboard?.today?.revenue)],
            ['Pending collections', moneyFormat(businessDashboard?.today?.pending_collections)],
            ['Confirmed revenue', moneyFormat(businessDashboard?.future_business?.confirmed_revenue)],
            ['Projected profit', moneyFormat(businessDashboard?.future_business?.projected_profit)],
            ['Confirmed bookings', businessDashboard?.pipeline?.confirmed_bookings_count],
            ['Pipeline conversion', `${Number(businessDashboard?.pipeline?.conversion_rate || 0).toFixed(1)}%`],
          ].map(([label, value]) => <div key={label} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60"><p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p><p className="mt-1 text-lg font-bold">{value ?? '—'}</p></div>)}
        </div>
      </Card>

      <Card>
        <SectionTitle icon={Users} title="Tracked visitors" subtitle="Search and inspect visitor sessions and recent events" action={<div className="flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Realtime enabled</div>} />
        <div className="mb-4 flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={visitorSearchInput} onChange={event => setVisitorSearchInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { setVisitorPage(1); setVisitorSearch(visitorSearchInput); } }} placeholder="Search fingerprint, IP, city, country, browser..." className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-900" /></div><button type="button" onClick={() => { setVisitorPage(1); setVisitorSearch(visitorSearchInput); }} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Search</button></div>
        {visitorsLoading ? <div className="flex justify-center p-10"><RefreshCw className="h-5 w-5 animate-spin text-indigo-500" /></div> : visitors.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-500 dark:border-gray-800"><tr><th className="pb-3">Visitor</th><th className="pb-3">Location</th><th className="pb-3">Device</th><th className="pb-3">Last seen</th><th className="pb-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{visitors.map(visitor => <tr key={visitor.id}><td className="py-3"><p className="font-semibold">{visitor.visitor_code || visitor.id?.slice(0, 8)}</p><p className="mt-0.5 text-gray-500">{visitor.fingerprint || 'No fingerprint'}</p></td><td className="py-3">{[visitor.city, visitor.country].filter(Boolean).join(', ') || 'Unknown'}</td><td className="py-3">{[visitor.device, visitor.browser, visitor.os].filter(Boolean).join(' · ') || 'Unknown'}</td><td className="py-3 text-gray-500">{dateFormat(visitor.last_seen)}</td><td className="py-3 text-right"><button type="button" onClick={() => openVisitor(visitor)} className="rounded-lg border border-gray-200 px-2.5 py-1.5 font-semibold text-indigo-600 hover:bg-indigo-50 dark:border-gray-700 dark:hover:bg-indigo-950/30">View details</button></td></tr>)}</tbody></table></div> : <EmptyState message="No visitors match this search." />}
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-xs dark:border-gray-800"><span className="text-gray-500">{numberFormat(visitorPagination.total_items)} total visitors</span><div className="flex items-center gap-2"><button type="button" disabled={!visitorPagination.has_previous} onClick={() => setVisitorPage(page => Math.max(1, page - 1))} className="rounded-lg border border-gray-200 p-1.5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700"><ChevronLeft className="h-4 w-4" /></button><span>Page {visitorPage} of {pageTotal}</span><button type="button" disabled={!visitorPagination.has_next} onClick={() => setVisitorPage(page => page + 1)} className="rounded-lg border border-gray-200 p-1.5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700"><ChevronRight className="h-4 w-4" /></button></div></div>
      </Card>

      {lastRealtimeEvent && <p className="text-right text-[11px] text-gray-400">Last realtime event: <span className="font-semibold">{lastRealtimeEvent.event}</span> · {dateFormat(lastRealtimeEvent.receivedAt)}</p>}

      {selectedVisitor && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedVisitor(null); }}><div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-900"><div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-500">Visitor profile</p><h2 className="mt-1 text-xl font-bold">{selectedVisitor.visitor?.visitor_code || selectedVisitor.visitor?.id}</h2><p className="mt-1 text-xs text-gray-500">{selectedVisitor.visitor?.fingerprint || 'No fingerprint'}</p></div><button type="button" onClick={() => setSelectedVisitor(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-5 w-5" /></button></div>{detailsLoading ? <div className="flex justify-center p-10"><RefreshCw className="h-5 w-5 animate-spin" /></div> : <div className="grid gap-5 lg:grid-cols-2"><div><h3 className="mb-3 font-semibold">Sessions ({numberFormat(selectedVisitor.total_sessions)})</h3><div className="space-y-2">{(selectedVisitor.sessions || []).map(session => <div key={session.id} className="rounded-xl bg-gray-50 p-3 text-xs dark:bg-gray-800/60"><div className="flex justify-between gap-3"><span className="font-semibold">{session.landing_page || 'Unknown landing page'}</span><span className="text-gray-500">{durationFormat(session.duration_seconds)}</span></div><p className="mt-1 text-gray-500">{numberFormat(session.page_views)} page views · {dateFormat(session.started_at)}</p><p className="mt-1 text-gray-500">{session.utm_source || session.utm_medium || session.utm_campaign ? [session.utm_source, session.utm_medium, session.utm_campaign].filter(Boolean).join(' / ') : 'No campaign data'}</p></div>)}{!selectedVisitor.sessions?.length && <EmptyState message="No sessions recorded." />}</div></div><div><h3 className="mb-3 font-semibold">Recent events ({numberFormat(selectedVisitor.total_events)})</h3><div className="space-y-2">{(selectedVisitor.recent_events || []).map(event => <div key={event.id} className="flex gap-3 rounded-xl bg-gray-50 p-3 text-xs dark:bg-gray-800/60"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" /><div><p className="font-semibold">{event.event_name}</p><p className="mt-1 text-gray-500">{event.page || 'Unknown page'} · {dateFormat(event.created_at)}</p></div></div>)}{!selectedVisitor.recent_events?.length && <EmptyState message="No events recorded." />}</div></div></div>}</div></div>}
    </div>
  );
};

export default Analytics;
