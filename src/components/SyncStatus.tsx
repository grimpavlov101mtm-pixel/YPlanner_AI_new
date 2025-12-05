import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle, Clock, Calendar, Users, Briefcase, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DateTime } from 'luxon';

interface SyncStatusProps {
  branchId: string;
  compact?: boolean;
  onSyncComplete?: () => void;
}

interface SyncRecord {
  sync_type: string;
  status: string;
  synced_count: number;
  error_message: string | null;
  created_at: string;
}

export function SyncStatus({ branchId, compact = false, onSyncComplete }: SyncStatusProps) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<{ [key: string]: SyncRecord }>({});
  const [error, setError] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (branchId) {
      loadSyncStatus();

      const interval = setInterval(() => {
        handleSync(true);
      }, 2 * 60 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [branchId]);

  const loadSyncStatus = async () => {
    try {
      const { data } = await supabase
        .from('sync_status')
        .select('*')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        const latestByType: { [key: string]: SyncRecord } = {};

        for (const record of data) {
          if (!latestByType[record.sync_type]) {
            latestByType[record.sync_type] = record;
          }
        }

        setLastSync(latestByType);
      } else {
        setLastSync({});
        handleSync(true);
      }
    } catch (err) {
      console.error('Error loading sync status:', err);
    }
  };

  const handleSync = async (isAutoSync = false) => {
    if (!isAutoSync) {
      setSyncing(true);
      setError('');
    }

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-bookings`;
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ branchId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка синхронизации');
      }

      await loadSyncStatus();
      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (err: any) {
      console.error('Sync error:', err);
      if (!isAutoSync) {
        setError(err.message || 'Ошибка синхронизации');
      }
    } finally {
      if (!isAutoSync) {
        setSyncing(false);
      }
    }
  };

  const getSyncItemStatus = (type: string) => {
    const record = lastSync[type];
    if (!record) return { status: 'unknown', count: 0, time: null, error: null };

    return {
      status: record.status,
      count: record.synced_count,
      time: record.created_at,
      error: record.error_message,
    };
  };

  const bookingsStatus = getSyncItemStatus('bookings');
  const staffStatus = getSyncItemStatus('staff');
  const servicesStatus = getSyncItemStatus('services');

  const allSynced = bookingsStatus.status === 'success' &&
                    staffStatus.status === 'success' &&
                    servicesStatus.status === 'success';

  const hasErrors = bookingsStatus.status === 'error' ||
                    staffStatus.status === 'error' ||
                    servicesStatus.status === 'error';

  const getLatestSyncTime = () => {
    const times = [bookingsStatus.time, staffStatus.time, servicesStatus.time].filter(Boolean);
    if (times.length === 0) return null;

    const latest = times.sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0];
    return DateTime.fromISO(latest!).toRelative();
  };

  if (compact) {
    const latestTime = getLatestSyncTime();
    if (!latestTime) return null;

    return (
      <div className="flex items-center space-x-2 text-sm text-slate-600">
        <Clock className="w-4 h-4" />
        <span>Последняя синхронизация: {latestTime}</span>
        {allSynced && <CheckCircle className="w-4 h-4 text-green-600" />}
        {hasErrors && <XCircle className="w-4 h-4 text-red-600" />}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="flex items-center justify-between p-6">
        <div className="flex-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-2 text-left w-full group"
          >
            <h2 className="text-lg font-bold text-slate-900">Синхронизация данных</h2>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition" />
            )}
          </button>
          {!isExpanded && getLatestSyncTime() && (
            <p className="text-sm text-slate-500 mt-1">
              Последняя синхронизация: {getLatestSyncTime()}
            </p>
          )}
        </div>

        <button
          onClick={() => handleSync(false)}
          disabled={syncing}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Синхронизация...' : 'Синхронизировать'}
        </button>
      </div>

      {isExpanded && (
        <div className="px-6 pb-6 border-t border-slate-200 pt-6">

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div className={`flex items-center justify-between p-4 rounded-lg border ${
          bookingsStatus.status === 'success'
            ? 'bg-green-50 border-green-200'
            : bookingsStatus.status === 'error'
            ? 'bg-red-50 border-red-200'
            : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center space-x-3">
            <Calendar className={`w-5 h-5 ${
              bookingsStatus.status === 'success'
                ? 'text-green-600'
                : bookingsStatus.status === 'error'
                ? 'text-red-600'
                : 'text-slate-400'
            }`} />
            <div>
              <p className="font-medium text-slate-900">Записи</p>
              {bookingsStatus.error && (
                <p className="text-xs text-red-600 mt-1">{bookingsStatus.error}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {bookingsStatus.status === 'success' ? (
              <>
                <span className="text-sm font-medium text-slate-700">{bookingsStatus.count}</span>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </>
            ) : bookingsStatus.status === 'error' ? (
              <XCircle className="w-5 h-5 text-red-600" />
            ) : (
              <Clock className="w-5 h-5 text-slate-400" />
            )}
          </div>
        </div>

        <div className={`flex items-center justify-between p-4 rounded-lg border ${
          staffStatus.status === 'success'
            ? 'bg-green-50 border-green-200'
            : staffStatus.status === 'error'
            ? 'bg-red-50 border-red-200'
            : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center space-x-3">
            <Users className={`w-5 h-5 ${
              staffStatus.status === 'success'
                ? 'text-green-600'
                : staffStatus.status === 'error'
                ? 'text-red-600'
                : 'text-slate-400'
            }`} />
            <div>
              <p className="font-medium text-slate-900">Сотрудники</p>
              {staffStatus.error && (
                <p className="text-xs text-red-600 mt-1">{staffStatus.error}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {staffStatus.status === 'success' ? (
              <>
                <span className="text-sm font-medium text-slate-700">{staffStatus.count}</span>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </>
            ) : staffStatus.status === 'error' ? (
              <XCircle className="w-5 h-5 text-red-600" />
            ) : (
              <Clock className="w-5 h-5 text-slate-400" />
            )}
          </div>
        </div>

        <div className={`flex items-center justify-between p-4 rounded-lg border ${
          servicesStatus.status === 'success'
            ? 'bg-green-50 border-green-200'
            : servicesStatus.status === 'error'
            ? 'bg-red-50 border-red-200'
            : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center space-x-3">
            <Briefcase className={`w-5 h-5 ${
              servicesStatus.status === 'success'
                ? 'text-green-600'
                : servicesStatus.status === 'error'
                ? 'text-red-600'
                : 'text-slate-400'
            }`} />
            <div>
              <p className="font-medium text-slate-900">Услуги</p>
              {servicesStatus.error && (
                <p className="text-xs text-red-600 mt-1">{servicesStatus.error}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {servicesStatus.status === 'success' ? (
              <>
                <span className="text-sm font-medium text-slate-700">{servicesStatus.count}</span>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </>
            ) : servicesStatus.status === 'error' ? (
              <XCircle className="w-5 h-5 text-red-600" />
            ) : (
              <Clock className="w-5 h-5 text-slate-400" />
            )}
          </div>
        </div>
      </div>

      <div className={`mt-4 p-3 rounded-lg border ${
        allSynced
          ? 'bg-green-50 border-green-200'
          : hasErrors
          ? 'bg-red-50 border-red-200'
          : 'bg-slate-50 border-slate-200'
      }`}>
        <p className={`text-sm font-medium ${
          allSynced
            ? 'text-green-800'
            : hasErrors
            ? 'text-red-800'
            : 'text-slate-600'
        }`}>
          {allSynced
            ? 'Все данные синхронизированы'
            : hasErrors
            ? 'Частичная синхронизация. Доступны данные, которые были успешно синхронизированы.'
            : 'Нажмите "Синхронизировать" для загрузки данных'}
        </p>
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          Автоматическая синхронизация каждые 2 часа
        </p>
      </div>
        </div>
      )}
    </div>
  );
}
