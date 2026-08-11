import express from 'express';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: {
      hasSheetId: !!process.env.GOOGLE_SHEET_ID,
      hasServiceAccount: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      hasPrivateKey: !!process.env.GOOGLE_PRIVATE_KEY
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
  apartments: ['roomNumber', 'floor', 'pisoType', 'pisoStatus', 'banheiroType', 'banheiroStatus', 'temCofre', 'temCortina', 'cortinaStatus', 'cortinaSize', 'cortinaCoverage', 'temEspelhoCorpo', 'espelhoCorpoStatus', 'acBrand', 'moveisStatus', 'moveisDetalhes', 'beds', 'temPortaControle', 'temCabide', 'cabideQuantity', 'temSuportePapel', 'temSuporteShampoo', 'suporteShampooStatus', 'luminariaType', 'luminariaColor', 'tvBrand', 'defects', 'customAnswers', 'espelhoBanheiroStatus'],
  employees: ['id', 'name', 'role', 'gender', 'contact', 'salary', 'sectorId', 'fixedDayOff', 'sundayOffs', 'workingHours', 'status', 'startDate', 'scheduleType', 'vacationStatus', 'uniforms', 'photo'],
  budgets: ['id', 'title', 'objective', 'items', 'quotes', 'status', 'createdAt', 'files'],
  extras: ['id', 'name', 'phone', 'availability', 'serviceQuality', 'observation', 'sectorId'],
  sectors: ['id', 'name', 'standardUniform', 'roles'],
  inventory: ['id', 'ean', 'name', 'category', 'quantity', 'minQuantity', 'unit', 'price', 'supplierId', 'lastUpdate', 'sectorId'],
  inventoryHistory: ['id', 'itemId', 'itemName', 'type', 'quantity', 'timestamp', 'user', 'reason', 'recipientId', 'recipientName'],
  suppliers: ['id', 'name', 'contact', 'category'],
  users: ['id', 'name', 'password', 'role', 'allowedTabs', 'email', 'status'],
  parkingLocations: ['id', 'name', 'totalSpots'],
  vehicles: ['id', 'guest_name', 'plate', 'identifier', 'location', 'trip_start', 'model', 'color', 'is_on_trip', 'payment_pending', 'unused', 'check_in_date', 'is_active', 'check_out_date', 'photos', 'history']
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

// Helper to get data from a specific sheet/cell
async function getSheetData(hotel: string) {
  const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
  if (!SPREADSHEET_ID) {
    const context = process.env.VERCEL ? 'no Dashboard da Vercel (Environment Variables)' : 'no menu Settings > Secrets do AI Studio';
    throw new Error(`A variável de ambiente GOOGLE_SHEET_ID não foi encontrada. Por favor, configure-a ${context}.`);
  }

  // Check cache first
  const cached = dataCache[hotel];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[Cache] Returning cached data for hotel: ${hotel}`);
    return cached.data;
  }

  const hotelData: any = {};
  
  // Fetch sheets sequentially to avoid bursting the Sheets API quota
  // Every call to getSheetsData triggered 12 parallel requests, hitting the 60 requests/min limit very fast.
  for (const [key, sheetPrefix] of Object.entries(DATA_MAP)) {
    const sheetName = `${sheetPrefix}_${hotel}`;
    const defaultValue = (key === 'apartments' ? {} : []);
    const gridCols = GRID_COLUMNS[key];

    try {
      // Add a tiny delay between requests to spread out the load
      await new Promise(resolve => setTimeout(resolve, 200));

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A:AC`,
      });
      
      const rows = response.data.values;
      
      if (!rows || rows.length === 0) {
        hotelData[key] = defaultValue;
        continue;
      }

      // Special handling for Config (key-value pairs)
      if (key === 'config') {
        const config: any = {};
        rows.forEach(row => {
          if (row[0] && row[1] !== undefined) {
            let val = row[1];
            const trimmed = typeof val === 'string' ? val.trim() : '';
            if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
              try { val = JSON.parse(trimmed); } catch (e) {
                console.warn(`Failed to parse JSON in config ${row[0]}:`, trimmed.substring(0, 50));
              }
            } else if (val === 'TRUE' || val === 'true') {
              val = true;
            } else if (val === 'FALSE' || val === 'false') {
              val = false;
            }
            config[row[0]] = val;
          }
        });
        hotelData[key] = config;
        continue;
      }

      // Check if it's a grid or a single JSON in A1
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
          continue;
        } catch (e) {}
      }

      if (gridCols) {
        let dataRows = rows;
        const firstRow = rows[0].map(c => String(c).toLowerCase());
        if (firstRow.includes('id') || firstRow.includes('apto') || firstRow.includes('nome') || firstRow.includes('ean')) {
          dataRows = rows.slice(1);
        }

        const parsedRows = dataRows.map(row => {
          const item: any = {};
          gridCols.forEach((col, index) => {
            item[col] = parseValue(row[index], col);
          });
          return item;
        }).filter(item => item.id || item.roomNumber);

        if (key === 'apartments') {
          const aptMap: any = {};
          parsedRows.forEach(apt => {
            const id = apt.id || `${apt.floor}-${apt.roomNumber}`;
            aptMap[id] = { ...apt, id };
          });
          hotelData[key] = aptMap;
        } else {
          hotelData[key] = parsedRows;
        }
      } else {
        hotelData[key] = defaultValue;
      }
    } catch (error: any) {
      if (error.message?.includes('Quota exceeded') || error.code === 429) {
        console.error(`[QUOTA EXCEEDED] Sheet ${sheetName}. Returning partial/cached data.`);
        // If we hit a quota, we stop fetching more sheets for this hotel request
        // and return what we have so far, or better, return the previous cache if available.
        if (cached) return cached.data;
        hotelData[key] = defaultValue;
      } else if (error.message?.includes('Unable to parse range') || error.code === 400) {
        hotelData[key] = defaultValue;
      } else {
        console.error(`Error reading sheet ${sheetName}:`, error.message || error);
        hotelData[key] = defaultValue;
      }
    }
  }

  // Update cache
  dataCache[hotel] = { data: hotelData, timestamp: Date.now() };
  return hotelData;
}

// Helper to save data to a specific sheet/cell
async function saveSheetData(hotel: string, dataType: string, data: any) {
  const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
  if (!SPREADSHEET_ID) {
    const context = process.env.VERCEL ? 'no Dashboard da Vercel (Environment Variables)' : 'no menu Settings > Secrets do AI Studio';
    throw new Error(`A variável de ambiente GOOGLE_SHEET_ID não foi encontrada. Por favor, configure-a ${context}.`);
  }

  const key = INTERNAL_KEY_MAP[dataType];
  if (!key || !DATA_MAP[key]) {
    console.warn(`No sheet mapping found for dataType: ${dataType}`);
    return;
  }

  const sheetName = `${DATA_MAP[key]}_${hotel}`;
  const gridCols = GRID_COLUMNS[key];

  try {
    let values: any[][];
    if (key === 'config' && typeof data === 'object') {
      values = Object.entries(data).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : v]);
    } else if (gridCols && Array.isArray(data)) {
      values = data.map(item => gridCols.map(col => {
        const val = item[col];
        if (['timestamp', 'lastUpdate', 'createdAt'].includes(col) && typeof val === 'number') {
          return new Date(val).toISOString();
        }
        return typeof val === 'object' ? JSON.stringify(val) : (val ?? '');
      }));
      
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A:AC`,
      });
    } else {
      values = [[JSON.stringify(data)]];
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
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
  const { hotel } = req.query;
  if (!hotel) return res.status(400).json({ status: 'error', message: 'Hotel not specified' });

  try {
    const data = await getSheetData(hotel as string);
    res.json({ status: 'success', data: data || {} });
  } catch (error: any) {
    console.error(`[Load Error] Hotel: ${hotel} -`, error);
    res.status(500).json({ 
      status: 'error', 
      message: `Erro ao carregar dados: ${error.message || 'Erro desconhecido'}` 
    });
  }
});

app.post('/api/sheets/action', async (req, res) => {
  const { hotel, dataType, ...payload } = req.body;
  if (!hotel) return res.status(400).json({ status: 'error', message: 'Hotel not specified' });

  try {
    let currentData = await getSheetData(hotel);
    let targetDataType = dataType;
    
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
        
        // Atualiza o saldo no estoque (Balance) automaticamente na planilha de Estoque
        if (Array.isArray(currentData.inventory)) {
          const item = currentData.inventory.find((i: any) => i.id === payload.itemId);
          if (item) {
            const qty = Number(payload.quantity) || 0;
            if (payload.type === 'Entrada') {
              item.quantity = (Number(item.quantity) || 0) + qty;
            } else {
              item.quantity = (Number(item.quantity) || 0) - qty;
            }
            item.lastUpdate = Date.now();
          }
        }
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
          // Merge para evitar perda de dados em atualizações parciais como CHECKOUT
          currentData.vehicles[vIndex] = { ...currentData.vehicles[vIndex], ...payload };
        } else {
          currentData.vehicles.push(payload);
        }
        break;
      case 'CONFIG':
        currentData.config = { ...currentData.config, ...payload };
        break;
      case 'DELETE':
        const { targetType, targetId } = payload;
        targetDataType = targetType;
        if (targetType === 'APARTMENT' && currentData.apartments) delete currentData.apartments[targetId];
        else if (targetType === 'BUDGET' && currentData.budgets) currentData.budgets = currentData.budgets.filter((b: any) => b.id !== targetId);
        else if (targetType === 'EMPLOYEE' && currentData.employees) currentData.employees = currentData.employees.filter((e: any) => e.id !== targetId);
        else if (targetType === 'EXTRA' && currentData.extras) currentData.extras = currentData.extras.filter((e: any) => e.id !== targetId);
        else if (targetType === 'SECTOR' && currentData.sectors) currentData.sectors = currentData.sectors.filter((s: any) => s.id !== targetId);
        else if (targetType === 'INVENTORY' && currentData.inventory) currentData.inventory = currentData.inventory.filter((i: any) => i.id !== targetId);
        else if (targetType === 'SUPPLIER' && currentData.suppliers) currentData.suppliers = currentData.suppliers.filter((s: any) => s.id !== targetId);
        else if (targetType === 'USER' && currentData.users) currentData.users = currentData.users.filter((u: any) => u.id !== targetId);
        else if (targetType === 'PARKING_LOCATION' && currentData.parkingLocations) currentData.parkingLocations = currentData.parkingLocations.filter((p: any) => p.id !== targetId);
        else if (targetType === 'VEHICLE' && currentData.vehicles) currentData.vehicles = currentData.vehicles.filter((v: any) => v.id !== targetId);
        break;
    }

    const internalKey = INTERNAL_KEY_MAP[targetDataType];
    if (internalKey) {
      await saveSheetData(hotel, targetDataType, currentData[internalKey]);
      
      // Se for uma operação de estoque, precisamos salvar também a planilha de saldo (Estoque)
      if (dataType === 'INVENTORY_OP') {
        await saveSheetData(hotel, 'INVENTORY', currentData.inventory);
      }
    }

    // Limpa o cache após qualquer alteração para garantir que o próximo carregamento seja atualizado
    delete dataCache[hotel];

    res.json({ status: 'success' });
  } catch (error: any) {
    console.error('Error in sheets action:', error);
    res.status(500).json({ status: 'error', message: error.message });
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
