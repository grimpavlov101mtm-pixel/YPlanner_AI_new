import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAppStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { MapPin, Navigation, Calendar, AlertCircle } from 'lucide-react';

export function RoutesPage() {
  const selectedBranchId = useAppStore((state) => state.selectedBranchId);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedBranchId) {
      loadRoutes();
    }
  }, [selectedBranchId, date]);

  const loadRoutes = async () => {
    if (!selectedBranchId) return;

    setLoading(true);
    try {
      const { data } = await supabase
        .from('routes')
        .select(`
          *,
          route_stops (
            *,
            staff ( name ),
            booking ( client_name, address )
          )
        `)
        .eq('branch_id', selectedBranchId)
        .eq('date', date)
        .order('created_at', { ascending: false });

      setRoutes(data || []);
    } catch (error) {
      console.error('Error loading routes:', error);
    } finally {
      setLoading(false);
    }
  };

  const optimizeRoutes = async () => {
    if (!selectedBranchId) return;

    setLoading(true);
    alert('Функция оптимизации маршрутов будет доступна после настройки Edge Functions');
    setLoading(false);
  };

  if (!selectedBranchId) {
    return (
      <Layout>
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-700 mb-2">Выберите филиал</h2>
          <p className="text-slate-600">
            Для просмотра маршрутов выберите филиал в верхнем меню
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-900">Маршруты</h1>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-slate-600" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <button
              onClick={optimizeRoutes}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Navigation className="w-4 h-4" />
              <span>Оптимизировать</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Загрузка маршрутов...</p>
          </div>
        ) : routes.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 border border-slate-200 text-center">
            <MapPin className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-700 mb-2">Нет маршрутов</h3>
            <p className="text-slate-600 mb-6">
              На выбранную дату не найдено оптимизированных маршрутов
            </p>
            <button
              onClick={optimizeRoutes}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Создать маршруты
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {routes.map((route) => (
              <div key={route.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <MapPin className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          Маршрут от {new Date(route.created_at).toLocaleDateString('ru-RU')}
                        </h3>
                        <p className="text-sm text-slate-600">
                          Статус: <span className="font-medium">{route.status}</span>
                        </p>
                      </div>
                    </div>

                    {route.summary && (
                      <div className="text-right">
                        <p className="text-sm text-slate-600">
                          Остановок: <span className="font-bold text-slate-900">{route.summary.stops || 0}</span>
                        </p>
                        <p className="text-sm text-slate-600">
                          Расстояние: <span className="font-bold text-slate-900">{route.summary.distance || 0} км</span>
                        </p>
                      </div>
                    )}
                  </div>

                  {route.route_stops && route.route_stops.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {route.route_stops.map((stop: any, idx: number) => (
                        <div key={stop.id} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                          <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">
                              {stop.booking?.client_name || 'Клиент'}
                            </p>
                            <p className="text-sm text-slate-600">
                              {stop.booking?.address || 'Адрес не указан'}
                            </p>
                          </div>
                          {stop.yandex_link && (
                            <a
                              href={stop.yandex_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                            >
                              Открыть
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
