import React, { useMemo, useState } from 'react';
import { AlertTriangle, CircleHelp, FileBarChart, Hotel, LayoutGrid, Snowflake, Trees } from 'lucide-react';
import { HotelTheme, Apartment } from '../types';
import ReportsView from './ReportsView';
import { apartmentNeedsAttention, resolveApartmentFloor, resolveApartmentFloorType } from '../utils/apartmentPresentation';

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
    const map = new Map<number, { total: number; cold: number; wood: number; uninformed: number; attention: number }>();

    DEFAULT_FLOORS.forEach((floor) => map.set(floor, { total: 0, cold: 0, wood: 0, uninformed: 0, attention: 0 }));

    Object.values(apartments || {} as Record<string, Apartment>).forEach((apt: Apartment) => {
      const floor = resolveApartmentFloor(apt);
      if (!floor) return;
      const stats = map.get(floor) || { total: 0, cold: 0, wood: 0, uninformed: 0, attention: 0 };
      const floorType = resolveApartmentFloorType(apt);
      stats.total += 1;
      if (floorType === 'COLD') stats.cold += 1;
      else if (floorType === 'WOOD') stats.wood += 1;
      else stats.uninformed += 1;
      if (apartmentNeedsAttention(apt)) stats.attention += 1;
      map.set(floor, stats);
    });

    return Array.from(map.entries())
      .map(([floor, stats]) => ({ floor, ...stats }))
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
          {floorCards.map(({ floor, total, cold, wood, uninformed, attention }) => (
            <button
              key={floor}
              onClick={() => onSelectFloor(floor)}
              className="group relative min-h-56 rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:border-slate-300 hover:shadow-md active:scale-[0.99]"
            >
              <div
                className="absolute top-0 left-0 w-full h-1.5 transition-all duration-500"
                style={{ backgroundColor: theme.primary }}
              />

              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase text-slate-400">{hotelName}</div>
                  <h3 className="mt-1 text-2xl font-black text-slate-800">Andar {floor}</h3>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ backgroundColor: theme.primary + '12', color: theme.primary }}>
                  <Hotel size={22} />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-lg font-black text-slate-800">{total}</div><div className="text-[9px] font-black uppercase text-slate-400">Apartamentos</div></div>
                <div className="rounded-lg bg-rose-50 px-3 py-2"><div className="text-lg font-black text-rose-700">{attention}</div><div className="text-[9px] font-black uppercase text-rose-500">Com atencao</div></div>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-[10px] font-black text-slate-500">
                <span className="inline-flex items-center gap-1.5"><Snowflake size={13} className="text-sky-600" /> {cold} piso frio</span>
                <span className="inline-flex items-center gap-1.5"><Trees size={13} className="text-emerald-700" /> {wood} madeira</span>
                <span className="inline-flex items-center gap-1.5"><CircleHelp size={13} /> {uninformed} nao informados</span>
                {attention > 0 && <span className="inline-flex items-center gap-1.5 text-rose-600"><AlertTriangle size={13} /> vistoria</span>}
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
