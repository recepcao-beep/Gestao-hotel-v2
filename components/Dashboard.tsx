
import React from 'react';
import { Apartment, Employee, HotelTheme } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { AlertCircle, ClipboardList, Users, Database, Link, DollarSign, RefreshCw, Clock } from 'lucide-react';

interface DashboardProps {
  apartments: Record<string, Apartment>;
  employees: Employee[];
  theme: HotelTheme;
  lastSync?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ apartments, employees, theme, lastSync, onRefresh, isRefreshing }) => {
  const aptList: Apartment[] = Object.values(apartments);
  const totalDefects = aptList.reduce((acc, curr) => acc + (curr.defects?.length || 0), 0);
  const apartmentsWithIssues = aptList.filter(a => (a.defects?.length || 0) > 0).length;

  const floorData = [200, 300, 400, 500, 600, 700].map(floor => ({
    name: `${floor}`,
    defects: aptList.filter(a => a.floor === floor).reduce((acc, curr) => acc + (curr.defects?.length || 0), 0)
  }));

  const pieData = [
    { name: 'Com Avarias', value: apartmentsWithIssues, color: '#ef4444' },
    { name: 'Sem Avarias', value: Math.max(0, 210 - apartmentsWithIssues), color: theme.secondary }
  ];

  const totalSalary = employees.reduce((acc, curr) => acc + (Number(curr.salary) || 0), 0);

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-700 pb-10">
      
      {/* Barra de Status de Sincronização */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white/50 backdrop-blur-sm p-3 rounded-2xl border border-slate-100 gap-3">
        <div className="flex items-center space-x-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
           <Database size={14} className="text-emerald-500" />
           <span>Planilha Conectada</span>
           {lastSync && (
             <div className="flex items-center space-x-1 border-l pl-3 ml-1 border-slate-200">
               <Clock size={12} />
               <span>Refletido em: {new Date(lastSync).toLocaleTimeString()}</span>
             </div>
           )}
        </div>
        <button 
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center space-x-2 bg-white px-4 py-1.5 rounded-xl border-2 border-slate-100 shadow-sm text-[9px] font-black uppercase tracking-widest hover:border-blue-200 hover:text-blue-500 transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
          <span>{isRefreshing ? 'Refletindo...' : 'Refletir Planilha'}</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
        <div className="bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4">
          <div className="p-3 md:p-4 bg-red-50 text-red-500 rounded-2xl w-fit">
            <AlertCircle size={22} className="md:w-[28px] md:h-[28px]" />
          </div>
          <div>
            <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-widest">Avarias</p>
            <h3 className="text-xl md:text-3xl font-black text-slate-800">{totalDefects}</h3>
          </div>
        </div>
        
        <div className="bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4">
          <div className="p-3 md:p-4 rounded-2xl w-fit" style={{ backgroundColor: theme.primary + '10', color: theme.primary }}>
            <ClipboardList size={22} className="md:w-[28px] md:h-[28px]" />
          </div>
          <div>
            <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-widest">Unidades</p>
            <h3 className="text-xl md:text-3xl font-black text-slate-800">{apartmentsWithIssues}</h3>
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4">
          <div className="p-3 md:p-4 rounded-2xl w-fit" style={{ backgroundColor: theme.secondary + '10', color: theme.secondary }}>
            <Users size={22} className="md:w-[28px] md:h-[28px]" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Equipe</p>
            <h4 className="text-2xl font-black text-slate-800">{employees.length}</h4>
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4">
          <div className="p-3 md:p-4 rounded-2xl w-fit" style={{ backgroundColor: theme.accent + '10', color: theme.accent }}>
            <DollarSign size={22} className="md:w-[28px] md:h-[28px]" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Folha</p>
            <h4 className="text-xl font-black text-slate-800">
              R$ {Math.round(totalSalary / 1000)}k
            </h4>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-50">
          <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center">
            Defeitos por Andar
          </h3>
          <div className="h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={floorData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                />
                <Bar dataKey="defects" fill={theme.primary} radius={[8, 8, 0, 0]} barSize={35} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-50">
          <h3 className="text-lg font-black text-slate-800 mb-6">Status da Operação</h3>
          <div className="h-48 md:h-64 flex flex-col md:flex-row items-center justify-center">
            <div className="w-full h-full md:w-2/3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-row md:flex-col justify-center space-x-4 md:space-x-0 md:space-y-4 md:w-1/3">
              {pieData.map((item, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-[10px] text-slate-600 font-black uppercase tracking-wider">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
