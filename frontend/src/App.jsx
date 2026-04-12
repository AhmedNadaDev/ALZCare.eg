import React, { useEffect, lazy, Suspense, memo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import TrueFocus from './components/ui/TrueFocus.jsx';
import './styles/animations.css';

// ===== LAZY LOADED PAGES =====
// Each page is loaded only when needed, reducing initial bundle size
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const FeaturesPage = lazy(() => import('./pages/FeaturesPage.jsx'));
const DashboardShowcase = lazy(() => import('./pages/DashboardShowcase.jsx'));
const AuthPages = lazy(() => import('./pages/AuthPages.jsx'));
const AboutPage = lazy(() => import('./pages/AboutPage.jsx'));

// ===== DOCTOR DASHBOARD MODULE (Completely Isolated) =====
const DoctorDashboardRouter = lazy(() => import('./doctor-dashboard/index.jsx').then(m => ({ default: m.DoctorDashboardRouter })));
const FamilyDashboardRouter = lazy(() => import('./doctor-dashboard/index.jsx').then(m => ({ default: m.FamilyDashboardRouter })));
const PatientPage = lazy(() => import('./doctor-dashboard/pages/PatientPage.jsx'));

// ===== PAGE LOADING PLACEHOLDER =====
// Shows a minimal loading state that takes up space to prevent footer flash
const PageLoadingPlaceholder = memo(() => (
  <div className="min-h-screen bg-[#0a0118] flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
  </div>
));
PageLoadingPlaceholder.displayName = 'PageLoadingPlaceholder';

// ===== LOADING FALLBACK =====
// TrueFocus animated loader - completes full animation before showing page
const PageLoader = memo(({ onComplete }) => {
  const [animationComplete, setAnimationComplete] = useState(false);
  const animationDuration = 0.5;
  const pauseBetweenAnimations = 0.8;
  const totalWords = 2; // "ALZ" and "Care"
  
  useEffect(() => {
    // Hide scrollbar during loading
    document.body.style.overflow = 'hidden';
    
    // Calculate total animation time: each word gets focused once, then we finish
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
    <div 
      className="fixed inset-0 z-[10000] bg-[#0a0118] flex items-center justify-center overflow-hidden"
      role="status"
      aria-label="Loading"
    >
      <TrueFocus
        sentence="ALZ Care"
        blurAmount={5}
        borderColor="#7c3aed"
        glowColor="rgba(124, 58, 237, 0.6)"
        animationDuration={animationDuration}
        pauseBetweenAnimations={pauseBetweenAnimations}
      />
    </div>
  );
});
PageLoader.displayName = 'PageLoader';

// ===== SCROLL TO TOP COMPONENT =====
// Memoized to prevent unnecessary re-renders
const ScrollToTop = memo(() => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll to top immediately on route change
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
});
ScrollToTop.displayName = 'ScrollToTop';

// ===== SCROLL ANIMATION INITIALIZER =====
// Sets up intersection observer for CSS-based scroll animations
const ScrollAnimationInitializer = memo(() => {
  useEffect(() => {
    // Use a single observer for all animated elements
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            // Unobserve after animation to improve performance
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    // Observe all elements with scroll animation classes
    const animatedElements = document.querySelectorAll(
      '.scroll-animate, .scroll-animate-left, .scroll-animate-right, .scroll-animate-scale, .animate-on-scroll'
    );
    
    animatedElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return null;
});
ScrollAnimationInitializer.displayName = 'ScrollAnimationInitializer';

// ===== CONDITIONAL NAVBAR/FOOTER WRAPPER =====
const ConditionalLayout = memo(({ children, isLoading }) => {
  const location = useLocation();
  const isDoctorOrFamilyRoute = location.pathname.startsWith('/doctor') || location.pathname.startsWith('/family');
  const isPatientRoute = location.pathname.startsWith('/patient');
  
  return (
    <div 
      className="min-h-screen bg-[#0a0118] font-sans antialiased text-white flex flex-col animate-fade-in"
    >
      {/* Utility components */}
      <ScrollToTop />
      <ScrollAnimationInitializer />
      
      {/* Navigation - Hidden for Doctor/Family/Patient routes */}
      {!isDoctorOrFamilyRoute && !isPatientRoute && (
        <Navbar isExpanded={!isLoading} />
      )}
      
      {/* Main content area */}
      <main id="main-content" className="flex-1" role="main">
        {children}
      </main>
      
      {/* Footer - Hidden for Doctor/Family/Patient routes */}
      {!isDoctorOrFamilyRoute && !isPatientRoute && (
        <Footer />
      )}
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
      
      {/* Main app content - completely hidden during loading to prevent scrollbar */}
      {!isLoading && (
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
              
              {/* ===== DOCTOR DASHBOARD MODULE - Completely Isolated ===== */}
              <Route path="/doctor/*" element={<DoctorDashboardRouter />} />
              <Route path="/family/*" element={<FamilyDashboardRouter />} />
              
              {/* ===== PATIENT PAGE - Public, No Auth ===== */}
              <Route path="/patient" element={<PatientPage />} />
            </Routes>
          </Suspense>
        </ConditionalLayout>
      )}
    </Router>
  );
}

export default App;
