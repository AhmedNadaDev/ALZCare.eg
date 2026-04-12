import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { patientsAPI } from '../api';

// ===== ICONS =====
const ArrowLeftIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7"/>
    <path d="M19 12H5"/>
  </svg>
);

const UserIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const MailIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);

const LockIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const UsersIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const CheckIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const LoadingSpinner = () => (
  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
  </svg>
);

const AddPatient = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [patientImage, setPatientImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  const [formData, setFormData] = useState({
    // Patient Info
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    age: '',
    gender: '',
    alzheimerLevel: '',
    description: '',
    // Family Account (Mandatory)
    family: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      phone: '',
      relationship: 'caregiver',
    }
  });

  const [formErrors, setFormErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.startsWith('family.')) {
      const familyField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        family: {
          ...prev.family,
          [familyField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Auto-calculate age from DOB
  const handleDateOfBirthChange = (e) => {
    const dob = e.target.value;
    setFormData(prev => ({ ...prev, dateOfBirth: dob }));
    
    if (dob) {
      const today = new Date();
      const birthDate = new Date(dob);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      setFormData(prev => ({ ...prev, age: age.toString() }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setFormErrors(prev => ({ ...prev, patientImage: 'Image size must be less than 5MB' }));
        return;
      }
      setPatientImage(file);
      setFormErrors(prev => ({ ...prev, patientImage: '' }));
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    const errors = {};
    
    // Patient validation
    if (!formData.firstName.trim()) errors.firstName = 'First name is required';
    if (!formData.lastName.trim()) errors.lastName = 'Last name is required';
    if (!formData.dateOfBirth) errors.dateOfBirth = 'Date of birth is required';
    if (!formData.age) errors.age = 'Age is required';
    if (!formData.gender) errors.gender = 'Gender is required';
    if (!formData.alzheimerLevel) errors.alzheimerLevel = 'Alzheimer level is required';
    if (!patientImage) errors.patientImage = 'Patient profile image is required';
    
    // Family validation
    if (!formData.family.firstName.trim()) errors['family.firstName'] = 'Family first name is required';
    if (!formData.family.lastName.trim()) errors['family.lastName'] = 'Family last name is required';
    if (!formData.family.email) {
      errors['family.email'] = 'Family email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.family.email)) {
      errors['family.email'] = 'Please enter a valid email';
    }
    if (!formData.family.password) {
      errors['family.password'] = 'Family password is required';
    } else if (formData.family.password.length < 8) {
      errors['family.password'] = 'Password must be at least 8 characters';
    }
    if (!formData.family.relationship) errors['family.relationship'] = 'Relationship is required';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    try {
      // Create FormData for file upload
      const formDataToSend = new FormData();
      
      // Add patient data
      Object.keys(formData).forEach(key => {
        if (key !== 'family') {
          formDataToSend.append(key, formData[key]);
        }
      });
      
      // Add family data as JSON string
      formDataToSend.append('family', JSON.stringify(formData.family));
      
      // Add image
      if (patientImage) {
        formDataToSend.append('patientImage', patientImage);
      }
      
      await patientsAPI.create(formDataToSend);
      setSuccess(true);
      setTimeout(() => {
        navigate('/doctor/dashboard');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to create patient');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0118] flex items-center justify-center p-4">
        <div className="bg-white/[0.03] rounded-3xl p-12 border border-white/[0.08] text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckIcon className="h-10 w-10 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Patient Added Successfully!</h2>
          <p className="text-gray-400 mb-4">
            The patient and their family account have been created.
          </p>
          <p className="text-sm text-purple-400">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0118] pt-8 pb-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <Link
          to="/doctor/dashboard"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeftIcon />
          <span>Back to Dashboard</span>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Add New Patient</h1>
          <p className="text-gray-400">
            Create a new patient record and their family member account.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Patient Information */}
          <div className="bg-white/[0.03] rounded-2xl border border-white/[0.08] p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                <UserIcon />
              </div>
              <h2 className="text-xl font-bold text-white">Patient Information</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Patient Image Upload */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">Patient Profile Image *</label>
                <div className="flex items-center gap-6">
                  <div className="flex-shrink-0">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="h-24 w-24 rounded-full object-cover border-2 border-purple-500/30"
                      />
                    ) : (
                      <div className="h-24 w-24 rounded-full bg-gradient-to-br from-purple-500/30 to-violet-500/30 flex items-center justify-center border-2 border-dashed border-white/20">
                        <UserIcon className="h-8 w-8 text-gray-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className={`w-full px-4 py-3 bg-white/[0.05] border-2 ${
                        formErrors.patientImage ? 'border-red-500' : 'border-white/10'
                      } rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-500/20 file:text-purple-400 hover:file:bg-purple-500/30 file:cursor-pointer focus:border-purple-500 outline-none transition-all`}
                    />
                    {formErrors.patientImage && <p className="mt-1 text-sm text-red-400">{formErrors.patientImage}</p>}
                    <p className="mt-1 text-xs text-gray-500">Upload a profile image for the patient (max 5MB)</p>
                  </div>
                </div>
              </div>

              {/* First Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 bg-white/[0.05] border-2 ${
                    formErrors.firstName ? 'border-red-500' : 'border-white/10'
                  } rounded-xl text-white placeholder-gray-500 focus:border-purple-500 outline-none transition-all`}
                  placeholder="Patient's first name"
                />
                {formErrors.firstName && <p className="mt-1 text-sm text-red-400">{formErrors.firstName}</p>}
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Last Name *</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 bg-white/[0.05] border-2 ${
                    formErrors.lastName ? 'border-red-500' : 'border-white/10'
                  } rounded-xl text-white placeholder-gray-500 focus:border-purple-500 outline-none transition-all`}
                  placeholder="Patient's last name"
                />
                {formErrors.lastName && <p className="mt-1 text-sm text-red-400">{formErrors.lastName}</p>}
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Date of Birth *</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleDateOfBirthChange}
                  className={`w-full px-4 py-3 bg-white/[0.05] border-2 ${
                    formErrors.dateOfBirth ? 'border-red-500' : 'border-white/10'
                  } rounded-xl text-white focus:border-purple-500 outline-none transition-all`}
                />
                {formErrors.dateOfBirth && <p className="mt-1 text-sm text-red-400">{formErrors.dateOfBirth}</p>}
              </div>

              {/* Age */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Age *</label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 bg-white/[0.05] border-2 ${
                    formErrors.age ? 'border-red-500' : 'border-white/10'
                  } rounded-xl text-white placeholder-gray-500 focus:border-purple-500 outline-none transition-all`}
                  placeholder="Age"
                  min="0"
                  max="150"
                />
                {formErrors.age && <p className="mt-1 text-sm text-red-400">{formErrors.age}</p>}
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Gender *</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 bg-[#1a0a2e] border-2 ${
                    formErrors.gender ? 'border-red-500' : 'border-white/10'
                  } rounded-xl text-white focus:border-purple-500 outline-none transition-all`}
                  style={{ color: '#ffffff' }}
                >
                  <option value="" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Select gender</option>
                  <option value="male" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Male</option>
                  <option value="female" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Female</option>
                  <option value="other" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Other</option>
                </select>
                {formErrors.gender && <p className="mt-1 text-sm text-red-400">{formErrors.gender}</p>}
              </div>

              {/* Alzheimer Level */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Alzheimer's Stage *</label>
                <select
                  name="alzheimerLevel"
                  value={formData.alzheimerLevel}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 bg-[#1a0a2e] border-2 ${
                    formErrors.alzheimerLevel ? 'border-red-500' : 'border-white/10'
                  } rounded-xl text-white focus:border-purple-500 outline-none transition-all`}
                  style={{ color: '#ffffff' }}
                >
                  <option value="" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Select stage</option>
                  <option value="early" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Early Stage</option>
                  <option value="middle" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Middle Stage</option>
                  <option value="late" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Late Stage</option>
                </select>
                {formErrors.alzheimerLevel && <p className="mt-1 text-sm text-red-400">{formErrors.alzheimerLevel}</p>}
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">Description / Notes</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-4 py-3 bg-white/[0.05] border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 outline-none transition-all resize-none"
                  placeholder="Additional notes about the patient's condition..."
                />
              </div>
            </div>
          </div>

          {/* Family Account (Mandatory) */}
          <div className="bg-white/[0.03] rounded-2xl border border-purple-500/30 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                <UsersIcon />
              </div>
              <h2 className="text-xl font-bold text-white">Family Account</h2>
              <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs font-medium rounded-lg">Required</span>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              Create login credentials for a family member or caregiver who will monitor this patient.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Family First Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">First Name *</label>
                <input
                  type="text"
                  name="family.firstName"
                  value={formData.family.firstName}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 bg-white/[0.05] border-2 ${
                    formErrors['family.firstName'] ? 'border-red-500' : 'border-white/10'
                  } rounded-xl text-white placeholder-gray-500 focus:border-purple-500 outline-none transition-all`}
                  placeholder="Family member's first name"
                />
                {formErrors['family.firstName'] && <p className="mt-1 text-sm text-red-400">{formErrors['family.firstName']}</p>}
              </div>

              {/* Family Last Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Last Name *</label>
                <input
                  type="text"
                  name="family.lastName"
                  value={formData.family.lastName}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 bg-white/[0.05] border-2 ${
                    formErrors['family.lastName'] ? 'border-red-500' : 'border-white/10'
                  } rounded-xl text-white placeholder-gray-500 focus:border-purple-500 outline-none transition-all`}
                  placeholder="Family member's last name"
                />
                {formErrors['family.lastName'] && <p className="mt-1 text-sm text-red-400">{formErrors['family.lastName']}</p>}
              </div>

              {/* Family Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email *</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                    <MailIcon />
                  </div>
                  <input
                    type="email"
                    name="family.email"
                    value={formData.family.email}
                    onChange={handleInputChange}
                    className={`w-full pl-12 pr-4 py-3 bg-white/[0.05] border-2 ${
                      formErrors['family.email'] ? 'border-red-500' : 'border-white/10'
                    } rounded-xl text-white placeholder-gray-500 focus:border-purple-500 outline-none transition-all`}
                    placeholder="family@email.com"
                  />
                </div>
                {formErrors['family.email'] && <p className="mt-1 text-sm text-red-400">{formErrors['family.email']}</p>}
              </div>

              {/* Family Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Password *</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                    <LockIcon />
                  </div>
                  <input
                    type="password"
                    name="family.password"
                    value={formData.family.password}
                    onChange={handleInputChange}
                    className={`w-full pl-12 pr-4 py-3 bg-white/[0.05] border-2 ${
                      formErrors['family.password'] ? 'border-red-500' : 'border-white/10'
                    } rounded-xl text-white placeholder-gray-500 focus:border-purple-500 outline-none transition-all`}
                    placeholder="Create a password"
                  />
                </div>
                {formErrors['family.password'] && <p className="mt-1 text-sm text-red-400">{formErrors['family.password']}</p>}
                <p className="mt-1 text-xs text-gray-500">Minimum 8 characters</p>
              </div>

              {/* Relationship */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Relationship to Patient *</label>
                <select
                  name="family.relationship"
                  value={formData.family.relationship}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 bg-[#1a0a2e] border-2 ${
                    formErrors['family.relationship'] ? 'border-red-500' : 'border-white/10'
                  } rounded-xl text-white focus:border-purple-500 outline-none transition-all`}
                  style={{ color: '#ffffff' }}
                >
                  <option value="spouse" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Spouse</option>
                  <option value="child" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Child</option>
                  <option value="parent" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Parent</option>
                  <option value="sibling" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Sibling</option>
                  <option value="grandchild" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Grandchild</option>
                  <option value="caregiver" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Caregiver</option>
                  <option value="other" style={{ backgroundColor: '#1a0a2e', color: '#ffffff' }}>Other</option>
                </select>
                {formErrors['family.relationship'] && <p className="mt-1 text-sm text-red-400">{formErrors['family.relationship']}</p>}
              </div>

              {/* Phone (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Phone (Optional)</label>
                <input
                  type="tel"
                  name="family.phone"
                  value={formData.family.phone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/[0.05] border-2 border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 outline-none transition-all"
                  placeholder="+20 1XX XXX XXXX"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-4">
            <Link
              to="/doctor/dashboard"
              className="px-6 py-3 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isLoading}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Patient & Family Account</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPatient;
