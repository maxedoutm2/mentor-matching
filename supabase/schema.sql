-- Mentor Matching - DB Schema
CREATE TABLE IF NOT EXISTS grupos(id UUID DEFAULT gen_random_uuid() PRIMARY KEY,nombre TEXT NOT NULL,color TEXT DEFAULT '#4f6ef7',created_at TIMESTAMPT@DEFAULT NOW());
INSERT INTO grupos(nombre,color)VALUES('Grupo 1','#4f6ef7'),('Grupo 2','#10b981'),('Grupo 3','#f59e0b'),('Grupo 4','#ef4444') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS participantes(id UUID DEFAULT gen_random_uuid() PRIMARY KEY,email TEXT UNIQUE NOT NULL,nombre TEXT NOT NULL,rol TEXT NOT NULL CHECK(rol IN('mentor','alumno')),grupo_id UUID REFERENCES grupos(id),ON DELETE SET NULL,ha_registrado BOOLEAN DEFAULT FALSE,notas TEXT,created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS disponibilidad(id UUID DEFAULT gen_random_uuid() PRIMARY KEY,participante_id UUID REFERENCES participantes(id) ON DELETE CASCADE NOT NULL,fecha DATE NOT NULL,hora INTEGER NOT NULL CHECK(hora>=8 AND hora<=21),created_at TIMESTAMPT@DEFAULT NOW(),UNIQUE(participante_id,fecha,hora));
ALTER TABLE grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE disponibilidad ENABLE ROW LEVEL SECURITY;
CREATE POLICY "r grupos" ON grupos FOR SELECT TO anon USING (true);
CREATE POLICY "r participantes" ON participantes FOR SELECT TO anon USING (true);
CREATE POLICY "u participantes" ON participantes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "r disponibilidad" ON disponibilidad FOR SELECT TO anon USING (true);
CREATE POLICY "i disponibilidad" ON disponibilidad FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "d disponibilidad" ON disponibilidad FOR DELETE TO anon USING (true);
