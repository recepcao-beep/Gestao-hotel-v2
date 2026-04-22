
import React, { useMemo } from 'react';
import { Apartment, Employee, HotelTheme, InventoryItem, Sector } from '../types';
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
  Cell,
  Legend
} from 'recharts';
import { AlertCircle, ClipboardList, Users, Database, RefreshCw, Clock, Package, Briefcase, Box } from 'lucide-react';

interface DashboardProps {
  apartments: Record<string, Apartment>;
  employees: Employee[];
  inventory?: InventoryItem[];
  sectors?: Sector[];
  theme: HotelTheme;
  lastSync?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  apartments, 
  employees, 
  inventory = [], 
  sectors = [],
  theme, 
  lastSync, 
  onRefresh, 
  isRefreshing 
}) => {
  const aptList: Apartment[] = Object.values(apartments);
  const totalDefects = aptList.reduce((acc, curr) => acc + (curr.defects?.length || 0), 0);
  const apartmentsWithIssues = aptList.filter(a => (a.defects?.length || 0) > 0).length;
  
  // Inventory Stats
  const lowStockCount = inventory.filter(i => i.quantity <= i.minQuantity).length;
  const lowStockItems = inventory
    .filter(i => i.quantity <= i.minQuantity)
    .sort((a, b) => (a.quantity - a.minQuantity) - (b.quantity - b.minQuantity))
    .slice(0, 5)
    .map(i => ({
      name: i.name,
      current: i.quantity,
      target: i.minQuantity,
      diff: i.quantity - i.minQuantity
    }));

  const floorData = [200, 300, 400, 500, 600, 700].map(floor => ({
    name: `${floor}`,
    defects: aptList.filter(a => a.floor === floor).reduce((acc, curr) => acc + (curr.defects?.length || 0), 0)
  }));

  const pieData = [
    { name: 'Com Avarias', value: apartmentsWithIssues, color: '#ef4444' },
    { name: 'Sem Avarias', value: Math.max(0, 210 - apartmentsWithIssues), color: theme.secondary }
  ];

  // Employee by Sector Data
  const sectorData = useMemo(() => {
    const data: Record<string, number> = {};
    employees.forEach(emp => {
      const secName = sectors.find(s => s.id === emp.sectorId)?.name || 'Outros';
      data[secName] = (data[secName] || 0) + 1;
    });
    return Object.entries(data).map(([name, value], idx) => ({
      name,
      value,
      color: theme.chartColors[idx % theme.chartColors.length]
    }));
  }, [employees, sectors, theme]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-100">
          <p className="text-xs font-black text-slate-800 uppercase tracking-widest mb-1">{label}</p>
          <p className="text-sm font-bold" style={{ color: payload[0].fill || payload[0].color }}>
            {payload[0].value} {payload[0].payload.name === 'Com Avarias' ? 'Unidades' : ''}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-700 pb-10">
      
      {/* Barra de Status de Sincronização */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white/50 backdrop-blur-sm p-3 rounded-2xl border border-slate-100 gap-3">
        <div className="flex items-center space-x-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
           <Database size={14} className="text-emerald-500" />
           <span>Visão Geral Operacional</span>
           {lastSync && (
             <div className="flex items-center space-x-1 border-l pl-3 ml-1 border-slate-200">
               <Clock size={12} />
               <span>Atualizado: {new Date(lastSync).toLocaleTimeString()}</span>
             </div>
           )}
        </div>
        <button 
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center space-x-2 bg-white px-4 py-1.5 rounded-xl border-2 border-slate-100 shadow-sm text-[9px] font-black uppercase tracking-widest hover:border-blue-200 hover:text-blue-500 transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
          <span>{isRefreshing ? 'Sincronizando...' : 'Atualizar Dados'}</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
        <div className="bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4">
          <div className="p-3 md:p-4 bg-red-50 text-red-500 rounded-2xl w-fit">
            <AlertCircle size={22} className="md:w-[28px] md:h-[28px]" />
          </div>
          <div>
            <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-widest">Total Avarias</p>
            <h3 className="text-xl md:text-3xl font-black text-slate-800">{totalDefects}</h3>
          </div>
        </div>
        
        <div className="bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4">
          <div className="p-3 md:p-4 rounded-2xl w-fit" style={{ backgroundColor: theme.primary + '10', color: theme.primary }}>
            <ClipboardList size={22} className="md:w-[28px] md:h-[28px]" />
          </div>
          <div>
            <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-widest">Aptos Críticos</p>
            <h3 className="text-xl md:text-3xl font-black text-slate-800">{apartmentsWithIssues}</h3>
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4">
          <div className="p-3 md:p-4 rounded-2xl w-fit" style={{ backgroundColor: theme.secondary + '10', color: theme.secondary }}>
            <Users size={22} className="md:w-[28px] md:h-[28px]" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Colaboradores</p>
            <h4 className="text-2xl font-black text-slate-800">{employees.length}</h4>
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4">
          <div className="p-3 md:p-4 rounded-2xl w-fit bg-amber-50 text-amber-500">
            <Package size={22} className="md:w-[28px] md:h-[28px]" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Estoque Alerta</p>
            <h4 className="text-xl font-black text-slate-800">{lowStockCount} Itens</h4>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        
        {/* Maintenance Chart */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-50">
          <div className="flex items-center space-x-3 mb-6">
             <div className="p-2 bg-red-50 rounded-xl text-red-500"><AlertCircle size={20}/></div>
             <h3 className="text-lg font-black text-slate-800">Manutenção por Andar</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={floorData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <Tooltip cursor={{fill: '#f8fafc'}} content={<CustomTooltip />} />
                <Bar dataKey="defects" fill={theme.primary} radius={[8, 8, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Apartment Status Pie */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-50">
          <div className="flex items-center space-x-3 mb-6">
             <div className="p-2 bg-blue-50 rounded-xl text-blue-500"><ClipboardList size={20}/></div>
             <h3 className="text-lg font-black text-slate-800">Status das Unidades</h3>
          </div>
          <div className="h-64 flex flex-col md:flex-row items-center justify-center">
            <div className="w-full h-full md:w-2/3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-row md:flex-col justify-center space-x-4 md:space-x-0 md:space-y-4 md:w-1/3">
              {pieData.map((item, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <div>
                     <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">{item.name}</span>
                     <span className="text-sm font-black text-slate-800">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
         
         {/* Employee Sector Distribution */}
         <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-50">
            <div className="flex items-center space-x-3 mb-6">
               <div className="p-2 bg-purple-50 rounded-xl text-purple-500"><Briefcase size={20}/></div>
               <h3 className="text-lg font-black text-slate-800">Equipe por Setor</h3>
            </div>
            <div className="h-64">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie
                        data={sectorData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                     >
                        {sectorData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                     </Pie>
                     <Tooltip content={<CustomTooltip />} />
                     <Legend 
                        layout="vertical" 
                        verticalAlign="middle" 
                        align="right"
                        iconType="circle"
                        formatter={(value, entry: any) => <span className="text-[10px] font-black text-slate-500 uppercase ml-2">{value} ({entry.payload.value})</span>}
                     />
                  </PieChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* Low Stock Horizontal Bar */}
         <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-50">
            <div className="flex items-center space-x-3 mb-6">
               <div className="p-2 bg-amber-50 rounded-xl text-amber-500"><Box size={20}/></div>
               <h3 className="text-lg font-black text-slate-800">Top 5 Itens Críticos</h3>
            </div>
            {lowStockItems.length === 0 ? (
               <div className="h-64 flex flex-col items-center justify-center text-slate-300">
                  <Package size={48} className="mb-2 opacity-50"/>
                  <p className="font-bold text-xs">Estoque Saudável</p>
               </div>
            ) : (
               <div className="h-64 space-y-4 overflow-y-auto">
                  {lowStockItems.map((item, idx) => (
                     <div key={idx} className="relative">
                        <div className="flex justify-between items-end mb-1">
                           <span className="text-[10px] font-black text-slate-600 uppercase truncate max-w-[200px]">{item.name}</span>
                           <span className="text-[10px] font-black text-rose-500">{item.current} / {item.target}</span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                           <div 
                              className="h-full bg-rose-500 rounded-full" 
                              style={{ width: `${Math.min(100, (item.current / item.target) * 100)}%` }}
                           ></div>
                        </div>
                     </div>
                  ))}
               </div>
            )}
         </div>

      </div>
    </div>
  );
};

export default Dashboard;
