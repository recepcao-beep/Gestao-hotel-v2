
import React, { useState, useMemo } from 'react';
import { Apartment, HotelTheme } from '../types';
import { ChevronLeft, AlertCircle, CheckCircle2, Filter, X } from 'lucide-react';

interface FloorDetailViewProps {
  floor: number;
  theme: HotelTheme;
  apartments: Record<string, Apartment>;
  onBack: () => void;
  onSelectApartment: (id: string) => void;
}

const FloorDetailView: React.FC<FloorDetailViewProps> = ({ floor, theme, apartments, onBack, onSelectApartment }) => {
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  const baseApartmentNumbers = Array.from({ length: 35 }, (_, i) => floor + i)
    .filter(num => num !== 234 && num !== 417);

  const filterCategories = [
    { label: 'Banheiro', key: 'banheiroType', options: ['Velho', 'Reformado'] },
    { label: 'Piso', key: 'pisoType', options: ['Granito', 'Madeira', 'Tijolo'] },
    { label: 'Ar Cond.', key: 'acBrand', options: ['Midea', 'LG', 'Gree'] },
    { label: 'Avarias', key: 'hasDefects', options: ['Com Avaria', 'Sem Avaria'] }
  ];

  const filteredApartmentNumbers = useMemo(() => {
    return baseApartmentNumbers.filter(num => {
      const id = `${floor}-${num}`;
      const apt = apartments[id];
      
      return Object.entries(activeFilters).every(([key, value]) => {
        if (!value) return true;
        
        if (key === 'hasDefects') {
          const has = (apt?.defects?.length || 0) > 0;
          return value === 'Com Avaria' ? has : !has;
        }
        
        if (key === 'temCofre' || key === 'temCortina') {
          const boolValue = value === 'Sim';
          return apt ? apt[key as keyof Apartment] === boolValue : !boolValue;
        }

        return apt && apt[key as keyof Apartment] === value;
      });
    });
  }, [baseApartmentNumbers, apartments, floor, activeFilters]);

  const toggleFilter = (key: string, value: string) => {
    setActiveFilters(prev => {
      const next = { ...prev };
      if (next[key] === value) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-row items-center justify-between gap-2 mb-4">
        <div className="flex items-center space-x-2">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-600 bg-white shadow-sm md:shadow-none"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg md:text-2xl font-black text-slate-800">Andar {floor}</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase">{filteredApartmentNumbers.length} Unidades</p>
          </div>
        </div>

        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold transition-all border-2 text-xs shadow-sm ${
            showFilters ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-600'
          }`}
        >
          <Filter size={14} />
          <span>Filtros {Object.keys(activeFilters).length > 0 && `(${Object.keys(activeFilters).length})`}</span>
        </button>
      </div>

      {showFilters && (
        <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-50 shadow-xl space-y-4 animate-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filterCategories.map(cat => (
              <div key={cat.key} className="space-y-1.5">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{cat.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {cat.options.map(opt => (
                    <button
                      key={opt}
                      onClick={() => toggleFilter(cat.key, opt)}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all border-2 ${
                        activeFilters[cat.key] === opt 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                        : 'bg-slate-50 border-slate-100 text-slate-500'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {Object.keys(activeFilters).length > 0 && (
            <div className="pt-3 border-t border-slate-50 flex justify-end">
              <button 
                onClick={() => setActiveFilters({})}
                className="text-[10px] font-black text-red-500 flex items-center space-x-1 hover:underline"
              >
                <X size={12} />
                <span>LIMPAR TUDO</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Apartment Grid - 3 columns on mobile, 7 on desktop */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3 md:gap-4">
        {filteredApartmentNumbers.map((num) => {
          const id = `${floor}-${num}`;
          const aptData = apartments[id];
          const hasDefects = aptData && aptData.defects.length > 0;

          return (
            <button
              key={num}
              onClick={() => onSelectApartment(id)}
              className={`relative h-28 md:h-32 rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-200 active:scale-95 shadow-sm ${
                hasDefects 
                ? 'bg-red-50 border-red-500 text-red-800' 
                : 'bg-green-50 border-green-500 text-green-800'
              }`}
            >
              <span className="text-[8px] font-black opacity-60 uppercase tracking-tighter mb-0.5">Apto</span>
              <span className="text-xl md:text-2xl font-black">{num}</span>
              
              <div className="mt-1">
                {hasDefects ? (
                  <AlertCircle size={14} className="text-red-500" />
                ) : (
                  <CheckCircle2 size={14} className="text-green-500" />
                )}
              </div>

              {hasDefects && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                  {aptData.defects.length}
                </span>
              )}
            </button>
          );
        })}
        {filteredApartmentNumbers.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-300 italic font-bold text-sm">
            Nenhum resultado.
          </div>
        )}
      </div>
    </div>
  );
};

export default FloorDetailView;
