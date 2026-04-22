
import React, { useState, useMemo } from 'react';
import { Employee, HotelTheme } from '../types';
import { 
  Search, 
  CalendarDays, 
  User as UserIcon, 
  Clock, 
  Filter, 
  ChevronRight,
  Briefcase
} from 'lucide-react';

interface TodayScheduleViewProps {
  employees: Employee[];
  theme: HotelTheme;
}

const TodayScheduleView: React.FC<TodayScheduleViewProps> = ({ employees, theme }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const todayInfo = useMemo(() => {
    const now = new Date();
    const weekday = now.toLocaleDateString('pt-BR', { weekday: 'long' });
    const day = now.getDate();
    
    // Calcular qual domingo do mês é hoje (se for domingo)
    let sundayIdx = 0;
    if (now.getDay() === 0) {
      let count = 0;
      for(let i = 1; i <= day; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), i);
        if(d.getDay() === 0) count++;
      }
      sundayIdx = count;
    }

    return { 
      weekday, 
      day, 
      isSunday: now.getDay() === 0, 
      sundayIdx,
      fullDate: now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    };
  }, []);

  const scheduledToday = useMemo(() => {
    return employees.filter(emp => {
      if (!emp.name.toLowerCase().includes(searchTerm.toLowerCase()) && !emp.role.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      
      const isFixedOff = emp.fixedDayOff?.toLowerCase() === todayInfo.weekday.toLowerCase();
      const isSundayOff = todayInfo.isSunday && (emp.sundayOffs || []).includes(todayInfo.sundayIdx);
      
      return !isFixedOff && !isSundayOff && emp.status === 'Ativo';
    });
  }, [employees, todayInfo, searchTerm]);

  // Agrupar por função
  const groupedByRole = useMemo(() => {
    const groups: Record<string, Employee[]> = {};
    scheduledToday.forEach(emp => {
      const role = emp.role || 'Geral';
      if (!groups[role]) groups[role] = [];
      groups[role].push(emp);
    });
    return groups;
  }, [scheduledToday]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-blue-50 text-blue-500 rounded-2xl shadow-sm"><CalendarDays size={28}/></div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Escalados Hoje</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{todayInfo.weekday} • {todayInfo.fullDate}</p>
          </div>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou função..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-slate-50 focus:border-blue-400 outline-none text-sm font-bold bg-slate-50 transition-all"
          />
        </div>
      </div>

      <div className="space-y-8">
        {Object.entries(groupedByRole).length === 0 ? (
          <div className="py-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed">
            <UserIcon size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 font-bold italic">Nenhum colaborador encontrado para hoje.</p>
          </div>
        ) : (
          /* Fix: added explicit type casting to [string, Employee[]][] to avoid 'unknown' type inference on 'list' */
          (Object.entries(groupedByRole) as [string, Employee[]][]).sort(([a], [b]) => a.localeCompare(b)).map(([role, list]) => (
            <section key={role} className="space-y-4">
              <div className="flex items-center space-x-2 px-2">
                <Briefcase size={16} className="text-slate-400" />
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">{role} ({list.length})</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {list.map(emp => (
                  <div key={emp.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:border-blue-200 transition-all">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg text-white shadow-md ${emp.gender === 'F' ? 'bg-rose-400' : 'bg-blue-400'}`}>
                        {(emp.name || 'S')[0]}
                      </div>
                      <div>
                        <p className="font-black text-slate-800 leading-none mb-1">{emp.name}</p>
                        <div className="flex items-center text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                          <Clock size={10} className="mr-1" /> {emp.workingHours}
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl text-slate-300 group-hover:text-blue-500 transition-colors">
                      <ChevronRight size={18} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
};

export default TodayScheduleView;
