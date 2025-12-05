import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LogIn, Mail, Phone, User, Shield } from 'lucide-react';

type AuthMode = 'login' | 'signup' | 'reset';

export function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'BRANCH_ADMIN' | 'BRANCH_MANAGER'>('BRANCH_MANAGER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (mode === 'reset') {
        if (!isEmail(identifier)) {
          throw new Error('Для восстановления пароля введите email адрес');
        }

        const { error } = await supabase.auth.resetPasswordForEmail(identifier, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) throw error;
        setSuccess('Письмо для восстановления пароля отправлено на ваш email');
        setTimeout(() => setMode('login'), 3000);
      } else if (mode === 'signup') {
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
            phone: normalizePhone(phone),
            role: role,
          });

          if (profileError) {
            console.error('Profile creation error:', profileError);
          }
        }

        setSuccess('Регистрация успешна! Проверьте email для подтверждения');
        setTimeout(() => setMode('login'), 3000);
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
        navigate('/');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-center mb-8">
            <div className="bg-blue-600 p-3 rounded-xl">
              <LogIn className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center text-slate-900 mb-2">
            YPlanner AI
          </h1>
          <p className="text-center text-slate-600 mb-8">
            {mode === 'login' && 'Войдите в систему'}
            {mode === 'signup' && 'Создайте аккаунт'}
            {mode === 'reset' && 'Восстановление пароля'}
          </p>

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

            {mode !== 'reset' && (
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
            )}

            {error && (
              <div className="p-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 rounded-lg text-sm bg-green-50 text-green-800 border border-green-200">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Загрузка...' : mode === 'login' ? 'Войти' : mode === 'signup' ? 'Зарегистрироваться' : 'Отправить письмо'}
            </button>
          </form>

          <div className="mt-6 space-y-2">
            {mode === 'login' && (
              <>
                <div className="text-center">
                  <button
                    onClick={() => {
                      setMode('reset');
                      setError('');
                      setSuccess('');
                    }}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Забыли пароль? Восстановить
                  </button>
                </div>
                <div className="text-center">
                  <button
                    onClick={() => {
                      setMode('signup');
                      setError('');
                      setSuccess('');
                    }}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Нет аккаунта? Зарегистрироваться
                  </button>
                </div>
              </>
            )}

            {(mode === 'signup' || mode === 'reset') && (
              <div className="text-center">
                <button
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setSuccess('');
                  }}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Вернуться к входу
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-slate-400 text-sm mt-8">
          ИИ-ассистент для оптимизации расписания и ресурсов
        </p>
      </div>
    </div>
  );
}
