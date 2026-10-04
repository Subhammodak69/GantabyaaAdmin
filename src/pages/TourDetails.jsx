import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Image as ImageIcon,
  Images,
  Sparkles,
  CalendarRange,
  Route as RouteIcon,
  ListChecks,
  CalendarDays,
  Save,
  Trash2,
  Plus,
  Pencil,
  RotateCcw,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import DragDropUpload from '../component/common/DragDropUpload';
import MediaPreviewModal from '../component/common/MediaPreviewModal';
import Modal from '../component/common/Modal';
import ConfirmDeleteModal from '../component/common/ConfirmDeleteModal';
import CustomDatePicker from '../component/common/CustomDatePicker';
import SelectField from '../component/common/SelectField';
import { apiCall, handleApiError } from '../utils/apiCall';
import { sanitizeNumericInput } from '../utils/inputValidation';

const createEmptyDraft = () => ({
  banner: { items: [], cover_image: '', image: '', video: '' },
  gallery: [],
  highlights: [],
  inclusions: [],
  exclusions: [],
  departure_dates: [],
  itinerary: [],
  route: [],
});

const normalizeMediaUrl = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    return (
      value.url ||
      value.image ||
      value.image_url ||
      value.imageUrl ||
      value.src ||
      value.path ||
      value.video ||
      value.video_url ||
      value.videoUrl ||
      ''
    );
  }
  return String(value).trim();
};

const getMediaTypeFromUrl = (url, fallbackType = 'image') => {
  if (!url) return fallbackType;
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('.mp4') || lowerUrl.includes('.mov') || lowerUrl.includes('.webm') || lowerUrl.includes('.ogg') || lowerUrl.includes('video/upload')) {
    return 'video';
  }
  return fallbackType;
};

const normalizeBannerItem = (item, fallbackIndex = 0) => {
  const url = normalizeMediaUrl(
    item?.url ??
    item?.image ??
    item?.media_url ??
    item?.image_url ??
    item?.imageUrl ??
    item?.src ??
    item?.video ??
    item?.video_url ??
    item?.videoUrl ??
    item?.path ??
    ''
  );

  const type = (item?.type || item?.media_type || item?.kind || getMediaTypeFromUrl(url, 'image')).toLowerCase();

  return {
    ...(item?.id ? { id: item.id } : {}),
    url,
    type: type === 'video' ? 'video' : 'image',
    alt: item?.alt || '',
    cover_image: Boolean(item?.cover_image),
    display_order: item?.display_order ?? fallbackIndex + 1,
  };
};

const normalizeDetailData = (detailData = {}) => {
  const bannerSource = detailData.banner || {};
  const bannerItems = Array.isArray(bannerSource)
    ? bannerSource.map((item, index) => normalizeBannerItem(item, index))
    : Array.isArray(bannerSource.items)
      ? bannerSource.items.map((item, index) => normalizeBannerItem(item, index))
      : [
          bannerSource.image,
          bannerSource.video,
          bannerSource.cover_image,
          bannerSource.url,
          bannerSource.media_url,
          bannerSource.image_url,
          bannerSource.video_url,
          bannerSource.imageUrl,
          bannerSource.videoUrl,
        ]
          .filter(Boolean)
          .map((entry, index) => {
            const isVideo = getMediaTypeFromUrl(String(entry), 'image') === 'video';
            return normalizeBannerItem({
              type: isVideo ? 'video' : 'image',
              url: entry,
              cover_image: entry === bannerSource.cover_image,
            }, index);
          });

  const normalizedBanner = {
    items: bannerItems.length ? bannerItems : [
      normalizeBannerItem({
        type: getMediaTypeFromUrl(normalizeMediaUrl(bannerSource.video || bannerSource.url || bannerSource.image || ''), 'image'),
        url: normalizeMediaUrl(bannerSource.video || bannerSource.url || bannerSource.image || ''),
        cover_image: Boolean(bannerSource.cover_image),
      }, 0),
    ].filter((item) => item.url),
    cover_image: normalizeMediaUrl(
      bannerSource.cover_image ??
      bannerSource.image ??
      bannerSource.url ??
      detailData.cover_image ??
      detailData.banner_image ??
      ''
    ),
    image: normalizeMediaUrl(
      bannerSource.image ??
      bannerSource.url ??
      bannerSource.image_url ??
      bannerSource.imageUrl ??
      bannerSource.src ??
      detailData.banner_image ??
      detailData.bannerUrl ??
      detailData.image_url ??
      ''
    ),
    video: normalizeMediaUrl(
      bannerSource.video ??
      bannerSource.video_url ??
      bannerSource.videoUrl ??
      detailData.video_url ??
      detailData.videoUrl ??
      ''
    ),
  };

  const normalizedGallery = (detailData.gallery || []).map((item, index) => ({
    ...item,
    alt: item.alt || '',
    url: normalizeMediaUrl(item.url ?? item.image ?? item.image_url ?? item.imageUrl ?? item.src ?? ''),
    type: (item.type || item.media_type || getMediaTypeFromUrl(normalizeMediaUrl(item.url ?? item.image ?? item.image_url ?? item.imageUrl ?? item.src ?? ''), 'image')).toLowerCase(),
    display_order: item.display_order ?? index + 1,
  }));

  const normalizedDepartureDates = (detailData.departure_dates || []).map((item) => ({
    ...(item.id ? { id: item.id } : {}),
    departure_date: item.departure_date || item.date || '',
    return_date: item.return_date || '',
    total_seats: Number(item.total_seats) || 0,
    available_seats: Number(item.available_seats) || 0,
  }));

  return {
    banner: normalizedBanner,
    gallery: normalizedGallery,
    highlights: detailData.highlights || [],
    inclusions: detailData.inclusions || [],
    exclusions: detailData.exclusions || [],
    departure_dates: normalizedDepartureDates,
    itinerary: detailData.itinerary || [],
    route: detailData.route || [],
  };
};

const sections = [
  { key: 'banner', label: 'Banner', icon: ImageIcon },
  { key: 'gallery', label: 'Gallery', icon: Images },
  { key: 'highlights', label: 'Highlights', icon: Sparkles },
  { key: 'itinerary', label: 'Itinerary', icon: CalendarRange },
  { key: 'route', label: 'Route', icon: RouteIcon },
  { key: 'departures', label: 'Departures', icon: CalendarDays },
  { key: 'extras', label: 'Inclusions & Exclusions', icon: ListChecks },
];

const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200';
const addBtnClass = 'inline-flex items-center gap-1.5 rounded-2xl border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:border-orange-400 hover:text-orange-600 dark:border-gray-600 dark:text-gray-200';
const removeBtnClass = 'inline-flex items-center gap-1 rounded-xl border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300';
const editBtnClass = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-orange-900/50 dark:hover:bg-orange-900/20 dark:hover:text-orange-300';

const EmptyState = ({ text }) => (
  <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400 dark:border-gray-700">{text}</p>
);

const TourDetails = () => {
  // The route is /tour-packages/:packageId/variants/:variantId/details.
  // The API detail resource is keyed by the selected variant id, not the package id.
  const { packageId, variantId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const packageInfo = location.state?.package || null;
  const variantInfo = location.state?.variant || null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [details, setDetails] = useState(null);
  const [draft, setDraft] = useState(createEmptyDraft());
  const [savedDraft, setSavedDraft] = useState(null);

  const hasChanges = useMemo(() => {
    if (loading || !savedDraft) return false;
    return JSON.stringify(draft) !== JSON.stringify(savedDraft);
  }, [loading, draft, savedDraft]);
  const [activeSection, setActiveSection] = useState('banner');
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaModalContext, setMediaModalContext] = useState('banner');
  const [mediaForm, setMediaForm] = useState({ type: 'image', url: '', alt: '', cover_image: false });
  const [highlightModalOpen, setHighlightModalOpen] = useState(false);
  const [highlightForm, setHighlightForm] = useState({ text: '' });
  const [itineraryModalOpen, setItineraryModalOpen] = useState(false);
  const [itineraryForm, setItineraryForm] = useState({ day: 1, title: '', description: '' });
  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [routeForm, setRouteForm] = useState({ city: '', nights: 1 });
  const [extrasModalOpen, setExtrasModalOpen] = useState(false);
  const [extrasModalType, setExtrasModalType] = useState('inclusion');
  const [extrasForm, setExtrasForm] = useState({
    value: '',
    departure_date: '',
    return_date: '',
    total_seats: 20,
    available_seats: 20,
  });
  const [extrasCollapsed, setExtrasCollapsed] = useState({ inclusion: true, exclusion: true });
  const [editingItem, setEditingItem] = useState(null);
  const [editItemForm, setEditItemForm] = useState({});

  useEffect(() => {
    if (variantId) {
      loadDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantId]);

  const applyDetailToDraft = (detailData) => {
    const normalized = normalizeDetailData(detailData || {});
    const initial = {
      banner: normalized.banner,
      gallery: normalized.gallery,
      highlights: normalized.highlights,
      inclusions: normalized.inclusions,
      exclusions: normalized.exclusions,
      departure_dates: normalized.departure_dates,
      itinerary: normalized.itinerary,
      route: normalized.route,
    };
    setDraft(initial);
    setSavedDraft(JSON.parse(JSON.stringify(initial)));
  };

  const loadDetails = async () => {
    setLoading(true);
    try {
      let response;
      if (packageId && variantId) {
        response = await apiCall(`/api/v1/admin/tour-packages/${encodeURIComponent(packageId)}/variants/${encodeURIComponent(variantId)}`, 'GET');
        if (!response.ok && response.status !== 404) {
          // Fallback to tour-details endpoint
          response = await apiCall(`/api/v1/admin/tour-details/${variantId}`, 'GET');
        }
      } else {
        response = await apiCall(`/api/v1/admin/tour-details/${variantId}`, 'GET');
      }

      if (response.status === 404) {
        // No details created for this variant yet — that's a normal state,
        // not an error. Show an empty form ready for creation.
        setDetails(null);
        setNotFound(true);
        const empty = createEmptyDraft();
        setDraft(empty);
        setSavedDraft(JSON.parse(JSON.stringify(empty)));
        return;
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.detail || 'Unable to load tour details');
      }

      const detailData = payload?.data || null;
      setDetails(detailData);
      setNotFound(!detailData);
      applyDetailToDraft(detailData || {});
    } catch (error) {
      handleApiError(error, 'Unable to load tour details');
      setNotFound(true);
      const empty = createEmptyDraft();
      setDraft(empty);
      setSavedDraft(JSON.parse(JSON.stringify(empty)));
    } finally {
      setLoading(false);
    }
  };

  const buildPayload = () => {
    const bannerItems = (draft.banner?.items || []).map((item, index) => ({
      ...(item.id ? { id: item.id } : {}),
      url: item.url || '',
      type: item.type || 'image',
      cover_image: Boolean(item.cover_image),
      display_order: item.display_order ?? index + 1,
    }));
    const bannerImage = bannerItems.find((item) => item.type === 'image')?.url || '';
    const bannerVideo = bannerItems.find((item) => item.type === 'video')?.url || '';
    const bannerCoverImage = bannerItems.find((item) => item.cover_image)?.url || '';
    return {
      banner: {
        image: bannerImage,
        video: bannerVideo,
        cover_image: bannerCoverImage,
        items: bannerItems,
      },
      gallery: (draft.gallery || []).map((item, index) => ({
        ...(item.id ? { id: item.id } : {}),
        alt: item.alt || '',
        url: item.url || '',
        type: item.type || '',
        display_order: item.display_order ?? index + 1,
      })),
      highlights: (draft.highlights || []).map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        text: item.text || '',
      })),
      inclusions: draft.inclusions || [],
      exclusions: draft.exclusions || [],
      departure_dates: (draft.departure_dates || []).map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        departure_date: item.departure_date || item.date || '',
        return_date: item.return_date || '',
        total_seats: Number(item.total_seats) || 0,
        available_seats: Number(item.available_seats) || 0,
      })),
      itinerary: (draft.itinerary || []).map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        day: Number(item.day ?? item.day_number) || 1,
        title: item.title || '',
        description: item.description || '',
      })),
      route: (draft.route || []).map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        city: item.city || '',
        nights: Number(item.nights) || 1,
      })),
    };
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...buildPayload(), variant_id: variantId };
      const response = await apiCall('/api/v1/admin/tour-details', 'PUT', payload);

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.message || result?.detail || 'Unable to save tour details');
      }

      toast.success(result?.message || 'Tour details saved successfully');
      await loadDetails();
    } catch (error) {
      handleApiError(error, 'Unable to save tour details');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteDetails = async () => {
    setDeleting(true);
    try {
      const detailId = details?.id || variantId;
      const response = await apiCall(`/api/v1/admin/tour-details/${detailId}`, 'DELETE');
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.message || result?.detail || 'Unable to delete tour details');
      }
      toast.success(result?.message || 'Tour details deleted successfully');
      setIsDeleteModalOpen(false);
      setDetails(null);
      setNotFound(true);
      const empty = createEmptyDraft();
      setDraft(empty);
      setSavedDraft(JSON.parse(JSON.stringify(empty)));
    } catch (error) {
      handleApiError(error, 'Unable to delete tour details');
    } finally {
      setDeleting(false);
    }
  };

  const addArrayItem = (key, item = {}) => {
    setDraft((current) => ({
      ...current,
      [key]: [...(current[key] || []), item],
    }));
  };

  const removeArrayItem = (key, index) => {
    setDraft((current) => ({
      ...current,
      [key]: (current[key] || []).filter((_, idx) => idx !== index),
    }));
  };

  const openHighlightModal = () => {
    setHighlightForm({ text: '' });
    setHighlightModalOpen(true);
  };

  const submitHighlightModal = () => {
    const text = highlightForm.text.trim();
    if (!text) {
      toast.error('Please enter a highlight.');
      return;
    }
    addArrayItem('highlights', { text });
    setHighlightModalOpen(false);
    setHighlightForm({ text: '' });
  };

  const openItineraryModal = () => {
    setItineraryForm({
      day: (draft.itinerary || []).length + 1,
      title: '',
      description: '',
    });
    setItineraryModalOpen(true);
  };

  const setBannerItems = (items) => {
    setDraft((current) => ({
      ...current,
      banner: {
        ...current.banner,
        items,
        image: items.find((item) => item.type === 'image')?.url || '',
        video: items.find((item) => item.type === 'video')?.url || '',
        cover_image: items.find((item) => item.cover_image)?.url || '',
      },
    }));
  };

  const openItemEditor = (section, index, item) => {
    setEditingItem({ section, index });
    if (section === 'banner' || section === 'gallery') {
      setEditItemForm({
        type: item.type || 'image',
        url: item.url || '',
        ...(section === 'gallery' ? { alt: item.alt || '' } : {}),
        cover_image: Boolean(item.cover_image),
      });
    } else if (section === 'highlights') {
      setEditItemForm({ text: item.text || '' });
    } else if (section === 'itinerary') {
      setEditItemForm({ day: item.day || item.day_number || index + 1, title: item.title || '', description: item.description || '' });
    } else if (section === 'route') {
      setEditItemForm({ city: item.city || '', nights: item.nights ?? 1 });
    } else if (section === 'departure_dates') {
      setEditItemForm({
        departure_date: item.departure_date || item.date || '',
        return_date: item.return_date || '',
        total_seats: item.total_seats ?? 0,
        available_seats: item.available_seats ?? 0,
      });
    } else {
      setEditItemForm({ value: item || '' });
    }
  };

  const saveEditedItem = () => {
    if (!editingItem) return;
    const { section, index } = editingItem;
    if ((section === 'banner' || section === 'gallery') && !editItemForm.url?.trim()) {
      toast.error('Please choose a media file first.');
      return;
    }
    if (section === 'itinerary' && !editItemForm.title?.trim()) {
      toast.error('Please enter an itinerary title.');
      return;
    }
    if (section === 'route' && !editItemForm.city?.trim()) {
      toast.error('Please enter a city name.');
      return;
    }
    if (section === 'departure_dates' && !editItemForm.departure_date) {
      toast.error('Please select a departure date.');
      return;
    }
    if ((section === 'inclusions' || section === 'exclusions') && !editItemForm.value?.trim()) {
      toast.error('Please enter a value.');
      return;
    }

    if (section === 'banner' || section === 'gallery') {
      const items = [...(section === 'banner' ? draft.banner?.items || [] : draft.gallery || [])];
      items[index] = { ...items[index], ...editItemForm };
      if (section === 'banner') setBannerItems(items);
      else setDraft((current) => ({ ...current, gallery: items }));
    } else if (section === 'inclusions' || section === 'exclusions') {
      setDraft((current) => ({
        ...current,
        [section]: (current[section] || []).map((item, itemIndex) => itemIndex === index ? editItemForm.value.trim() : item),
      }));
    } else {
      const item = section === 'highlights'
        ? { ...draft.highlights[index], text: editItemForm.text || '' }
        : section === 'itinerary'
          ? { ...draft.itinerary[index], day: Number(editItemForm.day) || index + 1, title: editItemForm.title.trim(), description: editItemForm.description || '' }
          : section === 'route'
            ? { ...draft.route[index], city: editItemForm.city.trim(), nights: Number(editItemForm.nights) || 1 }
            : {
                ...draft.departure_dates[index],
                departure_date: editItemForm.departure_date,
                return_date: editItemForm.return_date || '',
                total_seats: Number(editItemForm.total_seats) || 0,
                available_seats: Number(editItemForm.available_seats) || 0,
              };
      setDraft((current) => ({
        ...current,
        [section]: (current[section] || []).map((currentItem, itemIndex) => itemIndex === index ? item : currentItem),
      }));
    }
    setEditingItem(null);
  };

  const openMediaModal = (context) => {
    setMediaModalContext(context);
    setMediaForm({ type: 'image', url: '', alt: '', cover_image: false });
    setMediaModalOpen(true);
  };

  const submitMediaModal = () => {
    if (!mediaForm.url) {
      toast.error('Please choose a media file first.');
      return;
    }

    const payloadItem = {
      url: mediaForm.url,
      type: mediaForm.type,
      alt: mediaForm.alt || '',
      cover_image: Boolean(mediaForm.cover_image),
      display_order: ((mediaModalContext === 'banner' ? draft.banner?.items : draft.gallery) || []).length + 1,
    };

    if (mediaModalContext === 'banner') {
      setDraft((current) => ({
        ...current,
        banner: {
          ...current.banner,
          image: mediaForm.type === 'image' ? mediaForm.url : current.banner?.image || '',
          video: mediaForm.type === 'video' ? mediaForm.url : current.banner?.video || '',
          items: [...(current.banner?.items || []), payloadItem],
        },
      }));
    } else {
      setDraft((current) => ({
        ...current,
        gallery: [...(current.gallery || []), { ...payloadItem, display_order: (current.gallery || []).length + 1 }],
      }));
    }

    setMediaModalOpen(false);
    setMediaForm({ type: 'image', url: '', alt: '', cover_image: false });
  };

  const submitItineraryModal = () => {
    if (!itineraryForm.title.trim()) {
      toast.error('Please enter an itinerary title.');
      return;
    }

    const newItem = {
      day: Number(itineraryForm.day) || 1,
      title: itineraryForm.title.trim(),
      description: itineraryForm.description.trim(),
    };

    setDraft((current) => ({
      ...current,
      itinerary: [...(current.itinerary || []), newItem],
    }));

    setItineraryModalOpen(false);
    setItineraryForm({ day: (draft.itinerary || []).length + 1, title: '', description: '' });
  };

  const submitRouteModal = () => {
    if (!routeForm.city.trim()) {
      toast.error('Please enter a city name.');
      return;
    }

    const newItem = {
      city: routeForm.city.trim(),
      nights: Number(routeForm.nights) || 1,
    };

    setDraft((current) => ({
      ...current,
      route: [...(current.route || []), newItem],
    }));

    setRouteModalOpen(false);
    setRouteForm({ city: '', nights: 1 });
  };

  const openExtrasModal = (type) => {
    setExtrasModalType(type);
    setExtrasForm({
      value: '',
      departure_date: '',
      return_date: '',
      total_seats: 20,
      available_seats: 20,
    });
    setExtrasModalOpen(true);
  };

  const submitExtrasModal = () => {
    if (extrasModalType === 'departure_date') {
      if (!extrasForm.departure_date) {
        toast.error('Please select a departure date.');
        return;
      }

      const newDateItem = {
        departure_date: extrasForm.departure_date,
        return_date: extrasForm.return_date || '',
        total_seats: Number(extrasForm.total_seats) || 0,
        available_seats: Number(extrasForm.available_seats) || 0,
      };

      setDraft((current) => ({
        ...current,
        departure_dates: [...(current.departure_dates || []), newDateItem],
      }));
    } else if (!extrasForm.value.trim()) {
      toast.error(extrasModalType === 'inclusion' ? 'Please enter an inclusion.' : 'Please enter an exclusion.');
      return;
    } else if (extrasModalType === 'inclusion') {
      setDraft((current) => ({
        ...current,
        inclusions: [...(current.inclusions || []), extrasForm.value.trim()],
      }));
      setExtrasCollapsed((current) => ({ ...current, inclusion: false }));
    } else {
      setDraft((current) => ({
        ...current,
        exclusions: [...(current.exclusions || []), extrasForm.value.trim()],
      }));
      setExtrasCollapsed((current) => ({ ...current, exclusion: false }));
    }

    setExtrasModalOpen(false);
    setExtrasForm({
      value: '',
      departure_date: '',
      return_date: '',
      total_seats: 20,
      available_seats: 20,
    });
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'banner': {
        const bannerItems = draft.banner?.items || [];
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">Media list</p>
              <button type="button" onClick={() => openMediaModal('banner')} className={addBtnClass}>
                <Plus className="h-4 w-4" /> Add media
              </button>
            </div>

            {bannerItems.length === 0 && <EmptyState text="No banner media yet." />}

            {bannerItems.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-[110px_minmax(0,1fr)_88px] gap-3 border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  <span>Type</span>
                  <span>Media</span>
                  <span className="text-right">Action</span>
                </div>

                {bannerItems.map((item, index) => (
                  <div key={item.id || index} className="grid grid-cols-[110px_minmax(0,1fr)_88px] items-center gap-3 border-b border-gray-200 px-3 py-3 last:border-b-0 dark:border-gray-700">
                    <span className="text-sm font-medium capitalize text-gray-700 dark:text-gray-200">{item.type || 'image'}</span>
                    <div className="flex min-w-0 items-center gap-3">
                      <MediaPreviewModal
                        src={item.url}
                        alt={item.alt || 'Banner media'}
                        type={item.type || 'image'}
                        thumbnailClassName="h-12 w-20 rounded-lg object-cover"
                        className="block shrink-0"
                      />
                      <span className="truncate text-xs text-gray-500 dark:text-gray-400">{item.url}</span>
                    </div>
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => openItemEditor('banner', index, item)} className={editBtnClass} title="Edit banner media" aria-label="Edit banner media">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setBannerItems(bannerItems.filter((_, idx) => idx !== index))}
                        className={removeBtnClass}
                        title="Remove banner media"
                        aria-label="Remove banner media"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      case 'gallery': {
        const galleryItems = draft.gallery || [];
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">Media list</p>
              <button type="button" onClick={() => openMediaModal('gallery')} className={addBtnClass}>
                <Plus className="h-4 w-4" /> Add media
              </button>
            </div>

            {galleryItems.length === 0 && <EmptyState text="No gallery media yet." />}

            {galleryItems.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-[110px_minmax(0,1fr)_88px] gap-3 border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  <span>Type</span>
                  <span>Media</span>
                  <span className="text-right">Action</span>
                </div>

                {galleryItems.map((item, index) => (
                  <div key={item.id || index} className="grid grid-cols-[110px_minmax(0,1fr)_88px] items-center gap-3 border-b border-gray-200 px-3 py-3 last:border-b-0 dark:border-gray-700">
                    <span className="text-sm font-medium capitalize text-gray-700 dark:text-gray-200">{item.type || 'image'}</span>
                    <div className="flex min-w-0 items-center gap-3">
                      <MediaPreviewModal
                        src={item.url}
                        alt={item.alt || 'Gallery media'}
                        type={item.type || 'image'}
                        thumbnailClassName="h-12 w-20 rounded-lg object-cover"
                        className="block shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-200">{item.alt || 'Untitled'}</p>
                        <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{item.url}</p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => openItemEditor('gallery', index, item)} className={editBtnClass} title="Edit gallery media" aria-label="Edit gallery media">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => removeArrayItem('gallery', index)} className={removeBtnClass}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      case 'highlights':
        return (
          <div className="space-y-3">
            {(draft.highlights || []).length === 0 && <EmptyState text="No highlights yet." />}
            {(draft.highlights || []).map((item, index) => (
              <div key={item.id || index} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-700">
                <p className="min-w-0 flex-1 text-sm text-gray-700 dark:text-gray-200">{item.text || 'Untitled highlight'}</p>
                <button type="button" onClick={() => openItemEditor('highlights', index, item)} className={editBtnClass} title="Edit highlight" aria-label="Edit highlight">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => removeArrayItem('highlights', index)} className={removeBtnClass} title="Remove highlight" aria-label="Remove highlight">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button type="button" onClick={openHighlightModal} className={addBtnClass}>
              <Plus className="h-4 w-4" /> Add highlight
            </button>
          </div>
        );

      case 'itinerary': {
        const itineraryItems = draft.itinerary || [];
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">Itinerary list</p>
              <button type="button" onClick={openItineraryModal} className={addBtnClass}>
                <Plus className="h-4 w-4" /> Add itinerary day
              </button>
            </div>

            {itineraryItems.length === 0 && <EmptyState text="No itinerary days yet." />}

            {itineraryItems.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-[90px_minmax(0,1.1fr)_minmax(0,1.5fr)_88px] gap-3 border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  <span>Day</span>
                  <span>Title</span>
                  <span>Description</span>
                  <span className="text-right">Action</span>
                </div>

                {itineraryItems.map((item, index) => (
                  <div key={item.id || index} className="grid grid-cols-[90px_minmax(0,1.1fr)_minmax(0,1.5fr)_88px] items-start gap-3 border-b border-gray-200 px-3 py-3 last:border-b-0 dark:border-gray-700">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Day {item.day || index + 1}</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{item.title || 'Untitled'}</span>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{item.description || 'No description provided.'}</p>
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => openItemEditor('itinerary', index, item)} className={editBtnClass} title="Edit itinerary day" aria-label="Edit itinerary day">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => removeArrayItem('itinerary', index)} className={removeBtnClass}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      case 'route':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">Route segments</p>
              <button type="button" onClick={() => setRouteModalOpen(true)} className={addBtnClass}>
                <Plus className="h-4 w-4" /> Add route segment
              </button>
            </div>

            {(draft.route || []).length === 0 && <EmptyState text="No route segments yet." />}

            {(draft.route || []).length > 0 && (
              <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-[minmax(0,1.2fr)_110px_88px] gap-3 border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  <span>City</span>
                  <span>Nights</span>
                  <span className="text-right">Action</span>
                </div>

                {(draft.route || []).map((item, index) => (
                  <div key={item.id || index} className="grid grid-cols-[minmax(0,1.2fr)_110px_88px] items-center gap-3 border-b border-gray-200 px-3 py-3 last:border-b-0 dark:border-gray-700">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{item.city || 'Untitled city'}</span>
                    <span className="text-sm text-gray-600 dark:text-gray-300">{item.nights || 0} nights</span>
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => openItemEditor('route', index, item)} className={editBtnClass} title="Edit route segment" aria-label="Edit route segment">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => removeArrayItem('route', index)} className={removeBtnClass}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'departures':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">Departure & Return Schedule</p>
                <p className="text-xs text-gray-400 mt-0.5">Manage batch departure dates, return dates, and seat availability.</p>
              </div>
              <button type="button" onClick={() => openExtrasModal('departure_date')} className={addBtnClass}>
                <Plus className="h-4 w-4" /> Add departure date
              </button>
            </div>

            {(draft.departure_dates || []).length === 0 && <EmptyState text="No departure dates added yet." />}

            {(draft.departure_dates || []).length > 0 && (
              <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_100px_110px_88px] gap-3 border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  <span>Departure Date</span>
                  <span>Return Date</span>
                  <span>Total Seats</span>
                  <span>Available</span>
                  <span className="text-right">Action</span>
                </div>

                {(draft.departure_dates || []).map((item, index) => (
                  <div key={item.id || index} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_100px_110px_88px] items-center gap-3 border-b border-gray-200 px-3 py-3 last:border-b-0 dark:border-gray-700 text-sm">
                    <span className="font-medium text-gray-800 dark:text-gray-200">{item.departure_date || item.date || 'N/A'}</span>
                    <span className="text-gray-600 dark:text-gray-400">{item.return_date || '—'}</span>
                    <span className="text-gray-700 dark:text-gray-300">{item.total_seats ?? 0}</span>
                    <span className="inline-flex w-fit rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      {item.available_seats ?? 0}
                    </span>
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => openItemEditor('departure_dates', index, item)} className={editBtnClass} title="Edit departure date" aria-label="Edit departure date">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => removeArrayItem('departure_dates', index)} className={removeBtnClass}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'extras':
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/60">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExtrasCollapsed((current) => ({ ...current, inclusion: !current.inclusion }))}
                    className="inline-flex items-center justify-center rounded-lg p-1 text-gray-500 transition hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
                    aria-label={extrasCollapsed.inclusion ? 'Expand inclusions' : 'Collapse inclusions'}
                  >
                    {extrasCollapsed.inclusion ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">
                    Inclusions <span className="ml-1 text-gray-400">({(draft.inclusions || []).length})</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => openExtrasModal('inclusion')} className={addBtnClass}>
                    <Plus className="h-4 w-4" /> Add inclusion
                  </button>
                </div>
              </div>

              {!extrasCollapsed.inclusion && (
                <>
                  {(draft.inclusions || []).length === 0 && <EmptyState text="No inclusions yet." />}

                  {(draft.inclusions || []).length > 0 && (
                    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-3 border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                        <span>Item</span>
                        <span className="text-right">Action</span>
                      </div>

                      {(draft.inclusions || []).map((item, index) => (
                        <div key={`${item}-${index}`} className="grid grid-cols-[minmax(0,1fr)_88px] items-center gap-3 border-b border-gray-200 px-3 py-3 last:border-b-0 dark:border-gray-700">
                          <span className="text-sm text-gray-700 dark:text-gray-200">{item}</span>
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => openItemEditor('inclusions', index, item)} className={editBtnClass} title="Edit inclusion" aria-label="Edit inclusion">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => removeArrayItem('inclusions', index)} className={removeBtnClass} title="Remove inclusion" aria-label="Remove inclusion">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/60">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExtrasCollapsed((current) => ({ ...current, exclusion: !current.exclusion }))}
                    className="inline-flex items-center justify-center rounded-lg p-1 text-gray-500 transition hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
                    aria-label={extrasCollapsed.exclusion ? 'Expand exclusions' : 'Collapse exclusions'}
                  >
                    {extrasCollapsed.exclusion ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">
                    Exclusions <span className="ml-1 text-gray-400">({(draft.exclusions || []).length})</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => openExtrasModal('exclusion')} className={addBtnClass}>
                    <Plus className="h-4 w-4" /> Add exclusion
                  </button>
                </div>
              </div>

              {!extrasCollapsed.exclusion && (
                <>
                  {(draft.exclusions || []).length === 0 && <EmptyState text="No exclusions yet." />}

                  {(draft.exclusions || []).length > 0 && (
                    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-3 border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                        <span>Item</span>
                        <span className="text-right">Action</span>
                      </div>

                      {(draft.exclusions || []).map((item, index) => (
                        <div key={`${item}-${index}`} className="grid grid-cols-[minmax(0,1fr)_88px] items-center gap-3 border-b border-gray-200 px-3 py-3 last:border-b-0 dark:border-gray-700">
                          <span className="text-sm text-gray-700 dark:text-gray-200">{item}</span>
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => openItemEditor('exclusions', index, item)} className={editBtnClass} title="Edit exclusion" aria-label="Edit exclusion">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => removeArrayItem('exclusions', index)} className={removeBtnClass} title="Remove exclusion" aria-label="Remove exclusion">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!variantId) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center text-sm text-gray-500 dark:border-gray-700">
        No tour variant selected. Go back to the package variants page and click a row to open its details.
      </div>
    );
  }

  const headerTitle = variantInfo?.name || packageInfo?.title || 'Tour details';
  const headerSubtitle = [packageInfo?.tour_code, packageInfo?.destination, variantInfo?.season_name].filter(Boolean).join(' • ') || variantId;

  return (
    <div className="space-y-3 pb-6">
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!deleting) setIsDeleteModalOpen(false);
        }}
        onConfirm={confirmDeleteDetails}
        confirming={deleting}
        itemLabel="these tour details"
        title="Delete tour details"
        message="This will permanently remove the selected variant details."
      />

      <Modal
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title={`Edit ${editingItem?.section === 'banner' ? 'banner media' : editingItem?.section === 'gallery' ? 'gallery media' : editingItem?.section === 'highlights' ? 'highlight' : editingItem?.section === 'itinerary' ? 'itinerary day' : editingItem?.section === 'route' ? 'route segment' : editingItem?.section === 'departure_dates' ? 'departure date' : editingItem?.section === 'inclusions' ? 'inclusion' : 'exclusion'}`}
        icon={Pencil}
        size="lg"
        confirmText="Save item"
        onConfirm={saveEditedItem}
      >
        <div className="space-y-4 p-4">
          {(editingItem?.section === 'banner' || editingItem?.section === 'gallery') && (
            <>
              <div className={`grid gap-4 ${editingItem?.section === 'gallery' ? 'md:grid-cols-2' : ''}`}>
                <SelectField
                  options={[{ value: 'image', label: 'Image' }, { value: 'video', label: 'Video' }]}
                  value={{ value: editItemForm.type || 'image', label: editItemForm.type === 'video' ? 'Video' : 'Image' }}
                  onChange={(selected) => setEditItemForm((current) => ({ ...current, type: selected?.value || 'image' }))}
                  isSearchable={false}
                  menuPlacement="bottom"
                />
                {editingItem?.section === 'gallery' && (
                  <input value={editItemForm.alt || ''} onChange={(event) => setEditItemForm((current) => ({ ...current, alt: event.target.value }))} placeholder="Media title" className={inputClass} />
                )}
              </div>
              <DragDropUpload
                label="Media file"
                value={editItemForm.url || ''}
                accept="image/*,video/*"
                onChange={(url) => setEditItemForm((current) => ({ ...current, url }))}
                helperText="Upload image or video file"
              />
            </>
          )}
          {editingItem?.section === 'highlights' && (
            <textarea value={editItemForm.text || ''} onChange={(event) => setEditItemForm((current) => ({ ...current, text: event.target.value }))} rows={3} placeholder="Highlight text" className={inputClass} />
          )}
          {editingItem?.section === 'itinerary' && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <input type="number" min="1" value={editItemForm.day || ''} onChange={(event) => setEditItemForm((current) => ({ ...current, day: event.target.value }))} placeholder="Day" className={inputClass} />
                <input value={editItemForm.title || ''} onChange={(event) => setEditItemForm((current) => ({ ...current, title: event.target.value }))} placeholder="Title" className={inputClass} />
              </div>
              <textarea value={editItemForm.description || ''} onChange={(event) => setEditItemForm((current) => ({ ...current, description: event.target.value }))} rows={4} placeholder="Description" className={inputClass} />
            </>
          )}
          {editingItem?.section === 'route' && (
            <div className="grid gap-4 md:grid-cols-2">
              <input value={editItemForm.city || ''} onChange={(event) => setEditItemForm((current) => ({ ...current, city: event.target.value }))} placeholder="City name" className={inputClass} />
              <input type="number" min="1" value={editItemForm.nights ?? 1} onChange={(event) => setEditItemForm((current) => ({ ...current, nights: event.target.value }))} placeholder="Nights" className={inputClass} />
            </div>
          )}
          {editingItem?.section === 'departure_dates' && (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-xs font-medium text-gray-600 dark:text-gray-300">Departure date<input type="date" value={editItemForm.departure_date || ''} onChange={(event) => setEditItemForm((current) => ({ ...current, departure_date: event.target.value }))} className={inputClass} /></label>
              <label className="space-y-1 text-xs font-medium text-gray-600 dark:text-gray-300">Return date<input type="date" value={editItemForm.return_date || ''} onChange={(event) => setEditItemForm((current) => ({ ...current, return_date: event.target.value }))} className={inputClass} /></label>
              <label className="space-y-1 text-xs font-medium text-gray-600 dark:text-gray-300">Total seats<input type="number" min="0" value={editItemForm.total_seats ?? 0} onChange={(event) => setEditItemForm((current) => ({ ...current, total_seats: event.target.value }))} className={inputClass} /></label>
              <label className="space-y-1 text-xs font-medium text-gray-600 dark:text-gray-300">Available seats<input type="number" min="0" value={editItemForm.available_seats ?? 0} onChange={(event) => setEditItemForm((current) => ({ ...current, available_seats: event.target.value }))} className={inputClass} /></label>
            </div>
          )}
          {(editingItem?.section === 'inclusions' || editingItem?.section === 'exclusions') && (
            <input value={editItemForm.value || ''} onChange={(event) => setEditItemForm((current) => ({ ...current, value: event.target.value }))} placeholder="Item text" className={inputClass} />
          )}
        </div>
      </Modal>

      <Modal
        isOpen={highlightModalOpen}
        onClose={() => setHighlightModalOpen(false)}
        title="Add highlight"
        icon={Sparkles}
        size="md"
        confirmText="Add highlight"
        onConfirm={submitHighlightModal}
      >
        <div className="space-y-2 p-4">
          <label htmlFor="new-highlight-text" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Highlight text
          </label>
          <textarea
            id="new-highlight-text"
            autoFocus
            value={highlightForm.text}
            onChange={(event) => setHighlightForm({ text: event.target.value })}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') submitHighlightModal();
            }}
            rows={3}
            maxLength={500}
            placeholder="Enter a tour highlight"
            className={inputClass}
          />
        </div>
      </Modal>

      <Modal
        isOpen={mediaModalOpen}
        onClose={() => setMediaModalOpen(false)}
        title={mediaModalContext === 'banner' ? 'Add banner media' : 'Add gallery media'}
        size="lg"
        confirmText="Add item"
        onConfirm={submitMediaModal}
      >
        <div className="space-y-4 p-4">
          <div className={`grid gap-4 ${mediaModalContext === 'gallery' ? 'md:grid-cols-2' : ''}`}>
            <SelectField
              options={[
                { value: 'image', label: 'Image' },
                { value: 'video', label: 'Video' },
              ]}
              value={{ value: mediaForm.type, label: mediaForm.type === 'video' ? 'Video' : 'Image' }}
              onChange={(selected) => setMediaForm((current) => ({ ...current, type: selected?.value || 'image' }))}
              isSearchable={false}
              menuPlacement="bottom"
              classNamePrefix="react-select"
            />
            {mediaModalContext === 'gallery' && (
              <input
                value={mediaForm.alt}
                onChange={(event) => setMediaForm((current) => ({ ...current, alt: event.target.value }))}
                placeholder="Media title"
                className={inputClass}
              />
            )}
          </div>

          <DragDropUpload
            label={mediaModalContext === 'banner' ? 'Banner media file' : 'Gallery media file'}
            value={mediaForm.url}
            accept="image/*,video/*"
            onChange={(url) => setMediaForm((current) => ({ ...current, url }))}
            helperText="Upload image or video file"
          />
        </div>
      </Modal>

      <Modal
        isOpen={itineraryModalOpen}
        onClose={() => setItineraryModalOpen(false)}
        title="Add itinerary day"
        size="lg"
        confirmText="Add day"
        onConfirm={submitItineraryModal}
      >
        <div className="space-y-4 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <input
              type="text"
              inputMode="numeric"
              min={1}
              value={itineraryForm.day}
              onChange={(event) => setItineraryForm((current) => ({ ...current, day: sanitizeNumericInput(event.target.value) }))}
              placeholder="Day"
              className={inputClass}
            />
            <input
              value={itineraryForm.title}
              onChange={(event) => setItineraryForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Title"
              className={inputClass}
            />
          </div>
          <textarea
            value={itineraryForm.description}
            onChange={(event) => setItineraryForm((current) => ({ ...current, description: event.target.value }))}
            rows={5}
            placeholder="Description"
            className={inputClass}
          />
        </div>
      </Modal>

      <Modal
        isOpen={routeModalOpen}
        onClose={() => setRouteModalOpen(false)}
        title="Add route segment"
        size="md"
        confirmText="Add segment"
        onConfirm={submitRouteModal}
      >
        <div className="space-y-4 p-4">
          <input
            value={routeForm.city}
            onChange={(event) => setRouteForm((current) => ({ ...current, city: event.target.value }))}
            placeholder="City name"
            className={inputClass}
          />
          <input
            type="text"
            inputMode="numeric"
            min={0}
            value={routeForm.nights}
            onChange={(event) => setRouteForm((current) => ({ ...current, nights: sanitizeNumericInput(event.target.value) }))}
            placeholder="Nights"
            className={inputClass}
          />
        </div>
      </Modal>

      <Modal
        isOpen={extrasModalOpen}
        onClose={() => setExtrasModalOpen(false)}
        title={extrasModalType === 'inclusion' ? 'Add inclusion' : extrasModalType === 'exclusion' ? 'Add exclusion' : 'Add departure date'}
        size="md"
        confirmText={extrasModalType === 'departure_date' ? 'Add date' : 'Add item'}
        onConfirm={submitExtrasModal}
      >
        <div className="space-y-4 p-4">
          {extrasModalType === 'departure_date' ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Departure date *</label>
                  <CustomDatePicker
                    value={extrasForm.departure_date}
                    includeTime={false}
                    onChange={(value) => setExtrasForm((current) => ({ ...current, departure_date: value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Return date (optional)</label>
                  <CustomDatePicker
                    value={extrasForm.return_date}
                    includeTime={false}
                    onChange={(value) => setExtrasForm((current) => ({ ...current, return_date: value }))}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Total seats *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={extrasForm.total_seats}
                    onChange={(event) => setExtrasForm((current) => ({ ...current, total_seats: sanitizeNumericInput(event.target.value) }))}
                    className={inputClass}
                    placeholder="e.g. 20"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Available seats *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={extrasForm.available_seats}
                    onChange={(event) => setExtrasForm((current) => ({ ...current, available_seats: sanitizeNumericInput(event.target.value) }))}
                    className={inputClass}
                    placeholder="e.g. 20"
                    required
                  />
                </div>
              </div>
            </div>
          ) : (
            <input
              value={extrasForm.value}
              onChange={(event) => setExtrasForm((current) => ({ ...current, value: event.target.value }))}
              placeholder={extrasModalType === 'inclusion' ? 'Enter inclusion' : 'Enter exclusion'}
              className={inputClass}
            />
          )}
        </div>
      </Modal>

      <div className="px-2 text-slate-900 dark:text-slate-100">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => navigate(packageId ? `/tour-packages/${encodeURIComponent(packageId)}/variants` : '/tour-packages', { state: packageInfo ? { package: packageInfo } : undefined })}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to tour packages</span>
            </button>

            <div>
              <h1 className="mt-1 bg-gradient-to-r from-slate-900 via-violet-700 to-indigo-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent dark:from-slate-100 dark:via-violet-300 dark:to-indigo-300 md:text-3xl">{headerTitle}</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{headerSubtitle}</p>
            </div>
          </div>

          <span
            className={[
              'inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
              notFound ? 'border-slate-300 bg-slate-200 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200' : 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
            ].join(' ')}
          >
            {notFound ? 'Not created yet' : 'Details saved'}
          </span>
        </div>
      </div>

      <div className="space-y-3 mx-4">
        <div className="mt-5">
          <div
            role="tablist"
            className="overflow-x-scroll flex items-center"
          >
            {sections.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeSection === key}
                onClick={() => setActiveSection(key)}
                aria-label={label}
                title={label}
                className={[
                  'flex shrink-0 items-center gap-2 rounded-xl px-2.5 py-2.5 text-left text-sm font-medium transition sm:px-3',
                  activeSection === key
                    ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-500'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800',
                ].join(' ')}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {sections.find((section) => section.key === activeSection)?.label} settings
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {!notFound && (
                <button
                  type="button"
                  onClick={() => details && applyDetailToDraft(details)}
                  disabled={!hasChanges || saving}
                  aria-label="Reset changes"
                  title="Reset changes"
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:disabled:hover:bg-gray-800 sm:px-3"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              )}
              {!notFound && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  aria-label="Delete details"
                  title="Delete details"
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
                >
                  <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">{deleting ? 'Deleting...' : 'Delete'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !hasChanges}
                aria-label={notFound ? 'Create details' : 'Save changes'}
                title={notFound ? 'Create details' : 'Save changes'}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-orange-600"
              >
                <Save className="h-4 w-4" /> <span className="hidden sm:inline">{saving ? 'Saving...' : notFound ? 'Create details' : 'Save changes'}</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading details...</div>
          ) : (
            <>
              {notFound && (
                <div className="mb-5 rounded-xl border border-dashed border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-700 dark:border-orange-900/40 dark:bg-orange-900/10 dark:text-orange-300">
                  No details exist for this package yet. Fill in the sections below and click "Create details" to publish them.
                </div>
              )}
              {renderSection()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TourDetails;