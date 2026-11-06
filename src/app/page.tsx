'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { buscarParticipantePorEmail } from '@/lib/supabase';

export default function LandingPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');

    try {
      const participante = await buscarParticipantePorEmail(email.trim());

      if (!participante) {
        setError(
          'Este email no está registrado en el evento. Contacta con los organizadores si crees que es un error.'
        );
        setLoading(false);
        return;
      }

      // Store in sessionStorage — the name from DB takes priority,
      // but we keep what the user typed just in case
      sessionStorage.setItem('participante', JSON.stringify(participante));
      router.push('/disponibilidad');

    } catch {
      setError('Error de conexión. Intenta de nuevo en unos segundos.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16 bg-gradient-to-b from-brand-50 to-gray-50">

      {/* Badge */}
      <div className="inline-flex items-center gap-2 bg-white border border-brand-100 text-brand-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6 shadow-sm">
         🛓️ 7 semanas · 11 Nov ↔ 27 Dic 2026
      </div>

      {/* Title */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-3 leading-tight">
          Matching de Mentores<br />y Alumnos
        </h1>
        <p className="text-gray-500 text-lg max-w-sm mx-auto">
          Indica tu disponibilidad para que podamos organizar las sesiones de mentoring.
        </p>
      </div>

      {/* Card */}
      <div className="card w-full max-w-sm shadow-md">
        <h2 className="text-lg font-semibold mb-1">Accede a tu calendario</h2>
        <p className="text-sm text-gray-500 mb-5">
          Introduce tu nombre y email. Usaremos el email para identificarte y mostrarte el calendario de tu grupo.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Tu nombre</label>
            <input
              type="text"
              className="input"
              placeholder="María García"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Email del evento</label>
            <input
              type="email"
              className="input"
              placeholder="tu@email.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full !mt-5"
            disabled={loading || !email.trim()}
          >
            {loading ? 'Buscando...' : 'Acceder a mi calendario →'}
          </button>
        </form>
      </div>

      <p className="mt-6 text-xs text-gray-400 text-center max-w-xs">
        ¿No encuentras tu email? Contacta con los organizadores del evento.
      </p>
    </main>
  );
}
