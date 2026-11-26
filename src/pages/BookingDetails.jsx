import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, CalendarDays, Download, Eye, FileText, Mail, Pencil, Plus, RefreshCw, Send, Trash2, UserRound } from 'lucide-react';
import Modal from '../component/common/Modal';
import ConfirmDeleteModal from '../component/common/ConfirmDeleteModal';
import CustomDatePicker from '../component/common/CustomDatePicker';
import DragDropUpload from '../component/common/DragDropUpload';
import MediaViewerModal from '../component/common/MediaViewerModal';
import DocumentListItem from '../component/common/DocumentListItem';
import PrivateDocumentPreview from '../component/common/PrivateDocumentPreview';
import SelectField from '../component/common/SelectField';
import { apiCall, handleApiError } from '../utils/apiCall';
import { downloadPdfResponse } from '../utils/downloadPdf';
import { downloadPrivateDocument } from '../hooks/usePrivateDocumentFile';
import { useEnums } from '../context/EnumsContext';

const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200';
const emptyTraveller = { full_name: '', traveler_type: 'ADULT', gender: '', date_of_birth: '', mobile: '', email: '', relationship_to_customer: '', is_primary: false };
const bookingDocumentTypes = ['TOUR_DOCUMENT', 'FLIGHT_TICKET', 'TRAIN_TICKET', 'HOTEL_VOUCHER', 'OTHER'];
const bookingDocumentTypeOptions = bookingDocumentTypes.map((type) => ({ value: type, label: type.replace(/_/g, ' ') }));
const bookingStatusOptions = ['TENTATIVE', 'CONFIRMED', 'CANCELLED', 'COMPLETED'].map((value) => ({ value, label: value }));
const bookingDetailSteps = [
  'Overview',
  'Travellers',
  'Itinerary',
  'Guests & payment',
  'Booking items',
  'Arrangements',
  'Status history',
  'Documents',
];
const formatAmount = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const formatBookingDate = (value, includeTime = false) => {
  if (!value) return 'Not provided';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
};
const toLocalDateTime = (value) => value ? new Date(value).toISOString().slice(0, 16) : '';
const relatedDetails = (item, type) => {
  const value = item?.[type];
  return Array.isArray(value) ? value[0] || null : value || null;
};

const BookingField = ({ label, value }) => (
  <div className="min-w-0">
    <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</dt>
    <dd className="mt-1 break-words text-sm font-semibold text-gray-800 dark:text-gray-100">
      {value === null || value === undefined || value === '' ? 'Not provided' : value}
    </dd>
  </div>
);

const BookingStepHeading = ({ number, title, description }) => (
  <div className="mb-4 flex items-start gap-3">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold text-white">{String(number).padStart(2, '0')}</span>
    <div>
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  </div>
);

const BookingDetails = () => {
  const navigate = useNavigate();
  const { bookingId } = useParams();
  const { getEnumOptions } = useEnums();
  const roomTypeOptions = getEnumOptions('RoomType');
  const vehicleTypeOptions = getEnumOptions('VehicleType');
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [status, setStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [isTravellerOpen, setIsTravellerOpen] = useState(false);
  const [traveller, setTraveller] = useState(emptyTraveller);
  const [editingTravellerId, setEditingTravellerId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [travellerDeleteTarget, setTravellerDeleteTarget] = useState(null);
  const [isTripItemModalOpen, setIsTripItemModalOpen] = useState(false);
  const [tripItemTarget, setTripItemTarget] = useState(null);
  const [tripItemType, setTripItemType] = useState('');
  const [tripItemForm, setTripItemForm] = useState({});
  const [tripItemSaving, setTripItemSaving] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [isDocumentUploadOpen, setIsDocumentUploadOpen] = useState(false);
  const [documentSaving, setDocumentSaving] = useState(false);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [documentForm, setDocumentForm] = useState({
    file: '',
    file_name: '',
    document_type: 'TOUR_DOCUMENT',
    title: '',
    description: '',
  });

  const loadBooking = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiCall(`/api/v1/admin/bookings/${bookingId}`, 'GET');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || payload?.detail || 'Unable to fetch booking');
      setBooking(payload?.data || null); setStatus(payload?.data?.status || 'TENTATIVE');
    } catch (error) { handleApiError(error, 'Unable to load booking'); } finally { setLoading(false); }
  }, [bookingId]);
  useEffect(() => { loadBooking(); }, [loadBooking]);
  useEffect(() => { setActiveStep(0); }, [bookingId]);

  const loadDocuments = useCallback(async () => {
    if (!bookingId) return;
    setDocumentsLoading(true);
    try {
      const response = await apiCall(`/api/v1/admin/documents/booking?booking_id=${bookingId}&page=1&page_size=100`, 'GET');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || payload?.detail || 'Unable to fetch booking documents');
      setDocuments(Array.isArray(payload?.data) ? payload.data : []);
    } catch (error) {
      handleApiError(error, 'Unable to load booking documents');
    } finally {
      setDocumentsLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const updateStatus = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      const response = await apiCall(`/api/v1/admin/bookings/${bookingId}/status`, 'PATCH', { status, reason: statusReason });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || result?.detail || 'Unable to update booking status');
      toast.success(result?.message || 'Booking status updated'); setIsStatusOpen(false); setStatusReason(''); await loadBooking();
    } catch (error) { handleApiError(error, 'Unable to update booking status'); } finally { setSaving(false); }
  };

  const sendBooking = async (event) => {
    event.preventDefault();
    try {
      const response = await apiCall(`/api/v1/admin/bookings/${bookingId}/send`, 'POST', { recipient_email: recipientEmail.trim() });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || result?.detail || 'Unable to send booking');
      toast.success(result?.message || 'Booking sent successfully'); setIsSendOpen(false); setRecipientEmail('');
    } catch (error) { handleApiError(error, 'Unable to send booking'); }
  };

  const downloadPdf = async () => {
    try {
      const response = await apiCall(`/api/v1/admin/bookings/${bookingId}/pdf`, 'GET');
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result?.message || result?.detail || 'Unable to generate booking PDF');
      }
      await downloadPdfResponse(response, `${booking.booking_code || 'booking'}.pdf`);
      toast.success('Booking PDF downloaded');
    } catch (error) { handleApiError(error, 'Unable to generate booking PDF'); }
  };

  const downloadVoucher = async (voucherType) => {
    try {
      const response = await apiCall(`/api/v1/admin/bookings/${bookingId}/vouchers/${voucherType}.pdf`, 'GET');
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result?.message || result?.detail || `Unable to generate ${voucherType} voucher`);
      }
      await downloadPdfResponse(response, `${booking.booking_code || 'booking'}-${voucherType}-voucher.pdf`);
      toast.success(`${voucherType === 'hotel' ? 'Hotel' : 'Vehicle'} voucher downloaded`);
    } catch (error) {
      handleApiError(error, `Unable to generate ${voucherType} voucher`);
    }
  };

  const openTripItemDetails = (item, type) => {
    const details = relatedDetails(item, type) || {};
    setTripItemTarget(item);
    setTripItemType(type);
    setTripItemForm(type === 'hotel' ? {
      hotel_id: details.hotel_id || '',
      hotel_name: details.hotel_name || item.name || '',
      check_in: toLocalDateTime(details.check_in),
      check_out: toLocalDateTime(details.check_out),
      nights: details.nights || 1,
      room_count: details.room_count || 1,
      room_type: details.room_type || '',
      place: details.place || '',
      address: details.address || '',
      contact_person: details.contact_person || '',
      contact_number: details.contact_number || '',
      paid_by_traveller: details.paid_by_traveller ?? true,
    } : {
      vehicle_id: details.vehicle_id || '',
      vehicle_name: details.vehicle_name || item.name || '',
      vehicle_type: details.vehicle_type || '',
      start_date: toLocalDateTime(details.start_date),
      end_date: toLocalDateTime(details.end_date),
      rental_minutes: details.rental_minutes || 1,
      quantity: details.quantity || 1,
      pickup_location: details.pickup_location || '',
      drop_location: details.drop_location || '',
      owner_name: details.owner_name || '',
      owner_contact: details.owner_contact || '',
      driver_name: details.driver_name || '',
      driver_contact: details.driver_contact || '',
      registration_number: details.registration_number || '',
      paid_by_traveller: details.paid_by_traveller ?? true,
    });
    setIsTripItemModalOpen(true);
  };

  const saveTripItemDetails = async (event) => {
    event.preventDefault();
    if (!tripItemTarget) return;
    const isHotel = tripItemType === 'hotel';
    const startDate = isHotel ? tripItemForm.check_in : tripItemForm.start_date;
    const endDate = isHotel ? tripItemForm.check_out : tripItemForm.end_date;
    if (!tripItemForm[isHotel ? 'hotel_name' : 'vehicle_name']?.trim() || !startDate || !endDate) {
      toast.error('Name, start date, and end date are required');
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      toast.error('The end date must be after the start date');
      return;
    }
    const requiredCount = Number(tripItemForm[isHotel ? 'nights' : 'rental_minutes']);
    const quantity = Number(tripItemForm[isHotel ? 'room_count' : 'quantity']);
    if (requiredCount < 1 || quantity < 1) {
      toast.error(isHotel ? 'Nights and rooms must be at least one' : 'Rental minutes and quantity must be at least one');
      return;
    }

    setTripItemSaving(true);
    try {
      const payload = isHotel ? {
        ...tripItemForm,
        hotel_id: tripItemForm.hotel_id || null,
        check_in: new Date(tripItemForm.check_in).toISOString(),
        check_out: new Date(tripItemForm.check_out).toISOString(),
        nights: Number(tripItemForm.nights),
        room_count: Number(tripItemForm.room_count),
        room_type: tripItemForm.room_type || null,
      } : {
        ...tripItemForm,
        vehicle_id: tripItemForm.vehicle_id || null,
        start_date: new Date(tripItemForm.start_date).toISOString(),
        end_date: new Date(tripItemForm.end_date).toISOString(),
        vehicle_type: tripItemForm.vehicle_type || null,
        rental_minutes: Number(tripItemForm.rental_minutes),
        quantity: Number(tripItemForm.quantity),
      };
      const response = await apiCall(
        `/api/v1/admin/bookings/${bookingId}/trip-items/${tripItemTarget.id}/${tripItemType}`,
        'PUT',
        payload
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || result?.detail || `Unable to save ${tripItemType} details`);
      toast.success(result?.message || `${tripItemType === 'hotel' ? 'Hotel' : 'Vehicle'} details saved`);
      setIsTripItemModalOpen(false);
      await loadBooking();
    } catch (error) {
      handleApiError(error, `Unable to save ${tripItemType} details`);
    } finally {
      setTripItemSaving(false);
    }
  };

  const saveTraveller = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      const endpoint = editingTravellerId ? `/api/v1/admin/bookings/${bookingId}/travellers/${editingTravellerId}` : `/api/v1/admin/bookings/${bookingId}/travellers`;
      const method = editingTravellerId ? 'PATCH' : 'POST';
      const response = await apiCall(endpoint, method, { ...traveller, date_of_birth: traveller.date_of_birth || null });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || result?.detail || `Unable to ${editingTravellerId ? 'update' : 'add'} traveller`);
      toast.success(result?.message || `Traveller ${editingTravellerId ? 'updated' : 'added'}`); setIsTravellerOpen(false); setTraveller(emptyTraveller); setEditingTravellerId(null); await loadBooking();
    } catch (error) { handleApiError(error, `Unable to ${editingTravellerId ? 'update' : 'add'} traveller`); } finally { setSaving(false); }
  };

  const deleteTraveller = async () => {
    if (!travellerDeleteTarget) return;
    try {
      const response = await apiCall(`/api/v1/admin/bookings/${bookingId}/travellers/${travellerDeleteTarget.id}`, 'DELETE');
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || result?.detail || 'Unable to delete traveller');
      toast.success(result?.message || 'Traveller deleted'); setTravellerDeleteTarget(null); await loadBooking();
    } catch (error) { handleApiError(error, 'Unable to delete traveller'); }
  };

  const uploadBookingDocument = async (event) => {
    event.preventDefault();
    if (!documentForm.file || !documentForm.title.trim()) {
      toast.error('Title and document file are required');
      return;
    }
    setDocumentSaving(true);
    try {
      const response = await apiCall('/api/v1/admin/documents', 'POST', {
        customer_id: booking.customer?.id || null,
        booking_id: bookingId,
        file: documentForm.file,
        file_name: documentForm.file_name || 'document',
        document_type: documentForm.document_type,
        title: documentForm.title.trim(),
        description: documentForm.description.trim() || null,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || result?.detail || 'Unable to upload booking document');
      toast.success(result?.message || 'Booking document uploaded');
      setIsDocumentUploadOpen(false);
      setDocumentForm({ file: '', file_name: '', document_type: 'TOUR_DOCUMENT', title: '', description: '' });
      await loadDocuments();
    } catch (error) {
      handleApiError(error, 'Unable to upload booking document');
    } finally {
      setDocumentSaving(false);
    }
  };

  const downloadBookingDocument = async (document) => {
    try {
      await downloadPrivateDocument(document);
    } catch (error) {
      handleApiError(error, 'Unable to download booking document');
    }
  };

  if (loading && !booking) return <div className="p-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading booking...</div>;
  if (!booking) return <div className="p-12 text-center text-gray-500 dark:text-gray-400">Booking not found.</div>;

  const customerName = booking.customer?.name || booking.customer_name || 'Booking details';
  const bookingDateRange = [booking.departure_date, booking.return_date].filter(Boolean).map((date) => formatBookingDate(date)).join(' - ');
  const arrangementItems = (booking.items || []).filter((item) => {
    const itemType = String(item.item_type || '').toLowerCase();
    return itemType === 'hotel' || itemType === 'transport' || itemType === 'transfer';
  });
  const hasHotelTripItem = arrangementItems.some((item) => String(item.item_type || '').toLowerCase() === 'hotel');
  const hasVehicleTripItem = arrangementItems.some((item) => ['transport', 'transfer'].includes(String(item.item_type || '').toLowerCase()));
  const hasHotelVoucher = (booking.items || []).some((item) => relatedDetails(item, 'hotel'));
  const hasVehicleVoucher = (booking.items || []).some((item) => relatedDetails(item, 'vehicle'));

  return (
    <>
    <div className="space-y-5 pb-8">
      <div className="flex flex-col gap-3 px-2 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => navigate('/bookings')} className="rounded-xl border border-gray-200 p-2 dark:border-gray-700" aria-label="Back to bookings"><ArrowLeft className="h-5 w-5" /></button>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">{booking.booking_code || 'Booking details'}</p>
            <h1 className="truncate text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">{customerName}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{[booking.destination_name, bookingDateRange].filter(Boolean).join(' - ') || 'Travel dates not set'} - {booking.status || 'TENTATIVE'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={loadBooking} className="rounded-xl border border-gray-200 p-2.5 text-gray-700 dark:border-gray-700 dark:text-gray-200" title="Refresh booking" aria-label="Refresh booking"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <Link to="/bookings/calendar" className="rounded-xl border border-gray-200 p-2.5 text-gray-700 dark:border-gray-700 dark:text-gray-200" title="Calendar" aria-label="Booking calendar"><CalendarDays className="h-4 w-4" /></Link>
          <button type="button" aria-label="Update booking status" title="Update booking status" onClick={() => setIsStatusOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 p-2.5 text-sm font-semibold text-white sm:px-3"><Pencil className="h-4 w-4" /><span className="hidden sm:inline">Update status</span></button>
          <button type="button" onClick={() => { setRecipientEmail(booking.customer?.email || ''); setIsSendOpen(true); }} className="rounded-xl border border-gray-200 p-2.5 text-gray-700 dark:border-gray-700 dark:text-gray-200" title="Send booking" aria-label="Send booking"><Send className="h-4 w-4" /></button>
          <button type="button" onClick={downloadPdf} className="rounded-xl border border-gray-200 p-2.5 text-gray-700 dark:border-gray-700 dark:text-gray-200" title="Download PDF" aria-label="Download booking PDF"><Download className="h-4 w-4" /></button>
        </div>
      </div>

      <nav aria-label="Booking detail steps" className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <ol className="flex gap-2 overflow-x-auto pb-1">
          {bookingDetailSteps.map((step, index) => (
            <li key={step}>
              <button
                type="button"
                onClick={() => setActiveStep(index)}
                aria-current={activeStep === index ? 'step' : undefined}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                  activeStep === index
                    ? 'bg-cyan-600 text-white'
                    : 'text-gray-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-700'
                } whitespace-nowrap`}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  activeStep === index ? 'bg-white/20' : 'bg-slate-100 dark:bg-gray-700'
                }`}>{index + 1}</span>
                <span>{step}</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="mt-2 px-2 text-xs text-gray-500 dark:text-gray-400">
          Step {activeStep + 1} of {bookingDetailSteps.length}: {bookingDetailSteps[activeStep]}
        </p>
      </nav>

      <div id="booking-details-panel" aria-label="Booking details" className="space-y-6">
        {activeStep === 0 && (
        <div>
          <BookingStepHeading number={1} title="Booking overview" description="Booking status, customer, trip, and key financial totals." />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Total amount', formatAmount(booking.total_amount)],
              ['Paid amount', formatAmount(booking.paid_amount)],
              ['Due amount', formatAmount(booking.due_amount)],
              ['Profit margin', `${booking.profit_margin ?? 0}%`],
            ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"><p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p><p className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">{value}</p></div>)}
          </div>
        </div>
        )}

          <div className="space-y-5">
              {activeStep === 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-5 flex items-center gap-3">
                  {booking.variant?.banner?.image ? <img src={booking.variant.banner.image} alt="" className="h-16 w-20 rounded-xl object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300"><CalendarDays className="h-6 w-6" /></span>}
                  <div className="min-w-0"><h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{booking.package?.name || booking.variant?.name || 'Trip details'}</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{booking.variant?.name || booking.destination_name || 'Travel package'}{booking.package?.season ? ` - ${booking.package.season}` : ''}</p></div>
                </div>
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  <BookingField label="Customer" value={customerName} /><BookingField label="Email" value={booking.customer?.email || booking.email} /><BookingField label="Mobile" value={booking.customer?.mobile || booking.customer_mobile || booking.mobile} /><BookingField label="Destination" value={booking.destination_name} />
                  <BookingField label="Booking code" value={booking.booking_code} /><BookingField label="Status" value={booking.status} /><BookingField label="Booking type" value={booking.booking_type} /><BookingField label="Source" value={booking.source} />
                  <BookingField label="Departure" value={formatBookingDate(booking.departure_date)} /><BookingField label="Return" value={formatBookingDate(booking.return_date)} /><BookingField label="Package season" value={booking.package?.season} />
                  <BookingField label="Offer" value={booking.offer?.name || booking.offer?.title} /><BookingField label="Sales account" value={booking.sales_account?.name} /><BookingField label="Created by" value={booking.created_by?.name} /><BookingField label="Created" value={formatBookingDate(booking.created_at, true)} /><BookingField label="Updated" value={formatBookingDate(booking.updated_at, true)} />
                </dl>
                {booking.notes && <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-700"><p className="text-xs font-medium uppercase tracking-wide text-gray-500">Notes</p><p className="mt-1 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-100">{booking.notes}</p></div>}
              </section>
              )}
              {activeStep === 1 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold text-white">02</span>
                    <div><h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Travellers <span className="ml-1 text-sm font-medium text-gray-500 dark:text-gray-400">({booking.travellers?.length || 0})</span></h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Passenger details and primary traveller.</p></div>
                  </div>
                  <button type="button" onClick={() => { setTraveller(emptyTraveller); setEditingTravellerId(null); setIsTravellerOpen(true); }} className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-700 dark:text-cyan-300"><Plus className="h-4 w-4" /> Add traveller</button>
                </div>
                {(booking.travellers || []).length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">No travellers added.</p> : <div className="grid gap-3 md:grid-cols-2">{booking.travellers.map((travellerItem) => (
                  <div key={travellerItem.id} className="flex min-w-0 items-start gap-3 rounded-xl border border-gray-100 p-4 dark:border-gray-700">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300"><UserRound className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-900 dark:text-slate-100">{travellerItem.full_name || 'Unnamed traveller'} {travellerItem.is_primary && <span className="ml-1 rounded-full bg-cyan-50 px-2 py-0.5 text-xs text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">Primary</span>}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{[travellerItem.traveler_type || travellerItem.relationship_to_customer, travellerItem.gender, travellerItem.date_of_birth && `Born ${formatBookingDate(travellerItem.date_of_birth)}`].filter(Boolean).join(' - ') || 'Traveller details'}</p><p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{travellerItem.mobile || travellerItem.email || 'No contact details'}</p></div>
                    <button type="button" onClick={() => setTravellerDeleteTarget(travellerItem)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-rose-600 dark:hover:bg-red-950/30" title="Delete traveller" aria-label={`Delete ${travellerItem.full_name || 'traveller'}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}</div>}
              </section>
              )}

              {activeStep === 2 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold text-white">03</span><div><h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Trip itinerary</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{booking.itinerary?.length || 0} itinerary days in travel order.</p></div></div>
                {(booking.itinerary || []).length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">No itinerary details available.</p> : <ol>{booking.itinerary.map((day) => (
                  <li key={day.id} className="relative border-l border-cyan-200 pb-5 pl-5 last:border-0 last:pb-0 dark:border-cyan-900"><span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full border-2 border-white bg-cyan-600 dark:border-gray-800" /><p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Day {day.day_number} - {formatBookingDate(day.date)}</p><h3 className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{day.title || 'Itinerary day'}</h3>{day.description && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{day.description}</p>}{(day.overnight_location || day.meal_plan) && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{[day.overnight_location, day.meal_plan].filter(Boolean).join(' - ')}</p>}</li>
                ))}</ol>}
              </section>
              )}
              {activeStep === 3 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold text-white">04</span><div><h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Guests & payment</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Passenger counts and booking totals.</p></div></div>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3"><BookingField label="Adults" value={booking.adult_count ?? 0} /><BookingField label="Children" value={booking.child_count ?? 0} /><BookingField label="Seniors" value={booking.senior_count ?? 0} /><BookingField label="Subtotal" value={formatAmount(booking.subtotal)} /><BookingField label="Discount" value={formatAmount(booking.discount_amount)} /><BookingField label="Gross profit" value={formatAmount(booking.gross_profit)} /></dl>
              </section>
              )}
              {activeStep === 4 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold text-white">05</span><div><h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Booking items <span className="ml-1 text-sm font-medium text-gray-500 dark:text-gray-400">({booking.items?.length || 0})</span></h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Services and extras attached to this booking.</p></div></div>
                {(booking.items || []).length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">No additional booking items.</p> : <ul className="grid gap-3 sm:grid-cols-2">{booking.items.map((item, index) => <li key={item.id || index} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-gray-900/50"><p className="font-semibold text-slate-900 dark:text-slate-100">{item.name || item.title || 'Booking item'}</p>{item.description && <p className="mt-1 whitespace-pre-wrap text-xs text-gray-500 dark:text-gray-400">{item.description}</p>}{(item.type || item.category || item.item_type) && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.type || item.category || item.item_type}</p>}{(Array.isArray(item.hotel) ? item.hotel : item.hotel ? [item.hotel] : []).map((hotel, hotelIndex) => <div key={hotel.id || hotelIndex} className="mt-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"><p className="font-semibold">Hotel: {hotel.hotel_name || 'Hotel stay'}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{[hotel.check_in && `Check-in ${formatBookingDate(hotel.check_in, true)}`, hotel.check_out && `Check-out ${formatBookingDate(hotel.check_out, true)}`, hotel.nights != null && `${hotel.nights} nights`, hotel.room_count != null && `${hotel.room_count} rooms`, hotel.room_type].filter(Boolean).join(' · ')}</p></div>)}{(Array.isArray(item.vehicle) ? item.vehicle : item.vehicle ? [item.vehicle] : []).map((vehicle, vehicleIndex) => <div key={vehicle.id || vehicleIndex} className="mt-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"><p className="font-semibold">Vehicle: {vehicle.vehicle_name || 'Vehicle booking'}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{[vehicle.vehicle_type, vehicle.start_date && `Start ${formatBookingDate(vehicle.start_date, true)}`, vehicle.end_date && `End ${formatBookingDate(vehicle.end_date, true)}`, vehicle.rental_minutes != null && `${vehicle.rental_minutes} minutes`, vehicle.quantity != null && `Quantity ${vehicle.quantity}`].filter(Boolean).join(' · ')}</p></div>)}</li>)}</ul>}
              </section>
              )}
              {activeStep === 5 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold text-white">06</span><div><h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Hotel & vehicle arrangements</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Review or update supplier details for each trip item.</p></div></div><div className="flex flex-wrap gap-2">{['hotel', 'vehicle'].map((type) => { const hasVoucher = type === 'hotel' ? hasHotelVoucher : hasVehicleVoucher; return <button key={type} type="button" onClick={() => downloadVoucher(type)} disabled={!hasVoucher} title={hasVoucher ? `Download ${type} voucher` : `Add ${type} details before downloading a voucher`} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-200"><Download className="h-4 w-4" /> {type === 'hotel' ? 'Hotel' : 'Vehicle'} voucher</button>; })}</div></div>
                {!hasHotelTripItem && <button type="button" onClick={() => openTripItemDetails({ id: 'new', name: '' }, 'hotel')} className="mr-2 mb-3 rounded-lg border border-cyan-200 px-3 py-2 text-sm font-semibold text-cyan-700 dark:border-cyan-900/50 dark:text-cyan-300">Add hotel details</button>}
                {!hasVehicleTripItem && <button type="button" onClick={() => openTripItemDetails({ id: 'new', name: '' }, 'vehicle')} className="mb-3 rounded-lg border border-cyan-200 px-3 py-2 text-sm font-semibold text-cyan-700 dark:border-cyan-900/50 dark:text-cyan-300">Add vehicle details</button>}
                {arrangementItems.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">Add hotel or vehicle details above to create the first trip item.</p> : (
                  <ul className="space-y-3">
                    {arrangementItems.map((item) => {
                      const itemType = String(item.item_type || '').toLowerCase();
                      const detailType = itemType === 'hotel' ? 'hotel' : 'vehicle';
                      return (
                        <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-gray-900/50">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{item.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{detailType === 'hotel' ? 'Hotel' : 'Transport'} details {relatedDetails(item, detailType) ? 'saved' : 'not added'}</p>
                          </div>
                          <button type="button" onClick={() => openTripItemDetails(item, detailType)} className="shrink-0 rounded-lg border border-cyan-200 px-3 py-2 text-xs font-semibold text-cyan-700 dark:border-cyan-900/50 dark:text-cyan-300">
                            {relatedDetails(item, detailType) ? `Update ${detailType} details` : `Add ${detailType} details`}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
              )}
              {activeStep === 6 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold text-white">07</span><div><h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Status history</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Changes made to the booking over time.</p></div></div>
                {(booking.status_history || []).length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">No status history available.</p> : <ol className="space-y-4">{booking.status_history.map((history) => <li key={history.id} className="border-l-2 border-cyan-500 pl-3"><p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{history.from_status || 'Created'} to {history.to_status}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{history.reason || 'No reason provided'}</p><p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{formatBookingDate(history.changed_at || history.created_at, true)}</p></li>)}</ol>}
              </section>
              )}
          </div>
        </div>
        {activeStep === 7 && (
          <section id="booking-documents-panel" aria-label="Booking documents" className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold text-white">08</span><div><h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Booking documents <span className="ml-1 text-sm font-medium text-gray-500 dark:text-gray-400">({documents.length})</span></h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Tickets, vouchers, and other booking files.</p></div></div><button type="button" onClick={() => setIsDocumentUploadOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-700"><Plus className="h-4 w-4" /> Upload document</button></div>
          {documentsLoading ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading booking documents...</p>
          ) : documents.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">No documents uploaded for this booking yet.</p>
          ) : (
            <div className="space-y-3">
              {documents.map((document) => (
                <DocumentListItem
                  key={document.id}
                  document={document}
                  subtitle={document.description || 'Booking document'}
                  onPreview={setPreviewDocument}
                  details={[
                    { label: 'Uploaded by', value: document.uploader_name || 'N/A' },
                    { label: 'Type', value: (document.document_type || 'Document').replaceAll('_', ' '), badge: true },
                    { label: 'Uploaded date', value: document.uploaded_at ? formatBookingDate(document.uploaded_at) : 'Date unavailable' },
                  ]}
                  actions={[
                    {
                      label: 'Preview Document',
                      icon: <Eye className="h-4 w-4 text-emerald-500" />,
                      onClick: () => setPreviewDocument(document),
                    },
                    {
                      label: 'Download Document',
                      icon: <Download className="h-4 w-4 text-sky-500" />,
                      onClick: () => downloadBookingDocument(document),
                    },
                  ]}
                />
              ))}
            </div>
          )}
          </section>
        )}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <button type="button" onClick={() => setActiveStep((step) => Math.max(0, step - 1))} disabled={activeStep === 0} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-200">
            Previous
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">{activeStep + 1} / {bookingDetailSteps.length}</span>
          <button type="button" onClick={() => setActiveStep((step) => Math.min(bookingDetailSteps.length - 1, step + 1))} disabled={activeStep === bookingDetailSteps.length - 1} className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
            Next
          </button>
        </div>
    </div>
    <MediaViewerModal isOpen={!!previewDocument} onClose={() => setPreviewDocument(null)}>
      {previewDocument && <PrivateDocumentPreview document={previewDocument} />}
    </MediaViewerModal>
    <Modal isOpen={isDocumentUploadOpen} onClose={() => setIsDocumentUploadOpen(false)} title="Upload booking document" icon={FileText} size="lg" footer={<div className="flex justify-end gap-2"><button type="button" onClick={() => setIsDocumentUploadOpen(false)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-200">Cancel</button><button type="submit" form="booking-document-form" disabled={documentSaving} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{documentSaving ? 'Uploading...' : 'Upload document'}</button></div>}>
      <form id="booking-document-form" onSubmit={uploadBookingDocument} className="space-y-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Document type
          <SelectField
            className="mt-1"
            options={bookingDocumentTypeOptions}
            value={bookingDocumentTypeOptions.find((option) => option.value === documentForm.document_type) || null}
            onChange={(option) => setDocumentForm((current) => ({ ...current, document_type: option?.value || bookingDocumentTypes[0] }))}
            isSearchable={false}
            menuPlacement="auto"
          />
        </label>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title
          <input value={documentForm.title} onChange={(event) => setDocumentForm((current) => ({ ...current, title: event.target.value }))} className={`${inputClass} mt-1`} required maxLength={200} />
        </label>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description
          <textarea value={documentForm.description} onChange={(event) => setDocumentForm((current) => ({ ...current, description: event.target.value }))} className={`${inputClass} mt-1`} rows={3} />
        </label>
        <DragDropUpload label="Document file" value={documentForm.file} accept="application/pdf,image/*" helperText="PDF, JPG, PNG, TIFF" onChange={(url, _result, file) => setDocumentForm((current) => ({ ...current, file: url, file_name: file?.name || '' }))} />
      </form>
    </Modal>
    <Modal
      isOpen={isTripItemModalOpen}
      onClose={() => { if (!tripItemSaving) setIsTripItemModalOpen(false); }}
      title={`${relatedDetails(tripItemTarget, tripItemType) ? 'Edit' : 'Add'} ${tripItemType} details`}
      icon={Pencil}
      size="lg"
      footer={(
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setIsTripItemModalOpen(false)} disabled={tripItemSaving} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-200">Cancel</button>
          <button type="submit" form="trip-item-details-form" disabled={tripItemSaving} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{tripItemSaving ? 'Saving...' : 'Save details'}</button>
        </div>
      )}
    >
      <form id="trip-item-details-form" onSubmit={saveTripItemDetails} className="grid gap-4 text-gray-700 dark:text-gray-200 md:grid-cols-2">
        <label className="text-sm font-medium">{tripItemType === 'hotel' ? 'Hotel name *' : 'Vehicle name *'}
          <input required value={tripItemForm[tripItemType === 'hotel' ? 'hotel_name' : 'vehicle_name'] || ''} onChange={(event) => setTripItemForm((current) => ({ ...current, [tripItemType === 'hotel' ? 'hotel_name' : 'vehicle_name']: event.target.value }))} className={`${inputClass} mt-1`} />
        </label>
        {tripItemType === 'hotel' ? (
          <>
            <label className="text-sm font-medium">Room type
              <SelectField className="mt-1" options={roomTypeOptions} value={roomTypeOptions.find((option) => option.value === tripItemForm.room_type) || null} onChange={(option) => setTripItemForm((current) => ({ ...current, room_type: option?.value || '' }))} isSearchable={false} isClearable menuPlacement="auto" />
            </label>
            {['check_in', 'check_out'].map((field) => <div key={field}><label className="mb-1 block text-sm font-medium">{field === 'check_in' ? 'Check-in *' : 'Check-out *'}</label><CustomDatePicker value={tripItemForm[field] || ''} includeTime onChange={(value) => setTripItemForm((current) => ({ ...current, [field]: value }))} /></div>)}
            {['nights', 'room_count'].map((field) => <label key={field} className="text-sm font-medium">{field === 'nights' ? 'Nights *' : 'Rooms *'}
              <input required min="1" type="number" value={tripItemForm[field] ?? 1} onChange={(event) => setTripItemForm((current) => ({ ...current, [field]: event.target.value }))} className={`${inputClass} mt-1`} />
            </label>)}
            {['place', 'address', 'contact_person', 'contact_number'].map((field) => <label key={field} className="text-sm font-medium">{field.replaceAll('_', ' ')}
              <input value={tripItemForm[field] || ''} onChange={(event) => setTripItemForm((current) => ({ ...current, [field]: event.target.value }))} className={`${inputClass} mt-1`} />
            </label>)}
          </>
        ) : (
          <>
            <label className="text-sm font-medium">Vehicle type
              <SelectField className="mt-1" options={vehicleTypeOptions} value={vehicleTypeOptions.find((option) => option.value === tripItemForm.vehicle_type) || null} onChange={(option) => setTripItemForm((current) => ({ ...current, vehicle_type: option?.value || '' }))} isSearchable={false} isClearable menuPlacement="auto" />
            </label>
            {['start_date', 'end_date'].map((field) => <div key={field}><label className="mb-1 block text-sm font-medium">{field === 'start_date' ? 'Start date *' : 'End date *'}</label><CustomDatePicker value={tripItemForm[field] || ''} includeTime onChange={(value) => setTripItemForm((current) => ({ ...current, [field]: value }))} /></div>)}
            {['rental_minutes', 'quantity'].map((field) => <label key={field} className="text-sm font-medium">{field.replaceAll('_', ' ')} *
              <input required min="1" type="number" value={tripItemForm[field] ?? 1} onChange={(event) => setTripItemForm((current) => ({ ...current, [field]: event.target.value }))} className={`${inputClass} mt-1`} />
            </label>)}
            {['pickup_location', 'drop_location', 'owner_name', 'owner_contact', 'driver_name', 'driver_contact', 'registration_number'].map((field) => <label key={field} className="text-sm font-medium">{field.replaceAll('_', ' ')}
              <input value={tripItemForm[field] || ''} onChange={(event) => setTripItemForm((current) => ({ ...current, [field]: event.target.value }))} className={`${inputClass} mt-1`} />
            </label>)}
          </>
        )}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(tripItemForm.paid_by_traveller)} onChange={(event) => setTripItemForm((current) => ({ ...current, paid_by_traveller: event.target.checked }))} />Paid by traveller</label>
      </form>
    </Modal>
    <Modal isOpen={isStatusOpen} onClose={() => setIsStatusOpen(false)} title="Update booking status" icon={RefreshCw} size="md" footer={<div className="flex justify-end gap-2"><button type="button" onClick={() => setIsStatusOpen(false)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-200">Cancel</button><button type="submit" form="booking-status-form" disabled={saving} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white">Save status</button></div>}>
      <form id="booking-status-form" onSubmit={updateStatus} className="space-y-4">
        <SelectField
          options={bookingStatusOptions}
          value={bookingStatusOptions.find((option) => option.value === status) || null}
          onChange={(option) => setStatus(option?.value || '')}
          isSearchable={false}
          menuPlacement="auto"
        />
        <textarea value={statusReason} onChange={(event) => setStatusReason(event.target.value)} className={`${inputClass} min-h-24`} placeholder="Reason" />
      </form>
    </Modal>
    <Modal isOpen={isSendOpen} onClose={() => setIsSendOpen(false)} title="Send booking" icon={Mail} size="sm" footer={<div className="flex justify-end gap-2"><button type="button" onClick={() => setIsSendOpen(false)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-200">Cancel</button><button type="submit" form="booking-send-form" className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white">Send</button></div>}>
      <form id="booking-send-form" onSubmit={sendBooking}><input required type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} className={inputClass} placeholder="customer@example.com" /></form>
    </Modal>
    <Modal isOpen={isTravellerOpen} onClose={() => setIsTravellerOpen(false)} title={editingTravellerId ? 'Edit traveller' : 'Add traveller'} icon={UserRound} size="lg" footer={<div className="flex justify-end gap-2"><button type="button" onClick={() => setIsTravellerOpen(false)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-200">Cancel</button><button type="submit" form="traveller-form" disabled={saving} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white">{saving ? 'Saving...' : editingTravellerId ? 'Save changes' : 'Add traveller'}</button></div>}>
      <form id="traveller-form" onSubmit={saveTraveller} className="grid gap-4 text-gray-700 dark:text-gray-200 md:grid-cols-2">
        {Object.entries(traveller).filter(([key]) => key !== 'is_primary').map(([key, value]) => key === 'date_of_birth'
          ? <div key={key}><label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Date of birth</label><CustomDatePicker value={value} includeTime={false} onChange={(next) => setTraveller((current) => ({ ...current, date_of_birth: next }))} /></div>
          : <input key={key} value={value} onChange={(event) => setTraveller((current) => ({ ...current, [key]: event.target.value }))} placeholder={key.replaceAll('_', ' ')} className={inputClass} />)}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={traveller.is_primary} onChange={(event) => setTraveller((current) => ({ ...current, is_primary: event.target.checked }))} />Primary traveller</label>
      </form>
    </Modal>
    <ConfirmDeleteModal isOpen={Boolean(travellerDeleteTarget)} onClose={() => setTravellerDeleteTarget(null)} onConfirm={deleteTraveller} itemLabel={travellerDeleteTarget?.full_name || 'this traveller'} title="Delete traveller" message="This traveller will be removed from the booking." />
    </>
  );
};

export default BookingDetails;
