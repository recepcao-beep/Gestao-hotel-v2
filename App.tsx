
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

const App: React.FC = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('hotel_village_state_v24');
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
    if (!GLOBAL_SCRIPT_URL) return;
    setIsRefreshing(true);
    const targetHotel = hotelOverride || state.currentHotel;
    try {
      const response = await fetch(`${GLOBAL_SCRIPT_URL}?hotel=${targetHotel}&t=${Date.now()}`, { method: 'GET', mode: 'cors' });
      const data = await response.json();
      if (data && data.status === 'success') {
        // NORMALIZAÇÃO: Garantir que IDs de setor sejam sempre strings para comparação correta
        const normalizedEmployees = (data.data.employees || []).map((emp: any) => ({
          ...emp,
          sectorId: emp.sectorId ? emp.sectorId.toString() : ''
        }));

        const normalizedSectors = (data.data.sectors || []).map((sec: any) => ({
          ...sec,
          id: sec.id ? sec.id.toString() : ''
        }));

        const mergedData = {
          ...data.data,
          employees: normalizedEmployees,
          sectors: normalizedSectors.length > 0 ? normalizedSectors : state.hotels[targetHotel].sectors
        };

        setState(prev => ({
          ...prev,
          hotels: {
            ...prev.hotels,
            [targetHotel]: {
              ...prev.hotels[targetHotel],
              ...mergedData
            }
          },
          integrations: prev.integrations.map(i => i.id === 'global-sync' ? { ...i, lastSync: Date.now(), status: 'Connected' } : i)
        }));
        return mergedData;
      }
    } catch (error) { 
      console.warn("Erro ao carregar dados da planilha:", error); 
    } finally { 
      setIsRefreshing(false); 
    }
  }, [state.currentHotel, state.hotels]);

  // Carregamento inicial exaustivo para evitar que o login inicie vazio
  useEffect(() => {
    const init = async () => {
      await loadDataFromSheet('VILLAGE');
      await loadDataFromSheet('GOLDEN_PARK');
      await loadDataFromSheet('THERMAL_RESORT');
    };
    init();
  }, [loadDataFromSheet]);

  useEffect(() => { 
    if (state.currentUser) {
      loadDataFromSheet(); 
    }
  }, [state.currentUser, loadDataFromSheet]);

  useEffect(() => { 
    const stateToSave = { 
      ...state, 
      currentUser: state.currentUser, // Manter o usuário logado se quiser, mas aqui resetamos para login
      hotels: state.hotels 
    }; 
    localStorage.setItem('hotel_village_state_v24', JSON.stringify(stateToSave)); 
  }, [state]);

  const syncToSheet = async (dataType: 'APARTMENT' | 'BUDGET' | 'EMPLOYEE' | 'SECTOR' | 'INVENTORY' | 'INVENTORY_OP' | 'SUPPLIER' | 'CONFIG' | 'DELETE', data: any, files?: any[]) => {
    if (GLOBAL_SCRIPT_URL) {
      try {
        await fetch(GLOBAL_SCRIPT_URL, { 
          method: 'POST', 
          mode: 'no-cors', 
          body: JSON.stringify({ 
            dataType, 
            hotel: state.currentHotel, 
            ...data, 
            newFiles: files 
          }) 
        });
        setState(prev => ({ ...prev, integrations: prev.integrations.map(i => i.id === 'global-sync' ? { ...i, lastSync: Date.now() } : i) }));
        
        // RECARREGAR IMEDIATAMENTE após salvar funcionário
        if(dataType === 'EMPLOYEE' || dataType === 'SECTOR' || dataType === 'DELETE') {
           setTimeout(() => loadDataFromSheet(), 2000);
        }
      } catch (err) { 
        console.error('Falha na sincronização:', err); 
      }
    }
  };

  const handleUpdateConfig = (config: any) => {
    setState(prev => ({
      ...prev,
      hotels: {
        ...prev.hotels,
        [prev.currentHotel]: { ...prev.hotels[prev.currentHotel], config: { ...prev.hotels[prev.currentHotel].config, ...config } }
      }
    }));
    syncToSheet('CONFIG', config);
  };

  const handleSaveInventory = (item: InventoryItem) => {
    setState(prev => {
      const hotel = prev.hotels[prev.currentHotel];
      const exists = hotel.inventory.find(i => i.id === item.id);
      const newInventory = exists ? hotel.inventory.map(i => i.id === item.id ? item : i) : [...hotel.inventory, item];
      return { ...prev, hotels: { ...prev.hotels, [prev.currentHotel]: { ...hotel, inventory: newInventory } } };
    });
    syncToSheet('INVENTORY', item);
  };

  const handleDeleteInventory = (id: string) => {
    setState(prev => {
      const hotel = prev.hotels[prev.currentHotel];
      return { ...prev, hotels: { ...prev.hotels, [prev.currentHotel]: { ...hotel, inventory: hotel.inventory.filter(i => i.id !== id) } } };
    });
    syncToSheet('DELETE', { targetType: 'INVENTORY', id });
  };

  const handleSaveSupplier = (supplier: Supplier) => {
    setState(prev => {
      const hotel = prev.hotels[prev.currentHotel];
      const exists = hotel.suppliers.find(s => s.id === supplier.id);
      const newSuppliers = exists ? hotel.suppliers.map(s => s.id === supplier.id ? supplier : s) : [...hotel.suppliers, supplier];
      return { ...prev, hotels: { ...prev.hotels, [prev.currentHotel]: { ...hotel, suppliers: newSuppliers } } };
    });
    syncToSheet('SUPPLIER', supplier);
  };

  const handleDeleteSupplier = (id: string) => {
    setState(prev => {
      const hotel = prev.hotels[prev.currentHotel];
      return { ...prev, hotels: { ...prev.hotels, [prev.currentHotel]: { ...hotel, suppliers: hotel.suppliers.filter(s => s.id !== id) } } };
    });
    syncToSheet('DELETE', { targetType: 'SUPPLIER', id });
  };

  const handleLogin = (user: User) => {
    setState(prev => {
      const nextView = user.role === 'FUNCIONARIO' ? ViewType.APARTMENTS : ViewType.DASHBOARD;
      return { 
        ...prev, 
        currentUser: user,
        currentHotel: user.hotel || prev.currentHotel,
        currentView: nextView
      };
    });
  };

  const currentHotelData = state.hotels[state.currentHotel];

  const renderContent = () => {
    if (state.currentView === ViewType.APARTMENTS) {
      if (state.selectedApartmentId) {
        const aptId = state.selectedApartmentId;
        const apt = currentHotelData.apartments[aptId] || { id: aptId, floor: parseInt(aptId.split('-')[0]), roomNumber: parseInt(aptId.split('-')[1]), defects: [] };
        return (
          <ApartmentDetailView 
            apartment={apt} 
            theme={theme} 
            onBack={() => setState(prev => ({...prev, selectedApartmentId: null}))} 
            onSave={(updatedApt, files) => { 
              setState(prev => ({
                ...prev, 
                hotels: {
                  ...prev.hotels, 
                  [prev.currentHotel]: {
                    ...prev.hotels[prev.currentHotel], 
                    apartments: {
                      ...prev.hotels[prev.currentHotel].apartments, 
                      [updatedApt.id]: updatedApt
                    }
                  }
                }
              })); 
              syncToSheet('APARTMENT', updatedApt, files); 
            }} 
          />
        );
      }
      if (state.selectedFloor !== null) {
        return <FloorDetailView floor={state.selectedFloor} theme={theme} apartments={currentHotelData.apartments} onBack={() => setState(prev => ({ ...prev, selectedFloor: null }))} onSelectApartment={id => setState(prev => ({...prev, selectedApartmentId: id}))} />;
      }
      return <ApartmentsView onSelectFloor={f => setState(prev => ({...prev, selectedFloor: f}))} theme={theme} hotelName={state.currentHotel} />;
    }
    if (state.currentView === ViewType.BUDGETS) return <BudgetsView budgets={currentHotelData.budgets} theme={theme} onSave={(b, f) => { setState(prev => ({...prev, hotels: {...prev.hotels, [prev.currentHotel]: {...prev.hotels[prev.currentHotel], budgets: prev.hotels[prev.currentHotel].budgets.find(ex => ex.id === b.id) ? prev.hotels[prev.currentHotel].budgets.map(ex => ex.id === b.id ? b : ex) : [b, ...prev.hotels[prev.currentHotel].budgets]}}})); syncToSheet('BUDGET', b, f); }} onDelete={(id) => { setState(prev => ({...prev, hotels: {...prev.hotels, [prev.currentHotel]: {...prev.hotels[prev.currentHotel], budgets: prev.hotels[prev.currentHotel].budgets.filter(b => b.id !== id)}}})); syncToSheet('DELETE', { targetType: 'BUDGET', id }); }} />;
    if (state.currentView === ViewType.EMPLOYEES) return <EmployeesView employees={currentHotelData.employees} sectors={currentHotelData.sectors} selectedSectorId={state.selectedSectorId} onSelectSector={id => setState(prev => ({...prev, selectedSectorId: id}))} theme={theme} onSave={(e) => { setState(prev => ({...prev, hotels: {...prev.hotels, [prev.currentHotel]: {...prev.hotels[prev.currentHotel], employees: prev.hotels[prev.currentHotel].employees.find(ex => ex.id === e.id) ? prev.hotels[prev.currentHotel].employees.map(ex => ex.id === e.id ? e : ex) : [e, ...prev.hotels[prev.currentHotel].employees]}}})); syncToSheet('EMPLOYEE', e); }} onDelete={(id) => { setState(prev => ({...prev, hotels: {...prev.hotels, [prev.currentHotel]: {...prev.hotels[prev.currentHotel], employees: prev.hotels[prev.currentHotel].employees.filter(e => e.id !== id)}}})); syncToSheet('DELETE', { targetType: 'EMPLOYEE', id }); }} onSaveSector={(s) => { setState(prev => ({...prev, hotels: {...prev.hotels, [prev.currentHotel]: {...prev.hotels[prev.currentHotel], sectors: prev.hotels[prev.currentHotel].sectors.find(ex => ex.id === s.id) ? prev.hotels[prev.currentHotel].sectors.map(ex => ex.id === s.id ? s : ex) : [...prev.hotels[prev.currentHotel].sectors, s]}}})); syncToSheet('SECTOR', s); }} onDeleteSector={(id) => { setState(prev => ({...prev, hotels: {...prev.hotels, [prev.currentHotel]: {...prev.hotels[prev.currentHotel], sectors: prev.hotels[prev.currentHotel].sectors.filter(s => s.id !== id)}}})); syncToSheet('DELETE', { targetType: 'SECTOR', id }); }} />;
    if (state.currentView === ViewType.INVENTORY) return <InventoryView inventory={currentHotelData.inventory} history={currentHotelData.inventoryHistory} suppliers={currentHotelData.suppliers} showSuppliersTab={currentHotelData.config?.showSuppliersTab} theme={theme} onSave={handleSaveInventory} onDelete={handleDeleteInventory} onOperation={(op) => { setState(prev => { const hotel = prev.hotels[prev.currentHotel]; const item = hotel.inventory.find(i => i.id === op.itemId); if (!item) return prev; const newQuantity = op.type === 'Entrada' ? item.quantity + op.quantity : item.quantity - op.quantity; const updatedItem = { ...item, quantity: newQuantity, lastUpdate: Date.now() }; return { ...prev, hotels: { ...prev.hotels, [prev.currentHotel]: { ...hotel, inventory: hotel.inventory.map(i => i.id === op.itemId ? updatedItem : i), inventoryHistory: [op, ...hotel.inventoryHistory] } } }; }); syncToSheet('INVENTORY_OP', op); }} onSaveSupplier={handleSaveSupplier} onDeleteSupplier={handleDeleteSupplier} role={state.currentUser?.role} currentUser={state.currentUser?.name} />;
    if (state.currentView === ViewType.REPORTS) return <ReportsView apartments={currentHotelData.apartments} theme={theme} onSelectApartment={id => setState(prev => ({ ...prev, currentView: ViewType.APARTMENTS, selectedApartmentId: id }))} />;
    if (state.currentView === ViewType.SETTINGS) return <SettingsView integrations={state.integrations} hotelConfig={currentHotelData.config} onUpdateConfig={handleUpdateConfig} theme={theme} suppliers={currentHotelData.suppliers} onSaveSupplier={handleSaveSupplier} onDeleteSupplier={handleDeleteSupplier} onUpdate={i => setState(prev => ({...prev, integrations: prev.integrations.map(existing => existing.id === i.id ? i : existing)}))} />;
    if (state.currentView === ViewType.DASHBOARD) return <Dashboard apartments={currentHotelData.apartments} employees={currentHotelData.employees} theme={theme} lastSync={state.integrations[0].lastSync} onRefresh={() => loadDataFromSheet()} isRefreshing={isRefreshing} />;
    return null;
  };

  if (!state.currentUser) return <Login onLogin={handleLogin} onFetchHotelData={loadDataFromSheet} />;
  return (
    <div className="flex flex-col md:flex-row min-h-screen" style={{ backgroundColor: theme.bg }}>
      <Sidebar 
        currentView={state.currentView} 
        onViewChange={v => setState(prev => ({...prev, currentView: v, selectedFloor: null, selectedApartmentId: null}))} 
        currentHotel={state.currentHotel} 
        onHotelChange={h => setState(prev => ({...prev, currentHotel: h}))} 
        onLogout={() => setState(prev => ({...prev, currentUser: null}))} 
        theme={theme} 
        role={state.currentUser.role} 
        sectorId={state.currentUser.sectorId}
        sectorName={state.currentUser.sectorName}
      />
      <BottomNav 
        currentView={state.currentView} 
        onViewChange={v => setState(prev => ({...prev, currentView: v, selectedFloor: null, selectedApartmentId: null}))} 
        theme={theme} 
        role={state.currentUser.role} 
        sectorId={state.currentUser.sectorId}
        sectorName={state.currentUser.sectorName}
      />
      <main className={`flex-1 transition-all duration-300 p-4 md:p-8 ${state.selectedApartmentId ? 'p-0' : ''} mb-20 md:mb-0 md:ml-64`}>
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
