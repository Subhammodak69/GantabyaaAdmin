import { apiCall } from '../utils/apiCall';

const ANALYTICS_BASE = '/api/v1/admin/analytics';

async function readResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || payload?.detail || fallbackMessage);
  }
  return payload;
}

export async function fetchAnalyticsOverview() {
  const response = await apiCall(`${ANALYTICS_BASE}/overview`, 'GET');
  const payload = await readResponse(response, 'Unable to load analytics overview.');
  return payload.data || {};
}

export async function fetchLiveStats() {
  const response = await apiCall(`${ANALYTICS_BASE}/live`, 'GET');
  const payload = await readResponse(response, 'Unable to load live visitor activity.');
  return payload.data || { active_visitors: [] };
}

export async function fetchVisitors({ search = '', page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (search.trim()) params.set('search', search.trim());
  const response = await apiCall(`${ANALYTICS_BASE}/visitors?${params.toString()}`, 'GET');
  const payload = await readResponse(response, 'Unable to load visitors.');
  return { items: Array.isArray(payload.data) ? payload.data : [], pagination: payload.pagination || {} };
}

export async function fetchVisitorDetails(visitorId) {
  const response = await apiCall(`${ANALYTICS_BASE}/visitors/${encodeURIComponent(visitorId)}`, 'GET');
  const payload = await readResponse(response, 'Unable to load visitor details.');
  return payload.data || null;
}

async function fetchAnalyticsList(path, params, fallbackMessage) {
  const query = new URLSearchParams(params);
  const response = await apiCall(`${ANALYTICS_BASE}/${path}?${query.toString()}`, 'GET');
  const payload = await readResponse(response, fallbackMessage);
  return Array.isArray(payload.data) ? payload.data : [];
}

export function fetchTopPages(days = 30, limit = 10) {
  return fetchAnalyticsList('top-pages', { days, limit }, 'Unable to load top pages.');
}

export function fetchTopEvents(days = 30, limit = 15) {
  return fetchAnalyticsList('top-events', { days, limit }, 'Unable to load top events.');
}

export function fetchUtmPerformance(days = 30) {
  return fetchAnalyticsList('utm-performance', { days }, 'Unable to load UTM performance.');
}

export async function fetchLeadScoreDistribution() {
  return fetchAnalyticsList('lead-score-distribution', {}, 'Unable to load lead-score distribution.');
}

export function fetchConversionFunnel(days = 30) {
  return fetchAnalyticsList('funnel', { days }, 'Unable to load conversion funnel.');
}

export async function fetchAnalyticsDashboard() {
  const response = await apiCall(`${ANALYTICS_BASE}/dashboard`, 'GET');
  const payload = await readResponse(response, 'Unable to load analytics dashboard.');
  return payload.data || {};
}

