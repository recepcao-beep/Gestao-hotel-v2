
import React, { useMemo } from 'react';
import { Apartment, HotelTheme } from '../types';
import { 
  ChevronLeft, 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle,
} from 'lucide-react';

interface FloorDetailViewProps {
  floor: number;
  theme: HotelTheme;
  apartments: Record<string, Apartment>;
  onBack: () => void;
  onSelectApartment: (id: string) => void;
}

const FloorDetailView: React.FC<FloorDetailViewProps> = ({ floor, theme, apartments, onBack, onSelectApartment }) => {
  const baseApartmentNumbers = Array.from({ length: 35 }, (_, i) => floor + i)
    .filter(num => num !== 234 && num !== 417);

  const filteredApartmentNumbers = useMemo(() => {
    return baseApartmentNumbers;
  }, [baseApartmentNumbers]);

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
      </div>

      {/* Apartment Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3 md:gap-4 pb-20">
        {filteredApartmentNumbers.map((num) => {
          const id = `${floor}-${num}`;
          const aptData = apartments[id];
          const isInitialized = !!aptData;
          
          // Lógica de Alerta Visual
          const hasDefects = isInitialized && aptData.defects.length > 0;
          const isUrgent = isInitialized && (
            aptData.pisoStatus === 'Reparo urgente' || 
            aptData.banheiroStatus === 'Reparo urgente'
          );
          
          // Prioridade: Com Avaria/Urgente (Vermelho) > Normal (Verde) > Não Iniciado (Cinza)
          const needsAttention = hasDefects || isUrgent;

          return (
            <button
              key={num}
              onClick={() => onSelectApartment(id)}
              className={`relative h-28 md:h-32 rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-200 active:scale-95 shadow-sm ${
                !isInitialized
                ? 'bg-slate-50 border-slate-200 text-slate-400'
                : needsAttention 
                ? 'bg-red-50 border-red-500 text-red-800' 
                : 'bg-green-50 border-green-500 text-green-800'
              }`}
            >
              <span className="text-[8px] font-black opacity-60 uppercase tracking-tighter mb-0.5">Apto</span>
              <span className="text-xl md:text-2xl font-black">{num}</span>
              
              <div className="mt-1">
                {!isInitialized ? (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-200 opacity-50" />
                ) : needsAttention ? (
                  isUrgent ? <AlertTriangle size={14} className="text-red-600 animate-pulse" /> : <AlertCircle size={14} className="text-red-500" />
                ) : (
                  <CheckCircle2 size={14} className="text-green-500" />
                )}
              </div>

              {!isInitialized && (
                <span className="absolute bottom-2 text-[6px] font-black uppercase opacity-40">Pendente</span>
              )}

              {/* Badges de Contagem */}
              {hasDefects && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-sm z-10">
                  {aptData.defects.length}
                </span>
              )}
              
              {/* Badge de Urgente se não tiver defeitos mas tiver urgência */}
              {!hasDefects && isUrgent && (
                 <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-sm z-10">
                   !
                 </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FloorDetailView;
