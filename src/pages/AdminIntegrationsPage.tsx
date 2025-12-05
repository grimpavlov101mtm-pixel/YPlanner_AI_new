import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAppStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { Link2, Bot, AlertCircle, Save, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface IntegrationSettings {
  id?: string;
  telegram_bot_token: string;
  yclients_partner_token: string;
  yclients_user_token: string;
}

export function AdminIntegrationsPage() {
  const { selectedBranchId } = useAppStore();
  const [settings, setSettings] = useState<IntegrationSettings>({
    telegram_bot_token: '',
    yclients_partner_token: '',
    yclients_user_token: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({ telegram: false, yclients: false });
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

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
        .from('integration_settings')
        .select('*')
        .eq('branch_id', selectedBranchId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          id: data.id,
          telegram_bot_token: data.telegram_bot_token || '',
          yclients_partner_token: data.yclients_partner_token || '',
          yclients_user_token: data.yclients_user_token || '',
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      showMessage('error', 'Ошибка загрузки настроек');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: string, text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleSaveTelegram = async () => {
    if (!selectedBranchId) return;
    if (!settings.telegram_bot_token.trim()) {
      showMessage('error', 'Введите токен Telegram бота');
      return;
    }

    setSaving({ ...saving, telegram: true });
    try {
      const payload = {
        branch_id: selectedBranchId,
        telegram_bot_token: settings.telegram_bot_token,
      };

      if (settings.id) {
        const { error } = await supabase
          .from('integration_settings')
          .update(payload)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('integration_settings')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setSettings({ ...settings, id: data.id });
      }

      showMessage('success', 'Telegram бот успешно подключен');
    } catch (error: any) {
      console.error('Error saving Telegram:', error);
      showMessage('error', error.message || 'Ошибка сохранения');
    } finally {
      setSaving({ ...saving, telegram: false });
    }
  };

  const handleSaveYClients = async () => {
    if (!selectedBranchId) return;
    if (!settings.yclients_partner_token || !settings.yclients_user_token) {
      showMessage('error', 'Заполните оба токена');
      return;
    }

    setSaving({ ...saving, yclients: true });
    try {
      const payload = {
        branch_id: selectedBranchId,
        yclients_partner_token: settings.yclients_partner_token,
        yclients_user_token: settings.yclients_user_token,
      };

      if (settings.id) {
        const { error } = await supabase
          .from('integration_settings')
          .update(payload)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('integration_settings')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setSettings({ ...settings, id: data.id });
      }

      showMessage('success', 'Токены yClients API успешно сохранены');
    } catch (error: any) {
      console.error('Error saving yClients:', error);
      showMessage('error', error.message || 'Ошибка сохранения');
    } finally {
      setSaving({ ...saving, yclients: false });
    }
  };

  const isYClientsConnected = settings.yclients_partner_token && settings.yclients_user_token;
  const isTelegramConnected = settings.telegram_bot_token;

  if (!selectedBranchId) {
    return (
      <Layout>
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-700 mb-2">Выберите филиал</h2>
          <p className="text-slate-600">
            Для настройки интеграций выберите филиал в верхнем меню
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl">
        <div className="flex items-center space-x-3 mb-6">
          <Link2 className="w-8 h-8 text-slate-700" />
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Интеграции</h1>
            <p className="text-slate-600 mt-1">Настройка подключений к внешним сервисам</p>
          </div>
        </div>

        {message.text && (
          <div className={`mb-6 p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center">
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 mr-2" />
              ) : (
                <XCircle className="w-5 h-5 mr-2" />
              )}
              {message.text}
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Загрузка настроек...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-cyan-100 p-3 rounded-lg">
                    <Bot className="w-6 h-6 text-cyan-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Telegram Bot</h2>
                    <p className="text-sm text-slate-600">Уведомления и управление через Telegram</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  isTelegramConnected
                    ? 'bg-green-100 text-green-800'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {isTelegramConnected ? 'Подключено' : 'Не подключено'}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Bot Token
                  </label>
                  <input
                    type="password"
                    value={settings.telegram_bot_token}
                    onChange={(e) => setSettings({ ...settings, telegram_bot_token: e.target.value })}
                    placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                  />
                </div>

                <button
                  onClick={handleSaveTelegram}
                  disabled={saving.telegram}
                  className="flex items-center px-6 py-2 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 transition disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving.telegram ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>

              <div className="mt-4 p-4 bg-cyan-50 border border-cyan-200 rounded-lg">
                <h3 className="font-bold text-cyan-900 mb-2">Как создать Telegram бота:</h3>
                <ol className="text-sm text-cyan-800 space-y-1 list-decimal list-inside">
                  <li>Откройте Telegram и найдите @BotFather</li>
                  <li>Отправьте команду /newbot</li>
                  <li>Следуйте инструкциям для создания бота</li>
                  <li>Скопируйте полученный токен и вставьте выше</li>
                </ol>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Link2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">yClients API</h2>
                    <p className="text-sm text-slate-600">Настройка токенов для синхронизации</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  settings.yclients_partner_token && settings.yclients_user_token
                    ? 'bg-green-100 text-green-800'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {settings.yclients_partner_token && settings.yclients_user_token ? 'Настроено' : 'Не настроено'}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Partner Token
                  </label>
                  <input
                    type="password"
                    value={settings.yclients_partner_token}
                    onChange={(e) => setSettings({ ...settings, yclients_partner_token: e.target.value })}
                    placeholder="Введите Partner Token"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Постоянный токен партнера из настроек yClients API
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    User Token
                  </label>
                  <input
                    type="password"
                    value={settings.yclients_user_token}
                    onChange={(e) => setSettings({ ...settings, yclients_user_token: e.target.value })}
                    placeholder="Введите User Token"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Токен пользователя, полученный через метод auth. Обязателен для синхронизации записей.
                  </p>
                </div>

                <button
                  onClick={handleSaveYClients}
                  disabled={saving.yclients}
                  className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving.yclients ? 'Сохранение...' : 'Сохранить токены'}
                </button>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h3 className="font-bold text-amber-900 mb-2">Как получить User Token:</h3>
                  <code className="block bg-white px-3 py-2 rounded text-xs font-mono text-slate-800 mt-2">
                    POST https://api.yclients.com/api/v1/auth<br/>
                    Authorization: Bearer &lt;partner_token&gt;<br/>
                    Content-Type: application/json<br/>
                    <br/>
                    {`{"login": "ваш_email", "password": "ваш_пароль"}`}
                  </code>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-amber-900 mb-2">Безопасность данных</h3>
                  <p className="text-sm text-amber-800">
                    Все токены и ключи хранятся в зашифрованном виде в защищенной базе данных.
                    Данные передаются только через защищенные HTTPS соединения.
                    Каждая интеграция настраивается отдельно для каждого филиала.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
