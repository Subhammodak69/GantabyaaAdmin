import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Phone,
  Mail,
  Clock,
  TrendingUp,
  FileText,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  MessageSquare,
  AlertCircle,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import Modal from '../component/common/Modal';
import ConfirmDeleteModal from '../component/common/ConfirmDeleteModal';
import CustomDatePicker from '../component/common/CustomDatePicker';
import SelectField from '../component/common/SelectField';
import ActionMenu from '../component/common/ActionMenu';
import Pagination from '../component/common/PaginationComponent';
import { apiCall, handleApiError } from '../utils/apiCall';

const CHANNELS = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'CALL', label: 'Phone Call' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'SMS', label: 'SMS' },
  { value: 'IN_PERSON', label: 'In Person / Meeting' },
  { value: 'NOTE', label: 'Internal Note' },
];

const ACTIVITY_TYPES = [
  { value: 'CALL', label: 'Phone Call' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'NOTE', label: 'Note' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'MESSAGE', label: 'Message / Chat' },
  { value: 'FOLLOW_UP', label: 'Follow Up' },
  { value: 'DEMO', label: 'Demo / Briefing' },
];

const LEAD_STATUSES = [
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'PROPOSAL_SENT', label: 'Proposal Sent' },
  { value: 'FOLLOW_UP', label: 'Follow Up' },
  { value: 'WON', label: 'Won / Converted' },
  { value: 'LOST', label: 'Lost' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const LOST_REASONS = [
  { value: 'PRICE_TOO_HIGH', label: 'Price Too High' },
  { value: 'COMPETITOR', label: 'Chosen Competitor' },
  { value: 'NO_RESPONSE', label: 'No Response / Ghosted' },
  { value: 'NOT_INTERESTED', label: 'Not Interested' },
  { value: 'CHANGE_OF_PLANS', label: 'Change of Plans / Postponed' },
  { value: 'DATES_UNAVAILABLE', label: 'Dates Unavailable' },
  { value: 'OTHER', label: 'Other Reason' },
];

const channelBadgeColors = {
  WHATSAPP: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
  CALL: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
  EMAIL: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800',
  SMS: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800',
  IN_PERSON: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
  NOTE: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
};

const statusBadgeClasses = {
  NEW: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
  CONTACTED: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800',
  QUALIFIED: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
  PROPOSAL_SENT: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800',
  FOLLOW_UP: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800',
  WON: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
  CONVERTED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
  LOST: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
  CANCELLED: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
};

const formatShortDate = (value) => {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
};

const LeadManagement = () => {
  const navigate = useNavigate();
  const { enquiryId, leadId: routeLeadId } = useParams();
  const location = useLocation();
  const stateEnquiry = location.state?.enquiry || null;

  // Enquiry & Lead data
  const [enquiry, setEnquiry] = useState(stateEnquiry);
  const [lead, setLead] = useState(stateEnquiry?.lead || null);
  const [loadingEnquiry, setLoadingEnquiry] = useState(!stateEnquiry);

  // Resolved lead ID: from lead object, route, or state
  const effectiveLeadId = lead?.id || routeLeadId || stateEnquiry?.lead?.id || '';

  // Activities state
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [activityPageSize, setActivityPageSize] = useState(10);
  const [totalActivities, setTotalActivities] = useState(0);
  const [channelFilter, setChannelFilter] = useState('ALL');

  // Staff accounts
  const [staffAccounts, setStaffAccounts] = useState([]);
  const [staffMap, setStaffMap] = useState({});

  // Destination & Package labels
  const [destinationName, setDestinationName] = useState('');
  const [packageName, setPackageName] = useState('');

  // Modals state
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [activityForm, setActivityForm] = useState({
    channel: 'WHATSAPP',
    activity_type: 'CALL',
    notes: '',
    next_follow_up_at: '',
    account_id: '',
    user_id: '',
  });

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusForm, setStatusForm] = useState({
    status: 'NEW',
    lost_reason: 'PRICE_TOO_HIGH',
    lost_reason_notes: '',
  });

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    assigned_account_id: '',
  });

  const [savingAction, setSavingAction] = useState(false);
  const [isDeleteActivityModalOpen, setIsDeleteActivityModalOpen] = useState(false);
  const [deleteActivityTarget, setDeleteActivityTarget] = useState(null);
  const [deletingActivity, setDeletingActivity] = useState(false);

  // Fetch Staff Accounts
  const loadStaffAccounts = useCallback(async () => {
    try {
      const res = await apiCall('/api/v1/admin/account?page=1&page_size=100', 'GET');
      const payload = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(payload?.data)) {
        const opts = payload.data.map((a) => ({
          value: a.id,
          label: `${a.name} (${a.role || 'Staff'})`,
        }));
        setStaffAccounts(opts);
        const map = {};
        payload.data.forEach((a) => {
          map[a.id] = a.name;
        });
        setStaffMap(map);
      }
    } catch (e) {
      console.error('Failed to load accounts:', e);
    }
  }, []);

  useEffect(() => {
    loadStaffAccounts();
  }, [loadStaffAccounts]);

  // Load Enquiry & Lead if needed
  const loadEnquiryAndLead = useCallback(async () => {
    if (!enquiryId && !routeLeadId) return;
    setLoadingEnquiry(true);
    try {
      if (enquiryId) {
        // Fetch enquiry details
        const res = await apiCall(`/api/v1/admin/enquiries/${enquiryId}`, 'GET');
        const payload = await res.json().catch(() => ({}));
        if (res.ok && payload?.data) {
          setEnquiry(payload.data);
          if (payload.data.lead) {
            setLead(payload.data.lead);
          }
        }

        // Fetch lead details for enquiry if separate endpoint exists
        try {
          const leadRes = await apiCall(`/api/v1/admin/enquiries/${enquiryId}/lead`, 'GET');
          const leadPayload = await leadRes.json().catch(() => ({}));
          if (leadRes.ok && leadPayload?.data) {
            setLead(leadPayload.data);
          }
        } catch {
          // fallback to enquiry.lead
        }
      }
    } catch (error) {
      handleApiError(error, 'Unable to load enquiry details');
    } finally {
      setLoadingEnquiry(false);
    }
  }, [enquiryId, routeLeadId]);

  useEffect(() => {
    if (!stateEnquiry) {
      loadEnquiryAndLead();
    } else {
      setEnquiry(stateEnquiry);
      setLead(stateEnquiry.lead || null);
    }
  }, [stateEnquiry, loadEnquiryAndLead]);

  useEffect(() => {
    const handleRealtimeEvent = (event) => {
      const { event: eventName, payload } = event.detail || {};
      if (eventName !== 'lead:score_updated' || payload?.lead_id !== effectiveLeadId) return;
      setLead((current) => current ? { ...current, lead_score: payload.new_score } : current);
      setEnquiry((current) => current
        ? { ...current, lead: { ...(current.lead || {}), lead_score: payload.new_score } }
        : current);
    };

    window.addEventListener('cobtravels:realtime:event', handleRealtimeEvent);
    return () => window.removeEventListener('cobtravels:realtime:event', handleRealtimeEvent);
  }, [effectiveLeadId]);

  // Load Destination / Package Names
  useEffect(() => {
    if (enquiry?.destination_id) {
      apiCall(`/api/v1/admin/destinations/${enquiry.destination_id}`, 'GET')
        .then((r) => r.json())
        .then((d) => {
          if (d?.data?.name) setDestinationName(d.data.name);
        })
        .catch(() => {});
    }
    if (enquiry?.package_id) {
      apiCall(`/api/v1/admin/tour-packages/${enquiry.package_id}`, 'GET')
        .then((r) => r.json())
        .then((d) => {
          if (d?.data?.title) setPackageName(d.data.title);
        })
        .catch(() => {});
    }
  }, [enquiry]);

  // Load Activities API: GET /api/v1/admin/leads/{leadId}/activities
  const loadActivities = useCallback(
    async (page = activityPage, limit = activityPageSize) => {
      const activeId = effectiveLeadId;
      if (!activeId) return;

      setLoadingActivities(true);
      try {
        const queryParams = new URLSearchParams({ page, page_size: limit });
        const res = await apiCall(
          `/api/v1/admin/leads/${encodeURIComponent(activeId)}/activities?${queryParams.toString()}`,
          'GET'
        );
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload?.message || payload?.detail || 'Unable to fetch activities');
        }
        const data = Array.isArray(payload?.data) ? payload.data : [];
        setActivities(data);
        setTotalActivities(payload?.pagination?.total_items ?? data.length);
      } catch (error) {
        handleApiError(error, 'Unable to load lead activities');
      } finally {
        setLoadingActivities(false);
      }
    },
    [effectiveLeadId, activityPage, activityPageSize]
  );

  useEffect(() => {
    if (effectiveLeadId) {
      loadActivities(activityPage, activityPageSize);
    }
  }, [effectiveLeadId, loadActivities, activityPage, activityPageSize]);

  // Open Log Activity Modal
  const openCreateActivityModal = () => {
    setEditingActivity(null);
    setActivityForm({
      channel: 'WHATSAPP',
      activity_type: 'CALL',
      notes: '',
      next_follow_up_at: '',
      account_id: lead?.assigned_account_id || '',
      user_id: '',
    });
    setIsActivityModalOpen(true);
  };

  // Open Edit Activity Modal
  const openEditActivityModal = (activity) => {
    setEditingActivity(activity);
    // Format date for datetime-local input if present
    let formattedFollowUp = '';
    if (activity.next_follow_up_at) {
      try {
        formattedFollowUp = new Date(activity.next_follow_up_at).toISOString().slice(0, 16);
      } catch {
        formattedFollowUp = activity.next_follow_up_at;
      }
    }

    setActivityForm({
      channel: activity.channel || 'WHATSAPP',
      activity_type: activity.activity_type || 'CALL',
      notes: activity.notes || '',
      next_follow_up_at: formattedFollowUp,
      account_id: activity.account_id || '',
      user_id: activity.user_id || '',
    });
    setIsActivityModalOpen(true);
  };

  // Submit Activity (POST / PATCH)
  const handleActivitySubmit = async (e) => {
    e.preventDefault();
    if (!effectiveLeadId) {
      toast.error('Lead identifier not found.');
      return;
    }
    if (!activityForm.notes.trim()) {
      toast.error('Please enter activity notes.');
      return;
    }

    setSavingAction(true);
    try {
      let isoFollowUp = undefined;
      if (activityForm.next_follow_up_at) {
        try {
          isoFollowUp = new Date(activityForm.next_follow_up_at).toISOString();
        } catch {
          isoFollowUp = activityForm.next_follow_up_at;
        }
      }

      let res;
      if (editingActivity) {
        // PATCH /api/v1/admin/leads/{leadId}/activities/{activityId}
        const payload = {
          channel: activityForm.channel,
          activity_type: activityForm.activity_type,
          notes: activityForm.notes.trim(),
          ...(isoFollowUp ? { next_follow_up_at: isoFollowUp } : {}),
        };
        res = await apiCall(
          `/api/v1/admin/leads/${encodeURIComponent(effectiveLeadId)}/activities/${editingActivity.id}`,
          'PATCH',
          payload
        );
      } else {
        // POST /api/v1/admin/leads/{leadId}/activities
        const payload = {
          channel: activityForm.channel,
          activity_type: activityForm.activity_type,
          notes: activityForm.notes.trim(),
          ...(isoFollowUp ? { next_follow_up_at: isoFollowUp } : {}),
          ...(activityForm.account_id ? { account_id: activityForm.account_id } : {}),
          ...(activityForm.user_id ? { user_id: activityForm.user_id } : {}),
        };
        res = await apiCall(
          `/api/v1/admin/leads/${encodeURIComponent(effectiveLeadId)}/activities`,
          'POST',
          payload
        );
      }

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData?.message || resData?.detail || 'Unable to save activity');
      }

      toast.success(
        resData?.message || (editingActivity ? 'Activity updated' : 'Activity logged successfully')
      );
      setIsActivityModalOpen(false);
      loadActivities(activityPage, activityPageSize);
    } catch (error) {
      handleApiError(error, 'Unable to save activity');
    } finally {
      setSavingAction(false);
    }
  };

  // Delete Activity (DELETE)
  const handleDeleteActivity = (activity) => {
    setDeleteActivityTarget(activity);
    setIsDeleteActivityModalOpen(true);
  };

  const confirmDeleteActivity = async () => {
    if (!deleteActivityTarget) return;
    setDeletingActivity(true);
    try {
      const res = await apiCall(
        `/api/v1/admin/leads/${encodeURIComponent(effectiveLeadId)}/activities/${deleteActivityTarget.id}`,
        'DELETE'
      );
      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData?.message || 'Unable to delete activity');
      }
      toast.success(resData?.message || 'Activity deleted successfully');
      setIsDeleteActivityModalOpen(false);
      setDeleteActivityTarget(null);
      loadActivities(activityPage, activityPageSize);
    } catch (error) {
      handleApiError(error, 'Unable to delete activity');
    } finally {
      setDeletingActivity(false);
    }
  };

  // Open Status Modal
  const openStatusModal = () => {
    setStatusForm({
      status: lead?.status || enquiry?.status || 'NEW',
      lost_reason: lead?.lost_reason || 'PRICE_TOO_HIGH',
      lost_reason_notes: lead?.lost_reason_notes || '',
    });
    setIsStatusModalOpen(true);
  };

  // Submit Status (PATCH /api/v1/admin/leads/{leadId}/status)
  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!effectiveLeadId) {
      toast.error('Lead identifier not found.');
      return;
    }

    setSavingAction(true);
    try {
      const payload = {
        status: statusForm.status,
      };
      if (statusForm.status === 'LOST') {
        payload.lost_reason = statusForm.lost_reason;
        payload.lost_reason_notes = statusForm.lost_reason_notes.trim();
      }

      const res = await apiCall(
        `/api/v1/admin/leads/${encodeURIComponent(effectiveLeadId)}/status`,
        'PATCH',
        payload
      );
      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData?.message || resData?.detail || 'Unable to update status');
      }

      toast.success(resData?.message || 'Lead status updated');
      setLead((prev) => ({
        ...prev,
        status: statusForm.status,
        ...(statusForm.status === 'LOST'
          ? {
              lost_reason: statusForm.lost_reason,
              lost_reason_notes: statusForm.lost_reason_notes,
            }
          : {}),
      }));
      setEnquiry((prev) => (prev ? { ...prev, status: statusForm.status } : prev));
      setIsStatusModalOpen(false);
    } catch (error) {
      handleApiError(error, 'Unable to update status');
    } finally {
      setSavingAction(false);
    }
  };

  // Open Assignment Modal
  const openAssignModal = () => {
    setAssignForm({
      assigned_account_id: lead?.assigned_account_id || '',
    });
    setIsAssignModalOpen(true);
  };

  // Submit Assignment (PUT /api/v1/admin/leads/{leadId}/assignment)
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!effectiveLeadId) {
      toast.error('Lead identifier not found.');
      return;
    }
    if (!assignForm.assigned_account_id) {
      toast.error('Please choose a staff member to assign.');
      return;
    }

    setSavingAction(true);
    try {
      const payload = {
        assigned_account_id: assignForm.assigned_account_id,
      };

      const res = await apiCall(
        `/api/v1/admin/leads/${encodeURIComponent(effectiveLeadId)}/assignment`,
        'PUT',
        payload
      );
      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData?.message || resData?.detail || 'Unable to assign lead');
      }

      toast.success(resData?.message || 'Lead assigned successfully');
      setLead((prev) => ({
        ...prev,
        assigned_account_id: assignForm.assigned_account_id,
      }));
      setIsAssignModalOpen(false);
    } catch (error) {
      handleApiError(error, 'Unable to assign lead');
    } finally {
      setSavingAction(false);
    }
  };

  // Filtered activities
  const filteredActivities = useMemo(() => {
    if (channelFilter === 'ALL') return activities;
    return activities.filter((a) => a.channel === channelFilter);
  }, [activities, channelFilter]);

  const assignedStaffName =
    staffMap[lead?.assigned_account_id] || (lead?.assigned_account_id ? 'Assigned' : 'Unassigned');

  if (loadingEnquiry) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-sm text-gray-500">
        <RefreshCw className="mb-2 h-6 w-6 animate-spin text-indigo-500" />
        Loading lead details...
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      {/* ── Breadcrumb & Back ── */}
      <div className="px-2">
        <button
          type="button"
          aria-label="Back to enquiries"
          title="Back to enquiries"
          onClick={() => navigate('/enquiries')}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back to enquiries</span>
        </button>

        {/* ── Lead Context Hero Banner ── */}
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {enquiry?.enquirer_name || enquiry?.name || 'Customer Lead'}
                </h1>
                {enquiry?.enquiry_code && (
                  <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900">
                    {enquiry.enquiry_code}
                  </span>
                )}
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    statusBadgeClasses[lead?.status || enquiry?.status] || statusBadgeClasses.NEW
                  }`}
                >
                  {lead?.status || enquiry?.status || 'NEW'}
                </span>
                {lead?.lead_score !== undefined && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
                    <Sparkles className="h-3 w-3" /> Score: {lead.lead_score}
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                {(enquiry?.enquirer_phone || enquiry?.phone) && (
                  <a
                    href={`tel:${enquiry.enquirer_phone || enquiry.phone}`}
                    className="flex items-center gap-1 text-gray-600 hover:text-indigo-600 dark:text-gray-300"
                  >
                    <Phone className="h-3.5 w-3.5 text-emerald-500" />
                    <span>{enquiry.enquirer_phone || enquiry.phone}</span>
                  </a>
                )}
                {(enquiry?.enquirer_email || enquiry?.email) && (
                  <a
                    href={`mailto:${enquiry.enquirer_email || enquiry.email}`}
                    className="flex items-center gap-1 text-gray-600 hover:text-indigo-600 dark:text-gray-300"
                  >
                    <Mail className="h-3.5 w-3.5 text-blue-400" />
                    <span>{enquiry.enquirer_email || enquiry.email}</span>
                  </a>
                )}
                <span className="flex items-center gap-1">
                  <UserCheck className="h-3.5 w-3.5 text-indigo-500" />
                  Staff: <strong className="text-gray-700 dark:text-gray-200">{assignedStaffName}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-label="Assign staff"
              title="Assign staff"
              onClick={openAssignModal}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-semibold text-gray-700 shadow-xs transition hover:bg-gray-50 sm:px-3.5 sm:py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <UserCheck className="h-4 w-4 text-indigo-500" /> <span className="hidden sm:inline">Assign Staff</span>
            </button>
            <button
              type="button"
              aria-label="Change status"
              title="Change status"
              onClick={openStatusModal}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-semibold text-gray-700 shadow-xs transition hover:bg-gray-50 sm:px-3.5 sm:py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <Pencil className="h-4 w-4 text-blue-500" /> <span className="hidden sm:inline">Change Status</span>
            </button>
            <button
              type="button"
              aria-label="Log activity"
              title="Log activity"
              onClick={openCreateActivityModal}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 p-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 sm:px-4 sm:py-2"
            >
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Log Activity</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div className="grid gap-5 px-2 lg:grid-cols-12">
        {/* Left Column (5 cols): Enquiry Info, Customer Profile & Lead Status Details */}
        <div className="space-y-4 lg:col-span-5">
          {/* Customer & Enquiry Summary Card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Enquiry Requirements</h3>
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {enquiry?.enquiry_type?.replace(/_/g, ' ') || 'Fixed Tour'}
              </span>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              {destinationName && (
                <div className="flex items-start justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Destination</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{destinationName}</span>
                </div>
              )}

              {packageName && (
                <div className="flex items-start justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Tour Package</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400 max-w-[200px] text-right truncate">
                    {packageName}
                  </span>
                </div>
              )}

              {enquiry?.travel_date && (
                <div className="flex items-start justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Travel Date</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatShortDate(enquiry.travel_date)}
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between">
                <span className="text-gray-500 dark:text-gray-400">Duration</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {enquiry?.travel_duration_day || 1} Days / {enquiry?.travel_duration_night || 1} Nights
                </span>
              </div>

              <div className="flex items-start justify-between">
                <span className="text-gray-500 dark:text-gray-400">Travelers (Pax)</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {enquiry?.adult_count || 1} Adults
                  {Number(enquiry?.child_count) > 0 ? `, ${enquiry.child_count} Children` : ''}
                  {Number(enquiry?.senior_count) > 0 ? `, ${enquiry.senior_count} Seniors` : ''}
                </span>
              </div>

              {(enquiry?.budget_min || enquiry?.budget_max) ? (
                <div className="flex items-start justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Budget Range</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    ₹ {enquiry.budget_min?.toLocaleString() || '0'} - ₹ {enquiry.budget_max?.toLocaleString() || '0'}
                  </span>
                </div>
              ) : null}

              {enquiry?.meal_plan && (
                <div className="flex items-start justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Meal Plan</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{enquiry.meal_plan}</span>
                </div>
              )}

              {enquiry?.channel && (
                <div className="flex items-start justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Acquisition Channel</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{enquiry.channel}</span>
                </div>
              )}

              {enquiry?.message && (
                <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/40">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                    Customer Message
                  </span>
                  <p className="text-gray-700 dark:text-gray-300 italic">&ldquo;{enquiry.message}&rdquo;</p>
                </div>
              )}

              {enquiry?.special_requirements && (
                <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50/50 p-3 dark:border-amber-900/30 dark:bg-amber-900/10">
                  <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider block mb-1">
                    Special Requirements
                  </span>
                  <p className="text-gray-700 dark:text-gray-300">{enquiry.special_requirements}</p>
                </div>
              )}
            </div>
          </div>

          {/* Lead Lifecycle & Outcome Card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Lead Qualification & Lifecycle</h3>
              <button
                type="button"
                onClick={openStatusModal}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
              >
                Edit status
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Current Status</span>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    statusBadgeClasses[lead?.status || enquiry?.status] || statusBadgeClasses.NEW
                  }`}
                >
                  {lead?.status || enquiry?.status || 'NEW'}
                </span>
              </div>

              {lead?.status === 'LOST' && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-900/20">
                  <div className="flex items-center gap-1.5 font-semibold text-red-700 dark:text-red-300 mb-1">
                    <AlertCircle className="h-4 w-4" /> Lost Reason: {lead.lost_reason?.replace(/_/g, ' ') || 'Not specified'}
                  </div>
                  {lead.lost_reason_notes && (
                    <p className="text-xs text-red-600 dark:text-red-400">{lead.lost_reason_notes}</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Assigned Account</span>
                <span className="font-semibold text-gray-900 dark:text-white">{assignedStaffName}</span>
              </div>

              {lead?.last_contacted_at && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Last Contacted</span>
                  <span className="text-gray-700 dark:text-gray-300">{formatDate(lead.last_contacted_at)}</span>
                </div>
              )}

              {lead?.qualified_at && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Qualified At</span>
                  <span className="text-gray-700 dark:text-gray-300">{formatDate(lead.qualified_at)}</span>
                </div>
              )}

              {lead?.converted_at && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Converted At</span>
                  <span className="text-emerald-600 font-semibold">{formatDate(lead.converted_at)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Lead Activities & Follow-up Timeline */}
        <div className="space-y-4 lg:col-span-7">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-700 dark:bg-gray-900">
            {/* Activities Header & Filter */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Activity Timeline</h3>
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                    {totalActivities}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Calls, WhatsApp messages, meetings, and follow-up notes.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadActivities(activityPage, activityPageSize)}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-2 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  title="Refresh activities"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingActivities ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={openCreateActivityModal}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Log activity
                </button>
              </div>
            </div>

            {/* Channel filter buttons */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-gray-400 mr-1">Filter:</span>
              {[{ value: 'ALL', label: 'All Channels' }, ...CHANNELS].map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setChannelFilter(c.value)}
                  className={[
                    'rounded-lg px-2.5 py-1 text-xs font-medium transition',
                    channelFilter === c.value
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300',
                  ].join(' ')}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Activities List / Empty State */}
            <div className="mt-4">
              {loadingActivities ? (
                <div className="flex items-center justify-center py-16 text-xs text-gray-500">
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin text-indigo-500" />
                  Loading lead activities...
                </div>
              ) : filteredActivities.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-12 text-center dark:border-gray-800 dark:bg-gray-800/30">
                  <MessageSquare className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No activities logged yet</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Record calls, meetings, WhatsApp conversations, or notes with this customer.
                  </p>
                  <button
                    type="button"
                    onClick={openCreateActivityModal}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> Log first activity
                  </button>
                </div>
              ) : (
                <div className="relative space-y-4 before:absolute before:bottom-2 before:left-5 before:top-2 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-800">
                  {filteredActivities.map((act) => {
                    const chColor =
                      channelBadgeColors[act.channel] ||
                      'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300';

                    return (
                      <div key={act.id} className="relative flex items-start gap-4">
                        {/* Circle Timeline Marker */}
                        <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-xs dark:border-gray-700 dark:bg-gray-800">
                          {act.channel === 'WHATSAPP' ? (
                            <MessageSquare className="h-4 w-4 text-emerald-500" />
                          ) : act.channel === 'CALL' ? (
                            <Phone className="h-4 w-4 text-blue-500" />
                          ) : act.channel === 'EMAIL' ? (
                            <Mail className="h-4 w-4 text-indigo-500" />
                          ) : (
                            <FileText className="h-4 w-4 text-purple-500" />
                          )}
                        </div>

                        {/* Activity Card */}
                        <div className="flex-1 rounded-xl border border-gray-200 bg-white p-4 shadow-xs transition hover:shadow-sm dark:border-gray-700 dark:bg-gray-850">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${chColor}`}>
                                {act.channel}
                              </span>
                              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                {act.activity_type}
                              </span>
                              <span className="text-[11px] text-gray-400">
                                {formatDate(act.created_at)}
                              </span>
                            </div>

                            {/* Action menu for activity */}
                            <ActionMenu
                              menuId={act.id}
                              actions={[
                                {
                                  label: 'Edit Activity',
                                  icon: <Pencil className="h-4 w-4 text-blue-500" />,
                                  onClick: () => openEditActivityModal(act),
                                },
                                {
                                  label: 'Delete Activity',
                                  icon: <Trash2 className="h-4 w-4 text-red-500" />,
                                  onClick: () => handleDeleteActivity(act),
                                  className: 'text-red-600 hover:text-red-700 dark:text-red-400',
                                },
                              ]}
                            />
                          </div>

                          {/* Notes */}
                          <p className="mt-2 text-xs leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                            {act.notes}
                          </p>

                          {/* Next follow up info */}
                          {act.next_follow_up_at && (
                            <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 px-2.5 py-1.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300 w-fit">
                              <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                              <span>Next follow-up: <strong>{formatDate(act.next_follow_up_at)}</strong></span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalActivities > activityPageSize && (
              <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
                <Pagination
                  currentPage={activityPage}
                  totalItems={totalActivities}
                  itemsPerPage={activityPageSize}
                  onPageChange={(p) => setActivityPage(p)}
                  onLimitChange={(size) => {
                    setActivityPageSize(size);
                    setActivityPage(1);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal: Log / Edit Activity ── */}
      <Modal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        title={editingActivity ? 'Edit Activity Entry' : 'Log Lead Activity'}
        icon={MessageSquare}
        size="lg"
        footer={(
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsActivityModalOpen(false)}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="activity-form"
              disabled={savingAction}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {savingAction ? 'Saving...' : editingActivity ? 'Update Activity' : 'Record Activity'}
            </button>
          </div>
        )}
      >
        <form id="activity-form" onSubmit={handleActivitySubmit} className="space-y-4 p-1">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Channel <span className="text-red-500">*</span>
              </label>
              <SelectField
                options={CHANNELS}
                value={CHANNELS.find((c) => c.value === activityForm.channel) || null}
                onChange={(opt) => setActivityForm((p) => ({ ...p, channel: opt?.value || 'WHATSAPP' }))}
                isSearchable={false}
                menuPlacement="bottom"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Activity Type <span className="text-red-500">*</span>
              </label>
              <SelectField
                options={ACTIVITY_TYPES}
                value={ACTIVITY_TYPES.find((t) => t.value === activityForm.activity_type) || null}
                onChange={(opt) => setActivityForm((p) => ({ ...p, activity_type: opt?.value || 'CALL' }))}
                isSearchable={false}
                menuPlacement="bottom"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Activity Notes & Summary <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={activityForm.notes}
              onChange={(e) => setActivityForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Detailed conversation summary, customer questions, quotation feedback, objections, commitments..."
              required
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Next Follow-Up Date & Time <span className="text-xs text-gray-400">(optional)</span>
              </label>
              <CustomDatePicker
                value={activityForm.next_follow_up_at}
                onChange={(value) => setActivityForm((p) => ({ ...p, next_follow_up_at: value }))}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Account / Staff Member <span className="text-xs text-gray-400">(optional)</span>
              </label>
              <SelectField
                options={staffAccounts}
                value={staffAccounts.find((s) => s.value === activityForm.account_id) || null}
                onChange={(opt) => setActivityForm((p) => ({ ...p, account_id: opt?.value || '' }))}
                isSearchable
                placeholder="Select staff member..."
                menuPlacement="bottom"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Update Lead Status ── */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title="Update Lead Status"
        icon={TrendingUp}
        size="md"
        footer={(
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsStatusModalOpen(false)}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="status-form"
              disabled={savingAction}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {savingAction ? 'Saving...' : 'Update Status'}
            </button>
          </div>
        )}
      >
        <form id="status-form" onSubmit={handleStatusSubmit} className="space-y-4 p-1">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Lead Status <span className="text-red-500">*</span>
            </label>
            <SelectField
              options={LEAD_STATUSES}
              value={LEAD_STATUSES.find((s) => s.value === statusForm.status) || null}
              onChange={(opt) => setStatusForm((p) => ({ ...p, status: opt?.value || 'NEW' }))}
              isSearchable={false}
              menuPlacement="bottom"
            />
          </div>

          {statusForm.status === 'LOST' && (
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 space-y-3 dark:border-red-900/40 dark:bg-red-900/10">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-red-800 dark:text-red-300">
                  Lost Reason <span className="text-red-500">*</span>
                </label>
                <SelectField
                  options={LOST_REASONS}
                  value={LOST_REASONS.find((r) => r.value === statusForm.lost_reason) || null}
                  onChange={(opt) => setStatusForm((p) => ({ ...p, lost_reason: opt?.value || 'PRICE_TOO_HIGH' }))}
                  isSearchable={false}
                  menuPlacement="bottom"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-red-700 dark:text-red-400">
                  Lost Reason Notes (optional)
                </label>
                <textarea
                  rows={2}
                  value={statusForm.lost_reason_notes}
                  onChange={(e) => setStatusForm((p) => ({ ...p, lost_reason_notes: e.target.value }))}
                  placeholder="Additional context about why this lead was lost..."
                  className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-xs text-gray-700 outline-none focus:border-red-500 dark:border-red-800 dark:bg-gray-800 dark:text-gray-200"
                />
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* ── Modal: Reassign Lead ── */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Lead to Staff Member"
        icon={UserCheck}
        size="md"
        footer={(
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(false)}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="assign-form"
              disabled={savingAction}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {savingAction ? 'Saving...' : 'Confirm Assignment'}
            </button>
          </div>
        )}
      >
        <form id="assign-form" onSubmit={handleAssignSubmit} className="space-y-4 p-1">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Select Staff Account <span className="text-red-500">*</span>
            </label>
            <SelectField
              options={staffAccounts}
              value={staffAccounts.find((s) => s.value === assignForm.assigned_account_id) || null}
              onChange={(opt) => setAssignForm({ assigned_account_id: opt?.value || '' })}
              isSearchable
              placeholder="Search staff by name..."
              menuPlacement="bottom"
            />
            <p className="mt-1.5 text-xs text-gray-400">
              This staff member will be notified and responsible for managing this lead&apos;s follow-ups.
            </p>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default LeadManagement;
