import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArchiveRestore,
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
  Recycle,
  Save,
  Search,
  Settings2,
  Trash2,
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

const categoryOptions = ['Roupa de cama', 'Banho', 'Piscina', 'Restaurante', 'Outros'];
const damageStatuses: { id: LinenStockStatus; label: string }[] = [
  { id: 'Manchado', label: 'Manchado' },
  { id: 'Rasgado', label: 'Rasgado' }
];
const disposalOriginStatuses: { id: LinenStockStatus; label: string }[] = [
  { id: 'Em uso', label: 'Em uso' },
  { id: 'Manchado', label: 'Manchado' },
  { id: 'Rasgado', label: 'Rasgado' }
];
const basisOptions: { id: LinenCalculationBasis; label: string }[] = [
  { id: 'Apartamento', label: 'Apartamento' },
  { id: 'Cama total', label: 'Cama total' },
  { id: 'Cama solteiro', label: 'Cama de solteiro' },
  { id: 'Cama casal', label: 'Cama de casal' },
  { id: 'Manual', label: 'Mínimo informado manualmente' }
];

const numberValue = (value: unknown) => Math.max(0, Number(value) || 0);

const getStatusField = (status?: LinenStockStatus): keyof LinenItem | null => {
  switch (status) {
    case 'Em uso': return 'quantityInUse';
    case 'Manchado': return 'quantityStained';
    case 'Rasgado': return 'quantityTorn';
    case 'Extraviado': return 'quantityLost';
    // Compatibilidade com dados antigos. Estes campos não aparecem mais no fluxo operacional.
    case 'Limpo': return 'quantityClean';
    case 'Sujo': return 'quantityDirty';
    case 'Lavanderia': return 'quantityLaundry';
    case 'Danificado': return 'quantityDamaged';
    default: return null;
  }
};

const getStatusQuantity = (item: LinenItem, status?: LinenStockStatus) => {
  const field = getStatusField(status);
  return field ? numberValue(item[field]) : 0;
};

const getInUseTotal = (item: LinenItem | LinenMonthlyInventoryItem) => numberValue(item.quantityInUse);
const getPhysicalTotal = (item: LinenItem | LinenMonthlyInventoryItem) => (
  getInUseTotal(item) +
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

type OperationalAction = Extract<LinenOperation['type'], 'Entrada' | 'Avaria' | 'Recuperação' | 'Reciclagem' | 'Extravio' | 'Baixa'>;

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
  const [quantityInUse, setQuantityInUse] = useState(0);
  const [quantityStained, setQuantityStained] = useState(0);
  const [quantityTorn, setQuantityTorn] = useState(0);

  const [operationType, setOperationType] = useState<OperationalAction>('Avaria');
  const [operationItemId, setOperationItemId] = useState('');
  const [fromStatus, setFromStatus] = useState<LinenStockStatus>('Em uso');
  const [damageStatus, setDamageStatus] = useState<LinenStockStatus>('Manchado');
  const [operationQuantity, setOperationQuantity] = useState(1);
  const [operationLocation, setOperationLocation] = useState('');
  const [operationReason, setOperationReason] = useState('');
  const [generatedItemId, setGeneratedItemId] = useState('');
  const [generatedQuantity, setGeneratedQuantity] = useState(1);

  const [draftSettings, setDraftSettings] = useState<LinenHotelSettings>(hotelSettings);
  const [inventoryMonth, setInventoryMonth] = useState(getCurrentMonth());
  const [inventoryNotes, setInventoryNotes] = useState('');
  const [inventoryDraft, setInventoryDraft] = useState<Record<string, LinenMonthlyInventoryItem>>({});
  const [selectedAuditInventoryId, setSelectedAuditInventoryId] = useState('');

  const totals = useMemo(() => items.reduce((acc, item) => {
    acc.inUse += numberValue(item.quantityInUse);
    acc.stained += numberValue(item.quantityStained);
    acc.torn += numberValue(item.quantityTorn);
    acc.otherDamaged += numberValue(item.quantityDamaged);
    acc.lost += numberValue(item.quantityLost);
    return acc;
  }, { inUse: 0, stained: 0, torn: 0, otherDamaged: 0, lost: 0 }), [items]);

  const physicalTotal = totals.inUse + totals.stained + totals.torn + totals.otherDamaged;
  const alertItems = useMemo(
    () => items.filter(item => getPhysicalTotal(item) < getIdealQuantity(item, hotelSettings) || getInUseTotal(item) < getMinimumQuantity(item, hotelSettings)),
    [items, hotelSettings]
  );

  const filteredItems = useMemo(() => items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'Todos' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }), [items, searchTerm, categoryFilter]);

  const selectedOperationItem = useMemo(
    () => items.find(item => item.id === operationItemId),
    [items, operationItemId]
  );
  const selectedGeneratedItem = useMemo(
    () => items.find(item => item.id === generatedItemId),
    [items, generatedItemId]
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
    'Estoque total': numberValue(inventory.totalPhysical),
    'Em uso': numberValue(inventory.totalUsable),
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
    setQuantityInUse(0);
    setQuantityStained(0);
    setQuantityTorn(0);
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
    setQuantityInUse(numberValue(item.quantityInUse));
    setQuantityStained(numberValue(item.quantityStained));
    setQuantityTorn(numberValue(item.quantityTorn));
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
      inventoryModelVersion: 2,
      calculationBasis,
      quantityPerBasis: numberValue(quantityPerBasis),
      idealMultiplier: numberValue(idealMultiplier) || undefined,
      minCleanQuantity: numberValue(minCleanQuantity),
      quantityClean: 0,
      quantityInUse: numberValue(quantityInUse),
      quantityDirty: 0,
      quantityLaundry: 0,
      quantityStained: numberValue(quantityStained),
      quantityTorn: numberValue(quantityTorn),
      quantityDamaged: numberValue(editingItem?.quantityDamaged),
      quantityLost: numberValue(editingItem?.quantityLost),
      lastUpdate: Date.now()
    });
    resetItemForm();
  };

  const resetOperationForm = () => {
    setOperationType('Avaria');
    setOperationItemId('');
    setFromStatus('Em uso');
    setDamageStatus('Manchado');
    setOperationQuantity(1);
    setOperationLocation('');
    setOperationReason('');
    setGeneratedItemId('');
    setGeneratedQuantity(1);
    setIsAddingOperation(false);
  };

  const openOperation = (type: OperationalAction = 'Avaria', item?: LinenItem, selectedDamageStatus?: LinenStockStatus) => {
    resetOperationForm();
    setOperationType(type);
    setOperationItemId(item?.id || '');
    if (type === 'Recuperação' || type === 'Reciclagem') {
      setDamageStatus(selectedDamageStatus === 'Rasgado' ? 'Rasgado' : 'Manchado');
    }
    if (type === 'Baixa') setFromStatus(selectedDamageStatus || 'Rasgado');
    setIsAddingOperation(true);
  };

  const handleSaveOperation = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedOperationItem || operationQuantity <= 0) return;

    let origin: LinenStockStatus | undefined;
    let destination: LinenStockStatus | undefined;
    if (operationType === 'Entrada') destination = 'Em uso';
    if (operationType === 'Avaria') { origin = 'Em uso'; destination = damageStatus; }
    if (operationType === 'Recuperação') { origin = damageStatus; destination = 'Em uso'; }
    if (operationType === 'Reciclagem') origin = damageStatus;
    if (operationType === 'Extravio') { origin = fromStatus; destination = 'Extraviado'; }
    if (operationType === 'Baixa') origin = fromStatus;

    if (origin && getStatusQuantity(selectedOperationItem, origin) < operationQuantity) {
      window.alert(`Saldo insuficiente em “${origin}”. Saldo atual: ${getStatusQuantity(selectedOperationItem, origin)}.`);
      return;
    }

    if (operationType !== 'Entrada' && !operationReason.trim()) {
      window.alert('Informe a justificativa para registrar esta movimentação.');
      return;
    }

    if (operationType === 'Reciclagem' && (!selectedGeneratedItem || generatedQuantity <= 0)) {
      window.alert('Selecione o item gerado e informe a quantidade produzida pela reciclagem.');
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
      reason: operationReason.trim(),
      generatedItemId: operationType === 'Reciclagem' ? selectedGeneratedItem?.id : undefined,
      generatedItemName: operationType === 'Reciclagem' ? selectedGeneratedItem?.name : undefined,
      generatedQuantity: operationType === 'Reciclagem' ? numberValue(generatedQuantity) : undefined
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
        quantityClean: 0,
        quantityInUse: numberValue(item.quantityInUse),
        quantityDirty: 0,
        quantityLaundry: 0,
        quantityStained: numberValue(item.quantityStained),
        quantityTorn: numberValue(item.quantityTorn),
        quantityDamaged: numberValue(item.quantityDamaged),
        quantityLost: numberValue(item.quantityLost),
        expectedPhysicalTotal,
        countedPhysicalTotal: expectedPhysicalTotal,
        usableTotal: getInUseTotal(item),
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
      updated.usableTotal = getInUseTotal(updated);
      updated.variance = updated.countedPhysicalTotal - numberValue(updated.expectedPhysicalTotal);
      return { ...current, [itemId]: updated };
    });
  };

  const handleSaveMonthlyInventory = (event: React.FormEvent) => {
    event.preventDefault();
    const countedItems = items.map(item => {
      const entry = inventoryDraft[item.id];
      const countedPhysicalTotal = getPhysicalTotal(entry);
      const inUse = getInUseTotal(entry);
      return {
        ...entry,
        quantityClean: 0,
        quantityDirty: 0,
        quantityLaundry: 0,
        countedPhysicalTotal,
        usableTotal: inUse,
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
    { label: 'Estoque físico total', value: physicalTotal, icon: Boxes },
    { label: 'Em uso', value: totals.inUse, icon: CheckCircle2 },
    { label: 'Manchadas', value: totals.stained, icon: AlertTriangle },
    { label: 'Rasgadas', value: totals.torn, icon: AlertTriangle },
    { label: 'Extraviadas acumuladas', value: totals.lost, icon: Search }
  ];

  const operationExplanation: Record<OperationalAction, string> = {
    Entrada: 'Adiciona novas peças diretamente ao saldo em uso.',
    Avaria: 'Retira peças do saldo em uso e classifica como manchadas ou rasgadas.',
    Recuperação: 'Devolve peças manchadas ou rasgadas ao saldo em uso após recuperação.',
    Reciclagem: 'Consome peças danificadas e gera automaticamente saldo em uso de outro item.',
    Extravio: 'Retira peças do inventário físico e registra a perda como extravio.',
    Baixa: 'Retira definitivamente peças do inventário físico, com justificativa.'
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Governança e rouparia</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-800 dark:text-white mt-1">Controle de Enxoval</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-3xl">Controle simplificado do estoque total, peças em uso, avarias, reaproveitamento e inventários mensais.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={openSettings} className="px-4 py-3 rounded-2xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 font-black text-xs uppercase tracking-wider text-slate-700 dark:text-white flex items-center justify-center gap-2">
            <Settings2 size={17} /> Parâmetros
          </button>
          <button onClick={openMonthlyInventory} disabled={items.length === 0} className="px-4 py-3 rounded-2xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 font-black text-xs uppercase tracking-wider text-slate-700 dark:text-white flex items-center justify-center gap-2 disabled:opacity-40">
            <CalendarDays size={17} /> Fechar mês
          </button>
          <button onClick={() => openOperation('Avaria')} disabled={items.length === 0} className="px-4 py-3 rounded-2xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 font-black text-xs uppercase tracking-wider text-slate-700 dark:text-white flex items-center justify-center gap-2 disabled:opacity-40">
            <ArrowRight size={17} /> Movimentar
          </button>
          <button onClick={openNewItem} style={{ backgroundColor: theme.primary }} className="px-4 py-3 rounded-2xl text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg">
            <Plus size={17} /> Novo item
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {statCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-3xl border border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800 p-4 shadow-sm">
            <Icon size={18} className="text-slate-400" />
            <p className="text-2xl font-black text-slate-800 dark:text-white mt-3">{value}</p>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Dimensionamento do hotel</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 text-sm text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-2"><Building2 size={16} /> {hotelSettings.totalApartments || registeredApartmentsCount} apartamentos</span>
              <span className="flex items-center gap-2"><Bed size={16} /> {hotelSettings.totalBeds || (hotelSettings.totalSingleBeds + hotelSettings.totalDoubleBeds)} camas</span>
              <span className="flex items-center gap-2"><BedDouble size={16} /> {hotelSettings.totalDoubleBeds} camas de casal</span>
              <span className="flex items-center gap-2"><Bed size={16} /> {hotelSettings.totalSingleBeds} camas de solteiro</span>
              <span className="flex items-center gap-2"><Boxes size={16} /> Ideal: {hotelSettings.idealStockMultiplier} giros</span>
            </div>
          </div>
          {alertItems.length > 0 && (
            <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 text-amber-700 text-xs font-bold flex items-center gap-2">
              <AlertTriangle size={17} /> {alertItems.length} item(ns) abaixo do mínimo em uso ou do estoque ideal.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          <div>
            <h2 className="font-black text-slate-800 dark:text-white">Itens do enxoval</h2>
            <p className="text-xs text-slate-400 mt-1">Clique na quantidade manchada ou rasgada para recuperar ou reciclar o material.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar item" className="pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none" />
            </div>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none">
              <option>Todos</option>
              {categoryOptions.map(option => <option key={option}>{option}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-800/70">
              <tr>
                <th className="px-5 py-4">Item</th>
                <th className="px-3 py-4 text-center">Mínimo</th>
                <th className="px-3 py-4 text-center">Ideal</th>
                <th className="px-3 py-4 text-center">Total físico</th>
                <th className="px-3 py-4 text-center">Em uso</th>
                <th className="px-3 py-4 text-center">Manchado</th>
                <th className="px-3 py-4 text-center">Rasgado</th>
                <th className="px-3 py-4 text-center">Extraviado</th>
                <th className="px-5 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.map(item => {
                const minimum = getMinimumQuantity(item, hotelSettings);
                const ideal = getIdealQuantity(item, hotelSettings);
                const physical = getPhysicalTotal(item);
                const inUse = getInUseTotal(item);
                return (
                  <tr key={item.id} className="text-sm">
                    <td className="px-5 py-4">
                      <p className="font-black text-slate-800 dark:text-white">{item.name}</p>
                      <p className="text-[11px] text-slate-400 mt-1">{item.category} · {item.unit}</p>
                    </td>
                    <td className="px-3 py-4 text-center font-bold text-slate-600 dark:text-slate-300">{minimum}</td>
                    <td className="px-3 py-4 text-center font-bold text-slate-600 dark:text-slate-300">{ideal}</td>
                    <td className="px-3 py-4 text-center"><span className={`font-black ${physical < ideal ? 'text-amber-600' : 'text-slate-700 dark:text-white'}`}>{physical}</span></td>
                    <td className="px-3 py-4 text-center"><span className={`font-black ${inUse < minimum ? 'text-red-600' : 'text-emerald-600'}`}>{inUse}</span></td>
                    <td className="px-3 py-4 text-center">
                      <button onClick={() => openOperation('Recuperação', item, 'Manchado')} disabled={!numberValue(item.quantityStained)} className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 font-black disabled:opacity-50" title="Tratar peças manchadas">{numberValue(item.quantityStained)}</button>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <button onClick={() => openOperation('Reciclagem', item, 'Rasgado')} disabled={!numberValue(item.quantityTorn)} className="px-3 py-1.5 rounded-xl bg-red-50 text-red-700 font-black disabled:opacity-50" title="Tratar peças rasgadas">{numberValue(item.quantityTorn)}</button>
                    </td>
                    <td className="px-3 py-4 text-center font-bold text-slate-500">{numberValue(item.quantityLost)}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openOperation('Avaria', item)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800" title="Registrar avaria"><AlertTriangle size={16} /></button>
                        <button onClick={() => openEditItem(item)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800" title="Editar item"><Pencil size={16} /></button>
                        <button onClick={() => { if (window.confirm(`Excluir “${item.name}”?`)) onDelete(item.id); }} className="p-2 rounded-xl hover:bg-red-50 text-red-500" title="Excluir item"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-slate-400">Nenhum item cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center gap-2"><BarChart3 size={18} className="text-slate-400" /><h2 className="font-black text-slate-800 dark:text-white">Progressão mensal do inventário</h2></div>
          {chartData.length > 0 ? (
            <div className="h-72 mt-5">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Estoque total" stroke={theme.primary} strokeWidth={3} />
                  <Line type="monotone" dataKey="Em uso" stroke={theme.secondary} strokeWidth={2} />
                  <Line type="monotone" dataKey="Manchadas" stroke="#d97706" strokeWidth={2} />
                  <Line type="monotone" dataKey="Rasgadas" stroke="#dc2626" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-sm text-slate-400 mt-5">Realize o primeiro fechamento mensal para iniciar o gráfico.</p>}
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center gap-2"><History size={18} className="text-slate-400" /><h2 className="font-black text-slate-800 dark:text-white">Movimentações recentes</h2></div>
          <div className="mt-4 space-y-3 max-h-72 overflow-y-auto pr-1">
            {history.slice(0, 15).map(operation => (
              <div key={operation.id} className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-3">
                <div className="flex justify-between gap-3">
                  <p className="text-xs font-black text-slate-700 dark:text-white">{operation.type}: {operation.itemName}</p>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">{formatDateTime(operation.timestamp)}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {operation.fromStatus ? `${operation.fromStatus} → ` : ''}{operation.toStatus || (operation.type === 'Reciclagem' ? 'Reciclado' : 'Baixa')} · {operation.quantity} peça(s)
                </p>
                {operation.type === 'Reciclagem' && <p className="text-xs font-bold text-emerald-700 mt-1">Gerou: {operation.generatedQuantity} peça(s) de {operation.generatedItemName}</p>}
                {operation.reason && <p className="text-xs text-slate-500 mt-1">Justificativa: {operation.reason}</p>}
              </div>
            ))}
            {history.length === 0 && <p className="text-sm text-slate-400">Nenhuma movimentação registrada.</p>}
          </div>
        </div>
      </div>

      {sortedMonthlyInventories.length > 0 && (
        <div className="rounded-3xl border border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-slate-800 dark:text-white">Auditoria dos inventários mensais</h2>
              <p className="text-xs text-slate-400 mt-1">Consulte divergências e justificativas registradas em cada fechamento.</p>
            </div>
            <select value={selectedAuditInventory?.id || ''} onChange={event => setSelectedAuditInventoryId(event.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none">
              {sortedMonthlyInventories.map(inventory => <option key={inventory.id} value={inventory.id}>{formatMonth(inventory.month)}</option>)}
            </select>
          </div>
          {selectedAuditInventory && (
            <div className="overflow-x-auto mt-4">
              <table className="w-full min-w-[760px] text-sm text-left">
                <thead className="text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="py-3">Item</th><th className="py-3 text-center">Esperado</th><th className="py-3 text-center">Contado</th><th className="py-3 text-center">Divergência</th><th className="py-3">Justificativa</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedAuditInventory.items.map(entry => <tr key={entry.itemId}><td className="py-3 font-bold">{entry.itemName}</td><td className="py-3 text-center">{entry.expectedPhysicalTotal}</td><td className="py-3 text-center">{entry.countedPhysicalTotal}</td><td className={`py-3 text-center font-black ${entry.variance !== 0 ? 'text-red-600' : 'text-emerald-600'}`}>{entry.variance}</td><td className="py-3 text-slate-500">{entry.varianceReason || '—'}</td></tr>)}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {isAddingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveItem} className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <div className="flex justify-between items-center gap-3"><h2 className="text-xl font-black text-slate-800 dark:text-white">{editingItem ? 'Editar item' : 'Cadastrar item'}</h2><button type="button" onClick={resetItemForm}><X /></button></div>
            <div className="grid md:grid-cols-2 gap-4 mt-5">
              <label className="text-xs font-bold text-slate-500">Nome<input required value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent" /></label>
              <label className="text-xs font-bold text-slate-500">Categoria<select value={category} onChange={e => setCategory(e.target.value)} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent">{categoryOptions.map(option => <option key={option}>{option}</option>)}</select></label>
              <label className="text-xs font-bold text-slate-500">Unidade<input value={unit} onChange={e => setUnit(e.target.value)} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent" /></label>
              <label className="text-xs font-bold text-slate-500">Base do cálculo do mínimo<select value={calculationBasis} onChange={e => setCalculationBasis(e.target.value as LinenCalculationBasis)} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent">{basisOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
              {calculationBasis === 'Manual' ? (
                <label className="text-xs font-bold text-slate-500">Quantidade mínima<input type="number" min="0" value={minCleanQuantity} onChange={e => setMinCleanQuantity(numberValue(e.target.value))} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent" /></label>
              ) : (
                <label className="text-xs font-bold text-slate-500">Peças necessárias por unidade<input type="number" min="0" step="0.01" value={quantityPerBasis} onChange={e => setQuantityPerBasis(numberValue(e.target.value))} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent" /></label>
              )}
              <label className="text-xs font-bold text-slate-500">Giros ideais específicos <span className="font-normal">(opcional)</span><input type="number" min="0" value={idealMultiplier} onChange={e => setIdealMultiplier(numberValue(e.target.value))} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent" /></label>
            </div>
            <div className="grid sm:grid-cols-3 gap-4 mt-5 rounded-2xl bg-slate-50 dark:bg-slate-800 p-4">
              <label className="text-xs font-bold text-slate-500">Em uso<input type="number" min="0" value={quantityInUse} onChange={e => setQuantityInUse(numberValue(e.target.value))} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" /></label>
              <label className="text-xs font-bold text-slate-500">Manchado<input type="number" min="0" value={quantityStained} onChange={e => setQuantityStained(numberValue(e.target.value))} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" /></label>
              <label className="text-xs font-bold text-slate-500">Rasgado<input type="number" min="0" value={quantityTorn} onChange={e => setQuantityTorn(numberValue(e.target.value))} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" /></label>
              <p className="sm:col-span-3 text-xs text-slate-500">Total físico atual: <strong>{numberValue(quantityInUse) + numberValue(quantityStained) + numberValue(quantityTorn)}</strong></p>
            </div>
            <div className="flex justify-end gap-3 mt-6"><button type="button" onClick={resetItemForm} className="px-4 py-3 rounded-xl font-bold text-slate-500">Cancelar</button><button type="submit" style={{ backgroundColor: theme.primary }} className="px-5 py-3 rounded-xl text-white font-black flex items-center gap-2"><Save size={17} /> Salvar</button></div>
          </form>
        </div>
      )}

      {isAddingOperation && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveOperation} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <div className="flex justify-between items-center gap-3"><h2 className="text-xl font-black text-slate-800 dark:text-white">Movimentar enxoval</h2><button type="button" onClick={resetOperationForm}><X /></button></div>
            <div className="grid md:grid-cols-2 gap-4 mt-5">
              <label className="text-xs font-bold text-slate-500 md:col-span-2">Operação<select value={operationType} onChange={e => setOperationType(e.target.value as OperationalAction)} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent"><option value="Entrada">Entrada de novas peças</option><option value="Avaria">Registrar avaria</option><option value="Recuperação">Recuperar peça danificada</option><option value="Reciclagem">Reciclar em outro item</option><option value="Extravio">Registrar extravio</option><option value="Baixa">Baixa definitiva</option></select></label>
              <p className="md:col-span-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-slate-500">{operationExplanation[operationType]}</p>
              <label className="text-xs font-bold text-slate-500 md:col-span-2">Item de origem<select required value={operationItemId} onChange={e => setOperationItemId(e.target.value)} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent"><option value="">Selecione</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>

              {(operationType === 'Avaria' || operationType === 'Recuperação' || operationType === 'Reciclagem') && <label className="text-xs font-bold text-slate-500">Classificação<select value={damageStatus} onChange={e => setDamageStatus(e.target.value as LinenStockStatus)} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent">{damageStatuses.map(status => <option key={status.id} value={status.id}>{status.label}</option>)}</select></label>}
              {(operationType === 'Extravio' || operationType === 'Baixa') && <label className="text-xs font-bold text-slate-500">Retirar do status<select value={fromStatus} onChange={e => setFromStatus(e.target.value as LinenStockStatus)} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent">{disposalOriginStatuses.map(status => <option key={status.id} value={status.id}>{status.label}</option>)}</select></label>}
              <label className="text-xs font-bold text-slate-500">Quantidade de origem<input type="number" min="1" value={operationQuantity} onChange={e => setOperationQuantity(numberValue(e.target.value))} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent" /></label>

              {operationType === 'Reciclagem' && <>
                <label className="text-xs font-bold text-slate-500 md:col-span-2">Item gerado pela reciclagem<select required value={generatedItemId} onChange={e => setGeneratedItemId(e.target.value)} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent"><option value="">Selecione</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-500">Quantidade produzida<input type="number" min="1" value={generatedQuantity} onChange={e => setGeneratedQuantity(numberValue(e.target.value))} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent" /></label>
              </>}
              <label className="text-xs font-bold text-slate-500">Local ou referência <span className="font-normal">(opcional)</span><input value={operationLocation} onChange={e => setOperationLocation(e.target.value)} placeholder="Ex.: rouparia" className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent" /></label>
              <label className="text-xs font-bold text-slate-500 md:col-span-2">Justificativa {operationType === 'Entrada' && <span className="font-normal">(opcional)</span>}<textarea required={operationType !== 'Entrada'} value={operationReason} onChange={e => setOperationReason(e.target.value)} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent" rows={3} /></label>
            </div>
            <div className="flex justify-end gap-3 mt-6"><button type="button" onClick={resetOperationForm} className="px-4 py-3 rounded-xl font-bold text-slate-500">Cancelar</button><button type="submit" style={{ backgroundColor: theme.primary }} className="px-5 py-3 rounded-xl text-white font-black flex items-center gap-2">{operationType === 'Reciclagem' ? <Recycle size={17} /> : operationType === 'Recuperação' ? <ArchiveRestore size={17} /> : <Save size={17} />} Registrar</button></div>
          </form>
        </div>
      )}

      {isEditingSettings && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveSettings} className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <div className="flex justify-between items-center gap-3"><h2 className="text-xl font-black text-slate-800 dark:text-white">Parâmetros do hotel</h2><button type="button" onClick={() => setIsEditingSettings(false)}><X /></button></div>
            <div className="grid md:grid-cols-2 gap-4 mt-5">
              <label className="text-xs font-bold text-slate-500">Total de apartamentos<input type="number" min="0" value={draftSettings.totalApartments} onChange={e => setDraftSettings(current => ({ ...current, totalApartments: numberValue(e.target.value) }))} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent" /></label>
              <label className="text-xs font-bold text-slate-500">Total de camas<input type="number" min="0" value={draftSettings.totalBeds} onChange={e => setDraftSettings(current => ({ ...current, totalBeds: numberValue(e.target.value) }))} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent" /></label>
              <label className="text-xs font-bold text-slate-500">Camas de solteiro<input type="number" min="0" value={draftSettings.totalSingleBeds} onChange={e => setDraftSettings(current => ({ ...current, totalSingleBeds: numberValue(e.target.value) }))} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent" /></label>
              <label className="text-xs font-bold text-slate-500">Camas de casal<input type="number" min="0" value={draftSettings.totalDoubleBeds} onChange={e => setDraftSettings(current => ({ ...current, totalDoubleBeds: numberValue(e.target.value) }))} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent" /></label>
              <label className="text-xs font-bold text-slate-500 md:col-span-2">Quantidade ideal de giros<input type="number" min="1" value={draftSettings.idealStockMultiplier} onChange={e => setDraftSettings(current => ({ ...current, idealStockMultiplier: numberValue(e.target.value) }))} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent" /></label>
            </div>
            <div className="flex justify-end gap-3 mt-6"><button type="button" onClick={() => setIsEditingSettings(false)} className="px-4 py-3 rounded-xl font-bold text-slate-500">Cancelar</button><button type="submit" style={{ backgroundColor: theme.primary }} className="px-5 py-3 rounded-xl text-white font-black flex items-center gap-2"><Save size={17} /> Salvar</button></div>
          </form>
        </div>
      )}

      {isClosingInventory && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveMonthlyInventory} className="w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <div className="flex justify-between items-center gap-3"><div><h2 className="text-xl font-black text-slate-800 dark:text-white">Fechamento mensal do inventário</h2><p className="text-xs text-slate-400 mt-1">Informe a contagem física por status. Divergências exigem justificativa.</p></div><button type="button" onClick={() => setIsClosingInventory(false)}><X /></button></div>
            <div className="grid md:grid-cols-2 gap-4 mt-5">
              <label className="text-xs font-bold text-slate-500">Competência<input type="month" value={inventoryMonth} onChange={e => handleInventoryMonthChange(e.target.value)} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent" /></label>
              <label className="text-xs font-bold text-slate-500">Observações gerais<input value={inventoryNotes} onChange={e => setInventoryNotes(e.target.value)} className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent" /></label>
            </div>
            <div className="overflow-x-auto mt-5">
              <table className="w-full min-w-[1000px] text-sm text-left">
                <thead className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-800"><tr><th className="p-3">Item</th><th className="p-3 text-center">Esperado</th><th className="p-3 text-center">Em uso</th><th className="p-3 text-center">Manchado</th><th className="p-3 text-center">Rasgado</th><th className="p-3 text-center">Total contado</th><th className="p-3 text-center">Divergência</th><th className="p-3">Justificativa</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map(item => {
                    const entry = inventoryDraft[item.id];
                    if (!entry) return null;
                    return <tr key={item.id}><td className="p-3 font-bold">{item.name}</td><td className="p-3 text-center">{entry.expectedPhysicalTotal}</td><td className="p-3"><input type="number" min="0" value={entry.quantityInUse} onChange={e => updateInventoryDraft(item.id, 'quantityInUse', numberValue(e.target.value))} className="w-20 px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-center" /></td><td className="p-3"><input type="number" min="0" value={entry.quantityStained} onChange={e => updateInventoryDraft(item.id, 'quantityStained', numberValue(e.target.value))} className="w-20 px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-center" /></td><td className="p-3"><input type="number" min="0" value={entry.quantityTorn} onChange={e => updateInventoryDraft(item.id, 'quantityTorn', numberValue(e.target.value))} className="w-20 px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-center" /></td><td className="p-3 text-center font-black">{entry.countedPhysicalTotal}</td><td className={`p-3 text-center font-black ${entry.variance !== 0 ? 'text-red-600' : 'text-emerald-600'}`}>{entry.variance}</td><td className="p-3"><input value={entry.varianceReason || ''} onChange={e => updateInventoryDraft(item.id, 'varianceReason', e.target.value)} placeholder={entry.variance !== 0 ? 'Obrigatória' : 'Opcional'} className="w-full min-w-[180px] px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent" /></td></tr>;
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-3 mt-6"><button type="button" onClick={() => setIsClosingInventory(false)} className="px-4 py-3 rounded-xl font-bold text-slate-500">Cancelar</button><button type="submit" style={{ backgroundColor: theme.primary }} className="px-5 py-3 rounded-xl text-white font-black flex items-center gap-2"><ClipboardList size={17} /> Salvar fechamento</button></div>
          </form>
        </div>
      )}
    </div>
  );
};

export default LinenView;
