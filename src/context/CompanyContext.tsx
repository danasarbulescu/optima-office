"use client";

import { createContext, useContext, useState, ReactNode } from 'react';
import { COMPANIES } from '@/lib/companies';

interface CompanyContextValue {
  selectedCompany: string;
  setSelectedCompany: (id: string) => void;
}

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [selectedCompany, setSelectedCompany] = useState(COMPANIES[0].id);

  return (
    <CompanyContext.Provider value={{ selectedCompany, setSelectedCompany }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany(): CompanyContextValue {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
