
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ViewType, AppState, Apartment, Budget, Employee, Integration, HotelType, HotelData, HotelTheme, User, Sector, InventoryItem, InventoryOperation, Supplier } from './types';
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
    const saved = localStorage.getItem('hotel_village_state_v33');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...parsed, currentUser: null };
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
      const scriptUrl = GLOBAL_SCRIPT_URL;
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
        
        const normalizedEmployees = (incomingData.employees || []).map((emp: any) => ({
          ...emp,
          id: emp.id?.toString() || '',
          sectorId: emp.sectorId?.toString() || '',
          uniforms: typeof emp.uniforms === 'string' ? JSON.parse(emp.uniforms) : (emp.uniforms || [])
        }));

        const normalizedSectors = (incomingData.sectors || []).map((sec: any) => ({
          ...sec,
          id: sec.id?.toString() || '',
          standardUniform: typeof sec.standardUniform === 'string' ? JSON.parse(sec.standardUniform) : (sec.standardUniform || [])
        }));

        const normalizedBudgets = (incomingData.budgets || []).map((b: any) => ({
          ...b,
          id: b.id?.toString() || '',
          items: (typeof b.items === 'string' ? JSON.parse(b.items) : (b.items || [])).map((it: any) => ({
            ...it,
            serviceProvider: it.serviceProvider || '',
            estimatedTime: it.estimatedTime || ''
          })),
          quotes: typeof b.quotes === 'string' ? JSON.parse(b.quotes) : (b.quotes || []),
          createdAt: typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : (b.createdAt || Date.now())
        }));

        setState(prev => ({
          ...prev,
          hotels: {
            ...prev.hotels,
            [targetHotel]: {
              ...prev.hotels[targetHotel],
              ...incomingData,
              employees: normalizedEmployees,
              sectors: normalizedSectors,
              budgets: normalizedBudgets
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
  }, [state.currentHotel]);

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
    localStorage.setItem('hotel_village_state_v33', JSON.stringify(state)); 
  }, [state]);

  const syncToSheet = async (dataType: 'APARTMENT' | 'BUDGET' | 'EMPLOYEE' | 'SECTOR' | 'INVENTORY' | 'INVENTORY_OP' | 'SUPPLIER' | 'CONFIG' | 'DELETE', data: any, files?: any[]) => {
    try {
      await fetch(GLOBAL_SCRIPT_URL, { 
        method: 'POST', 
        mode: 'no-cors', 
        body: JSON.stringify({ dataType, hotel: state.currentHotel, ...data, newFiles: files }) 
      });
      setState(prev => ({ ...prev, integrations: prev.integrations.map(i => i.id === 'global-sync' ? { ...i, lastSync: Date.now() } : i) }));
      if(['EMPLOYEE', 'SECTOR', 'DELETE', 'BUDGET', 'APARTMENT'].includes(dataType)) {
         setTimeout(() => loadDataFromSheet(), 4000);
      }
    } catch (err) { 
      console.error('Erro no envio:', err);
    }
  };

  const handleLogin = (user: User) => {
    setState(prev => ({ 
      ...prev, 
      currentUser: user,
      currentHotel: user.hotel || prev.currentHotel,
      currentView: user.role === 'FUNCIONARIO' ? ViewType.APARTMENTS : ViewType.DASHBOARD,
      selectedFloor: null,
      selectedApartmentId: null
    }));
    if (user.hotel) setTimeout(() => loadDataFromSheet(user.hotel), 500);
  };

  const currentHotelData = state.hotels[state.currentHotel];

  const renderContent = () => {
    if (state.currentView === ViewType.APARTMENTS) {
      if (state.selectedApartmentId) {
        const aptId = state.selectedApartmentId;
        const apt = currentHotelData.apartments[aptId] || { id: aptId, floor: parseInt(aptId.split('-')[0]), roomNumber: parseInt(aptId.split('-')[1]), defects: [] };
        return <ApartmentDetailView apartment={apt} theme={theme} onBack={() => setState(prev => ({...prev, selectedApartmentId: null}))} onSave={(updatedApt, files) => { setState(prev => ({...prev, hotels: {...prev.hotels, [prev.currentHotel]: {...prev.hotels[prev.currentHotel], apartments: {...prev.hotels[prev.currentHotel].apartments, [updatedApt.id]: updatedApt}}}})); syncToSheet('APARTMENT', updatedApt, files); }} />;
      }
      if (state.selectedFloor !== null) return <FloorDetailView floor={state.selectedFloor} theme={theme} apartments={currentHotelData.apartments} onBack={() => setState(prev => ({ ...prev, selectedFloor: null }))} onSelectApartment={id => setState(prev => ({...prev, selectedApartmentId: id}))} />;
      return <ApartmentsView onSelectFloor={f => setState(prev => ({...prev, selectedFloor: f}))} theme={theme} hotelName={state.currentHotel} />;
    }
    if (state.currentView === ViewType.BUDGETS) return <BudgetsView budgets={currentHotelData.budgets} theme={theme} onSave={(b, f) => { setState(prev => { const hotel = prev.hotels[prev.currentHotel]; const exists = hotel.budgets.find(ex => ex.id === b.id); return { ...prev, hotels: { ...prev.hotels, [prev.currentHotel]: { ...hotel, budgets: exists ? hotel.budgets.map(ex => ex.id === b.id ? b : ex) : [b, ...hotel.budgets] } } }; }); syncToSheet('BUDGET', b, f); }} onDelete={(id) => { setState(prev => ({ ...prev, hotels: { ...prev.hotels, [prev.currentHotel]: { ...prev.hotels[prev.currentHotel], budgets: prev.hotels[prev.currentHotel].budgets.filter(b => b.id !== id) } } })); syncToSheet('DELETE', { targetType: 'BUDGET', id }); }} />;
    // Fix: In the onSaveSector callback below, replaced 'x.id' with 'ex.id' to correctly reference the map iterator variable
    if (state.currentView === ViewType.EMPLOYEES) return <EmployeesView employees={currentHotelData.employees} sectors={currentHotelData.sectors} selectedSectorId={state.selectedSectorId} onSelectSector={id => setState(prev => ({...prev, selectedSectorId: id}))} theme={theme} onSave={(e) => { setState(prev => ({...prev, hotels: {...prev.hotels, [prev.currentHotel]: {...prev.hotels[prev.currentHotel], employees: prev.hotels[prev.currentHotel].employees.find(ex => ex.id === e.id) ? prev.hotels[prev.currentHotel].employees.map(ex => ex.id === e.id ? e : ex) : [e, ...prev.hotels[prev.currentHotel].employees]}}})); syncToSheet('EMPLOYEE', e); }} onDelete={(id) => { setState(prev => ({...prev, hotels: {...prev.hotels, [prev.currentHotel]: {...prev.hotels[prev.currentHotel], employees: prev.hotels[prev.currentHotel].employees.filter(e => e.id !== id)}}})); syncToSheet('DELETE', { targetType: 'EMPLOYEE', id }); }} onSaveSector={(s) => { setState(prev => ({...prev, hotels: {...prev.hotels, [prev.currentHotel]: {...prev.hotels[prev.currentHotel], sectors: prev.hotels[prev.currentHotel].sectors.find(ex => ex.id === s.id) ? prev.hotels[prev.currentHotel].sectors.map(ex => ex.id === s.id ? s : ex) : [...prev.hotels[prev.currentHotel].sectors, s]}}})); syncToSheet('SECTOR', s); }} onDeleteSector={(id) => { setState(prev => ({...prev, hotels: {...prev.hotels, [prev.currentHotel]: {...prev.hotels[prev.currentHotel], sectors: prev.hotels[prev.currentHotel].sectors.filter(s => s.id !== id)}}})); syncToSheet('DELETE', { targetType: 'SECTOR', id }); }} />;
    if (state.currentView === ViewType.INVENTORY) return <InventoryView inventory={currentHotelData.inventory} history={currentHotelData.inventoryHistory} suppliers={currentHotelData.suppliers} showSuppliersTab={currentHotelData.config?.showSuppliersTab} theme={theme} onSave={(item) => { setState(prev => { const hotel = prev.hotels[prev.currentHotel]; const exists = hotel.inventory.find(i => i.id === item.id); return { ...prev, hotels: { ...prev.hotels, [prev.currentHotel]: { ...hotel, inventory: exists ? hotel.inventory.map(i => i.id === item.id ? item : i) : [...hotel.inventory, item] } } }; }); syncToSheet('INVENTORY', item); }} onDelete={(id) => { setState(prev => { const hotel = prev.hotels[prev.currentHotel]; return { ...prev, hotels: { ...prev.hotels, [prev.currentHotel]: { ...hotel, inventory: hotel.inventory.filter(i => i.id !== id) } } }; }); syncToSheet('DELETE', { targetType: 'INVENTORY', id }); }} onOperation={(op) => { setState(prev => { const hotel = prev.hotels[prev.currentHotel]; const item = hotel.inventory.find(i => i.id === op.itemId); if (!item) return prev; const updatedItem = { ...item, quantity: op.type === 'Entrada' ? item.quantity + op.quantity : item.quantity - op.quantity, lastUpdate: Date.now() }; return { ...prev, hotels: { ...prev.hotels, [prev.currentHotel]: { ...hotel, inventory: hotel.inventory.map(i => i.id === op.itemId ? updatedItem : i), inventoryHistory: [op, ...hotel.inventoryHistory] } } }; }); syncToSheet('INVENTORY_OP', op); }} onSaveSupplier={(supplier) => { setState(prev => { const hotel = prev.hotels[prev.currentHotel]; const exists = hotel.suppliers.find(s => s.id === supplier.id); return { ...prev, hotels: { ...prev.hotels, [prev.currentHotel]: { ...hotel, suppliers: exists ? hotel.suppliers.map(s => s.id === supplier.id ? supplier : s) : [...hotel.suppliers, supplier] } } }; }); syncToSheet('SUPPLIER', supplier); }} onDeleteSupplier={(id) => { setState(prev => { const hotel = prev.hotels[prev.currentHotel]; return { ...prev, hotels: { ...prev.hotels, [prev.currentHotel]: { ...hotel, suppliers: hotel.suppliers.filter(s => s.id !== id) } } }; }); syncToSheet('DELETE', { targetType: 'SUPPLIER', id }); }} role={state.currentUser?.role} currentUser={state.currentUser?.name} />;
    if (state.currentView === ViewType.REPORTS) return <ReportsView apartments={currentHotelData.apartments} theme={theme} onSelectApartment={id => setState(prev => ({ ...prev, currentView: ViewType.APARTMENTS, selectedApartmentId: id }))} />;
    if (state.currentView === ViewType.SETTINGS) return <SettingsView integrations={state.integrations} hotelConfig={currentHotelData.config} onUpdateConfig={(config) => { setState(prev => ({ ...prev, hotels: { ...prev.hotels, [prev.currentHotel]: { ...prev.hotels[prev.currentHotel], config: { ...prev.hotels[prev.currentHotel].config, ...config } } } })); syncToSheet('CONFIG', config); }} theme={theme} suppliers={currentHotelData.suppliers} onSaveSupplier={(supplier) => { setState(prev => { const hotel = prev.hotels[prev.currentHotel]; const exists = hotel.suppliers.find(s => s.id === supplier.id); return { ...prev, hotels: { ...prev.hotels, [prev.currentHotel]: { ...hotel, suppliers: exists ? hotel.suppliers.map(s => s.id === supplier.id ? supplier : s) : [...hotel.suppliers, supplier] } } }; }); syncToSheet('SUPPLIER', supplier); }} onDeleteSupplier={(id) => { setState(prev => { const hotel = prev.hotels[prev.currentHotel]; return { ...prev, hotels: { ...prev.hotels, [prev.currentHotel]: { ...hotel, suppliers: hotel.suppliers.filter(s => s.id !== id) } } }; }); syncToSheet('DELETE', { targetType: 'SUPPLIER', id }); }} onUpdate={i => setState(prev => ({...prev, integrations: prev.integrations.map(existing => existing.id === i.id ? i : existing)}))} />;
    if (state.currentView === ViewType.DASHBOARD) return <Dashboard apartments={currentHotelData.apartments} employees={currentHotelData.employees} theme={theme} lastSync={state.integrations[0].lastSync} onRefresh={() => loadDataFromSheet()} isRefreshing={isRefreshing} />;
    return null;
  };

  if (!state.currentUser) return <Login onLogin={handleLogin} onFetchHotelData={loadDataFromSheet} />;
  return (
    <div className="flex flex-col md:flex-row min-h-screen" style={{ backgroundColor: theme.bg }}>
      <Sidebar currentView={state.currentView} onViewChange={v => setState(prev => ({...prev, currentView: v, selectedFloor: null, selectedApartmentId: null}))} currentHotel={state.currentHotel} onHotelChange={h => { setState(prev => ({...prev, currentHotel: h})); loadDataFromSheet(h); }} onLogout={() => setState(prev => ({...prev, currentUser: null}))} theme={theme} role={state.currentUser.role} />
      <BottomNav currentView={state.currentView} onViewChange={v => setState(prev => ({...prev, currentView: v, selectedFloor: null, selectedApartmentId: null}))} theme={theme} role={state.currentUser.role} />
      <main className={`flex-1 transition-all duration-300 p-4 md:p-8 ${state.selectedApartmentId ? 'p-0' : ''} mb-20 md:mb-0 md:ml-64`}>
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
