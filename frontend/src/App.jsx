import React, { useEffect, lazy, Suspense, memo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import TrueFocus from './components/ui/TrueFocus.jsx';
import { AuthProvider } from './modules/shared/auth/AuthContext.jsx';
import { useAuth } from './modules/shared/auth/AuthContext.jsx';
import './styles/animations.css';

// ===== LAZY LOADED PAGES =====
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const FeaturesPage = lazy(() => import('./pages/FeaturesPage.jsx'));
const DashboardShowcase = lazy(() => import('./pages/DashboardShowcase.jsx'));
const AuthPages = lazy(() => import('./pages/AuthPages.jsx'));
const AboutPage = lazy(() => import('./pages/AboutPage.jsx'));

// ===== MODULAR DASHBOARDS =====
const DoctorDashboardRouter = lazy(() => import('./modules/doctor/index.jsx').then(m => ({ default: m.DoctorDashboardRouter })));
const FamilyDashboardRouter = lazy(() => import('./modules/family/index.jsx').then(m => ({ default: m.FamilyDashboardRouter })));
const PatientPage = lazy(() => import('./modules/patient/pages/PatientPage.jsx'));

// ===== PAGE LOADING PLACEHOLDER =====
const PageLoadingPlaceholder = memo(() => (
  <div className="min-h-screen bg-[#0a0118] flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
  </div>
));
PageLoadingPlaceholder.displayName = 'PageLoadingPlaceholder';

// ===== LOADING FALLBACK =====
const PageLoader = memo(({ onComplete }) => {
  const [animationComplete, setAnimationComplete] = useState(false);
  const animationDuration = 0.5;
  const pauseBetweenAnimations = 0.8;
  const totalWords = 2; // "ALZ" and "Care"
  
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const totalTime = (animationDuration + pauseBetweenAnimations) * totalWords * 1000;
    const timer = setTimeout(() => {
      setAnimationComplete(true);
      document.body.style.overflow = '';
      if (onComplete) onComplete();
    }, totalTime);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = '';
    };
  }, [onComplete]);

  if (animationComplete) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-[#0a0118] flex items-center justify-center overflow-hidden" role="status" aria-label="Loading">
      <TrueFocus sentence="ALZ Care" blurAmount={5} borderColor="#7c3aed" glowColor="rgba(124, 58, 237, 0.6)" animationDuration={animationDuration} pauseBetweenAnimations={pauseBetweenAnimations} />
    </div>
  );
});
PageLoader.displayName = 'PageLoader';

// ===== SCROLL TO TOP COMPONENT =====
const ScrollToTop = memo(() => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
});
ScrollToTop.displayName = 'ScrollToTop';

// ===== SCROLL ANIMATION INITIALIZER =====
const ScrollAnimationInitializer = memo(() => {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    const animatedElements = document.querySelectorAll('.scroll-animate, .scroll-animate-left, .scroll-animate-right, .scroll-animate-scale, .animate-on-scroll');
    animatedElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return null;
});
ScrollAnimationInitializer.displayName = 'ScrollAnimationInitializer';

const PatientProtectedRoute = memo(({ children }) => {
  const { isAuthenticated, isPatient, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0118] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated || !isPatient) {
    return <Navigate to="/auth/login?type=patient" replace />;
  }
  return children;
});
PatientProtectedRoute.displayName = 'PatientProtectedRoute';

// ===== CONDITIONAL NAVBAR/FOOTER WRAPPER =====
const ConditionalLayout = memo(({ children, isLoading }) => {
  const location = useLocation();
  const isDoctorOrFamilyRoute = location.pathname.startsWith('/doctor') || location.pathname.startsWith('/family');
  const isPatientRoute = location.pathname.startsWith('/patient');
  
  return (
    <div className="min-h-screen bg-[#0a0118] font-sans antialiased text-white flex flex-col animate-fade-in">
      <ScrollToTop />
      <ScrollAnimationInitializer />
      {!isDoctorOrFamilyRoute && !isPatientRoute && <Navbar isExpanded={!isLoading} />}
      <main id="main-content" className="flex-1" role="main">
        {children}
      </main>
      {!isDoctorOrFamilyRoute && !isPatientRoute && <Footer />}
    </div>
  );
});
ConditionalLayout.displayName = 'ConditionalLayout';

// ===== MAIN APP COMPONENT =====
function App() {
  const [isLoading, setIsLoading] = useState(true);

  const handleLoadingComplete = () => {
    setIsLoading(false);
  };

  return (
    <Router>
      {/* Initial loading animation */}
      {isLoading && <PageLoader onComplete={handleLoadingComplete} />}
      
      {/* Main app content */}
      {!isLoading && (
        <AuthProvider>
          <ConditionalLayout isLoading={isLoading}>
            <Suspense fallback={<PageLoadingPlaceholder />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/features" element={<FeaturesPage />} />
                <Route path="/dashboard" element={<DashboardShowcase />} />
                <Route path="/family-dashboard" element={<DashboardShowcase />} />
                <Route path="/doctor-dashboard" element={<DashboardShowcase />} />
                <Route path="/auth/*" element={<AuthPages />} />
                <Route path="/about" element={<AboutPage />} />
                
                <Route path="/doctor/*" element={<DoctorDashboardRouter />} />
                <Route path="/family/*" element={<FamilyDashboardRouter />} />
                <Route path="/patient" element={<PatientProtectedRoute><PatientPage /></PatientProtectedRoute>} />
                
                {/* Fallback to homepage */}
                <Route path="*" element={<LandingPage />} />
              </Routes>
            </Suspense>
          </ConditionalLayout>
        </AuthProvider>
      )}
    </Router>
  );
}

export default App;
