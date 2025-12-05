import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAppStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { Calendar, Users, Clock, AlertCircle, CheckCircle, X } from 'lucide-react';
import { DateTime } from 'luxon';

interface Staff {
  id: string;
  name: string;
  is_active: boolean;
}

interface Booking {
  id: string;
  staff_id: string;
  starts_at_utc: string;
  ends_at_utc: string;
  client_name: string | null;
  status: string;
}

interface TimeSlot {
  hour: number;
  minute: number;
  label: string;
}

export function CalendarPage() {
  const { selectedBranchId } = useAppStore();
  const [selectedDate, setSelectedDate] = useState(DateTime.now().toISODate());
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const timeSlots: TimeSlot[] = [];
  for (let hour = 9; hour <= 21; hour++) {
    timeSlots.push({
      hour,
      minute: 0,
      label: `${hour.toString().padStart(2, '0')}:00`,
    });
    if (hour < 21) {
      timeSlots.push({
        hour,
        minute: 30,
        label: `${hour.toString().padStart(2, '0')}:30`,
      });
    }
  }

  useEffect(() => {
    if (selectedBranchId) {
      loadStaff();
    }
  }, [selectedBranchId]);

  useEffect(() => {
    if (selectedBranchId && selectedDate) {
      loadBookings();
    }
  }, [selectedBranchId, selectedDate]);

  const loadStaff = async () => {
    if (!selectedBranchId) return;

    try {
      const { data } = await supabase
        .from('staff')
        .select('*')
        .eq('branch_id', selectedBranchId)
        .eq('is_active', true)
        .order('name');

      if (data) {
        setStaff(data);
        setSelectedStaff(data.map(s => s.id));
      }
    } catch (error) {
      console.error('Error loading staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBookings = async () => {
    if (!selectedBranchId || !selectedDate) return;

    try {
      const startOfDay = DateTime.fromISO(selectedDate).startOf('day').toISO();
      const endOfDay = DateTime.fromISO(selectedDate).endOf('day').toISO();

      const { data } = await supabase
        .from('bookings')
        .select('*')
        .eq('branch_id', selectedBranchId)
        .gte('starts_at_utc', startOfDay)
        .lte('starts_at_utc', endOfDay)
        .in('staff_id', selectedStaff);

      setBookings(data || []);
    } catch (error) {
      console.error('Error loading bookings:', error);
    }
  };

  const toggleStaff = (staffId: string) => {
    if (selectedStaff.includes(staffId)) {
      setSelectedStaff(selectedStaff.filter(id => id !== staffId));
    } else {
      setSelectedStaff([...selectedStaff, staffId]);
    }
  };

  const toggleAllStaff = () => {
    if (selectedStaff.length === staff.length) {
      setSelectedStaff([]);
    } else {
      setSelectedStaff(staff.map(s => s.id));
    }
  };

  const isSlotBooked = (staffId: string, slot: TimeSlot): Booking | null => {
    if (!selectedDate) return null;

    const slotTime = DateTime.fromISO(selectedDate).set({ hour: slot.hour, minute: slot.minute });

    for (const booking of bookings) {
      if (booking.staff_id !== staffId) continue;

      const bookingStart = DateTime.fromISO(booking.starts_at_utc);
      const bookingEnd = DateTime.fromISO(booking.ends_at_utc);

      if (slotTime >= bookingStart && slotTime < bookingEnd) {
        return booking;
      }
    }

    return null;
  };

  const getSlotColor = (staffId: string, slot: TimeSlot): string => {
    const booking = isSlotBooked(staffId, slot);
    if (!booking) return 'bg-green-100 border-green-200';
    if (booking.status === 'cancelled') return 'bg-slate-100 border-slate-200';
    if (booking.status === 'completed') return 'bg-blue-100 border-blue-200';
    return 'bg-red-100 border-red-200';
  };

  const getSlotTitle = (staffId: string, slot: TimeSlot): string => {
    const booking = isSlotBooked(staffId, slot);
    if (!booking) return 'Свободно';
    return booking.client_name || 'Занято';
  };

  if (!selectedBranchId) {
    return (
      <Layout>
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-700 mb-2">Выберите филиал</h2>
          <p className="text-slate-600">
            Для просмотра календаря выберите филиал в верхнем меню
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
            <h1 className="text-3xl font-bold text-slate-900">Календарь</h1>
            <p className="text-slate-600 mt-1">Расписание и доступность сотрудников</p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-slate-600" />
              <input
                type="date"
                value={selectedDate || ''}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
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
            <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">Выбор сотрудников</h2>
                <button
                  onClick={toggleAllStaff}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                >
                  {selectedStaff.length === staff.length ? 'Снять все' : 'Выбрать всех'}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {staff.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => toggleStaff(s.id)}
                    className={`flex items-center px-4 py-2 rounded-lg border-2 transition ${
                      selectedStaff.includes(s.id)
                        ? 'bg-blue-100 border-blue-500 text-blue-900'
                        : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    {s.name}
                    {selectedStaff.includes(s.id) && (
                      <CheckCircle className="w-4 h-4 ml-2 text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {selectedStaff.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 border border-slate-200 text-center">
                <Users className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-700 mb-2">Выберите сотрудников</h3>
                <p className="text-slate-600">
                  Выберите хотя бы одного сотрудника для отображения расписания
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900">
                      Расписание на {DateTime.fromISO(selectedDate || DateTime.now().toISODate()).toFormat('dd MMMM yyyy')}
                    </h2>
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-green-100 border border-green-200 rounded mr-2"></div>
                        <span className="text-slate-600">Свободно</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-red-100 border border-red-200 rounded mr-2"></div>
                        <span className="text-slate-600">Занято</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded mr-2"></div>
                        <span className="text-slate-600">Завершено</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider w-24">
                          <Clock className="w-4 h-4 inline mr-1" />
                          Время
                        </th>
                        {staff
                          .filter(s => selectedStaff.includes(s.id))
                          .map((s) => (
                            <th key={s.id} className="px-4 py-3 text-center text-xs font-medium text-slate-700 uppercase tracking-wider">
                              {s.name}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {timeSlots.map((slot) => (
                        <tr key={slot.label}>
                          <td className="px-4 py-2 text-sm font-medium text-slate-900 bg-slate-50">
                            {slot.label}
                          </td>
                          {staff
                            .filter(s => selectedStaff.includes(s.id))
                            .map((s) => {
                              const booking = isSlotBooked(s.id, slot);
                              return (
                                <td key={s.id} className="px-2 py-2">
                                  <div
                                    className={`h-12 rounded border-2 flex items-center justify-center text-xs font-medium transition ${getSlotColor(
                                      s.id,
                                      slot
                                    )}`}
                                    title={getSlotTitle(s.id, slot)}
                                  >
                                    {booking ? (
                                      <span className="text-slate-700 truncate px-2">
                                        {booking.client_name || 'Занято'}
                                      </span>
                                    ) : (
                                      <span className="text-green-700">Свободно</span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
