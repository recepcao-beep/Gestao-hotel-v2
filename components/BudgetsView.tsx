
import React, { useState, useRef, useMemo } from 'react';
import { Budget, Quote, BudgetFile, HotelTheme, BudgetItem, MaterialItem, MaterialQuote } from '../types';
import { 
  Plus, 
  Search, 
  Receipt, 
  Trash2, 
  ChevronDown,
  ChevronUp,
  X,
  Clock,
  Layers,
  Wrench,
  Calculator,
  Edit2,
  User as UserIcon,
  CheckCircle2,
  Package,
  MessageSquare,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Filter
} from 'lucide-react';

interface BudgetsViewProps {
  budgets: Budget[];
  theme: HotelTheme;
  onSave: (budget: Budget, newFiles?: {data: string, mimeType: string, fileName: string}[]) => void;
  onDelete: (id: string) => void;
}

const BudgetsView: React.FC<BudgetsViewProps> = ({ budgets, theme, onSave, onDelete }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'Pendente' | 'Aprovado' | 'Rejeitado'>('Pendente');
  
  // Form State
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [items, setItems] = useState<BudgetItem[]>([
    { id: '1', description: '', materials: [], laborCost: 0, estimatedTime: '', serviceProvider: '' }
  ]);
  const [status, setStatus] = useState<'Pendente' | 'Aprovado' | 'Rejeitado'>('Pendente');

  const resetForm = () => {
    setTitle('');
    setObjective('');
    setItems([{ id: '1', description: '', materials: [], laborCost: 0, estimatedTime: '', serviceProvider: '' }]);
    setStatus('Pendente');
    setIsAdding(false);
    setEditingBudget(null);
  };

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    setTitle(budget.title);
    setObjective(budget.objective);
    setItems((budget.items || []).map(it => ({ 
      ...it, 
      serviceProvider: it.serviceProvider || '',
      estimatedTime: it.estimatedTime || '',
      materials: (it.materials || []).map(m => ({
        ...m,
        observation: m.observation || '',
        quotes: (m.quotes && m.quotes.length === 3) 
          ? m.quotes 
          : [{ supplier: '', value: 0 }, { supplier: '', value: 0 }, { supplier: '', value: 0 }]
      }))
    })));
    setStatus(budget.status);
    setIsAdding(true);
  };

  const updateStatus = (budget: Budget, newStatus: 'Pendente' | 'Aprovado' | 'Rejeitado') => {
    onSave({ ...budget, status: newStatus });
  };

  const addServiceItem = () => {
    setItems([...items, { id: Date.now().toString(), description: '', materials: [], laborCost: 0, estimatedTime: '', serviceProvider: '' }]);
  };

  const removeServiceItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof BudgetItem, value: any) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const addMaterial = (itemId: string) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          materials: [...(item.materials || []), { 
            id: Date.now().toString(), 
            name: '', 
            quantity: 1, 
            unit: 'Un',
            observation: '',
            quotes: [{ supplier: '', value: 0 }, { supplier: '', value: 0 }, { supplier: '', value: 0 }]
          }]
        };
      }
      return item;
    }));
  };

  const removeMaterial = (itemId: string, matId: string) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        return { ...item, materials: (item.materials || []).filter(m => m.id !== matId) };
      }
      return item;
    }));
  };

  const updateMaterial = (itemId: string, matId: string, field: keyof MaterialItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          materials: (item.materials || []).map(m => m.id === matId ? { ...m, [field]: value } : m)
        };
      }
      return item;
    }));
  };

  const updateMaterialQuote = (itemId: string, matId: string, quoteIdx: number, field: keyof MaterialQuote, value: any) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          materials: (item.materials || []).map(m => {
            if (m.id === matId) {
              const currentQuotes = m.quotes || [{ supplier: '', value: 0 }, { supplier: '', value: 0 }, { supplier: '', value: 0 }];
              const newQuotes = [...currentQuotes];
              newQuotes[quoteIdx] = { ...newQuotes[quoteIdx], [field]: value };
              return { ...m, quotes: newQuotes };
            }
            return m;
          })
        };
      }
      return item;
    }));
  };

  const getBestMaterialPrice = (m: MaterialItem) => {
    const validPrices = (m.quotes || []).map(q => Number(q.value) || 0).filter(v => v > 0);
    if (validPrices.length === 0) return 0;
    return Math.min(...validPrices);
  };

  const calculateItemSubtotal = (item: BudgetItem) => {
    const materialsTotal = (item.materials || []).reduce((acc, m) => {
      const bestPrice = getBestMaterialPrice(m);
      return acc + (m.quantity * bestPrice);
    }, 0);
    return materialsTotal + (Number(item.laborCost) || 0);
  };

  const calculateTotals = (budgetItems: BudgetItem[]) => {
    let totalPrice = 0;
    let totalDays = 0;
    (budgetItems || []).forEach(item => {
      totalPrice += calculateItemSubtotal(item);
      const daysMatch = item.estimatedTime?.match(/\d+/);
      totalDays += daysMatch ? parseInt(daysMatch[0]) : 0;
    });
    return { totalPrice, totalDays };
  };

  const formTotals = useMemo(() => calculateTotals(items), [items]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalBudget: Budget = {
      id: editingBudget?.id || Date.now().toString(),
      title: title || 'Novo Orçamento',
      objective,
      items,
      quotes: [],
      status,
      createdAt: editingBudget?.createdAt || Date.now()
    };
    onSave(finalBudget);
    resetForm();
  };

  const filteredBudgets = budgets.filter(b => 
    b.status === activeTab &&
    (b.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
     b.objective.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm w-full md:w-auto">
          {['Pendente', 'Aprovado', 'Rejeitado'].map((s) => (
            <button key={s} onClick={() => setActiveTab(s as any)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === s ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
              {s}s ({budgets.filter(b => b.status === s).length})
            </button>
          ))}
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <input type="text" placeholder="Filtrar orçamentos..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-100 outline-none text-xs font-bold bg-white" />
          </div>
          <button onClick={() => { resetForm(); setIsAdding(true); }} className="text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center space-x-2 shadow-lg" style={{ backgroundColor: theme.primary }}>
            <Plus size={18} /> <span>Novo</span>
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-6xl rounded-[2.5rem] shadow-2xl max-h-[95vh] overflow-y-auto p-8 animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-6">
              <h2 className="text-2xl font-black text-slate-800">{editingBudget ? 'Editar Orçamento' : 'Novo Orçamento'}</h2>
              <button onClick={resetForm} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-[2rem]">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Título do Projeto</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Reforma Apto 205" className="w-full px-5 py-3 rounded-xl border-2 border-white font-bold text-slate-800" />
                </div>
              </div>

              <div className="space-y-8">
                 {items.map((item) => (
                   <div key={item.id} className="p-8 bg-white rounded-[3rem] border-2 border-slate-50 relative shadow-sm">
                      <button type="button" onClick={() => removeServiceItem(item.id)} className="absolute top-8 right-8 text-slate-300 hover:text-rose-500"><Trash2 size={24}/></button>
                      <div className="space-y-8">
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">Descrição do Serviço</label>
                          <input type="text" value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} placeholder="Ex: Pintura Completa" className="w-full px-5 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-sm font-black" />
                        </div>

                        <div className="space-y-4">
                           <div className="flex justify-between items-center px-2">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center"><Package size={14} className="mr-2"/> Materiais Utilizados</p>
                              <button type="button" onClick={() => addMaterial(item.id)} className="text-[10px] font-black text-blue-600 uppercase flex items-center"><Plus size={14} className="mr-1"/> Adicionar Material</button>
                           </div>
                           
                           <div className="space-y-6">
                              {(item.materials || []).map((mat) => {
                                const bestPrice = getBestMaterialPrice(mat);
                                return (
                                  <div key={mat.id} className="p-6 bg-slate-50/30 rounded-[2.5rem] border border-slate-100 space-y-6">
                                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                       <div className="md:col-span-2">
                                          <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Material</label>
                                          <input type="text" value={mat.name} onChange={e => updateMaterial(item.id, mat.id, 'name', e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold" />
                                       </div>
                                       <div>
                                          <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Qtd / Medida</label>
                                          <div className="flex gap-1">
                                            <input type="number" value={mat.quantity} onChange={e => updateMaterial(item.id, mat.id, 'quantity', parseFloat(e.target.value))} className="w-2/3 px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold" />
                                            <input type="text" value={mat.unit || ''} onChange={e => updateMaterial(item.id, mat.id, 'unit', e.target.value)} placeholder="Un/m²" className="w-1/3 px-2 py-2.5 rounded-xl border border-slate-200 text-[10px] font-bold text-center" />
                                          </div>
                                       </div>
                                       <div className="text-right pb-1">
                                          <button type="button" onClick={() => removeMaterial(item.id, mat.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={20}/></button>
                                       </div>
                                     </div>

                                     <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                       {(mat.quotes || []).map((quote, qIdx) => (
                                         <div key={qIdx} className={`p-4 rounded-2xl border-2 transition-all ${Number(quote.value) > 0 && Number(quote.value) === bestPrice ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-white border-white'}`}>
                                           <div className="flex items-center justify-between mb-2">
                                             <span className="text-[8px] font-black text-slate-400 uppercase">Fornecedor {qIdx + 1}</span>
                                             {Number(quote.value) > 0 && Number(quote.value) === bestPrice && <TrendingDown size={14} className="text-emerald-500" />}
                                           </div>
                                           <input type="text" value={quote.supplier} onChange={e => updateMaterialQuote(item.id, mat.id, qIdx, 'supplier', e.target.value)} placeholder="Empresa" className="w-full px-3 py-1.5 mb-2 rounded-lg border border-slate-100 text-[10px] font-bold" />
                                           <div className="relative">
                                             <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-300 font-black">R$</span>
                                             <input type="number" step="0.01" value={quote.value || ''} onChange={e => updateMaterialQuote(item.id, mat.id, qIdx, 'value', parseFloat(e.target.value))} className="w-full pl-6 pr-3 py-1.5 rounded-lg border border-slate-100 text-[10px] font-bold" />
                                           </div>
                                         </div>
                                       ))}
                                     </div>

                                     <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-4 border-t border-slate-100">
                                        <div className="flex-1 w-full">
                                           <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Observação do Material</label>
                                           <textarea value={mat.observation || ''} onChange={e => updateMaterial(item.id, mat.id, 'observation', e.target.value)} placeholder="Notas técnicas..." className="w-full px-4 py-2 rounded-xl border border-slate-100 bg-white text-[10px] font-bold h-12" />
                                        </div>
                                        <div className="bg-emerald-500 text-white px-6 py-4 rounded-[1.5rem] shadow-lg text-right min-w-[180px]">
                                           <p className="text-[8px] font-black uppercase opacity-60">Subtotal ({mat.unit})</p>
                                           <p className="text-lg font-black leading-none mt-1">R$ {(mat.quantity * bestPrice).toLocaleString('pt-BR')}</p>
                                        </div>
                                     </div>
                                  </div>
                                );
                              })}
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-8 border-t-2 border-slate-50">
                           <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase mb-2">Prestador Escolhido</label>
                              <input type="text" value={item.serviceProvider || ''} onChange={e => updateItem(item.id, 'serviceProvider', e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 font-bold text-xs" />
                           </div>
                           <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase mb-2">Prazo Total Estimado</label>
                              <input type="text" placeholder="Ex: 5 dias" value={item.estimatedTime || ''} onChange={e => updateItem(item.id, 'estimatedTime', e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 font-bold text-xs" />
                           </div>
                           <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase mb-2">R$ Mão de Obra</label>
                              <input type="number" step="0.01" value={item.laborCost || ''} onChange={e => updateItem(item.id, 'laborCost', e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 font-bold text-xs" />
                           </div>
                           <div className="flex flex-col justify-end text-right">
                              <p className="text-[9px] font-black text-slate-300 uppercase">Custo do Serviço</p>
                              <p className="text-2xl font-black text-blue-600">R$ {calculateItemSubtotal(item).toLocaleString('pt-BR')}</p>
                           </div>
                        </div>
                      </div>
                   </div>
                 ))}
                 <button type="button" onClick={addServiceItem} className="w-full py-6 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-slate-400 text-xs font-black uppercase hover:bg-slate-50">+ Novo Serviço</button>
              </div>

              <div className="bg-slate-900 text-white p-10 rounded-[3rem] flex flex-col md:flex-row justify-between items-center gap-8 shadow-2xl relative overflow-hidden">
                 <div className="flex flex-wrap items-center gap-12 relative z-10">
                    <div>
                       <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Valor Total</p>
                       <h4 className="text-4xl font-black text-emerald-400">R$ {formTotals.totalPrice.toLocaleString('pt-BR')}</h4>
                    </div>
                    <div className="border-l border-white/10 pl-12">
                       <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Prazo Acumulado</p>
                       <h4 className="text-4xl font-black text-blue-400">{formTotals.totalDays} dias</h4>
                    </div>
                 </div>
                 <button type="submit" className="flex-1 md:flex-none px-12 py-5 rounded-2xl font-black text-xs uppercase tracking-widest bg-emerald-500 hover:bg-emerald-400 shadow-xl transition-all active:scale-95">Salvar Projeto Completo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {filteredBudgets.map(budget => {
          const { totalPrice, totalDays } = calculateTotals(budget.items);
          return (
            <div key={budget.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all overflow-hidden">
              <div className="p-6 md:p-8 cursor-pointer" onClick={() => setExpandedId(expandedId === budget.id ? null : budget.id)}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center space-x-6">
                    <div className="p-5 bg-slate-50 text-slate-900 rounded-[1.5rem] border border-slate-100"><Receipt size={28} /></div>
                    <div>
                      <h4 className="font-black text-slate-800 text-xl leading-none mb-2">{budget.title}</h4>
                      <div className="flex items-center space-x-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span className="flex items-center"><Layers size={12} className="mr-1" /> {(budget.items || []).length} Serviços</span>
                        <span className="flex items-center"><Clock size={12} className="mr-1" /> {totalDays} dias totais</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between md:justify-end space-x-8">
                    <div className="text-right">
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Investimento Estimado</p>
                      <p className="text-2xl font-black text-blue-600 leading-none mt-1">R$ {totalPrice.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(budget); }} className="p-3 text-slate-300 hover:text-blue-500 bg-slate-50 rounded-xl"><Edit2 size={20} /></button>
                      {expandedId === budget.id ? <ChevronUp size={24} className="text-slate-300" /> : <ChevronDown size={24} className="text-slate-300" />}
                    </div>
                  </div>
                </div>
              </div>

              {expandedId === budget.id && (
                <div className="px-8 pb-10 pt-4 border-t border-slate-50 animate-in slide-in-from-top-4 bg-slate-50/30">
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <div className="lg:col-span-3 space-y-4">
                      {(budget.items || []).map((item, idx) => (
                        <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                           <h6 className="font-black text-slate-800 mb-4 flex items-center justify-between">
                             <span>{item.description}</span>
                             <span className="text-xs text-blue-600">R$ {calculateItemSubtotal(item).toLocaleString('pt-BR')}</span>
                           </h6>
                           <div className="space-y-3">
                              {(item.materials || []).map(m => {
                                const best = getBestMaterialPrice(m);
                                return (
                                  <div key={m.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-[10px] font-black text-slate-600">{m.quantity}{m.unit} • {m.name}</span>
                                      <span className="text-emerald-600 font-black text-xs">R$ {(m.quantity * best).toLocaleString('pt-BR')}</span>
                                    </div>
                                    {m.observation && <p className="text-[8px] font-bold text-slate-400 italic">Nota: {m.observation}</p>}
                                  </div>
                                );
                              })}
                           </div>
                           <div className="mt-4 pt-4 border-t border-slate-50 grid grid-cols-2 md:grid-cols-3 gap-2 text-[9px] font-black uppercase text-slate-400">
                              <span>Prestador: <span className="text-slate-900">{item.serviceProvider}</span></span>
                              <span>Prazo: <span className="text-slate-900">{item.estimatedTime}</span></span>
                              <span>Mão de Obra: <span className="text-slate-900">R$ {item.laborCost.toLocaleString('pt-BR')}</span></span>
                           </div>
                        </div>
                      ))}
                    </div>
                    <div className="lg:col-span-1 space-y-4">
                       <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4 sticky top-4">
                          <button onClick={() => updateStatus(budget, 'Aprovado')} className="w-full py-4 rounded-xl bg-emerald-500 text-white font-black text-xs uppercase shadow-lg flex items-center justify-center space-x-2"><CheckCircle2 size={16}/> <span>Aprovar</span></button>
                          <button onClick={() => updateStatus(budget, 'Rejeitado')} className="w-full py-4 rounded-xl bg-rose-500 text-white font-black text-xs uppercase shadow-lg flex items-center justify-center space-x-2"><X size={16}/> <span>Rejeitar</span></button>
                          <button onClick={() => onDelete(budget.id)} className="w-full py-2 text-slate-300 hover:text-rose-500 text-[10px] font-black uppercase">Excluir Orçamento</button>
                       </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BudgetsView;
