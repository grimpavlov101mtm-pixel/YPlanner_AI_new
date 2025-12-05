import { create } from 'zustand';
import { User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  org_id: string | null;
  full_name: string | null;
  phone: string | null;
  role: 'ORG_ADMIN' | 'BRANCH_ADMIN' | 'BRANCH_MANAGER' | 'BRANCH_ANALYST';
}

interface Branch {
  id: string;
  org_id: string;
  name: string;
  yclients_company_id: number;
  yclients_branch_id: number;
}

interface AppState {
  user: User | null;
  profile: Profile | null;
  selectedBranchId: string | null;
  branches: Branch[];
  horizon: 'week' | 'month' | 'quarter' | 'year';
  timeGrain: 'day' | 'week' | 'month';

  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setSelectedBranchId: (branchId: string | null) => void;
  setBranches: (branches: Branch[]) => void;
  setHorizon: (horizon: 'week' | 'month' | 'quarter' | 'year') => void;
  setTimeGrain: (timeGrain: 'day' | 'week' | 'month') => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  profile: null,
  selectedBranchId: typeof window !== 'undefined' ? localStorage.getItem('selectedBranchId') : null,
  branches: [],
  horizon: 'week',
  timeGrain: 'day',

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setSelectedBranchId: (branchId) => {
    if (typeof window !== 'undefined' && branchId) {
      localStorage.setItem('selectedBranchId', branchId);
    } else if (typeof window !== 'undefined' && !branchId) {
      localStorage.removeItem('selectedBranchId');
    }
    set({ selectedBranchId: branchId });
  },
  setBranches: (branches) => set({ branches }),
  setHorizon: (horizon) => set({ horizon }),
  setTimeGrain: (timeGrain) => set({ timeGrain }),
}));
