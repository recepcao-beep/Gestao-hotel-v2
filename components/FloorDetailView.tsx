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

function resolveRoomNumber(apt: Apartment, fallbackId?: string): number | null {
  const direct = Number((apt as any).roomNumber ?? (apt as any).numero ?? (apt as any).quarto);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const raw = String((apt as any).id ?? fallbackId ?? '');
  const matches = raw.match(/\d+/g);
  if (!matches || matches.length === 0) return null;

  const lastNumber = Number(matches[matches.length - 1]);
  return Number.isFinite(lastNumber) && lastNumber > 0 ? lastNumber : null;
}

function resolveFloor(apt: Apartment, fallbackId?: string): number | null {
  const direct = Number((apt as any).floor ?? (apt as any).andar ?? (apt as any).chao ?? (apt as any)['chão']);
  if (Number.isFinite(direct) && direct >= 100) return direct;

  const roomNumber = resolveRoomNumber(apt, fallbackId);
  if (roomNumber && roomNumber >= 100) return Math.floor(roomNumber / 100) * 100;

  return null;
}

const FloorDetailView: React.FC<FloorDetailViewProps> = ({ floor, theme, apartments, onBack, onSelectApartment }) => {
  const filteredApartmentNumbers = useMemo(() => {
    const nums = new Set<number>();

    Object.entries(apartments || {}).forEach(([id, apt]) => {
      const aptFloor = resolveFloor(apt, id);
      const roomNumber = resolveRoomNumber(apt, id);
      if (aptFloor === floor && roomNumber) nums.add(roomNumber);
    });

    if (nums.size === 0) {
      Array.from({ length: 35 }, (_, i) => floor + i)
        .filter((num) => num !== 234 && num !== 417)
        .forEach((num) => nums.add(num));
    }

    return Array.from(nums).sort((a, b) => a - b);
  }, [apartments, floor]);

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

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3 md:gap-4 pb-20">
        {filteredApartmentNumbers.map((num) => {
          const finalId = String(num);
          const aptData = apartments[finalId]
            || apartments[`${floor}-${num}`]
            || (Object.values(apartments || {}) as Apartment[]).find((a) => resolveRoomNumber(a) === num && resolveFloor(a) === floor);

          const isInitialized = !!aptData;
          const hasDefects = isInitialized && ((aptData.defects || []).length > 0);
          const isUrgent = isInitialized && (
            aptData.pisoStatus === 'Reparo urgente'
            || aptData.pisoStatus === 'Avaria identificada'
            || aptData.banheiroStatus === 'Reparo urgente'
            || aptData.banheiroStatus === 'Avaria identificada'
          );

          const isFilled = isInitialized && (
            aptData.pisoStatus
            || aptData.banheiroStatus
            || ((aptData.defects || []).length > 0)
          );

          const needsAttention = !isFilled || hasDefects || isUrgent;

          return (
            <button
              key={num}
              onClick={() => onSelectApartment(finalId)}
              className={`relative h-28 md:h-32 rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-200 active:scale-95 shadow-sm ${
                needsAttention
                  ? 'bg-red-50 border-red-400 text-red-800'
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

              {hasDefects && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-sm z-10">
                  {aptData.defects.length}
                </span>
              )}

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
