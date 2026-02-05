
import React, { useState } from 'react';
import { Integration, HotelTheme, Supplier } from '../types';
import IntegrationsView from './IntegrationsView';
import { Database, UserCircle, Shield, Sliders, ToggleLeft, ToggleRight, Truck, Plus, Trash2, Briefcase, User as UserIcon, X } from 'lucide-react';

interface SettingsViewProps {
  integrations: Integration[];
  hotelConfig?: {
    showSuppliersTab: boolean;
  };
  onUpdateConfig: (config: any) => void;
  theme: HotelTheme;
  suppliers: Supplier[];
  onSaveSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (id: string) => void;
  onUpdate: (integration: Integration) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ 
  integrations, 
  hotelConfig, 
  onUpdateConfig, 
  theme, 
  suppliers,
  onSaveSupplier,
  onDeleteSupplier,
  onUpdate 
}) => {
  const [activeTab, setActiveTab] = useState<'INTEGRATION' | 'PROFILE' | 'FEATURES'>('INTEGRATION');
  
  // Supplier management state
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supCategory, setSupCategory] = useState('');

  const tabs = [
    { id: 'INTEGRATION', label: 'Integração Global', icon: Database },
    { id: 'FEATURES', label: 'Funcionalidades', icon: Sliders },
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center space-x-3 px-6 py-4 rounded-2xl transition-all font-bold text-sm ${
                activeTab === tab.id 
                ? 'bg-white text-slate-900 shadow-md border-2 border-slate-50' 
                : 'text-slate-400 hover:bg-white/50 hover:text-slate-600'
              }`}
              style={{ 
                borderColor: activeTab === tab.id ? theme.primary + '30' : undefined,
                color: activeTab === tab.id ? theme.primary : undefined
              }}
            >
              <tab.icon size={18} />
              <span>{tab.label}</span>
            </button>
          ))}
        </aside>

        <div className="flex-1">
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

          {activeTab === 'PROFILE' && (
            <div className="bg-white p-12 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center space-y-6">
               <div className="p-8 bg-slate-50 rounded-full text-slate-300"><Shield size={64} /></div>
               <div>
                 <h4 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Gerenciamento de Perfil</h4>
                 <p className="text-slate-400 text-sm max-w-sm mx-auto mt-2 font-medium">As permissões de acesso são gerenciadas pela Diretoria Nacional Inn.</p>
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
    </div>
  );
};

export default SettingsView;
