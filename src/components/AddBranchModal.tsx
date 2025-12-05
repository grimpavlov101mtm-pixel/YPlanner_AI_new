import { useState } from 'react';
import { X, Building2, Key } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../lib/store';

interface AddBranchModalProps {
  onClose: () => void;
}

export function AddBranchModal({ onClose }: AddBranchModalProps) {
  const { profile, setBranches, setSelectedBranchId } = useAppStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    branchName: '',
    yClientsCompanyId: '',
    yClientsPartnerToken: '',
    yClientsUserToken: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profile?.org_id) {
      setError('Организация не найдена');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .insert({
          org_id: profile.org_id,
          name: formData.branchName,
          yclients_company_id: parseInt(formData.yClientsCompanyId),
        })
        .select()
        .single();

      if (branchError) throw branchError;

      const { error: settingsError } = await supabase
        .from('integration_settings')
        .insert({
          branch_id: branch.id,
          yclients_partner_token: formData.yClientsPartnerToken,
          yclients_user_token: formData.yClientsUserToken,
        });

      if (settingsError) throw settingsError;

      const { data: branches } = await supabase
        .from('branches')
        .select('*')
        .eq('org_id', profile.org_id);

      if (branches) {
        setBranches(branches);
        setSelectedBranchId(branch.id);
      }

      onClose();
    } catch (err: any) {
      console.error('Error adding branch:', err);
      setError(err.message || 'Ошибка при добавлении филиала');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Добавить филиал</h2>
            <p className="text-sm text-slate-600 mt-1">Шаг {step} из 2</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  Название филиала
                </label>
                <input
                  type="text"
                  value={formData.branchName}
                  onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                  placeholder="Салон на Невском"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-bold text-blue-900 mb-2">Как найти данные yClients:</h3>
                <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                  <li>Войдите в личный кабинет yClients</li>
                  <li>
                    <strong>Company ID</strong> находится в URL адресной строки:
                    <code className="block mt-1 bg-white px-2 py-1 rounded text-xs">
                      yclients.com/company/<span className="text-blue-600 font-bold">123456</span>/branch/78910
                    </code>
                  </li>
                  <li>API токены находятся в разделе "Настройки" → "API"</li>
                </ol>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (formData.branchName) {
                      setStep(2);
                    } else {
                      setError('Введите название филиала');
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Далее
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Company ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.yClientsCompanyId}
                  onChange={(e) => setFormData({ ...formData, yClientsCompanyId: e.target.value })}
                  placeholder="123456"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Находится в URL: yclients.com/company/<strong>123456</strong>/branch/78910
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-bold text-blue-900 mb-2">Авторизация запросов API</h3>
                <p className="text-sm text-blue-800 mb-3">
                  Для обращений к API требуется авторизация партнера. При запросах к API в HTTP заголовок Authorization должен быть включен ключ доступа:
                </p>
                <code className="block bg-white px-3 py-2 rounded text-xs font-mono text-slate-800 mb-3">
                  Authorization: Bearer &lt;partner token&gt;
                </code>
                <p className="text-sm text-blue-800 mb-2">
                  Для получения API-ключа пользователя используйте метод <code className="bg-white px-1 py-0.5 rounded text-xs">auth</code>. Передавать сам ключ нужно также в заголовке запроса:
                </p>
                <code className="block bg-white px-3 py-2 rounded text-xs font-mono text-slate-800">
                  Authorization: Bearer &lt;partner token&gt;, User &lt;user token&gt;
                </code>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="font-bold text-amber-900 mb-2">Где найти токены?</h3>
                <ol className="text-sm text-amber-800 space-y-2 list-decimal list-inside">
                  <li>Войдите в личный кабинет yClients</li>
                  <li>Перейдите в раздел "Настройки" → "API"</li>
                  <li>Скопируйте <strong>Partner Token</strong></li>
                  <li>
                    <strong>User Token</strong> - получите через API метод:
                    <code className="block mt-1 bg-white px-2 py-1 rounded text-xs">
                      POST https://api.yclients.com/api/v1/auth<br/>
                      Authorization: Bearer &lt;partner_token&gt;<br/>
                      Body: {`{"login": "ваш_email", "password": "ваш_пароль"}`}
                    </code>
                  </li>
                  <li className="font-bold">Оба токена обязательны для синхронизации записей!</li>
                </ol>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Key className="w-4 h-4 inline mr-1" />
                  Partner Token <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={formData.yClientsPartnerToken}
                  onChange={(e) => setFormData({ ...formData, yClientsPartnerToken: e.target.value })}
                  placeholder="Введите Partner Token"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Обязательное поле. Постоянный токен партнера для авторизации запросов.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Key className="w-4 h-4 inline mr-1" />
                  User Token <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={formData.yClientsUserToken}
                  onChange={(e) => setFormData({ ...formData, yClientsUserToken: e.target.value })}
                  placeholder="Введите User Token"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Обязательное поле. Требуется для синхронизации записей клиентов. Получается через метод auth.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                  {error}
                </div>
              )}

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                >
                  Назад
                </button>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !formData.yClientsCompanyId || !formData.yClientsPartnerToken || !formData.yClientsUserToken}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Создание...' : 'Создать филиал'}
                  </button>
                </div>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
