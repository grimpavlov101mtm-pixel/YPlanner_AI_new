import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAppStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { Users, AlertCircle, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Staff {
  id: string;
  name: string;
  skills: string[];
  is_active: boolean;
  bookings_count?: number;
  total_hours?: number;
  load_percentage?: number;
}

export function StaffPage() {
  const { selectedBranchId, horizon, timeGrain, setHorizon, setTimeGrain } = useAppStore();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);

  useEffect(() => {
    if (selectedBranchId) {
      loadStaffData();
    }
  }, [selectedBranchId, horizon]);

  const loadStaffData = async () => {
    if (!selectedBranchId) return;

    setLoading(true);
    try {
      const now = new Date();
      let startDate = new Date(now);
      let endDate = new Date(now);

      if (horizon === 'week') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7 * 5);
      } else if (horizon === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      } else if (horizon === 'quarter') {
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        endDate = new Date(now.getFullYear(), quarter * 3 + 4, 0);
      } else if (horizon === 'year') {
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 12, 0);
      }

      const [staffRes, bookingsRes] = await Promise.all([
        supabase
          .from('staff')
          .select('*')
          .eq('branch_id', selectedBranchId),
        supabase
          .from('bookings')
          .select('staff_id, starts_at_utc, ends_at_utc')
          .eq('branch_id', selectedBranchId)
          .gte('starts_at_utc', startDate.toISOString())
          .lte('starts_at_utc', endDate.toISOString())
          .neq('status', 'cancelled'),
      ]);

      if (staffRes.error) {
        console.error('Error loading staff:', staffRes.error);
      }
      if (bookingsRes.error) {
        console.error('Error loading bookings for staff:', bookingsRes.error);
      }

      const staffData = staffRes.data || [];
      const bookingsData = bookingsRes.data || [];

      const staffWithMetrics = staffData.map((s) => {
        const staffBookings = bookingsData.filter((b) => b.staff_id === s.id);
        const totalMinutes = staffBookings.reduce((sum, b) => {
          const start = new Date(b.starts_at_utc);
          const end = new Date(b.ends_at_utc);
          return sum + (end.getTime() - start.getTime()) / (1000 * 60);
        }, 0);

        const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const workingHoursPerDay = 8;
        const totalPossibleMinutes = daysInPeriod * workingHoursPerDay * 60;
        const loadPercentage = totalPossibleMinutes > 0 ? Math.round((totalMinutes / totalPossibleMinutes) * 100) : 0;

        return {
          ...s,
          bookings_count: staffBookings.length,
          total_hours: Math.round(totalMinutes / 60 * 10) / 10,
          load_percentage: Math.min(loadPercentage, 100),
        };
      });

      staffWithMetrics.sort((a, b) => (b.load_percentage || 0) - (a.load_percentage || 0));
      setStaff(staffWithMetrics);
    } catch (error) {
      console.error('Error loading staff data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLoadColor = (load: number) => {
    if (load >= 80) return '#ef4444';
    if (load >= 60) return '#f59e0b';
    if (load >= 40) return '#3b82f6';
    return '#10b981';
  };

  const chartData = staff
    .filter((s) => s.is_active)
    .map((s) => ({
      name: s.name.split(' ')[0],
      load: s.load_percentage || 0,
    }));

  const activeStaff = staff.filter((s) => s.is_active);
  const avgLoad = activeStaff.length > 0
    ? Math.round(activeStaff.reduce((sum, s) => sum + (s.load_percentage || 0), 0) / activeStaff.length)
    : 0;
  const totalBookings = staff.reduce((sum, s) => sum + (s.bookings_count || 0), 0);

  if (!selectedBranchId) {
    return (
      <Layout>
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-700 mb-2">Выберите филиал</h2>
          <p className="text-slate-600">
            Для просмотра статистики сотрудников выберите филиал в верхнем меню
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Сотрудники</h1>
            <p className="text-slate-600 mt-1">Анализ загруженности персонала</p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-slate-700">Горизонт:</label>
              <select
                value={horizon}
                onChange={(e) => setHorizon(e.target.value as any)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="week">Неделя</option>
                <option value="month">Месяц</option>
                <option value="quarter">Квартал</option>
                <option value="year">Год</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Загрузка данных...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Всего сотрудников</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{staff.length}</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {activeStaff.length} активных
                    </p>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Средняя загрузка</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{avgLoad}%</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {avgLoad >= 70 ? 'Высокая' : avgLoad >= 40 ? 'Средняя' : 'Низкая'}
                    </p>
                  </div>
                  <div className="bg-amber-100 p-3 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Всего записей</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{totalBookings}</p>
                    <p className="text-sm text-slate-500 mt-1">
                      За выбранный период
                    </p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Загруженность сотрудников</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" />
                  <YAxis stroke="#64748b" label={{ value: '%', angle: 0, position: 'top' }} />
                  <Tooltip />
                  <Bar dataKey="load" radius={[8, 8, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getLoadColor(entry.load)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900">Детальная информация</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                        Сотрудник
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                        Навыки
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider">
                        Записей
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider">
                        Часов
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider">
                        Загрузка
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider">
                        Статус
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {staff.map((s) => (
                      <tr
                        key={s.id}
                        className="hover:bg-slate-50 transition cursor-pointer"
                        onClick={() => setSelectedStaff(selectedStaff === s.id ? null : s.id)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <Users className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-slate-900">{s.name}</div>
                              <div className="text-sm text-slate-500">ID: {s.id.slice(0, 8)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {(s.skills || []).slice(0, 3).map((skill, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-medium text-slate-900">{s.bookings_count || 0}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center">
                            <Clock className="w-4 h-4 text-slate-400 mr-1" />
                            <span className="text-sm font-medium text-slate-900">{s.total_hours || 0}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center">
                            <div className="w-24 bg-slate-200 rounded-full h-2 mr-2">
                              <div
                                className="h-2 rounded-full transition-all"
                                style={{
                                  width: `${s.load_percentage || 0}%`,
                                  backgroundColor: getLoadColor(s.load_percentage || 0),
                                }}
                              />
                            </div>
                            <span className="text-sm font-medium text-slate-900">
                              {s.load_percentage || 0}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {s.is_active ? (
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                              Активен
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                              Неактивен
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
