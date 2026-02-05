
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { InventoryItem, InventoryOperation, HotelTheme, UserRole, Supplier } from '../types';
import { 
  Package, 
  Search, 
  Plus, 
  Trash2, 
  X,
  Edit2,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  History,
  ShoppingCart,
  PlusCircle,
  Calendar,
  User as UserIcon,
  Barcode,
  Truck,
  DollarSign,
  Briefcase
} from 'lucide-react';

interface InventoryViewProps {
  inventory: InventoryItem[];
  history: InventoryOperation[];
  suppliers: Supplier[];
  showSuppliersTab?: boolean;
  theme: HotelTheme;
  onSave: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onOperation: (op: InventoryOperation) => void;
  onSaveSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (id: string) => void;
  role?: UserRole;
  currentUser?: string;
}

const InventoryView: React.FC<InventoryViewProps> = ({ 
  inventory, 
  history, 
  suppliers,
  showSuppliersTab = true,
  theme, 
  onSave, 
  onDelete, 
  onOperation, 
  onSaveSupplier, 
  onDeleteSupplier,
  role,
  currentUser 
}) => {
  const [activeTab, setActiveTab] = useState<'ESTOQUE' | 'OPERACAO' | 'SUGESTAO' | 'FORNECEDORES'>('ESTOQUE');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isAddingOp, setIsAddingOp] = useState(false);
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todos');

  // Form Item
  const [name, setName] = useState('');
  const [ean, setEan] = useState('');
  const [category, setCategory] = useState('Limpeza');
  const [initialQuantity, setInitialQuantity] = useState(0);
  const [unit, setUnit] = useState('Unidade');
  const [price, setPrice] = useState(0);
  const [supplierId, setSupplierId] = useState('');

  // Form Operation - Busca Preditiva
  const [opSearchQuery, setOpSearchQuery] = useState('');
  const [opItemId, setOpItemId] = useState('');
  const [opType, setOpType] = useState<'Entrada' | 'Saída'>('Entrada');
  const [opQuantity, setOpQuantity] = useState(0);
  const [opReason, setOpReason] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Supplier form state
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supCategory, setSupCategory] = useState('');

  const categories = ['Limpeza', 'Rouparia', 'Amenidades', 'Escritório', 'Manutenção'];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const calculateOrderSuggestion = (item: InventoryItem) => {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const itemExits = history.filter(op => op.itemId === item.id && op.type === 'Saída' && op.timestamp > thirtyDaysAgo);
    const totalExited = itemExits.reduce((acc, curr) => acc + curr.quantity, 0);
    const mcd = totalExited / 30;
    const supplier = suppliers.find(s => s.id === item.supplierId);
    const isVMarketing = supplier?.name.toLowerCase().includes('v-marketing');
    const targetDays = isVMarketing ? 12 : 8;
    const targetStock = Math.ceil(mcd * targetDays);
    const suggestedQuantity = Math.max(0, targetStock - item.quantity);
    return { mcd, targetDays, targetStock, suggestedQuantity, isVMarketing, reason: isVMarketing ? "Ciclo de Quinta (V-Marketing): 12 dias" : "Ciclo de Quarta: 8 dias" };
  };

  const enrichedInventory = useMemo(() => inventory.map(item => {
    const suggestion = calculateOrderSuggestion(item);
    return { ...item, minQuantity: Math.ceil(suggestion.mcd * 7), suggestion, totalValue: item.quantity * (item.price || 0) };
  }), [inventory, history, suppliers]);

  const globalTotalValue = useMemo(() => enrichedInventory.reduce((acc, curr) => acc + curr.totalValue, 0), [enrichedInventory]);

  const resetItemForm = () => {
    setName(''); setEan(''); setCategory('Limpeza'); setInitialQuantity(0); setUnit('Unidade'); setPrice(0); setSupplierId('');
    setEditingItem(null); setIsAddingItem(false);
  };

  const handleSaveItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ id: editingItem?.id || Date.now().toString(), ean, name, category, quantity: initialQuantity, unit, price, supplierId, minQuantity: 0, lastUpdate: Date.now() });
    resetItemForm();
  };

  const handleSaveSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSupplier({ id: editingSupplier?.id || Date.now().toString(), name: supName, contact: supContact, category: supCategory });
    setSupName(''); setSupContact(''); setSupCategory(''); setIsAddingSupplier(false); setEditingSupplier(null);
  };

  const filteredItems = useMemo(() => enrichedInventory.filter(i => 
    (categoryFilter === 'Todos' || i.category === categoryFilter) &&
    (i.name.toLowerCase().includes(searchTerm.toLowerCase()) || (i.ean && i.ean.includes(searchTerm)))
  ), [enrichedInventory, categoryFilter, searchTerm]);

  const predictiveResults = useMemo(() => {
    if (!opSearchQuery || opSearchQuery.length < 2) return [];
    return inventory.filter(i => 
      i.name.toLowerCase().includes(opSearchQuery.toLowerCase()) || 
      (i.ean && i.ean.includes(opSearchQuery))
    ).slice(0, 5);
  }, [inventory, opSearchQuery]);

  const suggestedOrders = useMemo(() => enrichedInventory.filter(i => i.suggestion.suggestedQuantity > 0), [enrichedInventory]);

  const handleSelectPredictiveItem = (item: InventoryItem) => {
    setOpItemId(item.id);
    setOpSearchQuery(item.name);
    setIsSearchDropdownOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* Header com Valor Total */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
         <div className="flex items-center space-x-4">
            <div className="p-4 bg-emerald-50 text-emerald-500 rounded-2xl"><DollarSign size={24}/></div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Total do Estoque</p>
               <h3 className="text-2xl font-black text-slate-800">R$ {globalTotalValue.toLocaleString('pt-BR')}</h3>
            </div>
         </div>
         <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100 shadow-sm w-full md:w-auto">
            {[
              { id: 'ESTOQUE', label: 'Estoque', icon: Package },
              { id: 'OPERACAO', label: 'Movimentos', icon: History },
              { id: 'SUGESTAO', label: 'Pedido Sugerido', icon: ShoppingCart },
              ...(showSuppliersTab ? [{ id: 'FORNECEDORES', label: 'Fornecedores', icon: Truck }] : [])
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                <tab.icon size={14} /> <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
         </div>
      </div>

      {activeTab === 'ESTOQUE' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-2">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="text" placeholder="Buscar por nome ou EAN..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-100 outline-none text-sm font-bold bg-white shadow-inner" />
              </div>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-4 py-3 rounded-xl border border-slate-100 outline-none bg-white text-sm font-bold shadow-inner">
                <option value="Todos">Categorias</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
               <button onClick={() => setIsAddingOp(true)} className="flex-1 md:w-auto border-2 border-slate-100 text-slate-600 px-6 py-3 rounded-xl font-bold flex items-center justify-center space-x-2 bg-white transition-all active:scale-95">
                 <PlusCircle size={18} /> <span>Movimentação</span>
               </button>
               {role !== 'FUNCIONARIO' && (
                 <button onClick={() => setIsAddingItem(true)} className="flex-1 md:w-auto text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center space-x-2 shadow-lg transition-all active:scale-95" style={{ backgroundColor: theme.primary }}>
                   <Plus size={18} /> <span>Novo Item</span>
                 </button>
               )}
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Insumo</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Saldo</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Consumo Médio</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">R$ Unit</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">R$ Total</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredItems.map(item => {
                    const isLow = item.quantity <= item.minQuantity;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-5">
                          <p className="font-black text-slate-800 leading-tight">{item.name}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            {item.ean && <span className="text-[8px] text-blue-500 font-black uppercase flex items-center bg-blue-50 px-1.5 py-0.5 rounded"><Barcode size={8} className="mr-1" /> {item.ean}</span>}
                            <span className="text-[8px] text-slate-400 font-bold uppercase">{item.category} • {item.unit}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className={`text-lg font-black ${isLow ? 'text-rose-500' : 'text-slate-800'}`}>{item.quantity}</span>
                        </td>
                        <td className="px-8 py-5 text-center text-xs font-bold text-slate-400">{item.suggestion.mcd.toFixed(2)}/dia</td>
                        <td className="px-8 py-5 text-center text-xs font-bold text-slate-600">R$ {(item.price || 0).toLocaleString('pt-BR')}</td>
                        <td className="px-8 py-5 text-center text-sm font-black text-slate-900">R$ {item.totalValue.toLocaleString('pt-BR')}</td>
                        <td className="px-8 py-5 text-right">
                          <button onClick={() => { setEditingItem(item); setName(item.name); setEan(item.ean || ''); setCategory(item.category); setInitialQuantity(item.quantity); setUnit(item.unit); setPrice(item.price || 0); setSupplierId(item.supplierId || ''); setIsAddingItem(true); }} className="p-2 text-slate-300 hover:text-blue-500"><Edit2 size={18}/></button>
                          {role !== 'FUNCIONARIO' && <button onClick={() => onDelete(item.id)} className="p-2 text-slate-300 hover:text-rose-500 ml-2"><Trash2 size={18}/></button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'OPERACAO' && (
        <div className="space-y-6 animate-in slide-in-from-right-4">
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="text-xl font-black text-slate-800 flex items-center"><History size={24} className="mr-3 text-slate-400"/> Histórico de Movimentações</h3>
                 <button onClick={() => setIsAddingOp(true)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg">Nova Operação</button>
              </div>
              <div className="space-y-4">
                 {history.length === 0 ? (
                    <p className="text-center py-20 text-slate-300 italic font-bold">Nenhuma movimentação registrada.</p>
                 ) : (
                    history.map(op => (
                       <div key={op.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex items-center space-x-4">
                             <div className={`p-3 rounded-xl ${op.type === 'Entrada' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                {op.type === 'Entrada' ? <ArrowUpRight size={20}/> : <ArrowDownRight size={20}/>}
                             </div>
                             <div>
                                <p className="font-black text-slate-800">{op.itemName}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center">
                                   <UserIcon size={10} className="mr-1"/> {op.user} • <Calendar size={10} className="mx-1"/> {new Date(op.timestamp).toLocaleString()}
                                </p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className={`text-lg font-black ${op.type === 'Entrada' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {op.type === 'Entrada' ? '+' : '-'}{op.quantity}
                             </p>
                             {op.reason && <p className="text-[9px] text-slate-400 font-medium">{op.reason}</p>}
                          </div>
                       </div>
                    ))
                 )}
              </div>
           </div>
        </div>
      )}

      {activeTab === 'SUGESTAO' && (
        <div className="space-y-6 animate-in slide-in-from-left-4">
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="mb-8">
                 <h3 className="text-xl font-black text-slate-800 flex items-center"><ShoppingCart size={24} className="mr-3 text-emerald-500"/> Sugestão de Pedido Inteligente</h3>
                 <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Calculado para garantir estoque até o próximo ciclo de entrega</p>
              </div>

              {suggestedOrders.length === 0 ? (
                 <div className="text-center py-20 bg-slate-50 rounded-3xl">
                    <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-4"/>
                    <p className="text-slate-400 font-bold italic">Estoque abastecido para os ciclos de Quarta e Quinta.</p>
                 </div>
              ) : (
                 <div className="space-y-4">
                    {suggestedOrders.map(item => (
                      <div key={item.id} className={`flex items-center justify-between p-6 rounded-2xl border transition-all ${item.suggestion.isVMarketing ? 'bg-blue-50 border-blue-100' : 'bg-rose-50 border-rose-100'}`}>
                         <div className="flex items-center space-x-4">
                            <div className={`p-4 rounded-2xl shadow-sm ${item.suggestion.isVMarketing ? 'bg-white text-blue-500' : 'bg-white text-rose-500'}`}>
                               <Truck size={24}/>
                            </div>
                            <div>
                               <p className="font-black text-slate-800">{item.name}</p>
                               <div className="flex flex-col">
                                 <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Atual: {item.quantity} {item.unit}</span>
                                 <span className={`text-[10px] font-black uppercase ${item.suggestion.isVMarketing ? 'text-blue-600' : 'text-rose-600'}`}>
                                    {item.suggestion.reason}
                                 </span>
                               </div>
                            </div>
                         </div>
                         <div className="text-right bg-white p-4 rounded-2xl shadow-sm min-w-[140px] border border-slate-100">
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Pedido Sugerido</p>
                            <p className={`text-xl font-black ${item.suggestion.isVMarketing ? 'text-blue-600' : 'text-rose-600'}`}>
                               {item.suggestion.suggestedQuantity} <span className="text-xs">{item.unit}</span>
                            </p>
                            <p className="text-[8px] text-slate-300 font-bold uppercase mt-1">Alvo: {item.suggestion.targetStock}</p>
                         </div>
                      </div>
                    ))}
                 </div>
              )}
           </div>
        </div>
      )}

      {activeTab === 'FORNECEDORES' && (
        <div className="space-y-6 animate-in fade-in">
           <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800 flex items-center"><Truck size={24} className="mr-3 text-slate-400"/> Cadastro de Fornecedores</h3>
              <button onClick={() => setIsAddingSupplier(true)} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center space-x-2 shadow-lg active:scale-95 transition-all"><Plus size={18} /> <span>Novo Fornecedor</span></button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {suppliers.map(s => (
                 <div key={s.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative group">
                    <button onClick={() => onDeleteSupplier(s.id)} className="absolute top-4 right-4 text-slate-200 hover:text-rose-500 transition-colors"><Trash2 size={16}/></button>
                    <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl w-fit mb-4"><Briefcase size={20}/></div>
                    <h4 className="font-black text-slate-800 text-lg">{s.name}</h4>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{s.category || 'Geral'}</p>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex items-center text-xs font-bold text-slate-600">
                       <UserIcon size={12} className="mr-2 text-slate-300"/> {s.contact || 'Sem contato'}
                    </div>
                 </div>
              ))}
              {suppliers.length === 0 && <div className="col-span-full py-20 text-center text-slate-300 italic font-bold border-2 border-dashed rounded-[3rem]">Nenhum fornecedor cadastrado.</div>}
           </div>
        </div>
      )}

      {/* Modal NOVO ITEM */}
      {isAddingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-200 overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                 <h2 className="text-xl font-black text-slate-800">{editingItem ? 'Editar Insumo' : 'Novo Insumo'}</h2>
                 <button onClick={resetItemForm} className="text-slate-300 hover:text-slate-500"><X size={24}/></button>
              </div>
              <form onSubmit={handleSaveItemSubmit} className="p-8 space-y-4">
                 <div className="grid grid-cols-1 gap-4">
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 focus:border-blue-400 outline-none font-bold" placeholder="Nome do Insumo" required />
                    <div className="relative">
                       <Barcode size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                       <input type="text" value={ean} onChange={e => setEan(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold" placeholder="Código EAN (Obrigatório)" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 bg-white font-bold">
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                       <select value={unit} onChange={e => setUnit(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 bg-white font-bold">
                          <option value="Unidade">Unidade</option>
                          <option value="Caixa">Caixa</option>
                          <option value="Litro">Litro</option>
                          <option value="Kg">Kg</option>
                       </select>
                    </div>
                    <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 bg-white font-bold">
                       <option value="">Selecione o Fornecedor...</option>
                       {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-4 bg-slate-50 rounded-2xl">
                          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Saldo Inicial</label>
                          <input type="number" value={initialQuantity} onChange={e => setInitialQuantity(parseInt(e.target.value) || 0)} className="w-full bg-transparent text-xl font-black outline-none" />
                       </div>
                       <div className="p-4 bg-slate-50 rounded-2xl">
                          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">R$ Valor Unitário</label>
                          <input type="number" step="0.01" value={price} onChange={e => setPrice(parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-xl font-black outline-none" />
                       </div>
                    </div>
                 </div>
                 <button type="submit" className="w-full py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl" style={{ backgroundColor: theme.primary }}>Salvar Cadastro</button>
              </form>
           </div>
        </div>
      )}

      {/* Modal MOVIMENTAÇÃO */}
      {isAddingOp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-200 overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                 <h2 className="text-xl font-black text-slate-800">Lançar Movimentação</h2>
                 <button onClick={() => setIsAddingOp(false)} className="text-slate-300 hover:text-slate-500"><X size={24}/></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const selectedItem = inventory.find(i => i.id === opItemId);
                if (!selectedItem || opQuantity <= 0) return;
                onOperation({ id: Date.now().toString(), itemId: opItemId, itemName: selectedItem.name, type: opType, quantity: opQuantity, timestamp: Date.now(), user: currentUser || 'Sistema', reason: opReason });
                setIsAddingOp(false); setOpItemId(''); setOpSearchQuery(''); setOpQuantity(0); setOpReason('');
              }} className="p-8 space-y-6">
                 <div className="space-y-4">
                    <div className="relative" ref={searchContainerRef}>
                       <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Buscar Insumo (Nome ou EAN)</label>
                       <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <input 
                            type="text" 
                            value={opSearchQuery} 
                            onChange={e => { setOpSearchQuery(e.target.value); setIsSearchDropdownOpen(true); if(opItemId) setOpItemId(''); }} 
                            onFocus={() => setIsSearchDropdownOpen(true)}
                            className="w-full pl-9 pr-4 py-3 rounded-xl border-2 border-slate-50 font-bold outline-none focus:border-blue-300 transition-all" 
                            placeholder="Digite o nome ou bipe o EAN..." 
                            autoComplete="off"
                          />
                       </div>
                       
                       {isSearchDropdownOpen && predictiveResults.length > 0 && (
                         <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[310] overflow-hidden animate-in fade-in slide-in-from-top-2">
                            {predictiveResults.map(i => (
                              <button key={i.id} type="button" onClick={() => handleSelectPredictiveItem(i)} className="w-full p-4 hover:bg-slate-50 text-left border-b border-slate-50 last:border-none flex items-center justify-between transition-colors">
                                 <div>
                                    <p className="font-black text-slate-800 text-sm">{i.name}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">{i.category} • EAN: {i.ean || 'N/A'}</p>
                                 </div>
                                 <div className="text-right">
                                    <p className="text-xs font-black text-slate-800">{i.quantity} {i.unit}</p>
                                    <p className="text-[8px] text-slate-400 uppercase">Saldo Atual</p>
                                 </div>
                              </button>
                            ))}
                         </div>
                       )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                          <button type="button" onClick={() => setOpType('Entrada')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${opType === 'Entrada' ? 'bg-white shadow-sm text-emerald-500' : 'text-slate-400'}`}>Entrada</button>
                          <button type="button" onClick={() => setOpType('Saída')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${opType === 'Saída' ? 'bg-white shadow-sm text-rose-500' : 'text-slate-400'}`}>Saída</button>
                       </div>
                       <input type="number" value={opQuantity || ''} onChange={e => setOpQuantity(parseInt(e.target.value) || 0)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 font-bold outline-none" placeholder="Quantidade" required />
                    </div>
                    <input type="text" value={opReason} onChange={e => setOpReason(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 font-bold outline-none" placeholder="Motivo / Justificativa" />
                 </div>
                 <button type="submit" disabled={!opItemId} className="w-full py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:grayscale" style={{ backgroundColor: theme.primary }}>Confirmar Movimentação</button>
              </form>
           </div>
        </div>
      )}

      {/* Modal FORNECEDOR */}
      {isAddingSupplier && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-200 overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                 <h2 className="text-xl font-black text-slate-800">Novo Fornecedor</h2>
                 <button onClick={() => setIsAddingSupplier(false)} className="text-slate-300 hover:text-slate-500"><X size={24}/></button>
              </div>
              <form onSubmit={handleSaveSupplierSubmit} className="p-8 space-y-4">
                 <input type="text" value={supName} onChange={e => setSupName(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold" placeholder="Nome da Empresa" required />
                 <input type="text" value={supContact} onChange={e => setSupContact(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold" placeholder="Contato (WhatsApp/Email)" />
                 <input type="text" value={supCategory} onChange={e => setSupCategory(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold" placeholder="Categoria" />
                 <button type="submit" className="w-full py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl" style={{ backgroundColor: theme.primary }}>Cadastrar Fornecedor</button>
              </form>
           </div>
        </div>
      )}

    </div>
  );
};

export default InventoryView;
