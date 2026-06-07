import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bed,
  BedDouble,
  Boxes,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  History,
  Pencil,
  Plus,
  Save,
  Search,
  Settings2,
  Trash2,
  WashingMachine,
  X
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  HotelTheme,
  LinenCalculationBasis,
  LinenHotelSettings,
  LinenItem,
  LinenMonthlyInventory,
  LinenMonthlyInventoryItem,
  LinenOperation,
  LinenStockStatus
} from '../types';

interface LinenViewProps {
  items: LinenItem[];
  history: LinenOperation[];
  monthlyInventories: LinenMonthlyInventory[];
  settings?: LinenHotelSettings;
  registeredApartmentsCount: number;
  theme: HotelTheme;
  currentUser?: string;
  onSave: (item: LinenItem) => void;
  onDelete: (id: string) => void;
  onOperation: (operation: LinenOperation) => void;
  onSaveSettings: (settings: LinenHotelSettings) => void;
  onSaveMonthlyInventory: (inventory: LinenMonthlyInventory) => void;
}

const defaultSettings: LinenHotelSettings = {
  totalApartments: 0,
  totalBeds: 0,
  totalSingleBeds: 0,
  totalDoubleBeds: 0,
  idealStockMultiplier: 3
};

const statusOptions: { id: LinenStockStatus; label: string }[] = [
  { id: 'Limpo', label: 'Limpo / disponível' },
  { id: 'Em uso', label: 'Em uso / apartamentos' },
  { id: 'Sujo', label: 'Sujo / aguardando coleta' },
  { id: 'Lavanderia', label: 'Na lavanderia' },
  { id: 'Manchado', label: 'Manchado / indisponível' },
  { id: 'Rasgado', label: 'Rasgado / indisponível' },
  { id: 'Danificado', label: 'Outra avaria / legado' },
  { id: 'Extraviado', label: 'Extraviado' }
];

const basisOptions: { id: LinenCalculationBasis; label: string }[] = [
  { id: 'Apartamento', label: 'Apartamento' },
  { id: 'Cama total', label: 'Cama total' },
  { id: 'Cama solteiro', label: 'Cama de solteiro' },
  { id: 'Cama casal', label: 'Cama de casal' },
  { id: 'Manual', label: 'Mínimo informado manualmente' }
];

const categoryOptions = ['Roupa de cama', 'Banho', 'Piscina', 'Restaurante', 'Outros'];

const numberValue = (value: unknown) => Math.max(0, Number(value) || 0);

const getStatusField = (status?: LinenStockStatus): keyof LinenItem | null => {
  switch (status) {
    case 'Limpo': return 'quantityClean';
    case 'Em uso': return 'quantityInUse';
    case 'Sujo': return 'quantityDirty';
    case 'Lavanderia': return 'quantityLaundry';
    case 'Manchado': return 'quantityStained';
    case 'Rasgado': return 'quantityTorn';
    case 'Danificado': return 'quantityDamaged';
    case 'Extraviado': return 'quantityLost';
    default: return null;
  }
};

const getStatusQuantity = (item: LinenItem, status?: LinenStockStatus) => {
  const field = getStatusField(status);
  return field ? numberValue(item[field]) : 0;
};

const getUsableTotal = (item: LinenItem | LinenMonthlyInventoryItem) => (
  numberValue(item.quantityClean) +
  numberValue(item.quantityInUse) +
  numberValue(item.quantityDirty) +
  numberValue(item.quantityLaundry)
);

const getPhysicalTotal = (item: LinenItem | LinenMonthlyInventoryItem) => (
  getUsableTotal(item) +
  numberValue(item.quantityStained) +
  numberValue(item.quantityTorn) +
  numberValue(item.quantityDamaged)
);

const getBaseQuantity = (item: LinenItem, settings: LinenHotelSettings) => {
  switch (item.calculationBasis || 'Manual') {
    case 'Apartamento': return numberValue(settings.totalApartments);
    case 'Cama total': return numberValue(settings.totalBeds || (settings.totalSingleBeds + settings.totalDoubleBeds));
    case 'Cama solteiro': return numberValue(settings.totalSingleBeds);
    case 'Cama casal': return numberValue(settings.totalDoubleBeds);
    default: return 0;
  }
};

const getMinimumQuantity = (item: LinenItem, settings: LinenHotelSettings) => {
  if (!item.calculationBasis || item.calculationBasis === 'Manual') return numberValue(item.minCleanQuantity);
  return getBaseQuantity(item, settings) * numberValue(item.quantityPerBasis);
};

const getIdealQuantity = (item: LinenItem, settings: LinenHotelSettings) => {
  const multiplier = numberValue(item.idealMultiplier) || numberValue(settings.idealStockMultiplier) || 3;
  return getMinimumQuantity(item, settings) * multiplier;
};

const formatDateTime = (timestamp: number) => new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short'
}).format(new Date(timestamp));

const formatMonth = (month: string) => {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return month || 'Sem competência';
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' })
    .format(new Date(year, monthNumber - 1, 1))
    .replace('.', '');
};

const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

const LinenView: React.FC<LinenViewProps> = ({
  items,
  history,
  monthlyInventories,
  settings,
  registeredApartmentsCount,
  theme,
  currentUser,
  onSave,
  onDelete,
  onOperation,
  onSaveSettings,
  onSaveMonthlyInventory
}) => {
  const hotelSettings = { ...defaultSettings, ...(settings || {}) };
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<LinenItem | null>(null);
  const [isAddingOperation, setIsAddingOperation] = useState(false);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [isClosingInventory, setIsClosingInventory] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Roupa de cama');
  const [unit, setUnit] = useState('Peça');
  const [calculationBasis, setCalculationBasis] = useState<LinenCalculationBasis>('Apartamento');
  const [quantityPerBasis, setQuantityPerBasis] = useState(1);
  const [idealMultiplier, setIdealMultiplier] = useState(0);
  const [minCleanQuantity, setMinCleanQuantity] = useState(0);
  const [quantityClean, setQuantityClean] = useState(0);
  const [quantityInUse, setQuantityInUse] = useState(0);
  const [quantityDirty, setQuantityDirty] = useState(0);
  const [quantityLaundry, setQuantityLaundry] = useState(0);
  const [quantityStained, setQuantityStained] = useState(0);
  const [quantityTorn, setQuantityTorn] = useState(0);
  const [quantityDamaged, setQuantityDamaged] = useState(0);
  const [quantityLost, setQuantityLost] = useState(0);

  const [operationType, setOperationType] = useState<LinenOperation['type']>('Transferência');
  const [operationItemId, setOperationItemId] = useState('');
  const [fromStatus, setFromStatus] = useState<LinenStockStatus>('Limpo');
  const [toStatus, setToStatus] = useState<LinenStockStatus>('Em uso');
  const [operationQuantity, setOperationQuantity] = useState(1);
  const [operationLocation, setOperationLocation] = useState('');
  const [operationReason, setOperationReason] = useState('');

  const [draftSettings, setDraftSettings] = useState<LinenHotelSettings>(hotelSettings);
  const [inventoryMonth, setInventoryMonth] = useState(getCurrentMonth());
  const [inventoryNotes, setInventoryNotes] = useState('');
  const [inventoryDraft, setInventoryDraft] = useState<Record<string, LinenMonthlyInventoryItem>>({});
  const [selectedAuditInventoryId, setSelectedAuditInventoryId] = useState('');

  const totals = useMemo(() => items.reduce((acc, item) => {
    acc.clean += numberValue(item.quantityClean);
    acc.inUse += numberValue(item.quantityInUse);
    acc.dirty += numberValue(item.quantityDirty);
    acc.laundry += numberValue(item.quantityLaundry);
    acc.stained += numberValue(item.quantityStained);
    acc.torn += numberValue(item.quantityTorn);
    acc.damaged += numberValue(item.quantityDamaged);
    acc.lost += numberValue(item.quantityLost);
    return acc;
  }, { clean: 0, inUse: 0, dirty: 0, laundry: 0, stained: 0, torn: 0, damaged: 0, lost: 0 }), [items]);

  const usableTotal = totals.clean + totals.inUse + totals.dirty + totals.laundry;
  const physicalTotal = usableTotal + totals.stained + totals.torn + totals.damaged;
  const alertItems = useMemo(() => items.filter(item => getUsableTotal(item) < getMinimumQuantity(item, hotelSettings)), [items, hotelSettings]);

  const filteredItems = useMemo(() => items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'Todos' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }), [items, searchTerm, categoryFilter]);

  const selectedOperationItem = useMemo(
    () => items.find(item => item.id === operationItemId),
    [items, operationItemId]
  );

  const sortedMonthlyInventories = useMemo(
    () => [...monthlyInventories].sort((a, b) => a.month.localeCompare(b.month)),
    [monthlyInventories]
  );

  const selectedAuditInventory = useMemo(() => (
    sortedMonthlyInventories.find(inventory => inventory.id === selectedAuditInventoryId) || sortedMonthlyInventories[sortedMonthlyInventories.length - 1]
  ), [sortedMonthlyInventories, selectedAuditInventoryId]);

  const chartData = useMemo(() => sortedMonthlyInventories.map(inventory => ({
    month: formatMonth(inventory.month),
    'Estoque físico': numberValue(inventory.totalPhysical),
    'Estoque utilizável': numberValue(inventory.totalUsable),
    Manchadas: numberValue(inventory.totalStained),
    Rasgadas: numberValue(inventory.totalTorn)
  })), [sortedMonthlyInventories]);

  const resetItemForm = () => {
    setEditingItem(null);
    setName('');
    setCategory('Roupa de cama');
    setUnit('Peça');
    setCalculationBasis('Apartamento');
    setQuantityPerBasis(1);
    setIdealMultiplier(0);
    setMinCleanQuantity(0);
    setQuantityClean(0);
    setQuantityInUse(0);
    setQuantityDirty(0);
    setQuantityLaundry(0);
    setQuantityStained(0);
    setQuantityTorn(0);
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
    setCalculationBasis(item.calculationBasis || 'Manual');
    setQuantityPerBasis(numberValue(item.quantityPerBasis));
    setIdealMultiplier(numberValue(item.idealMultiplier));
    setMinCleanQuantity(numberValue(item.minCleanQuantity));
    setQuantityClean(numberValue(item.quantityClean));
    setQuantityInUse(numberValue(item.quantityInUse));
    setQuantityDirty(numberValue(item.quantityDirty));
    setQuantityLaundry(numberValue(item.quantityLaundry));
    setQuantityStained(numberValue(item.quantityStained));
    setQuantityTorn(numberValue(item.quantityTorn));
    setQuantityDamaged(numberValue(item.quantityDamaged));
    setQuantityLost(numberValue(item.quantityLost));
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
      calculationBasis,
      quantityPerBasis: numberValue(quantityPerBasis),
      idealMultiplier: numberValue(idealMultiplier) || undefined,
      minCleanQuantity: numberValue(minCleanQuantity),
      quantityClean: numberValue(quantityClean),
      quantityInUse: numberValue(quantityInUse),
      quantityDirty: numberValue(quantityDirty),
      quantityLaundry: numberValue(quantityLaundry),
      quantityStained: numberValue(quantityStained),
      quantityTorn: numberValue(quantityTorn),
      quantityDamaged: numberValue(quantityDamaged),
      quantityLost: numberValue(quantityLost),
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

    const requiresReason = operationType === 'Baixa' || destination === 'Manchado' || destination === 'Rasgado' || destination === 'Extraviado';
    if (requiresReason && !operationReason.trim()) {
      window.alert('Informe a justificativa da avaria, extravio ou baixa.');
      return;
    }

    onOperation({
      id: `linen_op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      itemId: selectedOperationItem.id,
      itemName: selectedOperationItem.name,
      type: operationType,
      fromStatus: origin,
      toStatus: destination,
      quantity: numberValue(operationQuantity),
      timestamp: Date.now(),
      user: currentUser || 'Usuário',
      location: operationLocation.trim(),
      reason: operationReason.trim()
    });
    resetOperationForm();
  };

  const openSettings = () => {
    setDraftSettings({ ...defaultSettings, ...hotelSettings });
    setIsEditingSettings(true);
  };

  const handleSaveSettings = (event: React.FormEvent) => {
    event.preventDefault();
    onSaveSettings({
      totalApartments: numberValue(draftSettings.totalApartments),
      totalBeds: numberValue(draftSettings.totalBeds),
      totalSingleBeds: numberValue(draftSettings.totalSingleBeds),
      totalDoubleBeds: numberValue(draftSettings.totalDoubleBeds),
      idealStockMultiplier: numberValue(draftSettings.idealStockMultiplier) || 3
    });
    setIsEditingSettings(false);
  };

  const buildInventoryDraft = (month: string) => {
    const previousMonthInventory = monthlyInventories.find(inventory => inventory.month === month);
    const previousReasonMap = new Map<string, string>((previousMonthInventory?.items || []).map(entry => [entry.itemId, entry.varianceReason || '']));
    return items.reduce((acc: Record<string, LinenMonthlyInventoryItem>, item) => {
      const expectedPhysicalTotal = getPhysicalTotal(item);
      acc[item.id] = {
        itemId: item.id,
        itemName: item.name,
        quantityClean: numberValue(item.quantityClean),
        quantityInUse: numberValue(item.quantityInUse),
        quantityDirty: numberValue(item.quantityDirty),
        quantityLaundry: numberValue(item.quantityLaundry),
        quantityStained: numberValue(item.quantityStained),
        quantityTorn: numberValue(item.quantityTorn),
        quantityDamaged: numberValue(item.quantityDamaged),
        quantityLost: numberValue(item.quantityLost),
        expectedPhysicalTotal,
        countedPhysicalTotal: expectedPhysicalTotal,
        usableTotal: getUsableTotal(item),
        variance: 0,
        varianceReason: previousReasonMap.get(item.id) || ''
      };
      return acc;
    }, {} as Record<string, LinenMonthlyInventoryItem>);
  };

  const openMonthlyInventory = () => {
    const month = getCurrentMonth();
    setInventoryMonth(month);
    setInventoryNotes(monthlyInventories.find(inventory => inventory.month === month)?.notes || '');
    setInventoryDraft(buildInventoryDraft(month));
    setIsClosingInventory(true);
  };

  const handleInventoryMonthChange = (month: string) => {
    setInventoryMonth(month);
    setInventoryNotes(monthlyInventories.find(inventory => inventory.month === month)?.notes || '');
    setInventoryDraft(buildInventoryDraft(month));
  };

  const updateInventoryDraft = (itemId: string, field: keyof LinenMonthlyInventoryItem, value: string | number) => {
    setInventoryDraft(current => {
      const original = current[itemId];
      if (!original) return current;
      const updated = { ...original, [field]: typeof value === 'number' ? numberValue(value) : value };
      updated.countedPhysicalTotal = getPhysicalTotal(updated);
      updated.usableTotal = getUsableTotal(updated);
      updated.variance = updated.countedPhysicalTotal - numberValue(updated.expectedPhysicalTotal);
      return { ...current, [itemId]: updated };
    });
  };

  const handleSaveMonthlyInventory = (event: React.FormEvent) => {
    event.preventDefault();
    const countedItems = items.map(item => {
      const entry = inventoryDraft[item.id];
      const countedPhysicalTotal = getPhysicalTotal(entry);
      const usable = getUsableTotal(entry);
      return {
        ...entry,
        countedPhysicalTotal,
        usableTotal: usable,
        variance: countedPhysicalTotal - numberValue(entry.expectedPhysicalTotal),
        varianceReason: entry.varianceReason?.trim() || ''
      };
    });

    const unjustified = countedItems.find(entry => entry.variance !== 0 && !entry.varianceReason);
    if (unjustified) {
      window.alert(`Justifique a divergência encontrada em “${unjustified.itemName}”.`);
      return;
    }

    const inventory: LinenMonthlyInventory = {
      id: `linen_month_${inventoryMonth}`,
      month: inventoryMonth,
      timestamp: Date.now(),
      user: currentUser || 'Usuário',
      notes: inventoryNotes.trim(),
      items: countedItems,
      totalPhysical: countedItems.reduce((sum, entry) => sum + entry.countedPhysicalTotal, 0),
      totalUsable: countedItems.reduce((sum, entry) => sum + entry.usableTotal, 0),
      totalStained: countedItems.reduce((sum, entry) => sum + numberValue(entry.quantityStained), 0),
      totalTorn: countedItems.reduce((sum, entry) => sum + numberValue(entry.quantityTorn), 0),
      totalLost: countedItems.reduce((sum, entry) => sum + numberValue(entry.quantityLost), 0),
      totalVariance: countedItems.reduce((sum, entry) => sum + entry.variance, 0)
    };

    onSaveMonthlyInventory(inventory);
    setIsClosingInventory(false);
  };

  const statCards = [
    { label: 'Estoque físico', value: physicalTotal, icon: Boxes },
    { label: 'Peças utilizáveis', value: usableTotal, icon: CheckCircle2 },
    { label: 'Limpas disponíveis', value: totals.clean, icon: WashingMachine },
    { label: 'Manchadas', value: totals.stained, icon: AlertTriangle },
    { label: 'Rasgadas', value: totals.torn, icon: AlertTriangle },
    { label: 'Extraviadas', value: totals.lost, icon: Search }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Governança e rouparia</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-800 dark:text-white mt-1">Controle de Enxoval</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-3xl">Acompanhe o saldo operacional, as avarias, o dimensionamento mínimo e ideal e a evolução dos inventários mensais.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={openSettings} className="px-4 py-3 rounded-2xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 font-black text-xs uppercase tracking-wider text-slate-700 dark:text-white flex items-center justify-center gap-2">
            <Settings2 size={17} /> Parâmetros
          </button>
          <button onClick={openMonthlyInventory} disabled={items.length === 0} className="px-4 py-3 rounded-2xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 font-black text-xs uppercase tracking-wider text-slate-700 dark:text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
            <CalendarDays size={17} /> Fechar inventário mensal
          </button>
          <button onClick={() => setIsAddingOperation(true)} disabled={items.length === 0} className="px-4 py-3 rounded-2xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 font-black text-xs uppercase tracking-wider text-slate-700 dark:text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
            <ArrowRight size={17} /> Movimentar peça
          </button>
          <button onClick={openNewItem} className="px-4 py-3 rounded-2xl text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg" style={{ backgroundColor: theme.primary }}>
            <Plus size={17} /> Cadastrar item
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
        {statCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
              <Icon size={17} style={{ color: theme.primary }} />
            </div>
            <p className="text-2xl font-black text-slate-800 dark:text-white mt-3">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <section className="xl:col-span-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[2rem] p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dimensionamento operacional</p>
              <h2 className="text-xl font-black text-slate-800 dark:text-white mt-1">Capacidade cadastrada</h2>
            </div>
            <button onClick={openSettings} className="text-xs font-black uppercase tracking-wider flex items-center gap-2" style={{ color: theme.primary }}><Pencil size={15} /> Editar parâmetros</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
            {[
              ['Apartamentos', hotelSettings.totalApartments, Building2],
              ['Camas totais', hotelSettings.totalBeds || hotelSettings.totalSingleBeds + hotelSettings.totalDoubleBeds, Bed],
              ['Camas solteiro', hotelSettings.totalSingleBeds, Bed],
              ['Camas casal', hotelSettings.totalDoubleBeds, BedDouble],
              ['Giros ideais', hotelSettings.idealStockMultiplier || 3, Boxes]
            ].map(([label, value, Icon]) => (
              <div key={String(label)} className="rounded-2xl bg-slate-50 dark:bg-slate-900/40 px-4 py-3 border border-slate-100 dark:border-slate-700">
                <Icon size={16} className="text-slate-400" />
                <p className="text-[10px] uppercase tracking-wider font-black text-slate-400 mt-3">{String(label)}</p>
                <p className="text-lg font-black text-slate-800 dark:text-white mt-1">{Number(value)}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-4">Apartamentos cadastrados no módulo patrimonial: {registeredApartmentsCount}. O parâmetro do enxoval é independente para permitir ajustes operacionais.</p>
        </section>

        <section className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[2rem] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Alerta de adequação</p>
              <h2 className="text-xl font-black text-slate-800 dark:text-white mt-1">Abaixo do mínimo</h2>
            </div>
            <AlertTriangle size={22} className="text-amber-500" />
          </div>
          {alertItems.length === 0 ? (
            <p className="text-sm text-slate-500 mt-5">Nenhum item está abaixo do mínimo operacional.</p>
          ) : (
            <div className="space-y-2 mt-4 max-h-40 overflow-y-auto pr-1">
              {alertItems.map(item => (
                <div key={item.id} className="flex justify-between gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{item.name}</span>
                  <span className="text-xs font-black text-amber-700 dark:text-amber-300">{getUsableTotal(item)} / {getMinimumQuantity(item, hotelSettings)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[2rem] p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saldo atual</p>
            <h2 className="text-xl font-black text-slate-800 dark:text-white mt-1">Inventário por item</h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Buscar peça" className="pl-9 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm" />
            </label>
            <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm">
              <option>Todos</option>
              {categoryOptions.map(option => <option key={option}>{option}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto mt-5">
          <table className="w-full min-w-[1180px] text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-700">
                <th className="py-3 pr-3">Item</th>
                <th className="py-3 px-2">Base</th>
                <th className="py-3 px-2 text-right">Mínimo</th>
                <th className="py-3 px-2 text-right">Ideal</th>
                <th className="py-3 px-2 text-right">Utilizável</th>
                <th className="py-3 px-2 text-right">Físico</th>
                <th className="py-3 px-2 text-right">Manchadas</th>
                <th className="py-3 px-2 text-right">Rasgadas</th>
                <th className="py-3 px-2 text-right">Extraviadas</th>
                <th className="py-3 px-2 text-right">Adequação</th>
                <th className="py-3 pl-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => {
                const minimum = getMinimumQuantity(item, hotelSettings);
                const ideal = getIdealQuantity(item, hotelSettings);
                const usable = getUsableTotal(item);
                const physical = getPhysicalTotal(item);
                const adequacy = ideal > 0 ? usable / ideal : 0;
                return (
                  <tr key={item.id} className="border-b border-slate-100 dark:border-slate-700/70 text-sm">
                    <td className="py-4 pr-3">
                      <p className="font-black text-slate-800 dark:text-white">{item.name}</p>
                      <p className="text-[11px] text-slate-400 mt-1">{item.category} · {item.unit}</p>
                    </td>
                    <td className="py-4 px-2 text-xs text-slate-500">{item.calculationBasis || 'Manual'}{item.calculationBasis !== 'Manual' ? ` × ${numberValue(item.quantityPerBasis)}` : ''}</td>
                    <td className="py-4 px-2 text-right font-bold text-slate-600 dark:text-slate-300">{minimum}</td>
                    <td className="py-4 px-2 text-right font-black text-slate-800 dark:text-white">{ideal}</td>
                    <td className="py-4 px-2 text-right font-black" style={{ color: usable < minimum ? '#B45309' : theme.primary }}>{usable}</td>
                    <td className="py-4 px-2 text-right font-bold text-slate-600 dark:text-slate-300">{physical}</td>
                    <td className="py-4 px-2 text-right font-bold text-amber-700 dark:text-amber-300">{numberValue(item.quantityStained)}</td>
                    <td className="py-4 px-2 text-right font-bold text-rose-700 dark:text-rose-300">{numberValue(item.quantityTorn)}</td>
                    <td className="py-4 px-2 text-right font-bold text-slate-500">{numberValue(item.quantityLost)}</td>
                    <td className="py-4 px-2 text-right font-black text-slate-700 dark:text-slate-200">{ideal > 0 ? `${(adequacy * 100).toFixed(1)}%` : '—'}</td>
                    <td className="py-4 pl-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEditItem(item)} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700" title="Editar"><Pencil size={16} /></button>
                        <button onClick={() => window.confirm(`Excluir ${item.name}?`) && onDelete(item.id)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20" title="Excluir"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredItems.length === 0 && <p className="text-sm text-slate-500 py-10 text-center">Nenhum item de enxoval cadastrado para este filtro.</p>}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <section className="xl:col-span-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[2rem] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contagens completas</p>
              <h2 className="text-xl font-black text-slate-800 dark:text-white mt-1">Progressão mensal do inventário</h2>
            </div>
            <BarChart3 size={22} style={{ color: theme.primary }} />
          </div>
          {chartData.length === 0 ? (
            <p className="text-sm text-slate-500 mt-6">Ainda não existem fechamentos mensais. Registre a primeira contagem completa para iniciar a série histórica.</p>
          ) : (
            <>
              <div className="h-72 mt-5">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Estoque físico" stroke={theme.primary} strokeWidth={3} />
                    <Line type="monotone" dataKey="Estoque utilizável" stroke={theme.secondary} strokeWidth={3} />
                    <Line type="monotone" dataKey="Manchadas" stroke="#D97706" strokeWidth={2} />
                    <Line type="monotone" dataKey="Rasgadas" stroke="#E11D48" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto mt-5">
                <table className="w-full min-w-[720px] text-left">
                  <thead><tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-700">
                    <th className="py-3">Competência</th><th className="py-3 text-right">Físico</th><th className="py-3 text-right">Utilizável</th><th className="py-3 text-right">Manchadas</th><th className="py-3 text-right">Rasgadas</th><th className="py-3 text-right">Extraviadas</th><th className="py-3 text-right">Divergência</th>
                  </tr></thead>
                  <tbody>{[...sortedMonthlyInventories].reverse().map(inventory => (
                    <tr key={inventory.id} className="border-b border-slate-100 dark:border-slate-700/70 text-sm">
                      <td className="py-3 font-black text-slate-700 dark:text-white">{formatMonth(inventory.month)}</td>
                      <td className="py-3 text-right">{numberValue(inventory.totalPhysical)}</td>
                      <td className="py-3 text-right">{numberValue(inventory.totalUsable)}</td>
                      <td className="py-3 text-right text-amber-700 dark:text-amber-300">{numberValue(inventory.totalStained)}</td>
                      <td className="py-3 text-right text-rose-700 dark:text-rose-300">{numberValue(inventory.totalTorn)}</td>
                      <td className="py-3 text-right">{numberValue(inventory.totalLost)}</td>
                      <td className={`py-3 text-right font-black ${inventory.totalVariance < 0 ? 'text-rose-600' : inventory.totalVariance > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{inventory.totalVariance > 0 ? '+' : ''}{inventory.totalVariance}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {selectedAuditInventory && (
                <div className="mt-6 rounded-2xl border border-slate-100 dark:border-slate-700 p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Auditoria do fechamento</p>
                      <h3 className="text-base font-black text-slate-800 dark:text-white mt-1">Justificativas registradas</h3>
                    </div>
                    <select value={selectedAuditInventory.id} onChange={event => setSelectedAuditInventoryId(event.target.value)} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm">
                      {[...sortedMonthlyInventories].reverse().map(inventory => <option value={inventory.id} key={inventory.id}>{formatMonth(inventory.month)}</option>)}
                    </select>
                  </div>
                  {selectedAuditInventory.notes && <p className="text-xs text-slate-500 mt-3">Observação geral: {selectedAuditInventory.notes}</p>}
                  <div className="space-y-2 mt-4">
                    {selectedAuditInventory.items.filter(entry => entry.variance !== 0).length === 0 && <p className="text-sm text-slate-500">Nenhuma divergência foi registrada neste fechamento.</p>}
                    {selectedAuditInventory.items.filter(entry => entry.variance !== 0).map(entry => (
                      <div key={entry.itemId} className="flex flex-col md:flex-row md:items-center justify-between gap-2 rounded-xl bg-slate-50 dark:bg-slate-900/40 px-3 py-2">
                        <div><p className="text-xs font-black text-slate-700 dark:text-white">{entry.itemName}</p><p className="text-[11px] text-slate-500 mt-1">{entry.varianceReason || 'Sem justificativa registrada'}</p></div>
                        <span className={`text-xs font-black ${entry.variance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{entry.variance > 0 ? '+' : ''}{entry.variance}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <aside className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[2rem] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Auditoria</p>
              <h2 className="text-xl font-black text-slate-800 dark:text-white mt-1">Movimentações recentes</h2>
            </div>
            <History size={20} style={{ color: theme.primary }} />
          </div>
          <div className="space-y-3 mt-5 max-h-[520px] overflow-y-auto pr-1">
            {history.length === 0 && <p className="text-sm text-slate-500">Nenhuma movimentação registrada.</p>}
            {history.slice(0, 40).map(operation => (
              <div key={operation.id} className="rounded-2xl border border-slate-100 dark:border-slate-700 p-3">
                <div className="flex justify-between gap-3">
                  <p className="text-xs font-black text-slate-700 dark:text-white">{operation.itemName}</p>
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

      {isEditingSettings && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveSettings} className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-2xl shadow-2xl">
            <div className="flex justify-between items-start gap-4 mb-6">
              <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dimensionamento</p><h2 className="text-2xl font-black text-slate-800 dark:text-white mt-1">Parâmetros do hotel</h2></div>
              <button type="button" onClick={() => setIsEditingSettings(false)} className="p-2 text-slate-400 hover:text-slate-700"><X /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ['Total de apartamentos', 'totalApartments'],
                ['Total de camas', 'totalBeds'],
                ['Camas de solteiro', 'totalSingleBeds'],
                ['Camas de casal', 'totalDoubleBeds'],
                ['Quantidade ideal de giros', 'idealStockMultiplier']
              ].map(([label, field]) => (
                <label key={field} className="text-xs font-black text-slate-500">{label}
                  <input min={0} step={field === 'idealStockMultiplier' ? '0.1' : '1'} type="number" value={draftSettings[field as keyof LinenHotelSettings]} onChange={event => setDraftSettings(current => ({ ...current, [field]: Number(event.target.value) }))} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm" />
                </label>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-5">O mínimo de cada item é calculado pela capacidade selecionada no cadastro da peça. O ideal corresponde ao mínimo multiplicado pelos giros configurados.</p>
            <div className="flex justify-end gap-3 mt-7"><button type="button" onClick={() => setIsEditingSettings(false)} className="px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500">Cancelar</button><button type="submit" className="px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-white flex items-center gap-2" style={{ backgroundColor: theme.primary }}><Save size={16} /> Salvar parâmetros</button></div>
          </form>
        </div>
      )}

      {isAddingItem && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveItem} className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-start gap-4 mb-6">
              <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cadastro de peça</p><h2 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{editingItem ? 'Editar item' : 'Novo item de enxoval'}</h2></div>
              <button type="button" onClick={resetItemForm} className="p-2 text-slate-400 hover:text-slate-700"><X /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="md:col-span-2 text-xs font-black text-slate-500">Nome da peça<input required value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Lençol casal, toalha de banho" className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm font-medium" /></label>
              <label className="text-xs font-black text-slate-500">Categoria<select value={category} onChange={event => setCategory(event.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm">{categoryOptions.map(option => <option key={option}>{option}</option>)}</select></label>
              <label className="text-xs font-black text-slate-500">Unidade<input value={unit} onChange={event => setUnit(event.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm" /></label>
              <label className="text-xs font-black text-slate-500">Base do cálculo<select value={calculationBasis} onChange={event => setCalculationBasis(event.target.value as LinenCalculationBasis)} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm">{basisOptions.map(option => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>
              {calculationBasis === 'Manual' ? <label className="text-xs font-black text-slate-500">Quantidade mínima<input min={0} type="number" value={minCleanQuantity} onChange={event => setMinCleanQuantity(Number(event.target.value))} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm" /></label> : <label className="text-xs font-black text-slate-500">Peças por {calculationBasis.toLowerCase()}<input min={0} step="0.1" type="number" value={quantityPerBasis} onChange={event => setQuantityPerBasis(Number(event.target.value))} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm" /></label>}
              <label className="text-xs font-black text-slate-500">Giros ideais específicos <span className="font-normal">(opcional)</span><input min={0} step="0.1" type="number" value={idealMultiplier} onChange={event => setIdealMultiplier(Number(event.target.value))} placeholder={`Padrão do hotel: ${hotelSettings.idealStockMultiplier || 3}`} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm" /></label>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
              {[
                ['Limpo', quantityClean, setQuantityClean], ['Em uso', quantityInUse, setQuantityInUse], ['Sujo', quantityDirty, setQuantityDirty], ['Lavanderia', quantityLaundry, setQuantityLaundry], ['Manchado', quantityStained, setQuantityStained], ['Rasgado', quantityTorn, setQuantityTorn], ['Outra avaria', quantityDamaged, setQuantityDamaged], ['Extraviado', quantityLost, setQuantityLost]
              ].map(([label, value, setter]) => <label key={String(label)} className="text-xs font-black text-slate-500">{String(label)}<input min={0} type="number" value={Number(value)} onChange={event => (setter as React.Dispatch<React.SetStateAction<number>>)(Number(event.target.value))} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm" /></label>)}
            </div>
            <div className="flex justify-end gap-3 mt-7"><button type="button" onClick={resetItemForm} className="px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500">Cancelar</button><button type="submit" className="px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-white" style={{ backgroundColor: theme.primary }}>Salvar item</button></div>
          </form>
        </div>
      )}

      {isAddingOperation && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveOperation} className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-2xl shadow-2xl">
            <div className="flex justify-between items-start gap-4 mb-6"><div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fluxo operacional</p><h2 className="text-2xl font-black text-slate-800 dark:text-white mt-1">Registrar movimentação</h2></div><button type="button" onClick={resetOperationForm} className="p-2 text-slate-400 hover:text-slate-700"><X /></button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-xs font-black text-slate-500">Tipo de operação<select value={operationType} onChange={event => setOperationType(event.target.value as LinenOperation['type'])} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm"><option>Transferência</option><option>Entrada</option><option>Baixa</option></select></label>
              <label className="text-xs font-black text-slate-500">Item<select required value={operationItemId} onChange={event => setOperationItemId(event.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm"><option value="">Selecione uma peça</option>{items.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
              {operationType !== 'Entrada' && <label className="text-xs font-black text-slate-500">Origem<select value={fromStatus} onChange={event => setFromStatus(event.target.value as LinenStockStatus)} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm">{statusOptions.map(option => <option value={option.id} key={option.id}>{option.label}</option>)}</select>{selectedOperationItem && <span className="block text-[10px] text-slate-400 mt-1">Saldo na origem: {getStatusQuantity(selectedOperationItem, fromStatus)}</span>}</label>}
              {operationType !== 'Baixa' && <label className="text-xs font-black text-slate-500">Destino<select value={toStatus} onChange={event => setToStatus(event.target.value as LinenStockStatus)} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm">{statusOptions.map(option => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>}
              <label className="text-xs font-black text-slate-500">Quantidade<input required min={1} type="number" value={operationQuantity} onChange={event => setOperationQuantity(Number(event.target.value))} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm" /></label>
              <label className="text-xs font-black text-slate-500">Local ou referência<input value={operationLocation} onChange={event => setOperationLocation(event.target.value)} placeholder="Ex.: Apto 203, rouparia, lavanderia" className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm" /></label>
              <label className="md:col-span-2 text-xs font-black text-slate-500">Observação / justificativa<textarea value={operationReason} onChange={event => setOperationReason(event.target.value)} placeholder="Obrigatória para manchados, rasgados, extravios e baixas" className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm min-h-20" /></label>
            </div>
            <div className="flex justify-end gap-3 mt-7"><button type="button" onClick={resetOperationForm} className="px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500">Cancelar</button><button type="submit" className="px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-white flex items-center gap-2" style={{ backgroundColor: theme.primary }}><ClipboardList size={16} /> Registrar</button></div>
          </form>
        </div>
      )}

      {isClosingInventory && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3">
          <form onSubmit={handleSaveMonthlyInventory} className="bg-white dark:bg-slate-800 rounded-[2rem] p-5 w-full max-w-[1500px] max-h-[95vh] overflow-y-auto shadow-2xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
              <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contagem física completa</p><h2 className="text-2xl font-black text-slate-800 dark:text-white mt-1">Fechamento mensal do enxoval</h2><p className="text-xs text-slate-500 mt-2">Informe os quantitativos contados. Divergências em relação ao saldo esperado precisam ser justificadas.</p></div>
              <button type="button" onClick={() => setIsClosingInventory(false)} className="p-2 text-slate-400 hover:text-slate-700 self-end lg:self-auto"><X /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              <label className="text-xs font-black text-slate-500">Competência<input required type="month" value={inventoryMonth} onChange={event => handleInventoryMonthChange(event.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm" /></label>
              <label className="md:col-span-2 text-xs font-black text-slate-500">Observações gerais<input value={inventoryNotes} onChange={event => setInventoryNotes(event.target.value)} placeholder="Ex.: contagem acompanhada pela governança e rouparia" className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none text-sm" /></label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1450px] text-left">
                <thead><tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-700">
                  <th className="py-3 pr-3">Item</th><th className="py-3 px-2 text-right">Esperado físico</th><th className="py-3 px-2 text-right">Limpo</th><th className="py-3 px-2 text-right">Em uso</th><th className="py-3 px-2 text-right">Sujo</th><th className="py-3 px-2 text-right">Lavanderia</th><th className="py-3 px-2 text-right">Manchado</th><th className="py-3 px-2 text-right">Rasgado</th><th className="py-3 px-2 text-right">Outra avaria</th><th className="py-3 px-2 text-right">Extraviado</th><th className="py-3 px-2 text-right">Contado físico</th><th className="py-3 px-2 text-right">Divergência</th><th className="py-3 pl-2">Justificativa</th>
                </tr></thead>
                <tbody>{items.map(item => {
                  const entry = inventoryDraft[item.id];
                  if (!entry) return null;
                  return <tr key={item.id} className="border-b border-slate-100 dark:border-slate-700/70 text-sm">
                    <td className="py-3 pr-3 font-black text-slate-700 dark:text-white">{item.name}</td>
                    <td className="py-3 px-2 text-right font-bold text-slate-500">{entry.expectedPhysicalTotal}</td>
                    {(['quantityClean', 'quantityInUse', 'quantityDirty', 'quantityLaundry', 'quantityStained', 'quantityTorn', 'quantityDamaged', 'quantityLost'] as (keyof LinenMonthlyInventoryItem)[]).map(field => <td key={field} className="py-2 px-1"><input min={0} type="number" value={Number(entry[field] || 0)} onChange={event => updateInventoryDraft(item.id, field, Number(event.target.value))} className="w-20 px-2 py-2 rounded-lg text-right bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 outline-none" /></td>)}
                    <td className="py-3 px-2 text-right font-black text-slate-700 dark:text-white">{entry.countedPhysicalTotal}</td>
                    <td className={`py-3 px-2 text-right font-black ${entry.variance < 0 ? 'text-rose-600' : entry.variance > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{entry.variance > 0 ? '+' : ''}{entry.variance}</td>
                    <td className="py-2 pl-2"><input value={entry.varianceReason || ''} onChange={event => updateInventoryDraft(item.id, 'varianceReason', event.target.value)} placeholder={entry.variance !== 0 ? 'Obrigatória' : 'Opcional'} className={`w-56 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border outline-none ${entry.variance !== 0 && !entry.varianceReason ? 'border-rose-300' : 'border-slate-100 dark:border-slate-700'}`} /></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
            <div className="flex justify-end gap-3 mt-6"><button type="button" onClick={() => setIsClosingInventory(false)} className="px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500">Cancelar</button><button type="submit" className="px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-white flex items-center gap-2" style={{ backgroundColor: theme.primary }}><Save size={16} /> Salvar fechamento mensal</button></div>
          </form>
        </div>
      )}
    </div>
  );
};

export default LinenView;
