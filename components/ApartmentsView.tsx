
import React from 'react';
import { Hotel } from 'lucide-react';
import { HotelTheme } from '../types';

interface ApartmentsViewProps {
  onSelectFloor: (floor: number) => void;
  theme: HotelTheme;
  hotelName: string;
}

const ApartmentsView: React.FC<ApartmentsViewProps> = ({ onSelectFloor, theme, hotelName }) => {
  const floors = [200, 300, 400, 500, 600, 700];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 pb-12">
      {floors.map((floor) => (
        <button
          key={floor}
          onClick={() => onSelectFloor(floor)}
          className="group relative bg-white h-48 md:h-72 rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col items-center justify-center border border-slate-50 overflow-hidden transform active:scale-95 md:hover:-translate-y-2"
        >
          <div className="absolute top-0 left-0 w-full h-1.5 transition-all duration-500" style={{ backgroundColor: theme.primary }}></div>
          
          <div 
            className="p-5 md:p-8 rounded-2xl md:rounded-3xl mb-3 md:mb-6 group-hover:scale-110 transition-transform duration-500"
            style={{ backgroundColor: theme.primary + '10', color: theme.primary }}
          >
            <Hotel size={32} strokeWidth={1.5} className="md:w-14 md:h-14" />
          </div>
          
          <div className="text-center">
            <h3 className="text-xl md:text-3xl font-black text-slate-800">Andar {floor}</h3>
            <p className="text-slate-400 mt-1 font-black uppercase tracking-[0.2em] text-[8px] md:text-[10px]">{hotelName}</p>
          </div>
        </button>
      ))}
    </div>
  );
};

export default ApartmentsView;
