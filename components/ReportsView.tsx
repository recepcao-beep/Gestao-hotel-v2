
import React, { useState, useMemo } from 'react';
import { Apartment, HotelTheme } from '../types';
import { getDirectDriveUrl } from '../utils/imageUtils';
import { 
  FileBarChart, 
  Search, 
  Filter, 
  Printer, 
  AlertTriangle,
  Clock,
  Tv,
  Lightbulb,
  Droplets,
  Layers,
  CheckCircle2,
  Building2,
  Bed,
  Box,
  Wind,
  Scan,
  Scissors,
  Trash2,
  ChevronRight,
  Maximize,
  AlertOctagon,
  Layout,
  X,
  ChevronDown,
  ChevronUp,
  Maximize2
} from 'lucide-react';

interface ReportsViewProps {
  apartments: Record<string, Apartment>;
  theme: HotelTheme;
  onSelectApartment: (id: string) => void;
}

// Estrutura de Filtros Completa (Movida do FloorDetailView)
const FILTER_SECTIONS = [
  {
    id: 'status',
    label: 'Status Geral',
    icon: AlertTriangle,
    color: 'text-red-500',
    filters: [
      { key: 'status_geral', label: 'Condição', options: ['Com Avaria', 'Urgente', 'Sem Avaria'] }
    ]
  },
  {
    id: 'piso',
    label: 'Piso do Quarto',
    icon: Droplets,
    color: 'text-blue-600',
    filters: [
      { key: 'pisoType', label: 'Tipo', options: ['Granito', 'Madeira', 'Cerâmica'] },
      { key: 'pisoStatus', label: 'Estado', options: ['Bom estado', 'Tolerável', 'Reparo urgente'] }
    ]
  },
  {
    id: 'mobiliario',
    label: 'Mobiliário Geral',
    icon: Layout,
    color: 'text-slate-700',
    filters: [
      { key: 'moveisStatus', label: 'Estado', options: ['Bom estado', 'Danificado'] },
      { key: 'moveisDetalhes', label: 'Item Danificado', options: ['Guarda Roupa', 'Criado mudo', 'Cômoda'] }
    ]
  },
  {
    id: 'banheiro',
    label: 'Banheiro',
    icon: Layers,
    color: 'text-indigo-600',
    filters: [
      { key: 'banheiroType', label: 'Tipo', options: ['Reformado', 'Antigo'] },
      { key: 'banheiroStatus', label: 'Estado', options: ['Tolerável', 'Reparo urgente'] }
    ]
  },
  {
    id: 'climatizacao',
    label: 'Climatização & TV',
    icon: Wind,
    color: 'text-cyan-600',
    filters: [
      { key: 'acBrand', label: 'Marca AC', options: ['Midea', 'LG', 'Gree'] },
      { key: 'tvBrand', label: 'Marca TV', options: ['LG', 'Samsung', 'Philco', 'Smart Roku', 'Toshiba'] }
    ]
  },
  {
    id: 'acessorios',
    label: 'Acessórios & Itens',
    icon: Box,
    color: 'text-amber-600',
    filters: [
      { key: 'temCortina', label: 'Tem Cortina?', options: ['Sim', 'Não'] },
      { key: 'cortinaStatus', label: 'Estado Cortina', options: ['Nova', 'Antiga'] },
      { key: 'cortinaCoverage', label: 'Cobertura', options: ['Dois lados', 'Um lado'] },
      { key: 'temCofre', label: 'Tem Cofre?', options: ['Sim', 'Não'] },
      { key: 'temPortaControle', label: 'Porta Controle?', options: ['Sim', 'Não'] },
      { key: 'temEspelhoCorpo', label: 'Espelho Corpo?', options: ['Sim', 'Não'] },
      { key: 'espelhoCorpoStatus', label: 'Estado Espelho', options: ['Bom estado', 'Manchado', 'Danificado'] },
      { key: 'temCabide', label: 'Tem Cabides?', options: ['Sim', 'Não'] }
    ]
  },
  {
    id: 'banheiro_acessorios',
    label: 'Banheiro: Acessórios',
    icon: Droplets,
    color: 'text-cyan-600',
    filters: [
      { key: 'temSuporteShampoo', label: 'Sup. Shampoo?', options: ['Sim', 'Não'] },
      { key: 'suporteShampooStatus', label: 'Est. Shampoo', options: ['Bom estado', 'Enferrujado'] },
      { key: 'temSuportePapel', label: 'Sup. Papel?', options: ['Sim', 'Não'] }
    ]
  },
  {
    id: 'iluminacao',
    label: 'Iluminação',
    icon: Lightbulb,
    color: 'text-yellow-600',
    filters: [
      { key: 'luminariaType', label: 'Tipo', options: ['Arandela', 'Vidro', 'Quadrado'] },
      { key: 'luminariaColor', label: 'Cor (Quadrada)', options: ['Branco', 'Preto'] }
    ]
  },
  {
    id: 'camas',
    label: 'Configuração das Camas',
    icon: Bed,
    color: 'text-emerald-600',
    filters: [
      { key: 'bed_type', label: 'Tipo de Cama', options: ['Casal', 'Solteiro'] },
      { key: 'bed_base_status', label: 'Estado Base', options: ['Nova', 'Antiga'] },
      { key: 'bed_mattress_status', label: 'Estado Colchão', options: ['Novo', 'Antigo'] },
      { key: 'bed_has_skirt', label: 'Tem Saia?', options: ['Sim', 'Não'] }
    ]
  }
];

// Group apartments by floor for the filter
const getApartmentOptions = (apartments: Record<string, Apartment>) => {
  const floors = Array.from(new Set(Object.values(apartments).map(a => a.floor))).sort((a, b) => a - b);
  return floors.map(floor => ({
    floor,
    rooms: Object.values(apartments)
      .filter(a => a.floor === floor)
      .map(a => a.roomNumber.toString())
      .sort((a, b) => parseInt(a) - parseInt(b))
  }));
};

const ReportsView: React.FC<ReportsViewProps> = ({ apartments, theme, onSelectApartment }) => {
  const [selectedFloors, setSelectedFloors] = useState<number[]>([]);
  const [activeReport, setActiveReport] = useState<string>('AVARIAS_GERAIS');
  const [searchTerm, setSearchTerm] = useState('');
  const [defectSearchTerm, setDefectSearchTerm] = useState('');
  
  // Advanced Filters State
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ 'status': true });
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d'>('all');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const floors = [200, 300, 400, 500, 600, 700];

  const reportPresets = [
    { id: 'AVARIAS_GERAIS', label: 'Com Avarias', icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-50' },
    { id: 'URGENTE_GERAL', label: 'Itens Urgentes', icon: AlertOctagon, color: 'text-red-600', bg: 'bg-red-100' },
  ];

  const toggleSection = (id: string) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleFilter = (key: string, value: string) => {
    setActiveFilters(prev => {
      const current = prev[key] || [];
      const next = current.includes(value) 
        ? current.filter(v => v !== value) 
        : [...current, value];
      
      const newState = { ...prev };
      if (next.length === 0) {
        delete newState[key];
      } else {
        newState[key] = next;
      }
      return newState;
    });
  };

  const hasActiveFilters = Object.keys(activeFilters).length > 0 || dateFilter !== 'all' || defectSearchTerm !== '';

  const removeFilter = (key: string) => {
    if (key === 'date') {
      setDateFilter('all');
    } else if (key === 'defectSearch') {
      setDefectSearchTerm('');
    } else {
      setActiveFilters(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const clearAllFilters = () => {
    setActiveFilters({});
    setDateFilter('all');
    setDefectSearchTerm('');
    setSearchTerm('');
  };

  const toggleFloor = (floor: number) => {
    setSelectedFloors(prev => 
      prev.includes(floor) ? prev.filter(f => f !== floor) : [...prev, floor]
    );
  };

  const filteredData = useMemo(() => {
    let list: Apartment[] = Object.values(apartments);

    // 1. Filter by Floor
    if (selectedFloors.length > 0) {
      list = list.filter(apt => selectedFloors.includes(apt.floor));
    }

    // 2. Filter by Search Term (Room Number)
    if (searchTerm) {
      const searchTerms = searchTerm.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      list = list.filter(apt => 
        searchTerms.some(term => apt.roomNumber.toString().includes(term))
      );
    }

    // 2.1 Filter by Defect Search Term
    if (defectSearchTerm) {
      const lowerSearch = defectSearchTerm.toLowerCase();
      list = list.filter(apt => 
        apt.defects?.some(d => d.description.toLowerCase().includes(lowerSearch))
      );
    }

    // 2.2 Filter by Date
    if (dateFilter !== 'all') {
      const now = Date.now();
      const days = dateFilter === '7d' ? 7 : 30;
      const threshold = now - (days * 24 * 60 * 60 * 1000);
      list = list.filter(apt => 
        apt.defects?.some(d => d.timestamp >= threshold)
      );
    }

    // 3. Logic: If Manual Filters are active, use them exclusively. Otherwise use the Preset.
    if (hasActiveFilters) {
       const bedFilters = Object.entries(activeFilters).filter(([k]) => k.startsWith('bed_')) as [string, string[]][];
       const otherFilters = Object.entries(activeFilters).filter(([k]) => !k.startsWith('bed_')) as [string, string[]][];

       list = list.filter(apt => {
          // Check non-bed filters
          const passOthers = otherFilters.every(([key, values]) => {
            if (!values || values.length === 0) return true;
            
            return values.some(strValue => {
              // Lógica Status Geral
              if (key === 'status_geral') {
                const hasDefects = (apt?.defects?.length || 0) > 0;
                const isUrgent = apt?.pisoStatus === 'Reparo urgente' || apt?.banheiroStatus === 'Reparo urgente';
                if (strValue === 'Com Avaria') return hasDefects;
                if (strValue === 'Urgente') return isUrgent;
                if (strValue === 'Sem Avaria') return !hasDefects && !isUrgent;
              }

              // Lógica de Arrays
              if (key === 'moveisDetalhes') {
                return apt.moveisDetalhes?.includes(strValue);
              }

              // Lógica Booleana
              if (['temCortina', 'temCofre', 'temPortaControle', 'temEspelhoCorpo', 'temCabide', 'temSuporteShampoo', 'temSuportePapel'].includes(key)) {
                return (apt as any)[key] === (strValue === 'Sim');
              }

              // Comparação Direta (com suporte a números)
              const aptValue = (apt as any)[key];
              if (typeof aptValue === 'number') {
                return aptValue.toString() === strValue;
              }
              return aptValue === strValue;
            });
          });

          if (!passOthers) return false;

          // Check bed filters (Intersection logic: at least one bed must match ALL active bed filters)
          if (bedFilters.length > 0) {
            if (!apt.beds || apt.beds.length === 0) return false;
            return apt.beds.some(bed => {
              return bedFilters.every(([key, values]) => {
                if (!values || values.length === 0) return true;
                return values.some(strValue => {
                  if (key === 'bed_type') return bed.type === strValue;
                  if (key === 'bed_base_status') return bed.baseStatus === strValue;
                  if (key === 'bed_mattress_status') return bed.mattressStatus === strValue;
                  if (key === 'bed_has_skirt') return (strValue === 'Sim' ? bed.hasSkirt === true : !bed.hasSkirt);
                  return true;
                });
              });
            });
          }

          return true;
       });
    } else {
      // Use Presets if no manual filters
      switch (activeReport) {
        case 'AVARIAS_GERAIS':
          list = list.filter(apt => (apt.defects?.length || 0) > 0);
          break;
        case 'URGENTE_GERAL':
          list = list.filter(apt => 
              apt.pisoStatus === 'Reparo urgente' || 
              apt.banheiroStatus === 'Reparo urgente'
          );
          break;
      }
    }

    return list.sort((a, b) => a.roomNumber - b.roomNumber);
  }, [apartments, selectedFloors, activeReport, searchTerm, activeFilters, hasActiveFilters, defectSearchTerm, dateFilter]);

  const stats = useMemo(() => {
    return {
      totalFound: filteredData.length,
      percentage: Math.round((filteredData.length / Math.max(1, Object.keys(apartments).length)) * 100)
    };
  }, [filteredData, apartments]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 print:p-0 print:m-0">
      
      {/* Opções de Filtro Global */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 no-print">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <Building2 size={14} />
            <span>Âmbito do Relatório</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setSelectedFloors([])}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${selectedFloors.length === 0 ? 'bg-slate-800 border-slate-800 text-white' : 'bg-slate-50 border-slate-50 text-slate-500'}`}
            >
              Todos
            </button>
            {floors.map(f => (
              <button 
                key={f}
                onClick={() => toggleFloor(f)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${selectedFloors.includes(f) ? 'bg-slate-800 border-slate-800 text-white' : 'bg-slate-50 border-slate-50 text-slate-500'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-center space-y-4">
           <div className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <Filter size={14} />
            <span>Selecione o Tipo de Auditoria</span>
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            {/* Botão de Filtros Avançados (Overlay) */}
            <button 
              onClick={() => setShowFilters(true)}
              className={`flex items-center space-x-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95 ${
                 hasActiveFilters 
                 ? 'bg-blue-600 text-white shadow-blue-200' 
                 : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-slate-400'
              }`}
            >
              <Filter size={16} />
              <span>{hasActiveFilters ? `Filtros Ativos` : 'Filtros Avançados'}</span>
            </button>
            
            {!hasActiveFilters && (
              <div className="flex gap-2 items-center">
                 <span className="text-[10px] text-slate-300 font-bold uppercase mx-2">OU USE OS RÁPIDOS:</span>
                 {reportPresets.map(preset => {
                    const Icon = preset.icon;
                    const isActive = activeReport === preset.id;
                    return (
                      <button 
                        key={preset.id}
                        onClick={() => setActiveReport(preset.id)}
                        className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${
                          isActive 
                          ? 'border-transparent text-white shadow-lg' 
                          : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'
                        }`}
                        style={{ backgroundColor: isActive ? theme.primary : undefined }}
                      >
                        <Icon size={14} />
                        <span>{preset.label}</span>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter Chips Summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 no-print items-center bg-white/50 p-4 rounded-2xl border border-slate-100">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Filtros:</span>
          {defectSearchTerm && (
            <div className="flex items-center bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border border-blue-100">
              <Search size={12} className="mr-1.5" />
              <span>Avaria: {defectSearchTerm}</span>
              <button onClick={() => removeFilter('defectSearch')} className="ml-2 hover:text-blue-800"><X size={12}/></button>
            </div>
          )}
          {dateFilter !== 'all' && (
            <div className="flex items-center bg-amber-50 text-amber-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border border-amber-100">
              <Clock size={12} className="mr-1.5" />
              <span>Período: {dateFilter === '7d' ? '7 dias' : '30 dias'}</span>
              <button onClick={() => removeFilter('date')} className="ml-2 hover:text-amber-800"><X size={12}/></button>
            </div>
          )}
          {Object.entries(activeFilters).map(([key, values]) => {
            const section = FILTER_SECTIONS.find(s => s.filters.some(f => f.key === key));
            const filter = section?.filters.find(f => f.key === key);
            return (values as string[]).map(value => (
              <div key={`${key}-${value}`} className="flex items-center bg-slate-800 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border border-slate-700">
                <span>{filter?.label}: {value}</span>
                <button onClick={() => toggleFilter(key, value)} className="ml-2 hover:text-slate-300"><X size={12}/></button>
              </div>
            ));
          })}
          <button 
            onClick={clearAllFilters}
            className="text-[10px] font-black text-rose-500 uppercase hover:underline ml-2"
          >
            Limpar Tudo
          </button>
        </div>
      )}

      {/* Filter Modal / Overlay */}
      {showFilters && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex justify-end" onClick={() => setShowFilters(false)}>
           <div 
             className="w-full md:max-w-sm h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
             onClick={e => e.stopPropagation()}
           >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                 <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                    <Filter size={18} /> Filtros
                 </h3>
                 <button onClick={() => setShowFilters(false)} className="p-2 bg-white rounded-full text-slate-400 shadow-sm transition-all active:scale-90"><X size={20}/></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                 {/* Search by Defect Description */}
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Buscar por Avaria</label>
                    <div className="relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                       <input 
                         type="text" 
                         placeholder="Ex: lâmpada, vazamento..." 
                         value={defectSearchTerm}
                         onChange={e => setDefectSearchTerm(e.target.value)}
                         className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-2xl border-2 border-slate-100 text-sm font-bold focus:border-blue-500 outline-none transition-all"
                       />
                    </div>
                 </div>

                 {/* Date Range Filter */}
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Período das Avarias</label>
                    <div className="flex gap-2">
                       {['all', '7d', '30d'].map(opt => (
                          <button
                            key={opt}
                            onClick={() => setDateFilter(opt as any)}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${
                               dateFilter === opt 
                               ? 'bg-slate-800 border-slate-800 text-white shadow-md' 
                               : 'bg-white border-slate-100 text-slate-400'
                            }`}
                          >
                             {opt === 'all' ? 'Sempre' : (opt === '7d' ? '7 Dias' : '30 Dias')}
                          </button>
                       ))}
                    </div>
                 </div>

                 <div className="w-full h-px bg-slate-100 my-4"></div>

                 {/* Apartment Selection */}
               <div className="border-b border-slate-50">
                  <button 
                    onClick={() => toggleSection('apartments')}
                    className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><Building2 size={18}/></div>
                      <div className="text-left">
                        <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Apartamentos Específicos</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Selecione unidades individuais</p>
                      </div>
                    </div>
                    {expandedSections['apartments'] ? <ChevronUp size={20} className="text-slate-300"/> : <ChevronDown size={20} className="text-slate-300"/>}
                  </button>
                  
                  {expandedSections['apartments'] && (
                    <div className="p-4 bg-white space-y-4 max-h-[400px] overflow-y-auto">
                      {getApartmentOptions(apartments).map(group => (
                        <div key={group.floor} className="space-y-2">
                          <p className="text-[9px] font-black text-slate-300 uppercase ml-1">Andar {group.floor}</p>
                          <div className="flex flex-wrap gap-2">
                            {group.rooms.map(room => (
                              <button
                                key={room}
                                onClick={() => toggleFilter('roomNumber', room)}
                                className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${
                                  activeFilters['roomNumber']?.includes(room)
                                  ? 'bg-slate-800 border-slate-800 text-white shadow-md'
                                  : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'
                                }`}
                              >
                                {room}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
               </div>

               {FILTER_SECTIONS.map(section => {
                    const isExpanded = expandedSections[section.id];
                    const sectionHasFilter = section.filters.some(f => activeFilters[f.key]);
                    const Icon = section.icon;

                    return (
                       <div key={section.id} className={`border border-slate-100 rounded-2xl overflow-hidden transition-all ${sectionHasFilter ? 'ring-2 ring-blue-100' : ''}`}>
                          <button 
                            onClick={() => toggleSection(section.id)}
                            className="w-full p-4 bg-slate-50 flex items-center justify-between"
                          >
                             <div className="flex items-center space-x-3">
                                <Icon size={18} className={section.color} />
                                <span className={`text-xs font-black uppercase tracking-wide ${sectionHasFilter ? 'text-slate-800' : 'text-slate-500'}`}>{section.label}</span>
                             </div>
                             {isExpanded ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
                          </button>
                          
                          {isExpanded && (
                             <div className="p-4 bg-white space-y-4">
                                {section.filters.map(filter => (
                                   <div key={filter.key}>
                                      <p className="text-[9px] font-black text-slate-300 uppercase mb-2 ml-1">{filter.label}</p>
                                      <div className="flex flex-wrap gap-2">
                                         {filter.options.map(opt => (
                                            <button
                                               key={opt}
                                               onClick={() => toggleFilter(filter.key, opt)}
                                               className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${
                                                  activeFilters[filter.key]?.includes(opt)
                                                  ? 'bg-slate-800 border-slate-800 text-white shadow-md'
                                                  : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'
                                               }`}
                                            >
                                               {opt}
                                            </button>
                                         ))}
                                      </div>
                                   </div>
                                ))}
                             </div>
                          )}
                       </div>
                    );
                 })}
              </div>
              
              <div className="p-6 border-t border-slate-100 bg-slate-50">
                 <button 
                   onClick={() => setShowFilters(false)} 
                   className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                 >
                    Ver {filteredData.length} Resultados
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Resultado do Relatório */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden print:shadow-none print:border-none print:rounded-none">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-6 print:p-4 print:border-b-2">
          <div className="flex items-center space-x-6">
            <div className={`p-5 rounded-[1.5rem] print:p-0 ${hasActiveFilters ? 'bg-blue-50' : reportPresets.find(p => p.id === activeReport)?.bg || 'bg-slate-50'}`}>
              <FileBarChart size={28} className={hasActiveFilters ? 'text-blue-500' : (reportPresets.find(p => p.id === activeReport)?.color || 'text-slate-500')} />
            </div>
            <div>
              <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight print:text-lg">
                {hasActiveFilters ? 'Relatório Personalizado' : `Relatório: ${reportPresets.find(p => p.id === activeReport)?.label}`}
              </h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center print:text-[8px]">
                <span>{selectedFloors.length === 0 ? 'Unidade Completa' : `Andares: ${selectedFloors.join(', ')}`}</span>
                <span className="mx-2 opacity-30">|</span>
                <span className="text-emerald-500">{stats.totalFound} Unidades Localizadas</span>
                <span className="mx-2 opacity-30 no-print">|</span>
                <span className="text-slate-300 no-print">{new Date().toLocaleDateString()}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 no-print">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input 
                type="text" 
                placeholder="Filtrar número..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-slate-50 rounded-xl border-none outline-none text-xs font-bold w-32 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <button 
              onClick={handlePrint}
              className="flex items-center space-x-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-lg font-black text-[10px] uppercase tracking-widest"
            >
              <Printer size={16} />
              <span>Imprimir</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left print:text-[10px]">
            <thead>
              <tr className="bg-slate-50/50 print:bg-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest print:px-2 print:py-2">U.H.</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest print:px-2 print:py-2">Detalhes do Item</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest print:px-2 print:py-2">Camas (Base/Colchão)</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest print:px-2 print:py-2">Banheiro/Acs</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest print:px-2 print:py-2">Observações</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right no-print">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 print:divide-slate-200">
              {filteredData.map(apt => (
                <tr key={apt.id} className="group hover:bg-slate-50/50 transition-colors print:hover:bg-transparent">
                  <td className="px-8 py-5 print:px-2 print:py-3">
                    <div className="flex flex-col">
                      <span className="text-lg font-black text-slate-800 print:text-sm">{apt.roomNumber}</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase print:text-[7px]">Andar {apt.floor}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 print:px-2 print:py-3">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-700">Piso: {apt.pisoType || '---'} ({apt.pisoStatus || 'OK'})</p>
                      <p className="text-[10px] font-bold text-slate-700">Cortina: {apt.temCortina ? (apt.cortinaStatus || 'Sim') : 'Não'}</p>
                      <p className="text-[10px] font-bold text-slate-700">TV: {apt.tvBrand || '---'} | AC: {apt.acBrand || '---'}</p>
                    </div>
                  </td>
                  <td className="px-8 py-5 print:px-2 print:py-3">
                    <div className="space-y-1">
                      {apt.beds?.map((b, i) => (
                        <p key={`${apt.id}-bed-${i}`} className="text-[9px] text-slate-600">
                          {i+1}: {b.type} (B: {b.baseStatus} | C: {b.mattressStatus})
                        </p>
                      ))}
                      {(!apt.beds || apt.beds.length === 0) && <span className="text-[9px] text-slate-300">Não configurado</span>}
                    </div>
                  </td>
                  <td className="px-8 py-5 print:px-2 print:py-3">
                     <div className="space-y-1">
                      <p className="text-[9px] text-slate-600">Tipo: {apt.banheiroType || '---'}</p>
                      <p className="text-[9px] text-slate-600">Shampoo: {apt.temSuporteShampoo ? apt.suporteShampooStatus : 'Não'}</p>
                      <p className="text-[9px] text-slate-600">Cofre: {apt.temCofre ? 'Sim' : 'Não'}</p>
                    </div>
                  </td>
                  <td className="px-8 py-5 print:px-2 print:py-3 text-center">
                    <div className="flex flex-col gap-1 items-center">
                      {(apt.defects?.length || 0) > 0 ? (
                        apt.defects.map((d, di) => (
                          <div key={`${apt.id}-def-${di}`} className="flex flex-col items-center gap-1 mb-2 last:mb-0">
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-600 text-[8px] font-black rounded uppercase print:bg-transparent print:p-0 print:block">
                              • {d.description}
                            </span>
                            {(d.data || (d.driveLink && d.driveLink !== 'pendente')) && (
                              <div 
                                className="relative group cursor-pointer no-print mt-1" 
                                onClick={() => setSelectedImage(getDirectDriveUrl(d.data || d.driveLink))}
                              >
                                <img 
                                  src={getDirectDriveUrl(d.data || d.driveLink)} 
                                  className="w-12 h-12 rounded-lg object-cover shadow-sm border group-hover:brightness-75 transition-all" 
                                  alt="Avaria" 
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    if (!target.src.includes('thumbnail') && (d.driveLink?.includes('drive.google.com') || d.driveLink?.includes('docs.google.com'))) {
                                      const idMatch = d.driveLink.match(/[-\w]{25,50}/);
                                      if (idMatch) {
                                        target.src = `https://drive.google.com/thumbnail?id=${idMatch[0]}&sz=w100`;
                                      }
                                    }
                                  }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Maximize2 size={12} className="text-white" />
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <span className="text-emerald-500 font-black text-[9px] uppercase">✓ Tudo em Dia</span>
                      )}
                      {(apt.pisoStatus === 'Reparo urgente' || apt.banheiroStatus === 'Reparo urgente') && (
                          <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[8px] font-black rounded uppercase print:bg-transparent print:p-0 print:block">
                            • REPARO URGENTE
                          </span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right no-print">
                    <button 
                      onClick={() => onSelectApartment(apt.id)}
                      className="p-2 text-slate-300 hover:text-blue-500 transition-colors bg-slate-50 rounded-xl"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-4 animate-in fade-in duration-300 no-print" onClick={() => setSelectedImage(null)}>
          <button className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all z-[510]">
            <X size={32} />
          </button>
          <img 
            src={selectedImage} 
            alt="Visualização" 
            className="max-w-full max-h-[90dvh] object-contain rounded-lg shadow-2xl animate-in zoom-in duration-300" 
            onClick={(e) => e.stopPropagation()} 
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (!target.src.includes('thumbnail') && (selectedImage?.includes('drive.google.com') || selectedImage?.includes('docs.google.com'))) {
                const idMatch = selectedImage.match(/[-\w]{25,50}/);
                if (idMatch) {
                  target.src = `https://drive.google.com/thumbnail?id=${idMatch[0]}&sz=w1000`;
                }
              }
            }}
          />
        </div>
      )}

      <style>{`
        @media print {
          body { background: white !important; padding: 0 !important; margin: 0 !important; }
          .no-print { display: none !important; }
          main { margin-left: 0 !important; padding: 0 !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:m-0 { margin: 0 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          .print\\:rounded-none { border-radius: 0 !important; }
          table { width: 100% !important; border-collapse: collapse !important; border: 1px solid #e2e8f0 !important; }
          th { background-color: #f8fafc !important; color: #64748b !important; -webkit-print-color-adjust: exact; }
          td, th { border: 1px solid #e2e8f0 !important; padding: 8px !important; }
          tr { page-break-inside: avoid; }
          @page { size: landscape; margin: 1cm; }
        }
      `}</style>
    </div>
  );
};

export default ReportsView;
