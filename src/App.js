import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './component/ProtectedRoute';
import Login from './pages/Login';

// Keep the login route in the initial bundle. The authenticated modules are
// loaded on demand so a user does not download every management screen at
// startup.
const MainLayout = lazy(() => import('./component/layout/MainLayout'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Profile = lazy(() => import('./pages/Profile'));
const StaffManagement = lazy(() => import('./pages/StaffManagement'));
const CustomerManagement = lazy(() => import('./pages/CustomerManagement'));
const CustomerDetails = lazy(() => import('./pages/CustomerDetails'));
const DocumentManagement = lazy(() => import('./pages/DocumentManagement'));
const TourOffers = lazy(() => import('./pages/TourOffers'));
const TourPackages = lazy(() => import('./pages/TourPackages'));
const TourVariant = lazy(() => import('./pages/TourVariant'));
const TourReviews = lazy(() => import('./pages/TourReviews'));
const TourDetails = lazy(() => import('./pages/TourDetails'));
const DestinationManagement = lazy(() => import('./pages/DestinationManagement'));
const HotelManagement = lazy(() => import('./pages/HotelManagement'));
const VendorManagement = lazy(() => import('./pages/VendorManagement'));
const VehicleManagement = lazy(() => import('./pages/VehicleManagement'));
const QuotationManagement = lazy(() => import('./pages/QuotationManagement'));
const QuotationDetails = lazy(() => import('./pages/QuotationDetails'));
const BookingManagement = lazy(() => import('./pages/BookingManagementWizard'));
const BookingDetails = lazy(() => import('./pages/BookingDetails'));
const BookingCalendar = lazy(() => import('./pages/BookingCalendar'));
const EnquiryManagement = lazy(() => import('./pages/EnquiryManagement'));
const LeadManagement = lazy(() => import('./pages/LeadManagement'));
const Referrals = lazy(() => import('./pages/Referrals'));
const ReferralsConfiguration = lazy(() => import('./pages/ReferralsConfiguration'));
const RulesRegulations = lazy(() => import('./pages/RulesRegulations'));
const PointsManagement = lazy(() => import('./pages/PointsManagement'));
const FinancialManagement = lazy(() => import('./pages/FinancialManagement'));
const ServerUnavailable = lazy(() => import('./pages/ServerUnavailable'));
const NotFound = lazy(() => import('./pages/NotFound'));

const RouteLoading = () => (
  <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400" role="status" aria-live="polite">
    Loading…
  </div>
);

// Fallback placeholder component for other routes
const UnderConstruction = ({ title }) => (
  <div className="p-8 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm my-6">
    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{title} Management</h2>
    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
      This module is being connected with your administrative backend. Check back soon.
    </p>
  </div>
);

function App() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/server-unavailable" element={<ServerUnavailable />} />

        {/* Authenticated Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/staff-management" element={<StaffManagement />} />
            <Route path="/customers" element={<CustomerManagement />} />
            <Route path="/customers/:customerId" element={<CustomerDetails />} />
            <Route path="/referrals" element={<Referrals />} />
            <Route path="/referrals/configuration" element={<ReferralsConfiguration />} />
            <Route path="/rules-regulations" element={<RulesRegulations />} />
            <Route path="/points" element={<PointsManagement />} />
            <Route path="/financial" element={<FinancialManagement />} />
            <Route path="/enquiries" element={<EnquiryManagement />} />
            <Route path="/enquiries/:enquiryId/lead" element={<LeadManagement />} />
            <Route path="/leads/:leadId" element={<LeadManagement />} />
            <Route path="/document-management" element={<DocumentManagement />} />
            <Route path="/tour-offers" element={<TourOffers />} />
            <Route path="/destinations" element={<DestinationManagement />} />
            <Route path="/hotels" element={<HotelManagement />} />
            <Route path="/vendors" element={<VendorManagement />} />
            <Route path="/vehicles" element={<VehicleManagement />} />
            <Route path="/quotations" element={<QuotationManagement />} />
            <Route path="/quotations/:quotationId" element={<QuotationDetails />} />
            <Route path="/bookings" element={<BookingManagement />} />
            <Route path="/bookings/calendar" element={<BookingCalendar />} />
            <Route path="/bookings/:bookingId" element={<BookingDetails />} />
            <Route path="/tour-packages" element={<TourPackages />} />
            <Route path="/tour-variants" element={<TourVariant />} />
            <Route path="/tour-packages/:packageId/variants" element={<TourVariant />} />
            <Route path="/tour-packages/:packageId/reviews" element={<TourReviews />} />
            <Route path="/tour-packages/:packageId/variants/:variantId/details" element={<TourDetails />} />
            <Route path="/users" element={<UnderConstruction title="Users" />} />
            <Route path="/projects" element={<UnderConstruction title="Projects" />} />
            <Route path="/qr-codes" element={<UnderConstruction title="QR Codes" />} />
            <Route path="/tech-provider" element={<UnderConstruction title="Tech Providers" />} />
            <Route path="/subscription-packs" element={<UnderConstruction title="Subscription Packs" />} />
            <Route path="/subscriptions" element={<UnderConstruction title="All Subscriptions" />} />
            <Route path="/custom-pricing" element={<UnderConstruction title="Custom Pricing" />} />
            <Route path="/ai-providers" element={<UnderConstruction title="AI Providers" />} />
            <Route path="/ai-pricing" element={<UnderConstruction title="AI Pricing" />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>

        {/* Wildcard Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default App;
