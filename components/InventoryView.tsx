
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { InventoryItem, InventoryOperation, HotelTheme, UserRole, Supplier, Employee, Sector, ExtraLabor } from '../types';
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
  QrCode,
  Scan,
  Briefcase,
  Building2,
  ChevronLeft,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Layers,
  Printer,
  Sparkles,
  MapPin,
  BarChart as BarChartIcon,
  Activity,
  Filter
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';

interface InventoryViewProps {
  inventory: InventoryItem[];
  history: InventoryOperation[];
  suppliers: Supplier[];
  employees?: Employee[];
  extras?: ExtraLabor[];
  sectors?: Sector[];
  showSuppliersTab?: boolean;
  theme: HotelTheme;
  onSave: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onOperation: (op: InventoryOperation) => void;
  onSaveSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (id: string) => void;
  onSaveSector?: (sector: Sector) => void;
  onDeleteSector?: (id: string) => void;
  onSaveExtra?: (extra: ExtraLabor) => void;
  role?: UserRole;
  currentUser?: string;
}

const InventoryView: React.FC<InventoryViewProps> = ({ 
  inventory, 
  history, 
  suppliers,
  employees = [],
  extras = [],
  sectors = [],
  showSuppliersTab = true,
  theme, 
  onSave, 
  onDelete, 
  onOperation, 
  onSaveSupplier, 
  onDeleteSupplier,
  onSaveSector,
  onDeleteSector,
  onSaveExtra,
  role,
  currentUser 
}) => {
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ESTOQUE' | 'OPERACAO' | 'SUGESTAO' | 'FORNECEDORES' | 'RELATORIOS'>('ESTOQUE');
  
  // Modals state
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [selectedReportEmployee, setSelectedReportEmployee] = useState<string | null>(null);
  const [isAddingOp, setIsAddingOp] = useState(false);
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [isAddingSector, setIsAddingSector] = useState(false);
  const [sectorToDelete, setSectorToDelete] = useState<Sector | null>(null);
  const [showEmptySectors, setShowEmptySectors] = useState(false);
  
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [withdrawalMode, setWithdrawalMode] = useState<'PERSON' | 'LOCATION'>('PERSON');
  const [opWithdrawalLocation, setOpWithdrawalLocation] = useState('');

  // Form Item
  const [name, setName] = useState('');
  const [ean, setEan] = useState('');
  const [category, setCategory] = useState('Limpeza');
  const [initialQuantity, setInitialQuantity] = useState(0);
  const [unit, setUnit] = useState('Unidade');
  const [price, setPrice] = useState(0);
  const [supplierId, setSupplierId] = useState('');

  // Form Operation
  const [opSearchQuery, setOpSearchQuery] = useState('');
  const [opItemId, setOpItemId] = useState('');
  const [opType, setOpType] = useState<'Entrada' | 'Saída'>('Entrada');
  const [opQuantity, setOpQuantity] = useState(0);
  const [opReason, setOpReason] = useState('');
  const [opRecipientId, setOpRecipientId] = useState('');
  const [opRecipientName, setOpRecipientName] = useState('');
  const [opIsExtra, setOpIsExtra] = useState(false);
  
  // Form Sector
  const [sectorName, setSectorName] = useState('');

  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const recipientInputRef = useRef<HTMLInputElement>(null);

  // Supplier form state
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supCategory, setSupCategory] = useState('');
  
  // Dashboard filters
  const [dashStartDate, setDashStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dashEndDate, setDashEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const categories = ['Limpeza', 'Rouparia', 'Amenidades', 'Escritório', 'Manutenção'];

  const abbreviateName = (name: string) => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return name;
    const first = parts[0];
    const last = parts[parts.length - 1];
    return `${first} ${last[0]}.`;
  };

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
    const mcd = totalExited / 30; // Média de Consumo Diário
    
    const supplier = suppliers.find(s => s.id === item.supplierId);
    // Exemplo de lógica baseada no nome do fornecedor (V-Marketing ou Padrão)
    const isVMarketing = supplier?.name.toLowerCase().includes('v-marketing');
    
    // Ciclo de pedido (dias de cobertura desejados)
    const targetDays = isVMarketing ? 15 : 7; 
    
    const targetStock = Math.ceil(mcd * targetDays);
    const suggestedQuantity = Math.max(0, targetStock - item.quantity);
    
    return { 
        mcd, 
        targetDays, 
        targetStock, 
        suggestedQuantity, 
        isVMarketing, 
        reason: isVMarketing ? "Ciclo de 15 dias" : "Ciclo Semanal" 
    };
  };

  // Pre-calculate counts to split sectors
  const sectorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    inventory.forEach(i => {
        if(i.sectorId) counts[i.sectorId] = (counts[i.sectorId] || 0) + 1;
    });
    return counts;
  }, [inventory]);

  const activeSectors = useMemo(() => sectors.filter(s => (sectorCounts[s.id] || 0) > 0), [sectors, sectorCounts]);
  const emptySectors = useMemo(() => sectors.filter(s => (sectorCounts[s.id] || 0) === 0), [sectors, sectorCounts]);

  // Filter inventory by selected Sector
  const sectorInventory = useMemo(() => {
    return inventory.filter(i => i.sectorId === selectedSectorId);
  }, [inventory, selectedSectorId]);

  const enrichedInventory = useMemo(() => sectorInventory.map(item => {
    const suggestion = calculateOrderSuggestion(item);
    return { 
        ...item, 
        minQuantity: Math.ceil(suggestion.mcd * 3), // Estoque mínimo de segurança (3 dias)
        suggestion, 
        totalValue: item.quantity * (item.price || 0) 
    };
  }), [sectorInventory, history, suppliers]);

  const globalTotalValue = useMemo(() => enrichedInventory.reduce((acc, curr) => acc + curr.totalValue, 0), [enrichedInventory]);

  const dashStart = useMemo(() => new Date(dashStartDate).getTime(), [dashStartDate]);
  const dashEnd = useMemo(() => new Date(dashEndDate + 'T23:59:59').getTime(), [dashEndDate]);

  const statsEmployees = useMemo(() => {
    const counts: Record<string, number> = {};
    history
      .filter(h => h.type === 'Saída' && h.recipientName && h.timestamp >= dashStart && h.timestamp <= dashEnd)
      .forEach(h => {
         const name = abbreviateName(h.recipientName || '');
         counts[name] = (counts[name] || 0) + 1;
      });
    return Object.entries(counts)
       .map(([name, count]) => ({ name, count }))
       .sort((a, b) => b.count - a.count)
       .slice(0, 5);
  }, [history, dashStart, dashEnd]);

  const statsProducts = useMemo(() => {
    const counts: Record<string, number> = {};
    history
      .filter(h => h.type === 'Saída' && h.timestamp >= dashStart && h.timestamp <= dashEnd)
      .forEach(h => {
         counts[h.itemName] = (counts[h.itemName] || 0) + h.quantity;
      });
    return Object.entries(counts)
       .map(([name, qty]) => ({ name, qty }))
       .sort((a, b) => b.qty - a.qty)
       .slice(0, 5);
  }, [history, dashStart, dashEnd]);

  const statsSuppliers = useMemo(() => {
    const spend: Record<string, number> = {};
    inventory.forEach(i => {
       const supplier = suppliers.find(s => s.id === i.supplierId);
       const supName = supplier?.name || 'Vários/Desconhecido';
       spend[supName] = (spend[supName] || 0) + (i.quantity * (i.price || 0));
    });
    return Object.entries(spend)
       .map(([name, value]) => ({ name, value }))
       .sort((a, b) => b.value - a.value)
       .slice(0, 5);
  }, [inventory, suppliers]);

  const statsTrends = useMemo(() => {
    // Generate days between dashStart and dashEnd
    const start = new Date(dashStartDate);
    const end = new Date(dashEndDate);
    const days = [];
    let current = new Date(start);
    
    // Safety limit of 60 days
    let count = 0;
    while (current <= end && count < 60) {
      days.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
      count++;
    }

    return days.map(day => {
       const dStart = new Date(day).getTime();
       const dEnd = new Date(day + 'T23:59:59').getTime();
       const ops = history.filter(h => h.timestamp >= dStart && h.timestamp <= dEnd);
       return {
           day: day.split('-').reverse().slice(0, 2).join('/'),
           entradas: ops.filter(o => o.type === 'Entrada').reduce((a, b) => a + b.quantity, 0),
           saidas: ops.filter(o => o.type === 'Saída').reduce((a, b) => a + b.quantity, 0),
       };
    });
  }, [history, dashStartDate, dashEndDate]);

  const resetItemForm = () => {
    setName(''); setEan(''); setCategory('Limpeza'); setInitialQuantity(0); setUnit('Unidade'); setPrice(0); setSupplierId('');
    setEditingItem(null); setIsAddingItem(false);
  };

  const resetOpForm = () => {
    setIsAddingOp(false); setOpItemId(''); setOpSearchQuery(''); setOpQuantity(0); 
    setOpReason(''); setOpRecipientId(''); setOpRecipientName(''); setOpIsExtra(false);
    setWithdrawalMode('PERSON'); setOpWithdrawalLocation('');
  };

  const handleSaveItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSectorId) return;
    onSave({ 
      id: editingItem?.id || Date.now().toString(), 
      ean, 
      name, 
      category, 
      quantity: initialQuantity, 
      unit, 
      price, 
      supplierId, 
      sectorId: selectedSectorId, 
      minQuantity: 0, 
      lastUpdate: Date.now() 
    });
    resetItemForm();
  };

  const handleSaveSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSupplier({ id: editingSupplier?.id || Date.now().toString(), name: supName, contact: supContact, category: supCategory });
    setSupName(''); setSupContact(''); setSupCategory(''); setIsAddingSupplier(false); setEditingSupplier(null);
  };

  const handleSaveSectorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSaveSector) {
      onSaveSector({ id: Date.now().toString(), name: sectorName, standardUniform: [] });
      setSectorName('');
      setIsAddingSector(false);
    }
  };

  const filteredItems = useMemo(() => enrichedInventory.filter(i => 
    (categoryFilter === 'Todos' || i.category === categoryFilter) &&
    (i.name.toLowerCase().includes(searchTerm.toLowerCase()) || (i.ean && i.ean.includes(searchTerm)))
  ), [enrichedInventory, categoryFilter, searchTerm]);

  const predictiveResults = useMemo(() => {
    if (!opSearchQuery || opSearchQuery.length < 2) return [];
    return sectorInventory.filter(i => 
      i.name.toLowerCase().includes(opSearchQuery.toLowerCase()) || 
      (i.ean && i.ean.includes(opSearchQuery))
    ).slice(0, 5);
  }, [sectorInventory, opSearchQuery]);

  const suggestedOrders = useMemo(() => enrichedInventory.filter(i => i.suggestion.suggestedQuantity > 0), [enrichedInventory]);

  const employeePredictive = useMemo(() => {
    if (!opRecipientName || opRecipientName.length < 2) return [];
    if (opIsExtra) {
      return extras.filter(e => e.name.toLowerCase().includes(opRecipientName.toLowerCase())).slice(0, 5);
    }
    return employees.filter(e => e.name.toLowerCase().includes(opRecipientName.toLowerCase())).slice(0, 5);
  }, [employees, extras, opRecipientName, opIsExtra]);

  const handleSelectPredictiveItem = (item: InventoryItem) => {
    setOpItemId(item.id);
    setOpSearchQuery(item.name);
    setIsSearchDropdownOpen(false);
  };

  const handleScanRecipient = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setOpRecipientName(val);
      
      if (opIsExtra) {
        const exactMatch = extras.find(ex => ex.name.toLowerCase() === val.toLowerCase());
        if (exactMatch) {
            setOpRecipientId(exactMatch.id);
            setOpRecipientName(exactMatch.name);
        } else {
            setOpRecipientId('');
        }
      } else {
        const exactMatch = employees.find(emp => emp.id === val || emp.name.toLowerCase() === val.toLowerCase());
        if(exactMatch) {
            setOpRecipientId(exactMatch.id);
            setOpRecipientName(exactMatch.name);
        } else {
            setOpRecipientId('');
        }
      }
  };

  // --- SECTOR SELECTION VIEW ---
  if (!selectedSectorId) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-20 max-w-7xl mx-auto px-4 md:px-8 pt-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Controle de Estoque</p>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsAddingSector(true)} 
              className="text-white px-6 py-3 rounded-xl font-bold flex items-center space-x-2 shadow-lg" 
              style={{ backgroundColor: theme.primary }}
            >
              <Plus size={18} /> <span>Novo Setor</span>
            </button>
          </div>
        </div>

        {/* GRUPO 1: SETORES ATIVOS (COM PRODUTOS) */}
        {activeSectors.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeSectors.map((sec) => (
              <div key={sec.id} className="relative group">
                {onDeleteSector && role !== 'FUNCIONARIO' && (
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setSectorToDelete(sec);
                    }}
                    className="absolute top-4 right-4 z-10 p-2 bg-white/90 rounded-full text-slate-300 hover:text-rose-500 hover:bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                    title="Excluir Setor"
                  >
                    <Trash2 size={16} />
                  </button>
                )}

                <button onClick={() => setSelectedSectorId(sec.id)} className="w-full bg-white h-48 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all border border-slate-50 flex flex-col items-center justify-center overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: theme.primary }}></div>
                  <div className="p-5 rounded-2xl mb-3 bg-slate-50 text-slate-400 group-hover:scale-110 transition-transform">
                    <Package size={32} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800">{sec.name}</h3>
                  <p className="text-slate-400 text-[10px] font-black uppercase mt-1">
                    {sectorCounts[sec.id] || 0} Itens em Estoque
                  </p>
                </button>
              </div>
            ))}
          </div>
        ) : (
           <div className="text-center py-10">
              <p className="text-slate-400 font-bold italic">Nenhum setor com estoque ativo. Comece adicionando um item abaixo.</p>
           </div>
        )}

        {/* GRUPO 2: SETORES VAZIOS (ESCONDIDOS/COLAPSÁVEIS) */}
        {emptySectors.length > 0 && (
          <div className="mt-8 border-t border-slate-100 pt-8">
            <button 
              onClick={() => setShowEmptySectors(!showEmptySectors)} 
              className="flex items-center space-x-2 text-slate-500 font-black text-xs uppercase tracking-widest hover:text-slate-800 transition-colors mb-4"
            >
              {showEmptySectors ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span>Iniciar Estoque em Novos Setores ({emptySectors.length})</span>
            </button>

            {showEmptySectors && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-in slide-in-from-top-2">
                {emptySectors.map((sec) => (
                  <div key={sec.id} className="relative group">
                    {onDeleteSector && role !== 'FUNCIONARIO' && (
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setSectorToDelete(sec);
                        }}
                        className="absolute top-2 right-2 z-10 p-1.5 bg-white rounded-full text-slate-300 hover:text-rose-500 hover:bg-rose-50 shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                    
                    <button 
                      onClick={() => { 
                         setSelectedSectorId(sec.id);
                         setIsAddingItem(true);
                      }} 
                      className="w-full bg-slate-50 hover:bg-white border-2 border-dashed border-slate-200 hover:border-blue-300 rounded-2xl p-4 flex flex-col items-center justify-center transition-all h-32 group-hover:shadow-md"
                    >
                      <PlusCircle size={24} className="text-slate-300 mb-2 group-hover:text-blue-500 transition-colors"/>
                      <span className="font-bold text-slate-600 text-sm text-center leading-tight">{sec.name}</span>
                      <span className="text-[8px] font-black text-slate-400 uppercase mt-1">Adicionar Item</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modals for Adding Sector/Confirm Delete (same as before) */}
        {isAddingSector && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[400] flex items-center justify-center p-4">
             <div className="bg-white w-[95%] md:w-full md:max-w-sm rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[90dvh]">
                <div className="p-6 md:p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 shrink-0">
                   <h3 className="font-black text-slate-800">Novo Setor de Estoque</h3>
                   <button onClick={() => setIsAddingSector(false)} className="text-slate-300 hover:text-slate-500 transition-colors"><X size={24}/></button>
                </div>
                <form onSubmit={handleSaveSectorSubmit} className="p-6 md:p-8 space-y-6 overflow-y-auto">
                   <div>
                     <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Nome do Setor</label>
                     <input 
                       type="text" 
                       value={sectorName} 
                       onChange={e => setSectorName(e.target.value)} 
                       placeholder="Ex: Manutenção" 
                       className="w-full px-5 py-4 rounded-2xl border-2 border-slate-50 font-bold text-slate-800 outline-none focus:border-blue-400 transition-all shadow-inner" 
                       required 
                     />
                   </div>
                   <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase shadow-xl hover:bg-slate-800 transition-all active:scale-95 shrink-0">Criar Setor</button>
                </form>
             </div>
          </div>
        )}

        {sectorToDelete && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-[95%] md:w-full md:max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200 border border-slate-100 flex flex-col max-h-[90dvh]">
              <div className="p-8 flex flex-col items-center text-center space-y-6 overflow-y-auto">
                <div className="p-6 bg-rose-50 text-rose-500 rounded-full shadow-inner shrink-0 scale-110">
                  <Trash2 size={40} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-800">Excluir Setor?</h3>
                  <p className="text-sm text-slate-500 font-bold leading-relaxed">
                    Você está prestes a remover o setor <br/><span className="text-slate-900 font-black">"{sectorToDelete.name}"</span>.
                  </p>
                  <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100 text-[10px] font-black uppercase tracking-wider flex items-center gap-3">
                    <AlertTriangle size={18} className="shrink-0"/>
                    <span className="text-left">Os itens vinculados não serão apagados, mas ficarão sem setor definido.</span>
                  </div>
                </div>
                <div className="flex gap-4 w-full pt-4 shrink-0">
                  <button onClick={() => setSectorToDelete(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase hover:bg-slate-200 transition-colors">Cancelar</button>
                  <button onClick={() => { if (onDeleteSector) onDeleteSector(sectorToDelete.id); setSectorToDelete(null); }} className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-rose-600 transition-colors active:scale-95">Confirmar</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- INVENTORY DETAIL VIEW ---
  const currentSector = sectors.find(s => s.id === selectedSectorId);

  return (
    <div className="space-y-4 md:space-y-6 animate-in slide-in-from-right-4 duration-500 pb-20 relative max-w-7xl mx-auto px-4 md:px-8 pt-8">
      
      {/* Header com Navegação e Valor Total - Agora Sticky */}
      <div className="sticky top-0 z-30 pt-2 md:pt-4 bg-slate-50/95 backdrop-blur-xl -mx-4 px-4 md:-mx-8 md:px-8 pb-4 space-y-3 md:space-y-4 shadow-sm border-b border-slate-200/50">
        <button 
           onClick={() => setSelectedSectorId(null)} 
           className="self-start flex items-center text-slate-400 hover:text-slate-800 transition-colors font-bold text-[10px] md:text-xs"
        >
           <ChevronLeft size={14} className="mr-1"/> Voltar para Setores
        </button>

        <div className="flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4 bg-white p-3 md:p-6 rounded-2xl md:rounded-[2rem] border border-slate-100 shadow-sm">
           <div className="flex items-center space-x-3 md:space-x-4">
              <div className="p-2.5 md:p-4 bg-slate-900 text-white rounded-xl md:rounded-2xl"><Package size={18} className="md:w-6 md:h-6"/></div>
              <div>
                 <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Estoque: {currentSector?.name}</p>
                 <h3 className="text-lg md:text-2xl font-black text-slate-800">R$ {globalTotalValue.toLocaleString('pt-BR')}</h3>
              </div>
           </div>
           <div className="flex bg-slate-100/50 p-1 rounded-xl md:rounded-2xl border border-slate-200/50 w-full md:w-auto overflow-x-auto no-scrollbar">
              {[
                { id: 'ESTOQUE', label: 'Itens', icon: Package },
                { id: 'OPERACAO', label: 'Movimentos', icon: History },
                { id: 'SUGESTAO', label: 'Pedidos', icon: ShoppingCart },
                ...(showSuppliersTab ? [{ id: 'FORNECEDORES', label: 'Fornecedores', icon: Truck }] : []),
                ...(role === 'GESTOR' ? [{ id: 'RELATORIOS', label: 'Relatórios', icon: BarChartIcon }] : [])
              ].map(tab => (
                <button 
                  key={tab.id} 
                  onClick={() => setActiveTab(tab.id as any)} 
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 md:px-4 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase transition-all whitespace-nowrap ${
                    activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <tab.icon size={12} className="md:w-3.5 md:h-3.5" /> <span>{tab.label}</span>
                </button>
              ))}
           </div>
        </div>

        {activeTab === 'ESTOQUE' && (
          <div className="flex flex-col md:flex-row gap-3 md:gap-4 justify-between items-center p-2 md:p-3 bg-white/60 border border-slate-200/40 rounded-xl md:rounded-2xl shadow-sm">
            <div className="flex gap-2 md:gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                <input 
                  type="text" 
                  placeholder="Buscar item..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="w-full pl-8 pr-3 py-2 rounded-lg md:rounded-xl border border-slate-100 outline-none text-xs md:text-sm font-bold bg-white focus:ring-2 focus:ring-slate-900/5 transition-all shadow-inner" 
                />
              </div>
              <select 
                value={categoryFilter} 
                onChange={e => setCategoryFilter(e.target.value)} 
                className="px-2 md:px-3 py-2 rounded-lg md:rounded-xl border border-slate-100 outline-none bg-white text-xs md:text-sm font-bold focus:ring-2 focus:ring-slate-900/5 transition-all shadow-inner"
              >
                <option value="Todos">Todas Categorias</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
               <button 
                 onClick={() => setIsAddingOp(true)} 
                 className="flex-1 md:w-auto bg-slate-900 text-white px-4 md:px-5 py-2 rounded-lg md:rounded-xl font-bold text-[10px] md:text-xs uppercase tracking-widest flex items-center justify-center space-x-1.5 md:space-x-2 shadow-lg hover:bg-slate-800 transition-all active:scale-95"
               >
                 <ArrowUpRight size={14} /> <span>Movimentar</span>
               </button>
               {role !== 'FUNCIONARIO' && (
                 <button 
                   onClick={() => setIsAddingItem(true)} 
                   className="flex-1 md:w-auto text-white px-4 md:px-5 py-2 rounded-lg md:rounded-xl font-bold text-[10px] md:text-xs uppercase tracking-widest flex items-center justify-center space-x-1.5 md:space-x-2 shadow-lg transition-all active:scale-95 hover:opacity-90" 
                   style={{ backgroundColor: theme.primary }}
                 >
                   <Plus size={14} /> <span>Novo Item</span>
                 </button>
               )}
            </div>
          </div>
        )}

        {/* Linha de Cabeçalhos - Agora integrada ao bloco fixo */}
        {activeTab === 'ESTOQUE' && (
          <div className="hidden md:grid grid-cols-[1fr_80px_120px_100px_100px_100px] gap-4 px-8 py-3 bg-slate-50/50 rounded-xl border border-slate-100 mt-2">
             <div className="flex items-center">
                <span className="bg-blue-600 text-white px-2 py-0.5 rounded-[4px] text-[8px] font-black uppercase tracking-tighter">Insumo</span>
             </div>
             <div className="flex items-center justify-center">
                <span className="bg-blue-600 text-white px-2 py-0.5 rounded-[4px] text-[8px] font-black uppercase tracking-tighter">Saldo</span>
             </div>
             <div className="flex items-center justify-center">
                <span className="bg-blue-600 text-white px-2 py-0.5 rounded-[4px] text-[8px] font-black uppercase tracking-tighter">Consumo Médio</span>
             </div>
             <div className="flex items-center justify-center">
                <span className="bg-blue-600 text-white px-2 py-0.5 rounded-[4px] text-[8px] font-black uppercase tracking-tighter">R$ Unit</span>
             </div>
             <div className="flex items-center justify-center">
                <span className="bg-blue-600 text-white px-2 py-0.5 rounded-[4px] text-[8px] font-black uppercase tracking-tighter">R$ Total</span>
             </div>
             <div className="flex items-center justify-end">
                <span className="bg-blue-600 text-white px-2 py-0.5 rounded-[4px] text-[8px] font-black uppercase tracking-tighter">Ações</span>
             </div>
          </div>
        )}
      </div>

      {activeTab === 'ESTOQUE' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-2">
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed">
                <colgroup>
                  <col />
                  <col style={{ width: '80px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '100px' }} />
                </colgroup>
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
                          <div className="flex justify-end items-center space-x-2">
                            <button 
                              onClick={() => { setEditingItem(item); setName(item.name); setEan(item.ean || ''); setCategory(item.category); setInitialQuantity(item.quantity); setUnit(item.unit); setPrice(item.price || 0); setSupplierId(item.supplierId || ''); setIsAddingItem(true); }} 
                              className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                              title="Editar Item"
                            >
                              <Edit2 size={16}/>
                            </button>
                            {role !== 'FUNCIONARIO' && (
                              <button 
                                onClick={() => onDelete(item.id)} 
                                className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                                title="Excluir Item"
                              >
                                <Trash2 size={16}/>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-50">
              {filteredItems.map(item => {
                const isLow = item.quantity <= item.minQuantity;
                return (
                  <div key={item.id} className="p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-black text-slate-800 text-base leading-tight">{item.name}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {item.ean && <span className="text-[8px] text-blue-500 font-black uppercase flex items-center bg-blue-50 px-1.5 py-0.5 rounded"><Barcode size={8} className="mr-1" /> {item.ean}</span>}
                          <span className="text-[8px] text-slate-400 font-bold uppercase bg-slate-50 px-1.5 py-0.5 rounded">{item.category}</span>
                          <span className="text-[8px] text-slate-400 font-bold uppercase bg-slate-50 px-1.5 py-0.5 rounded">{item.unit}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-black ${isLow ? 'text-rose-500' : 'text-slate-800'}`}>{item.quantity}</p>
                        <p className="text-[8px] font-black text-slate-400 uppercase">Saldo Atual</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 py-3 border-y border-slate-50">
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Consumo</p>
                        <p className="text-[10px] font-bold text-slate-600">{item.suggestion.mcd.toFixed(2)}/dia</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">R$ Unit</p>
                        <p className="text-[10px] font-bold text-slate-600">R$ {(item.price || 0).toLocaleString('pt-BR')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">R$ Total</p>
                        <p className="text-[10px] font-black text-slate-900">R$ {item.totalValue.toLocaleString('pt-BR')}</p>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-2">
                      <button 
                        onClick={() => { setEditingItem(item); setName(item.name); setEan(item.ean || ''); setCategory(item.category); setInitialQuantity(item.quantity); setUnit(item.unit); setPrice(item.price || 0); setSupplierId(item.supplierId || ''); setIsAddingItem(true); }} 
                        className="flex-1 py-3 bg-blue-50 text-blue-700 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center shadow-sm active:scale-95 transition-all"
                      >
                        <Edit2 size={14} className="mr-2"/> Editar
                      </button>
                      {role !== 'FUNCIONARIO' && (
                        <button 
                          onClick={() => onDelete(item.id)} 
                          className="flex-1 py-3 bg-rose-50 text-rose-700 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center shadow-sm active:scale-95 transition-all"
                        >
                          <Trash2 size={14} className="mr-2"/> Excluir
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredItems.length === 0 && (
                <div className="py-20 text-center text-slate-300 italic font-bold">
                    Nenhum item encontrado neste setor.
                </div>
            )}
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
                                <div className="flex flex-col md:flex-row md:items-center text-[10px] text-slate-400 font-bold uppercase gap-2">
                                   <span className="flex items-center"><UserIcon size={10} className="mr-1"/> {op.user}</span>
                                   <span className="flex items-center"><Calendar size={10} className="mr-1"/> {new Date(op.timestamp).toLocaleString()}</span>
                                   {op.recipientName && (
                                       <span className="flex items-center text-blue-500"><Scan size={10} className="mr-1"/> Retirado por: {op.recipientName}</span>
                                   )}
                                   {op.withdrawalLocation && (
                                       <span className="flex items-center text-amber-600"><MapPin size={10} className="mr-1"/> Destino: {op.withdrawalLocation}</span>
                                   )}
                                </div>
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
        <div className="space-y-6 animate-in slide-in-from-right-4">
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                 <div>
                    <h3 className="text-xl font-black text-slate-800 flex items-center"><ShoppingCart size={24} className="mr-3 text-slate-400"/> Sugestão de Compra</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Cálculo automático baseado na movimentação dos últimos 30 dias</p>
                 </div>
                 <button onClick={() => window.print()} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center"><Printer size={14} className="mr-2"/> Imprimir Pedido</button>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Produto</th>
                          <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Atual</th>
                          <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Sugestão</th>
                          <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Fornecedor</th>
                          <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">R$ Estimado</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {suggestedOrders.length === 0 ? (
                          <tr><td colSpan={5} className="py-20 text-center text-slate-300 italic font-bold">Nenhum item precisa de reposição no momento.</td></tr>
                       ) : (
                          suggestedOrders.map(item => {
                             const supplierName = suppliers.find(s => s.id === item.supplierId)?.name || 'Não Def.';
                             return (
                                <tr key={item.id} className="hover:bg-slate-50/50">
                                   <td className="px-6 py-4">
                                      <p className="font-black text-slate-800 text-xs">{item.name}</p>
                                      <p className="text-[9px] font-bold text-slate-400 uppercase">{item.category}</p>
                                   </td>
                                   <td className="px-6 py-4 text-center text-xs font-bold text-slate-600">{item.quantity}</td>
                                   <td className="px-6 py-4 text-center">
                                      <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-lg text-xs font-black">{item.suggestion.suggestedQuantity} {item.unit}</span>
                                      <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">{item.suggestion.reason}</p>
                                   </td>
                                   <td className="px-6 py-4 text-xs font-bold text-slate-600">{supplierName}</td>
                                   <td className="px-6 py-4 text-right text-xs font-black text-slate-800">R$ {(item.suggestion.suggestedQuantity * (item.price || 0)).toLocaleString('pt-BR')}</td>
                                </tr>
                             );
                          })
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'FORNECEDORES' && showSuppliersTab && (
         <div className="space-y-6 animate-in slide-in-from-right-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <button onClick={() => setIsAddingSupplier(true)} className="bg-white border-2 border-dashed border-slate-200 hover:border-blue-300 rounded-[2.5rem] flex flex-col items-center justify-center h-48 group transition-all">
                   <PlusCircle size={32} className="text-slate-300 group-hover:text-blue-500 mb-2 transition-colors"/>
                   <span className="font-black text-slate-400 group-hover:text-blue-600 text-xs uppercase tracking-widest">Novo Fornecedor</span>
                </button>
                {suppliers.map(sup => (
                   <div key={sup.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative group">
                      <div className="flex items-center space-x-4 mb-4">
                         <div className="p-4 bg-slate-50 rounded-2xl text-slate-400"><Truck size={24}/></div>
                         <div>
                            <h4 className="font-black text-slate-800 text-lg leading-tight">{sup.name}</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{sup.category}</p>
                         </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl text-xs font-bold text-slate-600 break-all">
                         {sup.contact || 'Sem contato'}
                      </div>
                      <div className="absolute top-4 right-4 flex space-x-2">
                         <button 
                            onClick={() => { setEditingSupplier(sup); setSupName(sup.name); setSupContact(sup.contact); setSupCategory(sup.category); setIsAddingSupplier(true); }} 
                            className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                         >
                            <Edit2 size={14}/>
                         </button>
                         {role !== 'FUNCIONARIO' && (
                            <button 
                               onClick={() => onDeleteSupplier(sup.id)} 
                               className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                            >
                               <Trash2 size={14}/>
                            </button>
                         )}
                      </div>
                   </div>
                ))}
            </div>
         </div>
      )}

      {activeTab === 'RELATORIOS' && role === 'GESTOR' && (
        <div className="space-y-6 animate-in slide-in-from-right-4">
           {/* Período de Análise */}
           <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-slate-400" />
                <span className="text-[10px] font-black text-slate-500 uppercase">Período de Análise</span>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={dashStartDate}
                  onChange={e => setDashStartDate(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-blue-400 transition-colors"
                />
                <span className="text-slate-300 font-bold px-1">até</span>
                <input 
                  type="date" 
                  value={dashEndDate}
                  onChange={e => setDashEndDate(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-blue-400 transition-colors"
                />
              </div>
           </div>

           {/* Summary Cards */}
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                 <div className="flex items-center space-x-3 mb-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Package size={20}/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Itens</p>
                 </div>
                 <h4 className="text-2xl font-black text-slate-800">{inventory.length}</h4>
              </div>
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                 <div className="flex items-center space-x-3 mb-4">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><DollarSign size={20}/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor em Estoque</p>
                 </div>
                 <h4 className="text-2xl font-black text-slate-800">R$ {globalTotalValue.toLocaleString('pt-BR')}</h4>
              </div>
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                 <div className="flex items-center space-x-3 mb-4">
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl"><ArrowDownRight size={20}/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Retiradas (30d)</p>
                 </div>
                 <h4 className="text-2xl font-black text-slate-800">
                    {history.filter(h => h.type === 'Saída' && h.timestamp > Date.now() - 30 * 24 * 60 * 60 * 1000).length}
                 </h4>
              </div>
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                 <div className="flex items-center space-x-3 mb-4">
                    <div className="p-3 bg-slate-900 text-white rounded-2xl"><Truck size={20}/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fornecedores</p>
                 </div>
                 <h4 className="text-2xl font-black text-slate-800">{suppliers.length}</h4>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Employees withdrawing materials */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                 <h4 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                    <UserIcon size={20} className="text-blue-500" /> Colaboradores que mais retiram
                 </h4>
                 <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart 
                          data={statsEmployees}
                          layout="vertical"
                          onClick={(data) => {
                            if (data && data.activeLabel) {
                              setSelectedReportEmployee(data.activeLabel);
                            }
                          }}
                       >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                          <XAxis type="number" hide />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={100} 
                            tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b', cursor: 'pointer' }} 
                            axisLine={false}
                            tickLine={false}
                            onClick={(data) => setSelectedReportEmployee(data.value)}
                          />
                          <Tooltip 
                             cursor={{ fill: '#f8fafc', cursor: 'pointer' }}
                             contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Bar dataKey="count" fill={theme.primary} radius={[0, 4, 4, 0]} barSize={20} className="cursor-pointer" />
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              {/* Modal de Histórico do Colaborador (Drill-down) */}
              {selectedReportEmployee && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                  >
                    <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                      <div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">Histórico de Retiradas</h3>
                        <p className="text-sm font-bold text-blue-500 uppercase tracking-widest">{selectedReportEmployee}</p>
                      </div>
                      <button onClick={() => setSelectedReportEmployee(null)} className="p-3 bg-white hover:bg-slate-100 rounded-2xl transition-all shadow-sm">
                        <X size={20} className="text-slate-400" />
                      </button>
                    </div>
                    
                    <div className="p-8 overflow-y-auto flex-1">
                      <div className="space-y-4">
                        {history
                          .filter(h => abbreviateName(h.recipientName || '') === selectedReportEmployee && h.type === 'Saída')
                          .sort((a, b) => b.timestamp - a.timestamp)
                          .map((entry, idx) => (
                            <div key={idx} className="flex items-center justify-between p-5 bg-slate-50 rounded-[1.5rem] border border-slate-100 hover:border-blue-100 hover:bg-white transition-all group">
                              <div className="flex items-center space-x-4">
                                <div className="p-3 bg-white rounded-xl shadow-sm text-slate-400 group-hover:text-blue-500 transition-colors">
                                  <Package size={18} />
                                </div>
                                <div>
                                  <h4 className="font-black text-slate-800">{entry.itemName}</h4>
                                  <div className="flex items-center gap-3 mt-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center">
                                      <Calendar size={10} className="mr-1" /> {new Date(entry.timestamp).toLocaleDateString('pt-BR')}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center">
                                      <History size={10} className="mr-1" /> {new Date(entry.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-lg font-black text-rose-500">-{entry.quantity}</span>
                                <p className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">RETIRADA</p>
                              </div>
                            </div>
                          ))}
                        
                        {history.filter(h => h.recipientName === selectedReportEmployee && h.type === 'Saída').length === 0 && (
                          <div className="text-center py-12">
                            <Package size={48} className="mx-auto text-slate-200 mb-4" />
                            <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Nenhuma retirada encontrada</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="p-6 border-t border-slate-50">
                      <button 
                        onClick={() => setSelectedReportEmployee(null)}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl"
                      >
                        Fechar Visualização
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* Top Withdrawn Products */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                 <h4 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                    <Activity size={20} className="text-rose-500" /> Produtos mais retirados (Qtd)
                 </h4>
                 <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart 
                          data={statsProducts}
                          onClick={(data) => {
                            if (data && data.activeLabel) {
                              const product = inventory.find(i => i.name === data.activeLabel);
                              if (product) {
                                setEditingItem(product);
                                setActiveTab('ESTOQUE');
                              }
                            }
                          }}
                       >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                             dataKey="name" 
                             tick={{ fontSize: 8, fontWeight: 'bold', fill: '#64748b' }} 
                             axisLine={false}
                             tickLine={false}
                          />
                          <YAxis hide />
                          <Tooltip 
                             cursor={{ fill: '#f8fafc' }}
                             contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Bar dataKey="qty" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={30} />
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              {/* Spending by Supplier (Current Stock Value) */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                 <h4 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                    <DollarSign size={20} className="text-emerald-500" /> Valor Stock por Fornecedor
                 </h4>
                 <div className="h-64 w-full flex flex-col items-center">
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie
                             data={statsSuppliers}
                             cx="50%"
                             cy="50%"
                             innerRadius={60}
                             outerRadius={80}
                             paddingAngle={5}
                             dataKey="value"
                          >
                             {['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].map((color, index) => (
                                <Cell key={`cell-${index}`} fill={color} />
                             ))}
                          </Pie>
                          <Tooltip 
                             formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
                             contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Legend verticalAlign="bottom" height={36} formatter={(value) => <span className="text-[10px] font-black text-slate-500">{value}</span>} />
                       </PieChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              {/* Stock Movement Trends (Daily entries vs exits) */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <h4 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                    <ArrowUpRight size={20} className="text-slate-900" /> Fluxo de Movimentação (7 dias)
                 </h4>
                 <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart 
                          data={statsTrends}
                       >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="day" tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <YAxis hide />
                          <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                          <Legend verticalAlign="top" iconType="circle" />
                          <Bar dataKey="entradas" fill="#10b981" radius={[4, 4, 0, 0]} name="Entradas" />
                          <Bar dataKey="saidas" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Saídas" />
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Modal FORNECEDOR */}
      {isAddingSupplier && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
           <div className="bg-white w-[95%] md:w-full md:max-w-lg rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[90dvh]">
              <div className="p-6 md:p-8 border-b border-slate-50 flex justify-between items-center shrink-0">
                 <h2 className="text-xl font-black text-slate-800">{editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h2>
                 <button onClick={() => setIsAddingSupplier(false)} className="text-slate-300 hover:text-slate-500 transition-colors"><X size={24}/></button>
              </div>
              <form onSubmit={handleSaveSupplierSubmit} className="p-6 md:p-8 space-y-6 overflow-y-auto">
                 <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Nome da Empresa</label>
                        <input type="text" value={supName} onChange={e => setSupName(e.target.value)} className="w-full px-5 py-4 rounded-xl border-2 border-slate-50 focus:border-blue-400 outline-none font-bold shadow-inner" placeholder="Ex: Fornecedor Ltda" required />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Contato (WhatsApp/Email)</label>
                        <input type="text" value={supContact} onChange={e => setSupContact(e.target.value)} className="w-full px-5 py-4 rounded-xl border-2 border-slate-50 focus:border-blue-400 outline-none font-bold shadow-inner" placeholder="Ex: (11) 99999-9999" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Categoria</label>
                        <input type="text" value={supCategory} onChange={e => setSupCategory(e.target.value)} className="w-full px-5 py-4 rounded-xl border-2 border-slate-50 focus:border-blue-400 outline-none font-bold shadow-inner" placeholder="Ex: Limpeza / Bebidas" />
                    </div>
                 </div>
                 <button type="submit" className="w-full py-5 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95 shrink-0" style={{ backgroundColor: theme.primary }}>
                    {editingSupplier ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
                 </button>
              </form>
           </div>
        </div>
      )}


      {/* Modal NOVO ITEM */}
      {isAddingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
           <div className="bg-white w-[95%] md:w-full md:max-w-lg rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[90dvh]">
              <div className="p-6 md:p-8 border-b border-slate-50 flex justify-between items-center shrink-0">
                 <div className="flex flex-col">
                    <h2 className="text-xl font-black text-slate-800">{editingItem ? 'Editar Insumo' : 'Novo Insumo'}</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{currentSector?.name}</p>
                 </div>
                 <button onClick={resetItemForm} className="text-slate-300 hover:text-slate-500 transition-colors"><X size={24}/></button>
              </div>
              <form onSubmit={handleSaveItemSubmit} className="p-6 md:p-8 space-y-6 overflow-y-auto">
                 <div className="space-y-5">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Nome do Insumo</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-5 py-3 rounded-2xl border-2 border-slate-50 focus:border-blue-400 outline-none font-bold shadow-inner" placeholder="Ex: Papel Interfolha" required />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Código de Barras (EAN)</label>
                        <div className="relative">
                            <Barcode size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                            <input type="text" value={ean} onChange={e => setEan(e.target.value)} className="w-full pl-11 pr-5 py-3 rounded-2xl border-2 border-slate-50 focus:border-blue-400 outline-none font-bold shadow-inner" placeholder="Obrigatório para bipe" required />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Categoria</label>
                            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-4 py-3 rounded-2xl border-2 border-slate-50 bg-white font-bold text-slate-700 outline-none focus:border-blue-400 shadow-inner">
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Unidade</label>
                            <select value={unit} onChange={e => setUnit(e.target.value)} className="w-full px-4 py-3 rounded-2xl border-2 border-slate-50 bg-white font-bold text-slate-700 outline-none focus:border-blue-400 shadow-inner">
                                <option value="Unidade">Unidade</option>
                                <option value="Caixa">Caixa</option>
                                <option value="Litro">Litro</option>
                                <option value="Kg">Kg</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Fornecedor Preferencial</label>
                        <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full px-4 py-3 rounded-2xl border-2 border-slate-50 bg-white font-bold text-slate-700 outline-none focus:border-blue-400 shadow-inner">
                            <option value="">Selecione...</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-4 bg-slate-50 rounded-[1.5rem] border border-slate-100 flex flex-col">
                          <label className="text-[9px] font-black text-slate-400 uppercase mb-1">Saldo Atual</label>
                          <input type="number" value={initialQuantity} onChange={e => setInitialQuantity(parseInt(e.target.value) || 0)} className="bg-transparent text-xl font-black outline-none text-slate-800" />
                       </div>
                       <div className="p-4 bg-slate-50 rounded-[1.5rem] border border-slate-100 flex flex-col">
                          <label className="text-[9px] font-black text-slate-400 uppercase mb-1">Valor Unit (R$)</label>
                          <input type="number" step="0.01" value={price} onChange={e => setPrice(parseFloat(e.target.value) || 0)} className="bg-transparent text-xl font-black outline-none text-slate-800" />
                       </div>
                    </div>
                 </div>
                 <button type="submit" className="w-full py-5 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95 shrink-0" style={{ backgroundColor: theme.primary }}>
                    {editingItem ? 'Salvar Alterações' : 'Cadastrar Insumo'}
                 </button>
              </form>
           </div>
        </div>
      )}

      {isAddingOp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
            <div className="bg-white w-[95%] md:w-full md:max-w-lg rounded-2xl md:rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[90dvh]">
              <div className="p-6 md:p-8 border-b border-slate-50 flex justify-between items-center shrink-0">
                 <h2 className="text-xl font-black text-slate-800">Lançar Movimentação</h2>
                 <button onClick={resetOpForm} className="text-slate-300 hover:text-slate-500 transition-colors"><X size={24}/></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const selectedItem = inventory.find(i => i.id === opItemId);
                if (!selectedItem || opQuantity <= 0) return;
                
                let finalRecipientName = opRecipientName || (opType === 'Saída' ? 'Não Identificado' : '');
                let finalRecipientId = opRecipientId;

                // Handle new Extra worker saving
                if (opIsExtra && opRecipientName && !opRecipientId && onSaveExtra) {
                  const newExtraId = `extra_${Date.now()}`;
                  onSaveExtra({
                    id: newExtraId,
                    name: opRecipientName,
                    phone: '',
                    availability: [],
                    serviceQuality: 0,
                    observation: 'Cadastrado via Saída de Estoque',
                    sectorId: selectedSectorId || ''
                  });
                  finalRecipientId = newExtraId;
                }

                onOperation({ 
                    id: Date.now().toString(), 
                    itemId: opItemId, 
                    itemName: selectedItem.name, 
                    type: opType, 
                    quantity: opQuantity, 
                    timestamp: Date.now(), 
                    user: currentUser || 'Sistema', 
                    reason: opReason,
                    recipientId: withdrawalMode === 'PERSON' ? finalRecipientId : undefined,
                    recipientName: withdrawalMode === 'PERSON' ? finalRecipientName : undefined,
                    withdrawalLocation: withdrawalMode === 'LOCATION' ? opWithdrawalLocation : undefined
                });
                resetOpForm();
              }} className="p-6 md:p-8 space-y-6 overflow-y-auto">
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
                            className="w-full pl-9 pr-4 py-3 rounded-xl border-2 border-slate-50 font-bold outline-none focus:border-blue-300 transition-all bg-white text-slate-800" 
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
                       <input type="number" value={opQuantity || ''} onChange={e => setOpQuantity(parseInt(e.target.value) || 0)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 font-bold outline-none bg-white text-slate-800" placeholder="Quantidade" required />
                    </div>

                    {opType === 'Saída' && (
                        <div className="space-y-4">
                            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                                <button type="button" onClick={() => setWithdrawalMode('PERSON')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${withdrawalMode === 'PERSON' ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400'}`}>Pessoa</button>
                                <button type="button" onClick={() => setWithdrawalMode('LOCATION')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${withdrawalMode === 'LOCATION' ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400'}`}>Local / Setor</button>
                            </div>

                            {withdrawalMode === 'PERSON' ? (
                                <div className="relative">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                          <span>Retirado por ({opIsExtra ? 'Extra' : 'Funcionário'})</span>
                                          <button 
                                            type="button"
                                            onClick={() => { setOpIsExtra(!opIsExtra); setOpRecipientId(''); setOpRecipientName(''); }}
                                            className={`px-3 py-1.5 rounded-full text-xs font-black uppercase transition-all tracking-tighter flex items-center ${opIsExtra ? 'bg-amber-100 text-amber-600 border border-amber-200' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}
                                          >
                                            <Sparkles size={12} className="mr-1"/> Extra
                                          </button>
                                        </div>
                                        <span className="flex items-center text-blue-500"><QrCode size={10} className="mr-1"/> Scan Ativo</span>
                                    </label>
                                    <div className="relative">
                                        {opIsExtra ? (
                                          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" size={16} />
                                        ) : (
                                          <Scan className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                        )}
                                        <input 
                                            ref={recipientInputRef}
                                            type="text" 
                                            value={opRecipientName} 
                                            onChange={handleScanRecipient}
                                            className={`w-full pl-9 pr-4 py-3 rounded-xl border-2 font-bold outline-none focus:border-blue-300 transition-all text-slate-800 ${opIsExtra ? 'bg-amber-50/50 border-amber-100' : 'bg-blue-50/50 border-slate-50'}`}
                                            placeholder={opIsExtra ? "Digite o nome do extra..." : "Bipe o Crachá ou digite o nome..."} 
                                            autoComplete="off"
                                        />
                                        {opRecipientName && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                {opRecipientId ? (
                                                    <CheckCircle2 size={18} className="text-emerald-500" />
                                                ) : (
                                                    <span className="text-[9px] font-bold text-slate-400">{opIsExtra ? 'Novo Extra' : 'Manual'}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {/* Autocomplete for employees or extras if typing manually */}
                                    {opRecipientName && !opRecipientId && employeePredictive.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-slate-100 z-[320] overflow-hidden">
                                            {employeePredictive.map((emp: any) => (
                                                <button 
                                                    key={emp.id} 
                                                    type="button" 
                                                    onClick={() => { setOpRecipientId(emp.id); setOpRecipientName(emp.name); }}
                                                    className="w-full p-3 text-left hover:bg-slate-50 text-xs font-bold text-slate-700 border-b last:border-none"
                                                >
                                                    {emp.name} <span className="text-slate-400">({emp.role || 'Extra'})</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Destino da Retirada</label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {['Diluidor', 'Prateleira de Retirada', 'Governança', 'Manutenção', 'Recepção'].map(loc => (
                                            <button 
                                                key={loc}
                                                type="button"
                                                onClick={() => setOpWithdrawalLocation(loc)}
                                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${opWithdrawalLocation === loc ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-slate-500 border-slate-100 font-bold'}`}
                                            >
                                                {loc}
                                            </button>
                                        ))}
                                    </div>
                                    <input 
                                        type="text" 
                                        value={opWithdrawalLocation}
                                        onChange={e => setOpWithdrawalLocation(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 font-bold outline-none focus:border-blue-300 transition-all bg-white text-slate-800"
                                        placeholder="Outro local ou descrição do destino..."
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <input type="text" value={opReason} onChange={e => setOpReason(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 font-bold outline-none bg-white text-slate-800" placeholder="Motivo / Justificativa" />
                 </div>
                 <button type="submit" disabled={!opItemId} className="w-full py-5 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:grayscale shrink-0" style={{ backgroundColor: theme.primary }}>Confirmar Movimentação</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default InventoryView;
