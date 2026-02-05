
import React from 'react';
import { ViewType, UserRole, HotelTheme } from '../types';
import { 
  LayoutDashboard, 
  Hotel, 
  ReceiptPoundSterling, 
  Users,
  Package,
  FileBarChart
} from 'lucide-react';

interface BottomNavProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  theme: HotelTheme;
  role: UserRole;
  sectorId?: string;
  sectorName?: string;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentView, onViewChange, theme, role, sectorId, sectorName }) => {
  const normalizedSector = (sectorName || '').toLowerCase();
  const isAuthSector = normalizedSector.includes('governança') || normalizedSector.includes('rouparia');
  const canSeeReports = role === 'GERENCIA' || role === 'DIRETORIA' || (role === 'FUNCIONARIO' && isAuthSector);

  const menuItems = [
    { id: ViewType.DASHBOARD, label: 'Início', icon: LayoutDashboard, visible: role === 'GERENCIA' || role === 'DIRETORIA' },
    { id: ViewType.APARTMENTS, label: 'Aptos', icon: Hotel, visible: true },
    { id: ViewType.REPORTS, label: 'Rels', icon: FileBarChart, visible: canSeeReports },
    { id: ViewType.BUDGETS, label: 'Orcas', icon: ReceiptPoundSterling, visible: role === 'GERENCIA' || role === 'DIRETORIA' },
    { id: ViewType.INVENTORY, label: 'Stock', icon: Package, visible: true },
    { id: ViewType.EMPLOYEES, label: 'Equipe', icon: Users, visible: role === 'GERENCIA' || role === 'DIRETORIA' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-[100] md:hidden px-2 pb-safe">
      <div className="flex justify-around items-center h-16">
        {menuItems.filter(i => i.visible).map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className="flex flex-col items-center justify-center w-full h-full relative group transition-all"
            >
              <div 
                className={`p-2 rounded-xl transition-all ${isActive ? 'bg-slate-50' : 'text-slate-400'}`}
                style={{ color: isActive ? theme.primary : undefined }}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span 
                className={`text-[9px] font-black uppercase tracking-tighter mt-0.5 ${isActive ? 'opacity-100' : 'opacity-40'}`}
                style={{ color: isActive ? theme.primary : undefined }}
              >
                {item.label}
              </span>
              {isActive && (
                <div 
                  className="absolute top-0 w-8 h-1 rounded-b-full" 
                  style={{ backgroundColor: theme.primary }} 
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
