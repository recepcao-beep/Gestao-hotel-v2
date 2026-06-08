
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ViewType, AppState, Apartment, Budget, Employee, Integration, HotelType, HotelData, HotelTheme, User, Sector, InventoryItem, InventoryOperation, Supplier, ExtraLabor, ParkingLocation, Vehicle, LinenItem, LinenOperation, LinenStockStatus, LinenHotelSettings, LinenMonthlyInventory } from './types';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import Dashboard from './components/Dashboard';
import ApartmentsView from './components/ApartmentsView';
import FloorDetailView from './components/FloorDetailView';
import ApartmentDetailView from './components/ApartmentDetailView';
import BudgetsView from './components/BudgetsView';
import EmployeesView from './components/EmployeesView';
import InventoryView from './components/InventoryView';
import LinenView from './components/LinenView';
import ReportsView from './components/ReportsView';
import SettingsView from './components/SettingsView';
import ParkingView from './components/ParkingView';
import TodayScheduleView from './components/TodayScheduleView';
import Login from './components/Login';
import Logo from './components/Logo';

const GLOBAL_API_URL = "/api/sheets";

const getInitialHotelData = (): HotelData => ({
  apartments: {},
  budgets: [],
  employees: [],
  extras: [],
  inventory: [],
  inventoryHistory: [],
  suppliers: [],
  linenItems: [],
  linenHistory: [],
  linenMonthlyInventories: [],
  sectors: [
    { id: '1', name: 'Recepção', standardUniform: [{ name: 'Camisa Social', quantity: 2 }, { name: 'Calça Social', quantity: 2 }] },
    { id: '2', name: 'Governança', standardUniform: [{ name: 'Jaleco', quantity: 3 }, { name: 'Calça Branca', quantity: 2 }] },
    { id: '3', name: 'Rouparia', standardUniform: [{ name: 'Camiseta Logotipo', quantity: 3 }, { name: 'Bermuda Tactel', quantity: 2 }] },
  ],
  config: {
    showSuppliersTab: true,
    linenSettings: {
      totalApartments: 0,
      totalBeds: 0,
      totalSingleBeds: 0,
      totalDoubleBeds: 0,
      idealStockMultiplier: 3
    }
  }
});


const normalizeLinenItemV2 = (item: any): LinenItem => {
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
  } as LinenItem;
};

const normalizeCachedHotelData = (data: Partial<HotelData> | undefined): HotelData => {
  const initial = getInitialHotelData();
  const merged = { ...initial, ...(data || {}) } as HotelData;
  return {
    ...merged,
    linenItems: Array.isArray(merged.linenItems) ? merged.linenItems.map(normalizeLinenItemV2) : [],
    linenHistory: Array.isArray(merged.linenHistory) ? merged.linenHistory : [],
    linenMonthlyInventories: Array.isArray(merged.linenMonthlyInventories) ? merged.linenMonthlyInventories : [],
    config: {
      ...initial.config,
      ...(merged.config || {}),
      showSuppliersTab: merged.config?.showSuppliersTab !== false,
      linenSettings: {
        totalApartments: Number(merged.config?.linenSettings?.totalApartments) || 0,
        totalBeds: Number(merged.config?.linenSettings?.totalBeds) || 0,
        totalSingleBeds: Number(merged.config?.linenSettings?.totalSingleBeds) || 0,
        totalDoubleBeds: Number(merged.config?.linenSettings?.totalDoubleBeds) || 0,
        idealStockMultiplier: Number(merged.config?.linenSettings?.idealStockMultiplier) || 3
      }
    }
  };
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const safeJSONParse = (value: any, defaultValue: any) => {
  let parsed = value;
  if (typeof value === 'string' && value.trim() !== '') {
    const trimmed = value.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        parsed = JSON.parse(trimmed);
      } catch (e) {
        console.warn(`Failed to parse JSON: ${value}`, e);
        return defaultValue;
      }
    } else {
        if (Array.isArray(defaultValue) || (defaultValue !== null && typeof defaultValue === 'object')) {
            return defaultValue;
        }
    }
  }
  
  if (Array.isArray(defaultValue) && !Array.isArray(parsed)) {
      return defaultValue;
  }
  
  return parsed || defaultValue;
};

const safeGetTime = (val: any) => {
  if (!val) return Date.now() + Math.floor(Math.random() * 1000);
  if (typeof val === 'number') return val;
  if (val instanceof Date) return isNaN(val.getTime()) ? (Date.now() + Math.floor(Math.random() * 1000)) : val.getTime();
  
  // Try standard parsing
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d.getTime();
  
  // Try parsing dd/mm/yyyy
  if (typeof val === 'string') {
    const parts = val.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (parts) {
      const parsedDate = new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]));
      if (!isNaN(parsedDate.getTime())) return parsedDate.getTime();
    }
  }
  
  return Date.now() + Math.floor(Math.random() * 1000);
};

const App: React.FC = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const initialSyncRef = useRef(false);
  
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('hotel_village_state_v45');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { 
          ...parsed,
          hotels: {
            VILLAGE: normalizeCachedHotelData(parsed.hotels?.VILLAGE),
            GOLDEN_PARK: normalizeCachedHotelData(parsed.hotels?.GOLDEN_PARK),
            THERMAL_RESORT: normalizeCachedHotelData(parsed.hotels?.THERMAL_RESORT)
          },
          currentUser: null,
          lastDataSource: parsed.lastDataSource || 'CACHE'
        };
      } catch (e) {
        console.error("Erro ao carregar estado salvo:", e);
      }
    }
    return {
      currentView: ViewType.DASHBOARD,
      currentHotel: 'VILLAGE',
      hotels: {
        VILLAGE: getInitialHotelData(),
        GOLDEN_PARK: getInitialHotelData(),
        THERMAL_RESORT: getInitialHotelData(),
      },
      selectedFloor: null,
      selectedApartmentId: null,
      selectedSectorId: null,
      integrations: [
        { 
          id: 'global-sync', 
          name: 'Integração Direta Google Sheets & Drive', 
          type: 'Spreadsheet', 
          status: 'Disconnected', 
          lastSync: 0,
          url: GLOBAL_API_URL
        },
      ],
      currentUser: null
    };
  });

  const theme: HotelTheme = useMemo(() => {
    switch(state.currentHotel) {
      case 'VILLAGE': return { primary: '#26A6A6', secondary: '#34BFA6', accent: '#29D9A7', bg: '#F8FAFC', text: '#1E293B', chartColors: ['#26A6A6', '#34BFA6', '#29D9A7', '#737373'] };
      case 'GOLDEN_PARK': return { primary: '#BF984E', secondary: '#A68444', accent: '#A67A44', bg: '#F8FAFC', text: '#1E293B', chartColors: ['#BF984E', '#A68444', '#A67A44', '#A6A6A6'] };
      case 'THERMAL_RESORT': return { primary: '#68A672', secondary: '#4B94F2', accent: '#B49B5D', bg: '#F8FAFC', text: '#1E293B', chartColors: ['#68A672', '#4B94F2', '#B49B5D', '#0D0D0D'] };
      default: return { primary: '#26A6A6', secondary: '#34BFA6', accent: '#29D9A7', bg: '#F8FAFC', text: '#1E293B', chartColors: ['#26A6A6', '#34BFA6', '#29D9A7', '#737373'] };
    }
  }, [state.currentHotel]);

  const loadDataFromSheet = useCallback(async (hotelOverride?: HotelType, forceSheets: boolean = false) => {
    const targetHotel = hotelOverride || state.currentHotel;
    if (!targetHotel) return null;
    
    setIsRefreshing(true);
    const apiUrl = `${GLOBAL_API_URL}/load`;
    const fetchUrl = `${apiUrl}?hotel=${encodeURIComponent(targetHotel)}&nocache=${Date.now()}${forceSheets ? '&forceSheets=true' : ''}`;
    
    console.log(`[App] ${forceSheets ? 'Force ' : ''}Syncing ${targetHotel}...`);
    
    let attempt = 0;
    const maxRetries = 2;
    let response: Response | null = null;
    let lastError: any = null;

    while (attempt <= maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); 

        response = await fetch(fetchUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) break;
        
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message || `HTTP ${response.status}`;
        console.warn(`[App] Fetch attempt ${attempt + 1} failed: ${errorMsg}`);
        lastError = new Error(errorMsg);
        
        if (response.status === 429) {
           await new Promise(r => setTimeout(r, 2000));
        } else {
           await new Promise(r => setTimeout(r, 1000));
        }
      } catch (err: any) {
        console.warn(`[App] Fetch attempt ${attempt + 1} threw error:`, err.message);
        lastError = err;
        await new Promise(r => setTimeout(r, 1000));
      }
      attempt++;
    }

    try {
      if (!response || !response.ok) {
        throw lastError || new Error(`Falha após ${maxRetries + 1} tentativas`);
      }

      const textResult = await response.text();
      let result;
      try {
        result = JSON.parse(textResult);
      } catch (e: any) {
        console.error(`Fetch JSON parse error! URL: ${fetchUrl}, Status: ${response.status}, Body Start: ${textResult.substring(0, 100)}`);
        throw new Error(`Invalid JSON response: ${e.message}`);
      }
      
      if (result && result.status === 'success') {
        const incomingData = result.data;
        
        // Detect source from logs
        let source: 'SUPABASE' | 'SHEETS' = 'SHEETS';
        if (incomingData._logs && Array.isArray(incomingData._logs)) {
          const joinedLogs = incomingData._logs.join(' ');
          if (joinedLogs.includes('Supabase Load Success')) {
            source = 'SUPABASE';
          }
        }

        // Helper para garantir IDs únicos
        const dedupe = (arr: any[]) => {
          const map = new Map();
          arr.forEach(item => {
            if (item.id) {
              const idStr = String(item.id);
              // Se já existir, prioriza o item que tem mais dados ou mantém o primeiro
              if (!map.has(idStr)) map.set(idStr, item);
            }
          });
          return Array.from(map.values());
        };

        // NORMALIZAÇÃO RIGOROSA DE FUNCIONÁRIOS
        const rawEmployees = Array.isArray(incomingData.employees) ? incomingData.employees : [];
        const normalizedEmployees = dedupe(rawEmployees.map((emp: any, idx: number) => {
          let sOffs: number[] = [];
          if (typeof emp.sundayOffs === 'string' && emp.sundayOffs !== '') {
            try {
              const p = JSON.parse(emp.sundayOffs);
              sOffs = Array.isArray(p) ? p.map(Number) : [Number(p)];
            } catch {
              sOffs = emp.sundayOffs.split(',').map(Number).filter(n => !isNaN(n));
            }
          } else if (Array.isArray(emp.sundayOffs)) {
            sOffs = emp.sundayOffs.map(Number);
          }

          return {
            ...emp,
            id: emp.id?.toString() || `emp-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
            name: emp.name || 'Sem Nome',
            gender: (emp.gender?.toUpperCase() === 'F' || emp.gender?.toUpperCase() === 'FEMININO') ? 'F' : 'M',
            role: emp.role || '',
            fixedDayOff: emp.fixedDayOff || 'Segunda-feira',
            sundayOffs: sOffs,
            sectorId: emp.sectorId?.toString() || '',
            salary: parseFloat(emp.salary) || 0,
            uniforms: safeJSONParse(emp.uniforms, []),
            photo: emp.photo || '' // Normalized photo field
          };
        }));

        // NORMALIZAÇÃO DE EXTRAS
        const rawExtras = Array.isArray(incomingData.extras) ? incomingData.extras : [];
        const normalizedExtras = dedupe(rawExtras.map((ext: any, idx: number) => ({
          ...ext,
          id: ext.id?.toString() || `extra-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
          name: ext.name || '',
          phone: ext.phone || '',
          availability: safeJSONParse(ext.availability, []),
          serviceQuality: parseFloat(ext.serviceQuality) || 0,
          sectorId: ext.sectorId?.toString() || '',
          observation: ext.observation || ''
        })));

        const rawSectors = Array.isArray(incomingData.sectors) ? incomingData.sectors : [];
        const normalizedSectors = dedupe(rawSectors.map((sec: any, idx: number) => ({
          ...sec,
          id: sec.id?.toString() || `sec-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
          name: sec.name || 'Setor Sem Nome',
          standardUniform: safeJSONParse(sec.standardUniform, [])
        })));

        // NORMALIZAÇÃO DE ORÇAMENTOS
        const rawBudgets = Array.isArray(incomingData.budgets) ? incomingData.budgets : [];
        const normalizedBudgets = dedupe(rawBudgets.map((b: any, idx: number) => ({
          ...b,
          id: b.id?.toString() || `budget-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
          title: b.title || 'Sem Título',
          objective: b.objective || '',
          items: safeJSONParse(b.items, []).map((it: any) => ({
            ...it,
            description: it.description || 'Serviço',
            materials: (it.materials || []).map((m: any) => ({
              ...m,
              quotes: m.quotes || [{ supplier: '', value: 0 }, { supplier: '', value: 0 }, { supplier: '', value: 0 }]
            }))
          })),
          quotes: safeJSONParse(b.quotes, []),
          files: safeJSONParse(b.files, []), // Normalized files
          createdAt: safeGetTime(b.createdAt)
        })));

        // NORMALIZAÇÃO DE ESTOQUE
        const rawInventory = Array.isArray(incomingData.inventory) ? incomingData.inventory : [];
        const normalizedInventory = dedupe(rawInventory.map((inv: any, idx: number) => ({
            ...inv,
            id: inv.id?.toString() || `inv-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
            quantity: parseFloat(inv.quantity) || 0,
            price: parseFloat(inv.price) || 0,
            lastUpdate: safeGetTime(inv.lastUpdate),
            sectorId: inv.sectorId?.toString() || '' // Parse sectorId
        })));

        const rawInventoryHistory = Array.isArray(incomingData.inventoryHistory) ? incomingData.inventoryHistory : [];
        const normalizedInventoryHistory = dedupe(rawInventoryHistory.map((op: any, idx: number) => ({
            ...op,
            id: op.id?.toString() || `hist-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
            quantity: parseFloat(op.quantity) || 0,
            timestamp: safeGetTime(op.timestamp),
            recipientName: op.recipientName || ''
        })));

        const rawSuppliers = Array.isArray(incomingData.suppliers) ? incomingData.suppliers : [];
        const normalizedSuppliers = dedupe(rawSuppliers.map((s: any, idx: number) => ({
            ...s,
            id: s.id?.toString() || `sup-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`
        })));

        const rawLinenItems = Array.isArray(incomingData.linenItems) ? incomingData.linenItems : [];
        const normalizedLinenItems = dedupe(rawLinenItems.map((item: any, idx: number) => normalizeLinenItemV2({
            ...item,
            id: item.id?.toString() || `linen-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
            name: item.name?.toString() || 'Item sem nome',
            category: item.category?.toString() || 'Outros',
            unit: item.unit?.toString() || 'Peça',
            inventoryModelVersion: parseFloat(item.inventoryModelVersion) || 0,
            calculationBasis: item.calculationBasis || 'Manual',
            quantityPerBasis: parseFloat(item.quantityPerBasis) || 0,
            idealMultiplier: parseFloat(item.idealMultiplier) || undefined,
            minCleanQuantity: parseFloat(item.minCleanQuantity) || 0,
            quantityClean: parseFloat(item.quantityClean) || 0,
            quantityInUse: parseFloat(item.quantityInUse) || 0,
            quantityDirty: parseFloat(item.quantityDirty) || 0,
            quantityLaundry: parseFloat(item.quantityLaundry) || 0,
            quantityStained: parseFloat(item.quantityStained) || 0,
            quantityTorn: parseFloat(item.quantityTorn) || 0,
            quantityDamaged: parseFloat(item.quantityDamaged) || 0,
            quantityLost: parseFloat(item.quantityLost) || 0,
            lastUpdate: safeGetTime(item.lastUpdate)
        })));

        const rawLinenHistory = Array.isArray(incomingData.linenHistory) ? incomingData.linenHistory : [];
        const normalizedLinenHistory = dedupe(rawLinenHistory.map((op: any, idx: number) => ({
            ...op,
            id: op.id?.toString() || `linen-op-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
            itemId: op.itemId?.toString() || '',
            itemName: op.itemName?.toString() || 'Item sem nome',
            quantity: parseFloat(op.quantity) || 0,
            timestamp: safeGetTime(op.timestamp),
            user: op.user?.toString() || 'Usuário',
            generatedItemId: op.generatedItemId?.toString() || undefined,
            generatedItemName: op.generatedItemName?.toString() || undefined,
            generatedQuantity: parseFloat(op.generatedQuantity) || undefined
        }))).sort((a: any, b: any) => b.timestamp - a.timestamp);

        const rawLinenMonthlyInventories = Array.isArray(incomingData.linenMonthlyInventories) ? incomingData.linenMonthlyInventories : [];
        const normalizedLinenMonthlyInventories = dedupe(rawLinenMonthlyInventories.map((inventory: any, idx: number) => ({
            ...inventory,
            id: inventory.id?.toString() || `linen-month-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
            month: inventory.month?.toString() || '',
            timestamp: safeGetTime(inventory.timestamp),
            user: inventory.user?.toString() || 'Usuário',
            notes: inventory.notes?.toString() || '',
            items: safeJSONParse(inventory.items, []),
            totalPhysical: parseFloat(inventory.totalPhysical) || 0,
            totalUsable: parseFloat(inventory.totalUsable) || 0,
            totalStained: parseFloat(inventory.totalStained) || 0,
            totalTorn: parseFloat(inventory.totalTorn) || 0,
            totalLost: parseFloat(inventory.totalLost) || 0,
            totalVariance: parseFloat(inventory.totalVariance) || 0
        }))).sort((a: any, b: any) => a.month.localeCompare(b.month));

        const rawVehicles = Array.isArray(incomingData.vehicles) ? incomingData.vehicles : [];
        const normalizedVehicles = dedupe(rawVehicles.map((v: any, idx: number) => ({
            ...v,
            id: v.id?.toString() || `veh-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
            is_on_trip: v.is_on_trip === true || v.is_on_trip === 'true',
            payment_pending: v.payment_pending === true || v.payment_pending === 'true',
            is_active: v.is_active === true || v.is_active === 'true',
            photos: safeJSONParse(v.photos, [])
        })));

        const rawUsers = Array.isArray(incomingData.users) ? incomingData.users : [];
        const normalizedUsers = dedupe(rawUsers.map((u: any, idx: number) => ({
            ...u,
            id: u.id?.toString() || `user_${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
            name: u.name?.toString() || '',
            password: u.password?.toString() || '',
            allowedTabs: safeJSONParse(u.allowedTabs, []),
            email: u.email?.toString() || '',
            status: u.status?.toString() || 'APPROVED',
            hotel: targetHotel
        })));
        console.log("Normalized users:", normalizedUsers);

        const rawParkingLocations = Array.isArray(incomingData.parkingLocations) ? incomingData.parkingLocations : [];
        const normalizedParkingLocations = dedupe(rawParkingLocations.map((l: any, idx: number) => ({
            ...l,
            id: l.id?.toString() || `pk-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
            totalSpots: parseInt(l.totalSpots) || 0
        })));

        let normalizedConfig = incomingData.config;
        if (typeof normalizedConfig === 'string') {
          try {
            normalizedConfig = JSON.parse(normalizedConfig);
          } catch (e) {
            normalizedConfig = { showSuppliersTab: true };
          }
        }
        if (!normalizedConfig || Array.isArray(normalizedConfig) || typeof normalizedConfig !== 'object') {
          normalizedConfig = { showSuppliersTab: true };
        }
        normalizedConfig.showSuppliersTab = normalizedConfig.showSuppliersTab !== false;
        normalizedConfig.linenSettings = {
          totalApartments: parseFloat(normalizedConfig.linenSettings?.totalApartments) || 0,
          totalBeds: parseFloat(normalizedConfig.linenSettings?.totalBeds) || 0,
          totalSingleBeds: parseFloat(normalizedConfig.linenSettings?.totalSingleBeds) || 0,
          totalDoubleBeds: parseFloat(normalizedConfig.linenSettings?.totalDoubleBeds) || 0,
          idealStockMultiplier: parseFloat(normalizedConfig.linenSettings?.idealStockMultiplier) || 3
        };

        console.log(`[App] Normalizing ${Object.keys(incomingData.apartments || {}).length} apartments for ${targetHotel}`);
        const normalizedApartments: Record<string, Apartment> = {};
        Object.entries(incomingData.apartments || {}).forEach(([id, apt]: [string, any]) => {
          let roomNumber = Number(apt.roomNumber) || 0;
          let floor = Number(apt.floor || apt.chão || apt.andar) || 0;
          
          // Fallback: Try to extract roomNumber from apt.id or id string if missing (e.g., "VILLAGE_200" or just "200")
          if (!roomNumber) {
            const possibleIdStr = String(apt.id || id);
            const match = possibleIdStr.match(/\d+/);
            if (match) {
              roomNumber = parseInt(match[0], 10);
            }
          }

          // In standard hotel mapping, floor could be 200, 300, 400
          if (floor < 100 && roomNumber >= 100) {
            floor = Math.floor(roomNumber / 100) * 100;
          } else if (!floor && roomNumber > 0) {
            floor = Math.floor(roomNumber / 100) * 100;
          }
          
          // Prefer just the roomNumber as the ID to maintain consistency with existing data
          const normalizedId = roomNumber > 0 ? String(roomNumber) : String(apt.id || id);
          
          // Map possible Portuguese translations back to expected English keys
          let bedsVal = apt.beds !== undefined ? apt.beds : (apt.cama !== undefined ? apt.cama : apt.camas);
          
          let moveisDetalhesVal = safeJSONParse(apt.moveisDetalhes || apt.detalhesMoveis || apt.moveis, []);
          
          if (typeof bedsVal === 'string' && bedsVal.trim().startsWith('[')) {
              bedsVal = safeJSONParse(bedsVal, []);
          }

          if (!Array.isArray(bedsVal)) {
               // If beds is just "Sim" and moveisDetalhes has bed configurations, use those!
               if (moveisDetalhesVal && moveisDetalhesVal.length > 0 && moveisDetalhesVal[0].type) {
                   bedsVal = moveisDetalhesVal;
               } else {
                   bedsVal = []; // Fallback to avoid map errors
               }
          }
          if (!Array.isArray(bedsVal)) bedsVal = [];
          
          normalizedApartments[normalizedId] = {
            ...apt,
            id: normalizedId,
            roomNumber,
            floor,
            beds: bedsVal,
            pisoType: apt.pisoType || apt.tipoPiso || apt.piso,
            pisoStatus: apt.pisoStatus || apt.statusPiso,
            banheiroType: apt.banheiroType || apt.tipoBanheiro || apt.banheiro,
            banheiroStatus: apt.banheiroStatus || apt.statusBanheiro,
            temCofre: apt.temCofre !== undefined ? apt.temCofre : apt.cofre,
            temCortina: apt.temCortina !== undefined ? apt.temCortina : apt.cortina,
            defects: safeJSONParse(apt.defects || apt.defeitos, []),
            moveisDetalhes: moveisDetalhesVal,
            customAnswers: safeJSONParse(apt.customAnswers || apt.respostasCustomizadas, {})
          };
        });
        
        if (Object.keys(normalizedApartments).length > 0) {
          const firstId = Object.keys(normalizedApartments)[0];
          console.log('[App] Sample Apartment:', normalizedApartments[firstId]);
        }

        const normalizedData = {
          ...incomingData,
          apartments: normalizedApartments,
          employees: normalizedEmployees,
          extras: normalizedExtras,
          sectors: normalizedSectors,
          budgets: normalizedBudgets,
          inventory: normalizedInventory,
          inventoryHistory: normalizedInventoryHistory,
          suppliers: normalizedSuppliers,
          linenItems: normalizedLinenItems,
          linenHistory: normalizedLinenHistory,
          linenMonthlyInventories: normalizedLinenMonthlyInventories,
          vehicles: normalizedVehicles,
          users: normalizedUsers,
          parkingLocations: normalizedParkingLocations
        };

        setState(prev => {
          const finalData = {
            ...prev.hotels[targetHotel],
            ...normalizedData,
            config: normalizedConfig || prev.hotels[targetHotel].config
          };

          return {
            ...prev,
            lastDataSource: source,
            hotels: {
              ...prev.hotels,
              [targetHotel]: finalData
            },
            integrations: prev.integrations.map(i => i.id === 'global-sync' ? { ...i, lastSync: Date.now(), status: 'Connected' } : i)
          };
        });
        
        // Return the data so Login can use it immediately
        return normalizedData;
      }
    } catch (error: any) { 
      console.error(`Erro ao carregar ${targetHotel}:`, error);
      const msg = error.message || 'Erro desconhecido';
      
      if (msg.includes('Quota exceeded') || msg.includes('429')) {
        alert("Limite de requisições ao Google Sheets atingido. Por favor, aguarde um minuto e tente novamente.");
      }
      
      throw error;
    } finally { 
      setIsRefreshing(false); 
    }
    return null;
  }, [state.currentHotel, state.integrations]);

  useEffect(() => {
    if (initialSyncRef.current) return;
    initialSyncRef.current = true;
    
    // Carrega apenas o hotel atual no início para evitar estourar quota da API
    loadDataFromSheet(state.currentHotel);
  }, [loadDataFromSheet, state.currentHotel]);

  useEffect(() => { 
    try {
      localStorage.setItem('hotel_village_state_v45', JSON.stringify(state)); 
      
      // Apply dark mode
      if (state.isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      console.warn("Falha ao salvar no localStorage (provavelmente limite excedido):", e);
    }
  }, [state]);

  const syncToSheet = async (dataType: 'APARTMENT' | 'BUDGET' | 'EMPLOYEE' | 'EXTRA' | 'SECTOR' | 'INVENTORY' | 'INVENTORY_OP' | 'SUPPLIER' | 'CONFIG' | 'DELETE' | 'USER' | 'PARKING_LOCATION' | 'VEHICLE' | 'CHECKOUT_VEHICLE' | 'LINEN' | 'LINEN_OP' | 'LINEN_MONTHLY', data: any, newFiles?: any[], hotelOverride?: HotelType, isFullSync?: boolean) => {
    try {
      const apiUrl = `${GLOBAL_API_URL}/action`;
      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hotel: hotelOverride || state.currentHotel,
          dataType,
          isFullSync,
          ...data,
          newFiles
        })
      });
    } catch (e) {
      console.error("Erro na sincronização:", e);
    }
  };

  const currentHotelData = state.hotels[state.currentHotel];

  const handleLogin = (user: User) => {
    const targetHotel = user.hotel || state.currentHotel;
    setState(prev => ({ ...prev, currentUser: user, currentHotel: targetHotel }));
    if (user.role === 'GESTOR') {
      loadDataFromSheet(targetHotel);
    }
  };
  const handleLogout = () => setState(prev => ({ ...prev, currentUser: null, currentView: ViewType.DASHBOARD }));
  
  const handleViewChange = (view: ViewType) => setState(prev => ({ 
    ...prev, 
    currentView: view,
    selectedFloor: null,
    selectedApartmentId: null,
    selectedSectorId: null
  }));

  const handleHotelChange = (hotel: HotelType) => {
    setState(prev => ({ ...prev, currentHotel: hotel }));
    loadDataFromSheet(hotel);
  };

  const handleSaveApartment = (apt: Apartment, newFiles?: any[]) => {
    setState(prev => ({
      ...prev,
      hotels: {
        ...prev.hotels,
        [prev.currentHotel]: {
          ...prev.hotels[prev.currentHotel],
          apartments: { ...prev.hotels[prev.currentHotel].apartments, [apt.id]: apt }
        }
      }
    }));
    
    const aptToSync = {
      ...apt,
      customAnswers: JSON.stringify(apt.customAnswers || {})
    };
    syncToSheet('APARTMENT', aptToSync, newFiles);
  };

  const handleSaveBudget = (budget: Budget, newFiles?: any[]) => {
    const existing = currentHotelData.budgets.find(b => b.id === budget.id);
    const newBudgets = existing 
      ? currentHotelData.budgets.map(b => b.id === budget.id ? budget : b)
      : [...currentHotelData.budgets, budget];
    
    setState(prev => ({
      ...prev,
      hotels: {
        ...prev.hotels,
        [prev.currentHotel]: { ...prev.hotels[prev.currentHotel], budgets: newBudgets }
      }
    }));
    // Pass newFiles to syncToSheet so they can be uploaded to Drive
    syncToSheet('BUDGET', budget, newFiles);
  };

  const handleDeleteBudget = (id: string) => {
    setState(prev => ({
      ...prev,
      hotels: {
        ...prev.hotels,
        [prev.currentHotel]: {
          ...prev.hotels[prev.currentHotel],
          budgets: prev.hotels[prev.currentHotel].budgets.filter(b => b.id !== id)
        }
      }
    }));
    syncToSheet('DELETE', { id, targetType: 'BUDGET' });
  };

  const handleSaveEmployee = (emp: Employee, newFiles?: any[]) => {
    const existing = currentHotelData.employees.find(e => e.id === emp.id);
    const newEmps = existing 
      ? currentHotelData.employees.map(e => e.id === emp.id ? emp : e)
      : [...currentHotelData.employees, emp];
    
    setState(prev => ({
      ...prev,
      hotels: {
        ...prev.hotels,
        [prev.currentHotel]: { ...prev.hotels[prev.currentHotel], employees: newEmps }
      }
    }));
    // Pass newFiles (photo) to syncToSheet
    syncToSheet('EMPLOYEE', emp, newFiles);
  };

  const handleDeleteEmployee = (id: string) => {
    setState(prev => ({
      ...prev,
      hotels: {
        ...prev.hotels,
        [prev.currentHotel]: {
          ...prev.hotels[prev.currentHotel],
          employees: prev.hotels[prev.currentHotel].employees.filter(e => e.id !== id)
        }
      }
    }));
    syncToSheet('DELETE', { id, targetType: 'EMPLOYEE' });
  };

  const handleSaveExtra = (extra: ExtraLabor) => {
    const existing = currentHotelData.extras.find(e => e.id === extra.id);
    const newExtras = existing 
      ? currentHotelData.extras.map(e => e.id === extra.id ? extra : e)
      : [...currentHotelData.extras, extra];
    
    setState(prev => ({
      ...prev,
      hotels: {
        ...prev.hotels,
        [prev.currentHotel]: { ...prev.hotels[prev.currentHotel], extras: newExtras }
      }
    }));
    syncToSheet('EXTRA', extra);
  };

  const handleDeleteExtra = (id: string) => {
    setState(prev => ({
      ...prev,
      hotels: {
        ...prev.hotels,
        [prev.currentHotel]: {
          ...prev.hotels[prev.currentHotel],
          extras: prev.hotels[prev.currentHotel].extras.filter(e => e.id !== id)
        }
      }
    }));
    syncToSheet('DELETE', { id, targetType: 'EXTRA' });
  };

  const handleSaveSector = (sec: Sector) => {
    const existing = currentHotelData.sectors.find(s => s.id === sec.id);
    const newSectors = existing 
      ? currentHotelData.sectors.map(s => s.id === sec.id ? sec : s)
      : [...currentHotelData.sectors, sec];
    
    setState(prev => ({
      ...prev,
      hotels: {
        ...prev.hotels,
        [prev.currentHotel]: { ...prev.hotels[prev.currentHotel], sectors: newSectors }
      }
    }));
    syncToSheet('SECTOR', sec);
  };

  const handleDeleteSector = (id: string) => {
    setState(prev => ({
      ...prev,
      hotels: {
        ...prev.hotels,
        [prev.currentHotel]: {
          ...prev.hotels[prev.currentHotel],
          sectors: prev.hotels[prev.currentHotel].sectors.filter(s => s.id !== id)
        }
      }
    }));
    syncToSheet('DELETE', { id, targetType: 'SECTOR' });
  };

  const handleSaveInventoryItem = (item: InventoryItem) => {
    const existing = currentHotelData.inventory.find(i => i.id === item.id);
    const newInv = existing 
      ? currentHotelData.inventory.map(i => i.id === item.id ? item : i)
      : [...currentHotelData.inventory, item];
    
    setState(prev => ({
      ...prev,
      hotels: {
        ...prev.hotels,
        [prev.currentHotel]: { ...prev.hotels[prev.currentHotel], inventory: newInv }
      }
    }));
    syncToSheet('INVENTORY', item);
  };

  const handleDeleteInventoryItem = (id: string) => {
    setState(prev => ({
      ...prev,
      hotels: {
        ...prev.hotels,
        [prev.currentHotel]: {
          ...prev.hotels[prev.currentHotel],
          inventory: prev.hotels[prev.currentHotel].inventory.filter(i => i.id !== id)
        }
      }
    }));
    syncToSheet('DELETE', { id, targetType: 'INVENTORY' });
  };

  const handleInventoryOperation = (op: InventoryOperation) => {
    const item = currentHotelData.inventory.find(i => i.id === op.itemId);
    if (!item) return;
    
    const newQty = op.type === 'Entrada' ? item.quantity + op.quantity : item.quantity - op.quantity;
    const newItem = { ...item, quantity: newQty, lastUpdate: Date.now() };
    
    setState(prev => ({
      ...prev,
      hotels: {
        ...prev.hotels,
        [prev.currentHotel]: {
          ...prev.hotels[prev.currentHotel],
          inventory: prev.hotels[prev.currentHotel].inventory.map(i => i.id === op.itemId ? newItem : i),
          inventoryHistory: [op, ...prev.hotels[prev.currentHotel].inventoryHistory].slice(0, 100)
        }
      }
    }));
    syncToSheet('INVENTORY_OP', op);
  };

  const getLinenStatusField = (status?: LinenStockStatus): keyof LinenItem | null => {
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

  const handleSaveLinenItem = (item: LinenItem) => {
    const existing = (currentHotelData.linenItems || []).find(i => i.id === item.id);
    const newItems = existing
      ? (currentHotelData.linenItems || []).map(i => i.id === item.id ? item : i)
      : [...(currentHotelData.linenItems || []), item];

    setState(prev => ({
      ...prev,
      hotels: {
        ...prev.hotels,
        [prev.currentHotel]: { ...prev.hotels[prev.currentHotel], linenItems: newItems }
      }
    }));
    syncToSheet('LINEN', item);
  };

  const handleSaveLinenSettings = (linenSettings: LinenHotelSettings) => {
    const newConfig = {
      ...(currentHotelData.config || { showSuppliersTab: true }),
      linenSettings
    };
    setState(prev => ({
      ...prev,
      hotels: {
        ...prev.hotels,
        [prev.currentHotel]: { ...prev.hotels[prev.currentHotel], config: newConfig }
      }
    }));
    syncToSheet('CONFIG', newConfig);
  };

  const handleSaveLinenMonthlyInventory = (inventory: LinenMonthlyInventory) => {
    const updatedItems = (currentHotelData.linenItems || []).map(item => {
      const counted = inventory.items.find(entry => entry.itemId === item.id);
      if (!counted) return item;
      return {
        ...item,
        inventoryModelVersion: 2,
        quantityClean: 0,
        quantityInUse: counted.quantityInUse,
        quantityDirty: 0,
        quantityLaundry: 0,
        quantityStained: counted.quantityStained,
        quantityTorn: counted.quantityTorn,
        quantityDamaged: counted.quantityDamaged,
        quantityLost: counted.quantityLost,
        lastUpdate: inventory.timestamp
      };
    });
    const existing = (currentHotelData.linenMonthlyInventories || []).some(item => item.id === inventory.id);
    const inventories = existing
      ? (currentHotelData.linenMonthlyInventories || []).map(item => item.id === inventory.id ? inventory : item)
      : [...(currentHotelData.linenMonthlyInventories || []), inventory];

    setState(prev => ({
      ...prev,
      hotels: {
        ...prev.hotels,
        [prev.currentHotel]: {
          ...prev.hotels[prev.currentHotel],
          linenItems: updatedItems,
          linenMonthlyInventories: inventories.sort((a, b) => a.month.localeCompare(b.month))
        }
      }
    }));
    syncToSheet('LINEN_MONTHLY', inventory);
  };

  const handleDeleteLinenItem = (id: string) => {
    setState(prev => ({
      ...prev,
      hotels: {
        ...prev.hotels,
        [prev.currentHotel]: {
          ...prev.hotels[prev.currentHotel],
          linenItems: (prev.hotels[prev.currentHotel].linenItems || []).filter(item => item.id !== id)
        }
      }
    }));
    syncToSheet('DELETE', { id, targetType: 'LINEN' });
  };

  const handleLinenOperation = (operation: LinenOperation) => {
    const currentItems = (currentHotelData.linenItems || []).map(normalizeLinenItemV2);
    const sourceItem = currentItems.find(i => i.id === operation.itemId);
    if (!sourceItem) return;

    const quantity = Number(operation.quantity) || 0;
    if (quantity <= 0) return;

    const originField = getLinenStatusField(operation.fromStatus);
    const destinationField = getLinenStatusField(operation.toStatus);
    const sourceUpdated: LinenItem = { ...sourceItem, inventoryModelVersion: 2, lastUpdate: Date.now() };

    if (originField) {
      const current = Number(sourceUpdated[originField]) || 0;
      if (current < quantity) return;
      (sourceUpdated[originField] as number) = current - quantity;
    }
    if (destinationField) {
      const current = Number(sourceUpdated[destinationField]) || 0;
      (sourceUpdated[destinationField] as number) = current + quantity;
    }

    let updatedItems = currentItems.map(item => item.id === sourceUpdated.id ? sourceUpdated : item);

    if (operation.type === 'Reciclagem' && operation.generatedItemId) {
      const generatedQuantity = Number(operation.generatedQuantity) || 0;
      if (generatedQuantity <= 0) return;
      updatedItems = updatedItems.map(item => item.id === operation.generatedItemId
        ? { ...item, inventoryModelVersion: 2, quantityInUse: (Number(item.quantityInUse) || 0) + generatedQuantity, lastUpdate: Date.now() }
        : item
      );
    }

    setState(prev => ({
      ...prev,
      hotels: {
        ...prev.hotels,
        [prev.currentHotel]: {
          ...prev.hotels[prev.currentHotel],
          linenItems: updatedItems,
          linenHistory: [operation, ...(prev.hotels[prev.currentHotel].linenHistory || [])].slice(0, 500)
        }
      }
    }));
    syncToSheet('LINEN_OP', operation);
  };

  const handleSaveSupplier = (sup: Supplier) => {
    const existing = currentHotelData.suppliers.find(s => s.id === sup.id);
    const newSups = existing 
      ? currentHotelData.suppliers.map(s => s.id === sup.id ? sup : s)
      : [...currentHotelData.suppliers, sup];
    
    setState(prev => ({
      ...prev,
      hotels: {
        ...prev.hotels,
        [prev.currentHotel]: { ...prev.hotels[prev.currentHotel], suppliers: newSups }
      }
    }));
    syncToSheet('SUPPLIER', sup);
  };

  const handleDeleteSupplier = (id: string) => {
    setState(prev => ({
      ...prev,
      hotels: {
        ...prev.hotels,
        [prev.currentHotel]: {
          ...prev.hotels[prev.currentHotel],
          suppliers: prev.hotels[prev.currentHotel].suppliers.filter(s => s.id !== id)
        }
      }
    }));
    syncToSheet('DELETE', { id, targetType: 'SUPPLIER' });
  };

  const handleUpdateConfig = (config: any) => {
    setState(prev => {
      const newConfig = { ...prev.hotels[prev.currentHotel].config, ...config };
      // Sincroniza o objeto de config inteiro para que reflita corretamente na planilha
      syncToSheet('CONFIG', newConfig);
      return {
        ...prev,
        hotels: {
          ...prev.hotels,
          [prev.currentHotel]: {
            ...prev.hotels[prev.currentHotel],
            config: newConfig
          }
        }
      };
    });
  };

  const handleUpdateIntegration = (integration: Integration) => {
    setState(prev => ({
      ...prev,
      integrations: prev.integrations.map(i => i.id === integration.id ? integration : i)
    }));
  };

  const handleSaveUser = (user: User) => {
    const targetHotel = user.hotel || state.currentHotel;
    setState(prev => {
      const hotelData = prev.hotels[targetHotel];
      const existingUsers = hotelData.users || [];
      const updatedUsers = existingUsers.find(u => u.id === user.id)
        ? existingUsers.map(u => u.id === user.id ? user : u)
        : [...existingUsers, user];
      
      return {
        ...prev,
        hotels: {
          ...prev.hotels,
          [targetHotel]: {
            ...hotelData,
            users: updatedUsers
          }
        }
      };
    });
    syncToSheet('USER', { ...user, allowedTabs: JSON.stringify(user.allowedTabs || []) }, undefined, targetHotel);
  };

  const handleDeleteUser = (userId: string) => {
    setState(prev => {
      const hotelData = prev.hotels[prev.currentHotel];
      const existingUsers = hotelData.users || [];
      return {
        ...prev,
        hotels: {
          ...prev.hotels,
          [prev.currentHotel]: {
            ...hotelData,
            users: existingUsers.filter(u => u.id !== userId)
          }
        }
      };
    });
    syncToSheet('DELETE', { id: userId, targetType: 'USER' });
  };

  const handleSaveParkingLocation = (location: ParkingLocation) => {
    setState(prev => {
      const hotelData = prev.hotels[prev.currentHotel];
      const existingLocations = hotelData.parkingLocations || [];
      const updatedLocations = existingLocations.find(l => l.id === location.id)
        ? existingLocations.map(l => l.id === location.id ? location : l)
        : [...existingLocations, location];
      
      return {
        ...prev,
        hotels: {
          ...prev.hotels,
          [prev.currentHotel]: {
            ...hotelData,
            parkingLocations: updatedLocations
          }
        }
      };
    });
    syncToSheet('PARKING_LOCATION', location);
  };

  const handleDeleteParkingLocation = (locationId: string) => {
    setState(prev => {
      const hotelData = prev.hotels[prev.currentHotel];
      const existingLocations = hotelData.parkingLocations || [];
      return {
        ...prev,
        hotels: {
          ...prev.hotels,
          [prev.currentHotel]: {
            ...hotelData,
            parkingLocations: existingLocations.filter(l => l.id !== locationId)
          }
        }
      };
    });
    syncToSheet('DELETE', { id: locationId, targetType: 'PARKING_LOCATION' });
  };

  const handleSaveVehicle = (vehicle: Vehicle, newFiles?: any[]) => {
    setState(prev => {
      const hotelData = prev.hotels[prev.currentHotel];
      const existingVehicles = hotelData.vehicles || [];
      const updatedVehicles = existingVehicles.find(v => v.id === vehicle.id)
        ? existingVehicles.map(v => v.id === vehicle.id ? vehicle : v)
        : [...existingVehicles, vehicle];
      
      return {
        ...prev,
        hotels: {
          ...prev.hotels,
          [prev.currentHotel]: {
            ...hotelData,
            vehicles: updatedVehicles
          }
        }
      };
    });
    syncToSheet('VEHICLE', { ...vehicle, photos: JSON.stringify(vehicle.photos || []), history: JSON.stringify(vehicle.history || []) }, newFiles);
  };

  const handleDeleteVehicle = (id: string) => {
    setState(prev => {
      const hotelData = prev.hotels[prev.currentHotel];
      return {
        ...prev,
        hotels: {
          ...prev.hotels,
          [prev.currentHotel]: {
            ...hotelData,
            vehicles: (hotelData.vehicles || []).filter(v => v.id !== id)
          }
        }
      };
    });
    syncToSheet('DELETE', { id, targetType: 'VEHICLE' });
  };

  const handleCheckoutVehicle = (id: string, history?: any[]) => {
    let finalHistory: any[] = [];
    setState(prev => {
      const hotelData = prev.hotels[prev.currentHotel];
      const existingVehicles = hotelData.vehicles || [];
      const updatedVehicles = existingVehicles.map(v => {
        if (v.id === id) {
          finalHistory = history || v.history || [];
          return { ...v, is_active: false, check_out_date: new Date().toISOString(), history: finalHistory };
        }
        return v;
      });
      return {
        ...prev,
        hotels: {
          ...prev.hotels,
          [prev.currentHotel]: {
            ...hotelData,
            vehicles: updatedVehicles
          }
        }
      };
    });
    syncToSheet('CHECKOUT_VEHICLE', { id, history: JSON.stringify(finalHistory) });
  };

  const renderContent = () => {
    if (state.selectedApartmentId) {
      let apt = currentHotelData.apartments[state.selectedApartmentId];
      if (!apt) {
        // Safe parsing for both formats: "203" or "200-203"
        const parts = state.selectedApartmentId.split('-');
        let roomNumberRes = 0;
        let floorRes = 0;
        
        if (parts.length === 2) {
          floorRes = parseInt(parts[0]);
          roomNumberRes = parseInt(parts[1]);
        } else {
          roomNumberRes = parseInt(state.selectedApartmentId);
          floorRes = Math.floor(roomNumberRes / 100) * 100;
        }

        apt = {
          id: state.selectedApartmentId,
          floor: floorRes,
          roomNumber: roomNumberRes,
          defects: [],
          beds: [],
          moveisDetalhes: []
        };
      }
      return (
        <ApartmentDetailView 
          apartment={apt} 
          theme={theme} 
          onBack={() => setState(prev => ({ ...prev, selectedApartmentId: null }))} 
          onSave={handleSaveApartment}
          checklistConfig={state.hotels[state.currentHotel].config?.apartmentChecklist || []}
        />
      );
    }

    if (state.selectedFloor) {
      return (
        <FloorDetailView 
          floor={state.selectedFloor} 
          theme={theme} 
          apartments={currentHotelData.apartments} 
          onBack={() => setState(prev => ({ ...prev, selectedFloor: null }))}
          onSelectApartment={(id) => setState(prev => ({ ...prev, selectedApartmentId: id }))}
        />
      );
    }

    switch (state.currentView) {
      case ViewType.DASHBOARD:
        return (
          <Dashboard 
            apartments={currentHotelData.apartments} 
            employees={currentHotelData.employees} 
            inventory={currentHotelData.inventory}
            sectors={currentHotelData.sectors}
            theme={theme} 
            lastSync={state.integrations[0].lastSync} 
            onRefresh={() => loadDataFromSheet()} 
            isRefreshing={isRefreshing} 
            onNavigate={(view) => setState(prev => ({ ...prev, currentView: view }))}
            onOpenApartment={(id) => {
               setState(prev => ({ ...prev, currentView: ViewType.APARTMENTS, selectedApartmentId: id }));
            }}
          />
        );
      case ViewType.APARTMENTS:
        return (
          <ApartmentsView 
            onSelectFloor={(floor) => setState(prev => ({ ...prev, selectedFloor: floor }))} 
            theme={theme} 
            hotelName={state.currentHotel}
            apartments={currentHotelData.apartments}
            onSelectApartment={(id) => setState(prev => ({ ...prev, selectedApartmentId: id }))}
          />
        );
      case ViewType.BUDGETS:
        return <BudgetsView budgets={currentHotelData.budgets} theme={theme} onSave={handleSaveBudget} onDelete={handleDeleteBudget} />;
      case ViewType.EMPLOYEES:
        return (
          <EmployeesView 
            employees={currentHotelData.employees} 
            extras={currentHotelData.extras}
            sectors={currentHotelData.sectors} 
            inventoryHistory={currentHotelData.inventoryHistory}
            selectedSectorId={state.selectedSectorId} 
            onSelectSector={(id) => setState(prev => ({ ...prev, selectedSectorId: id }))} 
            theme={theme} 
            onSave={handleSaveEmployee} 
            onDelete={handleDeleteEmployee} 
            onSaveExtra={handleSaveExtra}
            onDeleteExtra={handleDeleteExtra}
            onSaveSector={handleSaveSector} 
            onDeleteSector={handleDeleteSector} 
          />
        );
      case ViewType.INVENTORY:
        return (
          <InventoryView 
            inventory={currentHotelData.inventory} 
            history={currentHotelData.inventoryHistory} 
            suppliers={currentHotelData.suppliers}
            employees={currentHotelData.employees} 
            extras={currentHotelData.extras}
            sectors={currentHotelData.sectors}
            showSuppliersTab={currentHotelData.config?.showSuppliersTab} 
            theme={theme} 
            onSave={handleSaveInventoryItem} 
            onDelete={handleDeleteInventoryItem} 
            onOperation={handleInventoryOperation} 
            onSaveSupplier={handleSaveSupplier} 
            onDeleteSupplier={handleDeleteSupplier}
            onSaveSector={handleSaveSector}
            onDeleteSector={handleDeleteSector}
            onSaveExtra={handleSaveExtra}
            role={state.currentUser?.role} 
            currentUser={state.currentUser?.name} 
          />
        );
      case ViewType.LINEN:
        return (
          <LinenView
            items={currentHotelData.linenItems || []}
            history={currentHotelData.linenHistory || []}
            monthlyInventories={currentHotelData.linenMonthlyInventories || []}
            settings={currentHotelData.config?.linenSettings}
            registeredApartmentsCount={Object.keys(currentHotelData.apartments || {}).length}
            theme={theme}
            currentUser={state.currentUser?.name}
            onSave={handleSaveLinenItem}
            onDelete={handleDeleteLinenItem}
            onOperation={handleLinenOperation}
            onSaveSettings={handleSaveLinenSettings}
            onSaveMonthlyInventory={handleSaveLinenMonthlyInventory}
          />
        );
      case ViewType.REPORTS:
        return <ReportsView apartments={currentHotelData.apartments} theme={theme} onSelectApartment={(id) => setState(prev => ({ ...prev, selectedApartmentId: id }))} />;
      case ViewType.TODAY_SCHEDULE:
        return <TodayScheduleView employees={currentHotelData.employees} theme={theme} />;
      case ViewType.SETTINGS:
        return (
          <SettingsView 
            integrations={state.integrations} 
            hotelConfig={currentHotelData.config} 
            onUpdateConfig={handleUpdateConfig} 
            theme={theme} 
            currentHotel={state.currentHotel}
            suppliers={currentHotelData.suppliers} 
            onSaveSupplier={handleSaveSupplier} 
            onDeleteSupplier={handleDeleteSupplier} 
            onUpdate={handleUpdateIntegration} 
            users={currentHotelData.users || []}
            onSaveUser={handleSaveUser}
            onDeleteUser={handleDeleteUser}
            parkingLocations={currentHotelData.parkingLocations || []}
            onSaveParkingLocation={handleSaveParkingLocation}
            onDeleteParkingLocation={handleDeleteParkingLocation}
            onForceSyncFromSheets={() => loadDataFromSheet(state.currentHotel, true)}
            isDarkMode={state.isDarkMode || false}
            onToggleDarkMode={(val) => setState(prev => ({ ...prev, isDarkMode: val }))}
          />
        );
      case ViewType.PARKING:
        return (
          <ParkingView 
            theme={theme} 
            parkingLocations={currentHotelData.parkingLocations} 
            vehicles={currentHotelData.vehicles || []}
            currentUser={state.currentUser}
            onSaveVehicle={handleSaveVehicle}
            onDeleteVehicle={handleDeleteVehicle}
            onCheckoutVehicle={handleCheckoutVehicle}
            onSaveParkingLocation={handleSaveParkingLocation}
            onDeleteParkingLocation={handleDeleteParkingLocation}
            onRefresh={() => loadDataFromSheet()}
            isRefreshing={isRefreshing}
          />
        );
      default:
        return <Dashboard apartments={currentHotelData.apartments} employees={currentHotelData.employees} theme={theme} />;
    }
  };

  const handleGoogleLogin = async (email: string, name: string, hotel: HotelType) => {
    try {
      const hotelData = await loadDataFromSheet(hotel);
      
      const user = hotelData.users?.find((u: any) => u.email === email);
      if (user) {
        if (user.status === 'PENDING') {
          return { success: false, message: 'Seu acesso está pendente de aprovação pelo Gestor.' };
        } else {
          handleLogin({ ...user, hotel });
          return { success: true };
        }
      } else {
        const newUser: User = {
          id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: name,
          email: email,
          password: '',
          role: 'FUNCIONARIO',
          status: 'PENDING',
          allowedTabs: [],
          hotel: hotel
        };
        handleSaveUser(newUser);
        return { success: false, message: 'Solicitação de acesso enviada! Aguarde a aprovação do Gestor.' };
      }
    } catch (error: any) {
      console.error("Google Login Error:", error);
      return { success: false, message: error.message || 'Erro ao conectar com o servidor' };
    }
  };

  if (!state.currentUser) {
    return <Login onLogin={handleLogin} onFetchHotelData={loadDataFromSheet} onGoogleLogin={handleGoogleLogin} />;
  }

  return (
      <div className={`min-h-screen flex flex-col md:flex-row transition-colors duration-300 ${state.isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
        <Sidebar 
          currentView={state.currentView} 
          onViewChange={handleViewChange} 
          currentHotel={state.currentHotel} 
          onHotelChange={handleHotelChange} 
          onLogout={handleLogout} 
          theme={theme} 
          user={state.currentUser} 
          lastDataSource={state.lastDataSource}
          visibleTabs={currentHotelData.config?.visibleTabs}
        />
        
        <main className="flex-1 p-4 md:p-8 md:ml-64 mb-20 md:mb-0 transition-all duration-300">
          <header className="flex justify-between items-center mb-8 md:hidden">
            <div className="flex items-center gap-3">
              <Logo className="h-10" themeColor={theme.primary} />
              {state.lastDataSource && (
                <span className={`text-[8px] uppercase px-1.5 py-0.5 rounded-full font-bold tracking-wider shadow-sm flex items-center gap-1 ${
                  state.lastDataSource === 'SUPABASE' ? 'bg-emerald-500 text-white' : 
                  state.lastDataSource === 'SHEETS' ? 'bg-sky-500 text-white' : 'bg-amber-500 text-white'
                }`}>
                  {state.lastDataSource === 'SUPABASE' ? 'Cloud' : 'Planilha'}
                </span>
              )}
            </div>
            <div className="px-3 py-1 bg-white dark:bg-slate-800 rounded-full border dark:border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{state.currentHotel}</div>
          </header>
          
          {/* Dashboard Badge for Desktop */}
          <div className="hidden md:flex justify-end mb-4 px-4 h-0 items-start">
             {state.lastDataSource && (
                <div className={`text-[9px] uppercase px-2 py-1 rounded-bl-xl font-black tracking-widest shadow-sm flex items-center gap-2 border-l border-b ${
                  state.isDarkMode ? 'border-slate-700' : 'border-slate-200'
                } ${
                  state.lastDataSource === 'SUPABASE' ? 'text-emerald-500' : 'text-sky-500'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${state.lastDataSource === 'SUPABASE' ? 'bg-emerald-500' : 'bg-sky-500'}`}></div>
                  FONTE: {state.lastDataSource === 'SUPABASE' ? 'SUPABASE CLOUD' : 'GOOGLE SHEETS'}
                </div>
             )}
          </div>

          {renderContent()}
        </main>

      <BottomNav 
        currentView={state.currentView} 
        onViewChange={handleViewChange} 
        theme={theme} 
        user={state.currentUser} 
        visibleTabs={currentHotelData.config?.visibleTabs}
      />
    </div>
  );
};

export default App;
