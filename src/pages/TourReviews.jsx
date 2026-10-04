import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Star,
  Route,
  RefreshCw,
  MessageSquare,
  User,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Search,
  Filter,
  X,
  Images,
  ZoomIn,
} from 'lucide-react';
import Modal from '../component/common/Modal';
import ConfirmDeleteModal from '../component/common/ConfirmDeleteModal';
import ManagementTable from '../component/common/ManagementTable';
import MediaPreviewModal from '../component/common/MediaPreviewModal';
import MediaViewerModal from '../component/common/MediaViewerModal';
import ModalScrollLock from '../component/common/ModalScrollLock';
import DragDropUpload from '../component/common/DragDropUpload';
import Pagination from '../component/common/PaginationComponent';
import SelectField from '../component/common/SelectField';
import { sanitizeNumericInput } from '../utils/inputValidation';
import { apiCall, handleApiError } from '../utils/apiCall';

const defaultReviewForm = {
  reviewer_type: 'customer',
  name: '',
  rating: 5,
  review: '',
  review_gallery: [],
  is_published: true,
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
  }
};

const getGalleryMediaUrl = (media) =>
  typeof media === 'string' ? media : media?.url || '';

const isGalleryVideo = (media) => {
  const url = getGalleryMediaUrl(media).toLowerCase();
  const type = typeof media === 'object' ? media?.type?.toLowerCase() : '';
  return type === 'video'
    || /\.(mp4|mov|webm|ogg)(?:[?#]|$)/i.test(url)
    || url.includes('/video/upload')
    || url.includes('/video/');
};

const StarRating = ({ rating, max = 5 }) => {
  const r = Math.round(Number(rating) || 0);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < r ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
        />
      ))}
      <span className="ml-1 text-xs font-semibold text-gray-700 dark:text-gray-300">{r}/{max}</span>
    </div>
  );
};

const StarPicker = ({ value, onChange }) => (
  <div className="flex items-center gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        onClick={() => onChange(n)}
        className="transition hover:scale-110"
      >
        <Star className={`h-6 w-6 ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'}`} />
      </button>
    ))}
    <span className="ml-2 text-sm font-semibold text-gray-700 dark:text-gray-300">{value} / 5</span>
  </div>
);

const TourReviews = () => {
  const navigate = useNavigate();
  const { packageId } = useParams();
  const location = useLocation();
  const packageInfo = location.state?.package || null;

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [isDeleteReviewModalOpen, setIsDeleteReviewModalOpen] = useState(false);
  const [deleteReviewTarget, setDeleteReviewTarget] = useState(null);
  const [deletingReview, setDeletingReview] = useState(false);

  /* Modal state */
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [formState, setFormState] = useState(defaultReviewForm);
  const [customerOptions, setCustomerOptions] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [customerPage, setCustomerPage] = useState(1);
  const [customerHasMore, setCustomerHasMore] = useState(true);

  /* Gallery modal state */
  const [galleryModal, setGalleryModal] = useState({ open: false, images: [], reviewerName: '' });
  const [viewerModal, setViewerModal] = useState({ open: false, image: null });

  /* Fetch reviews */
  const loadReviews = useCallback(async (page = currentPage, limit = itemsPerPage) => {
    if (!packageId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, page_size: limit });
      const response = await apiCall(
        `/api/v1/admin/tour-packages/${encodeURIComponent(packageId)}/reviews?${params.toString()}`,
        'GET'
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || payload?.detail || 'Unable to fetch reviews');
      const data = Array.isArray(payload?.data) ? payload.data : [];
      setReviews(data);
      setTotalItems(payload?.pagination?.total_items ?? data.length);
    } catch (error) {
      handleApiError(error, 'Unable to fetch reviews');
    } finally {
      setLoading(false);
    }
  }, [packageId, currentPage, itemsPerPage]);

  useEffect(() => {
    loadReviews(currentPage, itemsPerPage);
  }, [loadReviews, currentPage, itemsPerPage]);

  const loadCustomers = useCallback(async (page = 1, append = false) => {
    if (customersLoading) return;
    setCustomersLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '20' });
      const response = await apiCall(`/api/v1/admin/customers?${params.toString()}`, 'GET');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.detail || 'Unable to fetch customers');
      }

      const data = Array.isArray(payload?.data) ? payload.data : [];
      const options = data.map((customer) => ({
        value: customer.id,
        label: [customer.name || customer.full_name, customer.mobile || customer.phone].filter(Boolean).join(' · ') || customer.id,
        customer,
      }));
      setCustomerOptions((current) => (append ? [...current, ...options] : options));
      setCustomerPage(Number(payload?.pagination?.current_page) || page);
      setCustomerHasMore(Boolean(payload?.pagination?.has_next));
      setCustomersLoaded(true);
    } catch (error) {
      handleApiError(error, 'Unable to load customers');
    } finally {
      setCustomersLoading(false);
    }
  }, [customersLoading]);

  const handleCustomerMenuOpen = () => {
    if (!customersLoaded && !customersLoading) loadCustomers(1);
  };

  const handleCustomerMenuScrollToBottom = () => {
    if (customerHasMore && !customersLoading) loadCustomers(customerPage + 1, true);
  };

  /* Open create modal */
  const openCreateModal = () => {
    setEditingReview(null);
    setFormState(defaultReviewForm);
    setSelectedCustomer(null);
    setIsModalOpen(true);
  };

  /* Open edit modal */
  const openEditModal = (review) => {
    setEditingReview(review);
    const matchingCustomer = customerOptions.find((option) => option.value === review.customer_id);
    setSelectedCustomer(matchingCustomer || (review.customer_id ? {
      value: review.customer_id,
      label: review.name || review.customer_id,
      customer: {
        id: review.customer_id,
        name: review.name || '',
        profile_pic: review.customer_profile_picture || '',
      },
    } : null));
    setFormState({
      reviewer_type: review.customer_id ? 'customer' : 'named',
      name: review.name || review.customer_name || '',
      customer_id: review.customer_id || '',
      rating: Number(review.rating) || 5,
      review: review.review || '',
      review_gallery: Array.isArray(review.review_gallery)
        ? review.review_gallery.map((g, idx) => ({
            id: g.id || '',
            alt: g.alt || '',
            url: typeof g === 'string' ? g : g.url || '',
            type: g.type || 'image',
            display_order: g.display_order ?? idx + 1,
          }))
        : [],
      is_published: review.is_published !== false,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingReview(null);
    setFormState(defaultReviewForm);
    setSelectedCustomer(null);
  };

  /* Gallery helpers */
  const handleGalleryUpload = (uploadedUrl) => {
    if (!uploadedUrl) return;
    const isVideo = uploadedUrl.match(/\.(mp4|webm|mov|ogg)$/i) || uploadedUrl.includes('video');
    setFormState((prev) => ({
      ...prev,
      review_gallery: [
        ...prev.review_gallery,
        {
          id: '',
          alt: '',
          url: uploadedUrl,
          type: isVideo ? 'video' : 'image',
          display_order: prev.review_gallery.length + 1,
        },
      ],
    }));
    toast.success('Media added to gallery');
  };

  const updateGalleryItem = (index, field, value) => {
    setFormState((prev) => ({
      ...prev,
      review_gallery: prev.review_gallery.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removeGalleryItem = (index) => {
    setFormState((prev) => ({
      ...prev,
      review_gallery: prev.review_gallery.filter((_, i) => i !== index),
    }));
  };

  /* Save review (Create / Update) */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const isCustomerReview = formState.reviewer_type === 'customer';
    if (isCustomerReview && !selectedCustomer?.value) {
      toast.error('Select a customer for this review.');
      return;
    }
    if (!isCustomerReview && !formState.name.trim()) {
      toast.error('Enter a reviewer name.');
      return;
    }

    setSaving(true);
    try {
      const galleryPayload = formState.review_gallery
        .filter((g) => g.url)
        .map((g, idx) => {
          const item = {
            alt: g.alt || '',
            url: g.url,
            type: g.type || 'image',
            display_order: g.display_order ?? idx + 1,
          };
          if (editingReview && g.id) item.id = g.id;
          return item;
        });

      const payload = {
        customer_id: isCustomerReview ? selectedCustomer.value : null,
        name: isCustomerReview
          ? selectedCustomer.customer?.name || selectedCustomer.customer?.full_name || selectedCustomer.label.split(' · ')[0]
          : formState.name.trim(),
        rating: Number(formState.rating) || 5,
        review: formState.review.trim(),
        review_gallery: galleryPayload,
        is_published: Boolean(formState.is_published),
      };

      let response;
      if (editingReview) {
        response = await apiCall(`/api/v1/admin/reviews/${editingReview.id}`, 'PATCH', payload);
      } else {
        response = await apiCall(
          `/api/v1/admin/tour-packages/${encodeURIComponent(packageId)}/reviews`,
          'POST',
          payload
        );
      }

      const resData = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(resData?.message || resData?.detail || 'Unable to save review');
      }

      toast.success(resData?.message || (editingReview ? 'Review updated successfully' : 'Review created successfully'));
      closeModal();
      loadReviews(currentPage, itemsPerPage);
    } catch (error) {
      handleApiError(error, 'Unable to save review');
    } finally {
      setSaving(false);
    }
  };

  /* Toggle published status */
  const handleTogglePublished = async (review) => {
    const nextPublished = !review.is_published;
    try {
      const response = await apiCall(`/api/v1/admin/reviews/${review.id}`, 'PATCH', {
        is_published: nextPublished,
      });
      const resData = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(resData?.message || 'Unable to update status');
      toast.success(resData?.message || (nextPublished ? 'Review published' : 'Review unpublished'));
      loadReviews(currentPage, itemsPerPage);
    } catch (error) {
      handleApiError(error, 'Unable to update status');
    }
  };

  /* Delete review */
  const handleDelete = (review) => {
    setDeleteReviewTarget(review);
    setIsDeleteReviewModalOpen(true);
  };

  const confirmDeleteReview = async () => {
    if (!deleteReviewTarget) return;
    setDeletingReview(true);
    try {
      const response = await apiCall(`/api/v1/admin/reviews/${deleteReviewTarget.id}`, 'DELETE');
      const resData = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(resData?.message || 'Unable to delete review');
      toast.success(resData?.message || 'Review deleted successfully');
      setIsDeleteReviewModalOpen(false);
      setDeleteReviewTarget(null);
      loadReviews(currentPage, itemsPerPage);
    } catch (error) {
      handleApiError(error, 'Unable to delete review');
    } finally {
      setDeletingReview(false);
    }
  };

  /* Filter reviews */
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      if (statusFilter === 'PUBLISHED' && !r.is_published) return false;
      if (statusFilter === 'UNPUBLISHED' && r.is_published) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchesName = (r.name || r.customer_name || '').toLowerCase().includes(q);
        const matchesComment = (r.review_text || r.comment || '').toLowerCase().includes(q);
        const matchesTitle = (r.title || '').toLowerCase().includes(q);
        if (!matchesName && !matchesComment && !matchesTitle) return false;
      }
      return true;
    });
  }, [reviews, statusFilter, searchTerm]);

  const avgRating = useMemo(() => {
    if (!reviews.length) return '0.0';
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviews]);

  const goToVariants = () => {
    navigate(`/tour-packages/${packageId}/variants`, { state: { package: packageInfo } });
  };

  return (
    <div className="space-y-4 pb-6">
      {/* ── Hub Header ── */}
      <div className="px-2">
        <button
          type="button"
          onClick={() => navigate('/tour-packages')}
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" /> Back to packages
        </button>

        <div>
          <div className="mb-2">
            <h1 className="bg-gradient-to-r from-slate-900 via-violet-700 to-indigo-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent dark:from-slate-100 dark:via-violet-300 dark:to-indigo-300 md:text-3xl">
              {packageInfo ? packageInfo.title : 'Tour Package'}
            </h1>
            {packageInfo && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {packageInfo.destination || packageInfo.tour_code || packageId}
              </p>
            )}
          </div>

          {/* Navigation hub tabs */}
          <div className="flex gap-1 rounded-2xl border border-gray-200 bg-gray-100 p-1 dark:border-gray-700 dark:bg-gray-800 w-fit">
            <button
              type="button"
              onClick={goToVariants}
              aria-label="Variants"
              title="Variants"
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 sm:px-5"
            >
              <Route className="h-4 w-4" />
              <span className="hidden sm:inline">Variants</span>
            </button>
            <button
              type="button"
              aria-label="Reviews"
              title="Reviews"
              className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white sm:px-5"
            >
              <Star className="h-4 w-4" />
              <span className="hidden sm:inline">Reviews</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary + Toolbar ── */}
      <div className="px-2">
        <div className="flex flex-wrap items-center gap-3">
          {/* Stats */}
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-900/40 dark:bg-amber-900/10">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="text-sm font-bold text-amber-700 dark:text-amber-300">{avgRating}</span>
            <span className="text-xs text-amber-600 dark:text-amber-400">avg rating</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-800">
            <MessageSquare className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{totalItems}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">total reviews</span>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => loadReviews(currentPage, itemsPerPage)}
              aria-label="Refresh reviews"
              title="Refresh reviews"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              aria-label="Add review"
              title="Add review"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
            >
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add review</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="px-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search reviews by name or text..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition sm:px-4 ${
              statusFilter !== 'ALL'
                ? 'border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-300'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filter</span>
            {statusFilter !== 'ALL' && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
                1
              </span>
            )}
          </button>

          {(searchTerm || statusFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-dashed border-gray-300 px-2.5 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 sm:px-3"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          <span className="hidden shrink-0 text-sm text-gray-500 dark:text-gray-400 sm:block">
            {filteredReviews.length} record{filteredReviews.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Filter Modal */}
      <Modal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="Filter Reviews"
        icon={Filter}
        size="sm"
        footer={(
          <div className="flex w-full gap-3">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setIsFilterOpen(false);
              }}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={() => setIsFilterOpen(false)}
              className="flex-1 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Apply
            </button>
          </div>
        )}
      >
        <div className="space-y-4 p-1">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
            <div className="flex overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
              {[
                ['ALL', 'All'],
                ['PUBLISHED', 'Published'],
                ['UNPUBLISHED', 'Unpublished'],
              ].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setStatusFilter(val)}
                  className={`flex-1 py-2 text-xs font-semibold transition ${
                    statusFilter === val
                      ? 'bg-violet-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Reviews Table ── */}
      <div className="px-2">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-500">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Loading reviews...
          </div>
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-gray-700 dark:bg-gray-900">
            <ManagementTable
              rows={filteredReviews}
              rowKey="id"
              accent="violet"
              containerClassName="rounded-none border-0 bg-transparent shadow-none"
              tableClassName="border-0"
              className="border-0 shadow-none"
              emptyState={
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-20 text-center dark:border-gray-700 dark:bg-gray-800/40">
                  <MessageSquare className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No reviews found for this package.</p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Click &quot;Add review&quot; to create a new review.</p>
                </div>
              }
              columns={[
                {
                  key: 'reviewer',
                  label: 'Reviewer',
                  headerClassName: 'w-48',
                  render: (review) => (
                    <div className="flex items-center gap-3">
                      {review.customer_profile_picture ? (
                        <img
                          src={review.customer_profile_picture}
                          alt={review.name || 'Reviewer'}
                          className="h-9 w-9 rounded-full object-cover ring-2 ring-gray-100 dark:ring-gray-700 shrink-0"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 text-white">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                          {review.name || 'Anonymous'}
                        </span>
                        {review.is_verified && (
                          <span className="ml-1.5 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                            Verified
                          </span>
                        )}
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'rating',
                  label: 'Rating',
                  headerClassName: 'w-32',
                  className: 'whitespace-nowrap',
                  render: (review) => <StarRating rating={review.rating} />,
                },
                {
                  key: 'review',
                  label: 'Review',
                  mobile: false,
                  render: (review) => (
                    <p className="line-clamp-2 text-xs text-gray-600 dark:text-gray-300">
                      {review.review || <span className="italic text-gray-400">No review text</span>}
                    </p>
                  ),
                },
                {
                  key: 'gallery',
                  label: 'Gallery',
                  mobile: false,
                  headerClassName: 'w-24',
                  render: (review) => {
                    const gallery = Array.isArray(review.review_gallery) ? review.review_gallery : [];
                    if (gallery.length === 0) return <span className="text-xs text-gray-400">No photos</span>;
                    const renderThumbnail = (media, index, className) => {
                      const url = getGalleryMediaUrl(media);
                      if (isGalleryVideo(media)) {
                        return (
                          <div className="relative h-full w-full">
                            <video
                              src={url}
                              aria-label={media?.alt || `Review video ${index + 1}`}
                              className={className}
                              muted
                              preload="metadata"
                            />
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
                              <span className="rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">VIDEO</span>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <img
                          src={url}
                          alt={media?.alt || `Review image ${index + 1}`}
                          className={className}
                        />
                      );
                    };
                    return (
                      <div
                        onClick={() => setGalleryModal({ open: true, images: gallery, reviewerName: review.name || 'Anonymous' })}
                        className="group/photos relative flex h-12 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800"
                      >
                        {gallery.length === 1 ? (
                          renderThumbnail(gallery[0], 0, 'h-full w-full object-cover transition group-hover/photos:scale-105')
                        ) : (
                          <div className="grid h-full w-full grid-cols-2 gap-0.5 p-0.5">
                            {gallery.slice(0, 4).map((img, idx) => (
                              <div key={idx} className="relative overflow-hidden rounded-sm bg-gray-200 dark:bg-gray-700">
                                {renderThumbnail(img, idx, 'h-full w-full object-cover')}
                              </div>
                            ))}
                          </div>
                        )}
                        {gallery.length > 4 && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] font-bold text-white">
                            +{gallery.length - 4}
                          </div>
                        )}
                      </div>
                    );
                  },
                },
                {
                  key: 'status',
                  label: 'Status',
                  headerClassName: 'w-32',
                  className: 'whitespace-nowrap',
                  render: (review) => (
                    <button
                      type="button"
                      onClick={() => handleTogglePublished(review)}
                      className={[
                        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition',
                        review.is_published
                          ? 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:border-cyan-900/40 dark:bg-cyan-900/20 dark:text-cyan-300'
                          : 'border-gray-200 bg-gray-100 text-gray-500 hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400',
                      ].join(' ')}
                    >
                      <Eye className="h-3 w-3" />
                      {review.is_published ? 'Published' : 'Unpublished'}
                    </button>
                  ),
                },
                {
                  key: 'created_at',
                  label: 'Date',
                  headerClassName: 'w-32',
                  className: 'whitespace-nowrap',
                  render: (review) => (
                    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Calendar className="h-3 w-3" />
                      {formatDate(review.created_at)}
                    </span>
                  ),
                },
              ]}
              getActions={(review) => [
                {
                  label: review.is_published ? 'Unpublish' : 'Publish',
                  icon: <Eye className="h-4 w-4 text-cyan-500" />,
                  onClick: () => handleTogglePublished(review),
                },
                {
                  label: 'Edit Review',
                  icon: <Pencil className="h-4 w-4 text-blue-500" />,
                  onClick: () => openEditModal(review),
                },
                {
                  label: 'Delete Review',
                  icon: <Trash2 className="h-4 w-4 text-red-500" />,
                  className: 'text-red-600 hover:text-red-700 dark:text-red-400',
                  onClick: () => handleDelete(review),
                },
              ]}
            />

          </div>
        )}
      </div>

      {/* Pagination */}
      {totalItems > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={(page) => setCurrentPage(page)}
          onLimitChange={(limit) => {
            setItemsPerPage(limit);
            setCurrentPage(1);
          }}
        />
      )}

      {/* ── Gallery Grid Modal ── */}
      {createPortal(
        <AnimatePresence>
          {galleryModal.open && (
            <motion.div
              className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.18, ease: 'easeOut' } }}
              exit={{ opacity: 0, transition: { duration: 0.16, ease: 'easeIn' } }}
            >
              <ModalScrollLock />
              <motion.div
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
                onClick={() => setGalleryModal({ open: false, images: [], reviewerName: '' })}
              />
              <motion.div
                className="relative z-10 flex flex-col w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl bg-gray-950 shadow-2xl ring-1 ring-white/10"
                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 360, damping: 28, mass: 0.75 } }}
                exit={{ opacity: 0, scale: 0.96, y: 12, transition: { duration: 0.16, ease: 'easeIn' } }}
              >
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 shrink-0">
                  <div className="flex items-center gap-2">
                    <Images className="h-4 w-4 text-violet-400" />
                    <span className="text-sm font-semibold text-white">
                      {galleryModal.reviewerName} &mdash; {galleryModal.images.length} {galleryModal.images.length === 1 ? 'Photo' : 'Photos'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGalleryModal({ open: false, images: [], reviewerName: '' })}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="overflow-y-auto p-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                    {galleryModal.images.map((img, idx) => {
                      const url = getGalleryMediaUrl(img);
                      const isVideo = isGalleryVideo(img);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setViewerModal({ open: true, image: img })}
                          className="group relative aspect-square overflow-hidden rounded-lg bg-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        >
                          {isVideo ? (
                            <video src={url} className="h-full w-full object-cover" />
                          ) : (
                            <img src={url} alt={img?.alt || `Photo ${idx + 1}`} className="h-full w-full object-cover transition duration-200 group-hover:scale-105" />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/40">
                            <ZoomIn className="h-6 w-6 text-white opacity-0 transition group-hover:opacity-100 drop-shadow" />
                          </div>
                          {img?.alt && (
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 px-2 py-1 text-[10px] text-white truncate">{img.alt}</div>
                          )}
                          {isVideo && (
                            <div className="absolute top-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">VIDEO</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── Single Image Fullscreen Viewer ── */}
      {createPortal(
        <MediaViewerModal
          isOpen={viewerModal.open}
          onClose={() => setViewerModal({ open: false, image: null })}
        >
          {viewerModal.image && (() => {
            const url = getGalleryMediaUrl(viewerModal.image);
            const isVideo = isGalleryVideo(viewerModal.image);
            return isVideo ? (
              <video src={url} controls autoPlay className="max-h-[90vh] w-auto max-w-full" />
            ) : (
              <img src={url} alt={viewerModal.image?.alt || 'Review photo'} className="max-h-[90vh] w-auto max-w-full object-contain" />
            );
          })()}
        </MediaViewerModal>,
        document.body
      )}

      {/* ── Add / Edit Review Modal ── */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingReview ? 'Edit review' : 'Add review'}
        icon={MessageSquare}
        size="xl"
        footer={(
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="tour-review-form"
              disabled={saving}
              className="rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingReview ? 'Save changes' : 'Create review'}
            </button>
          </div>
        )}
      >
        <form id="tour-review-form" onSubmit={handleSubmit} className="space-y-5 p-1">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Review type <span className="text-red-500">*</span>
            </label>
            <div className="mb-4 flex flex-wrap gap-3">
              {[
                ['customer', 'Customer review'],
                ['named', 'Named / dummy review'],
              ].map(([value, label]) => (
                <label key={value} className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-200">
                  <input
                    type="radio"
                    name="reviewer_type"
                    value={value}
                    checked={formState.reviewer_type === value}
                    onChange={() => setFormState((current) => ({ ...current, reviewer_type: value }))}
                    className="h-4 w-4 text-violet-600 focus:ring-violet-500"
                  />
                  {label}
                </label>
              ))}
            </div>
            {formState.reviewer_type === 'customer' ? (
              <>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Customer <span className="text-red-500">*</span>
                </label>
                <SelectField
                  options={customerOptions}
                  value={selectedCustomer}
                  onChange={setSelectedCustomer}
                  onMenuOpen={handleCustomerMenuOpen}
                  onMenuScrollToBottom={handleCustomerMenuScrollToBottom}
                  isLoading={customersLoading}
                  isSearchable
                  isClearable
                  placeholder="Search and select a customer"
                  noOptionsMessage={() => (customersLoading ? 'Loading customers...' : 'No customers found')}
                  menuPlacement="auto"
                  classNamePrefix="react-select"
                />
              </>
            ) : (
              <div>
                <label htmlFor="reviewer-name" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Reviewer name <span className="text-red-500">*</span>
                </label>
                <input
                  id="reviewer-name"
                  value={formState.name}
                  onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                  required
                  maxLength={200}
                  placeholder="Enter reviewer name"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                />
              </div>
            )}
            {formState.reviewer_type === 'customer' && selectedCustomer && (
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-violet-100 bg-violet-50/70 p-3 dark:border-violet-900/40 dark:bg-violet-950/20">
                {selectedCustomer.customer?.profile_pic || selectedCustomer.customer?.profile_picture || selectedCustomer.customer?.avatar_url ? (
                  <img
                    src={selectedCustomer.customer.profile_pic || selectedCustomer.customer.profile_picture || selectedCustomer.customer.avatar_url}
                    alt={selectedCustomer.customer.name || selectedCustomer.customer.full_name || 'Customer'}
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-200 text-sm font-bold text-violet-800 dark:bg-violet-900 dark:text-violet-200">
                    {(selectedCustomer.customer?.name || selectedCustomer.customer?.full_name || selectedCustomer.label).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {selectedCustomer.customer?.name || selectedCustomer.customer?.full_name || selectedCustomer.label.split(' · ')[0]}
                  </p>
                  <p className="mt-0.5 break-all text-xs text-gray-500 dark:text-gray-400">ID: {selectedCustomer.value}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                    {(selectedCustomer.customer?.mobile || selectedCustomer.customer?.phone) && (
                      <span>{selectedCustomer.customer.mobile || selectedCustomer.customer.phone}</span>
                    )}
                    {selectedCustomer.customer?.email && <span>{selectedCustomer.customer.email}</span>}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Rating <span className="text-red-500">*</span>
            </label>
            <StarPicker value={formState.rating} onChange={(v) => setFormState((p) => ({ ...p, rating: v }))} />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Review text</label>
            <textarea
              value={formState.review}
              onChange={(e) => setFormState((p) => ({ ...p, review: e.target.value }))}
              rows={4}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              placeholder="Customer's review of this package..."
            />
          </div>

          {/* Review Gallery Upload - NO TEXT INPUT FIELD TYPE, USES DRAGDROPUPLOAD */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Review gallery photos & videos
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Drag and drop files to upload directly into the review gallery.
                </p>
              </div>
              <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {formState.review_gallery.length} {formState.review_gallery.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Drag & Drop Upload component */}
            <DragDropUpload
              label="Upload gallery image or video"
              value=""
              accept="image/*,video/*"
              helperText="Drag & drop PNG, JPG, WEBP, MP4 files to add"
              onChange={handleGalleryUpload}
            />

            {/* Uploaded Gallery Items Table */}
            {formState.review_gallery.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-[80px_minmax(0,1fr)_90px_48px] gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  <span>Type</span>
                  <span>Preview & Caption</span>
                  <span>Order</span>
                  <span className="text-right">Action</span>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {formState.review_gallery.map((item, index) => (
                    <div
                      key={item.id || index}
                      className="grid grid-cols-[80px_minmax(0,1fr)_90px_48px] items-center gap-2 px-3 py-2.5 bg-white dark:bg-gray-900"
                    >
                      <span className="inline-flex w-fit items-center rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium capitalize text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {item.type || 'image'}
                      </span>

                      <div className="flex min-w-0 items-center gap-3">
                        <MediaPreviewModal
                          src={item.url}
                          alt={item.alt || 'Gallery media'}
                          type={item.type || 'image'}
                          thumbnailClassName="h-12 w-16 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-gray-700"
                          className="block shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <input
                            type="text"
                            value={item.alt || ''}
                            onChange={(e) => updateGalleryItem(index, 'alt', e.target.value)}
                            placeholder="Caption / Alt text (optional)"
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 outline-none focus:border-violet-500 focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">#</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          min="1"
                          value={item.display_order ?? index + 1}
                          onChange={(e) => updateGalleryItem(index, 'display_order', sanitizeNumericInput(e.target.value))}
                          className="w-14 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 outline-none focus:border-violet-500 focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                        />
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeGalleryItem(index)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                          title="Remove media"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Published toggle */}
          <label className="inline-flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={formState.is_published}
                onChange={(e) => setFormState((p) => ({ ...p, is_published: e.target.checked }))}
              />
              <div
                className={`h-5 w-9 rounded-full transition-colors ${
                  formState.is_published ? 'bg-violet-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
              <div
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  formState.is_published ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {formState.is_published ? 'Published — visible to customers' : 'Unpublished — hidden from customers'}
            </span>
          </label>
        </form>
      </Modal>
      <ConfirmDeleteModal
        isOpen={isDeleteReviewModalOpen}
        onClose={() => {
          if (!deletingReview) {
            setIsDeleteReviewModalOpen(false);
            setDeleteReviewTarget(null);
          }
        }}
        onConfirm={confirmDeleteReview}
        confirming={deletingReview}
        itemLabel={deleteReviewTarget?.name || 'this review'}
        title="Delete review"
        message="This review will be permanently removed from the package."
      />
    </div>
  );
};

export default TourReviews;
