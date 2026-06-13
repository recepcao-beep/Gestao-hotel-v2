
import React, { useState } from 'react';
import { ViewType, HotelType, HotelTheme, UserRole, User } from '../types';
import { 
  LayoutDashboard, 
  Hotel, 
  ReceiptPoundSterling, 
  Settings,
  Users,
  ChevronDown,
  ChevronRight,
  MapPin,
  LogOut,
  Package,
  FileBarChart,
  Car,
  BedDouble,
  Bot
} from 'lucide-react';
import Logo from './Logo';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  currentHotel: HotelType;
  onHotelChange: (hotel: HotelType) => void;
  onLogout: () => void;
  theme: HotelTheme;
  user: User;
  lastDataSource?: 'SUPABASE' | 'SHEETS' | 'CACHE';
  visibleTabs?: Record<string, boolean>;
}

const HotelLogo = ({ type }: { type: HotelType }) => {
  const logoStyles = "w-full h-auto max-h-24 object-contain";
  
  if (type === 'VILLAGE') {
    return (
      <img 
        src="https://static.pmweb.com.br/UDt4IZ8aLjmYHzWMKyDhqYu4WCo=/https://letsimage.s3.sa-east-1.amazonaws.com/editor/nacionalinn/pt/hoteis/hotel-village-inn-pocos-de-caldas/1687195313334-logo-vilage-inn-all-inclusive-pocos-de-caldas-%281%29.png" 
        alt="Hotel Village Inn" 
        className={logoStyles}
      />
    );
  }
  if (type === 'GOLDEN_PARK') {
    return (
      <img 
        src="https://static.pmweb.com.br/I5TMfCWS1GgWNcDKMjm4pzsFBbo=/https://letsimage.s3.sa-east-1.amazonaws.com/editor/nacionalinn/pt/hoteis/hotel-golden-park-pocos-de-caldas/1687196969718-logo-golden-park-all-inclusive-pocos-de-caldas.png" 
        alt="Hotel Golden Park" 
        className={logoStyles}
      />
    );
  }
  return (
    <img 
      src="https://static.pmweb.com.br/WYDXC2CrV6p3J-8GhYITK6Y2YJY=/https://letsimage.s3.sa-east-1.amazonaws.com/editor/nacionalinn/pt/hoteis/hotel-thermas-resort-walter-world/1686788413004-logo-thermas-.png" 
      alt="Thermas Resort" 
      className={logoStyles}
    />
  );
};

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, currentHotel, onHotelChange, onLogout, theme, user, lastDataSource, visibleTabs }) => {
  const [isHotelOpen, setIsHotelOpen] = useState(true);
  const role = user.role;

  const isTabVisible = (viewId: string) => {
    // Gestores follow the global config, or if not gestor, check allowedTabs AND global config
    const globalVisibility = visibleTabs?.[viewId] !== false;
    if (role === 'GESTOR') return globalVisibility;
    return user.allowedTabs?.includes(viewId as ViewType) && globalVisibility;
  };

  const menuItems = [
    { id: ViewType.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard, visible: isTabVisible(ViewType.DASHBOARD) },
    { id: ViewType.APARTMENTS, label: 'Apartamentos', icon: Hotel, visible: isTabVisible(ViewType.APARTMENTS) },
    { id: ViewType.TODAY_SCHEDULE, label: 'Pauta do Dia', icon: FileBarChart, visible: isTabVisible(ViewType.TODAY_SCHEDULE) },
    { id: ViewType.PARKING, label: 'Estacionamento', icon: Car, visible: isTabVisible(ViewType.PARKING) },
    { id: ViewType.BUDGETS, label: 'Orçamentos', icon: ReceiptPoundSterling, visible: isTabVisible(ViewType.BUDGETS) },
    { id: ViewType.INVENTORY, label: 'Estoque', icon: Package, visible: isTabVisible(ViewType.INVENTORY) },
    { id: ViewType.LINEN, label: 'Enxoval', icon: BedDouble, visible: isTabVisible(ViewType.LINEN) },
    { id: ViewType.ROBOTS, label: 'Robos', icon: Bot, visible: isTabVisible(ViewType.ROBOTS) },
    { id: ViewType.EMPLOYEES, label: 'Funcionários', icon: Users, visible: isTabVisible(ViewType.EMPLOYEES) },
  ];

  const hotels: { id: HotelType; label: string }[] = [
    { id: 'VILLAGE', label: 'Village Inn' },
    { id: 'GOLDEN_PARK', label: 'Hotel Golden Park' },
    { id: 'THERMAL_RESORT', label: 'Thermas Resort' },
  ];

  return (
    <aside className="hidden md:flex w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 shadow-xl z-50 flex-col">
      <div className="p-4 flex-1 overflow-y-auto sidebar-scrollbar">
        <div className="mb-8 mt-2 px-2">
          <div className="bg-white rounded-2xl p-4 shadow-xl flex items-center justify-center overflow-hidden">
            <HotelLogo type={currentHotel} />
          </div>
        </div>

        {role === 'GESTOR' && (
          <div className="mb-6">
            <button 
              onClick={() => setIsHotelOpen(!isHotelOpen)}
              className="w-full flex items-center justify-between px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              <div className="flex items-center space-x-3">
                <MapPin size={16} />
                <span className="font-bold uppercase text-[10px] tracking-widest">Unidade</span>
              </div>
              {isHotelOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            
            {isHotelOpen && (
              <div className="mt-2 ml-2 space-y-1 animate-in slide-in-from-top-2 duration-200">
                {hotels.map((hotel) => (
                  <button
                    key={hotel.id}
                    onClick={() => onHotelChange(hotel.id)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-xs transition-all flex items-center justify-between ${
                      currentHotel === hotel.id 
                      ? 'bg-white/10 text-white font-bold ring-1 ring-white/20' 
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-1.5 h-1.5 rounded-full" 
                        style={{ backgroundColor: currentHotel === hotel.id ? theme.primary : 'transparent' }} 
                      />
                      <span>{hotel.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="h-px bg-slate-800/50 mb-6 mx-2"></div>

        <nav className="space-y-1.5">
          {menuItems.filter(i => i.visible).map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`w-full flex items-center space-x-3.5 px-5 py-3 rounded-2xl transition-all duration-300 group ${
                  isActive 
                  ? 'text-white shadow-lg' 
                  : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
                }`}
                style={{ 
                  backgroundColor: isActive ? theme.primary : 'transparent',
                  boxShadow: isActive ? `0 10px 15px -3px ${theme.primary}40` : 'none'
                }}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
                <span className="font-bold text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-6 border-t border-slate-800/50 bg-slate-900/50 flex flex-col space-y-2">
        {role === 'GESTOR' && (
          <button 
            onClick={() => onViewChange(ViewType.SETTINGS)}
            className={`w-full flex items-center space-x-3 transition-colors px-2 py-3 rounded-xl ${
              currentView === ViewType.SETTINGS ? 'text-white bg-white/10' : 'text-slate-500 hover:text-white'
            }`}
          >
            <Settings size={18} />
            <span className="text-sm font-medium">Configurações</span>
          </button>
        )}
        <button 
          onClick={onLogout}
          className="w-full flex items-center space-x-3 text-red-400/70 hover:text-red-400 transition-colors px-2 pt-4 border-t border-slate-800/30"
        >
          <LogOut size={18} />
          <span className="text-sm font-bold">Encerrar Sessão</span>
        </button>

        <div className="pt-6 flex flex-col items-center gap-3">
          {lastDataSource && (
            <div className={`px-2 py-1 rounded-lg border text-[8px] font-black tracking-widest flex items-center gap-2 ${
               lastDataSource === 'SUPABASE' ? 'border-emerald-500/30 text-emerald-500' : 'border-sky-500/30 text-sky-500'
            }`}>
               <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${lastDataSource === 'SUPABASE' ? 'bg-emerald-500' : 'bg-sky-500'}`}></div>
               MODO: {lastDataSource === 'SUPABASE' ? 'SUPABASE CLOUD' : 'PLANILHA'}
            </div>
          )}
          <div className="opacity-40 hover:opacity-100 transition-opacity">
            <Logo className="h-6" themeColor={theme.primary} showText={true} />
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
