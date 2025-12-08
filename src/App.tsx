import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from './lib/supabase';
import { useAppStore } from './lib/store';
import { LoginPage } from './pages/LoginPage';
import { YclientsMarketplaceAuthPage } from './pages/YclientsMarketplaceAuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { ServicesPage } from './pages/ServicesPage';
import { CalendarPage } from './pages/CalendarPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { AdminIntegrationsPage } from './pages/AdminIntegrationsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  const [loading, setLoading] = useState(true);
  const { user, selectedBranchId, setUser, setProfile, setBranches, setSelectedBranchId } = useAppStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Auth session error:', error);
        setLoading(false);
        return;
      }
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(err => {
      console.error('Auth initialization error:', err);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId: string) => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        setLoading(false);
        return;
      }

      if (profile) {
        setProfile(profile);

        if (profile.org_id) {
          const { data: branches, error: branchesError } = await supabase
            .from('branches')
            .select('*')
            .eq('org_id', profile.org_id);

          if (branchesError) {
            console.error('Branches fetch error:', branchesError);
          } else if (branches && branches.length > 0) {
            setBranches(branches);
            if (!selectedBranchId) {
              setSelectedBranchId(branches[0].id);
            }
          }
        }
      } else {
        const { error } = await supabase.from('profiles').insert({
          id: userId,
          role: 'BRANCH_MANAGER',
        });

        if (error) {
          console.error('Profile creation error:', error);
        } else {
          await loadUserData(userId);
          return;
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-slate-300 text-lg">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={user ? <Navigate to="/" replace /> : <LoginPage />}
          />
          <Route
            path="/yclients-marketplace/signup"
            element={<YclientsMarketplaceAuthPage />}
          />
          <Route
            path="/"
            element={user ? <DashboardPage /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/services"
            element={user ? <ServicesPage /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/calendar"
            element={user ? <CalendarPage /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/admin/settings"
            element={user ? <AdminSettingsPage /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/admin/integrations"
            element={user ? <AdminIntegrationsPage /> : <Navigate to="/login" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
