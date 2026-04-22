
import React, { useState } from 'react';
import { Integration, HotelTheme, Supplier, ParkingLocation, User, ViewType, HotelType } from '../types';
import IntegrationsView from './IntegrationsView';
import { Database, UserCircle, Shield, Sliders, ToggleLeft, ToggleRight, Truck, Plus, Trash2, Briefcase, User as UserIcon, X, Layout, GripVertical, Settings, Car, Users } from 'lucide-react';
import { DEFAULT_CHECKLIST } from '../defaultChecklist';

interface SettingsViewProps {
  integrations: Integration[];
  hotelConfig?: {
    showSuppliersTab: boolean;
    apartmentChecklist?: any[]; // FormFieldConfig[]
  };
  onUpdateConfig: (config: any) => void;
  theme: HotelTheme;
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
}

const SettingsView: React.FC<SettingsViewProps> = ({ 
  integrations, 
  hotelConfig, 
  onUpdateConfig, 
  theme, 
  suppliers,
  onSaveSupplier,
  onDeleteSupplier,
  onUpdate,
  parkingLocations = [],
  onSaveParkingLocation,
  onDeleteParkingLocation,
  users = [],
  onSaveUser,
  onDeleteUser
}) => {
  const [activeTab, setActiveTab] = useState<'INTEGRATION' | 'PROFILE' | 'FEATURES' | 'CHECKLIST' | 'USERS' | 'PARKING_SPOTS'>('INTEGRATION');
  
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

  const tabs = [
    { id: 'INTEGRATION', label: 'Integração Global', icon: Database },
    { id: 'FEATURES', label: 'Funcionalidades', icon: Sliders },
    { id: 'CHECKLIST', label: 'Formulário de Vistoria', icon: Layout },
    { id: 'PARKING_SPOTS', label: 'Configuração de Vagas', icon: Car },
    { id: 'USERS', label: 'Usuários', icon: Users },
    { id: 'PROFILE', label: 'Perfil de Acesso', icon: UserCircle },
  ];

  const handleSaveSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSupplier({
      id: editingSupplier?.id || Date.now().toString(),
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
      id: editingField?.id || `custom_${Date.now()}`,
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
      id: editingUser?.id || `user_${Date.now()}`,
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
      id: editingParkingLocation?.id || `parking_${Date.now()}`,
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
        <aside className="w-full md:w-64 flex md:flex-col overflow-x-auto md:overflow-x-visible no-scrollbar pb-2 md:pb-0 space-x-2 md:space-x-0 md:space-y-2 sticky top-0 z-[40] md:relative bg-slate-50 md:bg-transparent -mx-4 px-4 md:mx-0 md:px-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-shrink-0 flex items-center space-x-3 px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl transition-all font-bold text-xs md:text-sm whitespace-nowrap ${
                activeTab === tab.id 
                ? 'bg-white text-slate-900 shadow-md border-2 border-slate-50' 
                : 'text-slate-400 hover:bg-white/50 hover:text-slate-600'
              }`}
              style={{ 
                borderColor: activeTab === tab.id ? theme.primary + '30' : undefined,
                color: activeTab === tab.id ? theme.primary : undefined
              }}
            >
              <tab.icon size={16} className="md:w-[18px] md:h-[18px]" />
              <span>{tab.label}</span>
            </button>
          ))}
        </aside>

        <div className="flex-1 min-w-0">
          {activeTab === 'INTEGRATION' && (
            <IntegrationsView integrations={integrations} theme={theme} onUpdate={onUpdate} />
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

          {activeTab === 'PARKING_SPOTS' && (
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6 animate-in slide-in-from-top-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Configuração de Vagas</h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">Cadastre os locais de estacionamento e a quantidade de vagas.</p>
                  </div>
                  <button 
                    onClick={() => setIsAddingParkingLocation(true)}
                    className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 active:scale-95 transition-all shadow-lg"
                  >
                    <Plus size={14} />
                    <span>Adicionar Local</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {parkingLocations.map((loc) => (
                    <div key={loc.id} className="p-4 bg-slate-50 rounded-[1.5rem] border border-slate-100 flex items-center justify-between group">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-white rounded-xl text-slate-600 shadow-sm"><Car size={20} /></div>
                        <div>
                          <p className="font-black text-slate-800">{loc.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total de Vagas: {loc.totalSpots}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEditParkingLocation(loc)} className="p-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 rounded-lg transition-colors"><Settings size={16}/></button>
                        <button onClick={() => onDeleteParkingLocation(loc.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  ))}
                  {parkingLocations.length === 0 && (
                    <div className="text-center py-8 text-slate-400 font-bold text-sm">Nenhum local cadastrado.</div>
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
           <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-200 overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                 <h2 className="text-xl font-black text-slate-800">{editingSupplier ? 'Editar Fornecedor' : 'Cadastrar Fornecedor'}</h2>
                 <button onClick={() => { setIsAddingSupplier(false); setEditingSupplier(null); setSupName(''); setSupContact(''); setSupCategory(''); }} className="text-slate-300 hover:text-slate-500"><X size={24}/></button>
              </div>
              <form onSubmit={handleSaveSupplierSubmit} className="p-8 space-y-4">
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
                 <button type="submit" className="w-full py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95" style={{ backgroundColor: theme.primary }}>
                   {editingSupplier ? 'Atualizar Fornecedor' : 'Cadastrar Fornecedor'}
                 </button>
              </form>
           </div>
        </div>
      )}
      {/* Checklist Field Modal */}
      {isAddingField && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-200 overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                 <h2 className="text-xl font-black text-slate-800">{editingField ? 'Editar Item' : 'Novo Item de Vistoria'}</h2>
                 <button onClick={() => { setIsAddingField(false); setEditingField(null); setFieldTitle(''); setFieldOptions(''); }} className="text-slate-300 hover:text-slate-500"><X size={24}/></button>
              </div>
              <form onSubmit={handleSaveFieldSubmit} className="p-8 space-y-4">
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
                 <button type="submit" className="w-full py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 mt-4" style={{ backgroundColor: theme.primary }}>
                   {editingField ? 'Atualizar Item' : 'Adicionar Item'}
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* User Modal */}
      {isAddingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-200 overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                 <h2 className="text-xl font-black text-slate-800">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h2>
                 <button onClick={() => { setIsAddingUser(false); setEditingUser(null); setUserName(''); setUserPassword(''); setUserRole('FUNCIONARIO'); setUserTabs([]); }} className="text-slate-300 hover:text-slate-500"><X size={24}/></button>
              </div>
              <form onSubmit={handleSaveUserSubmit} className="p-8 space-y-4">
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
                         {Object.values(ViewType).map(tab => (
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
                             <span className="text-xs font-bold text-slate-700">{tab}</span>
                           </label>
                         ))}
                       </div>
                    </div>
                 </div>
                 <button type="submit" className="w-full py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 mt-4" style={{ backgroundColor: theme.primary }}>
                   {editingUser ? 'Atualizar Usuário' : 'Cadastrar Usuário'}
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* Parking Location Modal */}
      {isAddingParkingLocation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-200 overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                 <h2 className="text-xl font-black text-slate-800">{editingParkingLocation ? 'Editar Local' : 'Novo Local de Vagas'}</h2>
                 <button onClick={() => { setIsAddingParkingLocation(false); setEditingParkingLocation(null); setParkingName(''); setParkingSpots(''); }} className="text-slate-300 hover:text-slate-500"><X size={24}/></button>
              </div>
              <form onSubmit={handleSaveParkingLocationSubmit} className="p-8 space-y-4">
                 <div className="space-y-4">
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Nome do Local</label>
                       <input type="text" value={parkingName} onChange={e => setParkingName(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800 uppercase" placeholder="Ex: PÁTIO A" required />
                    </div>
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Quantidade de Vagas</label>
                       <input type="number" value={parkingSpots} onChange={e => setParkingSpots(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800" placeholder="Ex: 10" min="1" required />
                    </div>
                 </div>
                 <button type="submit" className="w-full py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 mt-4" style={{ backgroundColor: theme.primary }}>
                   {editingParkingLocation ? 'Atualizar Local' : 'Cadastrar Local'}
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
