
import React, { useState, useMemo } from 'react';
import { Employee, HotelTheme, Sector, UniformItem, ExtraLabor, InventoryOperation } from '../types';
import { 
  Search, 
  UserPlus, 
  Trash2, 
  Building2,
  X,
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Edit2,
  Calendar as CalendarIcon,
  User as UserIcon,
  Printer,
  CalendarDays,
  Briefcase,
  Users,
  Star,
  MessageSquare,
  Phone,
  QrCode,
  Download,
  History,
  Package
} from 'lucide-react';

interface EmployeesViewProps {
  employees: Employee[];
  extras: ExtraLabor[];
  sectors: Sector[];
  inventoryHistory?: InventoryOperation[];
  selectedSectorId: string | null;
  onSelectSector: (id: string | null) => void;
  theme: HotelTheme;
  onSave: (employee: Employee) => void;
  onDelete: (id: string) => void;
  onSaveExtra: (extra: ExtraLabor) => void;
  onDeleteExtra: (id: string) => void;
  onSaveSector: (sector: Sector) => void;
  onDeleteSector: (id: string) => void;
}

const EmployeesView: React.FC<EmployeesViewProps> = ({ 
  employees, 
  extras,
  sectors, 
  inventoryHistory = [],
  selectedSectorId, 
  onSelectSector, 
  theme, 
  onSave, 
  onDelete, 
  onSaveExtra,
  onDeleteExtra,
  onSaveSector, 
  onDeleteSector 
}) => {
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isAddingExtra, setIsAddingExtra] = useState(false);
  const [editingExtra, setEditingExtra] = useState<ExtraLabor | null>(null);
  const [isAddingSector, setIsAddingSector] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'LIST' | 'SCALE' | 'TODAY' | 'EXTRAS'>('LIST');
  const [activeFormTab, setActiveFormTab] = useState<'DADOS' | 'ESCALA' | 'UNIFORMES'>('DADOS');
  const [selectedBadge, setSelectedBadge] = useState<Employee | null>(null);
  const [viewingHistoryEmployee, setViewingHistoryEmployee] = useState<Employee | null>(null);

  // Form State Employee
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [contact, setContact] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [salary, setSalary] = useState('');
  const [uniforms, setUniforms] = useState<UniformItem[]>([]);
  const [scheduleType, setScheduleType] = useState<'6x1' | '12x36' | 'Intermitente'>('6x1');
  const [shiftType, setShiftType] = useState<'Par' | 'Ímpar'>('Par');
  const [workingHours, setWorkingHours] = useState('08:00 - 16:20');
  const [fixedDayOff, setFixedDayOff] = useState('Segunda-feira');
  const [sundayOffs, setSundayOffs] = useState<number[]>([]);
  const [vacationStatus, setVacationStatus] = useState<'Pendente' | 'Concedida'>('Pendente');

  // Form State Extra
  const [extraName, setExtraName] = useState('');
  const [extraPhone, setExtraPhone] = useState('');
  const [extraAvailability, setExtraAvailability] = useState<string[]>([]);
  const [extraQuality, setExtraQuality] = useState(5);
  const [extraObservation, setExtraObservation] = useState('');

  const weekDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  const resetEmployeeForm = () => {
    setName(''); setRole(''); setGender('M'); setContact(''); setSalary('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setUniforms([]); setScheduleType('6x1'); setShiftType('Par');
    setWorkingHours('08:00 - 16:20'); setFixedDayOff('Segunda-feira');
    setSundayOffs([]); setVacationStatus('Pendente');
    setIsAddingEmployee(false); setEditingEmployee(null); setActiveFormTab('DADOS');
  };

  const resetExtraForm = () => {
    setExtraName(''); setExtraPhone(''); setExtraAvailability([]); setExtraQuality(5); setExtraObservation('');
    setIsAddingExtra(false); setEditingExtra(null);
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setName(emp.name || ''); setRole(emp.role || ''); setGender(emp.gender || 'M');
    setContact(emp.contact || ''); setStartDate(emp.startDate || ''); setSalary((emp.salary || 0).toString());
    setUniforms(emp.uniforms || []); setScheduleType(emp.scheduleType || '6x1');
    setShiftType(emp.shiftType || 'Par'); setWorkingHours(emp.workingHours || '08:00 - 16:20');
    setFixedDayOff(emp.fixedDayOff || 'Segunda-feira');
    setSundayOffs(emp.sundayOffs || []); setVacationStatus(emp.vacationStatus || 'Pendente');
    setIsAddingEmployee(true);
  };

  const handleEditExtra = (ext: ExtraLabor) => {
    setEditingExtra(ext);
    setExtraName(ext.name || ''); setExtraPhone(ext.phone || ''); 
    setExtraAvailability(ext.availability || []); setExtraQuality(ext.serviceQuality || 5);
    setExtraObservation(ext.observation || '');
    setIsAddingExtra(true);
  };

  const handleSaveEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSectorId && !editingEmployee) return;

    const newEmp: Employee = {
      id: editingEmployee?.id || Date.now().toString(),
      name: name || 'Sem Nome', 
      role: role || 'Cargo', 
      gender, 
      contact, 
      startDate,
      salary: parseFloat(salary) || 0, 
      department: sectors.find(s => s.id === (selectedSectorId || editingEmployee?.sectorId))?.name || '',
      sectorId: (selectedSectorId || editingEmployee?.sectorId)!, 
      status: 'Ativo', 
      scheduleType, 
      shiftType: scheduleType === '12x36' ? shiftType : undefined,
      workingHours: scheduleType === 'Intermitente' ? '' : workingHours, 
      fixedDayOff: scheduleType === '6x1' ? fixedDayOff : '', 
      sundayOffs: scheduleType === '6x1' ? sundayOffs : [], 
      weeklyDayOff: scheduleType === '6x1' ? fixedDayOff : '', 
      monthlySundayOff: '', 
      vacationStatus, 
      uniforms
    };
    onSave(newEmp);
    resetEmployeeForm();
  };

  const handleSaveExtraSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSectorId && !editingExtra) return;

    const newExtra: ExtraLabor = {
      id: editingExtra?.id || Date.now().toString(),
      name: extraName,
      phone: extraPhone,
      availability: extraAvailability,
      serviceQuality: extraQuality,
      observation: extraObservation,
      sectorId: selectedSectorId || editingExtra?.sectorId || ''
    };
    onSaveExtra(newExtra);
    resetExtraForm();
  };

  const filteredEmployees = employees.filter(e => 
    e.sectorId === selectedSectorId && 
    (e.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredExtras = extras.filter(ext => 
    ext.sectorId === selectedSectorId &&
    (ext.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const currentSector = sectors.find(s => s.id === selectedSectorId);

  // Escala Logic
  const daysArray = useMemo(() => {
    const now = new Date();
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      name: new Date(now.getFullYear(), now.getMonth(), i + 1).toLocaleDateString('pt-BR', { weekday: 'long' }),
      isSunday: new Date(now.getFullYear(), now.getMonth(), i + 1).getDay() === 0
    }));
  }, []);

  const getSundayIndex = (day: number) => {
    const now = new Date();
    let count = 0;
    for(let i = 1; i <= day; i++) {
       if(new Date(now.getFullYear(), now.getMonth(), i).getDay() === 0) count++;
    }
    return count;
  };

  const todayInfo = useMemo(() => {
    const now = new Date();
    const weekday = now.toLocaleDateString('pt-BR', { weekday: 'long' });
    const day = now.getDate();
    let sundayIdx = 0;
    if (now.getDay() === 0) {
      let count = 0;
      for(let i = 1; i <= day; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), i);
        if(d.getDay() === 0) count++;
      }
      sundayIdx = count;
    }
    return { weekday, isSunday: now.getDay() === 0, sundayIdx, fullDate: now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }) };
  }, []);

  const scheduledToday = useMemo(() => {
    return employees.filter(emp => {
      const isFixedOff = emp.fixedDayOff?.toLowerCase() === todayInfo.weekday.toLowerCase();
      const isSundayOff = todayInfo.isSunday && (emp.sundayOffs || []).includes(todayInfo.sundayIdx);
      return !isFixedOff && !isSundayOff && emp.status === 'Ativo';
    });
  }, [employees, todayInfo]);

  const groupedBySector = useMemo(() => {
    const groups: Record<string, Employee[]> = {};
    scheduledToday.forEach(emp => {
      const sector = sectors.find(s => s.id === emp.sectorId)?.name || 'Outros';
      if (!groups[sector]) groups[sector] = [];
      groups[sector].push(emp);
    });
    return groups;
  }, [scheduledToday, sectors]);

  // Lista de funcionários para a tabela de escala (exclui intermitentes)
  const scaleEmployees = useMemo(() => {
    return filteredEmployees.filter(e => e.scheduleType !== 'Intermitente');
  }, [filteredEmployees]);

  const employeeHistory = useMemo(() => {
    if(!viewingHistoryEmployee) return [];
    return inventoryHistory.filter(op => op.recipientId === viewingHistoryEmployee.id).sort((a,b) => b.timestamp - a.timestamp);
  }, [inventoryHistory, viewingHistoryEmployee]);

  if (!selectedSectorId && viewMode !== 'TODAY') {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Painel de Equipe</p>
          <div className="flex gap-2">
            <button 
              onClick={() => setViewMode('TODAY')} 
              className="bg-white border-2 border-slate-100 text-slate-600 px-6 py-3 rounded-xl font-bold flex items-center space-x-2 shadow-sm hover:border-blue-200 transition-all"
            >
              <CalendarDays size={18} /> <span>Escalados Hoje</span>
            </button>
            <button 
              onClick={() => setIsAddingSector(true)} 
              className="text-white px-6 py-3 rounded-xl font-bold flex items-center space-x-2 shadow-lg" 
              style={{ backgroundColor: theme.primary }}
            >
              <Plus size={18} /> <span>Novo Setor</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sectors.map((sec) => (
            <div key={sec.id} className="relative group">
              <button onClick={() => onSelectSector(sec.id)} className="w-full bg-white h-48 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all border border-slate-50 flex flex-col items-center justify-center overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: theme.primary }}></div>
                <div className="p-5 rounded-2xl mb-3 bg-slate-50 text-slate-400 group-hover:scale-110 transition-transform">
                  <Building2 size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-800">{sec.name}</h3>
                <p className="text-slate-400 text-[10px] font-black uppercase mt-1">
                  {employees.filter(e => e.sectorId === sec.id).length} Colaboradores
                </p>
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (viewMode === 'TODAY') {
    return (
      <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button onClick={() => setViewMode('LIST')} className="p-2 bg-slate-50 rounded-xl text-slate-400"><ChevronLeft size={20} /></button>
            <div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Escalados Hoje</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{todayInfo.weekday} • {todayInfo.fullDate}</p>
            </div>
          </div>
          <div className="bg-slate-50 px-4 py-2 rounded-xl border">
             <span className="text-lg font-black text-slate-800">{scheduledToday.length}</span>
             <span className="ml-2 text-[9px] font-black text-slate-400 uppercase">Presentes</span>
          </div>
        </div>

        <div className="space-y-8">
           {(Object.entries(groupedBySector) as [string, Employee[]][]).sort().map(([sectorName, list]) => (
             <div key={sectorName} className="space-y-4">
                <div className="flex items-center space-x-2 px-2">
                   <Briefcase size={16} className="text-slate-400" />
                   <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">{sectorName} ({list.length})</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {list.map(emp => (
                     <div key={emp.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group">
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
                     </div>
                   ))}
                </div>
             </div>
           ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center space-x-3">
          <button onClick={() => onSelectSector(null)} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{currentSector?.name}</h2>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                {viewMode === 'EXTRAS' ? `${filteredExtras.length} Profissionais` : `${filteredEmployees.length} Colaboradores`}
            </p>
          </div>
        </div>
        
        <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
          <button onClick={() => setViewMode('LIST')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'LIST' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>Listagem</button>
          <button onClick={() => setViewMode('SCALE')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'SCALE' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>Escala</button>
          <button onClick={() => setViewMode('EXTRAS')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'EXTRAS' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>Extras</button>
        </div>

        {viewMode === 'EXTRAS' ? (
            <button onClick={() => setIsAddingExtra(true)} className="text-white px-6 py-3 rounded-xl font-bold flex items-center space-x-2 shadow-lg" style={{ backgroundColor: theme.primary }}>
                <UserPlus size={18} /> <span className="hidden sm:inline">Cadastrar Extra</span>
            </button>
        ) : (
            <button onClick={() => setIsAddingEmployee(true)} className="text-white px-6 py-3 rounded-xl font-bold flex items-center space-x-2 shadow-lg" style={{ backgroundColor: theme.primary }}>
                <UserPlus size={18} /> <span className="hidden sm:inline">Adicionar</span>
            </button>
        )}
      </div>

      {viewMode === 'LIST' && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <input type="text" placeholder="Buscar colaborador..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-100 text-sm font-bold bg-white shadow-inner" />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredEmployees.map(emp => (
              <div key={emp.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-6 group hover:border-blue-200 transition-all">
                <div className="flex items-center space-x-4 flex-1">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-md ${emp.gender === 'F' ? 'bg-rose-400' : 'bg-blue-400'}`}>
                    {(emp.name || 'S')[0]}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800">{emp.name || 'Sem Nome'}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                       {emp.role} • {emp.scheduleType === 'Intermitente' ? 'Intermitente' : `Folga: ${emp.fixedDayOff || 'Rodízio'}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 items-center">
                  <div className="text-right hidden md:block">
                    <p className="text-[8px] font-black text-slate-300 uppercase">Status</p>
                    <span className="text-[9px] font-black text-emerald-500 uppercase flex items-center"><CheckCircle2 size={10} className="mr-1"/> Ativo</span>
                  </div>
                  <div className="flex space-x-2">
                    <button 
                       onClick={() => setSelectedBadge(emp)}
                       className="p-3 bg-slate-50 text-slate-400 hover:text-blue-500 rounded-xl transition-all border border-transparent hover:border-blue-200"
                       title="Crachá"
                    >
                       <QrCode size={18}/>
                    </button>
                    <button 
                       onClick={() => setViewingHistoryEmployee(emp)}
                       className="p-3 bg-slate-50 text-slate-400 hover:text-amber-500 rounded-xl transition-all border border-transparent hover:border-amber-200"
                       title="Histórico de Retiradas"
                    >
                       <History size={18}/>
                    </button>
                    <button onClick={() => handleEditEmployee(emp)} className="p-3 bg-slate-50 text-slate-400 hover:text-blue-500 rounded-xl transition-all border border-transparent hover:border-blue-200"><Edit2 size={18}/></button>
                    <button onClick={() => onDelete(emp.id)} className="p-3 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-xl transition-all border border-transparent hover:border-rose-200"><Trash2 size={18}/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Digital Badge / QR Code */}
      {selectedBadge && (
         <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[450] flex items-center justify-center p-4 print-badge-container">
            <div className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-300 relative print-badge-content">
               <button onClick={() => setSelectedBadge(null)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-800 transition-colors z-10 no-print"><X size={24}/></button>
               
               <div className="bg-slate-900 p-10 flex flex-col items-center text-center text-white relative overflow-hidden print:bg-white print:text-black print:p-0">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 no-print"></div>
                  <div className="w-24 h-24 rounded-full border-4 border-white shadow-xl flex items-center justify-center bg-slate-800 text-3xl font-black mb-4 relative z-10 print:hidden">
                      {(selectedBadge.name || 'S')[0]}
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tighter relative z-10 print:text-3xl print:mb-2">{selectedBadge.name}</h3>
                  <p className="text-xs font-bold opacity-60 uppercase tracking-widest relative z-10 print:text-sm print:opacity-100">{selectedBadge.role}</p>
                  <Building2 className="absolute -bottom-10 -right-10 text-white/5 w-48 h-48 no-print" />
               </div>
               
               <div className="p-8 flex flex-col items-center space-y-6 bg-white print:p-0 print:mt-4">
                  <div className="p-4 bg-white rounded-2xl shadow-lg border-2 border-slate-100 print:shadow-none print:border-none print:p-0">
                     {/* Public QR Code API for simplicity - generates QR from Employee ID */}
                     <img 
                       src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${selectedBadge.id}&color=000000`} 
                       alt="QR Code" 
                       className="w-48 h-48 object-contain"
                     />
                  </div>
                  <div className="text-center space-y-1 print:mt-2">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-[10px]">ID do Colaborador</p>
                     <p className="text-xs font-mono bg-slate-100 px-3 py-1 rounded-lg text-slate-600 print:bg-transparent print:p-0 print:text-black">{selectedBadge.id}</p>
                  </div>
                  <button 
                    onClick={() => window.print()} 
                    className="flex items-center space-x-2 text-blue-500 font-black text-xs uppercase tracking-widest hover:underline no-print"
                  >
                     <Download size={14}/> <span>Imprimir Etiqueta</span>
                  </button>
               </div>
            </div>
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .print-badge-container, .print-badge-container * {
                        visibility: visible;
                    }
                    .print-badge-container {
                        position: fixed;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        background: white;
                        z-index: 9999;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 0;
                        margin: 0;
                    }
                    .print-badge-content {
                        box-shadow: none !important;
                        border: none !important;
                        border-radius: 0 !important;
                        width: 100% !important;
                        max-width: none !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>
         </div>
      )}

      {/* Modal Histórico de Retiradas */}
      {viewingHistoryEmployee && (
         <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[450] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-300 max-h-[80vh]">
               <div className="p-8 border-b flex justify-between items-center bg-slate-50">
                  <div>
                     <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><History size={20}/> Histórico de Retiradas</h3>
                     <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{viewingHistoryEmployee.name}</p>
                  </div>
                  <button onClick={() => setViewingHistoryEmployee(null)} className="p-2 text-slate-400 hover:text-slate-800 transition-colors"><X size={24}/></button>
               </div>
               
               <div className="p-8 overflow-y-auto">
                  {employeeHistory.length === 0 ? (
                      <div className="text-center py-10 text-slate-300 font-black italic border-2 border-dashed border-slate-100 rounded-3xl">
                          <Package size={48} className="mx-auto mb-2 opacity-50"/>
                          Nenhuma retirada registrada para este colaborador.
                      </div>
                  ) : (
                      <div className="space-y-3">
                          {employeeHistory.map(op => (
                              <div key={op.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-slate-200 transition-all">
                                  <div className="flex items-center gap-4">
                                      <div className="bg-slate-100 p-3 rounded-xl text-slate-500">
                                          <Package size={20}/>
                                      </div>
                                      <div>
                                          <p className="font-black text-slate-800">{op.itemName}</p>
                                          <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                                              <Clock size={10}/> {new Date(op.timestamp).toLocaleString()}
                                          </p>
                                      </div>
                                  </div>
                                  <div className="text-right">
                                      <span className="text-lg font-black text-rose-500">-{op.quantity}</span>
                                      {op.reason && <p className="text-[9px] text-slate-400 max-w-[150px] truncate">{op.reason}</p>}
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
               </div>
            </div>
         </div>
      )}

      {viewMode === 'SCALE' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95">
          <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
             <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">ESCALA {currentSector?.name}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
             </div>
             <button onClick={() => window.print()} className="p-3 bg-white rounded-xl border text-slate-400 hover:text-slate-900 transition-all"><Printer size={20}/></button>
          </div>
          
          <div className="overflow-x-auto">
             <table className="w-full border-collapse text-[9px] md:text-[10px]">
                <thead>
                   <tr className="bg-slate-100">
                      {/* Coluna NOME fixa */}
                      <th className="sticky left-0 z-30 bg-slate-100 border-b border-r border-slate-300 p-2 text-left min-w-[120px] md:min-w-[150px] uppercase font-black text-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">COLABORADOR</th>
                      {/* Coluna JORNADA fixa */}
                      <th className="sticky left-[120px] md:left-[150px] z-30 bg-slate-100 border-b border-r border-slate-300 p-2 text-center min-w-[70px] md:min-w-[90px] uppercase font-black text-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">JORNADA</th>
                      {daysArray.map(d => (
                         <th key={d.day} className={`border-b border-r border-slate-300 p-1 text-center min-w-[26px] md:min-w-[30px] font-black ${d.isSunday ? 'bg-slate-200 text-slate-900' : 'bg-slate-50 text-slate-500'}`}>
                            <div className="text-[6px] md:text-[7px] uppercase opacity-70 mb-0.5 leading-none">{d.name.slice(0,3)}</div>
                            <div className="text-slate-800 leading-none">{d.day}</div>
                         </th>
                      ))}
                   </tr>
                </thead>
                <tbody>
                   {scaleEmployees.length === 0 ? (
                     <tr>
                       <td colSpan={daysArray.length + 2} className="p-10 text-center text-slate-300 font-black italic uppercase">Nenhum funcionário na escala</td>
                     </tr>
                   ) : scaleEmployees.map(emp => (
                      <tr key={emp.id} className="hover:bg-slate-50 transition-colors border-b border-slate-200">
                         {/* Coluna NOME fixa no corpo */}
                         <td className="sticky left-0 z-20 bg-white border-r border-slate-300 p-2 font-bold uppercase text-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] truncate max-w-[120px] md:max-w-[150px]">
                            {emp.name || 'Sem Nome'}
                            {emp.scheduleType === '12x36' && <span className="block text-[8px] text-blue-500">{emp.shiftType || 'Par'}</span>}
                         </td>
                         {/* Coluna JORNADA fixa no corpo */}
                         <td className="sticky left-[120px] md:left-[150px] z-20 bg-white border-r border-slate-300 p-2 text-center font-bold text-slate-500 whitespace-nowrap text-[8px] md:text-[10px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{emp.workingHours}</td>
                         {daysArray.map(d => {
                            let content = '';
                            let textColor = 'text-slate-800';
                            let bgColor = d.isSunday ? 'bg-slate-100/30' : '';
                            let extraStyles = '';

                            if (emp.scheduleType === '12x36') {
                               const isEvenDay = d.day % 2 === 0;
                               const isParShift = emp.shiftType === 'Par';
                               // Lógica 12x36:
                               // Se turno PAR: trabalha dias pares (2,4,6...), folga ímpares.
                               // Se turno ÍMPAR: trabalha dias ímpares (1,3,5...), folga pares.
                               
                               const isWorkDay = (isEvenDay && isParShift) || (!isEvenDay && !isParShift);
                               
                               if (!isWorkDay) {
                                  content = 'F';
                                  textColor = 'text-slate-400';
                                  bgColor = 'bg-slate-100';
                               }
                            } else {
                               // Lógica 6x1
                               const isFixedOff = d.name.toLowerCase() === (emp.fixedDayOff || '').toLowerCase();
                               const isSundayOff = d.isSunday && (emp.sundayOffs || []).includes(getSundayIndex(d.day));
                               
                               if(isSundayOff) {
                                  content = 'D';
                                  textColor = 'text-amber-600';
                                  bgColor = 'bg-amber-50';
                                  extraStyles = 'ring-1 ring-inset ring-amber-200';
                               } else if(isFixedOff) {
                                  content = 'F';
                                  textColor = 'text-blue-600';
                                  bgColor = 'bg-blue-50';
                                  extraStyles = 'ring-1 ring-inset ring-blue-200';
                               }
                            }
                            
                            return (
                               <td key={d.day} className={`border-r border-slate-200 p-1 text-center font-black ${bgColor} ${textColor} ${extraStyles}`}>
                                  <span className="inline-block scale-90 md:scale-100">{content}</span>
                                </td>
                            );
                         })}
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
        </div>
      )}

      {viewMode === 'EXTRAS' && (
        <div className="space-y-6">
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="text" placeholder="Buscar profissional extra..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-100 text-sm font-bold bg-white shadow-inner" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredExtras.map(ext => (
                    <div key={ext.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative group overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEditExtra(ext)} className="p-2 bg-slate-50 text-slate-400 hover:text-blue-500 rounded-lg"><Edit2 size={16}/></button>
                            <button onClick={() => onDeleteExtra(ext.id)} className="p-2 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-lg"><Trash2 size={16}/></button>
                        </div>

                        <div className="flex items-center space-x-4 mb-4">
                            <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-lg">
                                {(ext.name || 'E')[0]}
                            </div>
                            <div>
                                <h4 className="font-black text-slate-800">{ext.name}</h4>
                                <div className="flex items-center text-emerald-500 font-black text-[10px] uppercase tracking-tighter">
                                    <Star size={10} className="mr-1 fill-emerald-500"/> Avaliação: {ext.serviceQuality}/10
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center text-xs font-bold text-slate-500">
                                <Phone size={14} className="mr-2 text-slate-300"/> {ext.phone || 'Sem contato'}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {(ext.availability || []).map(day => (
                                    <span key={day} className="px-2 py-0.5 bg-slate-50 text-slate-400 text-[8px] font-black uppercase rounded border border-slate-100">{day}</span>
                                ))}
                            </div>
                            {ext.observation && (
                                <div className="mt-2 p-3 bg-slate-50/50 rounded-xl border border-slate-50 flex items-start gap-2">
                                    <MessageSquare size={12} className="text-slate-300 mt-1 shrink-0"/>
                                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{ext.observation}</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {filteredExtras.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-white border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                        <Users size={48} className="mx-auto text-slate-100 mb-4"/>
                        <p className="text-slate-400 font-black italic">Nenhum extra cadastrado neste setor.</p>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* Modal Cadastro de Profissional Extra */}
      {isAddingExtra && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[400] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in duration-300">
                <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{editingExtra ? 'Editar' : 'Cadastrar'} Profissional Extra</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{currentSector?.name}</p>
                    </div>
                    <button onClick={resetExtraForm} className="p-2 text-slate-300 hover:text-slate-900 transition-all"><X size={28}/></button>
                </div>

                <form onSubmit={handleSaveExtraSubmit} className="p-8 space-y-6 overflow-y-auto">
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Nome Completo</label>
                            <input type="text" value={extraName} onChange={e => setExtraName(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 font-bold text-slate-800 focus:border-slate-900 transition-all" required />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Telefone de Contato</label>
                            <input type="text" value={extraPhone} onChange={e => setExtraPhone(e.target.value)} placeholder="(00) 00000-0000" className="w-full px-4 py-3 rounded-xl border-2 font-bold text-slate-800" />
                        </div>
                        
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block">Disponibilidade (Dias da Semana)</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {weekDays.map(day => (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => {
                                            if(extraAvailability.includes(day)) setExtraAvailability(extraAvailability.filter(d => d !== day));
                                            else setExtraAvailability([...extraAvailability, day]);
                                        }}
                                        className={`py-2 px-1 rounded-lg text-[9px] font-black uppercase transition-all border-2 ${extraAvailability.includes(day) ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                                    >
                                        {day.slice(0, 3)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase block">Qualidade do Serviço</label>
                                <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-black">{extraQuality}/10</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" max="10" step="1" 
                                value={extraQuality} 
                                onChange={e => setExtraQuality(parseInt(e.target.value))} 
                                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Observações Adicionais</label>
                            <textarea 
                                value={extraObservation} 
                                onChange={e => setExtraObservation(e.target.value)} 
                                className="w-full px-4 py-3 rounded-xl border-2 font-bold text-slate-800 min-h-[80px]" 
                                placeholder="Notas sobre experiências anteriores..."
                            />
                        </div>
                    </div>

                    <div className="flex gap-4 pt-6 mt-6 border-t">
                        <button type="button" onClick={resetExtraForm} className="flex-1 py-4 font-black uppercase text-xs text-slate-400">Cancelar</button>
                        <button type="submit" className="flex-1 py-4 rounded-2xl font-black uppercase text-xs text-white shadow-xl transition-all" style={{ backgroundColor: theme.primary }}>
                            {editingExtra ? 'Atualizar Extra' : 'Cadastrar Extra'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Modal Cadastro/Edição de Funcionário CLT */}
      {isAddingEmployee && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[400] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in duration-300">
              <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
                 <div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">{editingEmployee ? 'Editar' : 'Novo'} Colaborador</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{currentSector?.name}</p>
                 </div>
                 <button onClick={resetEmployeeForm} className="p-2 text-slate-300 hover:text-slate-900 transition-all"><X size={32}/></button>
              </div>

              <div className="flex bg-slate-100 p-1.5 mx-8 mt-6 rounded-2xl border">
                 <button onClick={() => setActiveFormTab('DADOS')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeFormTab === 'DADOS' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>Dados Pessoais</button>
                 <button onClick={() => setActiveFormTab('ESCALA')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeFormTab === 'ESCALA' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>Escala & Folgas</button>
                 <button onClick={() => setActiveFormTab('UNIFORMES')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeFormTab === 'UNIFORMES' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>Uniformes</button>
              </div>

              <form onSubmit={handleSaveEmployeeSubmit} className="p-8 flex-1 overflow-y-auto space-y-8">
                 {activeFormTab === 'DADOS' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-left-4">
                       <div className="col-span-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Nome Completo</label>
                          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-5 py-4 rounded-2xl border-2 font-bold text-slate-800" required />
                       </div>
                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Gênero</label>
                          <div className="flex gap-2">
                             <button type="button" onClick={() => setGender('M')} className={`flex-1 py-3 rounded-xl border-2 font-black text-xs ${gender === 'M' ? 'bg-blue-500 border-blue-500 text-white shadow-md' : 'bg-white text-slate-400'}`}>MASCULINO</button>
                             <button type="button" onClick={() => setGender('F')} className={`flex-1 py-3 rounded-xl border-2 font-black text-xs ${gender === 'F' ? 'bg-rose-500 border-rose-500 text-white shadow-md' : 'bg-white text-slate-400'}`}>FEMININO</button>
                          </div>
                       </div>
                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Cargo / Função</label>
                          <input type="text" value={role} onChange={e => setRole(e.target.value)} className="w-full px-5 py-4 rounded-2xl border-2 font-bold text-slate-800" required />
                       </div>
                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Telefone de Contato</label>
                          <input type="text" value={contact} onChange={e => setContact(e.target.value)} placeholder="(00) 00000-0000" className="w-full px-5 py-4 rounded-2xl border-2 font-bold text-slate-800" />
                       </div>
                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Salário Base (R$)</label>
                          <input type="number" value={salary} onChange={e => setSalary(e.target.value)} className="w-full px-5 py-4 rounded-2xl border-2 font-bold text-slate-800" />
                       </div>
                    </div>
                 )}

                 {activeFormTab === 'ESCALA' && (
                    <div className="space-y-8 animate-in slide-in-from-right-4">
                       <div className="col-span-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Tipo de Escala</label>
                          <div className="flex gap-2">
                             {(['6x1', '12x36', 'Intermitente'] as const).map(type => (
                               <button 
                                 key={type}
                                 type="button" 
                                 onClick={() => setScheduleType(type)}
                                 className={`flex-1 py-3 rounded-xl border-2 font-black text-[10px] uppercase transition-all ${scheduleType === type ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-white text-slate-400 hover:border-slate-300'}`}
                               >
                                 {type}
                               </button>
                             ))}
                          </div>
                       </div>

                       {scheduleType === 'Intermitente' && (
                          <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 flex items-center space-x-3 text-amber-700">
                             <AlertTriangle size={24} />
                             <p className="text-xs font-bold">Colaboradores intermitentes não possuem escala fixa e não aparecerão na tabela de escala mensal.</p>
                          </div>
                       )}

                       {scheduleType !== 'Intermitente' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {scheduleType === '12x36' ? (
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Tipo de Turno (Dia)</label>
                                    <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                                      <button type="button" onClick={() => setShiftType('Par')} className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase transition-all ${shiftType === 'Par' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>Dias Pares</button>
                                      <button type="button" onClick={() => setShiftType('Ímpar')} className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase transition-all ${shiftType === 'Ímpar' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>Dias Ímpares</button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Folga Fixa Semanal</label>
                                    <select value={fixedDayOff} onChange={e => setFixedDayOff(e.target.value)} className="w-full px-5 py-4 rounded-2xl border-2 font-bold bg-white text-slate-800 outline-none">
                                        {['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'].map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                            )}

                             <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Horário de Trabalho</label>
                                <input type="text" value={workingHours} onChange={e => setWorkingHours(e.target.value)} placeholder="08:00 - 16:20" className="w-full px-5 py-4 rounded-2xl border-2 font-bold text-slate-800" />
                             </div>
                          </div>
                       )}

                       {scheduleType === '6x1' && (
                           <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200">
                              <div className="flex justify-between items-center mb-4">
                                <label className="text-[10px] font-black text-slate-500 uppercase flex items-center">
                                   <CalendarIcon size={14} className="mr-2"/> Domingos de Folga no Mês
                                </label>
                                <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${gender === 'F' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                                   Regra: {gender === 'F' ? '2 Domingos' : '1 Domingo'}
                                </span>
                              </div>
                              <div className="grid grid-cols-5 gap-3">
                                 {[1, 2, 3, 4, 5].map(num => (
                                    <button
                                       key={num}
                                       type="button"
                                       onClick={() => {
                                          if(sundayOffs.includes(num)) setSundayOffs(sundayOffs.filter(n => n !== num));
                                          else setSundayOffs([...sundayOffs, num]);
                                       }}
                                       className={`p-4 rounded-2xl border-2 font-black text-xs transition-all ${sundayOffs.includes(num) ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 hover:border-slate-300'}`}
                                    >
                                       {num}º D
                                    </button>
                                 ))}
                              </div>
                           </div>
                       )}
                    </div>
                 )}

                 {activeFormTab === 'UNIFORMES' && (
                    <div className="space-y-6 animate-in zoom-in-95">
                       <p className="text-center py-10 text-slate-300 font-bold italic uppercase text-xs">Módulo de controle de fardamento em desenvolvimento...</p>
                    </div>
                 )}

                 <div className="flex gap-4 pt-6 mt-6 border-t">
                    <button type="button" onClick={resetEmployeeForm} className="flex-1 py-4 font-black uppercase text-xs text-slate-400">Cancelar</button>
                    <button type="submit" className="flex-1 py-4 rounded-[1.5rem] font-black uppercase text-xs text-white shadow-xl active:scale-95 transition-all" style={{ backgroundColor: theme.primary }}>Salvar Colaborador</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default EmployeesView;
