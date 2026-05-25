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
      const names = [DATA_MAP[key], DATA_MAP[key].toLowerCase(), key.toLowerCase()];
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
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
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

const DATA_MAP: Record<string, string> = {
  apartments: 'Apartamentos',
  budgets: 'Orcamentos',
  employees: 'Funcionarios',
  extras: 'Extras',
  sectors: 'Setores',
  inventory: 'Estoque',
  inventoryHistory: 'Historico_Estoque',
  suppliers: 'Fornecedores',
  config: 'Config',
  users: 'Users',
  parkingLocations: 'Patios',
  vehicles: 'Vehicles'
};

const INTERNAL_KEY_MAP: Record<string, string> = {
  'APARTMENT': 'apartments',
  'BUDGET': 'budgets',
  'EMPLOYEE': 'employees',
  'EXTRA': 'extras',
  'SECTOR': 'sectors',
  'INVENTORY': 'inventory',
  'INVENTORY_OP': 'inventoryHistory',
  'SUPPLIER': 'suppliers',
  'CONFIG': 'config',
  'USER': 'users',
  'PARKING_LOCATION': 'parkingLocations',
  'VEHICLE': 'vehicles',
  'CHECKOUT_VEHICLE': 'vehicles'
};

const GRID_COLUMNS: Record<string, string[]> = {
  apartments: ['id', 'roomNumber', 'floor', 'pisoType', 'pisoStatus', 'banheiroType', 'banheiroStatus', 'temCofre', 'temCortina', 'cortinaStatus', 'cortinaSize', 'cortinaCoverage', 'temEspelhoCorpo', 'espelhoCorpoStatus', 'acBrand', 'moveisStatus', 'moveisDetalhes', 'beds', 'temPortaControle', 'temCabide', 'cabideQuantity', 'temSuportePapel', 'temSuporteShampoo', 'suporteShampooStatus', 'luminariaType', 'luminariaColor', 'tvBrand', 'defects', 'customAnswers'],
  employees: ['id', 'name', 'role', 'gender', 'contact', 'salary', 'sectorId', 'fixedDayOff', 'sundayOffs', 'workingHours', 'status', 'startDate', 'scheduleType', 'vacationStatus', 'vacationStart', 'vacationEnd', 'uniforms', 'photo'],
  budgets: ['id', 'title', 'objective', 'items', 'quotes', 'status', 'createdAt', 'files'],
  extras: ['id', 'name', 'phone', 'availability', 'serviceQuality', 'observation', 'sectorId'],
  sectors: ['id', 'name', 'standardUniform', 'roles'],
  inventory: ['id', 'ean', 'name', 'category', 'quantity', 'minQuantity', 'unit', 'price', 'supplierId', 'lastUpdate', 'sectorId'],
  inventoryHistory: ['id', 'itemId', 'itemName', 'type', 'quantity', 'timestamp', 'user', 'reason', 'recipientId', 'recipientName'],
  suppliers: ['id', 'name', 'contact', 'category'],
  users: ['id', 'name', 'password', 'role', 'allowedTabs', 'email', 'status'],
  parkingLocations: ['id', 'name', 'totalSpots'],
  vehicles: ['id', 'guest_name', 'plate', 'identifier', 'location', 'trip_start', 'model', 'color', 'is_on_trip', 'payment_pending', 'deleted_date', 'check_in_date', 'is_active', 'check_out_date', 'photos', 'history']
};

function parseValue(val: any, fieldName: string) {
  if (val === undefined || val === null || val === '') {
    if (['quantity', 'minQuantity', 'price', 'value', 'laborCost', 'totalSpots', 'floor', 'roomNumber', 'serviceQuality', 'cabideQuantity'].includes(fieldName)) return 0;
    if (['defects', 'beds', 'moveisDetalhes', 'items', 'quotes', 'files', 'standardUniform', 'roles', 'availability', 'sundayOffs', 'uniforms', 'photos', 'history', 'allowedTabs'].includes(fieldName)) return [];
    if (['customAnswers'].includes(fieldName)) return {};
    if (fieldName.startsWith('tem') || ['temCofre', 'temCortina', 'temEspelhoCorpo', 'temPortaControle', 'temCabide', 'temSuportePapel', 'temSuporteShampoo'].includes(fieldName)) return false;
    return '';
  }
  
  // Handle JSON strings in cells
  if (['defects', 'beds', 'moveisDetalhes', 'items', 'quotes', 'files', 'standardUniform', 'roles', 'availability', 'sundayOffs', 'uniforms', 'photos', 'history', 'allowedTabs', 'customAnswers'].includes(fieldName)) {
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

  if (['quantity', 'minQuantity', 'price', 'value', 'laborCost', 'totalSpots', 'floor', 'roomNumber', 'serviceQuality', 'cabideQuantity', 'salary'].includes(fieldName)) {
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
  if (val === 'FALSE' || val === 'false' || val === 'Não' || val === 'NÃO') return false;
  
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
      const tableName = key.toLowerCase(); 
      
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
    res.json({ status: 'success', results, message: 'Processamento concluído. Verifique os logs para detalhes.' });
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
        const englishTableName = key.toLowerCase();
        const ptTableNameExact = DATA_MAP[key];
        const ptTableNameLower = DATA_MAP[key].toLowerCase();
        
        let possibleTables = [ptTableNameExact, ptTableNameLower, englishTableName];
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
                  else if (col === 'floor') idx = firstRow.findIndex(c => ['andar', 'chão', 'floor'].includes(c));
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
      const englishTableName = key.toLowerCase();
      const ptTableNameExact = DATA_MAP[key];
      const ptTableNameLower = DATA_MAP[key].toLowerCase();
      
      let tableName = ptTableNameExact;
      
      // Let's first check which table actually has data/exists
      let check = await supabase.from(ptTableNameExact).select('id', { count: 'exact', head: true });
      if (check.error || check.count === null || check.count === 0) {
        let checkLower = await supabase.from(ptTableNameLower).select('id', { count: 'exact', head: true });
        if (!checkLower.error && checkLower.count !== null && checkLower.count > 0) {
            tableName = ptTableNameLower;
        } else {
            let checkEn = await supabase.from(englishTableName).select('id', { count: 'exact', head: true });
            if (!checkEn.error && checkEn.count !== null && checkEn.count > 0) {
                tableName = englishTableName;
            }
        }
      }
      
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
        } else {
          console.log(`[Supabase Save Success] ${dataType} to ${tableName}`);
        }

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
    }
  }

  // Supabase é a fonte principal de dados.
  // IMPORTANTE:
  // Se o Supabase estiver configurado, edições normais do app NÃO devem escrever no Google Sheets.
  // Isso evita apagar/limpar a aba Apartamentos_VILLAGE em salvamentos individuais.
  // A planilha deve ser usada apenas como backup/importação manual ou via rota de migração controlada.
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

        // Delete from Supabase immediately if deleting
        if (supabase) {
          const tableName = deleteKey.toLowerCase();
          await supabase.from(tableName).delete().eq('id', `${hotel}_${targetId}`);
        }
        break;
    }

    // Persist to Google Sheets and Supabase
    // We always want to sync with Supabase if it's available
    const keyToSave = INTERNAL_KEY_MAP[targetDataType];
    if (keyToSave) {
        // If it's a delete, we already handled Supabase above.
        // If it's not a delete, let's make sure we sync the item/collection.
        const dataToSave = (isFullSync || dataType === 'DELETE' || dataType === 'INVENTORY_OP' || dataType === 'CONFIG') 
          ? currentData[keyToSave] 
          : payload;
        
        await saveSheetData(hotel, targetDataType, dataToSave, { isFullSync: (isFullSync || dataType === 'DELETE' || dataType === 'INVENTORY_OP') });

        // If it was an inventory op, also save final inventory state
        if (dataType === 'INVENTORY_OP') {
            await saveSheetData(hotel, 'INVENTORY', currentData.inventory, { isFullSync: true });
        }
    }

    // Clear cache after any change
    delete dataCache[hotel];

    res.json({ status: 'success', debugQty: res.locals.debugQty, invLength: res.locals.invLength, payloadItemId: payload.itemId });
  } catch (error: any) {
    console.error(`[Action Error] Hotel: ${hotel} -`, error);
    res.status(500).json({ status: 'error', message: error.message || 'Erro ao processar ação' });
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