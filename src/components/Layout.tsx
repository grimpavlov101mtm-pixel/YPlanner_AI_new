import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Settings, Link2, LogOut, ChevronDown, Plus, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../lib/store';
import { AddBranchModal } from './AddBranchModal';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const profile = useAppStore((state) => state.profile);
  const branches = useAppStore((state) => state.branches);
  const selectedBranchId = useAppStore((state) => state.selectedBranchId);
  const setSelectedBranchId = useAppStore((state) => state.setSelectedBranchId);
  const [showAnalyticsMenu, setShowAnalyticsMenu] = useState(false);
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleBranchChange = (value: string) => {
    if (value === 'add_new') {
      setShowAddBranchModal(true);
    } else {
      setSelectedBranchId(value);
    }
  };

  const analyticsPages = ['/', '/services'];
  const isAnalyticsActive = analyticsPages.includes(location.pathname);

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14">
            <div className="flex items-center space-x-6">
              <h1 className="text-lg font-bold text-slate-900">YPlanner AI</h1>

              <div className="flex items-center space-x-1">
                <div className="relative">
                  <button
                    onClick={() => setShowAnalyticsMenu(!showAnalyticsMenu)}
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium transition ${
                      isAnalyticsActive
                        ? 'text-blue-600'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4 mr-1.5" />
                    Аналитика
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </button>

                  {showAnalyticsMenu && (
                    <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                      <Link
                        to="/"
                        onClick={() => setShowAnalyticsMenu(false)}
                        className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Загруженность
                      </Link>
                      <Link
                        to="/services"
                        onClick={() => setShowAnalyticsMenu(false)}
                        className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Услуги
                      </Link>
                    </div>
                  )}
                </div>

                <Link
                  to="/calendar"
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium transition ${
                    location.pathname === '/calendar'
                      ? 'text-blue-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-4 h-4 mr-1.5" />
                  Календарь
                </Link>

                <Link
                  to="/admin/integrations"
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium transition ${
                    location.pathname === '/admin/integrations'
                      ? 'text-blue-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Link2 className="w-4 h-4 mr-1.5" />
                  Интеграции
                </Link>

                <Link
                  to="/admin/settings"
                  className={`inline-flex items-center p-2 text-sm font-medium transition ${
                    location.pathname === '/admin/settings'
                      ? 'text-blue-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Настройки"
                >
                  <Settings className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <select
                value={selectedBranchId || ''}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
                <option value="add_new">+ Добавить филиал</option>
              </select>

              <div className="flex items-center space-x-2">
                <div className="text-right">
                  <p className="text-xs font-medium text-slate-900">
                    {profile?.full_name || 'Пользователь'}
                  </p>
                  <p className="text-xs text-slate-500">{profile?.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Выйти"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {showAddBranchModal && (
        <AddBranchModal onClose={() => setShowAddBranchModal(false)} />
      )}
    </div>
  );
}
