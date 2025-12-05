import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAppStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { Briefcase, AlertCircle, TrendingUp, DollarSign, Clock, Award } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  is_mobile: boolean;
  bookings_count?: number;
  total_revenue?: number;
  total_hours?: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function ServicesPage() {
  const { selectedBranchId, horizon, setHorizon } = useAppStore();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedBranchId) {
      loadServicesData();
    }
  }, [selectedBranchId, horizon]);

  const loadServicesData = async () => {
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

      const [servicesRes, bookingsRes] = await Promise.all([
        supabase
          .from('services')
          .select('*')
          .eq('branch_id', selectedBranchId),
        supabase
          .from('bookings')
          .select('service_id, starts_at_utc, ends_at_utc')
          .eq('branch_id', selectedBranchId)
          .gte('starts_at_utc', startDate.toISOString())
          .lte('starts_at_utc', endDate.toISOString())
          .neq('status', 'cancelled'),
      ]);

      if (servicesRes.error) {
        console.error('Error loading services:', servicesRes.error);
      }
      if (bookingsRes.error) {
        console.error('Error loading bookings for services:', bookingsRes.error);
      }

      const servicesData = servicesRes.data || [];
      const bookingsData = bookingsRes.data || [];

      const servicesWithMetrics = servicesData.map((s) => {
        const serviceBookings = bookingsData.filter((b) => b.service_id === s.id);
        const totalMinutes = serviceBookings.reduce((sum, b) => {
          const start = new Date(b.starts_at_utc);
          const end = new Date(b.ends_at_utc);
          return sum + (end.getTime() - start.getTime()) / (1000 * 60);
        }, 0);

        return {
          ...s,
          bookings_count: serviceBookings.length,
          total_hours: Math.round(totalMinutes / 60 * 10) / 10,
          total_revenue: serviceBookings.length * 1500,
        };
      });

      servicesWithMetrics.sort((a, b) => (b.bookings_count || 0) - (a.bookings_count || 0));
      setServices(servicesWithMetrics);
    } catch (error) {
      console.error('Error loading services data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalBookings = services.reduce((sum, s) => sum + (s.bookings_count || 0), 0);
  const totalRevenue = services.reduce((sum, s) => sum + (s.total_revenue || 0), 0);
  const avgDuration = services.length > 0
    ? Math.round(services.reduce((sum, s) => sum + s.duration_minutes, 0) / services.length)
    : 0;

  const pieData = services
    .filter((s) => (s.bookings_count || 0) > 0)
    .slice(0, 8)
    .map((s) => ({
      name: s.name,
      value: s.bookings_count || 0,
    }));

  const barData = services
    .slice(0, 10)
    .map((s) => ({
      name: s.name.length > 20 ? s.name.slice(0, 20) + '...' : s.name,
      bookings: s.bookings_count || 0,
    }));

  const topService = services.length > 0 ? services[0] : null;

  if (!selectedBranchId) {
    return (
      <Layout>
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-700 mb-2">Выберите филиал</h2>
          <p className="text-slate-600">
            Для просмотра статистики услуг выберите филиал в верхнем меню
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
            <h1 className="text-3xl font-bold text-slate-900">Услуги</h1>
            <p className="text-slate-600 mt-1">Статистика и популярность услуг</p>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Всего услуг</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{services.length}</p>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Briefcase className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Всего записей</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{totalBookings}</p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Выручка</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">
                      {(totalRevenue / 1000).toFixed(0)}k
                    </p>
                    <p className="text-xs text-slate-500 mt-1">руб.</p>
                  </div>
                  <div className="bg-amber-100 p-3 rounded-lg">
                    <DollarSign className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Средняя длительность</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{avgDuration}</p>
                    <p className="text-xs text-slate-500 mt-1">минут</p>
                  </div>
                  <div className="bg-purple-100 p-3 rounded-lg">
                    <Clock className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>

            {topService && (
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center mb-2">
                      <Award className="w-6 h-6 mr-2" />
                      <h3 className="text-lg font-bold">Самая популярная услуга</h3>
                    </div>
                    <p className="text-3xl font-bold mb-2">{topService.name}</p>
                    <div className="flex items-center space-x-6 text-blue-100">
                      <div>
                        <span className="text-2xl font-bold text-white">{topService.bookings_count}</span>
                        <span className="ml-1 text-sm">записей</span>
                      </div>
                      <div>
                        <span className="text-2xl font-bold text-white">{topService.duration_minutes}</span>
                        <span className="ml-1 text-sm">минут</span>
                      </div>
                      <div>
                        <span className="text-2xl font-bold text-white">{topService.total_hours}</span>
                        <span className="ml-1 text-sm">часов</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
                    <TrendingUp className="w-12 h-12" />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Распределение по услугам</h2>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-slate-500">
                    Нет данных для отображения
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Топ-10 услуг по записям</h2>
                {barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" stroke="#64748b" />
                      <YAxis type="category" dataKey="name" stroke="#64748b" width={120} />
                      <Tooltip />
                      <Bar dataKey="bookings" fill="#3b82f6" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-slate-500">
                    Нет данных для отображения
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900">Все услуги</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                        Услуга
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider">
                        Длительность
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider">
                        Записей
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider">
                        Часов
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider">
                        Выручка
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider">
                        Тип
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {services.map((service, index) => (
                      <tr key={service.id} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div
                              className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-bold"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            >
                              {index + 1}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-slate-900">{service.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center">
                            <Clock className="w-4 h-4 text-slate-400 mr-1" />
                            <span className="text-sm font-medium text-slate-900">
                              {service.duration_minutes} мин
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-medium text-slate-900">{service.bookings_count || 0}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-medium text-slate-900">{service.total_hours || 0}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-medium text-slate-900">
                            {((service.total_revenue || 0) / 1000).toFixed(1)}k ₽
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {service.is_mobile ? (
                            <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                              Выездная
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                              В салоне
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
