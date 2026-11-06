'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Participante } from '@/lib/supabase';

export default function GraciasPage() {
  const router = useRouter();
  const [participante, setParticipante] = useState<Participante | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('participante');
    if (raw) setParticipante(JSON.parse(raw));
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          ¡Disponibilidad enviada!
        </h1>
        <p className="text-gray-500 mb-2">
          {participante
            ? `Gracias, ${participante.nombre}. `
            : 'Gracias. '}
          Hemos guardado tus horarios disponibles.
          Los organizadores del evento los utilizarán para hacer el matching.
        </p>
        {participante?.grupos && (
          <div
            className="inline-block mt-4 px-4 py-2 rounded-full text-sm font-medium text-white mb-6"
            style={{ backgroundColor: participante.grupos.color }}
          >
            {participante.grupos.nombre}
          </div>
        )}

        <div className="card mt-6 text-left space-y-3">
          <h2 className="font-semibold text-gray-800">¿Qué pasa ahora?</h2>
          <div className="flex gap-3 text-sm text-gray-600">
            <span className="text-xl">📋</span>
            <span>Los organizadores revisarán todas las disponibilidades y harán el matching.</span>
          </div>
          <div className="flex gap-3 text-sm text-gray-600">
            <span className="text-xl">📧</span>
            <span>Te llegarán los detalles de tus sesiones por email.</span>
          </div>
          <div className="flex gap-3 text-sm text-gray-600">
            <span className="text-xl">🔄</span>
            <span>Puedes volver a esta página para modificar tu disponibilidad si cambia algo.</span>
          </div>
        </div>

        <button
          onClick={() => router.push('/disponibilidad')}
          className="btn-secondary mt-6"
        >
          ← Volver a mi calendario
        </button>
      </div>
    </main>
  );
}
