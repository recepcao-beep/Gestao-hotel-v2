
import React, { useState } from 'react';
import { Integration, HotelTheme, Supplier, ParkingLocation, User, ViewType, HotelType } from '../types';
import IntegrationsView from './IntegrationsView';
import { Database, UserCircle, Shield, Sliders, ToggleLeft, ToggleRight, Truck, Plus, Trash2, Briefcase, User as UserIcon, X, Layout, GripVertical, Settings, Car, Users, RefreshCw, FileSpreadsheet, AlertCircle, ArrowRight } from 'lucide-react';
import { DEFAULT_CHECKLIST } from '../defaultChecklist';

interface SettingsViewProps {
  integrations: Integration[];
  hotelConfig?: {
    showSuppliersTab: boolean;
    apartmentChecklist?: any[]; // FormFieldConfig[]
    visibleTabs?: Record<string, boolean>;
  };
  onUpdateConfig: (config: any) => void;
  theme: HotelTheme;
  currentHotel: HotelType;
  suppliers: Supplier[];
  onSaveSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (id: string) => void;
  onUpdate: (integration: Integration) => void;
  parkingLocations?: ParkingLocation[];
  onSaveParkingLocation: (location: ParkingLocation) => void;
  onDeleteParkingLocation: (id: string) => void;
  users?: User[];
  onSaveUser: (user: User) => void;
  onDeleteUser: (id: string) => void;
  onForceSyncFromSheets?: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: (enabled: boolean) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ 
  integrations, 
  hotelConfig, 
  onUpdateConfig, 
  theme, 
  currentHotel,
  suppliers,
  onSaveSupplier,
  onDeleteSupplier,
  onUpdate,
  parkingLocations = [],
  onSaveParkingLocation,
  onDeleteParkingLocation,
  users = [],
  onSaveUser,
  onDeleteUser,
  onForceSyncFromSheets,
  isDarkMode,
  onToggleDarkMode
}) => {
  const [activeTab, setActiveTab] = useState<'INTEGRATION' | 'PROFILE' | 'FEATURES' | 'CHECKLIST' | 'USERS' | 'PARKING_SPOTS' | 'APPEARANCE' | 'MENU'>('INTEGRATION');
  
  const viewLabels: Record<string, string> = {
    [ViewType.DASHBOARD]: 'Geral (Dashboard)',
    [ViewType.APARTMENTS]: 'Apartamentos / Vistorias',
    [ViewType.BUDGETS]: 'Gerenciamento de Orçamentos',
    [ViewType.EMPLOYEES]: 'Pessoas / Funcionários',
    [ViewType.INVENTORY]: 'Controle de Estoque',
    [ViewType.LINEN]: 'Controle de Enxoval',
    [ViewType.REPORTS]: 'Relatórios e BI',
    [ViewType.TODAY_SCHEDULE]: 'Pauta do Dia',
    [ViewType.PARKING]: 'Estacionamento / Vagas',
    [ViewType.SETTINGS]: 'Configurações'
  };
  
  // Supplier management state
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supCategory, setSupCategory] = useState('');

  // Checklist management state
  const [isAddingField, setIsAddingField] = useState(false);
  const [editingField, setEditingField] = useState<any | null>(null);
  const [fieldTitle, setFieldTitle] = useState('');
  const [fieldType, setFieldType] = useState<'single_choice' | 'boolean' | 'text'>('boolean');
  const [fieldOptions, setFieldOptions] = useState<string>('');
  const [fieldColor, setFieldColor] = useState('text-purple-600');

  // Users management state
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userName, setUserName] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<'GESTOR' | 'FUNCIONARIO'>('FUNCIONARIO');
  const [userTabs, setUserTabs] = useState<ViewType[]>([]);
  const [userHotel, setUserHotel] = useState<HotelType | ''>('');

  const hotels: { id: HotelType; label: string }[] = [
    { id: 'VILLAGE', label: 'Village Inn' },
    { id: 'GOLDEN_PARK', label: 'Hotel Golden Park' },
    { id: 'THERMAL_RESORT', label: 'Thermas Resort' },
  ];

  // Parking Locations management state
  const [isAddingParkingLocation, setIsAddingParkingLocation] = useState(false);
  const [editingParkingLocation, setEditingParkingLocation] = useState<ParkingLocation | null>(null);
  const [parkingName, setParkingName] = useState('');
  const [parkingSpots, setParkingSpots] = useState('');

  // Migration state
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);
  const [showAdvancedMigration, setShowAdvancedMigration] = useState(false);

  const handleManualMigration = async () => {
    if (!window.confirm(`Isso irá copiar os dados do Google Sheets para o bancos de dados (Supabase) para o hotel ${currentHotel}. Deseja continuar?`)) return;
    
    setIsMigrating(true);
    setMigrationStatus("Iniciando migração...");
    try {
      const response = await fetch('/api/supabase/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotel: currentHotel })
      });
      const result = await response.json();
      if (result.status === 'success') {
        const detailStr = Object.entries(result.results || {})
          .map(([k, v]: any) => `${k}: ${v.count || v.status}`)
          .join(', ');
        setMigrationStatus(`Sucesso! Detalhes: ${detailStr}`);
        alert(`Sincronização concluída!\n\n${detailStr}`);
      } else {
        setMigrationStatus(`Erro: ${result.message}`);
      }
    } catch (e) {
      setMigrationStatus(`Erro de rede: ${e}`);
    } finally {
      setIsMigrating(false);
    }
  };

  const tabs = [
    { id: 'APPEARANCE', label: 'Aparência', icon: Sliders },
    { id: 'MENU', label: 'Ajustar Menu', icon: Layout },
    { id: 'INTEGRATION', label: 'Integração Global', icon: Database },
    { id: 'FEATURES', label: 'Funcionalidades', icon: Sliders },
    { id: 'CHECKLIST', label: 'Formulário de Vistoria', icon: Layout },
    { id: 'USERS', label: 'Usuários', icon: Users },
    { id: 'PROFILE', label: 'Perfil de Acesso', icon: UserCircle },
  ];

  const handleSaveSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSupplier({
      id: editingSupplier?.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: supName,
      contact: supContact,
      category: supCategory
    });
    setSupName('');
    setSupContact('');
    setSupCategory('');
    setIsAddingSupplier(false);
    setEditingSupplier(null);
  };

  const handleEditSupplier = (s: Supplier) => {
    setEditingSupplier(s);
    setSupName(s.name);
    setSupContact(s.contact);
    setSupCategory(s.category);
    setIsAddingSupplier(true);
  };

  const handleSaveFieldSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newField = {
      id: editingField?.id || `custom_${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title: fieldTitle,
      type: fieldType,
      color: fieldColor,
      icon: editingField?.icon || 'Layout',
      options: fieldType === 'single_choice' ? fieldOptions.split(',').map(s => s.trim()).filter(Boolean) : undefined
    };

    const currentChecklist = hotelConfig?.apartmentChecklist || DEFAULT_CHECKLIST;
    let updatedChecklist;
    
    if (editingField) {
      updatedChecklist = currentChecklist.map(f => f.id === editingField.id ? newField : f);
    } else {
      updatedChecklist = [...currentChecklist, newField];
    }

    onUpdateConfig({ ...hotelConfig, apartmentChecklist: updatedChecklist });
    
    setFieldTitle('');
    setFieldType('boolean');
    setFieldOptions('');
    setFieldColor('text-purple-600');
    setIsAddingField(false);
    setEditingField(null);
  };

  const handleSaveUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userHotel) {
      alert('Por favor, selecione a unidade para o usuário.');
      return;
    }
    const newUser: User = {
      id: editingUser?.id || `user_${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: userName,
      password: userPassword,
      role: userRole,
      allowedTabs: userTabs,
      hotel: userHotel as HotelType,
      email: editingUser?.email || '',
      status: 'APPROVED'
    };
    onSaveUser(newUser);
    setIsAddingUser(false);
    setEditingUser(null);
    setUserName('');
    setUserPassword('');
    setUserRole('FUNCIONARIO');
    setUserTabs([]);
    setUserHotel('');
  };

  const handleEditUser = (u: User) => {
    setEditingUser(u);
    setUserName(u.name || '');
    setUserPassword(u.password || '');
    setUserRole(u.role);
    setUserTabs(u.allowedTabs || []);
    setUserHotel(u.hotel || '');
    setIsAddingUser(true);
  };

  const handleSaveParkingLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newLocation: ParkingLocation = {
      id: editingParkingLocation?.id || `parking_${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: parkingName,
      totalSpots: parseInt(parkingSpots, 10) || 0
    };
    onSaveParkingLocation(newLocation);
    setIsAddingParkingLocation(false);
    setEditingParkingLocation(null);
    setParkingName('');
    setParkingSpots('');
  };

  const handleEditParkingLocation = (loc: ParkingLocation) => {
    setEditingParkingLocation(loc);
    setParkingName(loc.name);
    setParkingSpots(loc.totalSpots.toString());
    setIsAddingParkingLocation(true);
  };

  const handleEditField = (f: any) => {
    setEditingField(f);
    setFieldTitle(f.title);
    setFieldType(f.type);
    setFieldOptions(f.options ? f.options.join(', ') : '');
    setFieldColor(f.color || 'text-purple-600');
    setIsAddingField(true);
  };

  const handleDeleteField = (id: string) => {
    const currentChecklist = hotelConfig?.apartmentChecklist || DEFAULT_CHECKLIST;
    onUpdateConfig({ ...hotelConfig, apartmentChecklist: currentChecklist.filter(f => f.id !== id) });
  };

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row gap-4 md:gap-8">
        <aside className="w-full md:w-64 relative">
          <div className="flex md:flex-col overflow-x-auto md:overflow-x-visible pb-4 md:pb-0 space-x-2 md:space-x-0 md:space-y-2 sticky top-0 md:top-auto z-[40] md:relative bg-slate-50/90 backdrop-blur-md md:bg-transparent -mx-4 px-4 md:mx-0 md:px-0 py-3 md:py-0 border-b md:border-b-0 border-slate-200 md:border-transparent no-scrollbar touch-pan-x">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-shrink-0 flex items-center space-x-3 px-4 md:px-6 py-2.5 md:py-4 rounded-xl md:rounded-2xl transition-all font-bold text-[11px] md:text-sm whitespace-nowrap ${
                  activeTab === tab.id 
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-100' 
                  : 'text-slate-500 hover:bg-white/50 hover:text-slate-600 active:bg-slate-100'
                }`}
                style={{ 
                  borderColor: activeTab === tab.id ? theme.primary + '30' : undefined,
                  color: activeTab === tab.id ? theme.primary : undefined
                }}
              >
                <tab.icon size={14} className="md:w-[18px] md:h-[18px]" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
          {/* Mobile Scroll Indicator Fade */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-50 to-transparent z-[45] pointer-events-none md:hidden h-[54px]" />
        </aside>

        <div className="flex-1 min-w-0">
          {activeTab === 'MENU' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-sm border border-slate-100 dark:border-slate-700">
                  <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter mb-6 flex items-center gap-2">
                    <Layout className="text-indigo-500" /> Personalizar Visibilidade do Menu
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-8">
                    Selecione quais abas estarão visíveis no menu lateral para todos os usuários desta unidade.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {Object.entries(viewLabels).map(([view, label]) => {
                        if (view === ViewType.SETTINGS) return null;
                        
                        const isVisible = hotelConfig?.visibleTabs?.[view] !== false; 
                        
                        return (
                          <div 
                            key={view}
                            className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                          >
                            <div className="flex items-center gap-3">
                               <div className={`w-2 h-2 rounded-full ${isVisible ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300'}`} />
                               <span className={`text-xs font-black uppercase tracking-tight ${isVisible ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>
                                 {label}
                               </span>
                            </div>
                            <button 
                              onClick={() => {
                                const newVisibleTabs = { ...(hotelConfig?.visibleTabs || {}) };
                                newVisibleTabs[view] = !isVisible;
                                onUpdateConfig({ ...hotelConfig, visibleTabs: newVisibleTabs });
                              }}
                              className={`relative w-12 h-6 rounded-full transition-all duration-300 ${isVisible ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                            >
                              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 shadow-sm ${isVisible ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                          </div>
                        );
                     })}
                  </div>

                  <div className="mt-8 p-6 bg-amber-50 dark:bg-amber-900/20 rounded-3xl border border-amber-100 dark:border-amber-800/50 flex gap-4">
                     <AlertCircle className="text-amber-600 shrink-0" size={24} />
                     <div>
                        <p className="text-xs font-black text-amber-800 dark:text-amber-200 uppercase tracking-tight">Nota Crítica</p>
                        <p className="text-[10px] text-amber-700 dark:text-amber-300 font-bold leading-relaxed mt-1">
                          A aba de <strong>Configurações</strong> sempre permanecerá visível para administradores para garantir que o sistema possa ser reconfigurado.
                        </p>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'APPEARANCE' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-sm border border-slate-100 dark:border-slate-700">
                  <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter mb-6 flex items-center gap-2">
                    <Sliders className="text-sky-500" /> Preferências Visuais
                  </h3>
                  
                  <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-700 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-amber-500/20 text-amber-600'}`}>
                        {isDarkMode ? <Shield size={24} /> : <Sliders size={24} />}
                      </div>
                      <div>
                        <p className="font-black text-slate-800 dark:text-white uppercase text-xs tracking-widest">Tema Escuro</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Reduz o cansaço visual e economiza bateria</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => onToggleDarkMode(!isDarkMode)}
                      className={`relative w-14 h-8 rounded-full transition-all duration-300 ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-200'}`}
                    >
                      <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-sm flex items-center justify-center ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`}>
                        {isDarkMode ? <Shield size={12} className="text-indigo-600" /> : <Shield size={12} className="text-slate-400" />}
                      </div>
                    </button>
                  </div>
                  
                  <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="p-6 border-2 border-slate-100 dark:border-slate-700 rounded-3xl opacity-50 cursor-not-allowed">
                        <p className="font-black text-slate-400 uppercase text-[10px] tracking-widest mb-1">Cores Personalizadas</p>
                        <p className="text-xs text-slate-400 font-medium">Em breve: Escolha sua paleta</p>
                     </div>
                     <div className="p-6 border-2 border-slate-100 dark:border-slate-700 rounded-3xl opacity-50 cursor-not-allowed">
                        <p className="font-black text-slate-400 uppercase text-[10px] tracking-widest mb-1">Layout Compacto</p>
                        <p className="text-xs text-slate-400 font-medium">Em breve: Ajuste a densidade da tela</p>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'INTEGRATION' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Seção de Conexão Principal */}
              <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                      <FileSpreadsheet size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-tight">Google Sheets Sync</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Conexão Global V47</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${integrations[0]?.status === 'Connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {integrations[0]?.status === 'Connected' ? 'Conectado' : 'Desconectado'}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={integrations[0]?.url || ''} 
                      onChange={e => onUpdate({ ...integrations[0], url: e.target.value })}
                      placeholder="Link do Apps Script Web App..." 
                      className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-50 dark:border-slate-700 outline-none text-xs font-bold bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200" 
                    />
                    <button 
                      onClick={() => {
                        onUpdate({ ...integrations[0], status: integrations[0].url ? 'Connected' : 'Disconnected', lastSync: Date.now() });
                        alert('Conexão configurada!');
                      }}
                      className="px-6 py-3 bg-slate-900 dark:bg-sky-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-sky-700 transition-all active:scale-95 whitespace-nowrap"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              </div>

              {/* Grid de Ações Técnicas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Coluna 1: Nuvem & Banco de Dados */}
                <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 shadow-sm border border-slate-100 dark:border-slate-700 space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Database size={14} className="text-sky-500" /> Nuvem & Database
                  </h4>
                  
                  <div className="space-y-3">
                    <button
                      onClick={handleManualMigration}
                      disabled={isMigrating}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all active:scale-95 ${
                        isMigrating 
                          ? 'border-slate-50 bg-slate-50 text-slate-400' 
                          : 'border-amber-100 bg-amber-50/50 hover:bg-amber-50 text-amber-700'
                      }`}
                    >
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-tighter">Sincronização Total</p>
                        <p className="text-[9px] font-bold opacity-70 uppercase leading-none mt-1">Sheets ➔ Supabase</p>
                      </div>
                      <RefreshCw size={18} className={isMigrating ? 'animate-spin' : ''} />
                    </button>

                    <button
                      onClick={() => setShowAdvancedMigration(true)}
                      className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-500/10 hover:bg-blue-50 text-blue-700 dark:text-blue-400 transition-all active:scale-95"
                    >
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-tighter">Migração Supabase</p>
                        <p className="text-[9px] font-bold opacity-70 uppercase mt-1">Configurações Avançadas</p>
                      </div>
                      <ArrowRight size={18} />
                    </button>
                    
                    {migrationStatus && (
                      <div className="p-3 bg-slate-900 rounded-xl text-[9px] font-mono text-emerald-400 break-all leading-tight max-h-20 overflow-y-auto">
                        {migrationStatus}
                      </div>
                    )}
                  </div>
                </div>

                {/* Coluna 2: Utilitários & Recuperação */}
                <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 shadow-sm border border-slate-100 dark:border-slate-700 space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Shield size={14} className="text-rose-500" /> Suporte & Cache
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => {
                        if(window.confirm('Limpar cache e reiniciar?')) {
                          localStorage.clear();
                          window.location.reload();
                        }
                      }}
                      className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 hover:border-rose-200 transition-all group"
                    >
                      <Trash2 size={20} className="text-slate-400 group-hover:text-rose-500 mb-2" />
                      <span className="text-[9px] font-black uppercase text-slate-500 group-hover:text-slate-800 dark:group-hover:text-white">Limpar Cache</span>
                    </button>

                    {onForceSyncFromSheets && (
                      <button 
                        onClick={onForceSyncFromSheets}
                        className="flex flex-col items-center justify-center p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-900/50 hover:bg-rose-100 transition-all text-rose-600 dark:text-rose-400"
                      >
                        <AlertCircle size={20} className="mb-2" />
                        <span className="text-[9px] font-black uppercase">Modo Planilha</span>
                      </button>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-50 dark:border-slate-700">
                    <p className="text-[9px] text-slate-400 font-bold uppercase mb-2">Google Drive & Código</p>
                    <IntegrationsView integrations={integrations} theme={theme} onUpdate={onUpdate} compactOnly={true} />
                  </div>
                </div>
              </div>
            </div>
          )}


          {activeTab === 'FEATURES' && (
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Módulos do Sistema</h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                      <div className="flex items-center space-x-4">
                          <div className="p-3 bg-white rounded-xl text-slate-600 shadow-sm"><Truck size={20}/></div>
                          <div>
                            <p className="font-black text-slate-800">Aba de Fornecedores</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ativar gestão direta no estoque</p>
                          </div>
                      </div>
                      <button onClick={() => onUpdateConfig({ showSuppliersTab: !hotelConfig?.showSuppliersTab })} className="transition-all">
                          {hotelConfig?.showSuppliersTab ? <ToggleRight size={40} className="text-emerald-500" /> : <ToggleLeft size={40} className="text-slate-300" />}
                      </button>
                    </div>
                </div>
              </div>

              {hotelConfig?.showSuppliersTab && (
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6 animate-in slide-in-from-top-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Gerenciar Fornecedores</h3>
                    <button 
                      onClick={() => setIsAddingSupplier(true)}
                      className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 active:scale-95 transition-all shadow-lg"
                    >
                      <Plus size={14} />
                      <span>Cadastrar</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {suppliers.map(s => (
                      <div key={s.id} className="p-4 bg-slate-50 rounded-[1.5rem] border border-slate-100 flex items-center justify-between group">
                        <div className="flex items-center space-x-4">
                          <div className="p-2.5 bg-white rounded-xl text-slate-400"><Briefcase size={18}/></div>
                          <div>
                            <p className="font-black text-slate-800 text-sm leading-tight">{s.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">{s.category || 'Geral'}</p>
                          </div>
                        </div>
                        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEditSupplier(s)} className="p-2 text-slate-400 hover:text-blue-500"><Plus size={14}/></button>
                          <button onClick={() => onDeleteSupplier(s.id)} className="p-2 text-slate-400 hover:text-rose-500"><Trash2 size={14}/></button>
                        </div>
                      </div>
                    ))}
                    {suppliers.length === 0 && (
                      <div className="col-span-full py-10 text-center text-slate-300 italic text-xs font-bold border-2 border-dashed border-slate-100 rounded-[2rem]">
                        Nenhum fornecedor cadastrado.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'CHECKLIST' && (
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6 animate-in slide-in-from-top-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Itens Adicionais de Vistoria</h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">Configure campos extras para o formulário de apartamentos.</p>
                  </div>
                  <button 
                    onClick={() => setIsAddingField(true)}
                    className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 active:scale-95 transition-all shadow-lg"
                  >
                    <Plus size={14} />
                    <span>Adicionar Item</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {(hotelConfig?.apartmentChecklist || DEFAULT_CHECKLIST).map((field: any) => (
                    <div key={field.id} className="p-4 bg-slate-50 rounded-[1.5rem] border border-slate-100 flex items-center justify-between group">
                      <div className="flex items-center space-x-4">
                        <div className={`p-2.5 bg-white rounded-xl shadow-sm ${field.color}`}><Layout size={18}/></div>
                        <div>
                          <p className="font-black text-slate-800 text-sm leading-tight">{field.title}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">
                            {field.type === 'boolean' ? 'SIM/NÃO' : field.type === 'single_choice' ? `Múltipla Escolha (${field.options?.length || 0} opções)` : 'Texto Livre'}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEditField(field)} className="p-2 text-slate-400 hover:text-blue-500"><Settings size={14}/></button>
                        <button onClick={() => handleDeleteField(field.id)} className="p-2 text-slate-400 hover:text-rose-500"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  ))}
                  {(!hotelConfig?.apartmentChecklist && DEFAULT_CHECKLIST.length === 0) && (
                    <div className="py-10 text-center text-slate-300 italic text-xs font-bold border-2 border-dashed border-slate-100 rounded-[2rem]">
                      Nenhum item adicional configurado.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'USERS' && (
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6 animate-in slide-in-from-top-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Gerenciamento de Usuários</h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">Cadastre funcionários e defina permissões de acesso.</p>
                  </div>
                  <button 
                    onClick={() => setIsAddingUser(true)}
                    className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 active:scale-95 transition-all shadow-lg"
                  >
                    <Plus size={14} />
                    <span>Adicionar Usuário</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {users.map((user) => (
                    <div key={user.id} className="p-4 bg-slate-50 rounded-[1.5rem] border border-slate-100 flex items-center justify-between group">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-white rounded-xl text-slate-600 shadow-sm"><UserIcon size={20} /></div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="font-black text-slate-800">{user.name}</p>
                            {user.status === 'PENDING' && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[8px] font-black uppercase tracking-widest">Pendente</span>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {user.role} {user.hotel && `• ${hotels.find(h => h.id === user.hotel)?.label || user.hotel}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEditUser(user)} className="p-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 rounded-lg transition-colors"><Settings size={16}/></button>
                        <button onClick={() => onDeleteUser(user.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  ))}
                  {users.length === 0 && (
                    <div className="text-center py-8 text-slate-400 font-bold text-sm">Nenhum usuário cadastrado.</div>
                  )}
                </div>
              </div>
            </div>
          )}



          {activeTab === 'PROFILE' && (
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6 animate-in slide-in-from-top-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Solicitações de Acesso</h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">Aprove ou negue o acesso de novos colaboradores.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {users.filter(u => u.status === 'PENDING').map(user => (
                    <div key={user.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-white rounded-xl shadow-sm text-slate-400"><UserCircle size={20}/></div>
                        <div>
                          <p className="text-sm font-black text-slate-800 uppercase">{user.name}</p>
                          <p className="text-[10px] font-bold text-slate-400">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleEditUser(user)} 
                          className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-emerald-600 transition-colors"
                        >
                          Aprovar / Configurar
                        </button>
                        <button 
                          onClick={() => onDeleteUser(user.id)} 
                          className="px-4 py-2 bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-rose-600 transition-colors"
                        >
                          Negar
                        </button>
                      </div>
                    </div>
                  ))}
                  {users.filter(u => u.status === 'PENDING').length === 0 && (
                    <div className="text-center py-8 text-slate-400 font-bold text-sm">Nenhuma solicitação pendente.</div>
                  )}
                </div>
              </div>

              <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6 animate-in slide-in-from-top-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Perfis Aprovados</h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">Gerencie as permissões dos colaboradores aprovados.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {users.filter(u => u.status !== 'PENDING').map(user => (
                    <div key={user.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-white rounded-xl shadow-sm text-slate-400"><UserCircle size={20}/></div>
                        <div>
                          <p className="text-sm font-black text-slate-800 uppercase">{user.name}</p>
                          <p className="text-[10px] font-bold text-slate-400">{user.email || user.role}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button onClick={() => handleEditUser(user)} className="p-2 text-slate-400 hover:text-blue-500"><Settings size={18}/></button>
                        <button onClick={() => onDeleteUser(user.id)} className="p-2 text-slate-400 hover:text-rose-500"><Trash2 size={18}/></button>
                      </div>
                    </div>
                  ))}
                  {users.filter(u => u.status !== 'PENDING').length === 0 && (
                    <div className="text-center py-8 text-slate-400 font-bold text-sm">Nenhum perfil aprovado.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Supplier Modal for Settings */}
      {isAddingSupplier && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
           <div className="bg-white w-[95%] md:w-full md:max-w-lg rounded-2xl md:rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[90dvh]">
              <div className="p-6 md:p-8 border-b border-slate-50 flex justify-between items-center shrink-0">
                 <h2 className="text-xl font-black text-slate-800">{editingSupplier ? 'Editar Fornecedor' : 'Cadastrar Fornecedor'}</h2>
                 <button onClick={() => { setIsAddingSupplier(false); setEditingSupplier(null); setSupName(''); setSupContact(''); setSupCategory(''); }} className="text-slate-300 hover:text-slate-500 transition-colors"><X size={24}/></button>
              </div>
              <form onSubmit={handleSaveSupplierSubmit} className="p-6 md:p-8 space-y-4 overflow-y-auto">
                 <div className="space-y-4">
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Nome da Empresa</label>
                       <input type="text" value={supName} onChange={e => setSupName(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800" placeholder="Nome Fantasia / Razão Social" required />
                    </div>
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Contato</label>
                       <input type="text" value={supContact} onChange={e => setSupContact(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800" placeholder="WhatsApp, Email ou Telefone" />
                    </div>
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Categoria de Fornecimento</label>
                       <input type="text" value={supCategory} onChange={e => setSupCategory(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800" placeholder="Ex: Limpeza, Lavanderia, Elétrica..." />
                    </div>
                 </div>
                 <button type="submit" className="w-full py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 shrink-0" style={{ backgroundColor: theme.primary }}>
                   {editingSupplier ? 'Atualizar Fornecedor' : 'Cadastrar Fornecedor'}
                 </button>
              </form>
           </div>
        </div>
      )}
      {/* Checklist Field Modal */}
      {isAddingField && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
           <div className="bg-white w-[95%] md:w-full md:max-w-lg rounded-2xl md:rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[90dvh]">
              <div className="p-6 md:p-8 border-b border-slate-50 flex justify-between items-center shrink-0">
                 <h2 className="text-xl font-black text-slate-800">{editingField ? 'Editar Item' : 'Novo Item de Vistoria'}</h2>
                 <button onClick={() => { setIsAddingField(false); setEditingField(null); setFieldTitle(''); setFieldOptions(''); }} className="text-slate-300 hover:text-slate-500 transition-colors"><X size={24}/></button>
              </div>
              <form onSubmit={handleSaveFieldSubmit} className="p-6 md:p-8 space-y-4 overflow-y-auto">
                 <div className="space-y-4">
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Título do Item</label>
                       <input type="text" value={fieldTitle} onChange={e => setFieldTitle(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800" placeholder="Ex: Frigobar, Cofre, Varanda..." required />
                    </div>
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Tipo de Resposta</label>
                       <select value={fieldType} onChange={e => setFieldType(e.target.value as any)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800">
                         <option value="boolean">SIM / NÃO</option>
                         <option value="single_choice">Múltipla Escolha (Botões)</option>
                         <option value="text">Texto Livre</option>
                       </select>
                    </div>
                    
                    {fieldType === 'single_choice' && (
                      <div className="animate-in fade-in">
                         <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Opções (separadas por vírgula)</label>
                         <input type="text" value={fieldOptions} onChange={e => setFieldOptions(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800" placeholder="Ex: Bom, Regular, Ruim" required />
                      </div>
                    )}

                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Cor do Ícone</label>
                       <div className="flex gap-2">
                         {['text-purple-600', 'text-blue-600', 'text-emerald-600', 'text-amber-600', 'text-rose-600', 'text-slate-800'].map(color => (
                           <button 
                             key={color} 
                             type="button"
                             onClick={() => setFieldColor(color)}
                             className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all ${fieldColor === color ? 'border-slate-800 shadow-md' : 'border-transparent'}`}
                           >
                             <div className={`w-6 h-6 rounded-full bg-current ${color.replace('text-', 'bg-').replace('600', '500').replace('800', '800')}`} />
                           </button>
                         ))}
                       </div>
                    </div>
                 </div>
                 <button type="submit" className="w-full py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 mt-4 shrink-0" style={{ backgroundColor: theme.primary }}>
                   {editingField ? 'Atualizar Item' : 'Adicionar Item'}
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* User Modal */}
      {isAddingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
           <div className="bg-white w-[95%] md:w-full md:max-w-lg rounded-2xl md:rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[90dvh]">
              <div className="p-6 md:p-8 border-b border-slate-50 flex justify-between items-center shrink-0">
                 <h2 className="text-xl font-black text-slate-800">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h2>
                 <button onClick={() => { setIsAddingUser(false); setEditingUser(null); setUserName(''); setUserPassword(''); setUserRole('FUNCIONARIO'); setUserTabs([]); }} className="text-slate-300 hover:text-slate-500 transition-colors"><X size={24}/></button>
              </div>
              <form onSubmit={handleSaveUserSubmit} className="p-6 md:p-8 space-y-4 overflow-y-auto">
                 <div className="space-y-4">
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Unidade</label>
                       <select value={userHotel} onChange={e => setUserHotel(e.target.value as HotelType)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800" required>
                         <option value="" disabled>Selecione a unidade...</option>
                         {hotels.map(h => (
                           <option key={h.id} value={h.id}>{h.label}</option>
                         ))}
                       </select>
                    </div>
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Nome do Usuário</label>
                       <input type="text" value={userName} onChange={e => setUserName(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800" placeholder="Ex: João Silva" required />
                    </div>
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Senha</label>
                       <input type="password" value={userPassword} onChange={e => setUserPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800" placeholder="Senha de acesso" required={!editingUser} />
                    </div>
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Cargo</label>
                       <select value={userRole} onChange={e => setUserRole(e.target.value as any)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800">
                         <option value="FUNCIONARIO">Funcionário</option>
                         <option value="GESTOR">Gestor</option>
                       </select>
                    </div>
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Abas de Acesso</label>
                       <div className="grid grid-cols-2 gap-2">
                         {Object.values(ViewType).map(tab => {
                           const tabLabels: Record<string, string> = {
                             DASHBOARD: 'Dashboard',
                             APARTMENTS: 'Apartamentos',
                             BUDGETS: 'Orçamentos',
                             SETTINGS: 'Configurações',
                             EMPLOYEES: 'Colaboradores',
                             INVENTORY: 'Estoque',
                             REPORTS: 'Relatórios',
                             TODAY_SCHEDULE: 'Agenda do Dia',
                             PARKING: 'Estacionamento'
                           };
                           
                           return (
                             <label key={tab} className="flex items-center space-x-2 p-2 bg-slate-50 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
                               <input 
                                 type="checkbox" 
                                 checked={userTabs.includes(tab)}
                                 onChange={(e) => {
                                   if (e.target.checked) {
                                     setUserTabs([...userTabs, tab]);
                                   } else {
                                     setUserTabs(userTabs.filter(t => t !== tab));
                                   }
                                 }}
                                 className="rounded text-sky-500 focus:ring-sky-500"
                               />
                               <span className="text-xs font-bold text-slate-700">{tabLabels[tab] || tab}</span>
                             </label>
                           );
                         })}
                       </div>
                    </div>
                 </div>
                 <button type="submit" className="w-full py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 mt-4 shrink-0" style={{ backgroundColor: theme.primary }}>
                   {editingUser ? 'Atualizar Usuário' : 'Cadastrar Usuário'}
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* Parking Location Modal */}
      {showAdvancedMigration && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[3rem] shadow-2xl animate-in zoom-in duration-300 overflow-hidden flex flex-col max-h-[90dvh]">
             <div className="p-8 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center shrink-0">
                <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Configurações de Banco de Dados</h3>
                <button onClick={() => setShowAdvancedMigration(false)} className="text-slate-300 hover:text-slate-500 transition-colors"><X size={32}/></button>
             </div>
             <div className="p-8 overflow-y-auto custom-scrollbar">
                <IntegrationsView integrations={integrations} theme={theme} onUpdate={onUpdate} />
             </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default SettingsView;
