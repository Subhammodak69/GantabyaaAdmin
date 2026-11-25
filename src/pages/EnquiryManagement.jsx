import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ManagementTable from '../component/common/ManagementTable';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { parseWhatsappEnquiry } from '../utils/whatsappEnquiryParser';

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

const HOTEL_CATEGORIES = [
  { value: 'BUDGET', label: 'Budget' },
  { value: 'STANDARD', label: 'Standard' },
  { value: 'DELUXE', label: 'Deluxe' },
  { value: 'LUXURY', label: 'Luxury' },
];

const ROOM_TYPES = [
  { value: 'SINGLE', label: 'Single' },
  { value: 'DOUBLE', label: 'Double' },
  { value: 'TWIN', label: 'Twin' },
  { value: 'TRIPLE', label: 'Triple' },
  { value: 'FAMILY', label: 'Family' },
  { value: 'SUITE', label: 'Suite' },
  { value: 'DELUXE', label: 'Deluxe' },
  { value: 'EXECUTIVE', label: 'Executive' },
  { value: 'PRESIDENTIAL', label: 'Presidential' },
];

const VEHICLE_TYPES = [
  { value: 'ANY', label: 'Any vehicle' },
  { value: 'NONE', label: 'No vehicle' },
  { value: '4-seater', label: '4-seater' },
  { value: '6-seater', label: '6-seater' },
  { value: 'Tempo', label: 'Tempo' },
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
  hotel_category: '',
  room_type: '',
  vehicle_type: '',
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

const getOptionLabel = (options, value) =>
  options.find((option) => option.value === value)?.label || value || 'Not specified';

const statusBadgeClasses = {
  NEW: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300',
  IN_PROGRESS: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300',
  QUOTED: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-900/20 dark:text-indigo-300',
  CONVERTED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300',
  CLOSED: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  CANCELLED: 'border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

const EnquiryCreatePageShell = ({ title, icon: Icon, onClose, footer, children }) => (
  <div className="flex min-h-[calc(100vh-6rem)] w-full flex-col">
    <header className="mb-2 flex items-center justify-between gap-4 border-b border-gray-200/70 px-1 py-3 dark:border-gray-700/70">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
            <Icon size={18} className="text-emerald-600 dark:text-emerald-400" />
          </span>
        )}
        <div>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-gray-100">{title}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Create an enquiry in a few guided steps.</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to enquiries
      </button>
    </header>
    <main className="flex-1 py-3">{children}</main>
    <footer className="border-t border-gray-200/70 px-1 py-4 dark:border-gray-700/70">
      {footer}
    </footer>
  </div>
);

const EnquiryManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isCreatePage = location.pathname === '/enquiries/new';
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Active items
  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [whatsappImportOpen, setWhatsappImportOpen] = useState(false);
  const [whatsappImportText, setWhatsappImportText] = useState('');
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

  // Lookup references (Destinations, Tour Packages, Staff)
  const [destinations, setDestinations] = useState([]);
  const [destLoading, setDestLoading] = useState(false);
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

  // Fetch Variants for selected Package
  const fetchVariantsForPackage = useCallback(async (packageId) => {
    if (!packageId) {
      setPackageVariants([]);
      return [];
    }
    setVariantsLoading(true);
    try {
      const res = await apiCall(`/api/v1/admin/tour-packages/${encodeURIComponent(packageId)}/variants?page=1&page_size=100`, 'GET');
      const payload = await res.json().catch(() => ({}));
      if (Array.isArray(payload?.data)) {
        const options = payload.data.map((v) => ({
          value: v.id,
          label: `${v.name || 'Standard'} ${v.season_name ? `(${v.season_name})` : ''} - â‚¹${v.selling_price || v.list_price || 0}`,
          raw: v,
        }));
        setPackageVariants(options);
        return options;
      } else {
        setPackageVariants([]);
        return [];
      }
    } catch {
      setPackageVariants([]);
      return [];
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

      // 2. Packages
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

      // 3. Staff / Accounts
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
    if (!isCreatePage) loadEnquiries(currentPage, itemsPerPage);
  }, [loadEnquiries, currentPage, itemsPerPage, isCreatePage]);

  useEffect(() => {
    const handleRealtimeEvent = (event) => {
      const { event: eventName, payload } = event.detail || {};
      if (eventName === 'lead:created') {
        loadEnquiries(currentPage, itemsPerPage);
        return;
      }
      if (eventName !== 'lead:score_updated' || !payload?.lead_id) return;
      setEnquiries((current) => current.map((enquiry) => (
        enquiry.lead?.id === payload.lead_id
          ? { ...enquiry, lead: { ...enquiry.lead, lead_score: payload.new_score } }
          : enquiry
      )));
      setSelectedEnquiry((current) => current?.lead?.id === payload.lead_id
        ? { ...current, lead: { ...current.lead, lead_score: payload.new_score } }
        : current);
      setLeadDetails((current) => current?.id === payload.lead_id
        ? { ...current, lead_score: payload.new_score }
        : current);
    };

    window.addEventListener('cobtravels:realtime:event', handleRealtimeEvent);
    return () => window.removeEventListener('cobtravels:realtime:event', handleRealtimeEvent);
  }, [currentPage, itemsPerPage, loadEnquiries]);

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
    { id: 1, label: 'Customer', description: 'Contact details and account' },
    { id: 2, label: 'Enquiry type', description: 'Type and source channel' },
    { id: 3, label: 'Trip selection', description: 'Destination, package and variant' },
    { id: 4, label: 'Travel plan', description: 'Dates, duration and travellers' },
    { id: 5, label: 'Preferences', description: 'Stay, transport and budget' },
  ];
  const currentCreateStep = CREATE_STEPS[createStep - 1];

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
    if (step === 4 || step === 5) return true;
    return false;
  };

  // Open the create page and reset the wizard
  const openCreatePage = () => {
    setCreateForm(defaultCreateForm);
    setWhatsappImportOpen(false);
    setWhatsappImportText('');
    setCustomerType('SYSTEM');
    setSelectedCustomerOption(null);
    setTripSelectionType('DESTINATION');
    setPackageVariants([]);
    setCreateStep(1);
    navigate('/enquiries/new');
  };

  const importWhatsAppEnquiry = async () => {
    let parsed;
    try {
      parsed = parseWhatsappEnquiry(whatsappImportText);
    } catch (error) {
      toast.error(error.message || 'Unable to read the WhatsApp enquiry.');
      return;
    }

    const normalize = (value) => value?.trim().toLowerCase().replace(/\s+/g, ' ') || '';
    const findOption = (options, value, labels) => {
      const target = normalize(value);
      if (!target) return null;
      return options.find((option) => labels(option).some((label) => normalize(label) === target)) || null;
    };
    const packageOption = parsed.packageTitle
      ? findOption(packages, parsed.packageTitle, (option) => [option.raw?.title, option.label])
      : null;
    const destinationOption = parsed.destination
      ? findOption(destinations, parsed.destination, (option) => [option.label])
      : null;
    const selectionType = packageOption ? 'PACKAGE' : 'DESTINATION';
    const warnings = [];
    let variantOptions = [];
    let variantOption = null;

    if (parsed.packageTitle && !packageOption) {
      warnings.push(`Package "${parsed.packageTitle}" was not found; select it manually.`);
    }
    if (!parsed.packageTitle && !parsed.destination) {
      warnings.push('No package or destination was found; select one manually.');
    }
    if (selectionType === 'DESTINATION' && parsed.destination && !destinationOption) {
      warnings.push(`Destination "${parsed.destination}" was not found; select it manually.`);
    }
    if (!parsed.name.trim() && !parsed.phone.trim() && !parsed.email.trim()) {
      warnings.push('No contact details were found; enter a name, phone number, or email manually.');
    }
    if (packageOption) {
      variantOptions = await fetchVariantsForPackage(packageOption.value);
      variantOption = findOption(
        variantOptions,
        parsed.variant,
        (option) => [option.raw?.name, option.raw?.season_name, option.label]
      );
      if (parsed.variant && !variantOption) {
        warnings.push(`Variant "${parsed.variant}" was not found; select it manually.`);
      }
    } else {
      setPackageVariants([]);
    }

    const mealOption = findOption(MEAL_PLANS, parsed.meal_plan, (option) => [option.value, option.label]);
    const vehicleOption = findOption(VEHICLE_TYPES, parsed.vehicle_type, (option) => [option.value, option.label]);
    const hotelCategoryOption = findOption(HOTEL_CATEGORIES, parsed.hotel_category, (option) => [option.value, option.label]);
    const roomTypeOption = findOption(ROOM_TYPES, parsed.room_type, (option) => [option.value, option.label]);
    if (parsed.meal_plan && !mealOption) warnings.push(`Meal plan "${parsed.meal_plan}" was not recognized.`);
    if (parsed.vehicle_type && !vehicleOption) warnings.push(`Vehicle type "${parsed.vehicle_type}" was not recognized.`);
    if (parsed.hotel_category && !hotelCategoryOption) warnings.push(`Hotel category "${parsed.hotel_category}" was not recognized.`);
    if (parsed.room_type && !roomTypeOption) warnings.push(`Room type "${parsed.room_type}" was not recognized.`);

    const formValues = { ...parsed };
    delete formValues.destination;
    delete formValues.packageTitle;
    delete formValues.variant;
    setCreateForm({
      ...defaultCreateForm,
      ...formValues,
      destination_id: destinationOption?.value || packageOption?.raw?.destination_id || '',
      package_id: packageOption?.value || '',
      variant_id: variantOption?.value || '',
      meal_plan: mealOption?.value || 'ANY',
      vehicle_type: vehicleOption?.value || '',
      hotel_category: hotelCategoryOption?.value || '',
      room_type: roomTypeOption?.value || '',
    });
    setCustomerType('MANUAL');
    setSelectedCustomerOption(null);
    setTripSelectionType(selectionType);
    setCreateStep(1);
    setWhatsappImportOpen(false);

    if (warnings.length) {
      toast.error(`Details imported with items to review: ${warnings.join(' ')}`);
    } else {
      toast.success('WhatsApp enquiry details filled. Review them and create the enquiry.');
    }
  };

  const closeCreatePage = () => {
    if (saving) return;
    navigate('/enquiries');
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
        hotel_category: createForm.hotel_category || null,
        room_type: createForm.room_type || null,
        vehicle_type: createForm.vehicle_type || null,
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
      setCreateForm(defaultCreateForm);
      setCreateStep(1);
      setTripSelectionType('DESTINATION');
      setPackageVariants([]);
      navigate('/enquiries');
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
    <div className={isCreatePage ? 'w-full' : 'space-y-3 pb-6'}>
      {!isCreatePage && (
        <>
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
              onClick={openCreatePage}
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
                onClick={openCreatePage}
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
                  const travelPreferences = [
                    enq.hotel_category && getOptionLabel(HOTEL_CATEGORIES, enq.hotel_category),
                    enq.room_type && `${getOptionLabel(ROOM_TYPES, enq.room_type)} room`,
                    enq.vehicle_type && `${getOptionLabel(VEHICLE_TYPES, enq.vehicle_type)}${enq.vehicle_count ? ` (${enq.vehicle_count})` : ''}`,
                    !enq.vehicle_type && enq.vehicle_count ? `${enq.vehicle_count} vehicles` : null,
                  ].filter(Boolean).join(' · ');

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
                            {enq.enquiry_code || '—'}
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
                          {travelPreferences && (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                              {travelPreferences}
                            </p>
                          )}
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
        </>
      )}

      {isCreatePage && <EnquiryCreatePageShell
        onClose={closeCreatePage}
        title="Add New Customer Enquiry"
        icon={HelpCircle}
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
                  key="continue"
                  type="button"
                  onClick={goNextStep}
                  disabled={!isCreateStepValid(createStep)}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  key="submit"
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
        <div className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Import a WhatsApp enquiry</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Paste the customer's message to prefill this form, then review the details before creating it.
              </p>
            </div>
            <button
              type="button"
              aria-expanded={whatsappImportOpen}
              onClick={() => setWhatsappImportOpen((open) => !open)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-800 dark:bg-gray-800 dark:text-indigo-300 dark:hover:bg-gray-700"
            >
              <FileText className="h-4 w-4" />
              {whatsappImportOpen ? 'Close import' : 'Paste WhatsApp message'}
            </button>
          </div>
          {whatsappImportOpen && (
            <div className="mt-4 space-y-3">
              <label htmlFor="whatsapp-enquiry-import" className={labelClass}>WhatsApp message</label>
              <textarea
                id="whatsapp-enquiry-import"
                rows={8}
                value={whatsappImportText}
                onChange={(event) => setWhatsappImportText(event.target.value)}
                placeholder="Paste the complete WhatsApp enquiry message here..."
                className={inputClass}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={importWhatsAppEnquiry}
                  disabled={!whatsappImportText.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check className="h-4 w-4" /> Extract details
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
          <aside className="min-w-0">
            <div className="mb-5 lg:hidden">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400">
                <span>Step {createStep} of {CREATE_STEPS.length}</span>
                <span>{currentCreateStep.label}</span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
                role="progressbar"
                aria-label="Enquiry creation progress"
                aria-valuemin={1}
                aria-valuemax={CREATE_STEPS.length}
                aria-valuenow={createStep}
              >
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all"
                  style={{ width: `${(createStep / CREATE_STEPS.length) * 100}%` }}
                />
              </div>
            </div>
            <nav aria-label="Enquiry creation steps" className="hidden lg:block">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Enquiry setup</p>
              <ol className="mt-4 space-y-1">
                {CREATE_STEPS.map((step) => {
                  const isComplete = step.id < createStep;
                  const isCurrent = step.id === createStep;
                  return (
                    <li key={step.id}>
                      <button
                        type="button"
                        aria-current={isCurrent ? 'step' : undefined}
                        disabled={!isComplete}
                        onClick={() => setCreateStep(step.id)}
                        className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-3 text-left transition ${
                          isCurrent
                            ? 'bg-indigo-50/80 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300'
                            : isComplete
                            ? 'text-emerald-700 hover:bg-emerald-50/70 dark:text-emerald-400 dark:hover:bg-emerald-950/20'
                            : 'text-gray-400 dark:text-gray-500'
                        } ${!isComplete ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            isCurrent
                              ? 'bg-indigo-600 text-white'
                              : isComplete
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
                          }`}
                        >
                          {isComplete ? <Check className="h-4 w-4" /> : step.id}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{step.label}</span>
                          <span className="mt-0.5 block text-[11px] leading-4 text-gray-500 dark:text-gray-400">
                            {step.description}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </aside>

          <section className="min-w-0">
            <div className="mb-5 border-b border-gray-200/70 pb-4 dark:border-gray-700/70">
              <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Step {String(createStep).padStart(2, '0')} / {String(CREATE_STEPS.length).padStart(2, '0')}
              </p>
              <h2 className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                {currentCreateStep.label}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {currentCreateStep.description}
              </p>
            </div>

            <form
              id="create-enquiry-form"
              onSubmit={handleCreateSubmit}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') event.preventDefault();
              }}
              className="space-y-5"
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
                  <label className={labelClass}>Customer name</label>
                  <input type="text" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="e.g. John Doe" className={inputClass} />
                  <p className="mt-1 text-xs text-gray-400">Optional if phone or email is provided.</p>
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
                  Select a destination or a specific tour package.
                </p>
              </div>

              {/* Radio Button Selector */}
              <div>
                <label className={labelClass}>Choose selection mode</label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <label
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
                        }));
                        setPackageVariants([]);
                      }}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <div>
                      <span className="text-sm font-bold block">By Destination</span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        {createForm.enquiry_type === 'CUSTOM_TOUR'
                          ? 'Choose where the customer wants a custom itinerary'
                          : 'Select the destination for this enquiry'}
                      </span>
                    </div>
                  </label>

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
                        }));
                      }}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <div>
                      <span className="text-sm font-bold block">By Tour Package</span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        Select a package and an optional variant
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
                        }));
                      }}
                      placeholder="Select a destination"
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
                        }));
                        if (pkgId) {
                          fetchVariantsForPackage(pkgId);
                        } else {
                          setPackageVariants([]);
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

                </div>
              )}
            </div>
          )}

          {/* STEP 4: Travel plan */}
          {createStep === 4 && (
            <div className="space-y-4">
              <div className="mb-1">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">When and who is travelling?</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Add a preferred date, trip duration and traveller counts.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Travel date <span className="text-gray-400 font-normal">(optional)</span></label>
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
                    <label className="mb-1 block text-[11px] font-medium text-gray-500">Adults</label>
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

            </div>
          )}

          {/* STEP 5: Preferences and budget */}
          {createStep === 5 && (
            <div className="space-y-5">
              <div className="mb-1">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Preferences and budget</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Capture accommodation, transport and budget preferences if known.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Rooms</label>
                  <input type="text" inputMode="numeric" min="0" placeholder="Number of rooms" value={createForm.room_count} onChange={(e) => setCreateForm({ ...createForm, room_count: sanitizeNumericInput(e.target.value) })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Hotel category</label>
                  <SelectField
                    options={HOTEL_CATEGORIES}
                    value={HOTEL_CATEGORIES.find((option) => option.value === createForm.hotel_category) || null}
                    onChange={(selected) => setCreateForm({ ...createForm, hotel_category: selected?.value || '' })}
                    isSearchable={false}
                    isClearable
                    placeholder="Select hotel category"
                    menuPlacement="auto"
                  />
                </div>
                <div>
                  <label className={labelClass}>Room type</label>
                  <SelectField
                    options={ROOM_TYPES}
                    value={ROOM_TYPES.find((option) => option.value === createForm.room_type) || null}
                    onChange={(selected) => setCreateForm({ ...createForm, room_type: selected?.value || '' })}
                    isSearchable={false}
                    isClearable
                    placeholder="Select room type"
                    menuPlacement="auto"
                  />
                </div>
                <div>
                  <label className={labelClass}>Meal plan</label>
                  <SelectField options={MEAL_PLANS} value={MEAL_PLANS.find((m) => m.value === createForm.meal_plan) || null} onChange={(selected) => setCreateForm({ ...createForm, meal_plan: selected?.value || 'ANY' })} isSearchable={false} placeholder="Select meal plan" menuPlacement="auto" />
                </div>
                <div>
                  <label className={labelClass}>Vehicle type</label>
                  <SelectField
                    options={VEHICLE_TYPES}
                    value={VEHICLE_TYPES.find((option) => option.value === createForm.vehicle_type) || null}
                    onChange={(selected) => setCreateForm({ ...createForm, vehicle_type: selected?.value || '' })}
                    isSearchable={false}
                    isClearable
                    placeholder="Select vehicle type"
                    menuPlacement="auto"
                  />
                </div>
                <div>
                  <label className={labelClass}>Vehicles</label>
                  <input type="text" inputMode="numeric" min="0" placeholder="Number of vehicles" value={createForm.vehicle_count} onChange={(e) => setCreateForm({ ...createForm, vehicle_count: sanitizeNumericInput(e.target.value) })} className={inputClass} />
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
          </section>
        </div>
      </EnquiryCreatePageShell>}





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
                      {selectedEnquiry.room_count ?? 'Not specified'} rooms · {getOptionLabel(MEAL_PLANS, selectedEnquiry.meal_plan)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Destination</dt>
                    <dd className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5 truncate">
                      {destMap[selectedEnquiry.destination_id] || 'Not specified'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Tour package</dt>
                    <dd className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5 truncate">
                      {packageMap[selectedEnquiry.package_id] || 'Not specified'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Hotel preference</dt>
                    <dd className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5 truncate">
                      {[
                        selectedEnquiry.hotel_category && getOptionLabel(HOTEL_CATEGORIES, selectedEnquiry.hotel_category),
                        selectedEnquiry.room_type && `${getOptionLabel(ROOM_TYPES, selectedEnquiry.room_type)} room`,
                      ].filter(Boolean).join(' · ') || 'Not specified'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Vehicle preference</dt>
                    <dd className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5 truncate">
                      {selectedEnquiry.vehicle_type
                        ? `${getOptionLabel(VEHICLE_TYPES, selectedEnquiry.vehicle_type)}${selectedEnquiry.vehicle_count ? ` · ${selectedEnquiry.vehicle_count} vehicles` : ''}`
                        : selectedEnquiry.vehicle_count
                        ? `${selectedEnquiry.vehicle_count} vehicles`
                        : 'Not specified'}
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
