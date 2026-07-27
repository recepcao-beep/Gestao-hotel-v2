import express from 'express';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// Vercel captures console.log/console.error automatically.
// Do not write local log files here: Vercel serverless filesystem is read-only.

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

let currentLogs: string[] = [];
function log(msg: string) {
  const t = new Date().toISOString().split('T')[1].split('.')[0];
  const fullMsg = `[${t}] ${msg}`;
  console.log(fullMsg);
  currentLogs.push(fullMsg);
}

const normalizeApartment = (apt: any) => {
  if (!apt) return apt;
  const normalized = { ...apt };
  if (normalized.camas && Array.isArray(normalized.camas)) {
    normalized.beds = normalized.camas.map((c: any) => ({
      type: c.tipo || c.type,
      baseStatus: c.baseStatus || c.statusBase,
      baseColor: c.baseColor || c.corBase,
      mattressStatus: c.mattressStatus || c.statusColchao,
      mattressColor: c.mattressColor || c.corColchao,
      hasSkirt: c.hasSkirt !== undefined ? c.hasSkirt : c.temSaia,
      skirtColor: c.skirtColor || c.corSaia
    }));
    delete normalized.camas;
  }
  if (normalized.defeitos && Array.isArray(normalized.defeitos)) {
     normalized.defects = normalized.defeitos.map((d: any) => ({
       id: d.id,
       driveLink: d.driveLink || d.linkDrive,
       description: d.description || d.descricao,
       timestamp: d.timestamp || d.data,
       fileName: d.fileName || d.nomeArquivo
     }));
     delete normalized.defeitos;
  }
  return normalized;
};

// Debug Supabase
app.get('/api/supabase/debug', async (req, res) => {
  if (!supabase) return res.status(500).json({ status: 'error', message: 'Supabase not configured' });
  
  try {
    const debug: any = {};
    for (const key of Object.keys(DATA_MAP)) {
      const names = getSupabaseTableCandidates(key);
      for (const tableName of names) {
        if (debug[tableName]) continue;
        const { count, error } = await supabase
          .from(tableName)
          .select('id', { count: 'exact', head: true });
        
        debug[tableName] = error ? { error: error.message } : count;
      }
    }
    res.json(debug);
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: {
      hasSheetId: !!process.env.GOOGLE_SHEET_ID,
      hasServiceAccount: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      hasPrivateKey: !!process.env.GOOGLE_PRIVATE_KEY,
      hasSupabase: !!supabase
    }
  });
});

type VinculacaoRotina = 'vinculacao_diaria' | 'mr' | 'vinc3' | 'limpeza' | 'mapa' | 'checkin_email' | 'checkin_whatsapp';

const VINCULACAO_ROTINAS = new Set<VinculacaoRotina>([
  'vinculacao_diaria',
  'mr',
  'vinc3',
  'limpeza',
  'mapa',
  'checkin_email',
  'checkin_whatsapp',
]);

function getGitHubWorkflowConfig(rotina: VinculacaoRotina = 'vinculacao_diaria') {
  const isCheckinEmail = rotina === 'checkin_email';
  const owner = process.env.GITHUB_OWNER || process.env.VERCEL_GIT_REPO_OWNER || '';
  const repo = process.env.GITHUB_REPO || process.env.VERCEL_GIT_REPO_SLUG || '';
  const token = isCheckinEmail
    ? (process.env.GITHUB_CHECKIN_WORKFLOW_TOKEN || process.env.GITHUB_WORKFLOW_TOKEN || '')
    : (process.env.GITHUB_WORKFLOW_TOKEN || '');
  const ref = isCheckinEmail
    ? (process.env.GITHUB_CHECKIN_REF || process.env.GITHUB_REF || process.env.VERCEL_GIT_COMMIT_REF || 'main')
    : (process.env.GITHUB_REF || process.env.VERCEL_GIT_COMMIT_REF || 'main');
  const workflowFile = isCheckinEmail
    ? (process.env.GITHUB_CHECKIN_WORKFLOW || 'checkin-email-robot.yml')
    : (process.env.GITHUB_VINCULACAO_WORKFLOW || 'vinculacao.yml');

  if (!owner || !repo || !token) {
    throw new Error(
      isCheckinEmail
        ? 'GitHub Actions do check-in nao configurado. Defina GITHUB_WORKFLOW_TOKEN ou GITHUB_CHECKIN_WORKFLOW_TOKEN no Vercel.'
        : 'GitHub Actions nao configurado. Defina GITHUB_OWNER, GITHUB_REPO e GITHUB_WORKFLOW_TOKEN no Vercel.'
    );
  }

  return { owner, repo, token, ref, workflowFile };
}

function workflowInputsForRotina(rotina: VinculacaoRotina) {
  if (rotina === 'checkin_email') {
    return { max_emails: '30' };
  }
  return { rotina };
}

function githubHeaders(token: string) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

app.post('/api/robots/vinculacao/run', async (req, res) => {
  try {
    const rotina = String(req.body?.rotina || 'vinculacao_diaria') as VinculacaoRotina;
    if (!VINCULACAO_ROTINAS.has(rotina)) {
      return res.status(400).json({ status: 'error', message: 'Rotina invalida.' });
    }

    const { owner, repo, token, ref, workflowFile } = getGitHubWorkflowConfig(rotina);
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`,
      {
        method: 'POST',
        headers: githubHeaders(token),
        body: JSON.stringify({ ref, inputs: workflowInputsForRotina(rotina) }),
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Falha ao disparar GitHub Actions (${response.status}): ${detail}`);
    }

    res.json({ status: 'success', rotina, message: 'Workflow disparado.' });
  } catch (error: any) {
    console.error('[Robots Run Error]', error);
    res.status(500).json({ status: 'error', message: error.message || 'Erro ao disparar robo.' });
  }
});

app.get('/api/robots/vinculacao/status', async (req, res) => {
  try {
    const rotina = String(req.query?.rotina || 'vinculacao_diaria') as VinculacaoRotina;
    if (!VINCULACAO_ROTINAS.has(rotina)) {
      return res.status(400).json({ status: 'error', message: 'Rotina invalida.' });
    }

    const { owner, repo, token, workflowFile } = getGitHubWorkflowConfig(rotina);
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/runs?event=workflow_dispatch&per_page=5`,
      { headers: githubHeaders(token) }
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Falha ao consultar GitHub Actions (${response.status}): ${detail}`);
    }

    const data: any = await response.json();
    const latest = data.workflow_runs?.[0] || null;
    res.json({
      status: 'success',
      run: latest ? {
        id: latest.id,
        name: latest.name,
        status: latest.status,
        conclusion: latest.conclusion,
        htmlUrl: latest.html_url,
        createdAt: latest.created_at,
        updatedAt: latest.updated_at,
      } : null,
    });
  } catch (error: any) {
    console.error('[Robots Status Error]', error);
    res.status(500).json({ status: 'error', message: error.message || 'Erro ao consultar robo.' });
  }
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-key-gestao-hotel',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Google Sheets Auth
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly',
  ],
});

// Validate environment variables at startup
const requiredEnvVars = [
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
  'GOOGLE_SHEET_ID'
];

const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`CRITICAL ERROR: Missing environment variables: ${missingVars.join(', ')}`);
  console.error('Please add them in the Settings > Secrets menu.');
}

const sheets = google.sheets({ version: 'v4', auth });

const MAPINHA_SHEET_ID = process.env.MAPINHA_SHEET_ID || '1oMKFu9aobTP5sBuF0jjSR4In3Z6EcWfATCe_9ijNFXA';
const MAPINHA_PRINT_RANGE = process.env.MAPINHA_PRINT_RANGE || 'Mapinha!A1:L145';
const MAPINHA_ESCALA_RANGE = process.env.MAPINHA_ESCALA_RANGE || 'ESCALA!A1:H12';
const OBSERVACOES_RANGE = process.env.OBSERVACOES_RANGE || 'SOLICITAÇÕES!A1:F2000';
const DADOS_BRUTOS_HITS_RANGE = process.env.DADOS_BRUTOS_HITS_RANGE || 'DADOS_BRUTOS_HITS!A1:P5000';
const CHECKIN_WHATSAPP_RANGE = process.env.CHECKIN_WHATSAPP_RANGE || 'CHECKIN_WHATSAPP!A1:H500';
const CHECKIN_WHATSAPP_CONFIG_RANGE = process.env.CHECKIN_WHATSAPP_CONFIG_RANGE || 'CHECKIN_WHATSAPP_CONFIG!A1:B20';
const CHECKIN_WHATSAPP_HEADERS = [
  'Atualizado em',
  'Voucher',
  'Nome',
  'Nome curto',
  'Telefone',
  'Telefone WhatsApp',
  'Status',
  'Origem',
];
const CHECKIN_WHATSAPP_CONFIG_HEADERS = ['Chave', 'Valor'];
const DEFAULT_WHATSAPP_TEMPLATE = `Olá {nome}, seja muito bem-vindo ao Hotel Vilage Inn.

Estamos muito felizes em recebê-lo. Para tornar sua chegada mais rápida e confortável, você pode nos enviar por aqui os dados necessários para adiantar o check-in.

Segue também o link do nosso informativo:
{link_informativo}

Qualquer dúvida, estamos à disposição. Obrigado e até logo!`;
const DEFAULT_INFORMATIVE_LINK = 'https://mesquite-hisser-6e8.notion.site/1c0fb9fb7e0280488794ff5b9abbaf4c?v=1c0fb9fb7e0280e5ba6b000ce896f969';
let mapinhaSheetGidCache: number | null = null;
const DEFAULT_MAPINHA_NAME_CELLS: Record<string, string> = {
  '200': 'Mapinha!E41',
  '300': 'Mapinha!J41',
  '400': 'Mapinha!E88',
  '500': 'Mapinha!J88',
  '600': 'Mapinha!E135',
  '700': 'Mapinha!J135',
};

function getMapinhaNameCells() {
  if (!process.env.MAPINHA_NAME_CELLS_JSON) return DEFAULT_MAPINHA_NAME_CELLS;
  try {
    return { ...DEFAULT_MAPINHA_NAME_CELLS, ...JSON.parse(process.env.MAPINHA_NAME_CELLS_JSON) };
  } catch (error) {
    console.warn('MAPINHA_NAME_CELLS_JSON invalido. Usando mapeamento padrao.', error);
    return DEFAULT_MAPINHA_NAME_CELLS;
  }
}

function normalizeSheetText(value: any) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .toLowerCase()
    .trim();
}

function getSaoPauloDayKey() {
  const date = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][date.getDay()];
}

function getA1RangeOnly(range: string) {
  return String(range || '')
    .replace(/^(?:'[^']+'|[^!]+)!/, '')
    .trim();
}

function findScaleRow(values: any[][], dayKey: string) {
  const normalizedDay = normalizeSheetText(dayKey);
  return values.find((row, index) => index > 0 && normalizeSheetText(row?.[0]).includes(normalizedDay));
}

function extractScaleNamesByFloor(values: any[][], dayKey: string) {
  const header = values[0] || [];
  const row = findScaleRow(values, dayKey);
  if (!row) return { namesByFloor: {}, matchedDay: dayKey, found: false };

  const namesByFloor: Record<string, string> = {};
  header.forEach((cell, index) => {
    const floor = String(cell || '').trim();
    if (!/^\d{3}$/.test(floor)) return;
    const names = String(row[index] || '')
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter(Boolean)
      .join('\n');
    if (names) namesByFloor[floor] = names;
  });

  return { namesByFloor, matchedDay: String(row[0] || dayKey), found: true };
}

function normalizeHeaderText(value: any) {
  return normalizeSheetText(value).replace(/\s+/g, '');
}

function findHeaderIndex(headers: any[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeaderText);
  return headers.findIndex((header) => {
    const normalizedHeader = normalizeHeaderText(header);
    return normalizedAliases.some((alias) => normalizedHeader === alias || normalizedHeader.includes(alias));
  });
}

function getCell(row: any[], index: number) {
  return index >= 0 ? String(row?.[index] || '').trim() : '';
}

function classifyObservation(text: string): 'restaurante' | 'governanca' | 'recepcao' {
  const normalized = normalizeSheetText(text);
  const restaurante = [
    'alerg', 'gluten', 'lactose', 'intoler', 'vegetar', 'vegano', 'restricao alimentar',
    'mimo', 'aniversario', 'bolo', 'champagne', 'restaurante',
  ];
  const governanca = [
    'colchao', 'berco', 'banheira', 'banheiro', 'arrumacao', 'arrumacao especial',
    'limpeza', 'cama', 'travesseiro', 'toalha', 'cobertor', 'enxoval', 'fronha',
    'entrada antecipada', 'check-in antecipado', 'checkin antecipado', 'early check',
  ];
  const recepcao = [
    'proxim', 'perto', 'junto', 'lado a lado', 'vinculad', 'andar', 'terreo',
    'elevador', 'recepcao', 'ala', 'alocar', 'mesmo andar',
  ];

  if (restaurante.some((term) => normalized.includes(term))) return 'restaurante';
  if (governanca.some((term) => normalized.includes(term))) return 'governanca';
  if (recepcao.some((term) => normalized.includes(term))) return 'recepcao';
  return 'recepcao';
}

function cleanObservationPart(text: string) {
  return String(text || '')
    .replace(/\*+/g, '')
    .replace(/^observa[cç][oõ]es?\s*:/i, '')
    .replace(/^favor\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueObservationParts(text: string) {
  const seen = new Set<string>();
  return String(text || '')
    .split('|')
    .map(cleanObservationPart)
    .filter(Boolean)
    .filter((part) => {
      const key = normalizeSheetText(part);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function summarizeMimoObservation(text: string) {
  const normalized = normalizeSheetText(text);
  if (!normalized.includes('mimo')) return '';

  if (
    normalized.includes('infantil') ||
    normalized.includes('crianca') ||
    normalized.includes('crianca') ||
    normalized.includes('chd') ||
    /\b\d{1,2}\s*anos?\b/.test(normalized)
  ) {
    return 'MIMO INFANTIL';
  }

  if (
    normalized.includes('casamento') ||
    normalized.includes('lua de mel') ||
    normalized.includes('luademel') ||
    normalized.includes('recem casad')
  ) {
    return 'MIMO LUA DE MEL';
  }

  return 'MIMO';
}

function formatGovernancaObservation(text: string) {
  const normalized = normalizeSheetText(text);
  const items: string[] = [];
  const add = (label: string) => {
    if (!items.includes(label)) items.push(label);
  };

  if (normalized.includes('romantic')) add('ARRUMACAO ROMANTICA');
  if (normalized.includes('berco') && normalized.includes('colchao')) add('BERCO E COLCHAO');
  else if (normalized.includes('berco')) add('BERCO');
  else if (normalized.includes('colchao')) add('COLCHAO');
  if (normalized.includes('banheira')) add('BANHEIRA');
  if (normalized.includes('grade')) add('GRADE DE CAMA');
  if (normalized.includes('duas camas de casal') || normalized.includes('2 camas de casal')) add('DUAS CAMAS DE CASAL');
  else if (normalized.includes('cama de casal') || normalized.includes('cama casal')) add('CAMA DE CASAL');
  if (
    normalized.includes('meio dia') ||
    normalized.includes('meio-dia') ||
    normalized.includes('12:00') ||
    normalized.includes('12h')
  ) add('ENTRARA MEIO-DIA');
  else if (
    normalized.includes('entrada antecipada') ||
    normalized.includes('check-in antecipado') ||
    normalized.includes('checkin antecipado') ||
    normalized.includes('early check')
  ) add('ENTRADA ANTECIPADA');

  return items.join(' | ');
}

function formatRecepcaoObservation(text: string, linkedVoucher = '') {
  const normalized = normalizeSheetText(text);
  const items: string[] = [];
  const add = (label: string) => {
    if (!items.includes(label)) items.push(label);
  };

  if (linkedVoucher) add(`MANTER PROXIMO AO VOUCHER ${linkedVoucher}`);
  if (normalized.includes('recepcao')) add('MANTER ANDAR DA RECEPCAO');
  if (normalized.includes('copinha')) add('MANTER ANDAR DA COPINHA');
  if (normalized.includes('mesmo andar')) add('MANTER MESMO ANDAR');
  if (normalized.includes('grupo')) add('GRUPO: MANTER APTOS PROXIMOS');
  if (
    items.length === 0 &&
    (normalized.includes('proxim') || normalized.includes('perto') || normalized.includes('junto') || normalized.includes('lado a lado'))
  ) add('MANTER PROXIMO');

  return items.join(' | ');
}

function formatObservationRequest(text: string, sector: 'restaurante' | 'governanca' | 'recepcao', linkedVoucher = '') {
  if (sector === 'restaurante') {
    const mimo = summarizeMimoObservation(text);
    if (mimo) return mimo;
  }

  if (sector === 'governanca') {
    const governanca = formatGovernancaObservation(text);
    if (governanca) return governanca;
  }

  if (sector === 'recepcao') {
    const recepcao = formatRecepcaoObservation(text, linkedVoucher);
    if (recepcao) return recepcao;
  }

  const parts = uniqueObservationParts(text);
  return parts.join(' | ') || String(text || '').trim();
}

function buildApartmentByVoucher(rawValues: any[][]) {
  const headers = rawValues[0] || [];
  const voucherIndex = findHeaderIndex(headers, ['voucher', 'reserva', 'numero reserva', 'n reserva', 'localizador']);
  const apartmentIndex = findHeaderIndex(headers, ['apartamento', 'apto', 'quarto', 'uh', 'ap']);
  const map = new Map<string, string>();

  rawValues.slice(1).forEach((row) => {
    const voucherCandidates = voucherIndex >= 0
      ? [getCell(row, voucherIndex)]
      : row.map((cell) => String(cell || '').trim()).filter((cell) => /^\d{5,10}$/.test(cell));
    const apartmentCandidates = apartmentIndex >= 0
      ? [getCell(row, apartmentIndex)]
      : row
          .map((cell, index) => ({ cell: String(cell || '').trim(), index }))
          .filter(({ cell, index }) => index !== 14 && index !== 15 && /^\d{3}$/.test(cell))
          .map(({ cell }) => cell);
    const apartment = apartmentCandidates.find((cell) => /^\d{3}$/.test(cell)) || '';

    voucherCandidates
      .filter((voucher) => /^\d{5,10}$/.test(voucher))
      .forEach((voucher) => {
        if (apartment) map.set(voucher, apartment);
      });
  });

  return map;
}

function extractExceptionFloors(rawValues: any[][]) {
  const seen = new Set<string>();
  return rawValues.slice(1)
    .map((row) => ({
      date: String(row?.[14] || '').trim(),
      floor: String(row?.[15] || '').trim(),
    }))
    .filter((item) => item.date && item.floor)
    .filter((item) => {
      const key = `${item.date}|${item.floor}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function formatObservationLines(items: any[]) {
  return items
    .map((item) => `${item.voucher || 'sem voucher'} - ${item.apartment || 'sem apto'} - ${item.request}`)
    .join('\n');
}

function normalizeExceptionDate(value: any) {
  const text = String(value || '').trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  const brMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!brMatch) return text;
  const year = brMatch[3].length === 2 ? `20${brMatch[3]}` : brMatch[3];
  return `${brMatch[1].padStart(2, '0')}/${brMatch[2].padStart(2, '0')}/${year}`;
}

function getHeaderValue(row: any[], headers: any[], aliases: string[]) {
  const index = findHeaderIndex(headers, aliases);
  return getCell(row, index);
}

function getSheetTitleFromRange(range: string) {
  const rawTitle = String(range || '').split('!')[0] || '';
  return rawTitle.replace(/^'|'$/g, '').trim();
}

async function ensureSheetWithHeaders(title: string, headers: string[]) {
  if (!title) return;

  const response = await sheets.spreadsheets.get({
    spreadsheetId: MAPINHA_SHEET_ID,
    fields: 'sheets(properties(title))',
  });
  const exists = response.data.sheets?.some((sheet) => sheet.properties?.title === title);

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: MAPINHA_SHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title } } }],
      },
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: MAPINHA_SHEET_ID,
    range: `${title}!A1:H1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [headers] },
  });
}

app.get('/api/robots/checkin-whatsapp', async (req, res) => {
  try {
    await ensureSheetWithHeaders(getSheetTitleFromRange(CHECKIN_WHATSAPP_RANGE), CHECKIN_WHATSAPP_HEADERS);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: MAPINHA_SHEET_ID,
      range: CHECKIN_WHATSAPP_RANGE,
      valueRenderOption: 'FORMATTED_VALUE',
    });

    const values = response.data.values || [];
    const headers = values[0] || [];
    const contacts = values.slice(1)
      .map((row, index) => ({
        id: `${getHeaderValue(row, headers, ['voucher']) || index}-${getHeaderValue(row, headers, ['telefone whatsapp', 'whatsapp']) || index}`,
        updatedAt: getHeaderValue(row, headers, ['atualizado em', 'atualizado']),
        voucher: getHeaderValue(row, headers, ['voucher', 'reserva', 'localizador']),
        name: getHeaderValue(row, headers, ['nome', 'hospede']),
        shortName: getHeaderValue(row, headers, ['nome curto']) || getHeaderValue(row, headers, ['nome', 'hospede']),
        phone: getHeaderValue(row, headers, ['telefone']),
        whatsappPhone: getHeaderValue(row, headers, ['telefone whatsapp', 'whatsapp']),
        status: getHeaderValue(row, headers, ['status']) || 'Pendente',
      }))
      .filter((contact) => contact.name && contact.whatsappPhone);

    res.json({
      status: 'success',
      contacts,
      updatedAt: contacts[0]?.updatedAt || '',
    });
  } catch (error: any) {
    console.error('[Checkin WhatsApp Error]', error);
    res.status(500).json({ status: 'error', message: error.message || 'Erro ao carregar contatos de check-in.' });
  }
});

app.get('/api/robots/checkin-whatsapp/config', async (req, res) => {
  try {
    await ensureSheetWithHeaders(getSheetTitleFromRange(CHECKIN_WHATSAPP_CONFIG_RANGE), CHECKIN_WHATSAPP_CONFIG_HEADERS);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: MAPINHA_SHEET_ID,
      range: CHECKIN_WHATSAPP_CONFIG_RANGE,
      valueRenderOption: 'FORMATTED_VALUE',
    });

    const values = response.data.values || [];
    const config = Object.fromEntries(
      values.slice(1)
        .map((row) => [String(row?.[0] || '').trim(), String(row?.[1] || '')])
        .filter(([key]) => key)
    );

    res.json({
      status: 'success',
      template: config.template || DEFAULT_WHATSAPP_TEMPLATE,
      informativeLink: config.informativeLink || DEFAULT_INFORMATIVE_LINK,
      updatedAt: config.updatedAt || '',
    });
  } catch (error: any) {
    console.error('[Checkin WhatsApp Config Error]', error);
    res.status(500).json({ status: 'error', message: error.message || 'Erro ao carregar configuração do WhatsApp.' });
  }
});

app.post('/api/robots/checkin-whatsapp/config', async (req, res) => {
  try {
    await ensureSheetWithHeaders(getSheetTitleFromRange(CHECKIN_WHATSAPP_CONFIG_RANGE), CHECKIN_WHATSAPP_CONFIG_HEADERS);
    const template = String(req.body?.template || DEFAULT_WHATSAPP_TEMPLATE);
    const informativeLink = String(req.body?.informativeLink || DEFAULT_INFORMATIVE_LINK).trim();
    const updatedAt = new Date().toISOString();

    await sheets.spreadsheets.values.clear({
      spreadsheetId: MAPINHA_SHEET_ID,
      range: CHECKIN_WHATSAPP_CONFIG_RANGE,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: MAPINHA_SHEET_ID,
      range: getA1RangeOnly(CHECKIN_WHATSAPP_CONFIG_RANGE).startsWith('A1')
        ? `${getSheetTitleFromRange(CHECKIN_WHATSAPP_CONFIG_RANGE)}!A1`
        : CHECKIN_WHATSAPP_CONFIG_RANGE,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          CHECKIN_WHATSAPP_CONFIG_HEADERS,
          ['template', template],
          ['informativeLink', informativeLink],
          ['updatedAt', updatedAt],
        ],
      },
    });

    res.json({ status: 'success', template, informativeLink, updatedAt });
  } catch (error: any) {
    console.error('[Checkin WhatsApp Config Save Error]', error);
    res.status(500).json({ status: 'error', message: error.message || 'Erro ao salvar configuração do WhatsApp.' });
  }
});

app.get('/api/robots/observacoes', async (req, res) => {
  try {
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: MAPINHA_SHEET_ID,
      ranges: [OBSERVACOES_RANGE, DADOS_BRUTOS_HITS_RANGE],
      valueRenderOption: 'FORMATTED_VALUE',
    });

    const [observacoesRange, dadosRange] = response.data.valueRanges || [];
    const observacoesValues = observacoesRange?.values || [];
    const dadosValues = dadosRange?.values || [];
    const apartmentByVoucher = buildApartmentByVoucher(dadosValues);
    const sections: Record<string, any[]> = {
      restaurante: [],
      governanca: [],
      recepcao: [],
    };

    observacoesValues.slice(1).forEach((row) => {
      const date = String(row?.[0] || '').trim();
      const voucher = String(row?.[1] || '').trim();
      const floor = String(row?.[2] || '').trim();
      const linkedVoucher = String(row?.[3] || '').trim();
      const request = String(row?.[5] || '').trim();
      if (!voucher || !request) return;

      const sector = classifyObservation(request);
      const formattedRequest = formatObservationRequest(request, sector, linkedVoucher);
      if (!formattedRequest) return;
      const item = {
        date,
        voucher,
        apartment: apartmentByVoucher.get(voucher) || '',
        floor,
        linkedVoucher,
        request: formattedRequest,
      };
      sections[sector].push(item);
    });

    const payload = Object.fromEntries(
      Object.entries(sections).map(([key, items]) => [key, { items, text: formatObservationLines(items) }])
    );

    res.json({
      status: 'success',
      updatedAt: new Date().toISOString(),
      exceptions: extractExceptionFloors(dadosValues),
      sections: payload,
    });
  } catch (error: any) {
    console.error('[Robots Observacoes Error]', error);
    res.status(500).json({ status: 'error', message: error.message || 'Erro ao carregar observações.' });
  }
});

app.post('/api/robots/excecoes', async (req, res) => {
  try {
    const exceptions = Array.isArray(req.body?.exceptions) ? req.body.exceptions : [];
    const cleanedExceptions = exceptions
      .map((item: any) => ({
        date: normalizeExceptionDate(item?.date),
        floor: String(item?.floor || '').trim(),
      }))
      .filter((item) => item.date && item.floor);
    const values = cleanedExceptions
      .map((item: any) => [
        item.date,
        item.floor,
      ])
      .filter(([date, floor]) => date && floor);

    const blankRows = Array.from({ length: 4999 }, () => ['', '']);
    const data = [
      {
        range: 'DADOS_BRUTOS_HITS!O2:P5000',
        values: blankRows,
      },
    ];

    if (values.length > 0) {
      data.push({
        range: 'DADOS_BRUTOS_HITS!O2',
        values,
      });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: MAPINHA_SHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data,
      },
    });

    res.json({
      status: 'success',
      exceptions: cleanedExceptions,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Robots Excecoes Error]', error);
    res.status(500).json({ status: 'error', message: error.message || 'Erro ao salvar exceções.' });
  }
});

app.get('/api/mapinha/load', async (req, res) => {
  try {
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: MAPINHA_SHEET_ID,
      ranges: [MAPINHA_PRINT_RANGE, MAPINHA_ESCALA_RANGE],
      valueRenderOption: 'FORMATTED_VALUE',
    });

    const [mapinhaRange, escalaRange] = response.data.valueRanges || [];
    res.json({
      status: 'success',
      mapinha: {
        range: mapinhaRange?.range || MAPINHA_PRINT_RANGE,
        values: mapinhaRange?.values || [],
      },
      escala: {
        range: escalaRange?.range || MAPINHA_ESCALA_RANGE,
        values: escalaRange?.values || [],
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Mapinha Load Error]', error);
    res.status(500).json({ status: 'error', message: error.message || 'Erro ao carregar Mapinha.' });
  }
});

async function getMapinhaSheetGid() {
  if (mapinhaSheetGidCache !== null) return mapinhaSheetGidCache;

  const response = await sheets.spreadsheets.get({
    spreadsheetId: MAPINHA_SHEET_ID,
    fields: 'sheets(properties(title,sheetId))',
  });

  const sheet = response.data.sheets?.find((item) => item.properties?.title === 'Mapinha');
  const gid = sheet?.properties?.sheetId;
  if (typeof gid !== 'number') throw new Error('Aba Mapinha nao encontrada na planilha.');

  mapinhaSheetGidCache = gid;
  return gid;
}

app.get('/api/mapinha/pdf', async (req, res) => {
  try {
    const gid = await getMapinhaSheetGid();
    const client: any = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
    if (!token) throw new Error('Nao foi possivel gerar token para exportar o Mapinha.');

    const range = typeof req.query.range === 'string' && req.query.range.trim()
      ? req.query.range.trim()
      : '';

    const params = new URLSearchParams({
      format: 'pdf',
      gid: String(gid),
      size: 'A4',
      portrait: 'true',
      fitw: 'true',
      scale: '2',
      sheetnames: 'false',
      printtitle: 'false',
      pagenumbers: 'false',
      gridlines: 'false',
      fzr: 'false',
      attachment: 'false',
      horizontal_alignment: 'CENTER',
      vertical_alignment: 'TOP',
      top_margin: '1.00',
      bottom_margin: '0.50',
      left_margin: '0.25',
      right_margin: '0.25',
    });

    if (range) {
      params.set('range', getA1RangeOnly(range));
    }

    const exportResponse = await fetch(
      `https://docs.google.com/spreadsheets/d/${MAPINHA_SHEET_ID}/export?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!exportResponse.ok) {
      const detail = await exportResponse.text();
      throw new Error(`Falha ao exportar PDF do Mapinha (${exportResponse.status}): ${detail}`);
    }

    const buffer = Buffer.from(await exportResponse.arrayBuffer());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="mapinha.pdf"');
    res.send(buffer);
  } catch (error: any) {
    console.error('[Mapinha PDF Error]', error);
    res.status(500).json({ status: 'error', message: error.message || 'Erro ao gerar PDF do Mapinha.' });
  }
});

app.get('/api/mapinha/print', (req, res) => {
  res.redirect(302, '/api/mapinha/pdf');
});

app.post('/api/mapinha/sync-scale', async (req, res) => {
  try {
    const dayKey = normalizeSheetText(req.body?.dayKey || getSaoPauloDayKey());
    const escalaResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: MAPINHA_SHEET_ID,
      range: MAPINHA_ESCALA_RANGE,
      valueRenderOption: 'FORMATTED_VALUE',
    });

    const values = escalaResponse.data.values || [];
    const { namesByFloor, matchedDay, found } = extractScaleNamesByFloor(values, dayKey);
    if (!found) {
      return res.status(404).json({ status: 'error', message: `Dia ${dayKey} nao encontrado na aba ESCALA.` });
    }

    const nameCells = getMapinhaNameCells();
    const data = Object.entries(namesByFloor)
      .filter(([floor]) => !!nameCells[floor])
      .map(([floor, names]) => ({
        range: nameCells[floor],
        values: [[names]],
      }));

    if (data.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: MAPINHA_SHEET_ID,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data,
        },
      });
    }

    res.json({
      status: 'success',
      matchedDay,
      updatedFloors: data.map((item) => item.range),
      namesByFloor,
    });
  } catch (error: any) {
    console.error('[Mapinha Sync Error]', error);
    res.status(500).json({ status: 'error', message: error.message || 'Erro ao atualizar nomes do Mapinha.' });
  }
});

const DATA_MAP: Record<string, string> = {
  apartments: 'Apartamentos',
  budgets: 'Orcamentos',
  employees: 'Funcionarios',
  extras: 'Extras',
  sectors: 'Setores',
  inventory: 'Estoque',
  inventoryHistory: 'Historico_Estoque',
  suppliers: 'Fornecedores',
  linenItems: 'Enxoval',
  linenHistory: 'Historico_Enxoval',
  linenMonthlyInventories: 'Inventario_Mensal_Enxoval',
  config: 'Config',
  users: 'Users',
  parkingLocations: 'Patios',
  vehicles: 'Vehicles'
};

// Canonical Supabase table names are deliberately separated from Google Sheets tab names.
// This prevents accidental writes to Portuguese sheet labels such as "Enxoval" or "Config".
const SUPABASE_TABLE_MAP: Record<string, string> = {
  apartments: 'apartments',
  budgets: 'budgets',
  employees: 'employees',
  extras: 'extras',
  sectors: 'sectors',
  inventory: 'inventory',
  inventoryHistory: 'inventoryhistory',
  suppliers: 'suppliers',
  linenItems: 'linenitems',
  linenHistory: 'linenhistory',
  linenMonthlyInventories: 'linenmonthlyinventories',
  config: 'config',
  users: 'users',
  parkingLocations: 'parkinglocations',
  vehicles: 'vehicles'
};

// Legacy aliases are kept only for older installations. New writes always prefer the canonical table.
const SUPABASE_LEGACY_ALIASES: Record<string, string[]> = {
  apartments: ['Apartamentos', 'apartamentos'],
  budgets: ['Orcamentos', 'orcamentos'],
  employees: ['Funcionarios', 'funcionarios'],
  extras: ['Extras'],
  sectors: ['Setores', 'setores'],
  inventory: ['Estoque', 'estoque'],
  inventoryHistory: ['Historico_Estoque', 'historico_estoque'],
  suppliers: ['Fornecedores', 'fornecedores'],
  users: ['Users'],
  parkingLocations: ['Patios', 'patios'],
  vehicles: ['Vehicles']
};

const supabaseTableCache = new Map<string, string>();

function getSupabaseTableCandidates(key: string): string[] {
  const canonical = SUPABASE_TABLE_MAP[key] || key.toLowerCase();
  const legacy = SUPABASE_LEGACY_ALIASES[key] || [];
  return [...new Set([canonical, ...legacy])];
}

async function resolveSupabaseTable(key: string, required: boolean = false): Promise<string | null> {
  if (!supabase) return null;

  const cached = supabaseTableCache.get(key);
  if (cached) return cached;

  const candidates = getSupabaseTableCandidates(key);
  const errors: string[] = [];

  for (const candidate of candidates) {
    const { error } = await supabase.from(candidate).select('id', { count: 'exact', head: true });
    if (!error) {
      supabaseTableCache.set(key, candidate);
      return candidate;
    }
    errors.push(`${candidate}: ${error.message}`);
  }

  if (required) {
    const canonical = SUPABASE_TABLE_MAP[key] || key.toLowerCase();
    throw new Error(`Tabela do Supabase ausente: public.${canonical}. Execute o arquivo 1_EXECUTAR_NO_SUPABASE.sql antes de usar o aplicativo. Detalhes: ${errors.join(' | ')}`);
  }

  return null;
}

const INTERNAL_KEY_MAP: Record<string, string> = {
  'APARTMENT': 'apartments',
  'BUDGET': 'budgets',
  'EMPLOYEE': 'employees',
  'EXTRA': 'extras',
  'SECTOR': 'sectors',
  'INVENTORY': 'inventory',
  'INVENTORY_OP': 'inventoryHistory',
  'SUPPLIER': 'suppliers',
  'LINEN': 'linenItems',
  'LINEN_OP': 'linenHistory',
  'LINEN_MONTHLY': 'linenMonthlyInventories',
  'CONFIG': 'config',
  'USER': 'users',
  'PARKING_LOCATION': 'parkingLocations',
  'VEHICLE': 'vehicles',
  'CHECKOUT_VEHICLE': 'vehicles'
};

const GRID_COLUMNS: Record<string, string[]> = {
  apartments: ['id', 'roomNumber', 'floor', 'pisoType', 'pisoStatus', 'banheiroType', 'banheiroStatus', 'temCofre', 'temCortina', 'cortinaStatus', 'cortinaSize', 'cortinaCoverage', 'temEspelhoCorpo', 'espelhoCorpoStatus', 'acBrand', 'moveisStatus', 'moveisDetalhes', 'beds', 'temPortaControle', 'temCabide', 'cabideQuantity', 'temSuportePapel', 'temSuporteShampoo', 'suporteShampooStatus', 'luminariaType', 'luminariaColor', 'tvBrand', 'defects', 'customAnswers'],
  employees: ['id', 'name', 'role', 'gender', 'contact', 'salary', 'sectorId', 'fixedDayOff', 'sundayOffs', 'hourlyWorkDays', 'hourlyDaysOff', 'workingHours', 'shiftPeriod', 'status', 'startDate', 'scheduleType', 'vacationStatus', 'vacationStart', 'vacationEnd', 'vacationDays', 'vacationAccrualStart', 'vacationDeadline', 'uniforms', 'history', 'tagText', 'tagColor', 'photo'],
  budgets: ['id', 'title', 'objective', 'items', 'quotes', 'status', 'createdAt', 'files'],
  extras: ['id', 'name', 'phone', 'availability', 'serviceQuality', 'observation', 'sectorId', 'doNotCall'],
  sectors: ['id', 'name', 'standardUniform', 'roles', 'roleSalaries', 'employeeTags'],
  inventory: ['id', 'ean', 'name', 'category', 'quantity', 'minQuantity', 'unit', 'price', 'supplierId', 'lastUpdate', 'sectorId'],
  inventoryHistory: ['id', 'itemId', 'itemName', 'type', 'quantity', 'timestamp', 'user', 'reason', 'recipientId', 'recipientName'],
  suppliers: ['id', 'name', 'contact', 'category'],
  linenItems: ['id', 'name', 'category', 'unit', 'inventoryModelVersion', 'calculationBasis', 'quantityPerBasis', 'idealMultiplier', 'minCleanQuantity', 'quantityClean', 'quantityInUse', 'quantityDirty', 'quantityLaundry', 'quantityStained', 'quantityTorn', 'quantityDamaged', 'quantityLost', 'lastUpdate'],
  linenHistory: ['id', 'itemId', 'itemName', 'type', 'fromStatus', 'toStatus', 'quantity', 'timestamp', 'user', 'location', 'reason', 'generatedItemId', 'generatedItemName', 'generatedQuantity'],
  linenMonthlyInventories: ['id', 'month', 'timestamp', 'user', 'notes', 'totalPhysical', 'totalUsable', 'totalStained', 'totalTorn', 'totalLost', 'totalVariance', 'items'],
  users: ['id', 'name', 'password', 'role', 'allowedTabs', 'email', 'status'],
  parkingLocations: ['id', 'name', 'totalSpots'],
  vehicles: ['id', 'guest_name', 'plate', 'identifier', 'location', 'trip_start', 'model', 'color', 'is_on_trip', 'payment_pending', 'deleted_date', 'check_in_date', 'is_active', 'check_out_date', 'photos', 'history']
};


function normalizeLinenItemV2(item: any) {
  const modelVersion = Number(item?.inventoryModelVersion) || 0;
  const legacyOperationalTotal =
    (Number(item?.quantityInUse) || 0) +
    (Number(item?.quantityClean) || 0) +
    (Number(item?.quantityDirty) || 0) +
    (Number(item?.quantityLaundry) || 0);

  return {
    ...item,
    inventoryModelVersion: 2,
    quantityClean: 0,
    quantityInUse: modelVersion >= 2 ? (Number(item?.quantityInUse) || 0) : legacyOperationalTotal,
    quantityDirty: 0,
    quantityLaundry: 0,
    quantityStained: Number(item?.quantityStained) || 0,
    quantityTorn: Number(item?.quantityTorn) || 0,
    quantityDamaged: Number(item?.quantityDamaged) || 0,
    quantityLost: Number(item?.quantityLost) || 0
  };
}

function parseValue(val: any, fieldName: string) {
  if (val === undefined || val === null || val === '') {
    if (['quantity', 'minQuantity', 'price', 'value', 'laborCost', 'totalSpots', 'floor', 'roomNumber', 'serviceQuality', 'cabideQuantity', 'vacationDays', 'inventoryModelVersion', 'generatedQuantity', 'quantityPerBasis', 'idealMultiplier', 'minCleanQuantity', 'quantityClean', 'quantityInUse', 'quantityDirty', 'quantityLaundry', 'quantityStained', 'quantityTorn', 'quantityDamaged', 'quantityLost', 'totalPhysical', 'totalUsable', 'totalStained', 'totalTorn', 'totalLost', 'totalVariance'].includes(fieldName)) return 0;
    if (['defects', 'beds', 'moveisDetalhes', 'items', 'quotes', 'files', 'standardUniform', 'roles', 'availability', 'sundayOffs', 'hourlyWorkDays', 'hourlyDaysOff', 'uniforms', 'photos', 'history', 'allowedTabs', 'employeeTags'].includes(fieldName)) return [];
    if (['customAnswers', 'roleSalaries'].includes(fieldName)) return {};
    if (fieldName.startsWith('tem') || ['temCofre', 'temCortina', 'temEspelhoCorpo', 'temPortaControle', 'temCabide', 'temSuportePapel', 'temSuporteShampoo'].includes(fieldName)) return false;
    return '';
  }
  
  // Handle JSON strings in cells
  if (['defects', 'beds', 'moveisDetalhes', 'items', 'quotes', 'files', 'standardUniform', 'roles', 'availability', 'sundayOffs', 'hourlyWorkDays', 'hourlyDaysOff', 'uniforms', 'photos', 'history', 'allowedTabs', 'customAnswers', 'roleSalaries', 'employeeTags'].includes(fieldName)) {
    if (typeof val === 'string' && (val.trim().startsWith('[') || val.trim().startsWith('{'))) {
      try {
        return JSON.parse(val.trim());
      } catch (e) {
        console.warn(`Failed to parse JSON in field ${fieldName}:`, val.substring(0, 50));
        return val.trim().startsWith('[') ? [] : {};
      }
    }
    return val;
  }

  if (['quantity', 'minQuantity', 'price', 'value', 'laborCost', 'totalSpots', 'floor', 'roomNumber', 'serviceQuality', 'cabideQuantity', 'salary', 'vacationDays', 'inventoryModelVersion', 'generatedQuantity', 'quantityPerBasis', 'idealMultiplier', 'minCleanQuantity', 'quantityClean', 'quantityInUse', 'quantityDirty', 'quantityLaundry', 'quantityStained', 'quantityTorn', 'quantityDamaged', 'quantityLost', 'totalPhysical', 'totalUsable', 'totalStained', 'totalTorn', 'totalLost', 'totalVariance'].includes(fieldName)) {
    if (typeof val === 'string') {
      val = val.replace(/\./g, '').replace(',', '.');
    }
    return Number(val) || 0;
  }
  
  if (['timestamp', 'lastUpdate', 'createdAt', 'startDate', 'check_out_date', 'check_in_date', 'trip_start', 'deleted_date'].includes(fieldName)) {
    if (!val) return Date.now();
    if (!isNaN(Number(val))) return Number(val);
    const date = new Date(val);
    if (!isNaN(date.getTime())) return date.getTime();
    const parts = String(val).match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2})?:?(\d{2})?:?(\d{2})?/);
    if (parts) {
      const d = new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]), Number(parts[4] || 0), Number(parts[5] || 0), Number(parts[6] || 0));
      return d.getTime();
    }
    return val; // Return as string if date parsing fails but it's not a timestamp
  }

  if (val === 'TRUE' || val === 'true' || val === 'Sim' || val === 'SIM') return true;
  if (val === 'FALSE' || val === 'false' || val === 'NÃ£o' || val === 'NÃƒO') return false;
  
  return val;
}

// Simple In-Memory Cache to prevent Quota Exceeded errors
const CACHE_TTL = 30000; // 30 seconds
const dataCache: Record<string, { data: any, timestamp: number }> = {};

let sheetMetadataCache: { names: string[], timestamp: number } | null = null;
const METADATA_TTL = 60000; // 1 min

async function getSheetNames(spreadsheetId: string): Promise<string[]> {
  const now = Date.now();
  if (sheetMetadataCache && (now - sheetMetadataCache.timestamp < METADATA_TTL)) {
    return sheetMetadataCache.names;
  }
  
  try {
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets(properties(title))',
    });
    const names = (metadata.data.sheets || []).map(s => s.properties?.title || '');
    sheetMetadataCache = { names, timestamp: now };
    return names;
  } catch (e) {
    console.warn('[Discovery] Error getting sheet names:', e);
    throw e;
  }
}

/**
 * Robust sheet name discovery.
 * Tries to find the best match for a sheet based on prefix and hotel name.
 * Handles variations like "HOTEIS_Vilage Inn" vs "HOTEIS_VILAGE_INN"
 */
async function discoverSheetName(prefix: string, hotel: string): Promise<string> {
  const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
  if (!SPREADSHEET_ID) return `${prefix}_${hotel}`;

  try {
    const allSheetNames = await getSheetNames(SPREADSHEET_ID);
    const target = `${prefix}_${hotel}`.toLowerCase().replace(/[^a-z0-9]/g, '');

    
    // 1. Exact match (case insensitive, ignoring non-alphanumeric)
    const exactMatch = allSheetNames.find(n => n.toLowerCase().replace(/[^a-z0-9]/g, '') === target);
    if (exactMatch) return exactMatch;

    if (prefix === 'Apartamentos') {
       console.log(`[Discovery] Target "${target}". Available sheets: ${allSheetNames.join(', ')}`);
    }

    // 2. Fuzzy match: target contains sheet name or vice versa
    const fuzzyMatch = allSheetNames.find(n => {
      if (!n.startsWith(prefix)) return false;
      const nClean = n.toLowerCase().replace(/[^a-z0-9]/g, '');
      const hClean = hotel.toLowerCase().replace(/[^a-z0-9]/g, '');
      const nHClean = nClean.substring(prefix.toLowerCase().replace(/[^a-z0-9]/g, '').length);
      
      // Check for common variations
      const isVillage = (hClean === 'village' || hClean === 'vilage' || hClean === 'vila');
      const isSheetVillage = (nHClean.includes('village') || nHClean.includes('vilage') || nHClean === 'vila');
      
      if (isVillage && isSheetVillage) return true;
      
      return nHClean.includes(hClean) || hClean.includes(nHClean);
    });

    if (fuzzyMatch) {
      console.log(`[Discovery] Found fuzzy sheet match for "${prefix}" + "${hotel}": "${fuzzyMatch}"`);
      return fuzzyMatch;
    }

    return `${prefix}_${hotel}`;
  } catch (e) {
    console.warn('[Discovery] Error discovering sheet name:', e);
    return `${prefix}_${hotel}`;
  }
}

// Migrate data from Sheets to Supabase
app.post('/api/supabase/migrate', async (req, res) => {
  const { hotel } = req.body;
  if (!hotel) return res.status(400).json({ status: 'error', message: 'Hotel not specified' });
  if (!supabase) return res.status(500).json({ status: 'error', message: 'Supabase not configured' });

  try {
    console.log(`[Migration] STARTING for hotel: "${hotel}"`);
    // EXPLICITLY use the Sheets loading logic, bypassing Supabase lookup
    const data = await getSheetsOnlyData(hotel);
    const results: any = {};

    for (const [key, value] of Object.entries(data)) {
      if (!DATA_MAP[key]) continue;
      const tableName = await resolveSupabaseTable(key, true);
      if (!tableName) throw new Error(`NÃ£o foi possÃ­vel localizar a tabela do Supabase para ${key}.`);
      
      let records: any[] = [];
      if (key === 'apartments' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
        records = Object.values(value).map((v: any) => {
          const originalId = v.id || `${v.floor}-${v.roomNumber}`;
          return { 
            id: `${hotel}_${originalId}`, 
            hotel_name: hotel, 
            data: { ...v, id: originalId } 
          };
        });
      } else if (Array.isArray(value)) {
        records = value.map((v: any) => ({ 
          id: `${hotel}_${v.id}`, 
          hotel_name: hotel, 
          data: { ...v, id: String(v.id) }
        }));
      } else if (key === 'config' && value && typeof value === 'object' && Object.keys(value).length > 0) {
        records = [{ id: `config_${hotel}`, hotel_name: hotel, data: value }];
      }

      if (records.length > 0) {
        console.log(`[Migration] Syncing ${records.length} records to table "${tableName}" for "${hotel}"...`);
        const { error } = await supabase
          .from(tableName)
          .upsert(records, { onConflict: 'id' });
        
        if (error) {
          console.error(`[Migration Error] ${key} -> ${tableName}:`, error.message);
          results[key] = { status: 'error', message: error.message };
        } else {
          // If migration was successful, we might want to delete ghosts in Supabase
          // but ONLY if we are sure we loaded everything from Sheets.
          // For safety, we only delete if we have a substantial number of records or if it's config.
          if (records.length > 5 || key === 'config') {
             const currentIds = records.map(r => r.id);
             await supabase.from(tableName).delete().eq('hotel_name', hotel).not('id', 'in', currentIds);
          }
          results[key] = { status: 'success', count: records.length };
        }
      } else {
        console.log(`[Migration] Skipped ${key} - no data found in Sheets`);
        results[key] = { status: 'skipped', message: 'No data retrieved from sheet' };
      }
    }

    delete dataCache[hotel];
    res.json({ status: 'success', results, message: 'Processamento concluÃ­do. Verifique os logs para detalhes.' });
  } catch (error: any) {
    console.error('[Migration CRITICAL Error]:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Helper to get data from a specific sheet/cell
async function getSheetData(hotel: string, forceSheets: boolean = false) {
  // Check cache first (ignore cache if forcing sheets)
  const cached = dataCache[hotel];
  if (!forceSheets && cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // If forcing sheets, bypass Supabase entirely
  if (forceSheets) {
    console.log(`[Force Sheets] Bypassing Supabase for hotel: "${hotel}"`);
    return getSheetsOnlyData(hotel);
  }

  // If Supabase is configured, try to load from there
  if (supabase) {
    try {
      const hotelData: any = {};
      console.log(`[Supabase Load] Request for hotel: "${hotel}"`);
      
      for (const key of Object.keys(DATA_MAP)) {
        const possibleTables = getSupabaseTableCandidates(key);
        let tableName = possibleTables[0];
        let result: any = { data: null, error: new Error('Not searched yet') };
        
        // Search through tables iteratively until we find one that works and has data
        for (const tbl of possibleTables) {
           tableName = tbl;
           
           // First try exact match
           let query = supabase.from(tableName).select('*', { count: 'exact' }).eq('hotel_name', hotel);
           result = await query;
           
           if (!result.error && result.data && result.data.length > 0) {
               break; // Found it with exact hotel name!
           }
           
           // If no error but no exact match data, try fuzzy matching the hotel_name
           if (!result.error || (result.error && result.error.code === 'PGRST116')) {
               const { data: allHotels } = await supabase.from(tableName).select('hotel_name');
               if (allHotels && allHotels.length > 0) {
                  const distinct = [...new Set(allHotels.map(d => d.hotel_name).filter(Boolean))];
                  const closeMatch = distinct.find((h: any) => {
                    const hLower = h.toLowerCase().trim();
                    const hotelLower = hotel.toLowerCase().trim();
                    return hLower.includes(hotelLower) || 
                           hotelLower.includes(hLower) ||
                           hLower.replace(/[^a-z0-9]/g, '') === hotelLower.replace(/[^a-z0-9]/g, '') ||
                           (hotelLower === 'village' && hLower === 'vila') ||
                           (hLower === 'village' && hotelLower === 'vila');
                  });
                  
                  if (closeMatch) {
                    result = await supabase.from(tableName).select('*', { count: 'exact' }).eq('hotel_name', closeMatch);
                    if (!result.error && result.data && result.data.length > 0) {
                        break; // Found it with fuzzy hotel name match!
                    }
                  }
               }
           }
        }

        if (result.error && JSON.stringify(result.error).includes('hotel_name')) {
          console.warn(`[Supabase Load] 'hotel_name' column may not exist in table "${tableName}". Querying without filter...`);
          result = await supabase.from(tableName).select('*', { count: 'exact' });
        } else if ((!result.data || result.data.length === 0) && hotel && !result.error) {
          console.log(`[Supabase Load] No data for exact match "${hotel}", trying fuzzy search...`);
          // Try to see if there's ANY hotel name that contains the query or vice-versa
          const { data: allHotels } = await supabase.from(tableName).select('hotel_name');
          const distinct = [...new Set(allHotels?.map(d => d.hotel_name).filter(Boolean) || [])];
          
          const closeMatch = distinct.find((h: any) => {
            const hLower = h.toLowerCase().trim();
            const hotelLower = hotel.toLowerCase().trim();
            return hLower.includes(hotelLower) || 
                   hotelLower.includes(hLower) ||
                   hLower.replace(/[^a-z0-9]/g, '') === hotelLower.replace(/[^a-z0-9]/g, '') ||
                   (hotelLower === 'village' && hLower === 'vila') ||
                   (hLower === 'village' && hotelLower === 'vila');
          });

          if (closeMatch) {
            console.log(`[Supabase Load] Closest match for "${hotel}" found: "${closeMatch}". Retrying query.`);
            result = await supabase
              .from(tableName)
              .select('*', { count: 'exact' })
              .eq('hotel_name', closeMatch);
          }
        }

        const { data, error, count } = result;
        
        if (error) {
          console.error(`Error loading ${key} from Supabase table "${tableName}":`, JSON.stringify(error));
          hotelData[key] = key === 'apartments' ? {} : [];
        } else {
          console.log(`[Supabase Load] ${key} ("${tableName}"): found ${data?.length || 0} rows (Total: ${count})`);
          
          const processRowData = (row: any) => {
            let item = row.data || row.Dados || row.dados || row.Data;
            if (item) {
              if (typeof item === 'string') {
                try {
                  item = JSON.parse(item);
                } catch (e) {
                  console.error(`Failed to parse row.data as JSON for table ${tableName}, id ${row.id}`);
                  item = {};
                }
              }
            } else {
              // If no 'data' column or it's empty, use the row itself (excluding metadata)
              const { id, hotel_name, created_at, updated_at, ...rest } = row;
              item = Object.keys(rest).length > 0 ? rest : {};
            }
            return item || {};
          };

          if (key === 'config') {
            hotelData[key] = data.length > 0 ? processRowData(data[0]) : {};
          } else if (key === 'apartments') {
            const aptMap: any = {};
            data?.forEach((row: any) => {
              const apt = normalizeApartment(processRowData(row));
              // Robust ID recovery - handle both prefixed and non-prefixed IDs
              let id = apt.id;
              if (!id && row.id) {
                const rowIdUpper = row.id.toUpperCase();
                const hotelUpper = `${hotel}_`.toUpperCase();
                if (rowIdUpper.startsWith(hotelUpper)) {
                  id = row.id.substring(hotel.length + 1);
                } else if (rowIdUpper.startsWith('VILLAGE_')) {
                  id = row.id.substring('VILLAGE_'.length);
                } else if (rowIdUpper.startsWith('VILAGE_')) { // NEW CHECK FOR VILAGE_
                  id = row.id.substring('VILAGE_'.length);
                } else if (rowIdUpper.startsWith('VILA_')) {
                  id = row.id.substring('VILA_'.length);
                } else {
                  id = row.id;
                }
              }
              
              if (!id) {
                console.warn(`[Supabase Load] Could not resolve ID for apartment row:`, JSON.stringify(row));
              } else {
                aptMap[id] = { ...apt, id };
              }
            });
            console.log(`[Supabase Load] Processed ${Object.keys(aptMap).length} apartments. Sample keys:`, Object.keys(aptMap).slice(0, 3));
            hotelData[key] = aptMap;
          } else {
            hotelData[key] = data?.map((row: any) => {
              const item = processRowData(row);
              if (row.id && !item.id) {
                item.id = row.id.startsWith(`${hotel}_`) ? row.id.substring(hotel.length + 1) : row.id;
              }
              return item;
            }) || [];
          }
        }
      }

      // If we found some data in Supabase (at least one table has records), return it
      const hasAnyData = Object.values(hotelData).some((v: any) => 
        (Array.isArray(v) && v.length > 0) || (typeof v === 'object' && v !== null && Object.keys(v).length > 0)
      );

      if (hasAnyData) {
        log(`Supabase Load Success for ${hotel}. Tables: ${Object.entries(hotelData).filter(([k,v]: any) => (Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0)).map(([k]) => k).join(', ')}`);
        const finalData = { ...hotelData, _logs: currentLogs };
        dataCache[hotel] = { data: finalData, timestamp: Date.now() };
        return finalData;
      }
      log(`No data found in any table for ${hotel}`);
    } catch (error: any) {
      log(`Supabase Load Error: ${error.message}. Falling back to Sheets.`);
    }
  }

  const sheetsData = await getSheetsOnlyData(hotel);
  return { ...sheetsData, _logs: currentLogs };
}

// Low-level Sheets-only fetcher
async function getSheetsOnlyData(hotel: string) {
  log(`Fetching batch data from Sheets for "${hotel}"...`);
  const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
  if (!SPREADSHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');

  const hotelData: any = {};
  
  // 1. Discover all sheet names first
  const sheetNamesMapping = new Map<string, string>();
  const keys = Object.keys(DATA_MAP);
  
  let allSheetNames: string[] = [];
  try {
    allSheetNames = await getSheetNames(SPREADSHEET_ID);
  } catch(e) {}
  
  await Promise.all(keys.map(async (key) => {
    try {
      const sheetPrefix = DATA_MAP[key];
      const sheetName = await discoverSheetName(sheetPrefix, hotel);
      sheetNamesMapping.set(key, sheetName);
      log(`Discovered sheet for ${key}: "${sheetName}"`);
    } catch (e) {}
  }));

  try {
    const validKeys = keys.filter(key => {
      const name = sheetNamesMapping.get(key);
      return name && allSheetNames.includes(name);
    });

    const ranges = validKeys.map(key => `'${sheetNamesMapping.get(key)}'!A:AC`);
    
    // Set defaults first
    keys.forEach(key => {
      hotelData[key] = (key === 'apartments' ? {} : []);
    });

    if (ranges.length > 0) {
      // Use batchGet to minimize round trips and quota usage
      const response = await sheets.spreadsheets.values.batchGet({
        spreadsheetId: SPREADSHEET_ID,
        ranges,
      });

      const valueRanges = response.data.valueRanges || [];
      
      validKeys.forEach((key, idx) => {
         const rows = valueRanges[idx]?.values || [];
         const defaultValue = (key === 'apartments' ? {} : []);
         const gridCols = GRID_COLUMNS[key];

         if (!rows || rows.length === 0) {
           hotelData[key] = defaultValue;
           return;
         }

         if (key === 'config') {
           const config: any = {};
           rows.forEach(row => {
             if (row[0] && row[1] !== undefined) {
               let val = row[1];
               const trimmed = typeof val === 'string' ? val.trim() : '';
               if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                 try { val = JSON.parse(trimmed); } catch (e) {}
               } else if (val === 'TRUE' || val === 'true') val = true;
               else if (val === 'FALSE' || val === 'false') val = false;
               config[row[0]] = val;
             }
           });
           hotelData[key] = config;
           return;
         }

         const firstCell = rows[0][0];
       const isJsonInA1 = rows.length === 1 && rows[0].length === 1 && typeof firstCell === 'string' && (firstCell.startsWith('[') || firstCell.startsWith('{'));

       if (isJsonInA1) {
         try {
           const parsed = JSON.parse(firstCell);
           if (key === 'apartments') {
             hotelData[key] = (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
           } else {
             hotelData[key] = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' ? [parsed] : []);
           }
           return;
         } catch (e) {}
       }

       if (gridCols) {
         let dataRows = rows;
         const firstRow = rows[0].map(c => String(c).toLowerCase().trim());
         let colMap: Record<string, number> = {};
         
         const hasHeaders = firstRow.includes('id') || firstRow.includes('apto') || firstRow.includes('nome') || firstRow.includes('ean') || firstRow.includes('roomnumber') || firstRow.includes('quarto');
         
         if (hasHeaders) {
           dataRows = rows.slice(1);
           // Dynamically map columns
           gridCols.forEach((col) => {
              let idx = firstRow.indexOf(col.toLowerCase());
              if (idx === -1) {
                  if (col === 'id' || col === 'roomNumber') idx = firstRow.findIndex(c => ['quarto', 'apto', 'numero', 'id', 'roomnumber'].includes(c));
                  else if (col === 'floor') idx = firstRow.findIndex(c => ['andar', 'chÃ£o', 'floor'].includes(c));
                  else if (col === 'pisoType') idx = firstRow.findIndex(c => c.startsWith('pisot'));
                  else if (col === 'pisoStatus') idx = firstRow.findIndex(c => c.startsWith('pisos'));
                  else if (col === 'banheiroType') idx = firstRow.findIndex(c => c.startsWith('banht'));
                  else if (col === 'banheiroStatus') idx = firstRow.findIndex(c => c.startsWith('banhs'));
                  else if (col === 'temCofre') idx = firstRow.findIndex(c => c === 'cofre');
                  else if (col === 'temCortina') idx = firstRow.findIndex(c => c === 'cortina');
                  else if (col === 'cortinaStatus') idx = firstRow.findIndex(c => c.startsWith('cortinas') || c.replace(/\s+/g,'').startsWith('cortinas'));
                  else if (col === 'cortinaSize') idx = firstRow.findIndex(c => c.startsWith('cortinam'));
                  else if (col === 'cortinaCoverage') idx = firstRow.findIndex(c => c.startsWith('cortinac'));
                  else if (col === 'temEspelhoCorpo') idx = firstRow.findIndex(c => c === 'espelho' || (c.startsWith('espelho') && !c.startsWith('espelhos')));
                  else if (col === 'espelhoCorpoStatus') idx = firstRow.findIndex(c => c.startsWith('espelhos') || c.replace(/\s+/g,'').startsWith('espelhos'));
                  else if (col === 'acBrand') idx = firstRow.findIndex(c => c === 'ac' || c.startsWith('ar cond') || c === 'ar');
                  else if (col === 'moveisStatus') idx = firstRow.findIndex(c => c.startsWith('moveiss') || c.replace(/\s+/g,'').startsWith('moveiss'));
                  else if (col === 'moveisDetalhes') idx = firstRow.findIndex(c => c.startsWith('moveisd') || c.startsWith('detalhes') || c === 'moveis');
                  else if (col === 'beds') idx = firstRow.findIndex(c => c === 'cama' || c === 'camas');
                  else if (col === 'temPortaControle') idx = firstRow.findIndex(c => c.startsWith('portacont'));
                  else if (col === 'temCabide') idx = firstRow.findIndex(c => c === 'cabide' || c === 'cabides');
                  else if (col === 'cabideQuantity') idx = firstRow.findIndex(c => c === 'cabideq' || c.startsWith('quant'));
                  else if (col === 'temSuportePapel') idx = firstRow.findIndex(c => c.startsWith('suportpap'));
                  else if (col === 'temSuporteShampoo') idx = firstRow.findIndex(c => c === 'suportsham');
                  else if (col === 'suporteShampooStatus') idx = firstRow.findIndex(c => c.startsWith('suportshams'));
                  else if (col === 'luminariaType') idx = firstRow.findIndex(c => c.startsWith('lumintype') || c.startsWith('luminaria t'));
                  else if (col === 'luminariaColor') idx = firstRow.findIndex(c => c.startsWith('lumincolor') || c.startsWith('luminaria c'));
                  else if (col === 'tvBrand') idx = firstRow.findIndex(c => c === 'tv' || c.startsWith('marca tv'));
                  else if (col === 'defects') idx = firstRow.findIndex(c => c === 'avarias' || c === 'defeitos');
              }
              if (idx !== -1) colMap[col] = idx;
           });
         }

         const parsedRows = dataRows.map(row => {
           const item: any = {};
           if (hasHeaders && Object.keys(colMap).length > 0) {
              gridCols.forEach((col) => {
                if (colMap[col] !== undefined) {
                   item[col] = parseValue(row[colMap[col]], col);
                }
              });
           } else {
              gridCols.forEach((col, cIdx) => {
                item[col] = parseValue(row[cIdx], col);
              });
           }
           return item;
         }).filter(item => {
           if (key === 'apartments') return item.roomNumber || item.id;
           return item.id || item.name || item.title;
         });

         if (key === 'apartments') {
           const aptMap: any = {};
           parsedRows.forEach(aptRaw => {
             const apt = normalizeApartment(aptRaw);
             // Robust ID resolution: prefer roomNumber if it looks like a number, or id
             const id = String(apt.id || apt.roomNumber);
             if (id) aptMap[id] = { ...apt, id };
           });
           hotelData[key] = aptMap;
         } else {
           // De-duplicate items by ID
           const idMap = new Map();
           parsedRows.forEach(item => {
             if (item.id) idMap.set(String(item.id), item);
           });
           hotelData[key] = Array.from(idMap.values());
         }
       } else {
         hotelData[key] = defaultValue;
       }
    });

    }

    console.log(`[Batch Sheets Fetch] Success for hotel "${hotel}". Total tables populated: ${Object.keys(hotelData).length}`);
    dataCache[hotel] = { data: hotelData, timestamp: Date.now() };
    return hotelData;

  } catch (err: any) {
    console.error(`[Batch Sheets Fetch Error] Hotel "${hotel}":`, err.message);
    throw err;
  }
}

// Helper to save data to a specific sheet/cell
async function saveSheetData(hotel: string, dataType: string, data: any, options: { isFullSync?: boolean } = {}) {
  const key = INTERNAL_KEY_MAP[dataType];
  if (!key || !DATA_MAP[key]) {
    console.warn(`No mapping found for dataType: ${dataType}`);
    return;
  }

  // We determine if this is a single item save or a full collection sync
  const isSingle = (typeof data === 'object' && data !== null && !Array.isArray(data) && 
                   (data.id !== undefined || data.roomNumber !== undefined) && 
                   !(options.isFullSync === true));

  console.log(`[saveSheetData] Hotel: ${hotel}, Type: ${dataType}, isSingle: ${isSingle}, FullSync: ${options.isFullSync}`);

  // If Supabase is configured, save there
  if (supabase) {
    try {
      const tableName = await resolveSupabaseTable(key, true);
      if (!tableName) throw new Error(`NÃ£o foi possÃ­vel localizar a tabela do Supabase para ${key}.`);
      
      let records: any[] = [];
      
      if (key === 'config') {
        records = [{ id: `config_${hotel}`, hotel_name: hotel, data: data }];
      } else if (key === 'apartments') {
        // Special case for apartments: can be a map or a single object
        const apartmentArray = isSingle ? [data] : Object.values(data);
        
        records = apartmentArray.map((v: any) => {
          const originalId = v.id || String(v.roomNumber || `${v.floor}-${v.roomNumber}`);
          return { 
            id: `${hotel}_${originalId}`, 
            hotel_name: hotel, 
            data: { ...v, id: originalId }
          };
        });
      } else if (Array.isArray(data)) {
        records = data.map((v: any) => ({ 
          id: `${hotel}_${v.id}`, 
          hotel_name: hotel, 
          data: { ...v, id: String(v.id) }
        }));
      } else if (data && typeof data === 'object') {
        records = [{
          id: `${hotel}_${data.id}`,
          hotel_name: hotel,
          data: { ...data, id: String(data.id) }
        }];
      }

      if (records.length > 0) {
        console.log(`[Supabase Save] ${dataType} for "${hotel}": Upserting ${records.length} records into ${tableName}...`);
        
        // Find duplicates in records
        const ids = records.map(r => r.id);
        const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
        if (dupIds.length > 0) {
           console.log(`[Supabase Save Warning] Duplicate IDs in batch:`, dupIds);
           // Deduplicate keeping last
           records = [...new Map(records.map(r => [r.id, r])).values()];
           console.log(`[Supabase Save] Deduplicated to ${records.length} records.`);
        }

        const { error: upsertError } = await supabase
          .from(tableName)
          .upsert(records, { onConflict: 'id' });
        
        if (upsertError) {
          console.error(`[Supabase Save Error] ${dataType} (${tableName}):`, upsertError.message, JSON.stringify(upsertError));
          throw new Error(`Falha ao salvar ${dataType} em public.${tableName}: ${upsertError.message}`);
        }
        console.log(`[Supabase Save Success] ${dataType} to ${tableName}`);

        // DANGEROUS: Deletion of orphans. ONLY do this if we are 100% sure it's a full sync.
        const shouldDeleteOrphans = options.isFullSync === true || (Array.isArray(data) && data.length > 0 && !isSingle);
        
        if (key !== 'config' && shouldDeleteOrphans && records.length > 0) {
          const currentIds = new Set(records.map(r => r.id));
          const { data: existingIds } = await supabase.from(tableName).select('id').eq('hotel_name', hotel);
          
          if (existingIds) {
            const idsToDelete = existingIds.map((r: any) => r.id).filter((id: string) => !currentIds.has(id));
            if (idsToDelete.length > 0) {
               console.log(`[Supabase Cleanup] Deleting ${idsToDelete.length} orphans for ${tableName} (kept ${currentIds.size} ids)`);
               for (let i = 0; i < idsToDelete.length; i += 50) {
                 const chunk = idsToDelete.slice(i, i + 50);
                 const { error: deleteError } = await supabase.from(tableName).delete().in('id', chunk);
                 if (deleteError) console.error(`[Supabase Cleanup Error] ${dataType} (chunk):`, deleteError.message);
               }
            }
          }
        }
      } else if (records.length === 0 && options.isFullSync) {
        // Explicitly clearing all data
        console.log(`[Supabase Clear] Deleting ALL records for table "${tableName}" for hotel "${hotel}"`);
        await supabase.from(tableName).delete().eq('hotel_name', hotel);
      }
    } catch (error) {
      console.error('[Supabase Save Error]:', error);
      throw error;
    }
  }

  // Supabase Ã© a fonte principal de dados.
  // IMPORTANTE:
  // Se o Supabase estiver configurado, ediÃ§Ãµes normais do app NÃƒO devem escrever no Google Sheets.
  // Isso evita apagar/limpar a aba Apartamentos_VILLAGE em salvamentos individuais.
  // A planilha deve ser usada apenas como backup/importaÃ§Ã£o manual ou via rota de migraÃ§Ã£o controlada.
  if (supabase) {
    console.log(`[saveSheetData] Supabase configured. Skipping Google Sheets write for ${dataType}.`);
    return true;
  }

  const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
  const sheetPrefix = DATA_MAP[key];
  const sheetName = await discoverSheetName(sheetPrefix, hotel);
  const gridCols = GRID_COLUMNS[key];

  try {
    let values: any[][];
    if (key === 'config' && typeof data === 'object') {
      values = Object.entries(data).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : v]);
    } else if (gridCols && (Array.isArray(data) || (typeof data === 'object' && key === 'apartments'))) {
      const dataArray = (Array.isArray(data)) ? data : Object.values(data);
      
      // If NOT a full sync, we probably shouldn't be clearing the whole sheet
      const isFullSync = options.isFullSync || Array.isArray(data) || (!isSingle && Object.keys(data).length > 2);
      
      const rows = dataArray.map(item => gridCols.map(col => {
        const val = item[col];
        if (['timestamp', 'lastUpdate', 'createdAt', 'startDate', 'check_out_date', 'check_in_date', 'trip_start'].includes(col) && typeof val === 'number') {
          return new Date(val).toISOString();
        }
        return typeof val === 'object' ? JSON.stringify(val) : (val ?? '');
      }));
      
      values = [gridCols, ...rows]; // Always include headers at row 1
      
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${sheetName}'!A1:AZ`,
      });
    } else {
      values = [[...gridCols], [JSON.stringify(data)]];
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: values,
      },
    });
    return true;
  } catch (error: any) {
    // If sheet doesn't exist, try to create it
    if (error.message?.includes('range not found') || error.code === 400) {
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [{
              addSheet: {
                properties: { title: sheetName }
              }
            }]
          }
        });
        // Retry saving
        return await saveSheetData(hotel, dataType, data);
      } catch (createError) {
        console.error(`Error creating sheet ${sheetName}:`, createError);
        throw createError;
      }
    }
    throw error;
  }
}

// API Routes
app.get('/api/sheets/load', async (req, res) => {
  console.log(`[API /load] Request received: ${req.url}`);
  const { hotel, nocache, forceSheets } = req.query;
  if (!hotel) return res.status(400).json({ status: 'error', message: 'Hotel not specified' });

  // Reset logs for new request
  currentLogs = [];
  
  try {
    if (nocache || forceSheets) {
      log(`Bypassing cache for hotel: ${hotel}`);
      delete dataCache[hotel as string];
    }
    const result = await getSheetData(hotel as string, forceSheets === 'true');
    res.json({ status: 'success', data: result || {} });
  } catch (error: any) {
    log(`Load Error for hotel ${hotel}: ${error.message}`);
    res.status(500).json({ 
      status: 'error', 
      message: `Erro ao carregar dados: ${error.message || 'Erro desconhecido'}`,
      _logs: currentLogs
    });
  }
});

app.post('/api/sheets/action', async (req, res) => {
  const { hotel, dataType, isFullSync, newFiles, ...payload } = req.body;
  if (!hotel) return res.status(400).json({ status: 'error', message: 'Hotel not specified' });

  try {
    console.log(`[API Action] ${dataType} for "${hotel}" (FullSync: ${isFullSync || false})`);
    
    // Fetch current data FIRST to avoid overwriting everything with just one item
    let currentData = await getSheetData(hotel);
    let targetDataType = dataType;
    const internalKey = INTERNAL_KEY_MAP[dataType];
    
    // Handle different data types
    switch (dataType) {
      case 'APARTMENT':
        if (!currentData.apartments || Array.isArray(currentData.apartments)) currentData.apartments = {};
        currentData.apartments[payload.id] = payload;
        break;
      case 'BUDGET':
        if (!Array.isArray(currentData.budgets)) currentData.budgets = [];
        const bIndex = currentData.budgets.findIndex((b: any) => b.id === payload.id);
        if (bIndex > -1) currentData.budgets[bIndex] = payload;
        else currentData.budgets.push(payload);
        break;
      case 'EMPLOYEE':
        if (!Array.isArray(currentData.employees)) currentData.employees = [];
        const eIndex = currentData.employees.findIndex((e: any) => e.id === payload.id);
        if (eIndex > -1) currentData.employees[eIndex] = payload;
        else currentData.employees.push(payload);
        break;
      case 'EXTRA':
        if (!Array.isArray(currentData.extras)) currentData.extras = [];
        const exIndex = currentData.extras.findIndex((e: any) => e.id === payload.id);
        if (exIndex > -1) currentData.extras[exIndex] = payload;
        else currentData.extras.push(payload);
        break;
      case 'SECTOR':
        if (!Array.isArray(currentData.sectors)) currentData.sectors = [];
        const sIndex = currentData.sectors.findIndex((s: any) => s.id === payload.id);
        if (sIndex > -1) currentData.sectors[sIndex] = payload;
        else currentData.sectors.push(payload);
        break;
      case 'INVENTORY':
        if (!Array.isArray(currentData.inventory)) currentData.inventory = [];
        const iIndex = currentData.inventory.findIndex((i: any) => i.id === payload.id);
        if (iIndex > -1) currentData.inventory[iIndex] = payload;
        else currentData.inventory.push(payload);
        break;
      case 'INVENTORY_OP':
        if (!Array.isArray(currentData.inventoryHistory)) currentData.inventoryHistory = [];
        currentData.inventoryHistory.push(payload);
        
        // Auto-update inventory balance
        let debugQty = null;
        res.locals.invLength = Array.isArray(currentData.inventory) ? currentData.inventory.length : 0;
        if (Array.isArray(currentData.inventory)) {
          const item = currentData.inventory.find((i: any) => i.id === payload.itemId || String(i.id) === String(payload.itemId));
          if (item) {
            const qty = Number(payload.quantity) || 0;
            if (payload.type === 'Entrada') {
              item.quantity = (Number(item.quantity) || 0) + qty;
            } else {
              item.quantity = (Number(item.quantity) || 0) - qty;
            }
            item.lastUpdate = Date.now();
            debugQty = item.quantity;
          }
        }
        res.locals.debugQty = debugQty;
        break;
      case 'SUPPLIER':
        if (!Array.isArray(currentData.suppliers)) currentData.suppliers = [];
        const supIndex = currentData.suppliers.findIndex((s: any) => s.id === payload.id);
        if (supIndex > -1) currentData.suppliers[supIndex] = payload;
        else currentData.suppliers.push(payload);
        break;
      case 'LINEN':
        if (!Array.isArray(currentData.linenItems)) currentData.linenItems = [];
        const normalizedLinenPayload = normalizeLinenItemV2(payload);
        const linenIndex = currentData.linenItems.findIndex((item: any) => item.id === payload.id);
        if (linenIndex > -1) currentData.linenItems[linenIndex] = normalizedLinenPayload;
        else currentData.linenItems.push(normalizedLinenPayload);
        break;
      case 'LINEN_OP':
        if (!Array.isArray(currentData.linenHistory)) currentData.linenHistory = [];
        if (!Array.isArray(currentData.linenItems)) currentData.linenItems = [];
        currentData.linenItems = currentData.linenItems.map(normalizeLinenItemV2);
        currentData.linenHistory.push(payload);

        const linenItem = currentData.linenItems.find((item: any) => item.id === payload.itemId || String(item.id) === String(payload.itemId));
        if (linenItem) {
          const quantity = Number(payload.quantity) || 0;
          const statusField = (status: string) => {
            switch (status) {
              case 'Limpo': return 'quantityClean';
              case 'Em uso': return 'quantityInUse';
              case 'Sujo': return 'quantityDirty';
              case 'Lavanderia': return 'quantityLaundry';
              case 'Manchado': return 'quantityStained';
              case 'Rasgado': return 'quantityTorn';
              case 'Danificado': return 'quantityDamaged';
              case 'Extraviado': return 'quantityLost';
              default: return null;
            }
          };
          const fromField = statusField(payload.fromStatus);
          const toField = statusField(payload.toStatus);
          if (fromField) linenItem[fromField] = Math.max(0, (Number(linenItem[fromField]) || 0) - quantity);
          if (toField) linenItem[toField] = (Number(linenItem[toField]) || 0) + quantity;
          linenItem.inventoryModelVersion = 2;
          linenItem.lastUpdate = Date.now();

          if (payload.type === 'Reciclagem' && payload.generatedItemId) {
            const generatedItem = currentData.linenItems.find((item: any) => item.id === payload.generatedItemId || String(item.id) === String(payload.generatedItemId));
            const generatedQuantity = Number(payload.generatedQuantity) || 0;
            if (generatedItem && generatedQuantity > 0) {
              generatedItem.quantityInUse = (Number(generatedItem.quantityInUse) || 0) + generatedQuantity;
              generatedItem.inventoryModelVersion = 2;
              generatedItem.lastUpdate = Date.now();
            }
          }
        }
        break;
      case 'LINEN_MONTHLY':
        if (!Array.isArray(currentData.linenMonthlyInventories)) currentData.linenMonthlyInventories = [];
        if (!Array.isArray(currentData.linenItems)) currentData.linenItems = [];
        currentData.linenItems = currentData.linenItems.map(normalizeLinenItemV2);
        const monthlyIndex = currentData.linenMonthlyInventories.findIndex((inventory: any) => inventory.id === payload.id);
        if (monthlyIndex > -1) currentData.linenMonthlyInventories[monthlyIndex] = payload;
        else currentData.linenMonthlyInventories.push(payload);

        if (Array.isArray(payload.items)) {
          payload.items.forEach((counted: any) => {
            const currentItem = currentData.linenItems.find((item: any) => item.id === counted.itemId || String(item.id) === String(counted.itemId));
            if (!currentItem) return;
            currentItem.inventoryModelVersion = 2;
            currentItem.quantityClean = 0;
            currentItem.quantityInUse = Number(counted.quantityInUse) || 0;
            currentItem.quantityDirty = 0;
            currentItem.quantityLaundry = 0;
            currentItem.quantityStained = Number(counted.quantityStained) || 0;
            currentItem.quantityTorn = Number(counted.quantityTorn) || 0;
            currentItem.quantityDamaged = Number(counted.quantityDamaged) || 0;
            currentItem.quantityLost = Number(counted.quantityLost) || 0;
            currentItem.lastUpdate = Number(payload.timestamp) || Date.now();
          });
        }
        break;
      case 'USER':
        if (!Array.isArray(currentData.users)) currentData.users = [];
        const uIndex = currentData.users.findIndex((u: any) => u.id === payload.id);
        if (uIndex > -1) currentData.users[uIndex] = payload;
        else currentData.users.push(payload);
        break;
      case 'PARKING_LOCATION':
        if (!Array.isArray(currentData.parkingLocations)) currentData.parkingLocations = [];
        const pIndex = currentData.parkingLocations.findIndex((p: any) => p.id === payload.id);
        if (pIndex > -1) currentData.parkingLocations[pIndex] = payload;
        else currentData.parkingLocations.push(payload);
        break;
      case 'VEHICLE':
      case 'CHECKOUT_VEHICLE':
        if (!Array.isArray(currentData.vehicles)) currentData.vehicles = [];
        const vIndex = currentData.vehicles.findIndex((v: any) => v.id === payload.id);
        if (vIndex > -1) {
          currentData.vehicles[vIndex] = { ...currentData.vehicles[vIndex], ...payload };
        } else {
          currentData.vehicles.push(payload);
        }
        break;
      case 'CONFIG':
        currentData.config = { ...currentData.config, ...payload };
        break;
      case 'DELETE':
        const { targetType, id: targetId } = payload;
        const deleteKey = INTERNAL_KEY_MAP[targetType];
        if (!deleteKey) break;

        targetDataType = targetType;
        if (deleteKey === 'apartments' && currentData.apartments) {
          delete currentData.apartments[targetId];
        } else if (Array.isArray(currentData[deleteKey])) {
          currentData[deleteKey] = currentData[deleteKey].filter((item: any) => item.id !== targetId);
        }

        // Delete from Supabase immediately if deleting.
        // Resolve the actual table instead of assuming that lower-casing the key is enough.
        if (supabase) {
          const tableName = await resolveSupabaseTable(deleteKey, true);
          if (!tableName) throw new Error(`NÃ£o foi possÃ­vel localizar a tabela do Supabase para ${deleteKey}.`);
          const { error: deleteError } = await supabase.from(tableName).delete().eq('id', `${hotel}_${targetId}`);
          if (deleteError) throw new Error(`Falha ao excluir registro de public.${tableName}: ${deleteError.message}`);
        }
        break;
    }

    // Persist to Google Sheets and Supabase
    // We always want to sync with Supabase if it's available
    const keyToSave = INTERNAL_KEY_MAP[targetDataType];
    if (keyToSave) {
        // If it's a delete, we already handled Supabase above.
        // If it's not a delete, let's make sure we sync the item/collection.
        const dataToSave = (isFullSync || dataType === 'DELETE' || dataType === 'INVENTORY_OP' || dataType === 'LINEN_OP' || dataType === 'LINEN_MONTHLY' || dataType === 'CONFIG') 
          ? currentData[keyToSave] 
          : payload;
        
        await saveSheetData(hotel, targetDataType, dataToSave, { isFullSync: (isFullSync || dataType === 'DELETE' || dataType === 'INVENTORY_OP' || dataType === 'LINEN_OP' || dataType === 'LINEN_MONTHLY') });

        // If it was an inventory op, also save final inventory state
        if (dataType === 'INVENTORY_OP') {
            await saveSheetData(hotel, 'INVENTORY', currentData.inventory, { isFullSync: true });
        }

        // Linen movements also update the current balance of each item.
        if (dataType === 'LINEN_OP' || dataType === 'LINEN_MONTHLY') {
            await saveSheetData(hotel, 'LINEN', currentData.linenItems, { isFullSync: true });
        }
    }

    // Clear cache after any change
    delete dataCache[hotel];

    res.json({ status: 'success', debugQty: res.locals.debugQty, invLength: res.locals.invLength, payloadItemId: payload.itemId });
  } catch (error: any) {
    console.error(`[Action Error] Hotel: ${hotel} -`, error);
    res.status(500).json({ status: 'error', message: error.message || 'Erro ao processar aÃ§Ã£o' });
  }
});

// Vite middleware for development
if (!process.env.VERCEL) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
  
  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
