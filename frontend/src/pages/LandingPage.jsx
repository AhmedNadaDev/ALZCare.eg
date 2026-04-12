import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import AOS from 'aos';
import 'aos/dist/aos.css';

// Lazy load DomeGallery for better initial page load
const DomeGallery = lazy(() => import('../components/DomeGallery'));

// ===== ICONS =====
const ShieldIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
    <path d="m9 12 2 2 4-4"/>
  </svg>
);

const BrainIcon = () => (
  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.54"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.54"/>
  </svg>
);

const HeartIcon = () => (
  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
  </svg>
);

const ClockIcon = () => (
  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const ActivityIcon = () => (
  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);

const PlayCircleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polygon points="10 8 16 12 10 16 10 8"/>
  </svg>
);

const UsersIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const MapPinIcon = () => (
  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

const BellIcon = () => (
  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
  </svg>
);

const MicIcon = () => (
  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" x2="12" y1="19" y2="22"/>
  </svg>
);

const StarIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const QuoteIcon = () => (
  <svg className="h-10 w-10 opacity-20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

// ===== ANIMATED COUNTER =====
const AnimatedCounter = ({ target, suffix = '', duration = 2000 }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const startTime = Date.now();
          const animate = () => {
            const now = Date.now();
            const progress = Math.min((now - startTime) / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(easeOut * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration, hasAnimated]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
};

// ===== SCROLL REVEAL HOOK =====
const useScrollReveal = () => {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return [ref, isVisible];
};

// ===== MAIN COMPONENT =====
// Global awareness images - people affected by Alzheimer's worldwide
const awarenessImages = [
  { src: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=400&h=400&fit=crop', alt: 'Elderly person with caregiver' },
  { src: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=400&h=400&fit=crop', alt: 'Family support moment' },
  { src: 'https://images.unsplash.com/photo-1516534775068-ba3e7458af70?w=400&h=400&fit=crop', alt: 'Medical professional caring' },
  { src: 'https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=400&h=400&fit=crop', alt: 'Compassionate elderly care' },
  { src: 'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?w=400&h=400&fit=crop', alt: 'Healthcare worker' },
  { src: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=400&fit=crop', alt: 'Medical technology' },
  { src: 'https://images.unsplash.com/photo-1551076805-e1869033e561?w=400&h=400&fit=crop', alt: 'Patient receiving care' },
];

const LandingPage = () => {
  const [heroRef, heroVisible] = useScrollReveal();
  const [featuresRef, featuresVisible] = useScrollReveal();
  const [awarenessRef, awarenessVisible] = useScrollReveal();
  const [statsRef, statsVisible] = useScrollReveal();
  const [ctaRef, ctaVisible] = useScrollReveal();

  // Initialize AOS
  useEffect(() => {
    AOS.init({
      duration: 800,
      easing: 'ease-out-cubic',
      once: false,
      mirror: false, // Only animate when scrolling down into view
      offset: 50,
      disable: false,
    });
    
    // Refresh AOS on window resize
    window.addEventListener('resize', AOS.refresh);
    return () => window.removeEventListener('resize', AOS.refresh);
  }, []);

  // Dynamic AOS animations for features - alternating directions
  const getFeatureAnimation = (index) => {
    const animations = [
      { aos: 'fade-right', delay: 0 },      // Card 1 - from left
      { aos: 'fade-up', delay: 100 },        // Card 2 - from bottom
      { aos: 'fade-left', delay: 200 },      // Card 3 - from right
      { aos: 'fade-left', delay: 0 },        // Card 4 - from right
      { aos: 'fade-up', delay: 100 },        // Card 5 - from bottom
      { aos: 'fade-right', delay: 200 },     // Card 6 - from left
    ];
    return animations[index] || { aos: 'fade-up', delay: 0 };
  };

  const features = [
    {
      icon: BrainIcon,
      title: "AI-Powered Recognition",
      description: "Advanced facial and voice recognition helps patients identify loved ones and caregivers instantly.",
      gradient: "from-purple-500 to-purple-700"
    },
    {
      icon: ClockIcon,
      title: "Smart Medication",
      description: "Intelligent reminders and tracking ensure medication adherence with family notifications.",
      gradient: "from-violet-500 to-purple-600"
    },
    {
      icon: ActivityIcon,
      title: "24/7 Monitoring",
      description: "Real-time activity and health monitoring with instant emergency alerts to caregivers.",
      gradient: "from-purple-600 to-purple-800"
    },
    {
      icon: HeartIcon,
      title: "Emotional Support",
      description: "AI companion providing cognitive stimulation, comfort, and emotional wellbeing tracking.",
      gradient: "from-violet-600 to-purple-700"
    },
    {
      icon: MapPinIcon,
      title: "Location Safety",
      description: "Smart geofencing and indoor tracking for patient safety with wandering detection.",
      gradient: "from-purple-500 to-violet-600"
    },
    {
      icon: MicIcon,
      title: "Voice Interaction",
      description: "Natural voice commands and conversational AI for easy, hands-free interaction.",
      gradient: "from-purple-700 to-purple-900"
    }
  ];

  const stats = [
    { value: 10000, suffix: '+', label: 'Patients Helped' },
    { value: 50, suffix: '+', label: 'Partner Hospitals' },
    { value: 98, suffix: '%', label: 'Family Satisfaction' },
    { value: 24, suffix: '/7', label: 'AI Support' },
  ];


  const trustedBy = [
    'Mayo Clinic', 'Johns Hopkins', 'Cleveland Clinic', 'Mass General', 'Stanford Health', 'UCLA Health'
  ];

  return (
    <div className="overflow-hidden bg-[#0a0118]">
      {/* ===== HERO SECTION ===== */}
      <section 
        ref={heroRef}
        className="relative min-h-screen flex items-center pt-20 pb-32 px-4 mt-20"
      >
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[#0a0118]" />
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
        
        {/* Animated Blobs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-600/20 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-40 right-10 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl animate-blob animation-delay-4000" />
        
        <div className="relative max-w-7xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Hero Content */}
            <div className={`transition-all duration-1000 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/[0.05] border border-white/10 text-purple-300 font-medium text-sm mb-6">
                <ShieldIcon />
                <span className="ml-2">Designed with HIPAA, GDPR, and healthcare security standards in mind</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight tracking-tight">
                <span className="whitespace-nowrap">Compassionate AI for</span>{' '}
                <span className="relative whitespace-nowrap">
                  <span className="bg-gradient-to-r from-purple-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                    Alzheimer's Care
                  </span>
                  <svg className="absolute -bottom-2 left-0 w-full hidden sm:block" height="8" viewBox="0 0 200 8" fill="none">
                    <path d="M1 5.5C47.6667 2.16667 141 -2.4 199 5.5" stroke="url(#paint0_linear)" strokeWidth="3" strokeLinecap="round"/>
                    <defs>
                      <linearGradient id="paint0_linear" x1="1" y1="6" x2="199" y2="6">
                        <stop stopColor="#a855f7"/>
                        <stop offset="1" stopColor="#8b5cf6"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </span>
              </h1>
              
              <p className="text-xl text-gray-400 mb-8 max-w-xl leading-relaxed">
              Empowering patients, supporting families, and assisting healthcare professionals through an advanced AI-powered care system designed specifically for Alzheimer’s patients.
              </p>
              
              <div className="flex justify-start mb-12">
                <Link
                  to="/dashboard"
                  className="group w-full sm:w-auto px-6 sm:px-10 py-4 sm:py-5 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/50 transition-all duration-300 hover:-translate-y-1 flex items-center justify-center gap-3 text-base sm:text-lg"
                >
                  <PlayCircleIcon />
                  <span>Explore Dashboards</span>
                  <ChevronRightIcon className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              {/* Trust Indicators */}
              <div className="flex items-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-2 text-gray-400">
                  <CheckCircleIcon />
                  <span>Free 30-day trial</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <CheckCircleIcon />
                  <span>No credit card required</span>
                </div>
              </div>
            </div>

            {/* Hero Visual - Animated SVG */}
            <div className={`relative transition-all duration-1000 delay-300 ${heroVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}>
              <div className="relative flex items-center justify-center">
                {/* Subtle Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-violet-600/20 rounded-full blur-3xl scale-75" />
                
                {/* Animated SVG */}
                <img 
                  src="/images/alzheimer-animate.svg" 
                  alt="Alzheimer's Care Animation" 
                  className="relative w-full max-w-lg lg:max-w-xl h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TRUSTED BY - Infinite Loop ===== */}
    

      {/* ===== FEATURES SECTION ===== */}
      <section ref={featuresRef} className="py-24 bg-[#0a0118] relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto px-4 relative">
          {/* Section Header with AOS */}
          <div className="text-center mb-20">
            <span 
              data-aos="fade-down"
              data-aos-duration="600"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500/20 to-violet-500/20 border border-purple-500/30 text-purple-300 font-medium text-sm rounded-full mb-6"
            >
              <BrainIcon className="h-4 w-4" />
              Comprehensive Care Platform
            </span>
            <h2 
              data-aos="fade-up"
              data-aos-duration="800"
              data-aos-delay="100"
              className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6"
            >
              Everything You Need for{' '}
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-violet-400 bg-clip-text text-transparent">
                Alzheimer's Care
              </span>
            </h2>
            <p 
              data-aos="fade-up"
              data-aos-duration="800"
              data-aos-delay="200"
              className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed"
            >
              Our AI system provides holistic support covering all aspects of Alzheimer's management, 
              from daily care to emergency response.
            </p>
          </div>

          {/* Features Grid with Dynamic AOS Animations */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {features.map((feature, index) => {
              const animation = getFeatureAnimation(index);
              return (
                <div
                  key={index}
                  data-aos={animation.aos}
                  data-aos-duration="800"
                  data-aos-delay={animation.delay}
                  data-aos-anchor-placement="top-bottom"
                  className="group relative bg-gradient-to-br from-white/[0.05] to-white/[0.02] rounded-2xl p-8 border border-white/[0.08] hover:border-purple-500/40 transition-all duration-500 hover:-translate-y-2 overflow-hidden"
                >
                  {/* Hover glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-600/0 to-violet-600/0 group-hover:from-purple-600/10 group-hover:to-violet-600/5 transition-all duration-500" />
                  
                  <div className="relative">
                    <div 
                      className={`h-14 w-14 rounded-xl bg-gradient-to-br ${feature.gradient} p-3.5 text-white mb-6 shadow-lg shadow-purple-500/25 group-hover:scale-110 group-hover:shadow-purple-500/40 transition-all duration-300`}
                    >
                      <feature.icon />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3 group-hover:text-purple-200 transition-colors">{feature.title}</h3>
                    <p className="text-gray-400 leading-relaxed">{feature.description}</p>
                    
                    {/* Bottom accent line */}
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500/0 via-purple-500/50 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA Button with AOS */}
          <div 
            data-aos="zoom-in"
            data-aos-duration="600"
            data-aos-delay="400"
            className="text-center mt-16"
          >
            <Link
              to="/features"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/50 transition-all duration-300 hover:-translate-y-1 group"
            >
              <span>Explore All Features</span>
              <ChevronRightIcon className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* ===== GLOBAL AWARENESS SECTION ===== */}
      <section 
        ref={awarenessRef} 
        className="relative overflow-hidden"
        style={{ background: '#060010' }}
      >
        {/* Top Content */}
        <div className="relative z-10 pt-24 pb-12 max-w-5xl mx-auto px-4 text-center">
          <div className={`transition-all duration-1000 ${awarenessVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            {/* Stats Badge */}
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 mb-8">
              <span className="text-4xl font-bold text-white">55M+</span>
              <span className="text-purple-200 text-sm text-left leading-tight">
                People living with<br />dementia worldwide
              </span>
            </div>

            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Millions Are Struggling.{' '}
              <span className="bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent">
                Most Go Unnoticed.
              </span>
            </h2>

            <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Every 3 seconds, someone in the world develops dementia. Behind every statistic 
              is a person—a parent, a grandparent, a friend—who deserves compassionate care.
            </p>
          </div>
        </div>

        {/* Interactive DomeGallery - Full Width */}
        <div className="relative w-full h-[500px] md:h-[600px] lg:h-[700px]">
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          }>
            <DomeGallery
              images={awarenessImages}
              fit={0.7}
              minRadius={350}
              maxRadius={700}
              overlayBlurColor="#060010"
              grayscale={false}
              segments={25}
              imageBorderRadius="16px"
            />
          </Suspense>
          
          {/* Hint text */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 text-white/70 text-sm">
              <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
              </svg>
              <span>Drag to explore</span>
            </div>
          </div>
        </div>

        {/* Bottom Content */}
        <div className="relative z-10 py-16 max-w-5xl mx-auto px-4">
          <div className={`transition-all duration-1000 ${awarenessVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
              {[
                { number: '10M+', label: 'New cases every year' },
                { number: '60%', label: 'Live in low-income countries' },
                { number: '75%', label: 'Remain undiagnosed globally' },
              ].map((stat, i) => (
                <div 
                  key={i} 
                  className={`p-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 text-center transition-all duration-700 ${
                    awarenessVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                  }`}
                  style={{ transitionDelay: `${i * 150 + 300}ms` }}
                >
                  <div className="text-3xl md:text-4xl font-bold text-purple-400 mb-2">{stat.number}</div>
                  <div className="text-gray-400 text-sm">{stat.label}</div>
                </div>
              ))}
            </div>

            <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto text-center">
              We believe technology can bridge this gap. Our AI-powered platform helps families 
              provide better care, supports healthcare professionals, and most importantly—
              <span className="text-white font-medium"> gives voice to those who are fading away.</span>
            </p>

            <div className="flex justify-center gap-3 sm:gap-4">
              <Link
                to="/about"
                className="px-4 sm:px-8 py-3 sm:py-4 bg-white text-gray-900 font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex items-center gap-2 text-sm sm:text-base"
              >
                <span>Learn Our Mission</span>
                <ChevronRightIcon />
              </Link>
              <Link
                to="/auth/signup"
                className="px-4 sm:px-8 py-3 sm:py-4 border-2 border-purple-400/50 text-white font-semibold rounded-xl hover:bg-purple-500/20 transition-all duration-300 flex items-center gap-2 text-sm sm:text-base"
              >
                <span>Join the Movement</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-purple-900/50 to-transparent pointer-events-none" />
      </section>

      {/* ===== STATS SECTION ===== */}
      <section ref={statsRef} className="py-24 bg-gradient-to-r from-purple-600/20 via-purple-700/20 to-violet-600/20 relative overflow-hidden border-y border-purple-500/10">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
        
        <div className="max-w-7xl mx-auto px-4 relative">
          <div className={`text-center mb-16 transition-all duration-700 ${statsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Making a Real Difference
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Join thousands of families and healthcare professionals who trust ALZCare.eg
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div
                key={index}
                className={`text-center p-6 bg-white/[0.03] rounded-2xl border border-white/[0.05] transition-all duration-700 ${
                  statsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent mb-2">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </div>
                <p className="text-gray-400 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      <section className="py-24 px-4 bg-[#0a0118]">
        <div className="max-w-5xl mx-auto">
          <div className="relative bg-gradient-to-r from-purple-600/20 via-purple-700/20 to-violet-600/20 backdrop-blur-xl rounded-3xl p-12 md:p-16 border border-purple-500/20 overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-0 left-0 w-40 h-40 bg-purple-500 rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-0 w-60 h-60 bg-violet-500 rounded-full blur-3xl" />
            </div>
            
            <div className="relative text-center">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                Ready to Transform Alzheimer's Care?
              </h2>
              <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
                Join thousands of families and healthcare professionals who are already 
                experiencing the future of compassionate AI-powered care.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  to="/auth/signup"
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-all duration-300 hover:-translate-y-1 flex items-center gap-2"
                >
                  Start Free Trial
                  <ChevronRightIcon />
                </Link>
                <Link
                  to="/about"
                  className="px-8 py-4 border-2 border-white/10 text-white font-semibold rounded-xl hover:bg-white/[0.05] transition-all duration-300 flex items-center gap-2"
                >
                  Learn More
                </Link>
              </div>
              <p className="mt-8 text-gray-500 text-sm">
                No credit card required • 30-day free trial • Cancel anytime
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
