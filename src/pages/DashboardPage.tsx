import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { SyncStatus } from '../components/SyncStatus';
import { useAppStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { TrendingUp, AlertCircle, Calendar, Clock, Users, CheckCircle } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DateTime } from 'luxon';

interface ChartData {
  name: string;
  загрузка: number;
  записей: number;
  прогноз?: number;
  date?: string;
}

interface HourlyData {
  hour: string;
  bookings: number;
}

interface Staff {
  id: string;
  name: string;
  skills: string[];
  is_active: boolean;
  bookings_count?: number;
  total_hours?: number;
  load_percentage?: number;
}

export function DashboardPage() {
  const { selectedBranchId, horizon, timeGrain, setHorizon, setTimeGrain } = useAppStore();
  const [stats, setStats] = useState({ totalBookings: 0, totalStaff: 0, avgLoad: 0 });
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);

  const reloadAllData = () => {
    loadDashboardData();
    loadStaffData();
  };

  useEffect(() => {
    if (selectedBranchId) {
      reloadAllData();
    }
  }, [selectedBranchId, horizon, timeGrain]);

  useEffect(() => {
    if (selectedDate && selectedBranchId) {
      loadHourlyData(selectedDate);
    }
  }, [selectedDate, selectedBranchId]);

  const loadHourlyData = async (date: string) => {
    if (!selectedBranchId) return;

    try {
      const startOfDay = DateTime.fromISO(date).startOf('day').toISO();
      const endOfDay = DateTime.fromISO(date).endOf('day').toISO();

      const { data: bookings } = await supabase
        .from('bookings')
        .select('starts_at_utc')
        .eq('branch_id', selectedBranchId)
        .gte('starts_at_utc', startOfDay)
        .lte('starts_at_utc', endOfDay);

      const hourCounts: { [key: number]: number } = {};
      for (let i = 0; i < 24; i++) {
        hourCounts[i] = 0;
      }

      if (bookings) {
        bookings.forEach((booking) => {
          const hour = DateTime.fromISO(booking.starts_at_utc).hour;
          hourCounts[hour]++;
        });
      }

      const hourlyDataArray: HourlyData[] = [];
      for (let i = 0; i < 24; i++) {
        hourlyDataArray.push({
          hour: `${i}:00`,
          bookings: hourCounts[i],
        });
      }

      setHourlyData(hourlyDataArray);
    } catch (error) {
      console.error('Error loading hourly data:', error);
    }
  };

  const loadDashboardData = async () => {
    if (!selectedBranchId) return;

    setLoading(true);
    try {
      const now = DateTime.now();
      let startDate = now;
      let endDate = now;

      if (horizon === 'week') {
        startDate = now.startOf('week');
        endDate = now.endOf('week').plus({ weeks: 4 });
      } else if (horizon === 'month') {
        startDate = now.startOf('month');
        endDate = now.endOf('month').plus({ months: 1 });
      } else if (horizon === 'quarter') {
        startDate = now.startOf('quarter');
        endDate = now.endOf('quarter').plus({ months: 1 });
      } else if (horizon === 'year') {
        startDate = now.startOf('year');
        endDate = now.endOf('year');
      }

      const [bookingsRes, staffRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('*')
          .eq('branch_id', selectedBranchId)
          .gte('starts_at_utc', startDate.toISO())
          .lte('starts_at_utc', endDate.toISO())
          .neq('status', 'cancelled'),
        supabase
          .from('staff')
          .select('*')
          .eq('branch_id', selectedBranchId)
          .eq('is_active', true),
      ]);

      if (bookingsRes.error) {
        console.error('Error loading bookings for dashboard:', bookingsRes.error);
      }
      if (staffRes.error) {
        console.error('Error loading staff for dashboard:', staffRes.error);
      }

      const bookings = bookingsRes.data || [];
      const staff = staffRes.data || [];

      setStats({
        totalBookings: bookings.length,
        totalStaff: staff.length,
        avgLoad: staff.length > 0 ? Math.round((bookings.length / staff.length) * 100) / 10 : 0,
      });

      const chartDataMap = processChartData(bookings, startDate, endDate);
      setChartData(chartDataMap);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStaffData = async () => {
    if (!selectedBranchId) return;

    try {
      const now = DateTime.now();
      let startDate = now;
      let endDate = now;

      if (horizon === 'week') {
        startDate = now.startOf('week');
        endDate = now.endOf('week').plus({ weeks: 4 });
      } else if (horizon === 'month') {
        startDate = now.startOf('month');
        endDate = now.endOf('month').plus({ months: 1 });
      } else if (horizon === 'quarter') {
        startDate = now.startOf('quarter');
        endDate = now.endOf('quarter').plus({ months: 1 });
      } else if (horizon === 'year') {
        startDate = now.startOf('year');
        endDate = now.endOf('year');
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
          .gte('starts_at_utc', startDate.toISO())
          .lte('starts_at_utc', endDate.toISO())
          .neq('status', 'cancelled'),
      ]);

      if (staffRes.error) {
        console.error('Error loading staff for staff metrics:', staffRes.error);
      }
      if (bookingsRes.error) {
        console.error('Error loading bookings for staff metrics:', bookingsRes.error);
      }

      const staffData = staffRes.data || [];
      const bookingsData = bookingsRes.data || [];

      const staffWithMetrics = staffData.map((s) => {
        const staffBookings = bookingsData.filter((b) => b.staff_id === s.id);
        const totalMinutes = staffBookings.reduce((sum, b) => {
          const start = DateTime.fromISO(b.starts_at_utc);
          const end = DateTime.fromISO(b.ends_at_utc);
          return sum + (end.toMillis() - start.toMillis()) / (1000 * 60);
        }, 0);

        const daysInPeriod = Math.ceil(endDate.diff(startDate, 'days').days);
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
    }
  };

  const getLoadColor = (load: number) => {
    if (load >= 80) return '#ef4444';
    if (load >= 60) return '#f59e0b';
    if (load >= 40) return '#3b82f6';
    return '#10b981';
  };

  const generateForecast = (historicalData: ChartData[], periodsAhead: number): ChartData[] => {
    if (historicalData.length < 3) return [];

    const values = historicalData.map(d => d.записей);
    const n = values.length;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const avg = values.reduce((a, b) => a + b, 0) / n;
    const seasonalFactors: number[] = [];
    for (let i = 0; i < values.length; i++) {
      const trend = intercept + slope * i;
      seasonalFactors.push(trend > 0 ? values[i] / trend : 1);
    }

    const forecastData: ChartData[] = [];
    const lastDate = historicalData[historicalData.length - 1].date
      ? DateTime.fromISO(historicalData[historicalData.length - 1].date!)
      : DateTime.now();

    for (let i = 1; i <= periodsAhead; i++) {
      const trendValue = intercept + slope * (n + i - 1);
      const seasonalIndex = (n + i - 1) % seasonalFactors.length;
      const seasonalFactor = seasonalFactors[seasonalIndex] || 1;
      const forecast = Math.max(0, Math.round(trendValue * seasonalFactor));

      let futureDate: DateTime;
      let name: string;

      if (timeGrain === 'day') {
        futureDate = lastDate.plus({ days: i });
        name = futureDate.toFormat('dd MMM');
      } else if (timeGrain === 'week') {
        futureDate = lastDate.plus({ weeks: i });
        name = futureDate.toFormat('dd MMM');
      } else {
        futureDate = lastDate.plus({ months: i });
        name = futureDate.toFormat('MMM yyyy');
      }

      forecastData.push({
        name,
        загрузка: 0,
        записей: 0,
        прогноз: forecast,
        date: futureDate.toISODate(),
      });
    }

    return forecastData;
  };

  const processChartData = (bookings: any[], startDate: DateTime, endDate: DateTime): ChartData[] => {
    const dataMap: { [key: string]: { historical: number; forecast: number; date: DateTime } } = {};
    const now = DateTime.now();

    if (timeGrain === 'day') {
      let current = startDate.startOf('day');
      while (current <= endDate) {
        const key = current.toISODate();
        dataMap[key] = { historical: 0, forecast: 0, date: current };
        current = current.plus({ days: 1 });
      }

      bookings.forEach((booking) => {
        const bookingDate = DateTime.fromISO(booking.starts_at_utc);
        const key = bookingDate.toISODate();
        if (dataMap[key]) {
          if (bookingDate <= now) {
            dataMap[key].historical++;
          } else {
            dataMap[key].forecast++;
          }
        }
      });

      return Object.entries(dataMap).map(([key, value]) => ({
        name: value.date.toFormat('dd MMM'),
        загрузка: value.historical + value.forecast,
        записей: value.historical,
        прогноз: value.forecast,
        date: key,
      }));
    } else if (timeGrain === 'week') {
      let current = startDate.startOf('week');
      while (current <= endDate) {
        const key = current.toISODate();
        dataMap[key] = { historical: 0, forecast: 0, date: current };
        current = current.plus({ weeks: 1 });
      }

      bookings.forEach((booking) => {
        const bookingDate = DateTime.fromISO(booking.starts_at_utc);
        const weekKey = bookingDate.startOf('week').toISODate();
        if (dataMap[weekKey]) {
          if (bookingDate <= now) {
            dataMap[weekKey].historical++;
          } else {
            dataMap[weekKey].forecast++;
          }
        }
      });

      return Object.entries(dataMap).map(([key, value]) => ({
        name: `${value.date.toFormat('dd MMM')}`,
        загрузка: value.historical + value.forecast,
        записей: value.historical,
        прогноз: value.forecast,
        date: key,
      }));
    } else {
      let current = startDate.startOf('month');
      while (current <= endDate) {
        const key = current.toFormat('yyyy-MM');
        dataMap[key] = { historical: 0, forecast: 0, date: current };
        current = current.plus({ months: 1 });
      }

      bookings.forEach((booking) => {
        const bookingDate = DateTime.fromISO(booking.starts_at_utc);
        const monthKey = bookingDate.toFormat('yyyy-MM');
        if (dataMap[monthKey]) {
          if (bookingDate <= now) {
            dataMap[monthKey].historical++;
          } else {
            dataMap[monthKey].forecast++;
          }
        }
      });

      return Object.entries(dataMap).map(([key, value]) => ({
        name: value.date.toFormat('MMM yyyy'),
        загрузка: value.historical + value.forecast,
        записей: value.historical,
        прогноз: value.forecast,
        date: key,
      }));
    }
  };

  const handleBarClick = (data: any) => {
    if (timeGrain === 'day' && data && data.date) {
      setSelectedDate(data.date);
    }
  };

  if (!selectedBranchId) {
    return (
      <Layout>
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-700 mb-2">Выберите филиал</h2>
          <p className="text-slate-600">
            Для просмотра дашборда выберите филиал в верхнем меню
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <SyncStatus branchId={selectedBranchId} onSyncComplete={reloadAllData} />

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-900">Загруженность</h1>

          <div className="flex items-center space-x-6">

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

              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-slate-700">Детализация:</label>
                <select
                  value={timeGrain}
                  onChange={(e) => setTimeGrain(e.target.value as any)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="day">Дни</option>
                  <option value="week">Недели</option>
                  <option value="month">Месяцы</option>
                </select>
              </div>
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
                    <p className="text-sm font-medium text-slate-600">Всего записей</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{stats.totalBookings}</p>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Calendar className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Активных сотрудников</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{stats.totalStaff}</p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-lg">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Средняя загрузка</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{stats.avgLoad}%</p>
                  </div>
                  <div className="bg-amber-100 p-3 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-900">
                    {timeGrain === 'day' ? 'Загрузка по дням' : timeGrain === 'week' ? 'Загрузка по неделям' : 'Загрузка по месяцам'}
                  </h2>
                  {timeGrain === 'day' && (
                    <div className="text-xs text-slate-500">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Нажмите на день для детализации по часам
                    </div>
                  )}
                </div>
                {chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-[300px] text-slate-400">
                    <div className="text-center">
                      <AlertCircle className="w-12 h-12 mx-auto mb-2" />
                      <p>Нет данных для отображения</p>
                      <p className="text-sm mt-1">Синхронизируйте данные из yClients</p>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} onClick={handleBarClick}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip />
                      <Bar dataKey="записей" fill="#3b82f6" radius={[8, 8, 0, 0]} cursor="pointer" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Тренд и прогноз загрузки</h2>
                {chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-[300px] text-slate-400">
                    <div className="text-center">
                      <AlertCircle className="w-12 h-12 mx-auto mb-2" />
                      <p>Нет данных для отображения</p>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip />
                      <Line type="monotone" dataKey="записей" stroke="#3b82f6" strokeWidth={2} name="Факт" />
                      <Line type="monotone" dataKey="прогноз" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" name="Прогноз" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {selectedDate && timeGrain === 'day' && (
              <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Clock className="w-6 h-6 text-blue-600" />
                    <h2 className="text-lg font-bold text-slate-900">
                      Детализация по часам - {DateTime.fromISO(selectedDate).toFormat('dd MMMM yyyy')}
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1 border border-slate-300 rounded-lg"
                  >
                    Закрыть
                  </button>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="hour" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Bar dataKey="bookings" fill="#10b981" radius={[8, 8, 0, 0]} name="Записей" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Загруженность сотрудников</h2>
              {staff.filter((s) => s.is_active).length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={staff.filter((s) => s.is_active).map((s) => ({
                    name: s.name.split(' ')[0],
                    load: s.load_percentage || 0,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" />
                    <YAxis stroke="#64748b" label={{ value: '%', angle: 0, position: 'top' }} />
                    <Tooltip />
                    <Bar dataKey="load" radius={[8, 8, 0, 0]}>
                      {staff.filter((s) => s.is_active).map((s, index) => (
                        <Cell key={`cell-${index}`} fill={getLoadColor(s.load_percentage || 0)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-slate-400">
                  <div className="text-center">
                    <AlertCircle className="w-12 h-12 mx-auto mb-2" />
                    <p>Нет данных о сотрудниках</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900">Детальная информация по сотрудникам</h2>
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
