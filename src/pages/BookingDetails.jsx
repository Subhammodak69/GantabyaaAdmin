import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, CalendarDays, Download, Eye, FileText, Mail, Pencil, Plus, RefreshCw, Send, Trash2, UserRound } from 'lucide-react';
import Modal from '../component/common/Modal';
import ConfirmDeleteModal from '../component/common/ConfirmDeleteModal';
import CustomDatePicker from '../component/common/CustomDatePicker';
import DragDropUpload from '../component/common/DragDropUpload';
import MediaViewerModal from '../component/common/MediaViewerModal';
import { apiCall, handleApiError } from '../utils/apiCall';
import usePrivateDocumentFile, { downloadPrivateDocument } from '../hooks/usePrivateDocumentFile';

const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200';
const emptyTraveller = { full_name: '', traveler_type: 'ADULT', gender: '', date_of_birth: '', mobile: '', email: '', relationship_to_customer: '', is_primary: false };
const bookingDocumentTypes = ['TOUR_DOCUMENT', 'FLIGHT_TICKET', 'TRAIN_TICKET', 'HOTEL_VOUCHER', 'OTHER'];
const formatAmount = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const BookingDocumentPreview = ({ document }) => {
  const { fileUrl, mimeType, loading, error } = usePrivateDocumentFile(document);
  const isPdf = mimeType.includes('pdf') || document?.mime_type === 'application/pdf' || document?.file_name?.toLowerCase().endsWith('.pdf');
  const isVideo = mimeType.startsWith('video/');
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-black p-4">
      {loading ? <p className="text-sm text-white">Loading document...</p>
        : error ? <p className="text-sm text-red-300">{error}</p>
          : isPdf ? <iframe title={document?.title || 'Booking document'} src={fileUrl} className="h-[75vh] w-full rounded-xl bg-white" />
            : isVideo ? <video src={fileUrl} controls className="max-h-[75vh] max-w-full rounded-xl" />
            : <img src={fileUrl} alt={document?.title || 'Booking document'} className="max-h-[75vh] max-w-full rounded-xl object-contain" />}
    </div>
  );
};

const BookingDetails = () => {
  const navigate = useNavigate();
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
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
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const result = await response.json();
        const url = result?.data?.url || result?.data?.download_url || result?.data?.file_url || result?.data;
        if (typeof url === 'string') window.open(url, '_blank', 'noopener,noreferrer');
        else toast.success(result?.message || 'Booking PDF generated');
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${booking.booking_code || 'booking'}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Booking PDF downloaded');
    } catch (error) { handleApiError(error, 'Unable to generate booking PDF'); }
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

  if (loading && !booking) return <div className="p-12 text-center text-sm text-gray-500">Loading booking...</div>;
  if (!booking) return <div className="p-12 text-center text-gray-500">Booking not found.</div>;
  return <div className="space-y-5 pb-8"><div className="flex flex-col gap-3 px-2 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-3"><button type="button" onClick={() => navigate('/bookings')} className="rounded-xl border border-gray-200 p-2 dark:border-gray-700"><ArrowLeft className="h-5 w-5" /></button><div><p className="text-sm font-semibold text-cyan-700">{booking.booking_code || booking.id}</p><h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{booking.customer_name || 'Booking details'}</h1><p className="text-sm text-gray-500">{booking.travel_date || 'Travel date not set'} · {booking.status || 'TENTATIVE'}</p></div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={loadBooking} className="rounded-xl border border-gray-200 p-2.5 dark:border-gray-700" title="Refresh"><RefreshCw className="h-4 w-4" /></button><Link to="/bookings/calendar" className="rounded-xl border border-gray-200 p-2.5 dark:border-gray-700" title="Calendar"><CalendarDays className="h-4 w-4" /></Link><button type="button" aria-label="Update booking status" title="Update booking status" onClick={() => setIsStatusOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 p-2.5 text-sm font-semibold text-white sm:px-3"><Pencil className="h-4 w-4" /><span className="hidden sm:inline">Update status</span></button><button type="button" onClick={() => setIsSendOpen(true)} className="rounded-xl border border-gray-200 p-2.5 dark:border-gray-700" title="Send"><Send className="h-4 w-4" /></button><button type="button" onClick={downloadPdf} className="rounded-xl border border-gray-200 p-2.5 dark:border-gray-700" title="PDF"><Download className="h-4 w-4" /></button></div></div><div className="grid gap-4 md:grid-cols-4"><div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"><p className="text-xs text-gray-500">Total</p><p className="mt-2 text-xl font-bold">{formatAmount(booking.total_amount)}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"><p className="text-xs text-gray-500">Paid</p><p className="mt-2 text-xl font-bold">{formatAmount(booking.paid_amount)}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"><p className="text-xs text-gray-500">Due</p><p className="mt-2 text-xl font-bold">{formatAmount(booking.due_amount)}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"><p className="text-xs text-gray-500">Profit margin</p><p className="mt-2 text-xl font-bold">{booking.profit_margin ?? 0}%</p></div></div><div className="grid gap-5 xl:grid-cols-3"><section className="space-y-5 xl:col-span-2"><div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"><h2 className="mb-4 text-lg font-bold">Booking information</h2><dl className="grid gap-4 text-sm sm:grid-cols-2">{[['Customer', booking.customer_name || booking.customer_id], ['Mobile', booking.customer_mobile || booking.mobile], ['Email', booking.email], ['Package', booking.package_id], ['Variant', booking.variant_id], ['Quotation', booking.quotation_id], ['Source', booking.source], ['Adults', booking.adult_count], ['Children', booking.child_count], ['Seniors', booking.senior_count], ['Notes', booking.notes || booking.special_notes]].map(([label, value]) => <div key={label}><dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt><dd className="mt-1 font-semibold text-gray-800 dark:text-gray-100">{value || 'Not provided'}</dd></div>)}</dl></div><div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">Travellers</h2><button type="button" onClick={() => setIsTravellerOpen(true)} className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-700"><Plus className="h-4 w-4" />Add traveller</button></div>{(booking.travellers || []).length === 0 ? <p className="text-sm text-gray-500">No travellers added.</p> : <div className="space-y-3">{booking.travellers.map((travellerItem) => <div key={travellerItem.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-gray-900/50"><div><p className="font-semibold">{travellerItem.full_name || 'Unnamed traveller'} {travellerItem.is_primary && <span className="text-xs text-cyan-700">Primary</span>}</p><p className="text-xs text-gray-500">{travellerItem.traveler_type} · {travellerItem.gender || 'Gender not set'} · {travellerItem.mobile || travellerItem.email || 'No contact'}</p></div><button type="button" onClick={() => setTravellerDeleteTarget(travellerItem)} className="text-rose-600" title="Delete traveller"><Trash2 className="h-4 w-4" /></button></div>)}</div>}</div></section><aside className="space-y-5"><div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"><h2 className="mb-4 text-lg font-bold">Trip components</h2><p className="text-sm"><strong>{booking.items?.length || 0}</strong> items</p><p className="mt-2 text-sm"><strong>{booking.hotels?.length || 0}</strong> hotels</p><p className="mt-2 text-sm"><strong>{booking.vehicles?.length || 0}</strong> vehicles</p><p className="mt-2 text-sm"><strong>{booking.itinerary?.length || 0}</strong> itinerary days</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"><h2 className="mb-4 text-lg font-bold">Status history</h2>{(booking.status_history || []).map((history) => <div key={history.id} className="border-l-2 border-cyan-500 pl-3 text-sm"><p className="font-semibold">{history.from_status || 'Created'} to {history.to_status}</p><p className="text-xs text-gray-500">{history.reason || 'No reason'}</p></div>)}</div></aside></div>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Booking documents</h2>
          <p className="mt-1 text-sm text-gray-500">Upload and view tickets, vouchers, and other booking files.</p>
        </div>
        <button type="button" onClick={() => setIsDocumentUploadOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-700">
          <Plus className="h-4 w-4" /> Upload document
        </button>
      </div>
      {documentsLoading ? <p className="py-8 text-center text-sm text-gray-500">Loading booking documents...</p>
        : documents.length === 0 ? <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700">No documents uploaded for this booking yet.</p>
          : <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {documents.map((document) => (
              <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300"><FileText className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{document.title || document.file_name || 'Booking document'}</p>
                    <p className="text-xs text-gray-500">{document.document_type?.replace(/_/g, ' ') || 'Document'} · {document.uploaded_at ? new Date(document.uploaded_at).toLocaleDateString() : 'Date unavailable'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setPreviewDocument(document)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"><Eye className="h-3.5 w-3.5" /> View</button>
                  <button type="button" onClick={() => downloadBookingDocument(document)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"><Download className="h-3.5 w-3.5" /> Download</button>
                </div>
              </div>
            ))}
          </div>}
    </section>
    <MediaViewerModal isOpen={!!previewDocument} onClose={() => setPreviewDocument(null)}>
      {previewDocument && <BookingDocumentPreview document={previewDocument} />}
    </MediaViewerModal>
    <Modal isOpen={isDocumentUploadOpen} onClose={() => setIsDocumentUploadOpen(false)} title="Upload booking document" icon={FileText} size="lg" footer={<div className="flex justify-end gap-2"><button type="button" onClick={() => setIsDocumentUploadOpen(false)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold">Cancel</button><button type="submit" form="booking-document-form" disabled={documentSaving} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{documentSaving ? 'Uploading...' : 'Upload document'}</button></div>}>
      <form id="booking-document-form" onSubmit={uploadBookingDocument} className="space-y-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Document type
          <select value={documentForm.document_type} onChange={(event) => setDocumentForm((current) => ({ ...current, document_type: event.target.value }))} className={`${inputClass} mt-1`}>
            {bookingDocumentTypes.map((type) => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}
          </select>
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
    <Modal isOpen={isStatusOpen} onClose={() => setIsStatusOpen(false)} title="Update booking status" icon={RefreshCw} size="md" footer={<div className="flex justify-end gap-2"><button type="button" onClick={() => setIsStatusOpen(false)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold">Cancel</button><button type="submit" form="booking-status-form" disabled={saving} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white">Save status</button></div>}><form id="booking-status-form" onSubmit={updateStatus} className="space-y-4"><select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}><option>TENTATIVE</option><option>CONFIRMED</option><option>CANCELLED</option><option>COMPLETED</option></select><textarea value={statusReason} onChange={(event) => setStatusReason(event.target.value)} className={`${inputClass} min-h-24`} placeholder="Reason" /></form></Modal><Modal isOpen={isSendOpen} onClose={() => setIsSendOpen(false)} title="Send booking" icon={Mail} size="sm" footer={<div className="flex justify-end gap-2"><button type="button" onClick={() => setIsSendOpen(false)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold">Cancel</button><button type="submit" form="booking-send-form" className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white">Send</button></div>}><form id="booking-send-form" onSubmit={sendBooking}><input required type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} className={inputClass} placeholder="customer@example.com" /></form></Modal><Modal isOpen={isTravellerOpen} onClose={() => setIsTravellerOpen(false)} title="Add traveller" icon={UserRound} size="lg" footer={<div className="flex justify-end gap-2"><button type="button" onClick={() => setIsTravellerOpen(false)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold">Cancel</button><button type="submit" form="traveller-form" disabled={saving} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white">Add traveller</button></div>}><form id="traveller-form" onSubmit={saveTraveller} className="grid gap-4 md:grid-cols-2">{Object.entries(traveller).filter(([key]) => key !== 'is_primary').map(([key, value]) => key === 'date_of_birth' ? <div key={key}><label className="mb-1.5 block text-sm font-medium">Date of birth</label><CustomDatePicker value={value} includeTime={false} onChange={(next) => setTraveller((current) => ({ ...current, date_of_birth: next }))} /></div> : <input key={key} value={value} onChange={(event) => setTraveller((current) => ({ ...current, [key]: event.target.value }))} placeholder={key.replaceAll('_', ' ')} className={inputClass} />)}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={traveller.is_primary} onChange={(event) => setTraveller((current) => ({ ...current, is_primary: event.target.checked }))} />Primary traveller</label></form></Modal><ConfirmDeleteModal isOpen={Boolean(travellerDeleteTarget)} onClose={() => setTravellerDeleteTarget(null)} onConfirm={deleteTraveller} itemLabel={travellerDeleteTarget?.full_name || 'this traveller'} title="Delete traveller" message="This traveller will be removed from the booking." /></div>;
};

export default BookingDetails;
