import React, { useMemo, useState } from 'react';
import { Apartment, HotelTheme } from '../types';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  FilterX,
  SlidersHorizontal,
} from 'lucide-react';
import {
  apartmentNeedsAttention,
  ApartmentFloorType,
  getApartmentFloorTypeLabel,
  resolveApartmentFloor,
  resolveApartmentFloorType,
  resolveApartmentRoomNumber,
} from '../utils/apartmentPresentation';

interface FloorDetailViewProps {
  floor: number;
  theme: HotelTheme;
  apartments: Record<string, Apartment>;
  onBack: () => void;
  onSelectApartment: (id: string) => void;
}

type FloorFilter = 'ALL' | Extract<ApartmentFloorType, 'COLD' | 'WOOD'>;

const filterLabels: Record<FloorFilter, string> = {
  ALL: 'Todos',
  COLD: 'Piso frio',
  WOOD: 'Piso de madeira',
};

const REQUIRED_FLOOR_ROOMS: Record<number, number[]> = {
  500: [517],
  600: [601, 605, 606, 607, 620, 621, 622, 623],
  700: [704, 705, 706, 707, 708, 709, 711, 712, 731],
};

const FloorDetailView: React.FC<FloorDetailViewProps> = ({ floor, theme, apartments, onBack, onSelectApartment }) => {
  const [floorFilter, setFloorFilter] = useState<FloorFilter>('ALL');
  const [showFilters, setShowFilters] = useState(false);

  const floorApartments = useMemo(() => {
    const roomMap = new Map<number, { id: string; apartment?: Apartment }>();
    Object.entries(apartments || {}).forEach(([id, apartment]: [string, Apartment]) => {
      const apartmentFloor = resolveApartmentFloor(apartment, id);
      const roomNumber = resolveApartmentRoomNumber(apartment, id);
      if (apartmentFloor === floor && roomNumber) roomMap.set(roomNumber, { id, apartment });
    });

    (REQUIRED_FLOOR_ROOMS[floor] || []).forEach((roomNumber) => {
      if (!roomMap.has(roomNumber)) roomMap.set(roomNumber, { id: String(roomNumber) });
    });

    if (roomMap.size === 0) {
      Array.from({ length: 35 }, (_, index) => floor + index)
        .filter((roomNumber) => roomNumber !== 234 && roomNumber !== 417)
        .forEach((roomNumber) => roomMap.set(roomNumber, { id: String(roomNumber) }));
    }

    return Array.from(roomMap.entries())
      .map(([roomNumber, item]) => ({ roomNumber, ...item }))
      .sort((a, b) => a.roomNumber - b.roomNumber);
  }, [apartments, floor]);

  const filteredApartments = useMemo(() => floorApartments.filter(({ apartment }) => {
    if (floorFilter === 'ALL') return true;
    return resolveApartmentFloorType(apartment) === floorFilter;
  }), [floorApartments, floorFilter]);

  return (
    <div className="space-y-4 pb-20 md:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            title="Voltar aos andares"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-black text-slate-800 md:text-2xl">Andar {floor}</h2>
            <p className="text-[10px] font-bold uppercase text-slate-400">{filteredApartments.length} apartamentos encontrados</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((current) => !current)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-700"
          aria-expanded={showFilters}
        >
          <SlidersHorizontal size={16} style={{ color: theme.primary }} />
          Filtrar piso
        </button>
      </div>

      {showFilters && (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(Object.keys(filterLabels) as FloorFilter[]).map((filter) => {
              const active = floorFilter === filter;
              return (
                <button
                  type="button"
                  key={filter}
                  onClick={() => setFloorFilter(filter)}
                  className={`min-h-11 rounded-lg px-3 text-xs font-black ${active ? 'text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                  style={active ? { backgroundColor: theme.primary } : undefined}
                >
                  {filterLabels[filter]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-200 bg-slate-50 px-4 py-3">
        <div className="text-xs font-bold text-slate-600">
          <span className="font-black text-slate-900">Andar {floor}</span> · {filterLabels[floorFilter]} · {filteredApartments.length} encontrados
        </div>
        {floorFilter !== 'ALL' && (
          <button type="button" onClick={() => setFloorFilter('ALL')} className="inline-flex min-h-10 items-center gap-2 text-xs font-black text-slate-600 hover:text-slate-900">
            <FilterX size={15} /> Limpar filtro
          </button>
        )}
      </div>

      {filteredApartments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
          <SlidersHorizontal size={22} className="mx-auto text-slate-400" />
          <div className="mt-2 text-sm font-black text-slate-700">Nenhum apartamento corresponde ao filtro</div>
          <button type="button" onClick={() => setFloorFilter('ALL')} className="mt-4 min-h-11 rounded-lg border border-slate-200 px-4 text-xs font-black text-slate-700">Mostrar todos</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 md:gap-4">
          {filteredApartments.map(({ id, roomNumber, apartment }) => {
            const isInitialized = !!apartment;
            const hasDefects = isInitialized && (apartment.defects || []).length > 0;
            const needsAttention = apartmentNeedsAttention(apartment);
            const floorType = resolveApartmentFloorType(apartment);

            return (
              <button
                type="button"
                key={roomNumber}
                onClick={() => onSelectApartment(apartment?.id || id || String(roomNumber))}
                className={`relative min-h-32 rounded-lg border-2 px-2 py-3 text-center shadow-sm transition-all active:scale-95 ${needsAttention ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-emerald-300 bg-emerald-50 text-emerald-800'}`}
              >
                <span className="text-[8px] font-black uppercase opacity-60">Apto</span>
                <span className="block text-xl font-black md:text-2xl">{roomNumber}</span>
                <span className="mt-1 block text-[8px] font-black uppercase opacity-70">{getApartmentFloorTypeLabel(floorType)}</span>
                <div className="mt-2 flex justify-center">
                  {!isInitialized ? <AlertCircle size={15} /> : needsAttention ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                </div>
                {hasDefects && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-rose-600 text-[9px] font-black text-white">
                    {apartment.defects.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FloorDetailView;
