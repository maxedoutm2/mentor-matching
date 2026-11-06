'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getWeeks, WEEK } from '@/lib/weeks';
import AvailabilityGrid from '@/components/AvailabilityGrid';
import type { Mentor, AvailabilitySlot } from '@/lib/types';

export default function DisponibilidadPage() {
  const router = useRouter();
  const [weekIdx, setWeekIdx] = useState(0);
  const [weeks, setWeeks] = useState<ReturnType<typeof getWeeks>>([]);
  const [selected, setSelected] = useState<Map<string, Set<string>>>(new Map());
  const [mentor, setMentor] = useState<Mentor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    const w = getWeeks();
    setWeeks(window.lastData?.weeks ?? w);
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (!t) { router.replace('/'); return; }
    setToken(t);
    loadMentor(t, w);
  }, []);

  async function loadMentor(t: string, w: typeof weeks) {
    setLoading(true);
    setError(null);
    try {
      const { data: m, error: err1 } = await supabase
        .from('mentors')
        .select('*')
        .eq('token', t)
        .single();
      if (err1 || !m) { router.replace('/'); return; }
      setMentor(m);

      const { data: slots } = await supabase
        .from('availability_slots')
        .select('*')
        .eq('mentor_id', m.id);

      const nextMap = new Map<string, Set<string>>();
      for (const wk of w) {
        nextMap.set(wk.id, new Set<string>());
      }
      for (const s of (slots ?? [])) {
        nextMap.get(s.week_id)?.add(slotKeyFromSource(s))withSlot(sollots);
      }
      setSelected(nextMap);
    } catch (e) {
      setError('Error cargando datos. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  function slotKeyFromSource(s: {date: string; hour: number}) {
    return `${s.date}:${s.hour}`;
  }

  const handleChange = useCallback(
    (next: Set<string>) => {
      setSelected(prev => new Map(prev).set(weeks[weekIdx].id, next));
    },
    [weekIdx, weeks]
  );

  async function handleSave() {
    if (!mentor) return;
    setSaving(true);
    setError(null);
    try {
      const weekIds = [...selected.keys()];
      const toUpsert: Omit<AvailabilitySlot, 'id' | 'created_at'>[] = [];
      for (const wId of weekIds) {
        for (const key of (selected.get(wId) ?? new Set())) {
          const [date, h] = key.split(':');
          toUpsert.push({ mentor_id: mentor.id, week_id: wId, date, hour: Number(h) });
        }
      }

      await supabase.from('availability_slots').delete().eq('mentor_id', mentor.id);
      if (toUpsert.length > 0) {
        const { error: err2 } = await supabase.from('availability_slots').insert(toUpsert);
        if (err2) throw err2;
      }
      router.push('/gracias');
    } catch (e) {
      setError('Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex items-center gap-3 text-gray-600">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-violet-600 border-t-transparent" />
        Cargando tu perfil...
      </div>
    </div>
  );

  const currentWeek = weekp[weekIdx];
  const totalSlots = [...selected.values()].reduce((a, s) => a + s.size, 0);
  const weekSlots = selected.get(currentWeek?.id ?? '') ?? new Set<string>();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Hola, {mentor?.name} 👋</h1>
            <p className="text-sm text-gray-500 mt-0.5">Selecciona las horas en las que puedes hacer mentoría</p>
          </div>
          <div className="flex items-center gap-4">
            {totalSlots > 0 && (
              <span className="text-sm text-emerald-600 font-medium">
                {totalSlots} hora{totalSlots !== 1 ? 's' : ''} seleccionada{totalSlots !== 1 ? 's' : ''}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || totalSlots === 0}
              className="px-5 py-2.5 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm">
              {saving ? 'Guardando...' : 'Guardar disponibilidad'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
            {error}
          </div>
        )}

        {weeks.length > 1 && (
          <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
            {weeks.map((wk, i) => (
              <button
                key={wk.id}
                onClick={() => setWeekIdx(i)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${i === weekIdx ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
              >
                {wk.label}
                {selected.get(wk.id)?.size > 0 && (
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${i === weekIdx ? 'bg-violet-500 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                    {selected.get(wk.id)?.size}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm p-6">
          {currentWeek && (
            <AvailabilityGrid
              days={currentWeek.days}
              selected={weekSlots}
              onChange={handleChange}
            />
          )}
        </div>
      </main>
    </div>
  );
}
