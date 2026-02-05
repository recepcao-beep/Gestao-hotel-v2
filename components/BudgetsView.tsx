
import React, { useState, useRef, useMemo } from 'react';
import { Budget, Quote, BudgetFile, HotelTheme, BudgetItem, MaterialItem } from '../types';
import { 
  Plus, 
  Search, 
  Receipt, 
  Trash2, 
  DollarSign, 
  ChevronDown,
  ChevronUp,
  X,
  Clock,
  Paperclip,
  File,
  Info,
  Layers,
  Wrench,
  Calendar,
  MessageSquare,
  Truck,
  Calculator
} from 'lucide-react';

interface BudgetsViewProps {
  budgets: Budget[];
  theme: HotelTheme;
  onSave: (budget: Budget, newFiles?: {data: string, mimeType: string, fileName: string}[]) => void;
  onDelete: (id: string) => void;
}

const BudgetsView: React.FC<BudgetsViewProps> = ({ budgets, theme, onSave, onDelete }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Form State
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [items, setItems] = useState<BudgetItem[]>([
    { id: '1', description: '', materials: [], laborCost: 0, estimatedTime: '' }
  ]);
  const [quotes, setQuotes] = useState<Partial<Quote>[]>([
    { id: '1', supplier: '', value: 0, files: [] },
    { id: '2', supplier: '', value: 0, files: [] },
    { id: '3', supplier: '', value: 0, files: [] }
  ]);
  const [status, setStatus] = useState<'Pendente' | 'Aprovado' | 'Rejeitado'>('Pendente');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentQuoteIndexRef = useRef<number | null>(null);

  const resetForm = () => {
    setTitle('');
    setObjective('');
    setItems([{ id: '1', description: '', materials: [], laborCost: 0, estimatedTime: '' }]);
    setQuotes([
      { id: '1', supplier: '', value: 0, files: [] },
      { id: '2', supplier: '', value: 0, files: [] },
      { id: '3', supplier: '', value: 0, files: [] }
    ]);
    setStatus('Pendente');
    setIsAdding(false);
  };

  const addServiceItem = () => {
    setItems([...items, { id: Date.now().toString(), description: '', materials: [], laborCost: 0, estimatedTime: '' }]);
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
          materials: [...item.materials, { 
            id: Date.now().toString(), 
            name: '', 
            quantity: 1, 
            price: 0,
            unit: 'Un',
            supplier: '',
            observation: ''
          }]
        };
      }
      return item;
    }));
  };

  const updateMaterial = (itemId: string, matId: string, field: keyof MaterialItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          materials: item.materials.map(m => m.id === matId ? { ...m, [field]: value } : m)
        };
      }
      return item;
    }));
  };

  const removeMaterial = (itemId: string, matId: string) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        return { ...item, materials: item.materials.filter(m => m.id !== matId) };
      }
      return item;
    }));
  };

  const updateQuote = (index: number, field: keyof Quote, value: any) => {
    const newQuotes = [...quotes];
    newQuotes[index] = { ...newQuotes[index], [field]: value };
    setQuotes(newQuotes);
  };

  const calculateItemSubtotal = (item: BudgetItem) => {
    const materialsTotal = item.materials.reduce((acc, m) => acc + (m.quantity * (m.price || 0)), 0);
    return materialsTotal + (Number(item.laborCost) || 0);
  };

  const totalCalculated = useMemo(() => {
    return items.reduce((acc, item) => acc + calculateItemSubtotal(item), 0);
  }, [items]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalBudget: Budget = {
      id: Date.now().toString(),
      title: title || 'Novo Orçamento',
      objective,
      items,
      quotes: (quotes as Quote[]).filter(q => q.supplier || q.value > 0),
      status,
      createdAt: Date.now()
    };

    const allFilesForSync: {data: string, mimeType: string, fileName: string}[] = [];
    quotes.forEach(q => {
      q.files?.forEach(f => {
        if (f.data) {
          allFilesForSync.push({ data: f.data, mimeType: f.fileType!, fileName: f.fileName! });
        }
      });
    });

    onSave(finalBudget, allFilesForSync);
    resetForm();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const quoteIndex = currentQuoteIndexRef.current;
    if (file && quoteIndex !== null) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result?.toString().split(',')[1] || '';
        const newBudgetFile: BudgetFile = {
          id: Date.now().toString(),
          driveLink: 'pendente',
          timestamp: Date.now(),
          fileName: file.name,
          fileType: file.type,
          data: base64Data
        };
        const newQuotes = [...quotes];
        newQuotes[quoteIndex].files = [...(newQuotes[quoteIndex].files || []), newBudgetFile];
        setQuotes(newQuotes);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const updateStatus = (budget: Budget, newStatus: 'Pendente' | 'Aprovado' | 'Rejeitado') => {
    onSave({ ...budget, status: newStatus });
  };

  const filteredBudgets = budgets.filter(b => 
    b.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusStyle = (s: string) => {
    switch(s) {
      case 'Aprovado': return 'bg-emerald-500 text-white border-emerald-500';
      case 'Rejeitado': return 'bg-rose-500 text-white border-rose-500';
      default: return 'bg-amber-400 text-slate-800 border-amber-400';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="Buscar orçamentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none shadow-sm transition-all bg-white text-slate-800 font-bold"
          />
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="w-full md:w-auto text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center space-x-2 shadow-lg transition-all active:scale-95"
          style={{ backgroundColor: theme.primary, boxShadow: `0 10px 15px -3px ${theme.primary}40` }}
        >
          <Plus size={20} />
          <span>Novo Orçamento</span>
        </button>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl max-h-[95vh] overflow-y-auto animate-in zoom-in duration-200">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">Novo Orçamento</h2>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Integração Total com Planilha e Drive</p>
                </div>
                <button onClick={resetForm} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Cabeçalho do Orçamento */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Título do Projeto</label>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Reforma do Lobby" className="w-full px-5 py-3 rounded-xl border-2 border-white focus:border-blue-400 outline-none transition-all font-bold text-slate-800" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">Objetivo / Justificativa</label>
                    <textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Por que este orçamento é necessário?" className="w-full px-5 py-3 rounded-xl border-2 border-white focus:border-blue-400 outline-none transition-all h-20 font-bold text-slate-800" />
                  </div>
                </div>

                {/* Itens e Materiais */}
                <div className="space-y-6">
                   <div className="flex justify-between items-center">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center">
                        <Layers size={16} className="mr-2 text-blue-500" /> Detalhamento de Itens
                      </h3>
                      <button type="button" onClick={addServiceItem} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase border border-blue-100 hover:bg-blue-100 transition-all">+ Item de Serviço</button>
                   </div>

                   {items.map((item, idx) => (
                     <div key={item.id} className="p-6 bg-white rounded-[2rem] border border-slate-200 relative shadow-sm">
                        <button type="button" onClick={() => removeServiceItem(item.id)} className="absolute top-6 right-6 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={20}/></button>
                        
                        <div className="space-y-6">
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase mb-2">Descrição do Serviço / Local</label>
                            <input type="text" value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} placeholder="Ex: Pintura e Reparo de Alvenaria" className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 outline-none focus:border-blue-300 text-sm font-bold" />
                          </div>

                          <div className="space-y-4">
                            <div className="flex justify-between items-center">
                               <p className="text-[9px] font-black text-slate-400 uppercase">Materiais e Insumos</p>
                               <button type="button" onClick={() => addMaterial(item.id)} className="text-[9px] font-black text-emerald-600 uppercase flex items-center"><Plus size={14} className="mr-1"/> Adicionar Material</button>
                            </div>
                            
                            <div className="space-y-3">
                               {item.materials.map((mat, mIdx) => (
                                 <div key={mat.id} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-3">
                                    <div className="flex flex-wrap md:flex-nowrap gap-3 items-end">
                                       <div className="flex-1 min-w-[150px]">
                                          <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Nome do Material</label>
                                          <input type="text" value={mat.name} onChange={e => updateMaterial(item.id, mat.id, 'name', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold" placeholder="Ex: Tinta Branca" />
                                       </div>
                                       <div className="w-20">
                                          <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Qtd</label>
                                          <input type="number" value={mat.quantity} onChange={e => updateMaterial(item.id, mat.id, 'quantity', parseFloat(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-center" />
                                       </div>
                                       <div className="w-24">
                                          <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Medida</label>
                                          <select value={mat.unit} onChange={e => updateMaterial(item.id, mat.id, 'unit', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-bold">
                                             <option value="Un">Un</option>
                                             <option value="pct">pct</option>
                                             <option value="L">L</option>
                                             <option value="kg">kg</option>
                                             <option value="m">m</option>
                                             <option value="cx">cx</option>
                                             <option value="m2">m²</option>
                                          </select>
                                       </div>
                                       <div className="w-32">
                                          <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">R$ Unitário</label>
                                          <div className="relative">
                                             <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">R$</span>
                                             <input type="number" step="0.01" value={mat.price || ''} onChange={e => updateMaterial(item.id, mat.id, 'price', parseFloat(e.target.value))} className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 text-xs font-bold" />
                                          </div>
                                       </div>
                                       <button type="button" onClick={() => removeMaterial(item.id, mat.id)} className="p-2 text-rose-300 hover:text-rose-500"><Trash2 size={18}/></button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                       <div className="relative">
                                          <Truck size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                                          <input type="text" placeholder="Fornecedor sugerido" value={mat.supplier} onChange={e => updateMaterial(item.id, mat.id, 'supplier', e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-[10px] font-bold" />
                                       </div>
                                       <div className="relative">
                                          <MessageSquare size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                                          <input type="text" placeholder="Observação técnica" value={mat.observation} onChange={e => updateMaterial(item.id, mat.id, 'observation', e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-[10px] font-bold" />
                                       </div>
                                    </div>
                                 </div>
                               ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-50">
                             <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 flex items-center"><Wrench size={10} className="mr-1"/> Valor Mão de Obra</label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 font-bold">R$</span>
                                  <input type="number" step="0.01" value={item.laborCost || ''} onChange={e => updateItem(item.id, 'laborCost', e.target.value)} className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 font-bold text-sm" />
                                </div>
                             </div>
                             <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 flex items-center"><Clock size={10} className="mr-1"/> Tempo Estimado</label>
                                <input type="text" placeholder="Ex: 5 dias" value={item.estimatedTime} onChange={e => updateItem(item.id, 'estimatedTime', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 font-bold text-sm" />
                             </div>
                             <div className="flex flex-col justify-end text-right">
                                <p className="text-[8px] font-black text-slate-300 uppercase">Subtotal do Item</p>
                                <p className="text-xl font-black text-blue-600">R$ {calculateItemSubtotal(item).toLocaleString('pt-BR')}</p>
                             </div>
                          </div>
                        </div>
                     </div>
                   ))}
                </div>

                {/* Resumo Financeiro */}
                <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl">
                   <div className="flex items-center space-x-4">
                      <div className="p-4 bg-white/10 rounded-2xl"><Calculator size={32} className="text-emerald-400" /></div>
                      <div>
                         <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Valor Total Calculado (Interno)</p>
                         <h4 className="text-4xl font-black tracking-tighter text-emerald-400">R$ {totalCalculated.toLocaleString('pt-BR')}</h4>
                      </div>
                   </div>
                   <div className="flex gap-4 w-full md:w-auto">
                      <button type="button" onClick={resetForm} className="flex-1 md:flex-none px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-white/5 hover:bg-white/10 transition-all">Cancelar</button>
                      <button type="submit" className="flex-1 md:flex-none px-12 py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition-all active:scale-95">Salvar Orçamento</button>
                   </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Orçamentos */}
      <div className="space-y-4">
        {filteredBudgets.length === 0 ? (
          <div className="bg-white p-20 rounded-[3rem] border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
            <Receipt size={64} className="mb-4 opacity-10" />
            <p className="text-xl font-black italic uppercase tracking-tighter">Nenhum orçamento em aberto</p>
          </div>
        ) : (
          filteredBudgets.map(budget => {
            const budgetTotal = budget.items.reduce((acc, item) => {
                const materialsTotal = item.materials.reduce((mAcc, m) => mAcc + (m.quantity * (m.price || 0)), 0);
                return acc + materialsTotal + (Number(item.laborCost) || 0);
            }, 0);
            
            return (
              <div key={budget.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all overflow-hidden group">
                <div className="p-6 md:p-8 cursor-pointer" onClick={() => setExpandedId(expandedId === budget.id ? null : budget.id)}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center space-x-6">
                      <div className="p-5 bg-slate-50 text-slate-900 rounded-[1.5rem] border border-slate-100 group-hover:bg-blue-50 transition-colors">
                        <Receipt size={28} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 text-xl leading-none mb-2">{budget.title}</h4>
                        <div className="flex items-center space-x-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center"><Layers size={12} className="mr-1" /> {budget.items?.length || 0} Itens</span>
                          <span className="w-1.5 h-1.5 bg-slate-200 rounded-full"></span>
                          <span>{new Date(budget.createdAt).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end space-x-8">
                      <div className="text-right">
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Valor do Projeto</p>
                        <p className="text-2xl font-black text-blue-600 leading-none mt-1">R$ {budgetTotal.toLocaleString('pt-BR')}</p>
                      </div>
                      <div className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase border-2 ${getStatusStyle(budget.status)}`}>
                        {budget.status}
                      </div>
                      {expandedId === budget.id ? <ChevronUp size={24} className="text-slate-300" /> : <ChevronDown size={24} className="text-slate-300" />}
                    </div>
                  </div>
                </div>

                {expandedId === budget.id && (
                  <div className="px-8 pb-10 pt-4 border-t border-slate-50 animate-in slide-in-from-top-4 bg-slate-50/30">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                      <div className="lg:col-span-3 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(budget.items || []).map((item, iIdx) => (
                            <div key={item.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                              <div className="flex justify-between items-start mb-4">
                                <span className="text-[10px] font-black text-blue-500 uppercase">Item {iIdx + 1}</span>
                                <span className="text-[10px] font-bold text-slate-400 flex items-center"><Clock size={10} className="mr-1"/> {item.estimatedTime || '---'}</span>
                              </div>
                              <h6 className="font-black text-slate-800 mb-3">{item.description}</h6>
                              <div className="space-y-2 mb-4">
                                {item.materials.map(m => (
                                  <div key={m.id} className="p-3 bg-slate-50/50 rounded-xl space-y-1 border border-slate-100">
                                    <div className="flex justify-between text-[10px] font-black">
                                      <span className="text-slate-800">{m.quantity}{m.unit} • {m.name}</span>
                                      <span className="text-blue-600">R$ {(m.quantity * (m.price || 0)).toLocaleString('pt-BR')}</span>
                                    </div>
                                    <div className="flex flex-col gap-0.5 opacity-60">
                                      {m.supplier && <p className="text-[8px] font-bold uppercase flex items-center"><Truck size={8} className="mr-1"/> {m.supplier}</p>}
                                      {m.observation && <p className="text-[8px] italic flex items-center"><MessageSquare size={8} className="mr-1"/> {m.observation}</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="flex justify-between items-center text-[10px] font-black uppercase pt-2 border-t border-slate-50">
                                <span className="text-slate-400">Mão de Obra</span>
                                <span className="text-slate-800">R$ {(Number(item.laborCost) || 0).toLocaleString('pt-BR')}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs font-black uppercase pt-3 border-t border-slate-100 mt-2">
                                <span className="text-blue-600">Total do Item</span>
                                <span className="text-blue-600 font-black">R$ {calculateItemSubtotal(item).toLocaleString('pt-BR')}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {budget.objective && (
                          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Justificativa do Projeto</h5>
                            <p className="text-sm text-slate-600 font-medium">{budget.objective}</p>
                          </div>
                        )}
                      </div>

                      <div className="lg:col-span-1 space-y-4">
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-4">Ações de Gestão</p>
                          <div className="space-y-2">
                             <button onClick={() => updateStatus(budget, 'Aprovado')} className="w-full py-4 rounded-xl bg-emerald-500 text-white font-black text-xs uppercase shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">Aprovar Projeto</button>
                             <button onClick={() => updateStatus(budget, 'Rejeitado')} className="w-full py-4 rounded-xl bg-white border-2 border-rose-100 text-rose-500 font-black text-xs uppercase hover:bg-rose-50 active:scale-95 transition-all">Rejeitar</button>
                          </div>
                          <button onClick={() => onDelete(budget.id)} className="w-full mt-8 flex items-center justify-center space-x-2 text-[10px] font-black text-slate-300 hover:text-rose-500 uppercase transition-colors">
                            <Trash2 size={16} /> <span>Excluir do Sistema</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BudgetsView;
