import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../lib/store';
import { LogIn, Mail, Phone, User, Shield, Store, CheckCircle, AlertCircle } from 'lucide-react';

type AuthMode = 'login' | 'signup';
type ActivationStatus = 'idle' | 'activating' | 'success' | 'error';

export function YclientsMarketplaceAuthPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAppStore();

  const salonIdParam = searchParams.get('salon_id');
  const salonId = salonIdParam ? parseInt(salonIdParam, 10) : null;

  const [mode, setMode] = useState<AuthMode>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'BRANCH_ADMIN' | 'BRANCH_MANAGER'>('BRANCH_MANAGER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [activationStatus, setActivationStatus] = useState<ActivationStatus>('idle');
  const [activationError, setActivationError] = useState('');
  const [showActivationPrompt, setShowActivationPrompt] = useState(false);

  useEffect(() => {
    if (user && salonId) {
      setShowActivationPrompt(true);
    }
  }, [user, salonId]);

  const isEmail = (str: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
  };

  const isPhone = (str: string) => {
    return /^\+?[0-9]{10,15}$/.test(str.replace(/[\s\-\(\)]/g, ''));
  };

  const normalizePhone = (str: string) => {
    const cleaned = str.replace(/[\s\-\(\)]/g, '');
    if (cleaned.startsWith('8')) {
      return '+7' + cleaned.slice(1);
    }
    if (!cleaned.startsWith('+')) {
      return '+' + cleaned;
    }
    return cleaned;
  };

  const activateIntegration = async () => {
    if (!salonId) return;

    setActivationStatus('activating');
    setActivationError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Не удалось получить сессию пользователя');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yclients-marketplace-activate`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ salonId }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Ошибка активации интеграции');
      }

      setActivationStatus('success');
    } catch (err) {
      console.error('Activation error:', err);
      setActivationError(err instanceof Error ? err.message : 'Произошла ошибка при активации');
      setActivationStatus('error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'signup') {
        if (!fullName.trim()) {
          throw new Error('Введите ваше имя');
        }

        if (!phone.trim() || !isPhone(phone)) {
          throw new Error('Введите корректный номер телефона');
        }

        if (!isEmail(identifier)) {
          throw new Error('Введите корректный email адрес');
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: identifier,
          password,
          options: {
            data: {
              full_name: fullName,
              phone: normalizePhone(phone),
            },
          },
        });

        if (authError) throw authError;

        if (authData.user) {
          const { error: profileError } = await supabase.from('profiles').insert({
            id: authData.user.id,
            full_name: fullName,
            role: role,
          });

          if (profileError) {
            console.error('Profile creation error:', profileError);
          }

          await activateIntegration();
        }
      } else {
        let loginEmail = identifier;

        if (!isEmail(identifier)) {
          throw new Error('Для входа используйте email адрес');
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });

        if (error) throw error;

        setShowActivationPrompt(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  if (!salonId || isNaN(salonId)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-red-600 p-3 rounded-xl">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-center text-slate-900 mb-4">
              Некорректная ссылка из YCLIENTS
            </h1>
            <p className="text-center text-slate-600 mb-6">
              В ссылке отсутствует параметр salon_id. Пожалуйста, переактивируйте интеграцию из маркетплейса YCLIENTS.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition"
            >
              Перейти на главную страницу
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activationStatus === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-green-600 p-3 rounded-xl">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-center text-slate-900 mb-4">
              Интеграция успешно активирована!
            </h1>
            <p className="text-center text-slate-600 mb-6">
              Филиал #{salonId} подключен к вашему аккаунту. Можете вернуться в YCLIENTS — филиал будет отображаться как подключенный.
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition"
            >
              Перейти в панель управления
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (user && showActivationPrompt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-blue-600 p-3 rounded-xl">
                <Store className="w-8 h-8 text-white" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">
              Подключение через маркетплейс YCLIENTS
            </h1>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-900 mb-2">
                <strong>Вы авторизованы как:</strong> {user.email}
              </p>
              <p className="text-sm text-blue-900">
                <strong>Филиал YCLIENTS:</strong> #{salonId}
              </p>
            </div>

            <p className="text-center text-slate-600 mb-6">
              Для завершения интеграции нажмите кнопку ниже. Это свяжет филиал из YCLIENTS с вашим аккаунтом.
            </p>

            {activationError && (
              <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
                {activationError}
              </div>
            )}

            <button
              onClick={activateIntegration}
              disabled={activationStatus === 'activating'}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed mb-3"
            >
              {activationStatus === 'activating' ? 'Подключение...' : 'Подключить филиал YCLIENTS к аккаунту'}
            </button>

            <button
              onClick={() => navigate('/')}
              className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-3 rounded-lg transition"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-blue-600 p-3 rounded-xl">
              <Store className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">
            Подключение через маркетплейс YCLIENTS
          </h1>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
            <p className="text-sm text-blue-900 text-center">
              Филиал YCLIENTS: <strong>#{salonId}</strong>
            </p>
          </div>

          <p className="text-center text-slate-600 mb-6 text-sm">
            Войдите или зарегистрируйтесь в нашем сервисе, после чего мы автоматически подключим этот филиал к вашему аккаунту.
          </p>

          <div className="flex gap-2 mb-6">
            <button
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                mode === 'login'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Войти
            </button>
            <button
              onClick={() => {
                setMode('signup');
                setError('');
              }}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                mode === 'signup'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Создать аккаунт
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <User className="w-4 h-4 inline mr-1" />
                    Ваше имя
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="Иван Иванов"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Phone className="w-4 h-4 inline mr-1" />
                    Номер телефона
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="+7 900 123 45 67"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Shield className="w-4 h-4 inline mr-1" />
                    Роль
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    required
                  >
                    <option value="BRANCH_MANAGER">Менеджер филиала</option>
                    <option value="BRANCH_ADMIN">Администратор филиала</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Mail className="w-4 h-4 inline mr-1" />
                Email
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="ваш@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Загрузка...' : mode === 'login' ? 'Войти и подключить филиал' : 'Зарегистрироваться и подключить филиал'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-400 text-sm mt-6">
          YPlanner AI — ИИ-ассистент для оптимизации расписания
        </p>
      </div>
    </div>
  );
}
