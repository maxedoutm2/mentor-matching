'use client';

import { useRef, useState, useCallback } from 'react';
import { HOURS, formatHour, slotKey } from '@/lib/weeks';
import type { WeekDay } from '@/lib/types';

interface Props {
  days: WeekDay[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

const SLOT_HEIGHT = 38; // px per hour slot

export default function AvailabilityGrid({ days, selected, onChange }: Props) {
  const isDragging = useRef(false);
  const dragAction = useRef<'add' | 'remove'>('add');

  const toggle = useCallback(
    (date: string, hour: number, forceAction?: 'add' | 'remove') => {
      const key = slotKey(date, hour);
      onChange(prev => {
        const next = new Set(prev);
        const action = forceAction ?? (next.has(key) ? 'remove' : 'add');
        if (action === 'add') next.add(key);
        else next.delete(key);
        return next;
      });
    },
    [onChange]
  );

  function handleMouseDown(date: string, hour: number) {
    isDragging.current = true;
    const key = slotKey(date, hour);
    dragAction.current = selected.has(key) ? 'remove' : 'add';
    toggle(date, hour, dragAction.current);
  }

  function handleMouseEnter(date: string, hour: number) {
    if (!isDragging.current) return;
    toggle(date, hour, dragAction.current);
  }

  function handleMouseUp() { isDragging.current = false; }

  function selectMorning() {
    onChange(prev => { const next = new Set(prev); for (const day of days) for (const h of [8,9,10,11,12,13]) next.add(slotKey(day.date,h)); return next; });
  }
  function selectAfternoon() {
    onChange(prev => { const next = new Set(prev); for (const day of days) for (const h of [14,15,16,17,18]) next.add(slotKey(day.date,h)); return next; });
  }
  function clearAll() {
    onChange(prev => { const next = new Set(prev); for (const day of days) for (const h of HOURS) next.delete(slotKey(day.date,h)); return next; });
  }

  const colCount = days.length;
  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={selectMorning} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-sky-100 text-sky-700 hover:bg-sky-200 transition">🌅 Mañana (8-13h)</button>
        <button onClick={selectAfternoon} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 transition">☀️ Tarde (14-18h)</button>
        <button onClick={clearAll} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition">✕ Limpiar semana</button>
      </div>
      <div className="grid-container overflow-x-auto rounded-xl border border-gray-200 shadow-sm" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
        <div style={{display:'grid',gridTemplateColumns:`56px repeat(${colCount},minmax(80px,1fr))`,minWidth:56+colCount*80}}>
          <div className="sticky left-0 bg-white z-10 border-b border-r border-gray-200" />
          {days.map(day => (
            <div key={day.date} className="border-b border-r border-gray-200 bg-white text-center py-2 px-1">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{day.shortLabel}</div>
              <div className="text-sm font-bold text-gray-900">{day.dayOfMonth}</div>
              <div className="text-xs text-gray-400">{day.monthLabel}</div>
            </div>
          ))}
          {HOURS.map(hour => (
            <>
              <div key={`label-${hour}`} className="sticky left-0 bg-white border-b border-r border-gray-200 flex items-center justify-end pr-2 z-10" style={{height:SLOT_HEIGHT}}>
                <span className="text-xs text-gray-400 font-medium">{formatHour(hour)}</span>
              </div>
              {days.map(day => {
                const key = slotKey(day.date, hour);
                const isSelected = selected.has(key);
                return (
                  <div key={key} className={`slot-cell border-b border-r border-gray-100 ${isSelected?'available':'unavailable'}`} style={{height:SLOT_HEIGHT}} onMouseDown={()=>handleMouseDown(day.date,hour)} onMouseEnter={()=>handleMouseEnter(day.date,hour)} />
                );
              })}
            </>
          ))}
        </div>
      </div>
      <div className="flex gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-emerald-400" />Disponible</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-gray-100 border border-gray-200" />No disponible</span>
        <span className="text-gray-400">· Har click o arrastra para seleccionar</span>
      </div>
    </div>
  );
}
