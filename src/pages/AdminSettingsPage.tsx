import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAppStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { Settings, Save, AlertCircle, Trash2 } from 'lucide-react';

export function AdminSettingsPage() {
  const { selectedBranchId, branches, setBranches, setSelectedBranchId } = useAppStore();
  const [settings, setSettings] = useState({
    primary_tz: 'Europe/Moscow',
    default_horizon: 'week' as const,
    default_time_grain: 'day' as const,
    sync_interval_minutes: 15,
    overload_threshold: 85,
    mobile_enabled: false,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (selectedBranchId) {
      loadSettings();
    }
  }, [selectedBranchId]);

  const loadSettings = async () => {
    if (!selectedBranchId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('branch_settings')
        .select('*')
        .eq('branch_id', selectedBranchId)
        .single();

      if (error) throw error;
      if (data) {
        setSettings({
          primary_tz: data.primary_tz,
          default_horizon: data.default_horizon,
          default_time_grain: data.default_time_grain,
          sync_interval_minutes: data.sync_interval_minutes,
          overload_threshold: data.overload_threshold,
          mobile_enabled: data.mobile_enabled,
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedBranchId) return;

    setSaving(true);
    setMessage('');

    try {
      const { error } = await supabase
        .from('branch_settings')
        .update(settings)
        .eq('branch_id', selectedBranchId);

      if (error) throw error;
      setMessage('Настройки успешно сохранены');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Ошибка сохранения настроек');
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedBranchId) return;

    setDeleting(true);
    setMessage('');

    try {
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', selectedBranchId);

      if (error) throw error;

      const remainingBranches = branches.filter(b => b.id !== selectedBranchId);
      setBranches(remainingBranches);

      if (remainingBranches.length > 0) {
        setSelectedBranchId(remainingBranches[0].id);
      } else {
        setSelectedBranchId(null);
      }

      setMessage('Филиал успешно удален');
    } catch (error: any) {
      setMessage('Ошибка удаления филиала: ' + (error.message || 'Неизвестная ошибка'));
      console.error('Error deleting branch:', error);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!selectedBranchId) {
    return (
      <Layout>
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-700 mb-2">Выберите филиал</h2>
          <p className="text-slate-600">
            Для настройки выберите филиал в верхнем меню
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl">
        <div className="flex items-center space-x-3 mb-6">
          <Settings className="w-8 h-8 text-slate-700" />
          <h1 className="text-3xl font-bold text-slate-900">Настройки филиала</h1>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Загрузка настроек...</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Часовой пояс
              </label>
              <select
                value={settings.primary_tz}
                onChange={(e) => setSettings({ ...settings, primary_tz: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="Europe/Moscow">Москва (Europe/Moscow)</option>
                <option value="Europe/Samara">Самара (Europe/Samara)</option>
                <option value="Asia/Yekaterinburg">Екатеринбург (Asia/Yekaterinburg)</option>
                <option value="Asia/Novosibirsk">Новосибирск (Asia/Novosibirsk)</option>
                <option value="Asia/Vladivostok">Владивосток (Asia/Vladivostok)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Горизонт по умолчанию
              </label>
              <select
                value={settings.default_horizon}
                onChange={(e) => setSettings({ ...settings, default_horizon: e.target.value as any })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="week">Неделя</option>
                <option value="month">Месяц</option>
                <option value="quarter">Квартал</option>
                <option value="year">Год</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Детализация по умолчанию
              </label>
              <select
                value={settings.default_time_grain}
                onChange={(e) => setSettings({ ...settings, default_time_grain: e.target.value as any })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="day">Дни</option>
                <option value="week">Недели</option>
                <option value="month">Месяцы</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Интервал синхронизации (минуты)
              </label>
              <input
                type="number"
                value={settings.sync_interval_minutes}
                onChange={(e) => setSettings({ ...settings, sync_interval_minutes: parseInt(e.target.value) })}
                min={5}
                max={60}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Порог перегрузки (%)
              </label>
              <input
                type="number"
                value={settings.overload_threshold}
                onChange={(e) => setSettings({ ...settings, overload_threshold: parseInt(e.target.value) })}
                min={50}
                max={100}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="mobile_enabled"
                checked={settings.mobile_enabled}
                onChange={(e) => setSettings({ ...settings, mobile_enabled: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="mobile_enabled" className="text-sm font-medium text-slate-700">
                Включить выездные услуги
              </label>
            </div>

            {message && (
              <div className={`p-3 rounded-lg text-sm ${
                message.includes('успешно')
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {message}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <Save className="w-5 h-5" />
              <span>{saving ? 'Сохранение...' : 'Сохранить настройки'}</span>
            </button>

            <div className="pt-6 border-t border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Опасная зона</h3>
              <p className="text-sm text-slate-600 mb-4">
                Удаление филиала приведет к удалению всех связанных данных: сотрудников, услуг, записей, маршрутов и настроек.
              </p>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full bg-red-50 hover:bg-red-100 text-red-700 font-medium py-3 rounded-lg transition flex items-center justify-center space-x-2 border border-red-200"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>Удалить филиал</span>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-semibold text-red-900 mb-2">
                      Вы уверены, что хотите удалить этот филиал?
                    </p>
                    <p className="text-sm text-red-800">
                      Это действие необратимо. Все данные будут удалены навсегда.
                    </p>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 rounded-lg transition"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    >
                      <Trash2 className="w-5 h-5" />
                      <span>{deleting ? 'Удаление...' : 'Да, удалить'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
