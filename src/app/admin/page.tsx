'use client';

import { useState, useEffect } from 'react';
import {
  getGrupos, getTodosParticipantes, getMatchingPorGrupo,
  importarParticipantes,
  type Participante, type Grupo,
} from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { getWeeks, HOURS, formatHour } from '@/lib/weeks';

const WEEKS = getWeeks();
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin2026';

// All weekdays across the 7 weeks
const ALL_DAYS = WEEKS.flatMap(w => w.days);

// ---- CSV parser ----
function parseCSV(text: string) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) throw new Error('El CSV debe tener encabezado y al menos una fila');
  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const idx = (terms: string[]) => header.findIndex(h => terms.some(t => h.includes(t)));
  const emailIdx = idx(['email']);
  const nombreIdx = idx(['nombre', 'name']);
  const rolIdx = idx(['rol', 'role']);
  const grupoIdx = idx(['grupo', 'group']);
  if ([emailIdx, nombreIdx, rolIdx, grupoIdx].some(i => i === -1))
    throw new Error('Columnas requeridas: email, nombre, rol, grupo');
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    return { email: cols[emailIdx], nombre: cols[nombreIdx], rol: cols[rolIdx], grupo_nombre: cols[grupoIdx] };
  });
}

// ---- Types ----
interface SlotDetail {
  fecha: string;
  hora: number;
  participantes: { nombre: string; rol: 'mentor' | 'alumno'; grupo_nombre: string; grupo_color: string }[];
}

// ---- Helper: load all slot details ----
async function loadSlotDetails(): Promise<SlotDetail[]> {
  const { data, error } = await supabase
    .from('disponibilidad')
    .select('fecha, hora, participantes(nombre, rol, grupos(nombre, color))');
  if (error) throw error;

  const map: Record<string, SlotDetail> = {};
  for (const row of data || []) {
    const key = `${row.fecha}_${row.hora}`;
    if (!map[key]) map[key] = { fecha: row.fecha as string, hora: row.hora as number, participantes: [] };
    const p = row.participantes as { nombre: string; rol: string; grupos: { nombre: string; color: string } | null } | null;
    if (p) {
      map[key].participantes.push({
        nombre: p.nombre,
        rol: p.rol as 'mentor' | 'alumno',
        grupo_nombre: p.grupos?.nombre ?? 'Sin grupo',
        grupo_color: p.grupos?.color ?? '#888',
      });
    }
  }
  return Object.values(map).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora - b.hora);
}

// ---- SlotPopup: detail modal ----
function SlotPopup({
  slot, onClose,
}: {
  slot: SlotDetail;
  onClose: () => void;
}) {
  const dateLabel = new Date(slot.fecha + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const mentores = slot.participantes.filter(p => p.rol === 'mentor');
  const alumnos = slot.participantes.filter(p => p.rol === 'alumno');

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-xs text-gray-500 capitalize">{dateLabel}</div>
            <div className="text-xl font-bold text-gray-900">
              {formatHour(slot.hora)} — {formatHour(slot.hora + 1)}
            </div>
            <div className="text-sm text-gray-500 mt-0.5">
              {slot.participantes.length} persona{slot.participantes.length !== 1 ? 's' : ''} disponibles
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
        </div>

        {mentores.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-2">
              Mentores ({mentores.length})
            </div>
            <div className="space-y-1.5">
              {mentores.map(p => (
                <div key={p.nombre} className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: p.grupo_color }}
                  />
                  <span className="text-sm text-gray-800">{p.nombre}</span>
                  <span className="text-xs text-gray-400">{p.grupo_nombre}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {alumnos.length > 0 && (
          <div>
            <div className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">
              Alumnos ({alumnos.length})
            </div>
            <div className="space-y-1.5">
              {alumnos.map(p => (
                <div key={p.nombre} className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: p.grupo_color }}
                  />
                  <span className="text-sm text-gray-800">{p.nombre}</span>
                  <span className="text-xs text-gray-400">{p.grupo_nombre}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {mentores.length > 0 && alumnos.length > 0 && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-sm text-emerald-700 font-medium">
            ✓ Franja con match — {mentores.length} mentor{mentores.length !== 1 ? 'es' : ''} · {alumnos.length} alumno{alumnos.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- HeatGrid: availability heatmap per group ----
function HeatGrid({
  slotDetails,
  grupoFiltro,
  grupos,
}: {
  slotDetails: SlotDetail[];
  grupoFiltro: string | null; // null = all groups
  grupos: Grupo[];
}) {
  const [popup, setPopup] = useState<SlotDetail | null>(null);

  // Build lookup: fecha_hora → participants (filtered by group if needed)
  const lookup: Record<string, SlotDetail> = {};
  for (const slot of slotDetails) {
    const filtered = grupoFiltro
      ? { ...slot, participantes: slot.participantes.filter(p => p.grupo_nombre === grupoFiltro) }
      : slot;
    if (filtered.participantes.length > 0) {
      lookup[`${slot.fecha}_${slot.hora}`] = filtered;
    }
  }

  const maxCount = Math.max(1, ...Object.values(lookup).map(s => s.participantes.length));

  // We show weeks as sections
  return (
    <div>
      {popup && <SlotPopup slot={popup} onClose={() => setPopup(null)} />}

      {WEEKS.map((week, wi) => (
        <div key={wi} className="mb-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">{week.label}</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `48px repeat(${week.days.length}, minmax(72px, 1fr))`,
                minWidth: 48 + week.days.length * 72,
              }}
            >
              {/* Header */}
              <div className="border-b border-r border-gray-200 bg-gray-50" />
              {week.days.map(day => (
                <div
                  key={day.date}
                  className="border-b border-r border-gray-200 bg-gray-50 text-center py-2"
                >
                  <div className="text-xs font-semibold text-gray-500 uppercase">{day.shortLabel}</div>
                  <div className="text-sm font-bold text-gray-800">{day.dayOfMonth}</div>
                  <div className="text-xs text-gray-400">{day.monthLabel}</div>
                </div>
              ))}

              {/* Hour rows */}
              {HOURS.map(hour => (
                <>
                  <div
                    key={`h-${hour}`}
                    className="border-b border-r border-gray-100 bg-white flex items-center justify-end pr-1.5"
                    style={{ height: 36 }}
                  >
                    <span className="text-xs text-gray-400">{formatHour(hour)}</span>
                  </div>

                  {week.days.map(day => {
                    const key = `${day.date}_${hour}`;
                    const slot = lookup[key];
                    const count = slot?.participantes.length ?? 0;
                    const mentorCount = slot?.participantes.filter(p => p.rol === 'mentor').length ?? 0;
                    const alumnoCount = slot?.participantes.filter(p => p.rol === 'alumno').length ?? 0;
                    const hasMatch = mentorCount > 0 && alumnoCount > 0;
                    const opacity = count === 0 ? 0 : 0.2 + (count / maxCount) * 0.8;

                    return (
                      <div
                        key={key}
                        className={`border-b border-r border-gray-100 relative cursor-pointer transition-all ${
                          count === 0 ? 'bg-gray-50 hover:bg-gray-100' : 'hover:opacity-80'
                        } ${hasMatch ? 'ring-inset ring-1 ring-emerald-400' : ''}`}
                        style={{
                          height: 36,
                          backgroundColor: count > 0
                            ? `rgba(79, 110, 247, ${opacity})`
                            : undefined,
                        }}
                        onClick={() => slot && setPopup(slot)}
                        title={count > 0 ? `${count} persona${count !== 1 ? 's' : ''}` : ''}
                      >
                        {count > 0 && (
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow">
                            {count}
                          </span>
                        )}
                        {hasMatch && (
                          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          </div>

          {/* Legend for this week */}
          <div className="flex gap-4 mt-1.5 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              Match (mentor + alumno)
            </span>
            <span>· El número = personas disponibles · Click para ver quiénes</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Participants table ----
function ParticipanteRow({ p }: { p: Participante }) {
  return (
    <tr className="hover:bg-gray-50 transition">
      <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.nombre}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{p.email}</td>
      <td className="px-4 py-3">
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
          p.rol === 'mentor' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {p.rol === 'mentor' ? 'Mentor' : 'Alumno/a'}
        </span>
      </td>
      <td className="px-4 py-3">
        {p.grupos && (
          <span className="text-xs font-semibold px-2 py-1 rounded-full text-white"
            style={{ backgroundColor: p.grupos.color }}>
            {p.grupos.nombre}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs ${p.ha_registrado ? 'text-emerald-600 font-semibold' : 'text-gray-400'}`}>
          {p.ha_registrado ? '✓ Completado' : '○ Pendiente'}
        </span>
      </td>
    </tr>
  );
}

// ---- MAIN ----
export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState<'resumen' | 'disponibilidades' | 'participantes' | 'importar'>('resumen');

  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [slotDetails, setSlotDetails] = useState<SlotDetail[]>([]);
  const [matchingData, setMatchingData] = useState<Record<string, Record<string, { fecha: string; hora: number; mentores: string[]; alumnos: string[] }>>>({});
  const [loading, setLoading] = useState(false);

  const [grupoFiltro, setGrupoFiltro] = useState<string | null>(null);
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');

  async function loadData() {
    setLoading(true);
    try {
      const [g, p, slots, m] = await Promise.all([
        getGrupos(),
        getTodosParticipantes(),
        loadSlotDetails(),
        getMatchingPorGrupo(),
      ]);
      setGrupos(g);
      setParticipantes(p);
      setSlotDetails(slots);
      setMatchingData(m);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (authed) loadData(); }, [authed]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) setAuthed(true);
    else alert('Contraseña incorrecta');
  }

  async function handleImport() {
    setImporting(true);
    setImportResult('');
    try {
      const filas = parseCSV(csvText);
      const result = await importarParticipantes(filas);
      setImportResult(`✓ ${result?.length ?? filas.length} participantes importados/actualizados.`);
      setCsvText('');
      await loadData();
    } catch (err) {
      setImportResult(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setImporting(false);
    }
  }

  // ---- LOGIN ----
  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <div className="card w-full max-w-sm shadow-md">
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">🔐</div>
            <h1 className="text-xl font-bold">Panel de Organizadores</h1>
            <p className="text-sm text-gray-500 mt-1">Acceso restringido</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="password" className="input" placeholder="Contraseña"
              value={password} onChange={e => setPassword(e.target.value)} autoFocus />
            <button type="submit" className="btn-primary w-full">Acceder</button>
          </form>
        </div>
      </main>
    );
  }

  // ---- STATS ----
  const totalMentores = participantes.filter(p => p.rol === 'mentor').length;
  const totalAlumnos = participantes.filter(p => p.rol === 'alumno').length;
  const completados = participantes.filter(p => p.ha_registrado).length;

  const totalMatchSlots = Object.values(matchingData)
    .flatMap(g => Object.values(g))
    .filter(s => s.mentores.length > 0 && s.alumnos.length > 0).length;

  const filteredParticipantes = grupoFiltro
    ? participantes.filter(p => p.grupos?.nombre === grupoFiltro)
    : participantes;

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel de Organizadores</h1>
          <p className="text-sm text-gray-500">Matching · 7 semanas · 11 Nov — 27 Dic 2026</p>
        </div>
        <button onClick={loadData} disabled={loading}
          className="btn-secondary text-sm">
          {loading ? '⟳ Cargando...' : '⟳ Actualizar'}
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { v: totalMentores, l: 'Mentores', c: 'bg-purple-50 text-purple-700' },
          { v: totalAlumnos, l: 'Alumnos', c: 'bg-blue-50 text-blue-700' },
          { v: completados, l: 'Han respondido', c: 'bg-emerald-50 text-emerald-700' },
          { v: totalMatchSlots, l: 'Franjas con match', c: 'bg-amber-50 text-amber-700' },
        ].map(s => (
          <div key={s.l} className={`rounded-2xl p-5 ${s.c}`}>
            <div className="text-3xl font-bold">{s.v}</div>
            <div className="text-sm font-medium mt-0.5 opacity-80">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="card mb-6">
        <div className="flex justify-between text-sm mb-1.5">
          <span className="font-medium text-gray-700">Progreso de respuestas</span>
          <span className="text-gray-500">{completados}/{participantes.length}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div
            className="bg-brand-500 h-2.5 rounded-full transition-all duration-700"
            style={{ width: `${participantes.length ? (completados / participantes.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Group filter chips */}
      <div className="flex gap-2 flex-wrap mb-6">
        <button
          onClick={() => setGrupoFiltro(null)}
          className={`text-sm px-3 py-1.5 rounded-lg font-medium transition ${
            !grupoFiltro ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Todos los grupos
        </button>
        {grupos.map(g => (
          <button
            key={g.id}
            onClick={() => setGrupoFiltro(grupoFiltro === g.nombre ? null : g.nombre)}
            className="text-sm px-3 py-1.5 rounded-lg font-semibold text-white transition"
            style={{ backgroundColor: grupoFiltro === g.nombre ? g.color : g.color + 'aa' }}
          >
            {g.nombre} ({participantes.filter(p => p.grupos?.nombre === g.nombre).length})
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-6">
        {([
          { id: 'resumen', label: '📊 Resumen por grupo' },
          { id: 'disponibilidades', label: '🗓️ Disponibilidades' },
          { id: 'participantes', label: '👥 Participantes' },
          { id: 'importar', label: '📥 Importar CSV' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t.id ? 'bg-brand-500 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ---- TAB: Resumen ---- */}
      {tab === 'resumen' && (
        <div className="grid md:grid-cols-2 gap-5">
          {grupos.map(g => {
            const miembros = participantes.filter(p => p.grupos?.nombre === g.nombre);
            const completadosGrupo = miembros.filter(p => p.ha_registrado).length;
            const mentoresGrupo = miembros.filter(p => p.rol === 'mentor');
            const alumnosGrupo = miembros.filter(p => p.rol === 'alumno');

            const matchData = matchingData[
              grupos.find(gg => gg.nombre === g.nombre)?.id ?? ''
            ] ?? {};
            const matchSlots = Object.values(matchData)
              .filter(s => s.mentores.length > 0 && s.alumnos.length > 0)
              .sort((a, b) => {
                const scoreA = Math.min(a.mentores.length, a.alumnos.length);
                const scoreB = Math.min(b.mentores.length, b.alumnos.length);
                return scoreB - scoreA;
              });

            return (
              <div key={g.id} className="card">
                {/* Group header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-4 h-10 rounded-full" style={{ backgroundColor: g.color }} />
                  <div>
                    <div className="font-bold text-gray-900 text-lg">{g.nombre}</div>
                    <div className="text-xs text-gray-500">
                      {mentoresGrupo.length} mentor{mentoresGrupo.length !== 1 ? 'es' : ''} · {alumnosGrupo.length} alumno{alumnosGrupo.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-xl font-bold text-gray-900">{completadosGrupo}</div>
                    <div className="text-xs text-gray-500">de {miembros.length} resp.</div>
                  </div>
                </div>

                {/* Progress */}
                <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
                  <div className="h-1.5 rounded-full" style={{
                    width: `${miembros.length ? (completadosGrupo / miembros.length) * 100 : 0}%`,
                    backgroundColor: g.color,
                  }} />
                </div>

                {/* Top matches */}
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                    🔗 Mejores franjas ({matchSlots.length} en total)
                  </div>
                  {matchSlots.length === 0 ? (
                    <p className="text-xs text-gray-400">Sin matches todavía.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {matchSlots.slice(0, 5).map(s => {
                        const d = new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-ES', {
                          weekday: 'short', day: 'numeric', month: 'short',
                        });
                        return (
                          <div key={`${s.fecha}_${s.hora}`}
                            className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                            <div className="text-xs text-gray-700 capitalize font-medium">
                              {d} · {formatHour(s.hora)}
                            </div>
                            <div className="flex gap-1.5">
                              <span className="text-xs bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">
                                {s.mentores.length}M
                              </span>
                              <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                                {s.alumnos.length}A
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {matchSlots.length > 5 && (
                        <p className="text-xs text-gray-400 text-center pt-1">
                          +{matchSlots.length - 5} franjas más. Ver en "Disponibilidades".
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Members quick list */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Participantes</div>
                  <div className="flex flex-wrap gap-1">
                    {miembros.map(m => (
                      <span key={m.id} className={`text-xs px-2 py-0.5 rounded-full ${
                        m.ha_registrado ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {m.nombre.split(' ')[0]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- TAB: Disponibilidades (heat grid) ---- */}
      {tab === 'disponibilidades' && (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <h2 className="text-base font-bold text-gray-800">
              Disponibilidades
              {grupoFiltro ? ` — ${grupoFiltro}` : ' — Todos los grupos'}
            </h2>
            <div className="flex items-center gap-3 text-xs text-gray-500 ml-auto">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-3 rounded inline-block" style={{ background: 'rgba(79,110,247,0.2)' }} />
                1 persona
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-3 rounded inline-block" style={{ background: 'rgba(79,110,247,1)' }} />
                Máximo
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full inline-block bg-emerald-400" />
                Match
              </span>
            </div>
          </div>
          <HeatGrid
            slotDetails={slotDetails}
            grupoFiltro={grupoFiltro}
            grupos={grupos}
          />
        </div>
      )}

      {/* ---- TAB: Participantes ---- */}
      {tab === 'participantes' && (
        <div>
          <div className="text-sm text-gray-500 mb-3">
            {filteredParticipantes.length} participante{filteredParticipantes.length !== 1 ? 's' : ''}
            {grupoFiltro ? ` en ${grupoFiltro}` : ' en total'}
          </div>
          <div className="card overflow-hidden p-0">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Nombre', 'Email', 'Rol', 'Grupo', 'Estado'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredParticipantes.map(p => <ParticipanteRow key={p.id} p={p} />)}
              </tbody>
            </table>
            {filteredParticipantes.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">
                No hay participantes. Importa desde CSV para empezar.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- TAB: Importar CSV ---- */}
      {tab === 'importar' && (
        <div className="max-w-2xl">
          <div className="card mb-5">
            <h2 className="text-base font-bold text-gray-800 mb-2">Importar desde Excel / CSV</h2>
            <p className="text-sm text-gray-500 mb-3">
              Pega el contenido CSV de tu Excel. Puedes actualizar participantes existentes (se hace upsert por email).
            </p>
            <div className="bg-gray-50 rounded-xl px-4 py-3 font-mono text-xs text-gray-700 mb-4 overflow-x-auto">
              email,nombre,rol,grupo<br />
              juan@email.com,Juan García,mentor,Grupo 1<br />
              ana@email.com,Ana Martínez,alumno,Grupo 2<br />
              pedro@email.com,Pedro Ruiz,alumno,Grupo 3
            </div>
            <div className="text-xs text-gray-500 space-y-0.5 mb-4">
              <p>• <strong>rol</strong>: "mentor" o "alumno"</p>
              <p>• <strong>grupo</strong>: "Grupo 1", "Grupo 2", "Grupo 3" o "Grupo 4"</p>
              <p>• Si el email ya existe, se actualizan sus datos</p>
            </div>
            <textarea
              className="input font-mono text-xs"
              rows={12}
              placeholder="email,nombre,rol,grupo&#10;juan@email.com,Juan García,mentor,Grupo 1&#10;..."
              value={csvText}
              onChange={e => { setCsvText(e.target.value); setImportResult(''); }}
            />
            {importResult && (
              <div className={`mt-3 text-sm px-4 py-3 rounded-xl ${
                importResult.startsWith('✓')
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {importResult}
              </div>
            )}
            <button
              onClick={handleImport}
              disabled={importing || !csvText.trim()}
              className="btn-primary mt-4"
            >
              {importing ? 'Importando...' : '📥 Importar participantes'}
            </button>
          </div>

          <div className="card bg-blue-50 border-blue-100">
            <h3 className="font-semibold text-blue-900 mb-2">Exportar desde Excel</h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>En tu Excel, asegúrate de tener columnas: <strong>email, nombre, rol, grupo</strong></li>
              <li>Archivo → Guardar como → <strong>CSV (delimitado por comas)</strong></li>
              <li>Abre ese .csv con un editor de texto, copia todo y pégalo aquí</li>
            </ol>
          </div>
        </div>
      )}
    </main>
  );
}
