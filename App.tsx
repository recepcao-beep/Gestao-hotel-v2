
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ViewType, AppState, Apartment, Budget, Employee, Integration, HotelType, HotelData, HotelTheme, User, Sector, InventoryItem, InventoryOperation, Supplier, ExtraLabor } from './types';
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
import Login from './components/Login';

const GLOBAL_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyHwnTqgnBMecAsscAIJgpfe7gHPwjWbZ42qbm3EvXvX_oq9WzbrrT99knh7L4wdvDe4g/exec";

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

const App: React.FC = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const initialSyncRef = useRef(false);
  
  const [state, setState] = useState<AppState>(() => {
    // Incrementado para V41 para garantir limpeza de cache e nova sincronização
    const saved = localStorage.getItem('hotel_village_state_v41');
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
          url: GLOBAL_SCRIPT_URL
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
      // Usa URL do estado se disponível, senão usa a constante
      const scriptUrl = state.integrations[0]?.url || GLOBAL_SCRIPT_URL;
      const fetchUrl = `${scriptUrl}?hotel=${targetHotel}&nocache=${Date.now()}`;
      
      const response = await fetch(fetchUrl, {
        method: 'GET',
        mode: 'cors',
        redirect: 'follow'
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const result = await response.json();
      
      if (result && result.status === 'success') {
        const incomingData = result.data;
        
        // NORMALIZAÇÃO RIGOROSA DE FUNCIONÁRIOS
        const normalizedEmployees = (incomingData.employees || []).map((emp: any) => {
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
            uniforms: typeof emp.uniforms === 'string' ? JSON.parse(emp.uniforms) : (emp.uniforms || [])
          };
        });

        // NORMALIZAÇÃO DE EXTRAS
        const normalizedExtras = (incomingData.extras || []).map((ext: any) => ({
          ...ext,
          id: ext.id?.toString() || '',
          name: ext.name || '',
          phone: ext.phone || '',
          availability: typeof ext.availability === 'string' ? JSON.parse(ext.availability) : (ext.availability || []),
          serviceQuality: parseFloat(ext.serviceQuality) || 0,
          sectorId: ext.sectorId?.toString() || '',
          observation: ext.observation || ''
        }));

        const normalizedSectors = (incomingData.sectors || []).map((sec: any) => ({
          ...sec,
          id: sec.id?.toString() || '',
          name: sec.name || 'Setor Sem Nome',
          standardUniform: typeof sec.standardUniform === 'string' ? JSON.parse(sec.standardUniform) : (sec.standardUniform || [])
        }));

        // NORMALIZAÇÃO DE ORÇAMENTOS
        const normalizedBudgets = (incomingData.budgets || []).map((b: any) => ({
          ...b,
          id: b.id?.toString() || '',
          title: b.title || 'Sem Título',
          objective: b.objective || '',
          items: (typeof b.items === 'string' ? JSON.parse(b.items) : (b.items || [])).map((it: any) => ({
            ...it,
            description: it.description || 'Serviço',
            materials: (it.materials || []).map((m: any) => ({
              ...m,
              quotes: m.quotes || [{ supplier: '', value: 0 }, { supplier: '', value: 0 }, { supplier: '', value: 0 }]
            }))
          })),
          quotes: typeof b.quotes === 'string' ? JSON.parse(b.quotes) : (b.quotes || []),
          createdAt: typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : (b.createdAt || Date.now())
        }));

        // NORMALIZAÇÃO DE ESTOQUE
        const normalizedInventory = (incomingData.inventory || []).map((inv: any) => ({
            ...inv,
            id: inv.id?.toString(),
            quantity: parseFloat(inv.quantity) || 0,
            price: parseFloat(inv.price) || 0,
            lastUpdate: inv.lastUpdate ? new Date(inv.lastUpdate).getTime() : Date.now()
        }));

        const normalizedInventoryHistory = (incomingData.inventoryHistory || []).map((op: any) => ({
            ...op,
            id: op.id?.toString(),
            quantity: parseFloat(op.quantity) || 0,
            timestamp: op.timestamp ? new Date(op.timestamp).getTime() : Date.now()
        }));

        const normalizedSuppliers = (incomingData.suppliers || []).map((s: any) => ({
            ...s,
            id: s.id?.toString()
        }));

        const normalizedApartments: Record<string, Apartment> = {};
        Object.entries(incomingData.apartments || {}).forEach(([id, apt]: [string, any]) => {
          normalizedApartments[id] = {
            ...apt,
            defects: Array.isArray(apt.defects) ? apt.defects : [],
            beds: Array.isArray(apt.beds) ? apt.beds : [],
            moveisDetalhes: Array.isArray(apt.moveisDetalhes) ? apt.moveisDetalhes : []
          };
        });

        setState(prev => ({
          ...prev,
          hotels: {
            ...prev.hotels,
            [targetHotel]: {
              ...prev.hotels[targetHotel],
              ...incomingData,
              apartments: normalizedApartments,
              employees: normalizedEmployees,
              extras: normalizedExtras,
              sectors: normalizedSectors,
              budgets: normalizedBudgets,
              inventory: normalizedInventory,
              inventoryHistory: normalizedInventoryHistory,
              suppliers: normalizedSuppliers
            }
          },
          integrations: prev.integrations.map(i => i.id === 'global-sync' ? { ...i, lastSync: Date.now(), status: 'Connected' } : i)
        }));
        return incomingData;
      }
    } catch (error) { 
      console.warn(`Erro ao carregar ${targetHotel}:`, error);
    } finally { 
      setIsRefreshing(false); 
    }
    return null;
  }, [state.currentHotel, state.integrations]);

  useEffect(() => {
    if (initialSyncRef.current) return;
    initialSyncRef.current = true;
    const runSync = async () => {
      await loadDataFromSheet(state.currentHotel);
      const others = (['VILLAGE', 'GOLDEN_PARK', 'THERMAL_RESORT'] as HotelType[]).filter(h => h !== state.currentHotel);
      for (const h of others) {
        await delay(4500);
        await loadDataFromSheet(h);
      }
    };
    runSync();
  }, [loadDataFromSheet, state.currentHotel]);

  useEffect(() => { 
    localStorage.setItem('hotel_village_state_v41', JSON.stringify(state)); 
  }, [state]);

  const syncToSheet = async (dataType: 'APARTMENT' | 'BUDGET' | 'EMPLOYEE' | 'EXTRA' | 'SECTOR' | 'INVENTORY' | 'INVENTORY_OP' | 'SUPPLIER' | 'CONFIG' | 'DELETE', data: any, newFiles?: any[]) => {
    try {
      const scriptUrl = state.integrations[0]?.url || GLOBAL_SCRIPT_URL;
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
          hotel: state.currentHotel,
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

  const handleLogin = (user: User) => setState(prev => ({ ...prev, currentUser: user }));
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
    syncToSheet('APARTMENT', apt, newFiles);
  };

  const handleSaveBudget = (budget: Budget) => {
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
    syncToSheet('BUDGET', budget);
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

  const handleSaveEmployee = (emp: Employee) => {
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
    syncToSheet('EMPLOYEE', emp);
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
    setState(prev => ({
      ...prev,
      hotels: {
        ...prev.hotels,
        [prev.currentHotel]: {
          ...prev.hotels[prev.currentHotel],
          config: { ...prev.hotels[prev.currentHotel].config, ...config }
        }
      }
    }));
    syncToSheet('CONFIG', config);
  };

  const handleUpdateIntegration = (integration: Integration) => {
    setState(prev => ({
      ...prev,
      integrations: prev.integrations.map(i => i.id === integration.id ? integration : i)
    }));
  };

  const renderContent = () => {
    if (state.selectedApartmentId) {
      const apt = currentHotelData.apartments[state.selectedApartmentId];
      if (apt) {
        return (
          <ApartmentDetailView 
            apartment={apt} 
            theme={theme} 
            onBack={() => setState(prev => ({ ...prev, selectedApartmentId: null }))} 
            onSave={handleSaveApartment}
          />
        );
      }
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
        return <Dashboard apartments={currentHotelData.apartments} employees={currentHotelData.employees} theme={theme} lastSync={state.integrations[0].lastSync} onRefresh={() => loadDataFromSheet()} isRefreshing={isRefreshing} />;
      case ViewType.APARTMENTS:
        return <ApartmentsView onSelectFloor={(floor) => setState(prev => ({ ...prev, selectedFloor: floor }))} theme={theme} hotelName={state.currentHotel} />;
      case ViewType.BUDGETS:
        return <BudgetsView budgets={currentHotelData.budgets} theme={theme} onSave={handleSaveBudget} onDelete={handleDeleteBudget} />;
      case ViewType.EMPLOYEES:
        return (
          <EmployeesView 
            employees={currentHotelData.employees} 
            extras={currentHotelData.extras}
            sectors={currentHotelData.sectors} 
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
            showSuppliersTab={currentHotelData.config?.showSuppliersTab} 
            theme={theme} 
            onSave={handleSaveInventoryItem} 
            onDelete={handleDeleteInventoryItem} 
            onOperation={handleInventoryOperation} 
            onSaveSupplier={handleSaveSupplier} 
            onDeleteSupplier={handleDeleteSupplier} 
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
          />
        );
      default:
        return <Dashboard apartments={currentHotelData.apartments} employees={currentHotelData.employees} theme={theme} />;
    }
  };

  if (!state.currentUser) {
    return <Login onLogin={handleLogin} onFetchHotelData={loadDataFromSheet} />;
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
        role={state.currentUser.role} 
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
        role={state.currentUser.role} 
      />
    </div>
  );
};

export default App;
