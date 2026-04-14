import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../modules/shared/auth/AuthContext';

// ===== ICONS =====
const UserCircleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="10" r="3"/>
    <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/>
  </svg>
);

const ShieldIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
    <path d="m9 12 2 2 4-4"/>
  </svg>
);

const EyeIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
    <line x1="2" x2="22" y1="2" y2="22"/>
  </svg>
);

const StethoscopeIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
    <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/>
    <circle cx="20" cy="10" r="2"/>
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

const UserIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const LockIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const MailIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);

const SmartphoneIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="20" x="5" y="2" rx="2" ry="2"/>
    <path d="M12 18h.01"/>
  </svg>
);

const BuildingIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="16" height="20" x="4" y="2" rx="2" ry="2"/>
    <path d="M9 22v-4h6v4"/>
    <path d="M8 6h.01"/>
    <path d="M16 6h.01"/>
    <path d="M12 6h.01"/>
    <path d="M12 10h.01"/>
    <path d="M12 14h.01"/>
    <path d="M16 10h.01"/>
    <path d="M16 14h.01"/>
    <path d="M8 10h.01"/>
    <path d="M8 14h.01"/>
  </svg>
);

const BrainIcon = () => (
  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.54"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.54"/>
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14"/>
    <path d="m12 5 7 7-7 7"/>
  </svg>
);

const LoadingSpinner = () => (
  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
  </svg>
);

// ===== MAIN COMPONENT =====
const AuthPages = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { doctorLogin, familyLogin, patientLogin, doctorSignup, error, clearError } = useAuth();
  
  const [showPassword, setShowPassword] = useState(false);
  const [userType, setUserType] = useState('family');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    licenseNumber: '',
    rememberMe: false,
    agreeTerms: false,
  });

  const isLoginPage = location.pathname.includes('/login') || location.pathname === '/auth' || location.pathname === '/auth/';
  const isSignupPage = location.pathname.includes('/signup');

  // Sync userType based on query params if any (optional)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const type = params.get('type');
    if (type && ['family', 'doctor', 'patient'].includes(type)) {
      setUserType(type);
    }
    clearError();
  }, [location.pathname, location.search]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (error) clearError();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (isLoginPage) {
        if (userType === 'doctor') {
          await doctorLogin(formData.email, formData.password);
          navigate('/doctor/dashboard');
        } else if (userType === 'family') {
          await familyLogin(formData.email, formData.password);
          navigate('/family/dashboard');
        } else if (userType === 'patient') {
          await patientLogin(formData.email, formData.password);
          navigate('/patient');
        }
      } else {
        // Signup logic
        if (userType === 'doctor') {
          await doctorSignup({
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            password: formData.password,
            licenseNumber: formData.licenseNumber
          });
          navigate('/doctor/dashboard');
        } else if (userType === 'family') {
          // Family signup logic (usually not public, but we can call an API if exists)
          alert('Family registration is typically handled by your doctor. Please contact them to create an account.');
        } else {
          alert('Patient accounts are created by doctors. Please use your assigned login credentials.');
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const userTypes = [
    { 
      id: 'patient', 
      label: 'Patient', 
      icon: UserIcon,
      description: 'Access your care tools'
    },
    { 
      id: 'family', 
      label: 'Family', 
      icon: UsersIcon,
      description: 'Monitor loved ones'
    },
    { 
      id: 'doctor', 
      label: 'Doctor', 
      icon: StethoscopeIcon,
      description: 'Clinical dashboard'
    },
  ];

  const features = [
    'HIPAA Compliant Security',
    '24/7 AI Assistance',
    'Real-time Monitoring',
    'Secure Data Encryption',
  ];

  return (
    <div className="min-h-screen bg-[#0a0118] flex items-center justify-center p-4 pt-24 pb-12">
      {/* Background Decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl w-full">
        <div className="grid lg:grid-cols-2 gap-8 items-stretch">
          {/* Left Panel - Branding */}
          <div className="hidden lg:flex flex-col bg-gradient-to-br from-purple-600 via-purple-700 to-purple-900 rounded-3xl p-10 text-white shadow-2xl relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 bg-grid-pattern" />
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-400/20 rounded-full blur-3xl" />

            <div className="relative z-10 flex flex-col h-full">
              {/* Logo */}
              <div className="flex items-center gap-3 mb-10">
                <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
                  <BrainIcon />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">ALZCare.eg</h1>
                  <p className="text-purple-200 text-sm">AI-Powered Alzheimer's Care</p>
                </div>
              </div>

              {/* Main Content */}
              <div className="flex-1">
                <h2 className="text-3xl font-bold mb-4 leading-tight">
                  {isLoginPage ? 'Welcome Back' : 'Join Our Care Network'}
                </h2>
                <p className="text-purple-200 mb-8 leading-relaxed">
                  {isLoginPage 
                    ? 'Secure access to our AI-powered Alzheimer\'s care platform for patients, families, and medical professionals.'
                    : 'Start your journey with the most advanced AI-assisted Alzheimer\'s care system trusted by leading hospitals.'
                  }
                </p>

                {/* Features List */}
                <div className="space-y-4">
                  {features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center">
                        <CheckCircleIcon />
                      </div>
                      <span className="font-medium">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trust Badges */}
              <div className="mt-auto pt-10 border-t border-white/20">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-white/10 rounded-xl">
                    <ShieldIcon />
                    <div>
                      <p className="font-semibold text-sm">HIPAA Compliant</p>
                      <p className="text-xs text-purple-200">Enterprise Security</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white/10 rounded-xl">
                    <UserCircleIcon />
                    <div>
                      <p className="font-semibold text-sm">Role-Based</p>
                      <p className="text-xs text-purple-200">Custom Dashboards</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Auth Form */}
          <div className="bg-white/[0.03] backdrop-blur-xl rounded-3xl p-8 lg:p-10 border border-white/[0.08]">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
                <BrainIcon />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">ALZCare.eg</h1>
                <p className="text-xs text-gray-500">AI-Powered Care</p>
              </div>
            </div>

            {/* Form Header */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">
                {isLoginPage ? 'Sign In' : 'Create Account'}
              </h2>
              <p className="text-gray-400">
                {isLoginPage 
                  ? 'Access your personalized dashboard'
                  : 'Select your role to get started'
                }
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Role Selection */}
            <div className="mb-8">
              <p className="text-sm font-medium text-gray-300 mb-3">I am a:</p>
              <div className="grid grid-cols-3 gap-3">
                {userTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      setUserType(type.id);
                      clearError();
                    }}
                    className={`p-4 rounded-xl border-2 transition-all duration-300 text-center ${
                      userType === type.id
                        ? 'border-purple-500 bg-purple-500/20 shadow-md'
                        : 'border-white/10 hover:border-purple-500/30 hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center mx-auto mb-2 transition-colors ${
                      userType === type.id ? 'bg-purple-600 text-white' : 'bg-white/[0.05] text-gray-400'
                    }`}>
                      <type.icon />
                    </div>
                    <span className={`font-medium text-sm block ${userType === type.id ? 'text-purple-300' : 'text-gray-300'}`}>
                      {type.label}
                    </span>
                    <span className="text-xs text-gray-500 hidden sm:block truncate">{type.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {isSignupPage && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3.5 bg-white/[0.05] border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:bg-white/[0.08] focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 outline-none transition-all"
                      placeholder="Ahmed"
                      required={isSignupPage}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3.5 bg-white/[0.05] border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:bg-white/[0.08] focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 outline-none transition-all"
                      placeholder="Nada"
                      required={isSignupPage}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                    <MailIcon />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full pl-12 pr-4 py-3.5 bg-white/[0.05] border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:bg-white/[0.08] focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 outline-none transition-all"
                    placeholder="ahmed.nada@example.com"
                    required
                  />
                </div>
              </div>

              {isSignupPage && userType === 'doctor' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Medical License Number
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                      <StethoscopeIcon />
                    </div>
                    <input
                      type="text"
                      name="licenseNumber"
                      value={formData.licenseNumber}
                      onChange={handleInputChange}
                      className="w-full pl-12 pr-4 py-3.5 bg-white/[0.05] border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:bg-white/[0.08] focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 outline-none transition-all"
                      placeholder="Enter license number"
                      required={isSignupPage && userType === 'doctor'}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                    <LockIcon />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full pl-12 pr-12 py-3.5 bg-white/[0.05] border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:bg-white/[0.08] focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 outline-none transition-all"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {isLoginPage && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="rememberMe"
                      checked={formData.rememberMe}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-purple-600 rounded focus:ring-purple-500 bg-white/[0.05] border-white/20"
                    />
                    <span className="text-sm text-gray-400">Remember me</span>
                  </label>
                  <Link
                    to="/auth/forgot-password"
                    className="text-sm text-purple-400 hover:text-purple-300 font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}

              {isSignupPage && (
                <div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="agreeTerms"
                      checked={formData.agreeTerms}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-purple-600 rounded focus:ring-purple-500 bg-white/[0.05] border-white/20 mt-1"
                      required
                    />
                    <span className="text-sm text-gray-400 leading-relaxed">
                      I agree to the <a href="#" className="text-purple-400 hover:underline">Terms of Service</a> and{' '}
                      <a href="#" className="text-purple-400 hover:underline">Privacy Policy</a>. I understand that my data 
                      will be handled in accordance with HIPAA regulations.
                    </span>
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <LoadingSpinner />
                ) : (
                  <>
                    <span>{isLoginPage ? 'Sign In' : 'Create Account'}</span>
                    <ArrowRightIcon className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="my-8 flex items-center gap-4">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <span className="text-gray-500 text-sm">Or continue with</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>

            {/* Alternative Auth */}
            <div className="grid grid-cols-2 gap-4">
              <button className="flex items-center justify-center gap-3 p-3.5 border-2 border-white/10 rounded-xl hover:border-purple-500/30 hover:bg-white/[0.03] transition-all">
                <SmartphoneIcon className="text-gray-400" />
                <span className="font-medium text-gray-300">Phone</span>
              </button>
              <button className="flex items-center justify-center gap-3 p-3.5 border-2 border-white/10 rounded-xl hover:border-purple-500/30 hover:bg-white/[0.03] transition-all">
                <BuildingIcon className="text-gray-400" />
                <span className="font-medium text-gray-300">Hospital SSO</span>
              </button>
            </div>

            {/* Switch Auth Type */}
            <div className="mt-8 text-center">
              <p className="text-gray-400">
                {isLoginPage ? "Don't have an account?" : "Already have an account?"}
                <Link
                  to={isLoginPage ? "/auth/signup" : "/auth/login"}
                  className="ml-2 text-purple-400 hover:text-purple-300 font-semibold"
                >
                  {isLoginPage ? 'Create account' : 'Sign in'}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPages;
