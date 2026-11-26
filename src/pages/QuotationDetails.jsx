import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Check,
  Download,
  Edit3,
  FileText,
  Mail,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react';
import Modal from '../component/common/Modal';
import ManagementWizardPage from '../component/common/ManagementWizardPage';
import ConfirmDeleteModal from '../component/common/ConfirmDeleteModal';
import ActionMenu from '../component/common/ActionMenu';
import CustomDatePicker from '../component/common/CustomDatePicker';
import SelectField from '../component/common/SelectField';
import { apiCall, handleApiError } from '../utils/apiCall';
import { downloadPdfResponse } from '../utils/downloadPdf';
import { useEnums } from '../context/EnumsContext';

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10 read-only:cursor-not-allowed dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-200 dark:focus:bg-gray-800';
const pricingFields = ['subtotal', 'discount_amount', 'tax_amount', 'total_amount'];
const noteFields = ['terms_and_conditions', 'important_notes', 'inclusion', 'exclusion'];
const versionSteps = ['Trip details', 'Components', 'Pricing & notes'];
const dateFields = new Set(['travel_date', 'return_date', 'valid_until']);
const nestedDateFields = new Set(['check_in', 'check_out', 'start_date', 'end_date', 'date']);
const numericFields = new Set(['subtotal', 'discount_amount', 'tax_amount', 'total_amount', 'quantity', 'unit_price', 'total_price', 'nights', 'room_count', 'rental_minutes', 'day_number', 'sort_order']);

const formatDate = (value) => {
  if (!value) return 'N/A';
  try { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return value; }
};
const formatAmount = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const DetailTile = ({ label, value }) => (
  <div className="min-w-0 rounded-xl bg-slate-50 p-3 dark:bg-gray-900/50">
    <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">{label}</dt>
    <dd className="mt-1 break-words text-sm font-medium text-slate-800 dark:text-gray-200">
      {value === undefined || value === null || value === '' ? 'Not provided' : value}
    </dd>
  </div>
);
const toLocalDateTime = (value) => value ? new Date(value).toISOString().slice(0, 16) : '';
const toIso = (value) => value ? new Date(value).toISOString() : '';
const prettyLabel = (value) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const numericValue = (value) => value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

const normalizeQuotation = (quotation) => ({
  ...quotation,
  customer_id: quotation?.customer_id || quotation?.customer?.id || '',
  travel_date: toLocalDateTime(quotation?.travel_date),
  return_date: toLocalDateTime(quotation?.return_date),
  valid_until: toLocalDateTime(quotation?.valid_until),
  subtotal: quotation?.subtotal ?? '0',
  discount_amount: quotation?.discount_amount ?? '0',
  tax_amount: quotation?.tax_amount ?? '0',
  total_amount: quotation?.total_amount ?? '0',
  items: Array.isArray(quotation?.items) ? quotation.items.map((item) => ({ ...item })) : [],
  hotels: Array.isArray(quotation?.hotels) ? quotation.hotels.map((hotel) => ({ ...hotel })) : [],
  vehicles: Array.isArray(quotation?.vehicles) ? quotation.vehicles.map((vehicle) => ({ ...vehicle })) : [],
  itinerary: Array.isArray(quotation?.itinerary) ? quotation.itinerary.map((day) => ({ ...day, date: day.date ? day.date.slice(0, 10) : '' })) : [],
});

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
const getPreferredDeparture = (detail, preferredDate) => {
  const dates = [detail?.departure_dates, detail?.departures, detail?.dates]
    .flatMap((source) => Array.isArray(source) ? source : Array.isArray(source?.items) ? source.items : []);
  const getDate = (departure) => String(departure.departure_date || departure.date || departure.start_date || departure.travel_date || '').slice(0, 10);
  const preferred = dates.find((departure) => preferredDate && getDate(departure) === preferredDate.slice(0, 10));
  if (preferred) return preferred;
  const upcoming = dates.filter((departure) => getDate(departure)).sort((left, right) => getDate(left).localeCompare(getDate(right)));
  const today = new Date().toISOString().slice(0, 10);
  return upcoming.find((departure) => getDate(departure) >= today && Number(departure.available_seats ?? 1) > 0)
    || upcoming.find((departure) => getDate(departure) >= today)
    || upcoming.find((departure) => Number(departure.available_seats ?? 1) > 0)
    || upcoming[0]
    || null;
};

const getQuotationSummaryFields = (quotation) => [
  {
    field: 'customer',
    label: 'Customer',
    value: quotation?.customer?.name
      ? `${quotation.customer.name}${quotation.customer.mobile ? ` · ${quotation.customer.mobile}` : ''}${quotation.customer.email ? ` · ${quotation.customer.email}` : ''}`
      : 'Not provided',
  },
  { field: 'enquiry_code', label: 'Enquiry', value: quotation?.enquiry_code || (quotation?.enquiry_id ? 'Linked enquiry' : 'Not linked') },
  {
    field: 'package',
    label: 'Package',
    value: quotation?.package?.name || quotation?.package?.title || quotation?.tour_name || 'Not provided',
  },
  {
    field: 'variant',
    label: 'Variant',
    value: quotation?.variant?.name || quotation?.variant?.title || 'Not provided',
  },
  {
    field: 'destination',
    label: 'Destination',
    value: quotation?.destination?.name || quotation?.destination?.title || 'Not provided',
  },
  { field: 'inclusion', label: 'Inclusion', value: quotation?.inclusion },
  { field: 'exclusion', label: 'Exclusion', value: quotation?.exclusion },
  { field: 'important_notes', label: 'Important notes', value: quotation?.important_notes },
  { field: 'terms_and_conditions', label: 'Terms and conditions', value: quotation?.terms_and_conditions },
];

const QuotationDetails = () => {
  const navigate = useNavigate();
  const { quotationId } = useParams();
  const { getEnumOptions } = useEnums();
  const quotationItemTypeOptions = getEnumOptions('CostItemType');
  const roomTypeOptions = getEnumOptions('RoomType');
  const vehicleTypeOptions = getEnumOptions('VehicleType');
  const [quotation, setQuotation] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const originalEditFormRef = useRef(null);
  const [versionStep, setVersionStep] = useState(0);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [packageOptions, setPackageOptions] = useState([]);
  const [variantOptions, setVariantOptions] = useState([]);
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [hotelOptions, setHotelOptions] = useState([]);
  const [vehicleOptions, setVehicleOptions] = useState([]);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [itineraryLoading, setItineraryLoading] = useState(false);
  const editFormRef = useRef(editForm);
  editFormRef.current = editForm;
  const [tripSelectionType, setTripSelectionType] = useState('DESTINATION');
  const explicitSubmitRef = useRef(false);
  const hasEditChanges = useMemo(() => (
    Boolean(editForm && originalEditFormRef.current)
    && JSON.stringify(editForm) !== JSON.stringify(originalEditFormRef.current)
  ), [editForm]);

  const loadQuotation = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiCall(`/api/v1/admin/quotations/${quotationId}`, 'GET');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || payload?.detail || 'Unable to fetch quotation');
      setQuotation(payload?.data || null);
    } catch (error) { handleApiError(error, 'Unable to load quotation'); } finally { setLoading(false); }
  }, [quotationId]);

  useEffect(() => { loadQuotation(); }, [loadQuotation]);

  useEffect(() => { setActiveTab('overview'); }, [quotationId]);

  useEffect(() => {
    if (!quotation) return undefined;
    if (!isEditOpen) return undefined;
    const submitButton = document.querySelector('button[type="submit"][form="quotation-edit-form"]');
    if (submitButton) {
      submitButton.disabled = !hasEditChanges;
      submitButton.title = hasEditChanges ? (isCreatingVersion ? 'Create version' : 'Save changes') : 'Change a field before saving';
      submitButton.classList.toggle('quotation-action-disabled', !hasEditChanges);
    }
    return undefined;
  }, [quotation, isEditOpen, isCreatingVersion, hasEditChanges]);

  useEffect(() => {
    if (!isEditOpen) return undefined;
    const preventImplicitSubmit = (event) => {
      const tagName = event.target?.tagName;
      if (event.key === 'Enter' && tagName !== 'TEXTAREA' && tagName !== 'BUTTON') {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('keydown', preventImplicitSubmit, true);
    return () => document.removeEventListener('keydown', preventImplicitSubmit, true);
  }, [isEditOpen]);

  useEffect(() => {
    if (!isEditOpen) return undefined;
    const captureExplicitSubmit = (event) => {
      const button = event.target?.closest?.('button[type="submit"]');
      if (button?.form?.id === 'quotation-edit-form') explicitSubmitRef.current = true;
    };
    document.addEventListener('click', captureExplicitSubmit, true);
    return () => document.removeEventListener('click', captureExplicitSubmit, true);
  }, [isEditOpen]);

  useEffect(() => {
    document.body.dataset.page = 'quotation-details';
    return () => { delete document.body.dataset.page; };
  }, []);

  const loadReferenceOptions = useCallback(async () => {
    setReferencesLoading(true);
    try {
      const responses = await Promise.all([
        apiCall('/api/v1/admin/tour-packages?page=1&page_size=100', 'GET'),
        apiCall('/api/v1/admin/destinations?page=1&page_size=100', 'GET'),
        apiCall('/api/v1/admin/hotels?page=1&page_size=100', 'GET'),
        apiCall('/api/v1/admin/vehicles?page=1&page_size=100', 'GET'),
      ]);
      const payloads = await Promise.all(responses.map((response) => response.json().catch(() => ({}))));
      const [packagesPayload, destinationsPayload, hotelsPayload, vehiclesPayload] = payloads;
      if (responses[0].ok) setPackageOptions((packagesPayload?.data || []).map((item) => ({ value: item.id, label: `${item.name || item.title || 'Unnamed package'}${item.code ? ` - ${item.code}` : ''}` })));
      if (responses[1].ok) setDestinationOptions((destinationsPayload?.data || []).map((item) => ({ value: item.id, label: item.name || item.title || 'Unnamed destination' })));
      if (responses[2].ok) setHotelOptions((hotelsPayload?.data || []).map((item) => ({ value: item.id, label: `${item.name || 'Unnamed hotel'}${item.category ? ` - ${item.category}` : ''}`, raw: item })));
      if (responses[3].ok) setVehicleOptions((vehiclesPayload?.data || []).map((item) => ({ value: item.id, label: `${item.name || 'Unnamed vehicle'}${item.vehicle_type ? ` - ${item.vehicle_type}` : ''}`, raw: item })));
    } catch (error) {
      handleApiError(error, 'Unable to load quotation options');
    } finally { setReferencesLoading(false); }
  }, []);

  useEffect(() => { loadReferenceOptions(); }, [loadReferenceOptions]);

  const loadVariants = useCallback(async (packageId) => {
    if (!packageId) { setVariantOptions([]); return; }
    setVariantsLoading(true);
    try {
      const response = await apiCall(`/api/v1/admin/tour-packages/${encodeURIComponent(packageId)}/variants?page=1&page_size=100`, 'GET');
      const payload = await response.json().catch(() => ({}));
      setVariantOptions(response.ok ? (payload?.data || []).map((item) => ({ value: item.id, label: `${item.name || 'Unnamed variant'}${item.season_name ? ` - ${item.season_name}` : ''}`, raw: item })) : []);
    } catch { setVariantOptions([]); } finally { setVariantsLoading(false); }
  }, []);

  useEffect(() => {
    if (isEditOpen && editForm?.package_id) loadVariants(editForm.package_id);
  }, [isEditOpen, editForm?.package_id, loadVariants]);

  const loadVariantItinerary = useCallback(async (variantId, packageId = editFormRef.current?.package_id, preferredDate = '') => {
    if (!packageId || !variantId) {
      setEditForm((current) => ({ ...current, itinerary: [], travel_date: '', return_date: '' }));
      return;
    }
    setItineraryLoading(true);
    try {
      const response = await apiCall(`/api/v1/admin/tour-packages/${encodeURIComponent(packageId)}/variants/${encodeURIComponent(variantId)}`, 'GET');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) throw new Error(payload?.message || payload?.detail || 'Unable to load selected variant details.');
      const detail = getVariantDetail(payload);
      const departure = getPreferredDeparture(detail, preferredDate || editFormRef.current?.travel_date || '');
      const travelDate = departure?.departure_date || departure?.date || departure?.start_date || departure?.travel_date || detail.valid_from;
      const returnDate = departure?.return_date || departure?.end_date || departure?.to_date || detail.valid_to;
      const itinerary = Array.isArray(detail.itinerary) ? detail.itinerary : [];
      const inclusion = getVariantQuotationText(detail, 'inclusion');
      const exclusion = getVariantQuotationText(detail, 'exclusion');
      setEditForm((current) => ({
        ...current,
        travel_date: travelDate ? toLocalDateTime(travelDate) : '',
        return_date: returnDate ? toLocalDateTime(returnDate) : '',
        ...(inclusion !== undefined ? { inclusion } : {}),
        ...(exclusion !== undefined ? { exclusion } : {}),
        itinerary: itinerary.map((day, index) => ({ ...day, day_number: Number(day.day_number ?? day.day) || index + 1, date: day.date ? day.date.slice(0, 10) : '', sort_order: Number(day.sort_order) || index })),
      }));
    } catch (error) { handleApiError(error, 'Unable to load the selected package variant details'); } finally { setItineraryLoading(false); }
  }, []);

  useEffect(() => {
    if (isEditOpen && editForm?.package_id && editForm?.variant_id && !(editForm.itinerary || []).length) {
      loadVariantItinerary(editForm.variant_id, editForm.package_id);
    }
  }, [isEditOpen, editForm?.package_id, editForm?.variant_id, editForm?.itinerary, loadVariantItinerary]);

  useEffect(() => {
    if (isEditOpen && tripSelectionType === 'PACKAGE' && !editForm?.variant_id && (editForm?.travel_date || editForm?.return_date)) {
      setEditForm((current) => ({ ...current, travel_date: '', return_date: '' }));
    }
  }, [isEditOpen, tripSelectionType, editForm?.package_id, editForm?.variant_id, editForm?.travel_date, editForm?.return_date]);

  const openEdit = () => {
    if (String(quotation.status || '').trim().toUpperCase() !== 'DRAFT') return;
    const next = normalizeQuotation(quotation);
    setEditForm(next);
    originalEditFormRef.current = JSON.parse(JSON.stringify(next));
    explicitSubmitRef.current = false;
    setIsCreatingVersion(false);
    setTripSelectionType(next.package_id ? 'PACKAGE' : 'DESTINATION');
    setVersionStep(0);
    setIsEditOpen(true);
  };
  const createVersion = () => {
    if (String(quotation.status || '').trim().toUpperCase() !== 'REJECTED') return;
    const next = normalizeQuotation(quotation);
    setEditForm(next);
    originalEditFormRef.current = JSON.parse(JSON.stringify(next));
    explicitSubmitRef.current = false;
    setIsCreatingVersion(true);
    setTripSelectionType(next.package_id ? 'PACKAGE' : 'DESTINATION');
    setVersionStep(0);
    setIsEditOpen(true);
  };
  const updateEdit = (field, value) => setEditForm((current) => ({ ...current, [field]: value }));
  const updateNested = (field, index, key, value) => setEditForm((current) => {
    const nextItems = current[field].map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const nextItem = { ...item, [key]: value };
      if (key === 'quantity' || key === 'unit_price') nextItem.total_price = (Number(nextItem.quantity || 0) * Number(nextItem.unit_price || 0)).toFixed(2);
      return nextItem;
    });
    return { ...current, [field]: nextItems };
  });
  const addNested = (field) => {
    const templates = {
      items: { item_type: 'other', name: '', description: '', quantity: 1, unit_price: '0', total_price: '0' },
      hotels: { hotel_id: '', hotel_name: '', check_in: '', check_out: '', nights: 1, room_count: 1, room_type: 'SINGLE' },
      vehicles: { vehicle_id: '', vehicle_name: '', vehicle_type: 'ANY', start_date: '', end_date: '', rental_minutes: 1, quantity: 1 },
      itinerary: { day_number: (editForm?.itinerary || []).length + 1, date: '', title: '', description: '', overnight_location: '', meal_plan: '', sort_order: (editForm?.itinerary || []).length },
    };
    setEditForm((current) => ({ ...current, [field]: [...current[field], { ...(templates[field] || {}) }] }));
  };
  const removeNested = (field, index) => setEditForm((current) => {
    const nextItems = current[field].filter((_, itemIndex) => itemIndex !== index);
    return { ...current, [field]: nextItems };
  });
  const updatePricing = (field, value) => setEditForm((current) => ({ ...current, [field]: value }));

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!explicitSubmitRef.current || !hasEditChanges) return;
    explicitSubmitRef.current = false;
    const invalidItem = (editForm.items || []).find((item) => !String(item.name || '').trim() || Number(item.quantity) < 1 || Number(item.unit_price) < 0);
    const invalidHotel = (editForm.hotels || []).find((hotel) => !String(hotel.hotel_name || '').trim() || !hotel.check_in || !hotel.check_out || Number(hotel.nights) < 1 || Number(hotel.room_count) < 1);
    const invalidVehicle = (editForm.vehicles || []).find((vehicle) => !String(vehicle.vehicle_name || '').trim() || !vehicle.start_date || !vehicle.end_date || Number(vehicle.rental_minutes) < 1 || Number(vehicle.quantity) < 1);
    const invalidDay = (editForm.itinerary || []).find((day) => !String(day.title || '').trim() || Number(day.day_number) < 1);
    if (invalidItem || invalidHotel || invalidVehicle || invalidDay) {
      toast.error('Complete or remove every component row before saving.');
      return;
    }
    const hotelItemCount = (editForm.items || []).filter((item) => item.item_type === 'hotel').length;
    const vehicleItemCount = (editForm.items || []).filter((item) => ['transport', 'transfer'].includes(item.item_type)).length;
    if ((editForm.hotels || []).length > hotelItemCount || (editForm.vehicles || []).length > vehicleItemCount) {
      toast.error('Add a hotel line item for each hotel, and a transport or transfer line item for each vehicle.');
      setVersionStep(1);
      return;
    }
    setSaving(true);
    try {
      const payload = {};
      ['customer_id', 'package_id', 'variant_id', 'destination_id', 'tour_name', 'travel_date', 'return_date', 'subtotal', 'discount_amount', 'tax_amount', 'total_amount', 'valid_until', 'terms_and_conditions', 'important_notes', 'inclusion', 'exclusion'].forEach((field) => {
        payload[field] = dateFields.has(field) ? toIso(editForm[field]) : editForm[field];
      });
      payload.items = editForm.items || [];
      payload.hotels = (editForm.hotels || []).map((hotel) => ({
        ...hotel,
        check_in: toIso(hotel.check_in),
        check_out: toIso(hotel.check_out),
      }));
      payload.vehicles = (editForm.vehicles || []).map((vehicle) => ({
        ...vehicle,
        start_date: toIso(vehicle.start_date),
        end_date: toIso(vehicle.end_date),
      }));
      payload.itinerary = (editForm.itinerary || []).map((day) => ({
        ...day,
        date: day.date ? toIso(day.date) : null,
      }));
      const endpoint = isCreatingVersion
        ? `/api/v1/admin/quotations/${quotationId}/versions`
        : `/api/v1/admin/quotations/${quotationId}`;
      const method = isCreatingVersion ? 'POST' : 'PATCH';
      const response = await apiCall(endpoint, method, payload);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || result?.detail || (isCreatingVersion ? 'Unable to create quotation version' : 'Unable to update quotation'));
      toast.success(result?.message || (isCreatingVersion ? 'Quotation version created successfully' : 'Quotation updated successfully'));
      setIsEditOpen(false);
      if (isCreatingVersion && result?.data?.id) navigate(`/quotations/${result.data.id}`); else await loadQuotation();
    } catch (error) { handleApiError(error, isCreatingVersion ? 'Unable to create quotation version' : 'Unable to update quotation'); } finally { setSaving(false); }
  };

  const deleteQuotation = async () => {
    setDeleting(true);
    try {
      const response = await apiCall(`/api/v1/admin/quotations/${quotationId}`, 'DELETE');
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || result?.detail || 'Unable to delete quotation');
      toast.success(result?.message || 'Quotation deleted successfully');
      navigate('/quotations');
    } catch (error) { handleApiError(error, 'Unable to delete quotation'); } finally { setDeleting(false); }
  };

  const downloadPdf = async () => {
    const downloadToastId = toast.loading('Generating quotation PDF...');
    try {
      const response = await apiCall(`/api/v1/admin/quotations/${quotationId}/pdf`, 'GET');
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result?.message || result?.detail || 'Unable to generate quotation PDF');
      }
      await downloadPdfResponse(response, `${quotation.quotation_code || 'quotation'}.pdf`);
      toast.success('Quotation PDF downloaded', { id: downloadToastId });
    } catch (error) {
      toast.error(error?.message || 'Unable to generate quotation PDF', { id: downloadToastId });
    }
  };

  const convertToBooking = async () => {
    setConverting(true);
    try {
      const response = await apiCall(`/api/v1/admin/quotations/${quotationId}/convert`, 'POST', {});
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || result?.detail || 'Unable to convert quotation to booking');
      const bookingId = result?.data?.id;
      if (!bookingId) throw new Error('The server did not return the created booking');
      toast.success(result?.message || 'Quotation converted to booking');
      navigate(`/bookings/${bookingId}`);
    } catch (error) {
      handleApiError(error, 'Unable to convert quotation to booking');
    } finally {
      setConverting(false);
    }
  };

  const sendQuotation = async (event) => {
    event.preventDefault();
    if (!recipientEmail.trim()) { toast.error('Recipient email is required'); return; }
    try {
      const response = await apiCall(`/api/v1/admin/quotations/${quotationId}/send`, 'POST', { recipient_email: recipientEmail.trim() });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || result?.detail || 'Unable to send quotation');
      toast.success(result?.message || 'Quotation sent successfully'); setIsSendOpen(false); setRecipientEmail(''); await loadQuotation();
    } catch (error) { handleApiError(error, 'Unable to send quotation'); }
  };

  const openSendModal = () => {
    setRecipientEmail(quotation?.customer?.email || '');
    setIsSendOpen(true);
  };

  const renderNestedEditor = (field, label) => <section className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-gray-700"><div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900 dark:text-slate-100">{label}</h3><button type="button" onClick={() => addNested(field)} className="text-sm font-semibold text-cyan-700">Add row</button></div>{(editForm[field] || []).map((item, index) => <div key={`${field}-${index}`} className="grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-2 dark:bg-gray-900/50">{Object.keys(item).filter((key) => !['id', 'quotation_id', 'trip_item_id', 'created_at', 'updated_at'].includes(key)).map((key) => <div key={key}><label className="mb-1 block text-xs font-medium capitalize text-gray-600 dark:text-gray-300">{prettyLabel(key)}</label>{key === 'item_type' ? <SelectField options={quotationItemTypeOptions} value={quotationItemTypeOptions.find((option) => option.value === item[key]) || null} onChange={(option) => updateNested(field, index, key, option?.value || 'other')} isSearchable={false} menuPlacement="auto" /> : nestedDateFields.has(key) ? <CustomDatePicker value={item[key] ?? ''} includeTime={key !== 'date'} onChange={(value) => updateNested(field, index, key, value)} /> : <input type="text" inputMode={numericFields.has(key) ? 'decimal' : undefined} readOnly={field === 'items' && key === 'total_price'} value={item[key] ?? ''} onChange={(event) => updateNested(field, index, key, numericFields.has(key) ? numericValue(event.target.value) : event.target.value)} className={`${inputClass} ${field === 'items' && key === 'total_price' ? 'bg-slate-100 font-semibold dark:bg-gray-800' : ''}`} />}</div>)}<button type="button" onClick={() => removeNested(field, index)} className="justify-self-start text-sm text-rose-600">Remove</button></div>)}</section>;

  const renderReferenceNestedEditor = (field, label) => {
    const isHotel = field === 'hotels';
    const options = isHotel ? hotelOptions : vehicleOptions;
    const idKey = isHotel ? 'hotel_id' : 'vehicle_id';
    const nameKey = isHotel ? 'hotel_name' : 'vehicle_name';
    const dateKeys = isHotel ? ['check_in', 'check_out'] : ['start_date', 'end_date'];
    return <section className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-gray-700"><div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900 dark:text-slate-100">{label}</h3><button type="button" onClick={() => addNested(field)} className="text-sm font-semibold text-cyan-700">Add row</button></div>{(editForm[field] || []).map((item, index) => <div key={`${field}-${index}`} className="grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-2 dark:bg-gray-900/50"><div><label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">{isHotel ? 'Hotel reference' : 'Vehicle reference'}</label><SelectField options={options} isLoading={referencesLoading} isSearchable value={options.find((option) => option.value === item[idKey]) || null} onChange={(option) => { updateNested(field, index, idKey, option?.value || ''); updateNested(field, index, nameKey, option?.raw?.name || option?.label?.split(' - ')[0] || ''); }} placeholder={`Select ${isHotel ? 'hotel' : 'vehicle'} or enter a name below`} isClearable menuPlacement="auto" /></div><div><label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">{isHotel ? 'Hotel name' : 'Vehicle name'} <span className="text-rose-500">*</span></label><input type="text" value={item[nameKey] || ''} onChange={(event) => updateNested(field, index, nameKey, event.target.value)} className={inputClass} /></div>{!isHotel && <div><label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Vehicle type</label><SelectField options={vehicleTypeOptions} value={vehicleTypeOptions.find((option) => option.value === item.vehicle_type) || null} onChange={(option) => updateNested(field, index, 'vehicle_type', option?.value || '')} isSearchable={false} menuPlacement="auto" /></div>}{dateKeys.map((key) => <div key={key}><label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">{prettyLabel(key)}</label><CustomDatePicker value={item[key] || ''} includeTime onChange={(value) => updateNested(field, index, key, value)} /></div>)}{(isHotel ? [['nights', 'Nights'], ['room_count', 'Rooms'], ['room_type', 'Room type']] : [['rental_minutes', 'Rental minutes'], ['quantity', 'Quantity']]).map(([key, fieldLabel]) => <div key={key}><label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">{fieldLabel}</label>{key === 'room_type' ? <SelectField options={roomTypeOptions} value={roomTypeOptions.find((option) => option.value === item[key]) || null} onChange={(option) => updateNested(field, index, key, option?.value || '')} isSearchable={false} menuPlacement="auto" /> : <input type="text" inputMode={numericFields.has(key) ? 'decimal' : undefined} value={item[key] ?? ''} onChange={(event) => updateNested(field, index, key, numericFields.has(key) ? numericValue(event.target.value) : event.target.value)} className={inputClass} />}</div>)}<button type="button" onClick={() => removeNested(field, index)} className="justify-self-start text-sm text-rose-600">Remove</button></div>)}</section>;
  };

  const renderReferenceStep = () => <div className="space-y-5"><div className="grid gap-5 md:grid-cols-2"><div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">Customer</label><input value={editForm.customer?.name || editForm.customer_name || 'Unknown customer'} readOnly className={`${inputClass} cursor-not-allowed bg-slate-100 dark:bg-gray-800`} /></div>{renderVersionField('enquiry_id')}{renderVersionField('tour_name')}{renderVersionField('travel_date')}{renderVersionField('return_date')}{renderVersionField('valid_until')}</div><div className="grid gap-3 sm:grid-cols-2"><label className={`cursor-pointer rounded-xl border p-3 text-sm font-semibold ${tripSelectionType === 'DESTINATION' ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 dark:border-gray-700'}`}><input type="radio" name="version-trip-type" checked={tripSelectionType === 'DESTINATION'} onChange={() => { setTripSelectionType('DESTINATION'); setEditForm((current) => ({ ...current, destination_id: current.destination_id, package_id: '', variant_id: '', itinerary: [] })); }} className="mr-2" />By destination</label><label className={`cursor-pointer rounded-xl border p-3 text-sm font-semibold ${tripSelectionType === 'PACKAGE' ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 dark:border-gray-700'}`}><input type="radio" name="version-trip-type" checked={tripSelectionType === 'PACKAGE'} onChange={() => { setTripSelectionType('PACKAGE'); setEditForm((current) => ({ ...current, destination_id: '', variant_id: '', itinerary: [] })); }} className="mr-2" />By package</label></div><div className="grid gap-5 md:grid-cols-2">{tripSelectionType === 'PACKAGE' ? <><div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Package</label><SelectField options={packageOptions} isLoading={referencesLoading} isSearchable value={packageOptions.find((option) => option.value === editForm.package_id) || null} onChange={(option) => setEditForm((current) => ({ ...current, package_id: option?.value || '', variant_id: '', itinerary: [] }))} isClearable placeholder="Search package" /></div><div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Variant</label><SelectField options={variantOptions} isLoading={variantsLoading} isDisabled={!editForm.package_id} isSearchable value={variantOptions.find((option) => option.value === editForm.variant_id) || null} onChange={(option) => { updateEdit('variant_id', option?.value || ''); loadVariantItinerary(option?.value || ''); }} isClearable placeholder="Search variant" /></div></> : <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Destination</label><SelectField options={destinationOptions} isLoading={referencesLoading} isSearchable value={destinationOptions.find((option) => option.value === editForm.destination_id) || null} onChange={(option) => setEditForm((current) => ({ ...current, destination_id: option?.value || '', package_id: '', variant_id: '', itinerary: [] }))} isClearable placeholder="Search destination" /></div>}</div></div>;

  const renderVersionField = (field) => {
    if (field === 'enquiry_id') {
      return (
        <div key={field}>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">Enquiry</label>
          <p className={`${inputClass} text-gray-500`}>
            {editForm.enquiry_code || (editForm.enquiry_id ? 'Linked enquiry' : 'Not linked')}
          </p>
        </div>
      );
    }

    const variantDateLocked = tripSelectionType === 'PACKAGE' && Boolean(editForm.variant_id) && ['travel_date', 'return_date'].includes(field);
    return <div key={field}><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">{prettyLabel(field)}</label>{variantDateLocked ? <input type="text" readOnly value={editForm[field] ? formatDate(editForm[field]) : 'No date configured for this variant'} className={`${inputClass} cursor-not-allowed opacity-70`} /> : dateFields.has(field) ? <CustomDatePicker value={editForm[field] ?? ''} onChange={(value) => updateEdit(field, value)} /> : <input type="text" inputMode={numericFields.has(field) ? 'decimal' : undefined} value={editForm[field] ?? ''} onChange={(event) => updateEdit(field, numericFields.has(field) ? numericValue(event.target.value) : event.target.value)} className={inputClass} />}</div>;
  };

  const renderVersionStep = () => {
    if (versionStep === 0) return renderReferenceStep();
    if (versionStep === 1) return <div className="space-y-5">{renderNestedEditor('items', 'Quotation items')}{renderReferenceNestedEditor('hotels', 'Hotels')}{renderReferenceNestedEditor('vehicles', 'Vehicles')}{renderNestedEditor('itinerary', 'Itinerary')}{itineraryLoading && <p className="text-xs text-gray-500">Loading package itinerary...</p>}</div>;
    return <div className="space-y-6"><div className="grid gap-5 md:grid-cols-2">{pricingFields.map((field) => <div key={field}><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">{prettyLabel(field)}</label><input type="text" inputMode="decimal" value={editForm[field] ?? '0'} onChange={(event) => updatePricing(field, numericValue(event.target.value))} className={inputClass} /></div>)}</div><div className="grid gap-5 md:grid-cols-2">{noteFields.map((field) => <div key={field}><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">{prettyLabel(field)}</label><textarea value={editForm[field] ?? ''} onChange={(event) => updateEdit(field, event.target.value)} className={`${inputClass} min-h-[120px]`} /></div>)}</div></div>;
  };

  if (loading && !quotation) return <div className="flex min-h-[360px] items-center justify-center text-sm text-gray-500">Loading quotation...</div>;
  if (!quotation) return <div className="p-8 text-center"><p className="text-gray-500">Quotation not found.</p><button type="button" onClick={() => navigate('/quotations')} className="mt-4 text-sm font-semibold text-cyan-700">Back to quotations</button></div>;
  if (isEditOpen && editForm) {
    return (
      <ManagementWizardPage
        title={isCreatingVersion ? 'Create quotation version' : 'Edit quotation'}
        description={`Update ${quotation.quotation_code || 'this quotation'} in a few guided steps.`}
        icon={FileText}
        closeLabel="Back to quotation"
        onClose={() => !saving && setIsEditOpen(false)}
        footer={(
          <div className="flex w-full items-center justify-between gap-3">
            <span className="text-xs text-gray-500">Step {versionStep + 1} of {versionSteps.length}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                disabled={saving}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              {versionStep > 0 && (
                <button
                  type="button"
                  onClick={() => setVersionStep((current) => Math.max(0, current - 1))}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
                >
                  <ArrowLeft className="h-4 w-4" />Back
                </button>
              )}
              {versionStep < versionSteps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setVersionStep((current) => Math.min(versionSteps.length - 1, current + 1))}
                  disabled={saving}
                  className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-50"
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  form="quotation-edit-form"
                  disabled={saving || !hasEditChanges}
                  className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-50"
                >
                  {saving ? (isCreatingVersion ? 'Creating...' : 'Saving...') : (isCreatingVersion ? 'Create version' : 'Save changes')}
                </button>
              )}
            </div>
          </div>
        )}
      >
        <div className="mx-auto max-w-6xl">
          <nav aria-label="Quotation editing steps" className="mb-6">
            <ol className="grid gap-2 sm:grid-cols-3">
              {versionSteps.map((step, index) => {
                const isCurrent = index === versionStep;
                const isComplete = index < versionStep;
                return (
                  <li key={step}>
                    <button
                      type="button"
                      aria-current={isCurrent ? 'step' : undefined}
                      disabled={index > versionStep}
                      onClick={() => index < versionStep && setVersionStep(index)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                        isCurrent
                          ? 'border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-300'
                          : isComplete
                          ? 'border-emerald-200 text-emerald-700 dark:border-emerald-900/50 dark:text-emerald-300'
                          : 'border-gray-200 text-gray-400 dark:border-gray-700 dark:text-gray-500'
                      }`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isCurrent ? 'bg-cyan-600 text-white' : isComplete ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-gray-100 dark:bg-gray-800'
                      }`}>
                        {isComplete ? <Check className="h-4 w-4" /> : index + 1}
                      </span>
                      <span className="text-sm font-semibold">{step}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
          <form id="quotation-edit-form" onSubmit={saveEdit} className="space-y-6">
            <div className="rounded-2xl border border-slate-100 bg-white/60 p-4 dark:border-gray-700 dark:bg-gray-900/20">
              {renderVersionStep()}
            </div>
          </form>
        </div>
      </ManagementWizardPage>
    );
  }

  const quotationStatus = String(quotation.status || 'DRAFT').toUpperCase();
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'items', label: 'Items', count: quotation.items?.length || 0 },
    { id: 'hotels', label: 'Hotels', count: quotation.hotels?.length || 0 },
    { id: 'vehicles', label: 'Vehicles', count: quotation.vehicles?.length || 0 },
    { id: 'itinerary', label: 'Itinerary', count: quotation.itinerary?.length || 0 },
    { id: 'pricing', label: 'Pricing' },
    { id: 'notes', label: 'Notes' },
  ];
  const actionItems = [
    { label: 'Refresh quotation', icon: <RefreshCw className="h-4 w-4" />, onClick: loadQuotation },
    {
      label: 'Edit quotation',
      icon: <Edit3 className="h-4 w-4" />,
      onClick: openEdit,
      disabled: quotationStatus !== 'DRAFT',
      title: quotationStatus === 'DRAFT' ? 'Edit quotation' : 'Editing is available for drafts',
    },
    {
      label: 'New version',
      icon: <Plus className="h-4 w-4" />,
      onClick: createVersion,
      disabled: quotationStatus !== 'REJECTED',
      title: quotationStatus === 'REJECTED' ? 'Create a new version' : 'A new version is available for rejected quotations',
    },
    { label: 'Download PDF', icon: <Download className="h-4 w-4" />, onClick: downloadPdf },
    ...(quotationStatus === 'ACCEPTED'
      ? [{
        label: converting ? 'Converting to booking...' : 'Convert to booking',
        icon: <Plus className="h-4 w-4" />,
        onClick: convertToBooking,
        disabled: converting,
      }]
      : []),
    {
      label: 'Delete quotation',
      icon: <Trash2 className="h-4 w-4" />,
      onClick: () => setIsDeleteOpen(true),
      className: 'text-rose-600 dark:text-rose-400',
    },
  ];
  const summaryFields = getQuotationSummaryFields(quotation)
    .filter(({ field }) => ['customer', 'enquiry_code', 'package', 'variant', 'destination'].includes(field));
  const handleTabKeyDown = (event, index) => {
    let nextIndex;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    setActiveTab(tabs[nextIndex].id);
    document.getElementById(`quotation-tab-${tabs[nextIndex].id}`)?.focus();
  };

  return (
    <div className="space-y-4 pb-8">
      <header className="flex flex-col gap-3 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/quotations')}
            className="shrink-0 rounded-xl border border-gray-200 bg-white p-2 text-gray-600 transition hover:border-cyan-300 hover:text-cyan-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            title="Back to quotations"
            aria-label="Back to quotations"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold tracking-wide text-cyan-700 dark:text-cyan-300">{quotation.quotation_code || 'Quotation'}</p>
              <span className="rounded-full border border-slate-200 bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300">
                {quotation.status || 'DRAFT'}
              </span>
            </div>
            <h1 className="mt-1 break-words text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
              {quotation.tour_name || 'Untitled tour'}
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
              Version {quotation.version || 1} · Created {formatDate(quotation.created_at)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <button
            type="button"
            onClick={openSendModal}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
          <ActionMenu
            menuId={`quotation-actions-${quotation.id || quotation.quotation_code}`}
            actions={actionItems}
            trigger={(
              <button
                type="button"
                aria-label="More quotation actions"
                title="More actions"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            )}
          />
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <DetailTile label="Total amount" value={formatAmount(quotation.total_amount)} />
        <DetailTile label="Travel dates" value={`${formatDate(quotation.travel_date)} – ${formatDate(quotation.return_date)}`} />
        <DetailTile label="Valid until" value={formatDate(quotation.valid_until)} />
        <DetailTile label="Last updated" value={formatDate(quotation.updated_at)} />
      </dl>

      <div className="space-y-3">
        <div className="overflow-x-auto border-b border-slate-200 dark:border-gray-700">
          <div role="tablist" aria-label="Quotation details sections" className="flex min-w-max gap-1">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                id={`quotation-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`quotation-panel-${tab.id}`}
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={`relative flex min-h-11 items-center gap-2 whitespace-nowrap px-3 text-xs font-semibold transition ${
                  activeTab === tab.id
                    ? 'text-cyan-700 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-cyan-600 dark:text-cyan-300 dark:after:bg-cyan-400'
                    : 'text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activeTab === tab.id ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-200' : 'bg-slate-100 text-slate-500 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div
          id={`quotation-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`quotation-tab-${activeTab}`}
          tabIndex={0}
          className="min-h-64 px-1 py-2 outline-none sm:px-0 sm:py-3"
        >
          {activeTab === 'overview' && (
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Quotation overview</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">Customer and trip information linked to this quotation.</p>
              </div>
              <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {summaryFields.map(({ field, label, value }) => <DetailTile key={field} label={label} value={value} />)}
              </dl>
            </div>
          )}

          {activeTab === 'items' && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Quotation items</h2>
              {quotation.items?.length ? (
                <div className="space-y-2">
                  {quotation.items.map((item, index) => (
                    <article key={item.id || index} className="rounded-xl border border-slate-200 p-3 dark:border-gray-700">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="break-words text-sm font-semibold text-slate-900 dark:text-slate-100">{item.name || 'Quotation item'}</h3>
                          {item.description && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500 dark:text-gray-400">{item.description}</p>}
                        </div>
                        <span className="rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-semibold text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">{prettyLabel(item.item_type || 'other')}</span>
                      </div>
                      <dl className="mt-3 grid grid-cols-3 gap-2">
                        <DetailTile label="Quantity" value={item.quantity ?? 1} />
                        <DetailTile label="Unit price" value={formatAmount(item.unit_price)} />
                        <DetailTile label="Total" value={formatAmount(item.total_price)} />
                      </dl>
                    </article>
                  ))}
                </div>
              ) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-gray-900/50 dark:text-gray-400">No quotation items added.</p>}
            </div>
          )}

          {activeTab === 'hotels' && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Accommodation</h2>
              {quotation.hotels?.length ? (
                <div className="grid gap-2 lg:grid-cols-2">
                  {quotation.hotels.map((hotel, index) => (
                    <article key={hotel.id || index} className="rounded-xl border border-slate-200 p-3 dark:border-gray-700">
                      <h3 className="break-words text-sm font-semibold text-slate-900 dark:text-slate-100">{hotel.hotel_name || 'Hotel stay'}</h3>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">{[hotel.place, hotel.address].filter(Boolean).join(' · ') || 'Location not provided'}</p>
                      <dl className="mt-3 grid grid-cols-2 gap-2">
                        <DetailTile label="Check in" value={formatDate(hotel.check_in)} />
                        <DetailTile label="Check out" value={formatDate(hotel.check_out)} />
                        <DetailTile label="Nights / rooms" value={`${hotel.nights ?? '—'} / ${hotel.room_count ?? '—'}`} />
                        <DetailTile label="Room type" value={hotel.room_type} />
                        <DetailTile label="Paid by traveller" value={hotel.paid_by_traveller === undefined ? undefined : hotel.paid_by_traveller ? 'Yes' : 'No'} />
                        <DetailTile label="Contact" value={[hotel.contact_person, hotel.contact_number].filter(Boolean).join(' · ')} />
                      </dl>
                    </article>
                  ))}
                </div>
              ) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-gray-900/50 dark:text-gray-400">No hotel details added.</p>}
            </div>
          )}

          {activeTab === 'vehicles' && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Transport</h2>
              {quotation.vehicles?.length ? (
                <div className="grid gap-2 lg:grid-cols-2">
                  {quotation.vehicles.map((vehicle, index) => (
                    <article key={vehicle.id || index} className="rounded-xl border border-slate-200 p-3 dark:border-gray-700">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{vehicle.vehicle_name || 'Vehicle booking'}</h3>
                        <span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">{vehicle.vehicle_type || 'Vehicle'}</span>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-2">
                        <DetailTile label="Start" value={formatDate(vehicle.start_date)} />
                        <DetailTile label="End" value={formatDate(vehicle.end_date)} />
                        <DetailTile label="Quantity" value={vehicle.quantity ?? 1} />
                        <DetailTile label="Registration" value={vehicle.registration_number} />
                        <DetailTile label="Pickup" value={vehicle.pickup_location} />
                        <DetailTile label="Drop off" value={vehicle.drop_location} />
                      </dl>
                    </article>
                  ))}
                </div>
              ) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-gray-900/50 dark:text-gray-400">No vehicle details added.</p>}
            </div>
          )}

          {activeTab === 'itinerary' && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Day-by-day itinerary</h2>
              {quotation.itinerary?.length ? (
                <ol className="space-y-2">
                  {quotation.itinerary.map((day, index) => (
                    <li key={day.id || day.day_number || index} className="flex gap-3 rounded-xl border border-slate-200 p-3 dark:border-gray-700">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-xs font-bold text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">{day.day_number || index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-1">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{day.title || 'Untitled day'}</h3>
                          <span className="text-[11px] text-slate-500 dark:text-gray-400">{formatDate(day.date)}</span>
                        </div>
                        {day.description && <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-600 dark:text-gray-300">{day.description}</p>}
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-gray-400">{[day.overnight_location, day.meal_plan].filter(Boolean).join(' · ') || 'No overnight or meal details'}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-gray-900/50 dark:text-gray-400">No itinerary days added.</p>}
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Price breakdown</h2>
              <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <DetailTile label="Subtotal" value={formatAmount(quotation.subtotal)} />
                <DetailTile label="Discount" value={`− ${formatAmount(quotation.discount_amount)}`} />
                <DetailTile label="Tax" value={formatAmount(quotation.tax_amount)} />
                <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 dark:border-cyan-900/50 dark:bg-cyan-950/30">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Total</dt>
                  <dd className="mt-1 text-base font-bold text-cyan-800 dark:text-cyan-200">{formatAmount(quotation.total_amount)}</dd>
                </div>
              </dl>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Notes and conditions</h2>
              <dl className="grid gap-2 md:grid-cols-2">
                {[
                  ['Inclusion', quotation.inclusion],
                  ['Exclusion', quotation.exclusion],
                  ['Important notes', quotation.important_notes],
                  ['Terms and conditions', quotation.terms_and_conditions],
                  ['Rejection reason', quotation.rejected_reason],
                ].map(([label, value]) => (
                  <DetailTile key={label} label={label} value={value} />
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isSendOpen} onClose={() => setIsSendOpen(false)} title="Send quotation" icon={Mail} size="sm" footer={<div className="flex justify-end gap-3"><button type="button" onClick={() => setIsSendOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button type="submit" form="send-quotation-form" className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white">Send quotation</button></div>}><form id="send-quotation-form" onSubmit={sendQuotation} className="space-y-4"><p className="text-sm text-gray-500">The quotation will be sent to the recipient email below.</p><input type="email" required value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} className={inputClass} placeholder="customer@example.com" /></form></Modal>
      <ConfirmDeleteModal isOpen={isDeleteOpen} onClose={() => { if (!deleting) setIsDeleteOpen(false); }} onConfirm={deleteQuotation} confirming={deleting} itemLabel={quotation.quotation_code || 'this quotation'} title="Delete quotation" message="This quotation and its itinerary details will be permanently removed." />
    </div>
  );
};

export default QuotationDetails;
