import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ToastProvider } from './context/ToastContext.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { Header } from './components/Header.js';
import { Footer } from './components/Footer.js';
import { Sidebar } from './components/Sidebar.js';
import { TopBar } from './components/TopBar.js';
import { RouteGuard } from './components/RouteGuard.js';
import './tokens.css';

// Lazy-loaded 26 page views (P-001..P-026)
const P001_Welcome = lazy(() => import('./pages/P001_Welcome.js'));
const P002_SignIn = lazy(() => import('./pages/P002_SignIn.js'));
const P003_Register = lazy(() => import('./pages/P003_Register.js'));
const P004_Account = lazy(() => import('./pages/P004_Account.js'));
const P005_Notifications = lazy(() => import('./pages/P005_Notifications.js'));
const P006_DonorDashboard = lazy(() => import('./pages/P006_DonorDashboard.js'));
const P007_DonorDonations = lazy(() => import('./pages/P007_DonorDonations.js'));
const P008_PublishDonation = lazy(() => import('./pages/P008_PublishDonation.js'));
const P009_DonorDonationDetail = lazy(() => import('./pages/P009_DonorDonationDetail.js'));
const P010_DonorEditDonation = lazy(() => import('./pages/P010_DonorEditDonation.js'));
const P011_DonorHistory = lazy(() => import('./pages/P011_DonorHistory.js'));
const P012_NgoDashboard = lazy(() => import('./pages/P012_NgoDashboard.js'));
const P013_NgoDiscover = lazy(() => import('./pages/P013_NgoDiscover.js'));
const P014_NgoEvaluateDonation = lazy(() => import('./pages/P014_NgoEvaluateDonation.js'));
const P015_NgoPickups = lazy(() => import('./pages/P015_NgoPickups.js'));
const P016_NgoHandover = lazy(() => import('./pages/P016_NgoHandover.js'));
const P017_NgoCapacity = lazy(() => import('./pages/P017_NgoCapacity.js'));
const P018_CoordinatorDashboard = lazy(() => import('./pages/P018_CoordinatorDashboard.js'));
const P019_CoordinatorOrgs = lazy(() => import('./pages/P019_CoordinatorOrgs.js'));
const P020_CoordinatorOrgReview = lazy(() => import('./pages/P020_CoordinatorOrgReview.js'));
const P021_CoordinatorDonations = lazy(() => import('./pages/P021_CoordinatorDonations.js'));
const P022_CoordinatorDonationInvestigate = lazy(() => import('./pages/P022_CoordinatorDonationInvestigate.js'));
const P023_CoordinatorAnalytics = lazy(() => import('./pages/P023_CoordinatorAnalytics.js'));
const P024_CoordinatorAudit = lazy(() => import('./pages/P024_CoordinatorAudit.js'));
const P025_Forbidden = lazy(() => import('./pages/P025_Forbidden.js'));
const P026_NotFound = lazy(() => import('./pages/P026_NotFound.js'));

function PageLoadingFallback() {
  return (
    <div className="page-container" role="status" aria-busy="true">
      <div className="panel" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <p style={{ color: 'var(--color-secondary)' }}>Loading verified workspace view...</p>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
                    {/* Public & Onboarding (P-001..P-003) */}
                    <Route path="/" element={<P001_Welcome />} />
                    <Route path="/login" element={<P002_SignIn />} />
                    <Route path="/register" element={<P003_Register />} />

                    {/* Shared Authenticated Account & Notifications (P-004..P-005) */}
                    <Route
                      path="/account"
                      element={
                        <RouteGuard allowedRoles={['donor', 'ngo', 'coordinator']}>
                          <P004_Account />
                        </RouteGuard>
                      }
                    />
                    <Route
                      path="/notifications"
                      element={
                        <RouteGuard allowedRoles={['donor', 'ngo', 'coordinator']}>
                          <P005_Notifications />
                        </RouteGuard>
                      }
                    />

                    {/* Donor Portal (P-006..P-011) */}
                    <Route
                      path="/donor"
                      element={
                        <RouteGuard allowedRoles={['donor']}>
                          <P006_DonorDashboard />
                        </RouteGuard>
                      }
                    />
                    <Route
                      path="/donor/donations"
                      element={
                        <RouteGuard allowedRoles={['donor']}>
                          <P007_DonorDonations />
                        </RouteGuard>
                      }
                    />
                    <Route
                      path="/donor/donations/new"
                      element={
                        <RouteGuard allowedRoles={['donor']}>
                          <P008_PublishDonation />
                        </RouteGuard>
                      }
                    />
                    <Route
                      path="/donor/donations/:id"
                      element={
                        <RouteGuard allowedRoles={['donor']}>
                          <P009_DonorDonationDetail />
                        </RouteGuard>
                      }
                    />
                    <Route
                      path="/donor/donations/:id/edit"
                      element={
                        <RouteGuard allowedRoles={['donor']}>
                          <P010_DonorEditDonation />
                        </RouteGuard>
                      }
                    />
                    <Route
                      path="/donor/history"
                      element={
                        <RouteGuard allowedRoles={['donor']}>
                          <P011_DonorHistory />
                        </RouteGuard>
                      }
                    />

                    {/* NGO Relief Portal (P-012..P-017) */}
                    <Route
                      path="/ngo"
                      element={
                        <RouteGuard allowedRoles={['ngo']}>
                          <P012_NgoDashboard />
                        </RouteGuard>
                      }
                    />
                    <Route
                      path="/ngo/discover"
                      element={
                        <RouteGuard allowedRoles={['ngo']}>
                          <P013_NgoDiscover />
                        </RouteGuard>
                      }
                    />
                    <Route
                      path="/ngo/donations/:id"
                      element={
                        <RouteGuard allowedRoles={['ngo']}>
                          <P014_NgoEvaluateDonation />
                        </RouteGuard>
                      }
                    />
                    <Route
                      path="/ngo/pickups"
                      element={
                        <RouteGuard allowedRoles={['ngo']}>
                          <P015_NgoPickups />
                        </RouteGuard>
                      }
                    />
                    <Route
                      path="/ngo/history"
                      element={
                        <RouteGuard allowedRoles={['ngo']}>
                          <P015_NgoPickups />
                        </RouteGuard>
                      }
                    />
                    <Route
                      path="/ngo/pickups/:id"
                      element={
                        <RouteGuard allowedRoles={['ngo']}>
                          <P016_NgoHandover />
                        </RouteGuard>
                      }
                    />
                    <Route
                      path="/ngo/capacity"
                      element={
                        <RouteGuard allowedRoles={['ngo']}>
                          <P017_NgoCapacity />
                        </RouteGuard>
                      }
                    />
                    <Route
                      path="/ngo/history"
                      element={
                        <RouteGuard allowedRoles={['ngo']}>
                          <Navigate to="/ngo/pickups?tab=all" replace />
                        </RouteGuard>
                      }
                    />

                    {/* Coordinator Operations Portal (P-018..P-024) */}
                    <Route
                      path="/coordinator"
                      element={
                        <RouteGuard allowedRoles={['coordinator']}>
                          <P018_CoordinatorDashboard />
                        </RouteGuard>
                      }
                    />
                    <Route
                      path="/coordinator/organizations"
                      element={
                        <RouteGuard allowedRoles={['coordinator']}>
                          <P019_CoordinatorOrgs />
                        </RouteGuard>
                      }
                    />
                    <Route
                      path="/coordinator/organizations/:id"
                      element={
                        <RouteGuard allowedRoles={['coordinator']}>
                          <P020_CoordinatorOrgReview />
                        </RouteGuard>
                      }
                    />
                    <Route
                      path="/coordinator/donations"
                      element={
                        <RouteGuard allowedRoles={['coordinator']}>
                          <P021_CoordinatorDonations />
                        </RouteGuard>
                      }
                    />
                    <Route
                      path="/coordinator/donations/:id"
                      element={
                        <RouteGuard allowedRoles={['coordinator']}>
                          <P022_CoordinatorDonationInvestigate />
                        </RouteGuard>
                      }
                    />
                    <Route
                      path="/coordinator/analytics"
                      element={
                        <RouteGuard allowedRoles={['coordinator']}>
                          <P023_CoordinatorAnalytics />
                        </RouteGuard>
                      }
                    />
                    <Route
                      path="/coordinator/audit"
                      element={
                        <RouteGuard allowedRoles={['coordinator']}>
                          <P024_CoordinatorAudit />
                        </RouteGuard>
                      }
                    />

        {/* Access & Exception Guidance (P-025..P-026) */}
        <Route path="/forbidden" element={<P025_Forbidden />} />
        <Route path="/not-found" element={<P026_NotFound />} />
        <Route path="*" element={<Navigate to="/not-found" replace />} />
      </Routes>
    </Suspense>
  );
}

function AppShell() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return (
      <div className="app-dashboard-layout">
        <Sidebar />
        <div className="app-dashboard-main">
          <TopBar />
          <main id="main-content" className="app-main" tabIndex={-1} style={{ padding: '1.5rem 2rem' }}>
            <AppRoutes />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header />
      <main id="main-content" className="app-main" tabIndex={-1}>
        <AppRoutes />
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <AuthProvider>
        <ToastProvider>
          <ErrorBoundary>
            <AppShell />
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
