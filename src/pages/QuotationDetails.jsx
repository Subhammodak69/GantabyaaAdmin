import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Calendar,
  Download,
  Edit3,
  FileText,
  Mail,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react';
import Modal from '../component/common/Modal';
import ConfirmDeleteModal from '../component/common/ConfirmDeleteModal';
import CustomDatePicker from '../component/common/CustomDatePicker';
import SelectField from '../component/common/SelectField';
import { apiCall, handleApiError } from '../utils/apiCall';
import { useEnums } from '../context/EnumsContext';

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-200 dark:focus:bg-gray-800';
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

const QuotationDetails = () => {
  const navigate = useNavigate();
  const { quotationId } = useParams();
  const { getEnumOptions } = useEnums();
  const quotationItemTypeOptions = getEnumOptions('CostItemType');
  const roomTypeOptions = getEnumOptions('RoomType');
  const vehicleTypeOptions = getEnumOptions('VehicleType');
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    if (!quotation) return undefined;
    const status = String(quotation.status || '').trim().toUpperCase();
    const buttons = Array.from(document.querySelectorAll('button'));
    const configureAction = (label, enabled, disabledTitle) => {
      const button = buttons.find((item) => item.textContent.trim() === label);
      if (!button) return;
      button.disabled = !enabled;
      button.title = enabled ? label : disabledTitle;
      button.classList.toggle('quotation-action-disabled', !enabled);
      const marker = button.querySelector('[data-disabled-action-marker]');
      if (enabled) {
        marker?.remove();
        button.style.opacity = '';
        button.style.filter = '';
        button.style.cursor = '';
        return;
      }
      button.style.opacity = '0.45';
      button.style.filter = 'grayscale(0.35)';
      button.style.cursor = 'not-allowed';
      if (!marker) {
        const disabledMarker = document.createElement('span');
        disabledMarker.dataset.disabledActionMarker = 'true';
        disabledMarker.textContent = '⊘';
        button.appendChild(disabledMarker);
      }
    };

    configureAction('Edit', status === 'DRAFT', 'Edit is available only for draft quotations');
    configureAction('New version', status === 'REJECTED', 'New version is available only for rejected quotations');
    if (isEditOpen) {
      const submitButton = document.querySelector('button[type="submit"][form="quotation-edit-form"]');
      if (submitButton) {
        submitButton.disabled = !hasEditChanges;
        submitButton.title = hasEditChanges ? (isCreatingVersion ? 'Create version' : 'Save changes') : 'Change a field before saving';
        submitButton.classList.toggle('quotation-action-disabled', !hasEditChanges);
      }
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
      if (responses[2].ok) setHotelOptions((hotelsPayload?.data || []).map((item) => ({ value: item.id, label: `${item.name || 'Unnamed hotel'}${item.category ? ` - ${item.category}` : ''}` })));
      if (responses[3].ok) setVehicleOptions((vehiclesPayload?.data || []).map((item) => ({ value: item.id, label: `${item.name || 'Unnamed vehicle'}${item.vehicle_type ? ` - ${item.vehicle_type}` : ''}` })));
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
      setVariantOptions(response.ok ? (payload?.data || []).map((item) => ({ value: item.id, label: `${item.name || 'Unnamed variant'}${item.season_name ? ` - ${item.season_name}` : ''}` })) : []);
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
    if (field !== 'items') return { ...current, [field]: nextItems };
    const subtotal = nextItems.reduce((sum, item) => sum + Number(item.total_price || (Number(item.quantity || 0) * Number(item.unit_price || 0))), 0);
    const discount = Number(current.discount_amount || 0);
    const tax = Number(current.tax_amount || 0);
    return { ...current, [field]: nextItems, subtotal: subtotal.toFixed(2), total_amount: Math.max(0, subtotal - discount + tax).toFixed(2) };
  });
  const addNested = (field) => {
    const templates = {
      items: { item_type: 'other', name: '', description: '', quantity: 1, unit_price: '0', total_price: '0' },
      hotels: { hotel_id: '', check_in: '', check_out: '', nights: 1, room_count: 1, room_type: 'SINGLE' },
      vehicles: { vehicle_id: '', vehicle_type: 'ANY', start_date: '', end_date: '', rental_minutes: 1, quantity: 1 },
      itinerary: { day_number: (editForm?.itinerary || []).length + 1, date: '', title: '', description: '', overnight_location: '', meal_plan: '', sort_order: (editForm?.itinerary || []).length },
    };
    setEditForm((current) => ({ ...current, [field]: [...current[field], { ...(templates[field] || {}) }] }));
  };
  const removeNested = (field, index) => setEditForm((current) => {
    const nextItems = current[field].filter((_, itemIndex) => itemIndex !== index);
    if (field !== 'items') return { ...current, [field]: nextItems };
    const subtotal = nextItems.reduce((sum, item) => sum + Number(item.total_price || (Number(item.quantity || 0) * Number(item.unit_price || 0))), 0);
    return { ...current, [field]: nextItems, subtotal: subtotal.toFixed(2), total_amount: Math.max(0, subtotal - Number(current.discount_amount || 0) + Number(current.tax_amount || 0)).toFixed(2) };
  });
  const updatePricing = (field, value) => setEditForm((current) => {
    const next = { ...current, [field]: value };
    if (field !== 'subtotal') next.total_amount = Math.max(0, Number(next.subtotal || 0) - Number(next.discount_amount || 0) + Number(next.tax_amount || 0)).toFixed(2);
    return next;
  });

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!explicitSubmitRef.current || !hasEditChanges) return;
    explicitSubmitRef.current = false;
    setSaving(true);
    try {
      const payload = {};
      ['customer_id', 'package_id', 'variant_id', 'destination_id', 'tour_name', 'travel_date', 'return_date', 'subtotal', 'discount_amount', 'tax_amount', 'total_amount', 'valid_until', 'terms_and_conditions', 'important_notes', 'inclusion', 'exclusion'].forEach((field) => {
        payload[field] = dateFields.has(field) ? toIso(editForm[field]) : editForm[field];
      });
      payload.items = editForm.items || [];
      payload.hotels = editForm.hotels || [];
      payload.vehicles = editForm.vehicles || [];
      payload.itinerary = editForm.itinerary || [];
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
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || result?.detail || 'Unable to generate quotation PDF');
      const pdfValue = result?.data?.url || result?.data?.download_url || result?.data?.file_url || result?.data;
      if (typeof pdfValue !== 'string' || !/^https?:/i.test(pdfValue)) throw new Error('Quotation PDF URL was not returned');

      toast.loading('Downloading quotation PDF...', { id: downloadToastId });
      const pdfResponse = await fetch(pdfValue);
      if (!pdfResponse.ok) throw new Error('Unable to download quotation PDF');
      const pdfBlob = await pdfResponse.blob();
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${quotation.quotation_code || 'quotation'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      toast.success('Quotation PDF downloaded', { id: downloadToastId });
    } catch (error) {
      toast.error(error?.message || 'Unable to generate quotation PDF', { id: downloadToastId });
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

  const renderNestedEditor = (field, label) => <section className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-gray-700"><div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900 dark:text-slate-100">{label}</h3><button type="button" onClick={() => addNested(field)} className="text-sm font-semibold text-cyan-700">Add row</button></div>{(editForm[field] || []).map((item, index) => <div key={`${field}-${index}`} className="grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-2 dark:bg-gray-900/50">{Object.keys(item).filter((key) => !['id', 'quotation_id', 'trip_item_id', 'created_at', 'updated_at'].includes(key)).map((key) => <div key={key}><label className="mb-1 block text-xs font-medium capitalize text-gray-600 dark:text-gray-300">{prettyLabel(key)}</label>{key === 'item_type' ? <SelectField options={quotationItemTypeOptions} value={quotationItemTypeOptions.find((option) => option.value === item[key]) || null} onChange={(option) => updateNested(field, index, key, option?.value || 'other')} isSearchable={false} menuPlacement="auto" /> : nestedDateFields.has(key) ? <CustomDatePicker value={item[key] ?? ''} includeTime={key !== 'date'} onChange={(value) => updateNested(field, index, key, value)} /> : <input type="text" inputMode={numericFields.has(key) ? 'decimal' : undefined} readOnly={field === 'items' && key === 'total_price'} value={item[key] ?? ''} onChange={(event) => updateNested(field, index, key, numericFields.has(key) ? numericValue(event.target.value) : event.target.value)} className={`${inputClass} ${field === 'items' && key === 'total_price' ? 'bg-slate-100 font-semibold dark:bg-gray-800' : ''}`} />}</div>)}<button type="button" onClick={() => removeNested(field, index)} className="justify-self-start text-sm text-rose-600">Remove</button></div>)}</section>;

  const renderReferenceNestedEditor = (field, label) => {
    const isHotel = field === 'hotels';
    const options = isHotel ? hotelOptions : vehicleOptions;
    const idKey = isHotel ? 'hotel_id' : 'vehicle_id';
    const dateKeys = isHotel ? ['check_in', 'check_out'] : ['start_date', 'end_date'];
    return <section className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-gray-700"><div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900 dark:text-slate-100">{label}</h3><button type="button" onClick={() => addNested(field)} className="text-sm font-semibold text-cyan-700">Add row</button></div>{(editForm[field] || []).map((item, index) => <div key={`${field}-${index}`} className="grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-2 dark:bg-gray-900/50"><div><label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">{isHotel ? 'Hotel' : 'Vehicle'}</label><SelectField options={options} isLoading={referencesLoading} isSearchable value={options.find((option) => option.value === item[idKey]) || null} onChange={(option) => updateNested(field, index, idKey, option?.value || '')} placeholder={`Select ${isHotel ? 'hotel' : 'vehicle'}`} isClearable menuPlacement="auto" /></div>{!isHotel && <div><label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Vehicle type</label><SelectField options={vehicleTypeOptions} value={vehicleTypeOptions.find((option) => option.value === item.vehicle_type) || null} onChange={(option) => updateNested(field, index, 'vehicle_type', option?.value || '')} isSearchable={false} menuPlacement="auto" /></div>}{dateKeys.map((key) => <div key={key}><label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">{prettyLabel(key)}</label><CustomDatePicker value={item[key] || ''} includeTime onChange={(value) => updateNested(field, index, key, value)} /></div>)}{(isHotel ? [['nights', 'Nights'], ['room_count', 'Rooms'], ['room_type', 'Room type']] : [['rental_minutes', 'Rental minutes'], ['quantity', 'Quantity']]).map(([key, fieldLabel]) => <div key={key}><label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">{fieldLabel}</label>{key === 'room_type' ? <SelectField options={roomTypeOptions} value={roomTypeOptions.find((option) => option.value === item[key]) || null} onChange={(option) => updateNested(field, index, key, option?.value || '')} isSearchable={false} menuPlacement="auto" /> : <input type="text" inputMode={numericFields.has(key) ? 'decimal' : undefined} value={item[key] ?? ''} onChange={(event) => updateNested(field, index, key, numericFields.has(key) ? numericValue(event.target.value) : event.target.value)} className={inputClass} />}</div>)}<button type="button" onClick={() => removeNested(field, index)} className="justify-self-start text-sm text-rose-600">Remove</button></div>)}</section>;
  };

  const renderReferenceStep = () => <div className="space-y-5"><div className="grid gap-5 md:grid-cols-2"><div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">Customer</label><input value={editForm.customer?.name || editForm.customer_name || 'Unknown customer'} readOnly className={`${inputClass} cursor-not-allowed bg-slate-100 dark:bg-gray-800`} /></div>{renderVersionField('enquiry_id')}{renderVersionField('tour_name')}{renderVersionField('travel_date')}{renderVersionField('return_date')}{renderVersionField('valid_until')}</div><div className="grid gap-3 sm:grid-cols-2"><label className={`cursor-pointer rounded-xl border p-3 text-sm font-semibold ${tripSelectionType === 'DESTINATION' ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 dark:border-gray-700'}`}><input type="radio" name="version-trip-type" checked={tripSelectionType === 'DESTINATION'} onChange={() => { setTripSelectionType('DESTINATION'); setEditForm((current) => ({ ...current, destination_id: current.destination_id, package_id: '', variant_id: '', itinerary: [] })); }} className="mr-2" />By destination</label><label className={`cursor-pointer rounded-xl border p-3 text-sm font-semibold ${tripSelectionType === 'PACKAGE' ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 dark:border-gray-700'}`}><input type="radio" name="version-trip-type" checked={tripSelectionType === 'PACKAGE'} onChange={() => { setTripSelectionType('PACKAGE'); setEditForm((current) => ({ ...current, destination_id: '', variant_id: '', itinerary: [] })); }} className="mr-2" />By package</label></div><div className="grid gap-5 md:grid-cols-2">{tripSelectionType === 'PACKAGE' ? <><div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Package</label><SelectField options={packageOptions} isLoading={referencesLoading} isSearchable value={packageOptions.find((option) => option.value === editForm.package_id) || null} onChange={(option) => setEditForm((current) => ({ ...current, package_id: option?.value || '', variant_id: '', itinerary: [] }))} isClearable placeholder="Search package" /></div><div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Variant</label><SelectField options={variantOptions} isLoading={variantsLoading} isDisabled={!editForm.package_id} isSearchable value={variantOptions.find((option) => option.value === editForm.variant_id) || null} onChange={(option) => { updateEdit('variant_id', option?.value || ''); loadVariantItinerary(option?.value || ''); }} isClearable placeholder="Search variant" /></div></> : <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Destination</label><SelectField options={destinationOptions} isLoading={referencesLoading} isSearchable value={destinationOptions.find((option) => option.value === editForm.destination_id) || null} onChange={(option) => setEditForm((current) => ({ ...current, destination_id: option?.value || '', package_id: '', variant_id: '', itinerary: [] }))} isClearable placeholder="Search destination" /></div>}</div></div>;

  const renderVersionField = (field) => {
    const variantDateLocked = tripSelectionType === 'PACKAGE' && Boolean(editForm.variant_id) && ['travel_date', 'return_date'].includes(field);
    return <div key={field}><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">{prettyLabel(field)}</label>{variantDateLocked ? <input type="text" readOnly value={editForm[field] ? formatDate(editForm[field]) : 'No date configured for this variant'} className={`${inputClass} cursor-not-allowed opacity-70`} /> : dateFields.has(field) ? <CustomDatePicker value={editForm[field] ?? ''} onChange={(value) => updateEdit(field, value)} /> : <input type="text" inputMode={numericFields.has(field) ? 'decimal' : undefined} value={editForm[field] ?? ''} onChange={(event) => updateEdit(field, numericFields.has(field) ? numericValue(event.target.value) : event.target.value)} className={inputClass} />}</div>;
  };

  const renderVersionStep = () => {
    if (versionStep === 0) return renderReferenceStep();
    if (versionStep === 1) return <div className="space-y-5">{renderNestedEditor('items', 'Quotation items')}{renderReferenceNestedEditor('hotels', 'Hotels')}{renderReferenceNestedEditor('vehicles', 'Vehicles')}{renderNestedEditor('itinerary', 'Itinerary')}{itineraryLoading && <p className="text-xs text-gray-500">Loading package itinerary...</p>}</div>;
    return <div className="space-y-6"><div className="grid gap-5 md:grid-cols-2">{pricingFields.map((field) => <div key={field}><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">{prettyLabel(field)}</label><input type="text" inputMode="decimal" readOnly={field === 'subtotal' || field === 'total_amount'} value={editForm[field] ?? '0'} onChange={(event) => updatePricing(field, numericValue(event.target.value))} className={`${inputClass} ${field === 'total_amount' ? 'border-cyan-200 bg-cyan-50 font-bold text-cyan-800 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-200' : field === 'subtotal' ? 'bg-slate-100 font-semibold dark:bg-gray-800' : ''}`} /></div>)}</div><div className="grid gap-5 md:grid-cols-2">{noteFields.map((field) => <div key={field}><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">{prettyLabel(field)}</label><textarea value={editForm[field] ?? ''} onChange={(event) => updateEdit(field, event.target.value)} className={`${inputClass} min-h-[120px] resize-y`} /></div>)}</div></div>;
  };

  if (loading && !quotation) return <div className="flex min-h-[360px] items-center justify-center text-sm text-gray-500">Loading quotation...</div>;
  if (!quotation) return <div className="p-8 text-center"><p className="text-gray-500">Quotation not found.</p><button type="button" onClick={() => navigate('/quotations')} className="mt-4 text-sm font-semibold text-cyan-700">Back to quotations</button></div>;

  return <div className="space-y-5 pb-8"><div className="flex flex-col gap-3 px-2 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-3"><button type="button" onClick={() => navigate('/quotations')} className="rounded-xl border border-gray-200 p-2 text-gray-600 dark:border-gray-700 dark:text-gray-300" title="Back to quotations"><ArrowLeft className="h-5 w-5" /></button><div><p className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">{quotation.quotation_code || 'Quotation'}</p><h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{quotation.tour_name || 'Untitled tour'}</h1><p className="text-sm text-slate-500">Version {quotation.version || 1} · Created {formatDate(quotation.created_at)}</p></div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={loadQuotation} className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" title="Refresh"><RefreshCw className="h-4 w-4" /></button><button type="button" aria-label="Edit quotation" title="Edit quotation" onClick={openEdit} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5 text-sm font-semibold text-gray-700 sm:px-3 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"><Edit3 className="h-4 w-4" /><span className="hidden sm:inline">Edit</span></button><button type="button" aria-label="Create quotation version" title="Create quotation version" onClick={createVersion} className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 p-2.5 text-sm font-semibold text-cyan-700 sm:px-3 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-300"><Plus className="h-4 w-4" /><span className="hidden sm:inline">New version</span></button><button type="button" aria-label="Send quotation" title="Send quotation" onClick={() => setIsSendOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 p-2.5 text-sm font-semibold text-white sm:px-3"><Send className="h-4 w-4" /><span className="hidden sm:inline">Send</span></button><button type="button" onClick={downloadPdf} className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" title="Generate PDF"><Download className="h-4 w-4" /></button><button type="button" onClick={() => setIsDeleteOpen(true)} className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/20" title="Delete quotation"><Trash2 className="h-4 w-4" /></button></div></div>
    <div className="grid gap-4 md:grid-cols-4"><div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"><p className="text-xs uppercase tracking-wide text-gray-500">Status</p><p className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">{quotation.status || 'DRAFT'}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"><p className="text-xs uppercase tracking-wide text-gray-500">Total amount</p><p className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">{formatAmount(quotation.total_amount)}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"><p className="text-xs uppercase tracking-wide text-gray-500">Travel dates</p><p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatDate(quotation.travel_date)} - {formatDate(quotation.return_date)}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"><p className="text-xs uppercase tracking-wide text-gray-500">Valid until</p><p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatDate(quotation.valid_until)}</p></div></div>
    <div className="grid gap-5 xl:grid-cols-3"><div className="space-y-5 xl:col-span-2"><section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"><h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">Quotation summary</h2><div className="grid gap-4 md:grid-cols-2">{['customer_id', 'enquiry_id', 'package_id', 'variant_id', 'destination_id', 'inclusion', 'exclusion', 'important_notes', 'terms_and_conditions'].map((field) => <div key={field} className="border-b border-slate-100 pb-3 dark:border-gray-700"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{prettyLabel(field)}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">{quotation[field] || 'Not provided'}</p></div>)}</div></section><section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"><h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">Itinerary</h2>{(quotation.itinerary || []).length ? <div className="space-y-3">{quotation.itinerary.map((day) => <div key={day.id || day.day_number} className="rounded-xl bg-slate-50 p-4 dark:bg-gray-900/50"><div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900 dark:text-slate-100">Day {day.day_number}: {day.title || 'Untitled day'}</h3><span className="text-xs text-gray-500">{formatDate(day.date)}</span></div><p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{day.description || 'No description'}</p><p className="mt-2 text-xs text-gray-500">{day.overnight_location || 'No overnight location'}{day.meal_plan ? ` · ${day.meal_plan}` : ''}</p></div>)}</div> : <p className="text-sm text-gray-500">No itinerary days added.</p>}</section></div><aside className="space-y-5"><section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"><h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">Amount breakdown</h2><div className="space-y-3 text-sm"><div className="flex justify-between"><span>Subtotal</span><strong>{formatAmount(quotation.subtotal)}</strong></div><div className="flex justify-between"><span>Discount</span><strong>- {formatAmount(quotation.discount_amount)}</strong></div><div className="flex justify-between"><span>Tax</span><strong>{formatAmount(quotation.tax_amount)}</strong></div><div className="flex justify-between border-t border-slate-200 pt-3 text-base dark:border-gray-700"><span>Total</span><strong>{formatAmount(quotation.total_amount)}</strong></div></div></section><section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"><h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">Trip components</h2><div className="space-y-3 text-sm text-slate-700 dark:text-slate-200"><p><strong>{quotation.items?.length || 0}</strong> quotation items</p><p><strong>{quotation.hotels?.length || 0}</strong> hotel stays</p><p><strong>{quotation.vehicles?.length || 0}</strong> vehicle bookings</p><p><Calendar className="mr-2 inline h-4 w-4" />Updated {formatDate(quotation.updated_at)}</p></div></section></aside></div>

    <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title={isCreatingVersion ? 'Create quotation version' : 'Edit quotation'} icon={FileText} size="3xl" footer={<div className="flex w-full items-center justify-between gap-3"><button type="button" onClick={() => setIsEditOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:border-gray-700 dark:text-gray-300">Cancel</button><div className="flex gap-3"><button type="button" onClick={() => setVersionStep((current) => Math.max(0, current - 1))} disabled={versionStep === 0 || saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300">Back</button>{versionStep < versionSteps.length - 1 ? <button type="button" onClick={() => setVersionStep((current) => Math.min(versionSteps.length - 1, current + 1))} className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700">Next</button> : <button type="submit" form="quotation-edit-form" disabled={saving} className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60">{saving ? (isCreatingVersion ? 'Creating...' : 'Saving...') : (isCreatingVersion ? 'Create version' : 'Save changes')}</button>}</div></div>}>{editForm && <form id="quotation-edit-form" onSubmit={saveEdit} className="space-y-6 p-1"><div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-gray-900/70">{versionSteps.map((step, index) => <div key={step} className={`rounded-xl px-3 py-2.5 text-center text-xs font-semibold transition ${index === versionStep ? 'bg-white text-cyan-700 shadow-sm dark:bg-gray-800 dark:text-cyan-300' : index < versionStep ? 'text-cyan-700 dark:text-cyan-400' : 'text-slate-400 dark:text-gray-500'}`}><span className="mr-1.5">{index + 1}.</span>{step}</div>)}</div><div className="rounded-2xl border border-slate-100 bg-white/60 p-4 dark:border-gray-700 dark:bg-gray-900/20">{renderVersionStep()}</div></form>}</Modal>
    <Modal isOpen={isSendOpen} onClose={() => setIsSendOpen(false)} title="Send quotation" icon={Mail} size="sm" footer={<div className="flex justify-end gap-3"><button type="button" onClick={() => setIsSendOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button type="submit" form="send-quotation-form" className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white">Send quotation</button></div>}><form id="send-quotation-form" onSubmit={sendQuotation} className="space-y-4"><p className="text-sm text-gray-500">The quotation will be sent to the recipient email below.</p><input type="email" required value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} className={inputClass} placeholder="customer@example.com" /></form></Modal>
    <ConfirmDeleteModal isOpen={isDeleteOpen} onClose={() => { if (!deleting) setIsDeleteOpen(false); }} onConfirm={deleteQuotation} confirming={deleting} itemLabel={quotation.quotation_code || 'this quotation'} title="Delete quotation" message="This quotation and its itinerary details will be permanently removed." />
  </div>;
};

export default QuotationDetails;
