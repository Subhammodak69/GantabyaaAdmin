import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ManagementTable from '../component/common/ManagementTable';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  HelpCircle,
  Plus,
  Pencil,
  Search,
  RefreshCw,
  Calendar,
  Phone,
  Mail,
  TrendingUp,
  MapPin,
  FileText,
  DollarSign,
  Users as UsersIcon,
  UserCheck,
  UserPlus,
  ArrowLeft,
  ArrowRight,
  Check,
  Filter,
  X,
} from 'lucide-react';
import Modal from '../component/common/Modal';
import CustomDatePicker from '../component/common/CustomDatePicker';
import SelectField from '../component/common/SelectField';
import Pagination from '../component/common/PaginationComponent';
import ActionMenu from '../component/common/ActionMenu';
import { apiCall, handleApiError } from '../utils/apiCall';
import { sanitizeNumericInput } from '../utils/inputValidation';

const ENQUIRY_TYPES = [
  { value: 'FIXED_TOUR', label: 'Fixed Tour' },
  { value: 'CUSTOM_TOUR', label: 'Custom Tour' },
];

const CHANNELS = [
  { value: 'WEBSITE', label: 'Website' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'APP', label: 'Mobile app' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'OFFLINE', label: 'Offline / Walk-in' },
  { value: 'ADMIN', label: 'Admin' },
];

const STATUSES = [
  { value: 'NEW', label: 'New' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'QUOTED', label: 'Quoted' },
  { value: 'CONVERTED', label: 'Converted' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'CLOSED', label: 'Closed' },
];

const MEAL_PLANS = [
  { value: 'ANY', label: 'Any Plan' },
  { value: 'NONE', label: 'None / Room Only' },
  { value: 'CP', label: 'Continental Plan (Breakfast)' },
  { value: 'MAP', label: 'Modified American Plan (Breakfast + Dinner)' },
  { value: 'AP', label: 'American Plan (All Meals)' },
];

const defaultCreateForm = {
  enquiry_type: 'FIXED_TOUR',
  channel: 'WEBSITE',
  name: '',
  phone: '',
  email: '',
  destination_id: '',
  package_id: '',
  variant_id: '',
  hotel_id: '',
  vehicle_id: '',
  customer_id: '',
  visitor_id: '',
  travel_date: '',
  travel_duration_day: 1,
  travel_duration_night: 1,
  adult_count: 1,
  child_count: 0,
  senior_count: 0,
  room_count: 1,
  vehicle_count: 0,
  budget_min: 0,
  budget_max: 0,
  meal_plan: 'ANY',
  message: '',
  special_requirements: '',
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
  if (!value) return 'Flexible';
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

const statusBadgeClasses = {
  NEW: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300',
  IN_PROGRESS: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300',
  QUOTED: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-900/20 dark:text-indigo-300',
  CONVERTED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300',
  CLOSED: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  CANCELLED: 'border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

const EnquiryManagement = () => {
  const navigate = useNavigate();
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Active items
  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [editingEnquiry, setEditingEnquiry] = useState(null);
  const [statusEditForm, setStatusEditForm] = useState({ status: 'NEW', message: '' });

  // Details & Lead Information
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [leadDetails, setLeadDetails] = useState(null);
  const [leadLoading, setLeadLoading] = useState(false);

  // Customer selector state ('SYSTEM' or 'MANUAL')
  const [customerType, setCustomerType] = useState('SYSTEM');
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [selectedCustomerOption, setSelectedCustomerOption] = useState(null);

  // Selection type for Trip (Step 3): 'DESTINATION' or 'PACKAGE'
  const [tripSelectionType, setTripSelectionType] = useState('DESTINATION');

  // Dynamic tour package & variant choices
  const [packageVariants, setPackageVariants] = useState([]);
  const [variantsLoading, setVariantsLoading] = useState(false);

  // Dynamic destination-filtered hotels
  const [destinationHotels, setDestinationHotels] = useState([]);
  const [hotelsLoading, setHotelsLoading] = useState(false);

  // Lookup references (Destinations, Hotels, Tour Packages, Staff)
  const [destinations, setDestinations] = useState([]);
  const [destLoading, setDestLoading] = useState(false);
  const [hotels, setHotels] = useState([]);
  const [packages, setPackages] = useState([]);
  const [staffAccounts, setStaffAccounts] = useState([]);

  // Load Customers for System Customer option
  const loadCustomersList = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const res = await apiCall('/api/v1/admin/customers?page=1&page_size=100', 'GET');
      const payload = await res.json().catch(() => ({}));
      if (Array.isArray(payload?.data)) {
        setCustomers(
          payload.data.map((c) => ({
            value: c.id,
            label: `${c.name || 'Unnamed'} • ${c.mobile || c.phone || 'No phone'} ${c.email ? `(${c.email})` : ''}`,
            raw: c,
          }))
        );
      }
    } catch {
      // silently ignore
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  // Fetch Hotels filtered by Destination
  const fetchHotelsForDestination = useCallback(async (destinationId) => {
    if (!destinationId) {
      setDestinationHotels([]);
      return;
    }
    setHotelsLoading(true);
    try {
      const res = await apiCall(`/api/v1/admin/hotels?destination_id=${encodeURIComponent(destinationId)}&page=1&page_size=100`, 'GET');
      const payload = await res.json().catch(() => ({}));
      if (Array.isArray(payload?.data)) {
        setDestinationHotels(
          payload.data.map((h) => ({
            value: h.id,
            label: `${h.name} (${h.category || 'Hotel'})`,
            raw: h,
          }))
        );
      } else {
        setDestinationHotels([]);
      }
    } catch {
      setDestinationHotels([]);
    } finally {
      setHotelsLoading(false);
    }
  }, []);

  // Fetch Variants for selected Package
  const fetchVariantsForPackage = useCallback(async (packageId) => {
    if (!packageId) {
      setPackageVariants([]);
      return;
    }
    setVariantsLoading(true);
    try {
      const res = await apiCall(`/api/v1/admin/tour-packages/${encodeURIComponent(packageId)}/variants?page=1&page_size=100`, 'GET');
      const payload = await res.json().catch(() => ({}));
      if (Array.isArray(payload?.data)) {
        setPackageVariants(
          payload.data.map((v) => ({
            value: v.id,
            label: `${v.name || 'Standard'} ${v.season_name ? `(${v.season_name})` : ''} - â‚¹${v.selling_price || v.list_price || 0}`,
            raw: v,
          }))
        );
      } else {
        setPackageVariants([]);
      }
    } catch {
      setPackageVariants([]);
    } finally {
      setVariantsLoading(false);
    }
  }, []);

  // Load Reference Data
  const loadReferenceData = useCallback(async () => {
    setDestLoading(true);
    try {
      // 1. Destinations
      apiCall('/api/v1/admin/destinations?page=1&page_size=100', 'GET')
        .then((r) => r.json())
        .then((res) => {
          if (Array.isArray(res?.data)) {
            setDestinations(res.data.map((d) => ({ value: d.id, label: d.name })));
          }
        })
        .catch(() => {})
        .finally(() => setDestLoading(false));

      // 2. Hotels
      apiCall('/api/v1/admin/hotels?page=1&page_size=100', 'GET')
        .then((r) => r.json())
        .then((res) => {
          if (Array.isArray(res?.data)) {
            setHotels(res.data.map((h) => ({ value: h.id, label: `${h.name} (${h.category || 'Hotel'})` })));
          }
        })
        .catch(() => {});

      // 3. Packages
      apiCall('/api/v1/admin/tour-packages?page=1&page_size=100', 'GET')
        .then((r) => r.json())
        .then((res) => {
          if (Array.isArray(res?.data)) {
            setPackages(
              res.data.map((p) => ({
                value: p.id,
                label: `${p.title} (${p.tour_code || 'Package'})`,
                raw: p,
              }))
            );
          }
        })
        .catch(() => {});

      // 4. Staff / Accounts
      apiCall('/api/v1/admin/account?page=1&page_size=100', 'GET')
        .then((r) => r.json())
        .then((res) => {
          if (Array.isArray(res?.data)) {
            setStaffAccounts(res.data.map((a) => ({ value: a.id, label: `${a.name} (${a.role || 'Staff'})` })));
          }
        })
        .catch(() => {});
    } catch {
      setDestLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReferenceData();
    loadCustomersList();
  }, [loadReferenceData, loadCustomersList]);

  // Lookup Maps
  const destMap = useMemo(() => {
    const map = {};
    destinations.forEach((d) => (map[d.value] = d.label));
    return map;
  }, [destinations]);

  const hotelMap = useMemo(() => {
    const map = {};
    hotels.forEach((h) => (map[h.value] = h.label));
    return map;
  }, [hotels]);

  const packageMap = useMemo(() => {
    const map = {};
    packages.forEach((p) => (map[p.value] = p.label));
    return map;
  }, [packages]);

  const staffMap = useMemo(() => {
    const map = {};
    staffAccounts.forEach((s) => (map[s.value] = s.label));
    return map;
  }, [staffAccounts]);

  // Load Enquiries API
  const loadEnquiries = useCallback(
    async (page = currentPage, limit = itemsPerPage) => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({ page, page_size: limit });
        const response = await apiCall(`/api/v1/admin/enquiries?${queryParams.toString()}`, 'GET');
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || payload?.detail || 'Unable to fetch enquiries');
        }
        const data = Array.isArray(payload?.data) ? payload.data : [];
        setEnquiries(data);
        if (payload?.pagination) {
          setTotalItems(payload.pagination.total_items ?? data.length);
        } else {
          setTotalItems(data.length);
        }
      } catch (error) {
        handleApiError(error, 'Unable to fetch enquiries');
      } finally {
        setLoading(false);
      }
    },
    [currentPage, itemsPerPage]
  );

  useEffect(() => {
    loadEnquiries(currentPage, itemsPerPage);
  }, [loadEnquiries, currentPage, itemsPerPage]);

  // Open the inspection modal; the action menu still provides the full lead page.
  const openEnquiryDetails = async (enquiry) => {
    setSelectedEnquiry(enquiry);
    setLeadDetails(enquiry.lead || null);
    setIsDetailsModalOpen(true);
    setLeadLoading(true);
    try {
      const response = await apiCall(`/api/v1/admin/enquiries/${enquiry.id}/lead`, 'GET');
      const payload = await response.json().catch(() => ({}));
      if (response.ok) setLeadDetails(payload?.data || null);
    } catch {
      // The enquiry can still be inspected when no lead record is available.
    } finally {
      setLeadLoading(false);
    }
  };

  // Open Edit Status Modal
  const openEditModal = (enquiry) => {
    setEditingEnquiry(enquiry);
    setStatusEditForm({
      status: enquiry.status || 'NEW',
      message: enquiry.message || '',
    });
    setIsEditModalOpen(true);
  };

  // Multi-step wizard state
  const [createStep, setCreateStep] = useState(1);
  const CREATE_STEPS = [
    { id: 1, label: 'Customer' },
    { id: 2, label: 'Channel & Type' },
    { id: 3, label: 'Destination & Package' },
    { id: 4, label: 'Travel & Budget' },
  ];

  // Validate step before proceeding
  const hasContact = Boolean(
    createForm.name.trim() || createForm.phone.trim() || createForm.email.trim()
  );

  const validateStep = (step) => {
    if (step === 1 && !hasContact) {
      toast.error('Enter a name, phone number, or email address.');
      return false;
    }
    return true;
  };

  const goNextStep = () => {
    if (validateStep(createStep)) {
      setCreateStep((s) => Math.min(s + 1, CREATE_STEPS.length));
    }
  };

  const goPrevStep = () => setCreateStep((s) => Math.max(s - 1, 1));

  const isCreateStepValid = (step) => {
    if (step === 1) return hasContact;
    if (step === 2) return Boolean(createForm.enquiry_type && createForm.channel);
    if (step === 3) return tripSelectionType === 'DESTINATION'
      ? Boolean(createForm.destination_id)
      : Boolean(createForm.package_id);
    if (step === 4) return Boolean(createForm.travel_date) && Number(createForm.adult_count) > 0;
    return false;
  };

  // Open Create Modal & reset states
  const openCreateModal = () => {
    setCreateForm(defaultCreateForm);
    setCustomerType('SYSTEM');
    setSelectedCustomerOption(null);
    setTripSelectionType('DESTINATION');
    setPackageVariants([]);
    setDestinationHotels([]);
    setCreateStep(1);
    setIsCreateModalOpen(true);
  };

  // Handle Create Enquiry Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (createStep !== CREATE_STEPS.length || !isCreateStepValid(CREATE_STEPS.length)) return;
    if (!hasContact) {
      toast.error('Please provide at least a name, phone, or email.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        enquiry_type: createForm.enquiry_type,
        channel: createForm.channel,
        name: createForm.name.trim() || null,
        phone: createForm.phone.trim() || null,
        email: createForm.email.trim() || null,
        destination_id: createForm.destination_id || null,
        package_id: createForm.package_id || null,
        variant_id: createForm.variant_id || null,
        hotel_id: createForm.hotel_id || null,
        vehicle_id: createForm.vehicle_id || null,
        customer_id: createForm.customer_id || null,
        visitor_id: createForm.visitor_id || null,
        travel_date: createForm.travel_date || null,
        travel_duration_day: Number(createForm.travel_duration_day) || 0,
        travel_duration_night: Number(createForm.travel_duration_night) || 0,
        adult_count: Number(createForm.adult_count) || 0,
        child_count: Number(createForm.child_count) || 0,
        senior_count: Number(createForm.senior_count) || 0,
        room_count: Number(createForm.room_count) || 0,
        vehicle_count: Number(createForm.vehicle_count) || 0,
        budget_min: Number(createForm.budget_min) || 0,
        budget_max: Number(createForm.budget_max) || 0,
        meal_plan: createForm.meal_plan,
        message: createForm.message.trim(),
        special_requirements: createForm.special_requirements.trim(),
      };

      const res = await apiCall('/api/v1/admin/enquiries', 'POST', payload);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || data?.detail || 'Failed to create enquiry');
      }

      toast.success(data?.message || 'Enquiry recorded successfully!');
      setIsCreateModalOpen(false);
      setCreateForm(defaultCreateForm);
      await loadEnquiries(currentPage, itemsPerPage);
    } catch (error) {
      handleApiError(error, 'Unable to create enquiry');
    } finally {
      setSaving(false);
    }
  };

  // Handle Edit Status / Message Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingEnquiry) return;

    setSaving(true);
    try {
      const payload = {
        status: statusEditForm.status,
        message: statusEditForm.message.trim(),
      };

      const res = await apiCall(`/api/v1/admin/enquiries/${editingEnquiry.id}`, 'PATCH', payload);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || data?.detail || 'Failed to update enquiry status');
      }

      toast.success(data?.message || 'Enquiry updated successfully');
      setIsEditModalOpen(false);
      setEditingEnquiry(null);
      await loadEnquiries(currentPage, itemsPerPage);
    } catch (error) {
      handleApiError(error, 'Unable to update enquiry');
    } finally {
      setSaving(false);
    }
  };

  // Filtered enquiries list
  const filteredEnquiries = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return enquiries.filter((item) => {
      const matchesSearch =
        !term ||
        [
          item.enquiry_code,
          item.enquirer_name,
          item.enquirer_phone,
          item.enquirer_email,
          item.message,
          item.special_requirements,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term);

      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const matchesType = typeFilter === 'ALL' || item.enquiry_type === typeFilter;
      const matchesChannel = channelFilter === 'ALL' || item.channel === channelFilter;

      return matchesSearch && matchesStatus && matchesType && matchesChannel;
    });
  }, [enquiries, searchTerm, statusFilter, typeFilter, channelFilter]);

  const inputClass =
    'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200';
  const labelClass = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300';

  return (
    <div className="space-y-3 pb-6">
      {/* Header */}
      <div className="px-2 text-slate-900 dark:text-slate-100">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mt-1 bg-gradient-to-r from-slate-900 via-indigo-600 to-violet-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent md:text-3xl dark:from-slate-100 dark:via-indigo-300 dark:to-violet-300">
              Enquiry Management
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Track and convert incoming customer leads, holiday packages, hotel and custom trip queries.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Refresh enquiries"
              title="Refresh enquiries"
              onClick={() => loadEnquiries(currentPage, itemsPerPage)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 sm:px-3 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              aria-label="Add enquiry"
              title="Add enquiry"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white p-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 shadow-xs border border-gray-200 sm:px-4 dark:border-gray-700 dark:bg-gray-800 dark:text-indigo-400 dark:hover:bg-gray-700"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add enquiry</span>
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
              placeholder="Search code, name, phone..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition sm:px-4 ${
              statusFilter !== 'ALL' || typeFilter !== 'ALL' || channelFilter !== 'ALL'
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filter</span>
            {(statusFilter !== 'ALL' || typeFilter !== 'ALL' || channelFilter !== 'ALL') && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {[statusFilter !== 'ALL', typeFilter !== 'ALL', channelFilter !== 'ALL'].filter(Boolean).length}
              </span>
            )}
          </button>

          {(searchTerm || statusFilter !== 'ALL' || typeFilter !== 'ALL' || channelFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setTypeFilter('ALL');
                setChannelFilter('ALL');
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-dashed border-gray-300 px-2.5 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 sm:px-3"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          <span className="hidden shrink-0 text-sm text-gray-500 dark:text-gray-400 sm:block">
            {filteredEnquiries.length} record{filteredEnquiries.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Filter Modal */}
      <Modal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="Filter Enquiries"
        icon={Filter}
        size="sm"
        footer={(
          <div className="flex w-full gap-3">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setTypeFilter('ALL');
                setChannelFilter('ALL');
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
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
            <SelectField
              options={[{ value: 'ALL', label: 'All Statuses' }, ...STATUSES]}
              value={[{ value: 'ALL', label: 'All Statuses' }, ...STATUSES].find((s) => s.value === statusFilter)}
              onChange={(sel) => setStatusFilter(sel?.value || 'ALL')}
              isSearchable={false}
              placeholder="Filter status"
              menuPlacement="auto"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Enquiry Type</label>
            <SelectField
              options={[{ value: 'ALL', label: 'All Types' }, ...ENQUIRY_TYPES]}
              value={[{ value: 'ALL', label: 'All Types' }, ...ENQUIRY_TYPES].find((t) => t.value === typeFilter)}
              onChange={(sel) => setTypeFilter(sel?.value || 'ALL')}
              isSearchable={false}
              placeholder="Filter type"
              menuPlacement="auto"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Channel</label>
            <SelectField
              options={[{ value: 'ALL', label: 'All Channels' }, ...CHANNELS]}
              value={[{ value: 'ALL', label: 'All Channels' }, ...CHANNELS].find((c) => c.value === channelFilter)}
              onChange={(sel) => setChannelFilter(sel?.value || 'ALL')}
              isSearchable={false}
              placeholder="Filter channel"
              menuPlacement="auto"
            />
          </div>
        </div>
      </Modal>

      {/* Enquiries Table */}
      <div className="overflow-hidden md:rounded-2xl md:border md:border-gray-200 md:bg-white md:shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">
            Loading customer enquiries...
          </div>
        ) : filteredEnquiries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-400">
              <HelpCircle className="h-6 w-6" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchTerm || statusFilter !== 'ALL' || typeFilter !== 'ALL' || channelFilter !== 'ALL'
                ? 'No enquiries match your selected filters.'
                : 'No customer enquiries recorded yet.'}
            </p>
            {!searchTerm && statusFilter === 'ALL' && typeFilter === 'ALL' && channelFilter === 'ALL' && (
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Add first enquiry
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <ManagementTable><table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/70">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Code & Type</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Customer / Contact</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Requirements & Travel</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Channel</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Status & Lead Score</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredEnquiries.map((enq) => {
                  const leadScore = enq.lead?.lead_score;
                  const destTitle = destMap[enq.destination_id];
                  const pkgTitle = packageMap[enq.package_id];

                  return (
                    <tr
                      key={enq.id}
                      onClick={() => openEnquiryDetails(enq)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                    >
                      {/* Enquiry Code & Type */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                            {enq.enquiry_code || enq.id?.slice(0, 8) || 'ENQ-NEW'}
                          </span>
                          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 mt-0.5">
                            {enq.enquiry_type?.replace(/_/g, ' ') || 'Fixed Tour'}
                          </span>
                          <span className="text-[11px] text-gray-400 mt-0.5">
                            {formatDate(enq.created_at)}
                          </span>
                        </div>
                      </td>

                      {/* Customer / Contact */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {enq.enquirer_name || 'Anonymous Visitor'}
                          </span>
                          {enq.enquirer_phone && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                              <Phone className="h-3 w-3 text-emerald-500 shrink-0" />
                              <span>{enq.enquirer_phone}</span>
                            </div>
                          )}
                          {enq.enquirer_email && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              <Mail className="h-3 w-3 text-blue-400 shrink-0" />
                              <span className="truncate max-w-xs">{enq.enquirer_email}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Requirements & Travel */}
                      <td className="px-4 py-4 max-w-xs">
                        <div className="flex flex-col gap-0.5">
                          {destTitle && (
                            <div className="flex items-center gap-1 text-xs font-medium text-gray-800 dark:text-gray-200">
                              <MapPin className="h-3 w-3 text-indigo-500 shrink-0" />
                              <span className="truncate">{destTitle}</span>
                            </div>
                          )}
                          {pkgTitle && (
                            <div className="text-xs text-indigo-600 dark:text-indigo-400 truncate">
                              Package: {pkgTitle}
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatShortDate(enq.travel_date)}
                            </span>
                            {(enq.adult_count || enq.child_count || enq.senior_count) ? (
                              <span className="flex items-center gap-1">
                                <UsersIcon className="h-3 w-3" />
                                {Number(enq.adult_count || 0) +
                                  Number(enq.child_count || 0) +
                                  Number(enq.senior_count || 0)}{' '}
                                Pax
                              </span>
                            ) : null}
                          </div>
                          {enq.message && (
                            <p className="text-xs text-gray-400 line-clamp-1 italic mt-0.5">
                              &ldquo;{enq.message}&rdquo;
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Channel */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {enq.channel || 'WEBSITE'}
                        </span>
                      </td>

                      {/* Status & Lead Score */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1.5">
                          <span
                            className={`inline-flex items-center w-fit rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                              statusBadgeClasses[enq.status] || statusBadgeClasses.NEW
                            }`}
                          >
                            {enq.status || 'NEW'}
                          </span>
                          {leadScore !== undefined && leadScore !== null && (
                            <div className="flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                              <TrendingUp className="h-3 w-3 text-indigo-500" />
                              Score: <span className="font-semibold text-gray-700 dark:text-gray-200">{leadScore}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <ActionMenu
                          menuId={`enq-${enq.id}`}
                          actions={[
                            {
                              label: 'Manage Lead',
                              icon: <TrendingUp className="h-4 w-4 text-indigo-500" />,
                              onClick: () => navigate(`/enquiries/${enq.id}/lead`, { state: { enquiry: enq } }),
                            },
                            {
                              label: 'Update Status',
                              icon: <Pencil className="h-4 w-4 text-blue-500" />,
                              onClick: () => openEditModal(enq),
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

      {/* â”€â”€ CREATE ENQUIRY MODAL â€” Step Wizard â”€â”€ */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          if (!saving) setIsCreateModalOpen(false);
        }}
        title="Add New Customer Enquiry"
        icon={HelpCircle}
        size="2xl"
        footer={(
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-gray-400">
              Step {createStep} of {CREATE_STEPS.length}
            </span>
            <div className="flex items-center gap-3">
              {createStep > 1 && (
                <button
                  type="button"
                  onClick={goPrevStep}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
              )}
              {createStep < CREATE_STEPS.length ? (
                <button
                  type="button"
                  onClick={goNextStep}
                  disabled={!isCreateStepValid(createStep)}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  form="create-enquiry-form"
                  disabled={saving || !isCreateStepValid(createStep)}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Recording...' : <><Check className="h-4 w-4" /> Create Enquiry</>}
                </button>
              )}
            </div>
          </div>
        )}
      >
        {/* â”€â”€ Step Indicator â”€â”€ */}
        <div className="px-1 pb-4">
          <div className="flex items-center gap-0">
            {CREATE_STEPS.map((step, idx) => (
              <React.Fragment key={step.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (step.id < createStep) setCreateStep(step.id);
                  }}
                  className={`flex items-center gap-1.5 px-1 ${
                    step.id < createStep ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      step.id < createStep
                        ? 'bg-indigo-600 text-white'
                        : step.id === createStep
                        ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500 dark:bg-indigo-900/40 dark:text-indigo-300'
                        : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
                    }`}
                  >
                    {step.id < createStep ? <Check className="h-3 w-3" /> : step.id}
                  </span>
                  <span
                    className={`hidden sm:block text-xs font-semibold transition-all ${
                      step.id === createStep
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : step.id < createStep
                        ? 'text-indigo-500 dark:text-indigo-500'
                        : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </button>
                {idx < CREATE_STEPS.length - 1 && (
                  <div
                    className={`h-px flex-1 transition-all ${
                      step.id < createStep ? 'bg-indigo-400' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <form
          id="create-enquiry-form"
          onSubmit={handleCreateSubmit}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') event.preventDefault();
          }}
          className="space-y-4 p-1"
        >

          {/* â”€â”€â”€ STEP 1: Customer Information â”€â”€â”€ */}
          {createStep === 1 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">Who is this enquiry for?</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Link to an existing customer or enter new contact details.</p>
                </div>
                <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 shrink-0">
                  <button type="button" onClick={() => setCustomerType('SYSTEM')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition ${customerType === 'SYSTEM' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                    <UserCheck className="w-3.5 h-3.5" /> Existing
                  </button>
                  <button type="button" onClick={() => { setCustomerType('MANUAL'); setSelectedCustomerOption(null); setCreateForm((prev) => ({ ...prev, customer_id: '' })); }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition ${customerType === 'MANUAL' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                    <UserPlus className="w-3.5 h-3.5" /> New
                  </button>
                </div>
              </div>

              {customerType === 'SYSTEM' && (
                <div>
                  <label className={labelClass}>Search existing customer</label>
                  <SelectField
                    options={customers}
                    isLoading={customersLoading}
                    value={selectedCustomerOption}
                    onChange={(opt) => {
                      setSelectedCustomerOption(opt);
                      if (opt?.raw) {
                        const cust = opt.raw;
                        setCreateForm((prev) => ({ ...prev, customer_id: cust.id || '', name: cust.name || prev.name, phone: cust.mobile || cust.phone || prev.phone, email: cust.email || prev.email }));
                      } else {
                        setCreateForm((prev) => ({ ...prev, customer_id: '' }));
                      }
                    }}
                    placeholder={customersLoading ? 'Loading customers...' : 'Search by name or phone...'}
                    isClearable menuPlacement="auto"
                  />
                  <p className="mt-1 text-xs text-gray-400">Auto-fills contact details below.</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Customer name <span className="text-gray-400 font-normal">(optional if phone/email is provided)</span></label>
                  <input type="text" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="e.g. John Doe" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Phone number</label>
                  <input type="tel" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} placeholder="+91 9876543210" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Email address</label>
                  <input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="customer@example.com" className={inputClass} />
                </div>
              </div>
            </div>
          )}

          {/* â”€â”€â”€ STEP 2: Channel & Enquiry Type â”€â”€â”€ */}
          {createStep === 2 && (
            <div className="space-y-5">
              <div className="mb-1">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Enquiry source & type</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">How did this lead reach you, and what are they looking for?</p>
              </div>

              <div>
                <label className={labelClass}>Enquiry type</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                  {ENQUIRY_TYPES.map((t) => (
                    <button key={t.value} type="button"
                      onClick={() => {
                        setCreateForm((current) => ({
                          ...current,
                          enquiry_type: t.value,
                          ...(t.value === 'CUSTOM_TOUR' ? { package_id: '', variant_id: '' } : {}),
                        }));
                        if (t.value === 'CUSTOM_TOUR') setTripSelectionType('DESTINATION');
                      }}
                      className={`rounded-xl border px-3 py-3 text-xs font-semibold text-left transition ${createForm.enquiry_type === t.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300' : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400'}`}
                    >
                      {createForm.enquiry_type === t.value && <Check className="h-3 w-3 text-indigo-500 mb-1" />}
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>Source channel</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                  {CHANNELS.map((c) => (
                    <button key={c.value} type="button"
                      onClick={() => setCreateForm({ ...createForm, channel: c.value })}
                      className={`rounded-xl border px-3 py-3 text-xs font-semibold text-left transition ${createForm.channel === c.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400'}`}
                    >
                      {createForm.channel === c.value && <Check className="h-3 w-3 text-emerald-500 mb-1" />}
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP 3: Destination or Package & Variant ─── */}
          {createStep === 3 && (
            <div className="space-y-4">
              <div className="mb-1">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Trip selection</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Select whether this enquiry is for a <strong>Destination</strong> or a specific <strong>Tour Package</strong>.
                </p>
              </div>

              {/* Radio Button Selector */}
              <div>
                <label className={labelClass}>Choose selection mode</label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  {createForm.enquiry_type === 'FIXED_TOUR' && <label
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      tripSelectionType === 'DESTINATION'
                        ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tripSelectionType"
                      value="DESTINATION"
                      checked={tripSelectionType === 'DESTINATION'}
                      onChange={() => {
                        setTripSelectionType('DESTINATION');
                        // Clear package-specific fields when switching to destination
                        setCreateForm((prev) => ({
                          ...prev,
                          package_id: '',
                          variant_id: '',
                          hotel_id: '',
                        }));
                        setPackageVariants([]);
                        if (createForm.destination_id) {
                          fetchHotelsForDestination(createForm.destination_id);
                        } else {
                          setDestinationHotels([]);
                        }
                      }}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <div>
                      <span className="text-sm font-bold block">By Destination</span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        Choose destination & view destination hotels
                      </span>
                    </div>
                  </label>}

                  <label
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      tripSelectionType === 'PACKAGE'
                        ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tripSelectionType"
                      value="PACKAGE"
                      checked={tripSelectionType === 'PACKAGE'}
                      onChange={() => {
                        setTripSelectionType('PACKAGE');
                        // Clear destination-specific fields when switching to package
                        setCreateForm((prev) => ({
                          ...prev,
                          destination_id: '',
                          hotel_id: '',
                        }));
                        if (createForm.package_id) {
                          const pkg = packages.find((p) => p.value === createForm.package_id);
                          const pkgDestId = pkg?.raw?.destination_id;
                          if (pkgDestId) {
                            fetchHotelsForDestination(pkgDestId);
                          }
                        } else {
                          setDestinationHotels([]);
                        }
                      }}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <div>
                      <span className="text-sm font-bold block">By Tour Package</span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        Choose package, variant & package destination hotels
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Mode A: DESTINATION ONLY */}
              {tripSelectionType === 'DESTINATION' && (
                <div className="space-y-4 pt-1">
                  <div>
                    <label className={labelClass}>
                      Destination <span className="text-red-500">*</span>
                    </label>
                    <SelectField
                      options={destinations}
                      isLoading={destLoading}
                      value={destinations.find((d) => d.value === createForm.destination_id) || null}
                      onChange={(opt) => {
                        const destId = opt?.value || '';
                        setCreateForm((prev) => ({
                          ...prev,
                          destination_id: destId,
                          package_id: '',
                          variant_id: '',
                          hotel_id: '',
                        }));
                        if (destId) {
                          fetchHotelsForDestination(destId);
                        } else {
                          setDestinationHotels([]);
                        }
                      }}
                      placeholder="Select a destination"
                      isClearable
                      menuPlacement="auto"
                    />
                  </div>

                  {/* Destination-filtered Hotel Selection */}
                  <div>
                    <label className={labelClass}>
                      Preferred hotel <span className="text-gray-400 font-normal">(optional)</span>
                      {createForm.destination_id && !hotelsLoading && (
                        <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                          {destinationHotels.length} available in this destination
                        </span>
                      )}
                    </label>
                    <SelectField
                      options={createForm.destination_id ? destinationHotels : hotels}
                      isLoading={hotelsLoading}
                      value={
                        (createForm.destination_id ? destinationHotels : hotels).find(
                          (h) => h.value === createForm.hotel_id
                        ) || null
                      }
                      onChange={(opt) => setCreateForm({ ...createForm, hotel_id: opt?.value || '' })}
                      placeholder={
                        !createForm.destination_id
                          ? 'Select destination first'
                          : hotelsLoading
                          ? 'Loading hotels for destination...'
                          : destinationHotels.length === 0
                          ? 'No hotels found for this destination'
                          : 'Select a preferred hotel'
                      }
                      isDisabled={!createForm.destination_id}
                      isClearable
                      menuPlacement="auto"
                    />
                  </div>
                </div>
              )}

              {/* Mode B: PACKAGE + VARIANT */}
              {tripSelectionType === 'PACKAGE' && (
                <div className="space-y-4 pt-1">
                  <div>
                    <label className={labelClass}>
                      Tour package <span className="text-red-500">*</span>
                    </label>
                    <SelectField
                      options={packages}
                      value={packages.find((p) => p.value === createForm.package_id) || null}
                      onChange={(opt) => {
                        const pkgId = opt?.value || '';
                        setCreateForm((prev) => ({
                          ...prev,
                          package_id: pkgId,
                          variant_id: '',
                          hotel_id: '',
                        }));
                        if (pkgId) {
                          fetchVariantsForPackage(pkgId);
                          const pkgDestId = opt?.raw?.destination_id;
                          if (pkgDestId) {
                            fetchHotelsForDestination(pkgDestId);
                          } else {
                            setDestinationHotels([]);
                          }
                        } else {
                          setPackageVariants([]);
                          setDestinationHotels([]);
                        }
                      }}
                      placeholder="Select a tour package"
                      isClearable
                      menuPlacement="auto"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Package variant
                      {createForm.package_id && !variantsLoading && packageVariants.length > 0 && (
                        <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
                          {packageVariants.length} variants
                        </span>
                      )}
                    </label>
                    <SelectField
                      options={packageVariants}
                      isLoading={variantsLoading}
                      value={packageVariants.find((v) => v.value === createForm.variant_id) || null}
                      onChange={(opt) => {
                        const variantId = opt?.value || '';
                        setCreateForm((prev) => {
                          const updated = { ...prev, variant_id: variantId };
                          if (opt?.raw) {
                            const rv = opt.raw;
                            if (rv.duration_days) updated.travel_duration_day = rv.duration_days;
                            if (rv.duration_nights) updated.travel_duration_night = rv.duration_nights;
                            if (rv.selling_price || rv.list_price) {
                              const price = Number(rv.selling_price || rv.list_price);
                              if (!prev.budget_min) updated.budget_min = price;
                              if (!prev.budget_max) updated.budget_max = price;
                            }
                          }
                          return updated;
                        });
                      }}
                      placeholder={
                        !createForm.package_id
                          ? 'Select a package first'
                          : variantsLoading
                          ? 'Loading variants...'
                          : packageVariants.length === 0
                          ? 'No variants found'
                          : 'Choose a variant'
                      }
                      isDisabled={!createForm.package_id}
                      isClearable
                      menuPlacement="auto"
                    />
                    {createForm.variant_id && (() => {
                      const rv = packageVariants.find((v) => v.value === createForm.variant_id)?.raw;
                      if (!rv) return null;
                      return (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {rv.duration_days && (
                            <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                              {rv.duration_days}D / {rv.duration_nights || 0}N
                            </span>
                          )}
                          {(rv.selling_price || rv.list_price) && (
                            <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                              ₹{rv.selling_price || rv.list_price}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Package Destination-filtered Hotel Selection */}
                  <div>
                    <label className={labelClass}>
                      Preferred hotel <span className="text-gray-400 font-normal">(optional)</span>
                      {createForm.package_id && !hotelsLoading && (
                        <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                          {destinationHotels.length} available for this package's destination
                        </span>
                      )}
                    </label>
                    <SelectField
                      options={createForm.package_id ? destinationHotels : hotels}
                      isLoading={hotelsLoading}
                      value={
                        (createForm.package_id ? destinationHotels : hotels).find(
                          (h) => h.value === createForm.hotel_id
                        ) || null
                      }
                      onChange={(opt) => setCreateForm({ ...createForm, hotel_id: opt?.value || '' })}
                      placeholder={
                        !createForm.package_id
                          ? 'Select a package first'
                          : hotelsLoading
                          ? 'Loading hotels for destination...'
                          : destinationHotels.length === 0
                          ? 'No hotels found for this package destination'
                          : 'Select a preferred hotel'
                      }
                      isDisabled={!createForm.package_id}
                      isClearable
                      menuPlacement="auto"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* â”€â”€â”€ STEP 4: Travel Details & Budget â”€â”€â”€ */}
          {createStep === 4 && (
            <div className="space-y-4">
              <div className="mb-1">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Travel details & budget</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Dates, travellers, rooms, and the customer's budget range.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Travel date <span className="text-red-500">*</span></label>
                  <CustomDatePicker value={createForm.travel_date} includeTime={false} onChange={(value) => setCreateForm({ ...createForm, travel_date: value })} />
                </div>
                <div>
                  <label className={labelClass}>Duration</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input type="text" inputMode="numeric" min="0" placeholder="Days" value={createForm.travel_duration_day} onChange={(e) => setCreateForm({ ...createForm, travel_duration_day: sanitizeNumericInput(e.target.value) })} className={inputClass} />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">D</span>
                    </div>
                    <div className="relative flex-1">
                      <input type="text" inputMode="numeric" min="0" placeholder="Nights" value={createForm.travel_duration_night} onChange={(e) => setCreateForm({ ...createForm, travel_duration_night: sanitizeNumericInput(e.target.value) })} className={inputClass} />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">N</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className={labelClass}>Travellers</label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-500">Adults <span className="text-red-500">*</span></label>
                    <input type="text" inputMode="numeric" min="0" value={createForm.adult_count} onChange={(e) => setCreateForm({ ...createForm, adult_count: sanitizeNumericInput(e.target.value) })} className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-500">Children</label>
                    <input type="text" inputMode="numeric" min="0" value={createForm.child_count} onChange={(e) => setCreateForm({ ...createForm, child_count: sanitizeNumericInput(e.target.value) })} className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-500">Seniors</label>
                    <input type="text" inputMode="numeric" min="0" value={createForm.senior_count} onChange={(e) => setCreateForm({ ...createForm, senior_count: sanitizeNumericInput(e.target.value) })} className={inputClass} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Rooms</label>
                  <input type="text" inputMode="numeric" min="0" placeholder="Number of rooms" value={createForm.room_count} onChange={(e) => setCreateForm({ ...createForm, room_count: sanitizeNumericInput(e.target.value) })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Meal plan</label>
                  <SelectField options={MEAL_PLANS} value={MEAL_PLANS.find((m) => m.value === createForm.meal_plan) || null} onChange={(selected) => setCreateForm({ ...createForm, meal_plan: selected?.value || 'ANY' })} isSearchable={false} placeholder="Select meal plan" menuPlacement="auto" />
                </div>
              </div>

              <div>
                <label className={labelClass}>Budget range (â‚¹)</label>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" inputMode="decimal" min="0" placeholder="Minimum" value={createForm.budget_min} onChange={(e) => setCreateForm({ ...createForm, budget_min: sanitizeNumericInput(e.target.value) })} className={inputClass} />
                  <input type="text" inputMode="decimal" min="0" placeholder="Maximum" value={createForm.budget_max} onChange={(e) => setCreateForm({ ...createForm, budget_max: sanitizeNumericInput(e.target.value) })} className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Special requirements</label>
                <input type="text" placeholder="e.g. Sea view room, vegetarian meals, airport pickup" value={createForm.special_requirements} onChange={(e) => setCreateForm({ ...createForm, special_requirements: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Customer message / notes</label>
                <textarea rows={3} placeholder="Notes or query details provided by the customer..." value={createForm.message} onChange={(e) => setCreateForm({ ...createForm, message: e.target.value })} className={inputClass} />
              </div>
            </div>
          )}
        </form>
      </Modal>





      {/* â”€â”€ UPDATE STATUS / MESSAGE MODAL using Modal footer prop â”€â”€ */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          if (!saving) setIsEditModalOpen(false);
        }}
        title="Update Enquiry Status"
        icon={Pencil}
        size="md"
        footer={(
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="status-update-form"
              disabled={saving}
              className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 transition"
            >
              {saving ? 'Updating...' : 'Save changes'}
            </button>
          </div>
        )}
      >
        <form id="status-update-form" onSubmit={handleEditSubmit} className="space-y-4 p-1">
          <div>
            <label className={labelClass}>Enquiry status</label>
            <SelectField
              options={STATUSES}
              value={STATUSES.find((s) => s.value === statusEditForm.status) || null}
              onChange={(selected) => setStatusEditForm({ ...statusEditForm, status: selected?.value || 'NEW' })}
              isSearchable={false}
              placeholder="Select status"
              menuPlacement="auto"
            />
          </div>

          <div>
            <label className={labelClass}>Status update note / message</label>
            <textarea
              rows={4}
              value={statusEditForm.message}
              onChange={(e) => setStatusEditForm({ ...statusEditForm, message: e.target.value })}
              placeholder="Record follow-up remarks or notes regarding this status change..."
              className={inputClass}
            />
          </div>
        </form>
      </Modal>

      {/* â”€â”€ DETAILS & LEAD INSPECTION MODAL using Modal footer prop â”€â”€ */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedEnquiry(null);
          setLeadDetails(null);
        }}
        title="Enquiry & Lead Details"
        icon={FileText}
        size="3xl"
        footer={(
          <div className="flex w-full items-center justify-between">
            <span className="text-xs text-gray-400">
              {selectedEnquiry ? `Created: ${formatDate(selectedEnquiry.created_at)}` : ''}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  openEditModal(selectedEnquiry);
                }}
                className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-100 dark:border-indigo-900/40 dark:bg-indigo-950/40 dark:text-indigo-300 transition"
              >
                Update status
              </button>
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      >
        {selectedEnquiry && (
          <div className="space-y-4 p-1">
            {/* Top Bar Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border border-indigo-100 dark:border-indigo-900/40">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {selectedEnquiry.enquiry_code || 'ENQ-DETAILS'}
                </span>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                  {selectedEnquiry.enquirer_name || 'Anonymous Visitor'}
                </h3>
                <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-300 mt-1">
                  {selectedEnquiry.enquirer_phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-emerald-500" />
                      {selectedEnquiry.enquirer_phone}
                    </span>
                  )}
                  {selectedEnquiry.enquirer_email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3 text-blue-400" />
                      {selectedEnquiry.enquirer_email}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                    statusBadgeClasses[selectedEnquiry.status] || statusBadgeClasses.NEW
                  }`}
                >
                  {selectedEnquiry.status || 'NEW'}
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  Channel: <strong className="text-gray-700 dark:text-gray-300">{selectedEnquiry.channel || 'WEBSITE'}</strong>
                </span>
              </div>
            </div>

            {/* Lead Status & Performance Overview */}
            <div className="p-4 rounded-2xl bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" />
                  Lead Performance & Conversion Status
                </h4>
                {leadLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-500" />}
              </div>

              {leadDetails ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                    <span className="text-[11px] text-gray-400">Lead score</span>
                    <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                      {leadDetails.lead_score ?? 0}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                    <span className="text-[11px] text-gray-400">Assigned agent</span>
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate mt-1">
                      {staffMap[leadDetails.assigned_account_id] || leadDetails.assigned_account_id?.slice(0, 8) || 'Unassigned'}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                    <span className="text-[11px] text-gray-400">Qualified date</span>
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mt-1">
                      {formatShortDate(leadDetails.qualified_at)}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                    <span className="text-[11px] text-gray-400">Conversion / Lost</span>
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mt-1">
                      {leadDetails.converted_at
                        ? `Converted: ${formatShortDate(leadDetails.converted_at)}`
                        : leadDetails.lost_at
                        ? `Lost: ${leadDetails.lost_reason || 'Lost'}`
                        : 'In Pipeline'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 text-xs text-gray-400 italic">
                  {leadLoading ? 'Fetching lead analytics...' : 'No lead records available.'}
                </div>
              )}
            </div>

            {/* Travel & Requirements Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Trip Parameters */}
              <div className="p-4 rounded-2xl bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-xs space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-indigo-500" />
                  Trip Scope & Itinerary
                </h4>
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-gray-400">Travel date</dt>
                    <dd className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5">
                      {formatShortDate(selectedEnquiry.travel_date)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Duration</dt>
                    <dd className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5">
                      {selectedEnquiry.travel_duration_day || 0} Days / {selectedEnquiry.travel_duration_night || 0} Nights
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Pax breakdown</dt>
                    <dd className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5">
                      {selectedEnquiry.adult_count || 0} Ad, {selectedEnquiry.child_count || 0} Ch, {selectedEnquiry.senior_count || 0} Sr
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Accommodations</dt>
                    <dd className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5">
                      {selectedEnquiry.room_count || 0} Rooms ({selectedEnquiry.meal_plan || 'ANY'})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Destination</dt>
                    <dd className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5 truncate">
                      {destMap[selectedEnquiry.destination_id] || selectedEnquiry.destination_id || 'Not specified'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Tour package</dt>
                    <dd className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5 truncate">
                      {packageMap[selectedEnquiry.package_id] || selectedEnquiry.package_id || 'Not specified'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Preferred hotel</dt>
                    <dd className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5 truncate">
                      {hotelMap[selectedEnquiry.hotel_id] || selectedEnquiry.hotel_id || 'Not specified'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Budget & Extras */}
              <div className="p-4 rounded-2xl bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-xs space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  Budget & Special Needs
                </h4>
                <dl className="space-y-2.5 text-xs">
                  <div>
                    <dt className="text-gray-400">Budget range</dt>
                    <dd className="font-semibold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">
                      {selectedEnquiry.budget_min || selectedEnquiry.budget_max
                        ? `â‚¹${selectedEnquiry.budget_min || 0} - â‚¹${selectedEnquiry.budget_max || 0}`
                        : 'Flexible / Not stated'}
                    </dd>
                  </div>
                  {selectedEnquiry.special_requirements && (
                    <div>
                      <dt className="text-gray-400">Special requirements</dt>
                      <dd className="text-gray-800 dark:text-gray-200 font-medium mt-0.5">
                        {selectedEnquiry.special_requirements}
                      </dd>
                    </div>
                  )}
                  {selectedEnquiry.message && (
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                      <dt className="text-gray-400">Customer message</dt>
                      <dd className="text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap rounded-xl bg-gray-50 dark:bg-gray-900 p-2.5 text-xs">
                        {selectedEnquiry.message}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default EnquiryManagement;
