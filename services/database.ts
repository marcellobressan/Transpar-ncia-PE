import { neon, neonConfig } from '@neondatabase/serverless';

// Configuração do Neon
neonConfig.fetchConnectionCache = true;

// Connection string do Neon PostgreSQL
const DATABASE_URL = import.meta.env.VITE_DATABASE_URL || 
  'postgresql://neondb_owner:npg_gs2Cx3KazocU@ep-broad-tooth-acmyt2rt-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require';

// Cliente SQL
export const sql = neon(DATABASE_URL);

// Tipos para as tabelas
export interface PoliticianRecord {
  id: string;
  name: string;
  party: string;
  current_role: string;
  disputed_role: string | null;
  candidacy_status: string;
  sphere: string;
  location: string;
  photo_url: string;
  total_spending_10_years: number;
  total_spending_last_mandate: number;
  spending_per_capita: number;
  spending_trend: string;
  efficiency_rating: string;
  party_average_comparison: number;
  state_average_comparison: number;
  red_flags_summary: string;
  data_availability_score: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface SpendingRecordDB {
  id?: number;
  politician_id: string;
  year: number;
  category: string;
  amount: number;
  description: string;
  source: string;
  type: 'salary' | 'ceap';
  created_at?: Date;
}

export interface AmendmentRecordDB {
  id?: number;
  politician_id: string;
  year: number;
  proposed: number;
  executed: number;
  created_at?: Date;
}

export interface RedFlagRecordDB {
  id: string;
  politician_id: string;
  title: string;
  description: string;
  source: string;
  source_url: string;
  date: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  created_at?: Date;
}

// Funções de inicialização do banco
export async function initializeDatabase(): Promise<void> {
  try {
    // Criar tabela de políticos
    await sql`
      CREATE TABLE IF NOT EXISTS politicians (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        party VARCHAR(50),
        current_role VARCHAR(255),
        disputed_role VARCHAR(255),
        candidacy_status VARCHAR(100),
        sphere VARCHAR(50),
        location VARCHAR(255),
        photo_url TEXT,
        total_spending_10_years DECIMAL(15, 2) DEFAULT 0,
        total_spending_last_mandate DECIMAL(15, 2) DEFAULT 0,
        spending_per_capita DECIMAL(15, 2) DEFAULT 0,
        spending_trend VARCHAR(50),
        efficiency_rating VARCHAR(50),
        party_average_comparison DECIMAL(5, 2) DEFAULT 1,
        state_average_comparison DECIMAL(5, 2) DEFAULT 1,
        red_flags_summary TEXT,
        data_availability_score INTEGER DEFAULT 0,
        key_findings TEXT[],
        missing_data_warnings TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Criar tabela de gastos
    await sql`
      CREATE TABLE IF NOT EXISTS spending_records (
        id SERIAL PRIMARY KEY,
        politician_id VARCHAR(255) REFERENCES politicians(id) ON DELETE CASCADE,
        year INTEGER NOT NULL,
        category VARCHAR(255),
        amount DECIMAL(15, 2),
        description TEXT,
        source VARCHAR(255),
        type VARCHAR(50) CHECK (type IN ('salary', 'ceap')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Criar tabela de emendas
    await sql`
      CREATE TABLE IF NOT EXISTS amendments (
        id SERIAL PRIMARY KEY,
        politician_id VARCHAR(255) REFERENCES politicians(id) ON DELETE CASCADE,
        year INTEGER NOT NULL,
        proposed DECIMAL(15, 2) DEFAULT 0,
        executed DECIMAL(15, 2) DEFAULT 0,
        top_areas TEXT[],
        geo_distribution TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Criar tabela de assessores
    await sql`
      CREATE TABLE IF NOT EXISTS advisor_stats (
        id SERIAL PRIMARY KEY,
        politician_id VARCHAR(255) REFERENCES politicians(id) ON DELETE CASCADE,
        total_advisors INTEGER DEFAULT 0,
        max_advisors INTEGER DEFAULT 25,
        monthly_cost DECIMAL(15, 2) DEFAULT 0,
        max_monthly_cost DECIMAL(15, 2) DEFAULT 118000,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(politician_id)
      )
    `;

    // Criar tabela de red flags
    await sql`
      CREATE TABLE IF NOT EXISTS red_flags (
        id VARCHAR(255) PRIMARY KEY,
        politician_id VARCHAR(255) REFERENCES politicians(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        source VARCHAR(255),
        source_url TEXT,
        date VARCHAR(50),
        severity VARCHAR(10) CHECK (severity IN ('HIGH', 'MEDIUM', 'LOW')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Criar índices para melhor performance
    await sql`CREATE INDEX IF NOT EXISTS idx_politicians_party ON politicians(party)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_politicians_sphere ON politicians(sphere)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_politicians_location ON politicians(location)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_spending_politician ON spending_records(politician_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_amendments_politician ON amendments(politician_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_red_flags_politician ON red_flags(politician_id)`;

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

// CRUD para Políticos
export async function createPolitician(politician: PoliticianRecord): Promise<PoliticianRecord> {
  const result = await sql`
    INSERT INTO politicians (
      id, name, party, current_role, disputed_role, candidacy_status,
      sphere, location, photo_url, total_spending_10_years, total_spending_last_mandate,
      spending_per_capita, spending_trend, efficiency_rating, party_average_comparison,
      state_average_comparison, red_flags_summary, data_availability_score
    ) VALUES (
      ${politician.id}, ${politician.name}, ${politician.party}, ${politician.current_role},
      ${politician.disputed_role}, ${politician.candidacy_status}, ${politician.sphere},
      ${politician.location}, ${politician.photo_url}, ${politician.total_spending_10_years},
      ${politician.total_spending_last_mandate}, ${politician.spending_per_capita},
      ${politician.spending_trend}, ${politician.efficiency_rating}, ${politician.party_average_comparison},
      ${politician.state_average_comparison}, ${politician.red_flags_summary}, ${politician.data_availability_score}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      party = EXCLUDED.party,
      current_role = EXCLUDED.current_role,
      disputed_role = EXCLUDED.disputed_role,
      candidacy_status = EXCLUDED.candidacy_status,
      sphere = EXCLUDED.sphere,
      location = EXCLUDED.location,
      photo_url = EXCLUDED.photo_url,
      total_spending_10_years = EXCLUDED.total_spending_10_years,
      total_spending_last_mandate = EXCLUDED.total_spending_last_mandate,
      spending_per_capita = EXCLUDED.spending_per_capita,
      spending_trend = EXCLUDED.spending_trend,
      efficiency_rating = EXCLUDED.efficiency_rating,
      party_average_comparison = EXCLUDED.party_average_comparison,
      state_average_comparison = EXCLUDED.state_average_comparison,
      red_flags_summary = EXCLUDED.red_flags_summary,
      data_availability_score = EXCLUDED.data_availability_score,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  return result[0] as PoliticianRecord;
}

export async function getPoliticianById(id: string): Promise<PoliticianRecord | null> {
  const result = await sql`
    SELECT * FROM politicians WHERE id = ${id}
  `;
  return result[0] as PoliticianRecord || null;
}

export async function getAllPoliticians(filters?: {
  sphere?: string;
  party?: string;
  location?: string;
  candidacy_status?: string;
}): Promise<PoliticianRecord[]> {
  if (!filters || Object.keys(filters).length === 0) {
    return await sql`SELECT * FROM politicians ORDER BY name` as PoliticianRecord[];
  }

  // Build dynamic query based on filters
  let query = 'SELECT * FROM politicians WHERE 1=1';
  const params: any[] = [];
  
  if (filters.sphere) {
    params.push(filters.sphere);
    query += ` AND sphere = $${params.length}`;
  }
  if (filters.party) {
    params.push(filters.party);
    query += ` AND party = $${params.length}`;
  }
  if (filters.location) {
    params.push(filters.location);
    query += ` AND location = $${params.length}`;
  }
  if (filters.candidacy_status) {
    params.push(filters.candidacy_status);
    query += ` AND candidacy_status = $${params.length}`;
  }
  
  query += ' ORDER BY name';
  
  // Use raw query for dynamic filters
  const result = await sql.apply(null, [query, ...params] as any);
  return result as PoliticianRecord[];
}

export async function searchPoliticians(searchTerm: string): Promise<PoliticianRecord[]> {
  const result = await sql`
    SELECT * FROM politicians 
    WHERE name ILIKE ${'%' + searchTerm + '%'}
       OR party ILIKE ${'%' + searchTerm + '%'}
       OR current_role ILIKE ${'%' + searchTerm + '%'}
    ORDER BY name
  `;
  return result as PoliticianRecord[];
}

export async function deletePolitician(id: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM politicians WHERE id = ${id} RETURNING id
  `;
  return result.length > 0;
}

// CRUD para Gastos
export async function addSpendingRecord(record: SpendingRecordDB): Promise<SpendingRecordDB> {
  const result = await sql`
    INSERT INTO spending_records (politician_id, year, category, amount, description, source, type)
    VALUES (${record.politician_id}, ${record.year}, ${record.category}, ${record.amount}, 
            ${record.description}, ${record.source}, ${record.type})
    RETURNING *
  `;
  return result[0] as SpendingRecordDB;
}

export async function getSpendingByPolitician(politicianId: string, type?: 'salary' | 'ceap'): Promise<SpendingRecordDB[]> {
  if (type) {
    return await sql`
      SELECT * FROM spending_records 
      WHERE politician_id = ${politicianId} AND type = ${type}
      ORDER BY year DESC
    ` as SpendingRecordDB[];
  }
  return await sql`
    SELECT * FROM spending_records 
    WHERE politician_id = ${politicianId}
    ORDER BY year DESC
  ` as SpendingRecordDB[];
}

// CRUD para Emendas
export async function addAmendment(amendment: AmendmentRecordDB): Promise<AmendmentRecordDB> {
  const result = await sql`
    INSERT INTO amendments (politician_id, year, proposed, executed)
    VALUES (${amendment.politician_id}, ${amendment.year}, ${amendment.proposed}, ${amendment.executed})
    RETURNING *
  `;
  return result[0] as AmendmentRecordDB;
}

export async function getAmendmentsByPolitician(politicianId: string): Promise<AmendmentRecordDB[]> {
  return await sql`
    SELECT * FROM amendments 
    WHERE politician_id = ${politicianId}
    ORDER BY year DESC
  ` as AmendmentRecordDB[];
}

// CRUD para Red Flags
export async function addRedFlag(redFlag: RedFlagRecordDB): Promise<RedFlagRecordDB> {
  const result = await sql`
    INSERT INTO red_flags (id, politician_id, title, description, source, source_url, date, severity)
    VALUES (${redFlag.id}, ${redFlag.politician_id}, ${redFlag.title}, ${redFlag.description}, 
            ${redFlag.source}, ${redFlag.source_url}, ${redFlag.date}, ${redFlag.severity})
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      source = EXCLUDED.source,
      source_url = EXCLUDED.source_url,
      date = EXCLUDED.date,
      severity = EXCLUDED.severity
    RETURNING *
  `;
  return result[0] as RedFlagRecordDB;
}

export async function getRedFlagsByPolitician(politicianId: string): Promise<RedFlagRecordDB[]> {
  return await sql`
    SELECT * FROM red_flags 
    WHERE politician_id = ${politicianId}
    ORDER BY severity, date DESC
  ` as RedFlagRecordDB[];
}

// Funções de Estatísticas
export async function getSpendingStats(): Promise<{
  totalSpending: number;
  avgSpending: number;
  maxSpending: number;
  minSpending: number;
}> {
  const result = await sql`
    SELECT 
      SUM(total_spending_10_years) as total_spending,
      AVG(total_spending_10_years) as avg_spending,
      MAX(total_spending_10_years) as max_spending,
      MIN(total_spending_10_years) as min_spending
    FROM politicians
  `;
  return {
    totalSpending: Number(result[0].total_spending) || 0,
    avgSpending: Number(result[0].avg_spending) || 0,
    maxSpending: Number(result[0].max_spending) || 0,
    minSpending: Number(result[0].min_spending) || 0,
  };
}

export async function getPartyStats(): Promise<Array<{
  party: string;
  count: number;
  avg_spending: number;
}>> {
  return await sql`
    SELECT 
      party,
      COUNT(*) as count,
      AVG(total_spending_10_years) as avg_spending
    FROM politicians
    GROUP BY party
    ORDER BY count DESC
  ` as any[];
}

// Teste de conexão
export async function testConnection(): Promise<boolean> {
  try {
    const result = await sql`SELECT NOW() as current_time`;
    console.log('✅ Database connection successful:', result[0].current_time);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

export default {
  sql,
  initializeDatabase,
  testConnection,
  createPolitician,
  getPoliticianById,
  getAllPoliticians,
  searchPoliticians,
  deletePolitician,
  addSpendingRecord,
  getSpendingByPolitician,
  addAmendment,
  getAmendmentsByPolitician,
  addRedFlag,
  getRedFlagsByPolitician,
  getSpendingStats,
  getPartyStats,
};
