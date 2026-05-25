import React, { useMemo, useState } from 'react';
import { Hotel, FileBarChart, LayoutGrid } from 'lucide-react';
import { HotelTheme, Apartment } from '../types';
import ReportsView from './ReportsView';

interface ApartmentsViewProps {
  onSelectFloor: (floor: number) => void;
  theme: HotelTheme;
  hotelName: string;
  apartments: Record<string, Apartment>;
  onSelectApartment: (id: string) => void;
}

const DEFAULT_FLOORS = [200, 300, 400, 500, 600, 700];

function resolveFloor(apt: Apartment): number | null {
  const explicitFloor = Number((apt as any).floor ?? (apt as any).andar ?? (apt as any).chao ?? (apt as any)['chão']);
  if (Number.isFinite(explicitFloor) && explicitFloor >= 100) return explicitFloor;

  const roomNumber = Number((apt as any).roomNumber ?? (apt as any).id);
  if (Number.isFinite(roomNumber) && roomNumber >= 100) {
    return Math.floor(roomNumber / 100) * 100;
  }

  return null;
}

const ApartmentsView: React.FC<ApartmentsViewProps> = ({
  onSelectFloor,
  theme,
  hotelName,
  apartments,
  onSelectApartment,
}) => {
  const [activeTab, setActiveTab] = useState<'FLOORS' | 'REPORTS'>('FLOORS');

  const floorCards = useMemo(() => {
    const map = new Map<number, number>();

    DEFAULT_FLOORS.forEach((floor) => map.set(floor, 0));

    Object.values(apartments || {}).forEach((apt) => {
      const floor = resolveFloor(apt);
      if (!floor) return;
      map.set(floor, (map.get(floor) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([floor, count]) => ({ floor, count }))
      .sort((a, b) => a.floor - b.floor);
  }, [apartments]);

  const totalApartments = Object.keys(apartments || {}).length;

  return (
    <div className="space-y-6">
      {totalApartments === 0 && (
        <div className="p-8 bg-amber-50 border-2 border-dashed border-amber-200 rounded-3xl text-center space-y-3">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-2">
            <Hotel size={24} />
          </div>
          <p className="text-amber-900 font-bold text-lg">Nenhum dado encontrado</p>
          <p className="text-amber-700 max-w-md mx-auto">
            Não encontramos apartamentos para o hotel <span className="font-bold underline">{hotelName}</span>.
            Isso pode indicar que os dados ainda estão nos Sheets ou a migração falhou.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 transition-colors shadow-lg shadow-amber-200"
          >
            Tentar Recarregar
          </button>
        </div>
      )}

      <div className="flex items-center space-x-2 bg-white/50 p-1 rounded-3xl border border-slate-200 w-fit">
        <button
          onClick={() => setActiveTab('FLOORS')}
          className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center space-x-2 ${
            activeTab === 'FLOORS'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-400 hover:text-slate-600'
          }`}
          style={{ color: activeTab === 'FLOORS' ? theme.primary : undefined }}
        >
          <LayoutGrid size={14} />
          <span>Andares</span>
        </button>

        <button
          onClick={() => setActiveTab('REPORTS')}
          className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center space-x-2 ${
            activeTab === 'REPORTS'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-400 hover:text-slate-600'
          }`}
          style={{ color: activeTab === 'REPORTS' ? theme.primary : undefined }}
        >
          <FileBarChart size={14} />
          <span>Relatório Geral</span>
        </button>
      </div>

      {activeTab === 'FLOORS' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 pb-12">
          {floorCards.map(({ floor, count }) => (
            <button
              key={floor}
              onClick={() => onSelectFloor(floor)}
              className="group relative bg-white h-48 md:h-72 rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col items-center justify-center border border-slate-50 overflow-hidden transform active:scale-95 md:hover:-translate-y-2"
            >
              <div
                className="absolute top-0 left-0 w-full h-1.5 transition-all duration-500"
                style={{ backgroundColor: theme.primary }}
              />

              <div
                className="p-5 md:p-8 rounded-2xl md:rounded-3xl mb-3 md:mb-6 group-hover:scale-110 transition-transform duration-500"
                style={{ backgroundColor: theme.primary + '10', color: theme.primary }}
              >
                <Hotel size={32} strokeWidth={1.5} className="md:w-14 md:h-14" />
              </div>

              <div className="text-center">
                <h3 className="text-xl md:text-3xl font-black text-slate-800">Andar {floor}</h3>
                <p className="text-slate-400 mt-1 font-black uppercase tracking-[0.2em] text-[8px] md:text-[10px]">
                  {hotelName}
                </p>
                <p className="text-slate-400 mt-2 font-black uppercase tracking-[0.2em] text-[8px] md:text-[10px]">
                  {count} apartamentos carregados
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <ReportsView
            apartments={apartments}
            theme={theme}
            onSelectApartment={onSelectApartment}
          />
        </div>
      )}
    </div>
  );
};

export default ApartmentsView;
