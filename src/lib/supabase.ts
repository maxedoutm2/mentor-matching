import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client uses service_role key (only used in API routes, never exposed to browser)
export function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return supabase; // fallback for dev without service key
  return createClient(supabaseUrl, serviceKey);
}

// ---- Participantes ----

export interface Participante {
  id: string;
  email: string;
  nombre: string;
  rol: 'mentor' | 'alumno';
  grupo_id: string | null;
  ha_registrado: boolean;
  notas: string | null;
  created_at: string;
  grupos?: { nombre: string; color: string };
}

export async function buscarParticipantePorEmail(email: string): Promise<Participante | null> {
  const { data } = await supabase
    .from('participantes')
    .select('*, grupos(nombre, color) ')
    .eq('email', email.toLowerCase().trim())
    .single();
  return data;
}

export async function marcarRegistrado(id: string) {
  await supabase
    .from('participantes')
    .update({ ha_registrado: true })
    .eq('id', id);
}

// ---- Disponibilidad ----

export async function getSlots(participanteId: string): Promise<string[]> {
  const { data } = await supabase
    .from('disponibilidad')
    .select('fecha, hora')
    .eq('participante_id', participanteId);
  return (data || []).map((r: { fecha: string; hora: number }) => `${r.fecha}_${r.hora}`);
}

export async function saveSlots(participanteId: string, slotKeys: string[]) {
  // Delete all and re-insert (simplest approach)
  await supabase.from('disponibilidad').delete().eq('participante_id', participanteId);

  if (slotKeys.length === 0) return;

  const rows = slotKeys.map(key => {
    const [fecha, horaStr] = key.split('_');
    return { participante_id: participanteId, fecha, hora: parseInt(horaStr) };
  });

  const { error } = await supabase.from('disponibilidad').insert(rows);
  if (error) throw error;
}

// ---- Admin ----

export interface Grupo {
  id: string;
  nombre: string;
  color: string;
}

export async function getGrupos(): Promise<Grupo[]> {
  const { data } = await supabase
    .from('grupos')
    .select('*')
    .order('nombre');
  return data || [];
}

export async function getTodosParticipantes(): Promise<Participante[]> {
  const { data } = await supabase
    .from('participantes')
    .select('*, grupos(nombre, color)')
    .order('nombre');
  return data || [];
}

export async function getTodasDisponibilidades() {
  const { data } = await supabase
    .from('disponibilidad')
    .select('fecha, hora, participante_id, participantes(nombre, rol, grupo_id, grupos(nombre, color))');
  return data || [];
}

export async function getMatchingPorGrupo() {
  const { data } = await supabase
    .from('disponibilidad')
    .select('fecha, hora, participantes(id, nombre, rol, grupo_id, grupos(nombre, color))');
  if (!data) return {};
  const result = {};
  for (const row of data) {
    const p = row.participantes;
    if (!p) continue;
    const grupoKey = p.grupo_id || 'sin-grupo';
    const slotKey = `${row.fecha}_${row.hora}`;
    if (!result[grupoKey]) result[grupoKey] = {};
    if (!result[grupoKey][slotKey]) result[grupoKey][slotKey] = {fecha:row.fecha,hora:row.hora,mentores:[],alumnos:[]};
    if (p.rol === 'mentor') result[grupoKey][slotKey].mentores.push(p.nombre);
    else result[grupoKey][slotKey].alumnos.push(p.nombre);
  }
  return result;
}

export async function importarParticipantes(filas) {
  const { data: grupos } = await supabase.from('grupos').select('*');
  if (!grupos) throw new Error('No se pudieron cargar los grupos');
  const grupoMap = {};
  for (const g of grupos) grupoMap[g.nombre.toLowerCase()] = g.id;
  const rows = filas.map(f => ({email:f.email.toLowerCase().trim(),nombre:f.nombre.trim(),rol:f.rol.toLowerCase().trim()==='mentor'?'mentor':'alumno',grupo_id:grupoMap[f.grupo_nombre.toLowerCase()]||null}));
  const { error, data } = await supabase.from('participantes').upsert(rows,{onConflict:'email',ignoreDuplicates:false}).select();
  if (error) throw error;
  return data;
}