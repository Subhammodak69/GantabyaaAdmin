import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ManagementTable from '../component/common/ManagementTable';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  ArrowLeft,
  Calendar,
  Check,
  FileText,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import Modal from '../component/common/Modal';
import ConfirmDeleteModal from '../component/common/ConfirmDeleteModal';
import CustomDatePicker from '../component/common/CustomDatePicker';
import SelectField from '../component/common/SelectField';
import Pagination from '../component/common/PaginationComponent';
import ActionMenu from '../component/common/ActionMenu';
import { apiCall, handleApiError } from '../utils/apiCall';
import { useEnums } from '../context/EnumsContext';

const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200';
const emptyLineItem = { item_type: 'other', name: '', description: '', quantity: 1, unit_price: '0', total_price: '0' };
const emptyHotel = { hotel_id: '', hotel_name: '', check_in: '', check_out: '', nights: 1, room_count: 1, room_type: 'SINGLE' };
const emptyVehicle = { vehicle_id: '', vehicle_name: '', vehicle_type: 'ANY', start_date: '', end_date: '', rental_minutes: 1, quantity: 1 };
const emptyItinerary = { day_number: 1, date: '', title: '', description: '', overnight_location: '', meal_plan: '', sort_order: 0 };

const defaultForm = {
  customer_id: '', enquiry_id: '', package_id: '', variant_id: '', destination_id: '', tour_name: '',
  travel_date: '', return_date: '', subtotal: '0', discount_amount: '0', tax_amount: '0', total_amount: '0',
  valid_until: '', terms_and_conditions: '', important_notes: '', inclusion: '', exclusion: '',
  items: [emptyLineItem], hotels: [], vehicles: [], itinerary: [],
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  try { return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return value; }
};
const formatAmount = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const prettyLabel = (value) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const numericValue = (value) => value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
const normalizeEnquiryDate = (value) => {
  if (!value) return '';
  return String(value).length === 10 ? `${value}T00:00` : String(value).slice(0, 16);
};
const getVariantDetail = (payload) => {
  const data = payload?.data || {};
  return { ...data, ...(data.variant || {}), ...(data.details || {}), ...(data.tour_detail || {}), ...(data.tour_details || {}) };
};
const getQuotationText = (source) => {
  if (!Array.isArray(source)) return source == null ? undefined : String(source);
  return source.map((item) => typeof item === 'string' ? item : item?.text || item?.value || item?.name || '')
    .filter(Boolean)
    .join('\n');
};
const getVariantQuotationText = (detail, field) => {
  const aliases = field === 'inclusion' ? ['inclusions', 'inclusion'] : ['exclusions', 'exclusion'];
  const key = aliases.find((candidate) => Object.prototype.hasOwnProperty.call(detail, candidate));
  return key ? getQuotationText(detail[key]) : undefined;
};
const getVariantDates = (detail, variant) => {
  const sources = [detail?.departure_dates, detail?.departures, detail?.dates, variant?.departure_dates, variant?.departures, variant?.dates];
  for (const source of sources) {
    if (Array.isArray(source) && source.length) return source;
    if (Array.isArray(source?.items) && source.items.length) return source.items;
  }
  return [];
};
const getPreferredDeparture = (dates, preferredDate = '') => {
  const departureDate = (departure) => String(
    departure.departure_date || departure.date || departure.start_date || departure.travel_date || ''
  ).slice(0, 10);
  if (preferredDate) {
    const matchingDate = dates.find((departure) => departureDate(departure) === String(preferredDate).slice(0, 10));
    if (matchingDate) return matchingDate;
  }
  const upcoming = dates
    .filter((departure) => departureDate(departure))
    .sort((left, right) => departureDate(left).localeCompare(departureDate(right)));
  const today = new Date().toISOString().slice(0, 10);
  return upcoming.find((departure) => departureDate(departure) >= today && Number(departure.available_seats ?? 1) > 0)
    || upcoming.find((departure) => departureDate(departure) >= today)
    || upcoming.find((departure) => Number(departure.available_seats ?? 1) > 0)
    || upcoming[0]
    || null;
};
const statusClasses = {
  DRAFT: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  SENT: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-300',
  ACCEPTED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300',
  REJECTED: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300',
};

const QuotationManagement = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialEnquiryId = searchParams.get('enquiry_id') || '';
  const initialStatus = searchParams.get('status') || '';
  const { getEnumOptions } = useEnums();
  const quotationItemTypeOptions = getEnumOptions('CostItemType');
  const roomTypeOptions = getEnumOptions('RoomType');
  const vehicleTypeOptions = getEnumOptions('VehicleType');
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [enquiryFilter, setEnquiryFilter] = useState(initialEnquiryId);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [createStep, setCreateStep] = useState(1);
  const createSubmitRequestedRef = useRef(false);
  const [enquiryOptions, setEnquiryOptions] = useState([]);
  const [packageOptions, setPackageOptions] = useState([]);
  const [variantOptions, setVariantOptions] = useState([]);
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [hotelOptions, setHotelOptions] = useState([]);
  const [vehicleOptions, setVehicleOptions] = useState([]);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [itineraryLoading, setItineraryLoading] = useState(false);
  const [tripSelectionType, setTripSelectionType] = useState('DESTINATION');

  const quotationSteps = [
    { id: 1, label: 'References' },
    { id: 2, label: 'Trip details' },
    { id: 3, label: 'Components' },
    { id: 4, label: 'Pricing & notes' },
  ];

  const loadQuotations = useCallback(async (
    page = currentPage,
    limit = itemsPerPage,
    enquiryId = enquiryFilter,
    status = statusFilter,
    search = searchTerm
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(limit),
      });
      if (enquiryId) params.append('enquiry_id', enquiryId);
      if (status) params.append('status', status);
      if (search && search.trim()) params.append('search', search.trim());

      const response = await apiCall(`/api/v1/admin/quotations?${params.toString()}`, 'GET');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || payload?.detail || 'Unable to fetch quotations');
      const data = Array.isArray(payload?.data) ? payload.data : [];
      setQuotations(data);
      setTotalItems(Number(payload?.pagination?.total_items ?? data.length));
    } catch (error) {
      handleApiError(error, 'Unable to load quotations');
    } finally { setLoading(false); }
  }, [currentPage, itemsPerPage, enquiryFilter, statusFilter, searchTerm]);

  useEffect(() => {
    loadQuotations(currentPage, itemsPerPage, enquiryFilter, statusFilter, searchTerm);
  }, [loadQuotations, currentPage, itemsPerPage, enquiryFilter, statusFilter, searchTerm]);

  const handleEnquiryFilterChange = (option) => {
    const val = option?.value || '';
    setEnquiryFilter(val);
    setCurrentPage(1);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val) next.set('enquiry_id', val);
      else next.delete('enquiry_id');
      return next;
    });
  };

  const handleStatusFilterChange = (e) => {
    const val = e.target.value;
    setStatusFilter(val);
    setCurrentPage(1);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val) next.set('status', val);
      else next.delete('status');
      return next;
    });
  };

  const clearAllFilters = () => {
    setEnquiryFilter('');
    setStatusFilter('');
    setSearchTerm('');
    setCurrentPage(1);
    setSearchParams({});
  };

  const loadReferenceOptions = useCallback(async () => {
    setReferencesLoading(true);
    try {
      const enquiriesResponse = await apiCall('/api/v1/admin/enquiries?page=1&page_size=100', 'GET');
      const [packagesResponse, destinationsResponse, hotelsResponse, vehiclesResponse] = await Promise.all([
        apiCall('/api/v1/admin/tour-packages?page=1&page_size=100', 'GET'),
        apiCall('/api/v1/admin/destinations?page=1&page_size=100', 'GET'),
        apiCall('/api/v1/admin/hotels?page=1&page_size=100', 'GET'),
        apiCall('/api/v1/admin/vehicles?page=1&page_size=100', 'GET'),
      ]);
      const enquiriesPayload = await enquiriesResponse.json().catch(() => ({}));
      const [packagesPayload, destinationsPayload, hotelsPayload, vehiclesPayload] = await Promise.all([
        packagesResponse.json().catch(() => ({})),
        destinationsResponse.json().catch(() => ({})),
        hotelsResponse.json().catch(() => ({})),
        vehiclesResponse.json().catch(() => ({})),
      ]);
      if (enquiriesResponse.ok) {
        setEnquiryOptions((Array.isArray(enquiriesPayload?.data) ? enquiriesPayload.data : []).map((enquiry) => ({
          value: enquiry.id,
          label: [enquiry.enquiry_code || enquiry.id, enquiry.enquirer_name || enquiry.name || enquiry.customer_name || 'Unnamed enquirer', enquiry.enquirer_phone || enquiry.phone || enquiry.mobile, enquiry.email, enquiry.enquiry_type, enquiry.travel_date ? new Date(enquiry.travel_date).toLocaleDateString() : null].filter(Boolean).join(' - '),
          raw: enquiry,
        })));
      }
      if (packagesResponse.ok) {
        setPackageOptions((Array.isArray(packagesPayload?.data) ? packagesPayload.data : []).map((pkg) => ({
          value: pkg.id,
          label: `${pkg.name || pkg.title || 'Unnamed package'}${pkg.code ? ` - ${pkg.code}` : ''}`,
          raw: pkg,
        })));
      }
      if (destinationsResponse.ok) {
        setDestinationOptions((Array.isArray(destinationsPayload?.data) ? destinationsPayload.data : []).map((destination) => ({
          value: destination.id,
          label: destination.name || destination.title || 'Unnamed destination',
        })));
      }
      if (hotelsResponse.ok) {
        setHotelOptions((Array.isArray(hotelsPayload?.data) ? hotelsPayload.data : []).map((hotel) => ({
          value: hotel.id,
          label: `${hotel.name || 'Unnamed hotel'}${hotel.category ? ` - ${hotel.category}` : ''}`,
        })));
      }
      if (vehiclesResponse.ok) {
        setVehicleOptions((Array.isArray(vehiclesPayload?.data) ? vehiclesPayload.data : []).map((vehicle) => ({
          value: vehicle.id,
          label: `${vehicle.name || 'Unnamed vehicle'}${vehicle.vehicle_type ? ` - ${vehicle.vehicle_type}` : ''}`,
        })));
      }
    } catch (error) {
      handleApiError(error, 'Unable to load enquiry options');
    } finally { setReferencesLoading(false); }
  }, []);

  useEffect(() => { loadReferenceOptions(); }, [loadReferenceOptions]);

  const selectedEnquiry = enquiryOptions.find((option) => option.value === form.enquiry_id)?.raw || null;
  const loadVariantDetails = useCallback(async (packageId, variantId, variant = null) => {
    if (!packageId || !variantId) {
      setForm((current) => ({ ...current, itinerary: [], travel_date: '', return_date: '' }));
      return;
    }
    setItineraryLoading(true);
    try {
      const response = await apiCall(
        `/api/v1/admin/tour-packages/${encodeURIComponent(packageId)}/variants/${encodeURIComponent(variantId)}`,
        'GET'
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || payload?.detail || 'Unable to load the selected variant details.');
      }
      const detail = getVariantDetail(payload) || {};
      const itinerary = Array.isArray(detail.itinerary) ? detail.itinerary : [];
      const departures = getVariantDates(detail, variant);
      const inclusion = getVariantQuotationText(detail, 'inclusion');
      const exclusion = getVariantQuotationText(detail, 'exclusion');
      setForm((current) => {
        const departure = getPreferredDeparture(departures, current.travel_date);
        const travelDate = departure?.departure_date || departure?.date || departure?.start_date || departure?.travel_date
          || detail.valid_from || variant?.valid_from;
        const returnDate = departure?.return_date || departure?.end_date || departure?.to_date
          || detail.valid_to || variant?.valid_to;
        return {
          ...current,
          travel_date: travelDate ? normalizeEnquiryDate(travelDate) : '',
          return_date: returnDate ? normalizeEnquiryDate(returnDate) : '',
          ...(inclusion !== undefined ? { inclusion } : {}),
          ...(exclusion !== undefined ? { exclusion } : {}),
          itinerary: itinerary.map((day, index) => ({
            ...day,
            day_number: Number(day.day_number ?? day.day) || index + 1,
            date: day.date || '',
            sort_order: Number(day.sort_order) || index,
          })),
        };
      });
    } catch (error) {
      handleApiError(error, 'Unable to load the selected package variant details');
    } finally { setItineraryLoading(false); }
  }, []);

  const loadVariantItinerary = useCallback((variantId, packageId = form.package_id) => {
    const variant = variantOptions.find((option) => option.value === variantId)?.raw || null;
    return loadVariantDetails(packageId, variantId, variant);
  }, [form.package_id, loadVariantDetails, variantOptions]);

  const handleEnquiryChange = (option) => {
    const enquiry = option?.raw;
    const selectedPackage = packageOptions.find((packageOption) => packageOption.value === enquiry?.package_id)?.raw;
    setTripSelectionType(enquiry?.package_id ? 'PACKAGE' : 'DESTINATION');
    setForm((current) => ({
      ...current,
      enquiry_id: option?.value || '',
      customer_id: enquiry?.customer_id || '',
      package_id: enquiry?.package_id || '',
      variant_id: enquiry?.variant_id || '',
      destination_id: enquiry?.destination_id || '',
      travel_date: normalizeEnquiryDate(enquiry?.travel_date),
      tour_name: selectedPackage?.name || selectedPackage?.title || current.tour_name,
      important_notes: enquiry?.message || current.important_notes,
    }));
    if (enquiry?.variant_id && enquiry?.package_id) {
      loadVariantItinerary(enquiry.variant_id, enquiry.package_id);
    }
  };

  useEffect(() => {
    if (!form.package_id) {
      setVariantOptions([]);
      return undefined;
    }
    let isCurrent = true;
    setVariantsLoading(true);
    apiCall(`/api/v1/admin/tour-packages/${form.package_id}/variants?page=1&page_size=100`, 'GET')
      .then((response) => response.json().then((payload) => ({ response, payload })))
      .then(({ response, payload }) => {
        if (!isCurrent) return;
        setVariantOptions(response.ok && Array.isArray(payload?.data) ? payload.data.map((variant) => ({
          value: variant.id,
          label: `${variant.name || 'Unnamed variant'}${variant.season_name ? ` - ${variant.season_name}` : ''}`,
          raw: variant,
        })) : []);
      })
      .catch(() => { if (isCurrent) setVariantOptions([]); })
      .finally(() => { if (isCurrent) setVariantsLoading(false); });
    return () => { isCurrent = false; };
  }, [form.package_id]);

  useEffect(() => {
    if (tripSelectionType === 'PACKAGE' && !form.variant_id && (form.travel_date || form.return_date)) {
      setForm((current) => ({ ...current, travel_date: '', return_date: '' }));
    }
  }, [tripSelectionType, form.package_id, form.variant_id, form.travel_date, form.return_date]);

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const updateArrayItem = (field, index, key, value) => setForm((current) => ({
    ...current,
    [field]: current[field].map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const nextItem = { ...item, [key]: value };
      if (field === 'items' && (key === 'quantity' || key === 'unit_price')) {
        nextItem.total_price = (Number(nextItem.quantity || 0) * Number(nextItem.unit_price || 0)).toFixed(2);
      }
      return nextItem;
    }),
  }));
  const addArrayItem = (field, template) => setForm((current) => ({ ...current, [field]: [...current[field], { ...template }] }));
  const removeArrayItem = (field, index) => setForm((current) => ({ ...current, [field]: current[field].filter((_, itemIndex) => itemIndex !== index) }));

  const openCreate = () => {
    createSubmitRequestedRef.current = false;
    setForm(defaultForm);
    setTripSelectionType('DESTINATION');
    setCreateStep(1);
    setIsCreateOpen(true);
    if (enquiryFilter) {
      const match = enquiryOptions.find((opt) => opt.value === enquiryFilter);
      if (match) {
        handleEnquiryChange(match);
      }
    }
  };
  const closeCreate = () => { createSubmitRequestedRef.current = false; setIsCreateOpen(false); setForm(defaultForm); setTripSelectionType('DESTINATION'); setCreateStep(1); };
  const isCreateStepValid = (step) => {
    if (step === 1) return Boolean(form.enquiry_id.trim());
    if (step === 2) return Boolean(form.tour_name.trim());
    if (step === 3) return true;
    return true;
  };
  const goNextStep = () => {
    if (!isCreateStepValid(createStep)) return;
    setCreateStep((current) => Math.min(current + 1, quotationSteps.length));
  };
  const goPreviousStep = () => setCreateStep((current) => Math.max(current - 1, 1));
  const saveQuotation = async (event) => {
    event.preventDefault();
    if (!createSubmitRequestedRef.current) return;
    createSubmitRequestedRef.current = false;
    if (createStep !== quotationSteps.length || !isCreateStepValid(quotationSteps.length)) return;
    if (!form.enquiry_id.trim() || !form.tour_name.trim()) { toast.error('Enquiry ID and tour name are required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        tour_name: form.tour_name.trim(),
        subtotal: Number(form.subtotal) || 0,
        discount_amount: Number(form.discount_amount) || 0,
        tax_amount: Number(form.tax_amount) || 0,
        total_amount: Number(form.total_amount) || 0,
        items: form.items.map((item) => ({ ...item, quantity: Number(item.quantity) || 1, unit_price: String(item.unit_price || 0), total_price: String(item.total_price || 0) })),
        hotels: form.hotels.map((hotel) => ({ ...hotel, nights: Number(hotel.nights) || 1, room_count: Number(hotel.room_count) || 1 })),
        vehicles: form.vehicles.map((vehicle) => ({ ...vehicle, rental_minutes: Number(vehicle.rental_minutes) || 1, quantity: Number(vehicle.quantity) || 1 })),
        itinerary: form.itinerary.map((day, index) => ({ ...day, day_number: Number(day.day_number) || index + 1, sort_order: Number(day.sort_order) || index })),
      };
      ['customer_id', 'package_id', 'variant_id', 'destination_id', 'travel_date', 'return_date', 'valid_until', 'terms_and_conditions', 'important_notes', 'inclusion', 'exclusion']
        .forEach((field) => { if (!payload[field]) payload[field] = null; });
      const response = await apiCall('/api/v1/admin/quotations', 'POST', payload);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || result?.detail || 'Unable to create quotation');
      const created = result?.data;
      toast.success(result?.message || 'Quotation created successfully');
      closeCreate();
      if (created?.id) navigate(`/quotations/${created.id}`); else await loadQuotations(currentPage, itemsPerPage);
    } catch (error) { handleApiError(error, 'Unable to create quotation'); } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await apiCall(`/api/v1/admin/quotations/${deleteTarget.id}`, 'DELETE');
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || result?.detail || 'Unable to delete quotation');
      toast.success(result?.message || 'Quotation deleted successfully');
      setIsDeleteOpen(false); setDeleteTarget(null); await loadQuotations(currentPage, itemsPerPage);
    } catch (error) { handleApiError(error, 'Unable to delete quotation'); } finally { setDeleting(false); }
  };

  const visibleQuotations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return quotations;
    return quotations.filter((quotation) => [quotation.quotation_code, quotation.tour_name, quotation.status, quotation.customer_id, quotation.enquiry_id]
      .filter(Boolean).join(' ').toLowerCase().includes(term));
  }, [quotations, searchTerm]);

  const labelClass = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300';
  const renderInput = (label, field, type = 'text') => {
    const variantDateLocked = tripSelectionType === 'PACKAGE'
      && Boolean(form.variant_id)
      && ['travel_date', 'return_date'].includes(field);
    return (
      <div>
        <label className={labelClass}>{label}</label>
        {variantDateLocked
          ? <input type="text" readOnly value={form[field] ? formatDate(form[field]) : 'No date configured for this variant'} className={`${inputClass} cursor-not-allowed opacity-70`} />
          : type === 'datetime-local'
            ? <CustomDatePicker value={form[field]} onChange={(value) => updateForm(field, value)} />
            : <input type="text" inputMode={type === 'number' ? 'decimal' : undefined} value={form[field]} onChange={(event) => updateForm(field, type === 'number' ? numericValue(event.target.value) : event.target.value)} className={inputClass} />}
      </div>
    );
  };
  const renderNestedRows = (field, label, template, fields) => (
    <section className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-gray-700">
      <div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900 dark:text-slate-100">{label}</h3><button type="button" onClick={() => addArrayItem(field, template)} className="text-sm font-semibold text-cyan-700 hover:text-cyan-800 dark:text-cyan-300">Add</button></div>
      {form[field].map((item, index) => <div key={`${field}-${index}`} className="grid gap-3 rounded-xl bg-slate-50 p-3 dark:bg-gray-900/50 md:grid-cols-2">
        {fields.map(([key, fieldLabel, type]) => <div key={key}><label className={labelClass}>{fieldLabel}</label>{type === 'select' ? <SelectField options={quotationItemTypeOptions} value={quotationItemTypeOptions.find((option) => option.value === item[key]) || null} onChange={(option) => updateArrayItem(field, index, key, option?.value || 'other')} isSearchable={false} menuPlacement="auto" /> : type === 'datetime-local' || type === 'date' ? <CustomDatePicker value={item[key] ?? ''} includeTime={type === 'datetime-local'} onChange={(value) => updateArrayItem(field, index, key, value)} /> : <input type="text" inputMode={type === 'number' ? 'decimal' : undefined} readOnly={type === 'calculated'} value={item[key] ?? ''} onChange={(event) => updateArrayItem(field, index, key, type === 'number' ? numericValue(event.target.value) : event.target.value)} className={`${inputClass} ${type === 'calculated' ? 'bg-slate-100 font-semibold dark:bg-gray-800' : ''}`} />}</div>)}
        <button type="button" onClick={() => removeArrayItem(field, index)} className="justify-self-start text-sm font-medium text-rose-600">Remove</button>
      </div>)}
    </section>
  );
  const renderHotelRows = () => (
    <section className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-gray-700">
      <div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900 dark:text-slate-100">Hotels</h3><button type="button" onClick={() => addArrayItem('hotels', emptyHotel)} className="text-sm font-semibold text-cyan-700">Add</button></div>
      {form.hotels.map((hotel, index) => <div key={`hotel-${index}`} className="grid gap-3 rounded-xl bg-slate-50 p-3 dark:bg-gray-900/50 md:grid-cols-2">
        <div><label className={labelClass}>Hotel</label><SelectField options={hotelOptions} isLoading={referencesLoading} isSearchable value={hotelOptions.find((option) => option.value === hotel.hotel_id) || null} onChange={(option) => updateArrayItem('hotels', index, 'hotel_id', option?.value || '')} placeholder="Select hotel" isClearable menuPlacement="auto" /></div>
        {['check_in', 'check_out'].map((key) => <div key={key}><label className={labelClass}>{key === 'check_in' ? 'Check in' : 'Check out'}</label><CustomDatePicker value={hotel[key] || ''} includeTime onChange={(value) => updateArrayItem('hotels', index, key, value)} /></div>)}
        {[['nights', 'Nights'], ['room_count', 'Rooms']].map(([key, label]) => <div key={key}><label className={labelClass}>{label}</label><input type="text" inputMode="decimal" value={hotel[key] ?? ''} onChange={(event) => updateArrayItem('hotels', index, key, numericValue(event.target.value))} className={inputClass} /></div>)}
        <div><label className={labelClass}>Room type</label><SelectField options={roomTypeOptions} value={roomTypeOptions.find((option) => option.value === hotel.room_type) || null} onChange={(option) => updateArrayItem('hotels', index, 'room_type', option?.value || '')} isSearchable={false} menuPlacement="auto" /></div>
        <button type="button" onClick={() => removeArrayItem('hotels', index)} className="justify-self-start text-sm font-medium text-rose-600">Remove</button>
      </div>)}
    </section>
  );
  const renderVehicleRows = () => (
    <section className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-gray-700">
      <div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900 dark:text-slate-100">Vehicles</h3><button type="button" onClick={() => addArrayItem('vehicles', emptyVehicle)} className="text-sm font-semibold text-cyan-700">Add</button></div>
      {form.vehicles.map((vehicle, index) => <div key={`vehicle-${index}`} className="grid gap-3 rounded-xl bg-slate-50 p-3 dark:bg-gray-900/50 md:grid-cols-2">
        <div><label className={labelClass}>Vehicle</label><SelectField options={vehicleOptions} isLoading={referencesLoading} isSearchable value={vehicleOptions.find((option) => option.value === vehicle.vehicle_id) || null} onChange={(option) => updateArrayItem('vehicles', index, 'vehicle_id', option?.value || '')} placeholder="Select vehicle" isClearable menuPlacement="auto" /></div>
        <div><label className={labelClass}>Vehicle type</label><SelectField options={vehicleTypeOptions} value={vehicleTypeOptions.find((option) => option.value === vehicle.vehicle_type) || null} onChange={(option) => updateArrayItem('vehicles', index, 'vehicle_type', option?.value || '')} isSearchable={false} menuPlacement="auto" /></div>
        {['start_date', 'end_date'].map((key) => <div key={key}><label className={labelClass}>{key === 'start_date' ? 'Start date' : 'End date'}</label><CustomDatePicker value={vehicle[key] || ''} includeTime onChange={(value) => updateArrayItem('vehicles', index, key, value)} /></div>)}
        {[['rental_minutes', 'Rental minutes'], ['quantity', 'Quantity']].map(([key, label]) => <div key={key}><label className={labelClass}>{label}</label><input type="text" inputMode="decimal" value={vehicle[key] ?? ''} onChange={(event) => updateArrayItem('vehicles', index, key, numericValue(event.target.value))} className={inputClass} /></div>)}
        <button type="button" onClick={() => removeArrayItem('vehicles', index)} className="justify-self-start text-sm font-medium text-rose-600">Remove</button>
      </div>)}
    </section>
  );
  const renderItineraryRows = () => (
    <section className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-gray-700">
      <div className="flex items-center justify-between"><div><h3 className="font-semibold text-slate-900 dark:text-slate-100">Itinerary</h3>{itineraryLoading && <p className="text-xs text-gray-500">Loading package itinerary...</p>}</div><button type="button" onClick={() => addArrayItem('itinerary', { ...emptyItinerary, day_number: form.itinerary.length + 1, sort_order: form.itinerary.length })} className="text-sm font-semibold text-cyan-700">Add day</button></div>
      {form.itinerary.length === 0 && <p className="text-sm text-gray-500">No itinerary days added.</p>}
      {form.itinerary.map((day, index) => <div key={`itinerary-${index}`} className="grid gap-3 rounded-xl bg-slate-50 p-3 dark:bg-gray-900/50 md:grid-cols-2">
        {['day_number', 'title', 'date', 'overnight_location', 'meal_plan'].map((key) => <div key={key}><label className={labelClass}>{prettyLabel(key)}</label>{key === 'date' ? <CustomDatePicker value={day[key] || ''} onChange={(value) => updateArrayItem('itinerary', index, key, value)} /> : <input type="text" inputMode={key === 'day_number' ? 'decimal' : undefined} value={day[key] ?? ''} onChange={(event) => updateArrayItem('itinerary', index, key, key === 'day_number' ? numericValue(event.target.value) : event.target.value)} className={inputClass} />}</div>)}
        <div className="md:col-span-2"><label className={labelClass}>Description</label><textarea value={day.description || ''} onChange={(event) => updateArrayItem('itinerary', index, 'description', event.target.value)} className={`${inputClass} min-h-[90px]`} /></div>
        <button type="button" onClick={() => removeArrayItem('itinerary', index)} className="justify-self-start text-sm font-medium text-rose-600">Remove</button>
      </div>)}
    </section>
  );

  const selectedFilterEnquiry = enquiryOptions.find((opt) => opt.value === enquiryFilter);

  return <div className="space-y-5 pb-8">
    <div className="flex flex-col gap-3 px-2 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Quotations</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Build, review, and send customer-ready travel quotations.</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          aria-label="Refresh quotations"
          title="Refresh quotations"
          onClick={() => loadQuotations(currentPage, itemsPerPage, enquiryFilter, statusFilter, searchTerm)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5 text-sm font-semibold text-gray-700 sm:px-3 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
        <button
          type="button"
          aria-label="New quotation"
          title="New quotation"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 p-2.5 text-sm font-semibold text-white hover:bg-cyan-700 sm:px-4"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New quotation</span>
        </button>
      </div>
    </div>

    {/* Search & Filter Toolbar */}
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={searchTerm}
          onChange={(event) => { setSearchTerm(event.target.value); setCurrentPage(1); }}
          placeholder="Search quotations..."
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        />
      </div>

      <button
        type="button"
        onClick={() => setIsFilterOpen(true)}
        className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition sm:px-4 ${
          enquiryFilter || statusFilter
            ? 'border-cyan-400 bg-cyan-50 text-cyan-700 dark:border-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300'
            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
        }`}
      >
        <Filter className="h-4 w-4" />
        <span className="hidden sm:inline">Filter</span>
        {(enquiryFilter || statusFilter) && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold text-white">
            {[enquiryFilter, statusFilter].filter(Boolean).length}
          </span>
        )}
      </button>

      {(enquiryFilter || statusFilter || searchTerm) && (
        <button
          type="button"
          onClick={clearAllFilters}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-dashed border-gray-300 px-2.5 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 sm:px-3"
        >
          <X className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Clear</span>
        </button>
      )}

      <span className="hidden shrink-0 text-sm text-gray-500 dark:text-gray-400 sm:block">
        {totalItems} record{totalItems === 1 ? '' : 's'}
      </span>
    </div>

    {/* Filter Modal */}
    <Modal
      isOpen={isFilterOpen}
      onClose={() => setIsFilterOpen(false)}
      title="Filter Quotations"
      icon={Filter}
      size="sm"
      footer={(
        <div className="flex w-full gap-3">
          <button
            type="button"
            onClick={() => {
              clearAllFilters();
              setIsFilterOpen(false);
            }}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={() => setIsFilterOpen(false)}
            className="flex-1 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700"
          >
            Apply
          </button>
        </div>
      )}
    >
      <div className="space-y-4 p-1">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Enquiry</label>
          <SelectField
            options={enquiryOptions}
            isLoading={referencesLoading}
            isSearchable
            isClearable
            value={selectedFilterEnquiry || null}
            onChange={handleEnquiryFilterChange}
            placeholder="Filter by enquiry..."
            menuPlacement="auto"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
          <select
            value={statusFilter}
            onChange={handleStatusFilterChange}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>
    </Modal>

    {/* Filter status indicator badge if filtered by enquiry */}
    {enquiryFilter && (
      <div className="flex items-center justify-between rounded-xl border border-cyan-200 bg-cyan-50/70 px-4 py-2.5 text-xs text-cyan-900 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-200">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
          <span>
            Showing quotations for enquiry:{' '}
            <strong>
              {selectedFilterEnquiry?.label || enquiryFilter}
            </strong>
          </span>
        </div>
        <button
          type="button"
          onClick={() => handleEnquiryFilterChange(null)}
          className="font-semibold text-cyan-700 hover:underline dark:text-cyan-300"
        >
          Clear filter
        </button>
      </div>
    )}

    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center text-sm text-gray-500">Loading quotations...</div>
      ) : visibleQuotations.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-sm text-gray-500">
          <FileText className="h-9 w-9 text-gray-300" />
          <p>No quotations found{enquiryFilter ? ' for this enquiry' : ''}.</p>
          {enquiryFilter && (
            <button
              type="button"
              onClick={() => handleEnquiryFilterChange(null)}
              className="mt-1 text-xs font-semibold text-cyan-600 hover:underline"
            >
              Show all quotations
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2 p-0 md:p-3 md:hidden">
            {visibleQuotations.map((quotation, index) => (
              <div key={quotation.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-xs font-bold text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
                  {(currentPage - 1) * itemsPerPage + index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => navigate(`/quotations/${quotation.id}`)} className="block w-full truncate text-left text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {quotation.quotation_code || 'Draft quotation'}
                  </button>
                  <div className="truncate text-xs text-slate-500 dark:text-slate-400">{quotation.tour_name || 'Untitled tour'} · v{quotation.version || 1}</div>
                  {quotation.enquiry_id && (
                    <div className="truncate text-[11px] text-cyan-700 dark:text-cyan-400">
                      Enquiry: {quotation.enquiry_code || quotation.enquiry_id.slice(0, 8)}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`max-w-full truncate rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClasses[quotation.status] || statusClasses.DRAFT}`}>{quotation.status || 'DRAFT'}</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{formatDate(quotation.travel_date)}</span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">{formatAmount(quotation.total_amount)}</span>
                  </div>
                </div>
                <ActionMenu actions={[
                  { label: 'Open quotation', icon: <ArrowRight className="h-4 w-4" />, onClick: () => navigate(`/quotations/${quotation.id}`) },
                  { label: 'Create booking', icon: <Plus className="h-4 w-4" />, onClick: () => navigate('/bookings', { state: { quotation_id: quotation.id, enquiry_id: quotation.enquiry_id, customer_id: quotation.customer_id } }) },
                  { label: 'Delete quotation', icon: <Trash2 className="h-4 w-4" />, onClick: () => { setDeleteTarget(quotation); setIsDeleteOpen(true); }, className: 'text-rose-600 dark:text-rose-400' }
                ]} />
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <ManagementTable><table className="w-full table-fixed text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                <tr>
                  <th className="w-[30%] px-4 py-3">Quotation</th>
                  <th className="w-[25%] px-4 py-3">Travel dates</th>
                  <th className="w-[16%] px-4 py-3">Total</th>
                  <th className="w-[16%] px-4 py-3">Status</th>
                  <th className="w-[13%] px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {visibleQuotations.map((quotation) => (
                  <tr key={quotation.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    <td className="break-words px-4 py-4">
                      <button type="button" onClick={() => navigate(`/quotations/${quotation.id}`)} className="text-left">
                        <div className="break-words font-semibold text-slate-900 hover:text-cyan-700 dark:text-slate-100 dark:hover:text-cyan-300">{quotation.quotation_code || 'Draft quotation'}</div>
                        <div className="mt-1 break-words text-xs text-slate-500">{quotation.tour_name || 'Untitled tour'} · v{quotation.version || 1}</div>
                        {quotation.enquiry_id && (
                          <div className="mt-1 text-[11px] text-cyan-700 dark:text-cyan-400">
                            Enquiry: {quotation.enquiry_code || quotation.enquiry_id.slice(0, 8)}
                          </div>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2 text-slate-700 dark:text-slate-200">
                        <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
                        {formatDate(quotation.travel_date)} <span className="text-slate-400">to</span> {formatDate(quotation.return_date)}
                      </div>
                    </td>
                    <td className="break-words px-4 py-4 font-semibold text-slate-900 dark:text-slate-100">{formatAmount(quotation.total_amount)}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusClasses[quotation.status] || statusClasses.DRAFT}`}>{quotation.status || 'DRAFT'}</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <ActionMenu actions={[
                        { label: 'Open quotation', icon: <ArrowRight className="h-4 w-4" />, onClick: () => navigate(`/quotations/${quotation.id}`) },
                        { label: 'Create booking', icon: <Plus className="h-4 w-4" />, onClick: () => navigate('/bookings', { state: { quotation_id: quotation.id, enquiry_id: quotation.enquiry_id, customer_id: quotation.customer_id } }) },
                        { label: 'Delete quotation', icon: <Trash2 className="h-4 w-4" />, onClick: () => { setDeleteTarget(quotation); setIsDeleteOpen(true); }, className: 'text-rose-600 dark:text-rose-400' }
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></ManagementTable>
          </div>
        </>
      )}
    </div>

    {/* Pagination */}
    {totalItems > 0 && (
      <Pagination
        currentPage={currentPage}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onLimitChange={(limit) => {
          setItemsPerPage(limit);
          setCurrentPage(1);
        }}
      />
    )}

    <Modal
      isOpen={isCreateOpen}
      onClose={closeCreate}
      title="New quotation"
      icon={FileText}
      size="3xl"
      footer={(
        <div className="flex w-full items-center justify-between gap-3">
          <span className="text-xs text-gray-500">Step {createStep} of {quotationSteps.length}</span>
          <div className="flex gap-2">
            {createStep > 1 && <button type="button" onClick={goPreviousStep} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-200"><ArrowLeft className="h-4 w-4" />Back</button>}
            {createStep < quotationSteps.length ? <button type="button" onClick={goNextStep} disabled={!isCreateStepValid(createStep)} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Continue<ArrowRight className="h-4 w-4" /></button> : <button type="submit" form="quotation-create-form" onClick={() => { createSubmitRequestedRef.current = true; }} disabled={saving || !isCreateStepValid(createStep)} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Creating...' : <><Check className="h-4 w-4" />Create quotation</>}</button>}
          </div>
        </div>
      )}
    >
      <div className="mb-5 grid grid-cols-4 gap-2">
        {quotationSteps.map((step) => <button key={step.id} type="button" disabled={step.id > createStep} onClick={() => step.id < createStep && setCreateStep(step.id)} className={`rounded-xl px-2 py-2 text-xs font-semibold ${step.id === createStep ? 'bg-cyan-600 text-white' : step.id < createStep ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300' : 'bg-gray-100 text-gray-400 dark:bg-gray-900'}`}>{step.id < createStep && <Check className="mr-1 inline h-3 w-3" />}{step.label}</button>)}
      </div>
      <form id="quotation-create-form" onSubmit={saveQuotation} onKeyDown={(event) => { if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA' && event.target.type !== 'submit') event.preventDefault(); }} className="space-y-5 p-1">
        {createStep === 1 && <div className="space-y-4"><div><h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Enquiry reference</h3><p className="text-sm text-gray-500">Select the enquiry. Its customer, trip details, date, and message will fill the next fields automatically.</p></div><div><label className={labelClass}>Enquiry <span className="text-rose-500">*</span></label><SelectField options={enquiryOptions} isLoading={referencesLoading} isSearchable value={enquiryOptions.find((option) => option.value === form.enquiry_id) || null} onChange={handleEnquiryChange} isClearable placeholder="Search by enquirer name, phone, email, or enquiry code" menuPlacement="auto" /></div>{selectedEnquiry && <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 dark:border-cyan-900/50 dark:bg-cyan-950/20"><div className="mb-3 flex items-center justify-between"><h4 className="font-semibold text-cyan-900 dark:text-cyan-200">Selected enquiry</h4><span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:bg-gray-800 dark:text-cyan-300">{selectedEnquiry.status || 'NEW'}</span></div><div className="grid gap-3 text-sm sm:grid-cols-2"><div><span className="text-xs text-gray-500">Enquirer</span><p className="font-semibold text-gray-800 dark:text-gray-100">{selectedEnquiry.enquirer_name || 'Not provided'}</p></div><div><span className="text-xs text-gray-500">Contact</span><p className="font-semibold text-gray-800 dark:text-gray-100">{selectedEnquiry.enquirer_phone || 'Not provided'}{selectedEnquiry.enquirer_email ? ` - ${selectedEnquiry.enquirer_email}` : ''}</p></div><div><span className="text-xs text-gray-500">Enquiry type</span><p className="font-semibold text-gray-800 dark:text-gray-100">{selectedEnquiry.enquiry_type || 'Not provided'}</p></div><div><span className="text-xs text-gray-500">Channel</span><p className="font-semibold text-gray-800 dark:text-gray-100">{selectedEnquiry.channel || 'Not provided'}</p></div><div><span className="text-xs text-gray-500">Travel date</span><p className="font-semibold text-gray-800 dark:text-gray-100">{selectedEnquiry.travel_date || 'Flexible'}</p></div><div><span className="text-xs text-gray-500">Travellers</span><p className="font-semibold text-gray-800 dark:text-gray-100">{selectedEnquiry.adult_count || 0} adults, {selectedEnquiry.child_count || 0} children, {selectedEnquiry.senior_count || 0} seniors</p></div><div><span className="text-xs text-gray-500">Budget</span><p className="font-semibold text-gray-800 dark:text-gray-100">{selectedEnquiry.budget_min || selectedEnquiry.budget_max ? `${selectedEnquiry.budget_min || 0} - ${selectedEnquiry.budget_max || 0}` : 'Not provided'}</p></div><div><span className="text-xs text-gray-500">Message</span><p className="truncate font-semibold text-gray-800 dark:text-gray-100" title={selectedEnquiry.message}>{selectedEnquiry.message || 'Not provided'}</p></div></div></div>}</div>}
        {createStep === 2 && <div className="space-y-4"><div><h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Trip details</h3><p className="text-sm text-gray-500">Choose either a destination or a package, like the enquiry form.</p></div><div className="grid gap-3 sm:grid-cols-2"><label className={`cursor-pointer rounded-xl border p-3 text-sm font-semibold ${tripSelectionType === 'DESTINATION' ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 dark:border-gray-700'}`}><input type="radio" name="quotation-trip-type" checked={tripSelectionType === 'DESTINATION'} onChange={() => { setTripSelectionType('DESTINATION'); setForm((current) => ({ ...current, destination_id: current.destination_id, package_id: '', variant_id: '', itinerary: [] })); }} className="mr-2" />By destination</label><label className={`cursor-pointer rounded-xl border p-3 text-sm font-semibold ${tripSelectionType === 'PACKAGE' ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 dark:border-gray-700'}`}><input type="radio" name="quotation-trip-type" checked={tripSelectionType === 'PACKAGE'} onChange={() => { setTripSelectionType('PACKAGE'); setForm((current) => ({ ...current, destination_id: '', variant_id: '', itinerary: [] })); }} className="mr-2" />By package</label></div><div className="grid gap-4 md:grid-cols-2">{renderInput('Tour name *', 'tour_name')}{renderInput('Travel date', 'travel_date', 'datetime-local')}{renderInput('Return date', 'return_date', 'datetime-local')}{renderInput('Valid until', 'valid_until', 'datetime-local')}{tripSelectionType === 'PACKAGE' ? <><div><label className={labelClass}>Package</label><SelectField options={packageOptions} isLoading={referencesLoading} isSearchable value={packageOptions.find((option) => option.value === form.package_id) || null}         onChange={(option) => { setForm((current) => ({ ...current, package_id: option?.value || '', variant_id: '', travel_date: '', return_date: '', inclusion: '', exclusion: '', itinerary: [] })); }} isClearable placeholder="Search package" menuPlacement="auto" /></div><div><label className={labelClass}>Variant</label><SelectField options={variantOptions} isLoading={variantsLoading} isDisabled={!form.package_id} isSearchable value={variantOptions.find((option) => option.value === form.variant_id) || null}         onChange={(option) => {
          const variantId = option?.value || '';
          setForm((current) => ({ ...current, variant_id: variantId, inclusion: '', exclusion: '', itinerary: [] }));
          loadVariantItinerary(variantId);
        }} isClearable placeholder={form.package_id ? 'Search variant' : 'Select package first'} menuPlacement="auto" /></div></> : <div><label className={labelClass}>Destination</label><SelectField options={destinationOptions} isLoading={referencesLoading} isSearchable value={destinationOptions.find((option) => option.value === form.destination_id) || null} onChange={(option) => { setTripSelectionType('DESTINATION'); setForm((current) => ({ ...current, destination_id: option?.value || '', package_id: '', variant_id: '', itinerary: [] })); }} isClearable placeholder="Search destination" menuPlacement="auto" /></div>}</div></div>}
        {createStep === 3 && <div className="space-y-5"><div><h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Quotation components</h3><p className="text-sm text-gray-500">Add line items, accommodation, transport, and the itinerary.</p></div>{renderNestedRows('items', 'Quotation items', emptyLineItem, [['item_type', 'Item type', 'select'], ['name', 'Name'], ['description', 'Description'], ['quantity', 'Quantity', 'number'], ['unit_price', 'Unit price', 'number'], ['total_price', 'Total price', 'calculated']])}{renderHotelRows()}{renderVehicleRows()}{renderItineraryRows()}</div>}
        {createStep === 4 && <div className="space-y-4"><div><h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Pricing and notes</h3><p className="text-sm text-gray-500">Set the quotation totals and customer-facing content.</p></div><div className="grid gap-4 md:grid-cols-4">{renderInput('Subtotal', 'subtotal', 'number')}{renderInput('Discount', 'discount_amount', 'number')}{renderInput('Tax', 'tax_amount', 'number')}{renderInput('Total amount', 'total_amount', 'number')}</div><div className="grid gap-4 md:grid-cols-2">{['terms_and_conditions', 'important_notes', 'inclusion', 'exclusion'].map((field) => <div key={field}><label className={labelClass}>{field.replaceAll('_', ' ')}</label><textarea value={form[field]} onChange={(event) => updateForm(field, event.target.value)} className={`${inputClass} min-h-[100px]`} /></div>)}</div></div>}
      </form>
    </Modal>
    <ConfirmDeleteModal isOpen={isDeleteOpen} onClose={() => { if (!deleting) { setIsDeleteOpen(false); setDeleteTarget(null); } }} onConfirm={confirmDelete} confirming={deleting} itemLabel={deleteTarget?.quotation_code || 'this quotation'} title="Delete quotation" message="This quotation and its itinerary details will be permanently removed." />
  </div>;
};

export default QuotationManagement;
