'use client';

import React, { createContext, useContext, useState } from 'react';

interface DashboardContextType {
  range: string;
  setRange: (range: string) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [range, setRange] = useState('30d');

  return (
    <DashboardContext.Provider value={{ range, setRange }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardContext() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboardContext must be used within a DashboardProvider');
  }
  return context;
}
