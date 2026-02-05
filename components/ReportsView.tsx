
import React, { useState, useMemo } from 'react';
import { Apartment, HotelTheme } from '../types';
import { 
  FileBarChart, 
  Search, 
  Filter, 
  Printer, 
  AlertTriangle,
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
  Maximize
} from 'lucide-react';

interface ReportsViewProps {
  apartments: Record<string, Apartment>;
  theme: HotelTheme;
  onSelectApartment: (id: string) => void;
}

const ReportsView: React.FC<ReportsViewProps> = ({ apartments, theme, onSelectApartment }) => {
  const [selectedFloor, setSelectedFloor] = useState<number | 'all'>('all');
  const [activeReport, setActiveReport] = useState<string>('AVARIAS_GERAIS');
  const [searchTerm, setSearchTerm] = useState('');

  const floors = [200, 300, 400, 500, 600, 700];

  const reportPresets = [
    { id: 'AVARIAS_GERAIS', label: 'Com Avarias', icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-50' },
    { id: 'PISO_REPARO', label: 'Piso c/ Defeito', icon: Droplets, color: 'text-rose-600', bg: 'bg-rose-50' },
    { id: 'PISO_BOM', label: 'Piso Bom Estado', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'PISO_GRANITO', label: 'Piso de Granito', icon: Droplets, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'CORTINA_ANTIGA', label: 'Cortina Antiga', icon: Scissors, color: 'text-amber-600', bg: 'bg-amber-50' },
    { id: 'CORTINA_NOVA', label: 'Cortina Nova', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'SEM_CORTINA', label: 'Sem Cortina', icon: Scan, color: 'text-slate-400', bg: 'bg-slate-50' },
    { id: 'CAMA_BASE_ANTIGA', label: 'Base de Cama Antiga', icon: Bed, color: 'text-orange-600', bg: 'bg-orange-50' },
    { id: 'CAMA_BASE_NOVA', label: 'Base de Cama Nova', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'CAMA_COLCHAO_ANTIGO', label: 'Colchão Antigo', icon: Bed, color: 'text-orange-800', bg: 'bg-orange-100' },
    { id: 'CAMA_COLCHAO_NOVO', label: 'Colchão Novo', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'BANHEIRO_ANTIGO', label: 'Banheiro Antigo', icon: Layers, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'BANHEIRO_REFORMADO', label: 'Banheiro Reformado', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'SHAMPOO_ENFERRUJADO', label: 'Shampoo Enferrujado', icon: Droplets, color: 'text-rose-400', bg: 'bg-rose-50' },
    { id: 'SHAMPOO_BOM', label: 'Shampoo Bom Estado', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'ESPELHO_BOM', label: 'Espelho Bom Estado', icon: Maximize, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'SEM_COFRE', label: 'Sem Cofre', icon: Box, color: 'text-slate-500', bg: 'bg-slate-100' },
    { id: 'SEM_CABIDES', label: 'Sem Cabides', icon: Box, color: 'text-slate-400', bg: 'bg-slate-50' },
    { id: 'TV_LG', label: 'TV LG', icon: Tv, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'TV_SAMSUNG', label: 'TV Samsung', icon: Tv, color: 'text-blue-700', bg: 'bg-blue-100' },
    { id: 'AC_MIDEA', label: 'AC Midea', icon: Wind, color: 'text-cyan-500', bg: 'bg-cyan-50' },
    { id: 'LUMINARIA_ARANDELA', label: 'Luminária Arandela', icon: Lightbulb, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  ];

  const filteredData = useMemo(() => {
    let list: Apartment[] = Object.values(apartments);

    if (selectedFloor !== 'all') {
      list = list.filter(apt => apt.floor === selectedFloor);
    }

    switch (activeReport) {
      case 'AVARIAS_GERAIS':
        list = list.filter(apt => (apt.defects?.length || 0) > 0);
        break;
      case 'PISO_REPARO':
        list = list.filter(apt => apt.pisoStatus === 'Reparo urgente' || apt.pisoStatus === 'Tolerável');
        break;
      case 'PISO_BOM':
        list = list.filter(apt => apt.pisoStatus === 'Bom estado');
        break;
      case 'PISO_GRANITO':
        list = list.filter(apt => apt.pisoType === 'Granito');
        break;
      case 'CORTINA_ANTIGA':
        list = list.filter(apt => apt.temCortina && apt.cortinaStatus === 'Antiga');
        break;
      case 'CORTINA_NOVA':
        list = list.filter(apt => apt.temCortina && apt.cortinaStatus === 'Nova');
        break;
      case 'SEM_CORTINA':
        list = list.filter(apt => !apt.temCortina);
        break;
      case 'CAMA_BASE_ANTIGA':
        list = list.filter(apt => apt.beds?.some(b => b.baseStatus === 'Antiga'));
        break;
      case 'CAMA_BASE_NOVA':
        list = list.filter(apt => apt.beds?.some(b => b.baseStatus === 'Nova'));
        break;
      case 'CAMA_COLCHAO_ANTIGO':
        list = list.filter(apt => apt.beds?.some(b => b.mattressStatus === 'Antigo'));
        break;
      case 'CAMA_COLCHAO_NOVO':
        list = list.filter(apt => apt.beds?.some(b => b.mattressStatus === 'Novo'));
        break;
      case 'BANHEIRO_ANTIGO':
        list = list.filter(apt => apt.banheiroType === 'Antigo');
        break;
      case 'BANHEIRO_REFORMADO':
        list = list.filter(apt => apt.banheiroType === 'Reformado');
        break;
      case 'SHAMPOO_ENFERRUJADO':
        list = list.filter(apt => apt.temSuporteShampoo && apt.suporteShampooStatus === 'Enferrujado');
        break;
      case 'SHAMPOO_BOM':
        list = list.filter(apt => apt.temSuporteShampoo && apt.suporteShampooStatus === 'Bom estado');
        break;
      case 'ESPELHO_BOM':
        list = list.filter(apt => apt.temEspelhoCorpo && apt.espelhoCorpoStatus === 'Bom estado');
        break;
      case 'SEM_COFRE':
        list = list.filter(apt => !apt.temCofre);
        break;
      case 'SEM_CABIDES':
        list = list.filter(apt => !apt.temCabide || (apt.cabideQuantity || 0) === 0);
        break;
      case 'TV_LG':
        list = list.filter(apt => apt.tvBrand === 'LG');
        break;
      case 'TV_SAMSUNG':
        list = list.filter(apt => apt.tvBrand === 'Samsung');
        break;
      case 'AC_MIDEA':
        list = list.filter(apt => apt.acBrand === 'Midea');
        break;
      case 'LUMINARIA_ARANDELA':
        list = list.filter(apt => apt.luminariaType === 'Arandela');
        break;
    }

    if (searchTerm) {
      list = list.filter(apt => apt.roomNumber.toString().includes(searchTerm));
    }

    return list.sort((a, b) => a.roomNumber - b.roomNumber);
  }, [apartments, selectedFloor, activeReport, searchTerm]);

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
              onClick={() => setSelectedFloor('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${selectedFloor === 'all' ? 'bg-slate-800 border-slate-800 text-white' : 'bg-slate-50 border-slate-50 text-slate-500'}`}
            >
              Todos
            </button>
            {floors.map(f => (
              <button 
                key={f}
                onClick={() => setSelectedFloor(f)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${selectedFloor === f ? 'bg-slate-800 border-slate-800 text-white' : 'bg-slate-50 border-slate-50 text-slate-500'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
           <div className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <Filter size={14} />
            <span>Selecione o Item para Auditoria</span>
          </div>
          <div className="flex flex-wrap gap-2">
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
        </div>
      </div>

      {/* Resultado do Relatório */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden print:shadow-none print:border-none print:rounded-none">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-6 print:p-4 print:border-b-2">
          <div className="flex items-center space-x-6">
            <div className={`p-5 rounded-[1.5rem] print:p-0 ${reportPresets.find(p => p.id === activeReport)?.bg}`}>
              {React.createElement(reportPresets.find(p => p.id === activeReport)?.icon || FileBarChart, { 
                size: 28, 
                className: reportPresets.find(p => p.id === activeReport)?.color 
              })}
            </div>
            <div>
              <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight print:text-lg">
                Relatório: {reportPresets.find(p => p.id === activeReport)?.label}
              </h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center print:text-[8px]">
                <span>{selectedFloor === 'all' ? 'Unidade Completa' : `Andar ${selectedFloor}`}</span>
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
                        <p key={i} className="text-[9px] text-slate-600">
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
                  <td className="px-8 py-5 print:px-2 print:py-3">
                    <div className="flex flex-wrap gap-1">
                      {(apt.defects?.length || 0) > 0 ? (
                        apt.defects.map((d, di) => (
                          <span key={di} className="px-2 py-0.5 bg-rose-50 text-rose-600 text-[8px] font-black rounded uppercase print:bg-transparent print:p-0 print:block">
                            • {d.description}
                          </span>
                        ))
                      ) : (
                        <span className="text-emerald-500 font-black text-[9px] uppercase">✓ Tudo em Dia</span>
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
