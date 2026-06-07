import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BedDouble,
  Boxes,
  CheckCircle2,
  ClipboardList,
  History,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Shirt,
  Trash2,
  WashingMachine,
  X
} from 'lucide-react';
import { HotelTheme, LinenItem, LinenOperation, LinenStockStatus } from '../types';

interface LinenViewProps {
  items: LinenItem[];
  history: LinenOperation[];
  theme: HotelTheme;
  currentUser?: string;
  onSave: (item: LinenItem) => void;
  onDelete: (id: string) => void;
  onOperation: (operation: LinenOperation) => void;
}

const statusOptions: { id: LinenStockStatus; label: string }[] = [
  { id: 'Limpo', label: 'Limpo / disponível' },
  { id: 'Em uso', label: 'Em uso / apartamentos' },
  { id: 'Sujo', label: 'Sujo / aguardando coleta' },
  { id: 'Lavanderia', label: 'Na lavanderia' },
  { id: 'Danificado', label: 'Danificado' },
  { id: 'Extraviado', label: 'Extraviado' }
];

const categoryOptions = ['Roupa de cama', 'Banho', 'Piscina', 'Restaurante', 'Outros'];

const getStatusField = (status?: LinenStockStatus): keyof LinenItem | null => {
  switch (status) {
    case 'Limpo': return 'quantityClean';
    case 'Em uso': return 'quantityInUse';
    case 'Sujo': return 'quantityDirty';
    case 'Lavanderia': return 'quantityLaundry';
    case 'Danificado': return 'quantityDamaged';
    case 'Extraviado': return 'quantityLost';
    default: return null;
  }
};

const getStatusQuantity = (item: LinenItem, status?: LinenStockStatus) => {
  const field = getStatusField(status);
  return field ? Number(item[field] || 0) : 0;
};

const formatDateTime = (timestamp: number) => new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short'
}).format(new Date(timestamp));

const LinenView: React.FC<LinenViewProps> = ({ items, history, theme, currentUser, onSave, onDelete, onOperation }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<LinenItem | null>(null);
  const [isAddingOperation, setIsAddingOperation] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Roupa de cama');
  const [unit, setUnit] = useState('Peça');
  const [minCleanQuantity, setMinCleanQuantity] = useState(0);
  const [quantityClean, setQuantityClean] = useState(0);
  const [quantityInUse, setQuantityInUse] = useState(0);
  const [quantityDirty, setQuantityDirty] = useState(0);
  const [quantityLaundry, setQuantityLaundry] = useState(0);
  const [quantityDamaged, setQuantityDamaged] = useState(0);
  const [quantityLost, setQuantityLost] = useState(0);

  const [operationType, setOperationType] = useState<LinenOperation['type']>('Transferência');
  const [operationItemId, setOperationItemId] = useState('');
  const [fromStatus, setFromStatus] = useState<LinenStockStatus>('Limpo');
  const [toStatus, setToStatus] = useState<LinenStockStatus>('Em uso');
  const [operationQuantity, setOperationQuantity] = useState(1);
  const [operationLocation, setOperationLocation] = useState('');
  const [operationReason, setOperationReason] = useState('');

  const totals = useMemo(() => items.reduce((acc, item) => {
    acc.clean += Number(item.quantityClean || 0);
    acc.inUse += Number(item.quantityInUse || 0);
    acc.dirty += Number(item.quantityDirty || 0);
    acc.laundry += Number(item.quantityLaundry || 0);
    acc.damaged += Number(item.quantityDamaged || 0);
    acc.lost += Number(item.quantityLost || 0);
    return acc;
  }, { clean: 0, inUse: 0, dirty: 0, laundry: 0, damaged: 0, lost: 0 }), [items]);

  const circulatingTotal = totals.clean + totals.inUse + totals.dirty + totals.laundry + totals.damaged;
  const alertItems = useMemo(() => items.filter(item => Number(item.quantityClean || 0) < Number(item.minCleanQuantity || 0)), [items]);

  const filteredItems = useMemo(() => items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'Todos' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }), [items, searchTerm, categoryFilter]);

  const selectedOperationItem = useMemo(
    () => items.find(item => item.id === operationItemId),
    [items, operationItemId]
  );

  const resetItemForm = () => {
    setEditingItem(null);
    setName('');
    setCategory('Roupa de cama');
    setUnit('Peça');
    setMinCleanQuantity(0);
    setQuantityClean(0);
    setQuantityInUse(0);
    setQuantityDirty(0);
    setQuantityLaundry(0);
    setQuantityDamaged(0);
    setQuantityLost(0);
    setIsAddingItem(false);
  };

  const openNewItem = () => {
    resetItemForm();
    setIsAddingItem(true);
  };

  const openEditItem = (item: LinenItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setUnit(item.unit || 'Peça');
    setMinCleanQuantity(Number(item.minCleanQuantity || 0));
    setQuantityClean(Number(item.quantityClean || 0));
    setQuantityInUse(Number(item.quantityInUse || 0));
    setQuantityDirty(Number(item.quantityDirty || 0));
    setQuantityLaundry(Number(item.quantityLaundry || 0));
    setQuantityDamaged(Number(item.quantityDamaged || 0));
    setQuantityLost(Number(item.quantityLost || 0));
    setIsAddingItem(true);
  };

  const handleSaveItem = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    onSave({
      id: editingItem?.id || `linen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: trimmedName,
      category,
      unit: unit.trim() || 'Peça',
      minCleanQuantity: Math.max(0, Number(minCleanQuantity) || 0),
      quantityClean: Math.max(0, Number(quantityClean) || 0),
      quantityInUse: Math.max(0, Number(quantityInUse) || 0),
      quantityDirty: Math.max(0, Number(quantityDirty) || 0),
      quantityLaundry: Math.max(0, Number(quantityLaundry) || 0),
      quantityDamaged: Math.max(0, Number(quantityDamaged) || 0),
      quantityLost: Math.max(0, Number(quantityLost) || 0),
      lastUpdate: Date.now()
    });
    resetItemForm();
  };

  const resetOperationForm = () => {
    setOperationType('Transferência');
    setOperationItemId('');
    setFromStatus('Limpo');
    setToStatus('Em uso');
    setOperationQuantity(1);
    setOperationLocation('');
    setOperationReason('');
    setIsAddingOperation(false);
  };

  const handleSaveOperation = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedOperationItem || operationQuantity <= 0) return;

    const origin = operationType === 'Entrada' ? undefined : fromStatus;
    const destination = operationType === 'Baixa' ? undefined : toStatus;

    if (operationType === 'Transferência' && origin === destination) {
      window.alert('Selecione destinos diferentes para registrar a transferência.');
      return;
    }

    if (origin && getStatusQuantity(selectedOperationItem, origin) < operationQuantity) {
      window.alert(`Saldo insuficiente em “${origin}”. Saldo atual: ${getStatusQuantity(selectedOperationItem, origin)}.`);
      return;
    }

    onOperation({
      id: `linen_op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      itemId: selectedOperationItem.id,
      itemName: selectedOperationItem.name,
      type: operationType,
      fromStatus: origin,
      toStatus: destination,
      quantity: Number(operationQuantity),
      timestamp: Date.now(),
      user: currentUser || 'Usuário',
      location: operationLocation.trim(),
      reason: operationReason.trim()
    });
    resetOperationForm();
  };

  const statCards = [
    { label: 'Peças circulantes', value: circulatingTotal, icon: Boxes },
    { label: 'Limpas disponíveis', value: totals.clean, icon: CheckCircle2 },
    { label: 'Em uso', value: totals.inUse, icon: BedDouble },
    { label: 'Na lavanderia', value: totals.laundry, icon: WashingMachine },
    { label: 'Danificadas', value: totals.damaged, icon: AlertTriangle },
    { label: 'Extraviadas', value: totals.lost, icon: Search }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Governança e rouparia</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-800 dark:text-white mt-1">Controle de Enxoval</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">Acompanhe o ciclo das peças desde a rouparia até os apartamentos, lavanderia, avarias e baixas.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setIsAddingOperation(true)}
            disabled={items.length === 0}
            className="px-5 py-3 rounded-2xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 font-black text-xs uppercase tracking-wider text-slate-700 dark:text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowRight size={17} /> Movimentar peça
          </button>
          <button
            onClick={openNewItem}
            className="px-5 py-3 rounded-2xl text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
            style={{ backgroundColor: theme.primary }}
          >
            <Plus size={17} /> Cadastrar item
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
        {statCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <Icon size={18} style={{ color: theme.primary }} />
              <span className="text-2xl font-black text-slate-800 dark:text-white">{value}</span>
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-4">{label}</p>
          </div>
        ))}
      </div>

      {alertItems.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-3xl p-5 flex gap-4">
          <AlertTriangle className="text-amber-600 shrink-0" />
          <div>
            <p className="font-black text-xs uppercase tracking-widest text-amber-800 dark:text-amber-200">Reposição necessária</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">{alertItems.length} item(ns) estão abaixo do estoque mínimo de peças limpas.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <section className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[2rem] p-5 md:p-6 shadow-sm min-w-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2"><Shirt size={20} /> Itens cadastrados</h2>
              <p className="text-xs text-slate-400 mt-1">{filteredItems.length} de {items.length} itens exibidos</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <label className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Buscar item" className="w-full sm:w-52 pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 text-sm outline-none" />
              </label>
              <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className="px-3 py-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 text-sm outline-none">
                <option>Todos</option>
                {categoryOptions.map(option => <option key={option}>{option}</option>)}
              </select>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="py-14 text-center border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-3xl">
              <BedDouble className="mx-auto text-slate-300" size={36} />
              <p className="text-sm font-black text-slate-500 mt-4">Nenhum item de enxoval cadastrado.</p>
              <p className="text-xs text-slate-400 mt-1">Cadastre toalhas, lençóis, fronhas e demais peças para iniciar o controle.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left">
                <thead>
                  <tr className="text-[9px] uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-700">
                    <th className="pb-3 pr-4">Item</th>
                    <th className="pb-3 px-2 text-center">Limpo</th>
                    <th className="pb-3 px-2 text-center">Em uso</th>
                    <th className="pb-3 px-2 text-center">Sujo</th>
                    <th className="pb-3 px-2 text-center">Lavanderia</th>
                    <th className="pb-3 px-2 text-center">Danificado</th>
                    <th className="pb-3 px-2 text-center">Extraviado</th>
                    <th className="pb-3 px-2 text-center">Mínimo limpo</th>
                    <th className="pb-3 pl-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => {
                    const belowMinimum = Number(item.quantityClean || 0) < Number(item.minCleanQuantity || 0);
                    return (
                      <tr key={item.id} className="border-b border-slate-50 dark:border-slate-700/60 last:border-0">
                        <td className="py-4 pr-4">
                          <p className="text-sm font-black text-slate-800 dark:text-white">{item.name}</p>
                          <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">{item.category} · {item.unit}</p>
                        </td>
                        <td className={`py-4 px-2 text-center font-black ${belowMinimum ? 'text-amber-600' : 'text-emerald-600'}`}>{item.quantityClean}</td>
                        <td className="py-4 px-2 text-center font-bold text-slate-600 dark:text-slate-300">{item.quantityInUse}</td>
                        <td className="py-4 px-2 text-center font-bold text-slate-600 dark:text-slate-300">{item.quantityDirty}</td>
                        <td className="py-4 px-2 text-center font-bold text-slate-600 dark:text-slate-300">{item.quantityLaundry}</td>
                        <td className="py-4 px-2 text-center font-bold text-red-500">{item.quantityDamaged}</td>
                        <td className="py-4 px-2 text-center font-bold text-red-500">{item.quantityLost}</td>
                        <td className="py-4 px-2 text-center text-slate-500">{item.minCleanQuantity}</td>
                        <td className="py-4 pl-3">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => openEditItem(item)} title="Editar" className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700"><Pencil size={15} /></button>
                            <button onClick={() => window.confirm(`Excluir “${item.name}”?`) && onDelete(item.id)} title="Excluir" className="p-2 rounded-lg text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500"><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[2rem] p-5 md:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <History size={19} />
            <h2 className="font-black text-lg text-slate-800 dark:text-white">Movimentações recentes</h2>
          </div>
          <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
            {history.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">Ainda não existem movimentações registradas.</p>
            ) : history.slice(0, 50).map(operation => (
              <div key={operation.id} className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between gap-3">
                  <p className="text-xs font-black text-slate-800 dark:text-white">{operation.itemName}</p>
                  <span className="text-xs font-black" style={{ color: theme.primary }}>{operation.quantity}</span>
                </div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-2">
                  {operation.type === 'Transferência' ? `${operation.fromStatus} → ${operation.toStatus}` : operation.type === 'Entrada' ? `Entrada → ${operation.toStatus}` : `${operation.fromStatus} → baixa`}
                </p>
                {operation.location && <p className="text-[11px] text-slate-500 mt-2">Local: {operation.location}</p>}
                {operation.reason && <p className="text-[11px] text-slate-500 mt-1">{operation.reason}</p>}
                <p className="text-[9px] text-slate-400 mt-3">{formatDateTime(operation.timestamp)} · {operation.user}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {isAddingItem && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveItem} className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-start gap-4 mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cadastro de peça</p>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{editingItem ? 'Editar item' : 'Novo item de enxoval'}</h2>
              </div>
              <button type="button" onClick={resetItemForm} className="p-2 text-slate-400 hover:text-slate-700"><X /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="md:col-span-2 text-xs font-black text-slate-500">Nome da peça
                <input required value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Lençol casal, toalha de banho" className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm font-medium" />
              </label>
              <label className="text-xs font-black text-slate-500">Categoria
                <select value={category} onChange={event => setCategory(event.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm">
                  {categoryOptions.map(option => <option key={option}>{option}</option>)}
                </select>
              </label>
              <label className="text-xs font-black text-slate-500">Unidade
                <input value={unit} onChange={event => setUnit(event.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm" />
              </label>
              <label className="text-xs font-black text-slate-500">Estoque mínimo limpo
                <input min={0} type="number" value={minCleanQuantity} onChange={event => setMinCleanQuantity(Number(event.target.value))} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm" />
              </label>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-5">
              {[
                ['Limpo', quantityClean, setQuantityClean],
                ['Em uso', quantityInUse, setQuantityInUse],
                ['Sujo', quantityDirty, setQuantityDirty],
                ['Lavanderia', quantityLaundry, setQuantityLaundry],
                ['Danificado', quantityDamaged, setQuantityDamaged],
                ['Extraviado', quantityLost, setQuantityLost]
              ].map(([label, value, setter]) => (
                <label key={String(label)} className="text-xs font-black text-slate-500">{label}
                  <input min={0} type="number" value={Number(value)} onChange={event => (setter as React.Dispatch<React.SetStateAction<number>>)(Number(event.target.value))} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm" />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-7">
              <button type="button" onClick={resetItemForm} className="px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500">Cancelar</button>
              <button type="submit" className="px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-white" style={{ backgroundColor: theme.primary }}>Salvar item</button>
            </div>
          </form>
        </div>
      )}

      {isAddingOperation && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveOperation} className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-2xl shadow-2xl">
            <div className="flex justify-between items-start gap-4 mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fluxo operacional</p>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white mt-1">Registrar movimentação</h2>
              </div>
              <button type="button" onClick={resetOperationForm} className="p-2 text-slate-400 hover:text-slate-700"><X /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-xs font-black text-slate-500">Tipo de operação
                <select value={operationType} onChange={event => setOperationType(event.target.value as LinenOperation['type'])} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm">
                  <option>Transferência</option>
                  <option>Entrada</option>
                  <option>Baixa</option>
                </select>
              </label>
              <label className="text-xs font-black text-slate-500">Item
                <select required value={operationItemId} onChange={event => setOperationItemId(event.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm">
                  <option value="">Selecione uma peça</option>
                  {items.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
                </select>
              </label>
              {operationType !== 'Entrada' && (
                <label className="text-xs font-black text-slate-500">Origem
                  <select value={fromStatus} onChange={event => setFromStatus(event.target.value as LinenStockStatus)} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm">
                    {statusOptions.map(option => <option value={option.id} key={option.id}>{option.label}</option>)}
                  </select>
                  {selectedOperationItem && <span className="block text-[10px] text-slate-400 mt-1">Saldo na origem: {getStatusQuantity(selectedOperationItem, fromStatus)}</span>}
                </label>
              )}
              {operationType !== 'Baixa' && (
                <label className="text-xs font-black text-slate-500">Destino
                  <select value={toStatus} onChange={event => setToStatus(event.target.value as LinenStockStatus)} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm">
                    {statusOptions.map(option => <option value={option.id} key={option.id}>{option.label}</option>)}
                  </select>
                </label>
              )}
              <label className="text-xs font-black text-slate-500">Quantidade
                <input required min={1} type="number" value={operationQuantity} onChange={event => setOperationQuantity(Number(event.target.value))} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm" />
              </label>
              <label className="text-xs font-black text-slate-500">Local ou referência
                <input value={operationLocation} onChange={event => setOperationLocation(event.target.value)} placeholder="Ex.: Apto 203, rouparia, lavanderia" className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm" />
              </label>
              <label className="md:col-span-2 text-xs font-black text-slate-500">Observação
                <textarea value={operationReason} onChange={event => setOperationReason(event.target.value)} placeholder="Informe o motivo quando necessário" className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm min-h-20" />
              </label>
            </div>
            <div className="flex justify-end gap-3 mt-7">
              <button type="button" onClick={resetOperationForm} className="px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500">Cancelar</button>
              <button type="submit" className="px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-white flex items-center gap-2" style={{ backgroundColor: theme.primary }}><ClipboardList size={16} /> Registrar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default LinenView;
