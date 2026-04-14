import React from 'react';
import AIAssistantPanel from '../../../shared/components/AIAssistantPanel';
import { useAuth } from '../../../../modules/shared/auth/AuthContext';

const FamilyAssistantPage = () => {
  const { user } = useAuth();

  // Family members are linked to exactly one patient via user.patient
  const patientId = user?.patient?._id?.toString() || user?.patient?.toString() || null;
  const patientName =
    user?.patient?.firstName && user?.patient?.lastName
      ? `${user.patient.firstName} ${user.patient.lastName}`
      : null;

  return (
    <AIAssistantPanel
      roleLabel="Family"
      patientId={patientId}
      patientName={patientName}
    />
  );
};

export default FamilyAssistantPage;
