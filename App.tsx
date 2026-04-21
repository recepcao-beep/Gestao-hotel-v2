
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ViewType, AppState, Apartment, Budget, Employee, Integration, HotelType, HotelData, HotelTheme, User, Sector, InventoryItem, InventoryOperation, Supplier, ExtraLabor, ParkingLocation, Vehicle } from './types';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import Dashboard from './components/Dashboard';
import ApartmentsView from './components/ApartmentsView';
import FloorDetailView from './components/FloorDetailView';
import ApartmentDetailView from './components/ApartmentDetailView';
import BudgetsView from './components/BudgetsView';
import EmployeesView from './components/EmployeesView';
import InventoryView from './components/InventoryView';
import ReportsView from './components/ReportsView';
import SettingsView from './components/SettingsView';
import ParkingView from './components/ParkingView';
import Login from './components/Login';

const GLOBAL_API_URL = "/api/sheets";

const getInitialHotelData = (): HotelData => ({
  apartments: {},
  budgets: [],
  employees: [],
  extras: [],
  inventory: [],
  inventoryHistory: [],
  suppliers: [],
  sectors: [
    { id: '1', name: 'Recepção', standardUniform: [{ name: 'Camisa Social', quantity: 2 }, { name: 'Calça Social', quantity: 2 }] },
    { id: '2', name: 'Governança', standardUniform: [{ name: 'Jaleco', quantity: 3 }, { name: 'Calça Branca', quantity: 2 }] },
    { id: '3', name: 'Rouparia', standardUniform: [{ name: 'Camiseta Logotipo', quantity: 3 }, { name: 'Bermuda Tactel', quantity: 2 }] },
  ],
  config: {
    showSuppliersTab: true
  }
});

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const safeJSONParse = (value: any, defaultValue: any) => {
  if (typeof value === 'string' && value.trim() !== '') {
    const trimmed = value.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        console.warn(`Failed to parse JSON: ${value}`, e);
        return defaultValue;
      }
    }
  }
  return value || defaultValue;
};

const safeGetTime = (val: any) => {
  if (!val) return Date.now();
  if (typeof val === 'number') return val;
  if (val instanceof Date) return isNaN(val.getTime()) ? Date.now() : val.getTime();
  
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
  
  return Date.now();
};

const App: React.FC = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const initialSyncRef = useRef(false);
  
  const [state, setState] = useState<AppState>(() => {
    // Incrementado para V45 para garantir limpeza de cache e compatibilidade
    const saved = localStorage.getItem('hotel_village_state_v45');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...parsed, currentUser: null };
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

  const loadDataFromSheet = useCallback(async (hotelOverride?: HotelType) => {
    const targetHotel = hotelOverride || state.currentHotel;
    setIsRefreshing(true);
    try {
      // Usa URL da API local
      const apiUrl = `${GLOBAL_API_URL}/load`;
      const fetchUrl = `${apiUrl}?hotel=${targetHotel}&nocache=${Date.now()}`;
      
      const response = await fetch(fetchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result && result.status === 'success') {
        const incomingData = result.data;
        
        // NORMALIZAÇÃO RIGOROSA DE FUNCIONÁRIOS
        const rawEmployees = Array.isArray(incomingData.employees) ? incomingData.employees : [];
        const normalizedEmployees = rawEmployees.map((emp: any) => {
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
            id: emp.id?.toString() || '',
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
        });

        // NORMALIZAÇÃO DE EXTRAS
        const rawExtras = Array.isArray(incomingData.extras) ? incomingData.extras : [];
        const normalizedExtras = rawExtras.map((ext: any) => ({
          ...ext,
          id: ext.id?.toString() || '',
          name: ext.name || '',
          phone: ext.phone || '',
          availability: safeJSONParse(ext.availability, []),
          serviceQuality: parseFloat(ext.serviceQuality) || 0,
          sectorId: ext.sectorId?.toString() || '',
          observation: ext.observation || ''
        }));

        const rawSectors = Array.isArray(incomingData.sectors) ? incomingData.sectors : [];
        const normalizedSectors = rawSectors.map((sec: any) => ({
          ...sec,
          id: sec.id?.toString() || '',
          name: sec.name || 'Setor Sem Nome',
          standardUniform: safeJSONParse(sec.standardUniform, [])
        }));

        // NORMALIZAÇÃO DE ORÇAMENTOS
        const rawBudgets = Array.isArray(incomingData.budgets) ? incomingData.budgets : [];
        const normalizedBudgets = rawBudgets.map((b: any) => ({
          ...b,
          id: b.id?.toString() || '',
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
        }));

        // NORMALIZAÇÃO DE ESTOQUE
        const rawInventory = Array.isArray(incomingData.inventory) ? incomingData.inventory : [];
        const normalizedInventory = rawInventory.map((inv: any) => ({
            ...inv,
            id: inv.id?.toString(),
            quantity: parseFloat(inv.quantity) || 0,
            price: parseFloat(inv.price) || 0,
            lastUpdate: safeGetTime(inv.lastUpdate),
            sectorId: inv.sectorId?.toString() || '' // Parse sectorId
        }));

        const rawInventoryHistory = Array.isArray(incomingData.inventoryHistory) ? incomingData.inventoryHistory : [];
        const normalizedInventoryHistory = rawInventoryHistory.map((op: any) => ({
            ...op,
            id: op.id?.toString(),
            quantity: parseFloat(op.quantity) || 0,
            timestamp: safeGetTime(op.timestamp),
            recipientName: op.recipientName || ''
        }));

        const rawSuppliers = Array.isArray(incomingData.suppliers) ? incomingData.suppliers : [];
        const normalizedSuppliers = rawSuppliers.map((s: any) => ({
            ...s,
            id: s.id?.toString()
        }));

        const rawVehicles = Array.isArray(incomingData.vehicles) ? incomingData.vehicles : [];
        const normalizedVehicles = rawVehicles.map((v: any) => ({
            ...v,
            id: v.id?.toString(),
            is_on_trip: v.is_on_trip === true || v.is_on_trip === 'true',
            payment_pending: v.payment_pending === true || v.payment_pending === 'true',
            is_active: v.is_active === true || v.is_active === 'true',
            photos: safeJSONParse(v.photos, [])
        }));

        const rawUsers = Array.isArray(incomingData.users) ? incomingData.users : [];
        const normalizedUsers = rawUsers.map((u: any) => ({
            ...u,
            id: u.id?.toString(),
            name: u.name?.toString() || '',
            password: u.password?.toString() || '',
            allowedTabs: safeJSONParse(u.allowedTabs, []),
            email: u.email?.toString() || '',
            status: u.status?.toString() || 'APPROVED',
            hotel: targetHotel
        }));
        console.log("Normalized users:", normalizedUsers);

        const rawParkingLocations = Array.isArray(incomingData.parkingLocations) ? incomingData.parkingLocations : [];
        const normalizedParkingLocations = rawParkingLocations.map((l: any) => ({
            ...l,
            id: l.id?.toString(),
            totalSpots: parseInt(l.totalSpots) || 0
        }));

        let normalizedConfig = incomingData.config;
        if (typeof normalizedConfig === 'string') {
          try {
            normalizedConfig = JSON.parse(normalizedConfig);
          } catch (e) {
            normalizedConfig = { showSuppliersTab: true };
          }
        }

        const normalizedApartments: Record<string, Apartment> = {};
        Object.entries(incomingData.apartments || {}).forEach(([id, apt]: [string, any]) => {
          normalizedApartments[id] = {
            ...apt,
            defects: Array.isArray(apt.defects) ? apt.defects : [],
            beds: Array.isArray(apt.beds) ? apt.beds : [],
            moveisDetalhes: Array.isArray(apt.moveisDetalhes) ? apt.moveisDetalhes : [],
            customAnswers: safeJSONParse(apt.customAnswers, {})
          };
        });

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
    } catch (e) {
      console.warn("Falha ao salvar no localStorage (provavelmente limite excedido):", e);
    }
  }, [state]);

  const syncToSheet = async (dataType: 'APARTMENT' | 'BUDGET' | 'EMPLOYEE' | 'EXTRA' | 'SECTOR' | 'INVENTORY' | 'INVENTORY_OP' | 'SUPPLIER' | 'CONFIG' | 'DELETE' | 'USER' | 'PARKING_LOCATION' | 'VEHICLE' | 'CHECKOUT_VEHICLE', data: any, newFiles?: any[], hotelOverride?: HotelType) => {
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
        const parts = state.selectedApartmentId.split('-');
        const floor = parseInt(parts[0]);
        const roomNumber = parseInt(parts[1]);
        apt = {
          id: state.selectedApartmentId,
          floor,
          roomNumber,
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
            role={state.currentUser?.role} 
            currentUser={state.currentUser?.name} 
          />
        );
      case ViewType.REPORTS:
        return <ReportsView apartments={currentHotelData.apartments} theme={theme} onSelectApartment={(id) => setState(prev => ({ ...prev, selectedApartmentId: id }))} />;
      case ViewType.SETTINGS:
        return (
          <SettingsView 
            integrations={state.integrations} 
            hotelConfig={currentHotelData.config} 
            onUpdateConfig={handleUpdateConfig} 
            theme={theme} 
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
          id: `user_${Date.now()}`,
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
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <Sidebar 
        currentView={state.currentView} 
        onViewChange={handleViewChange} 
        currentHotel={state.currentHotel} 
        onHotelChange={handleHotelChange} 
        onLogout={handleLogout} 
        theme={theme} 
        user={state.currentUser} 
      />
      
      <main className="flex-1 p-4 md:p-8 md:ml-64 mb-20 md:mb-0 transition-all duration-300">
        <header className="flex justify-between items-center mb-8 md:hidden">
          <h1 className="text-2xl font-black text-slate-800 tracking-tighter">Nacional Inn</h1>
          <div className="px-3 py-1 bg-white rounded-full border text-[10px] font-bold text-slate-400 uppercase tracking-widest">{state.currentHotel}</div>
        </header>
        {renderContent()}
      </main>

      <BottomNav 
        currentView={state.currentView} 
        onViewChange={handleViewChange} 
        theme={theme} 
        user={state.currentUser} 
      />
    </div>
  );
};

export default App;
