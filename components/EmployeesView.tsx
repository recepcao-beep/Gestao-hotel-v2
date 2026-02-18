
import React, { useState, useRef, useMemo } from 'react';
import { Employee, Sector, HotelTheme, UniformItem, ExtraLabor, InventoryOperation } from '../types';
import { 
  Search, 
  UserPlus, 
  Trash2, 
  Building2,
  X,
  Plus,
  Clock,
  CheckCircle2,
  ChevronLeft,
  Edit2,
  User as UserIcon,
  Printer,
  CalendarDays,
  Briefcase,
  QrCode,
  Download,
  History,
  Camera,
  Shirt,
  ArrowUpRight,
  ArrowDownRight,
  Phone,
  Settings,
  List
} from 'lucide-react';

interface EmployeesViewProps {
  employees: Employee[];
  extras: ExtraLabor[];
  sectors: Sector[];
  inventoryHistory?: InventoryOperation[];
  selectedSectorId: string | null;
  onSelectSector: (id: string | null) => void;
  theme: HotelTheme;
  onSave: (employee: Employee, newFiles?: any[]) => void;
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
  
  // Sector Management State
  const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [sectorName, setSectorName] = useState('');
  const [sectorRoles, setSectorRoles] = useState<string[]>([]);
  const [newRole, setNewRole] = useState('');
  const [sectorUniforms, setSectorUniforms] = useState<UniformItem[]>([]);
  const [newSectorUniformName, setNewSectorUniformName] = useState('');
  const [newSectorUniformQty, setNewSectorUniformQty] = useState(1);

  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'LIST' | 'SCALE' | 'TODAY' | 'EXTRAS'>('LIST');
  const [activeFormTab, setActiveFormTab] = useState<'DADOS' | 'ESCALA' | 'UNIFORMES'>('DADOS');
  const [selectedBadge, setSelectedBadge] = useState<Employee | null>(null);
  const [viewingHistoryEmployee, setViewingHistoryEmployee] = useState<Employee | null>(null);

  // Scale Date State
  const [scaleDate, setScaleDate] = useState(new Date());

  // Form State Employee
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [contact, setContact] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [salary, setSalary] = useState('');
  const [scheduleType, setScheduleType] = useState<'6x1' | '12x36' | 'Intermitente'>('6x1');
  const [shiftType, setShiftType] = useState<'Par' | 'Ímpar'>('Par');
  const [workingHours, setWorkingHours] = useState('08:00 - 16:20');
  const [fixedDayOff, setFixedDayOff] = useState('Segunda-feira');
  const [sundayOffs, setSundayOffs] = useState<number[]>([]);
  const [vacationStatus, setVacationStatus] = useState<'Pendente' | 'Concedida'>('Pendente');
  
  // Uniforms State (Employee)
  const [uniforms, setUniforms] = useState<UniformItem[]>([]);
  const [newUniformName, setNewUniformName] = useState('');
  const [newUniformQty, setNewUniformQty] = useState(1);

  // Photo State
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [newPhotoFile, setNewPhotoFile] = useState<{data: string, mimeType: string, fileName: string} | null>(null);
  const [isPhotoRemoved, setIsPhotoRemoved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setPhotoPreview(null); setNewPhotoFile(null); setIsPhotoRemoved(false);
    setIsAddingEmployee(false); setEditingEmployee(null); setActiveFormTab('DADOS');
  };

  const resetExtraForm = () => {
    setExtraName(''); setExtraPhone(''); setExtraAvailability([]); setExtraQuality(5); setExtraObservation('');
    setIsAddingExtra(false); setEditingExtra(null);
  };

  const resetSectorForm = () => {
    setSectorName('');
    setSectorRoles([]);
    setNewRole('');
    setSectorUniforms([]);
    setNewSectorUniformName('');
    setNewSectorUniformQty(1);
    setEditingSector(null);
    setIsSectorModalOpen(false);
  };

  const handleEditSector = (sec: Sector) => {
    setEditingSector(sec);
    setSectorName(sec.name);
    setSectorRoles(sec.roles || []);
    setSectorUniforms(sec.standardUniform || []);
    setIsSectorModalOpen(true);
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setName(emp.name || ''); setRole(emp.role || ''); setGender(emp.gender || 'M');
    setContact(emp.contact || ''); setStartDate(emp.startDate || ''); setSalary((emp.salary || 0).toString());
    setUniforms(emp.uniforms || []); setScheduleType(emp.scheduleType || '6x1');
    setShiftType(emp.shiftType || 'Par'); setWorkingHours(emp.workingHours || '08:00 - 16:20');
    setFixedDayOff(emp.fixedDayOff || 'Segunda-feira');
    setSundayOffs(emp.sundayOffs || []); setVacationStatus(emp.vacationStatus || 'Pendente');
    setPhotoPreview(emp.photo || null);
    setNewPhotoFile(null);
    setIsPhotoRemoved(false);
    setIsAddingEmployee(true);
  };

  const handleEditExtra = (ext: ExtraLabor) => {
    setEditingExtra(ext);
    setExtraName(ext.name);
    setExtraPhone(ext.phone);
    setExtraAvailability(ext.availability || []);
    setExtraQuality(ext.serviceQuality || 5);
    setExtraObservation(ext.observation || '');
    setIsAddingExtra(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const fullBase64 = reader.result?.toString() || '';
        const base64Data = fullBase64.split(',')[1] || '';
        setPhotoPreview(fullBase64);
        setNewPhotoFile({ data: base64Data, mimeType: file.type, fileName: file.name });
        setIsPhotoRemoved(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setNewPhotoFile(null);
    setIsPhotoRemoved(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddUniform = () => {
    if (!newUniformName.trim()) return;
    setUniforms([...uniforms, { name: newUniformName, quantity: newUniformQty }]);
    setNewUniformName('');
    setNewUniformQty(1);
  };

  const handleRemoveUniform = (index: number) => {
    const newArr = [...uniforms];
    newArr.splice(index, 1);
    setUniforms(newArr);
  };

  // Sector Modal Handlers
  const handleAddSectorRole = () => {
    if(!newRole.trim()) return;
    setSectorRoles([...sectorRoles, newRole]);
    setNewRole('');
  };

  const handleRemoveSectorRole = (index: number) => {
    const newArr = [...sectorRoles];
    newArr.splice(index, 1);
    setSectorRoles(newArr);
  };

  const handleAddSectorUniform = () => {
    if(!newSectorUniformName.trim()) return;
    setSectorUniforms([...sectorUniforms, { name: newSectorUniformName, quantity: newSectorUniformQty }]);
    setNewSectorUniformName('');
    setNewSectorUniformQty(1);
  };

  const handleRemoveSectorUniform = (index: number) => {
    const newArr = [...sectorUniforms];
    newArr.splice(index, 1);
    setSectorUniforms(newArr);
  };

  const handleSaveSectorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSector({ 
      id: editingSector?.id || Date.now().toString(), 
      name: sectorName, 
      standardUniform: sectorUniforms,
      roles: sectorRoles
    });
    resetSectorForm();
  };

  const handleSaveEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSectorId && !editingEmployee) return;

    // Logic for Photo
    let finalPhoto = editingEmployee?.photo || '';
    if (isPhotoRemoved) {
        finalPhoto = '';
    } else if (newPhotoFile && photoPreview) {
        finalPhoto = photoPreview; 
    }

    const newEmp: Employee = {
      id: editingEmployee?.id || Date.now().toString(),
      name: name || 'Sem Nome', 
      role: role || 'Cargo', 
      gender, 
      contact, 
      startDate,
      salary: parseFloat(salary) || 0, 
      department: sectors.find(s => s.id === (selectedSectorId || editingEmployee?.sectorId))?.name || 'Geral',
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
      uniforms,
      photo: finalPhoto
    };
    
    onSave(newEmp, newPhotoFile ? [newPhotoFile] : undefined);
    resetEmployeeForm();
  };

  const handleSaveExtraSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveExtra({
      id: editingExtra?.id || Date.now().toString(),
      name: extraName,
      phone: extraPhone,
      availability: extraAvailability,
      serviceQuality: extraQuality,
      observation: extraObservation,
      sectorId: selectedSectorId || editingExtra?.sectorId || ''
    });
    resetExtraForm();
  };

  const scaleData = useMemo(() => {
    const year = scaleDate.getFullYear();
    const month = scaleDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month, i + 1);
      const dayOfWeek = d.getDay();
      let sundayIndex = 0;
      if (dayOfWeek === 0) {
        let count = 0;
        for (let j = 1; j <= i + 1; j++) {
          if (new Date(year, month, j).getDay() === 0) count++;
        }
        sundayIndex = count;
      }
      return {
        date: i + 1,
        weekdayShort: ['d', 's', 't', 'q', 'q', 's', 's'][dayOfWeek],
        weekdayFull: d.toLocaleDateString('pt-BR', { weekday: 'long' }),
        isSunday: dayOfWeek === 0,
        sundayIndex
      };
    });
  }, [scaleDate]);

  const getShiftStatus = (emp: Employee, dayInfo: typeof scaleData[0]) => {
    if (emp.vacationStatus === 'Concedida') return 'FÉRIAS';
    if (emp.scheduleType === '6x1') {
      const dayName = dayInfo.weekdayFull.toLowerCase().split('-')[0];
      const empOffDay = (emp.fixedDayOff || '').toLowerCase().split('-')[0];
      if (dayInfo.isSunday) {
        if ((emp.sundayOffs || []).includes(dayInfo.sundayIndex)) return `D${dayInfo.sundayIndex}`;
      }
      if (dayName === empOffDay && !dayInfo.isSunday) return 'F';
    }
    return '';
  };

  const filteredEmployees = employees.filter(e => 
    e.sectorId === selectedSectorId && (e.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredExtras = extras.filter(ext => 
    ext.sectorId === selectedSectorId && (ext.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentSector = sectors.find(s => s.id === selectedSectorId);

  // Return specific render for non-selected sector
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
              onClick={() => { resetSectorForm(); setIsSectorModalOpen(true); }} 
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
              <div className="absolute top-4 right-4 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleEditSector(sec); }}
                  className="p-2 bg-white/80 rounded-full text-slate-300 hover:text-blue-500 hover:bg-white transition-all"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); if(confirm('Tem certeza? Isso pode afetar dados vinculados.')) onDeleteSector(sec.id); }}
                  className="p-2 bg-white/80 rounded-full text-slate-300 hover:text-rose-500 hover:bg-white transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>

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

        {isSectorModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[400] flex items-center justify-center p-4">
             <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
                   <h3 className="font-black text-slate-800">{editingSector ? 'Editar Setor' : 'Novo Setor'}</h3>
                   <button onClick={resetSectorForm}><X size={24} className="text-slate-300"/></button>
                </div>
                <form onSubmit={handleSaveSectorSubmit} className="p-6 space-y-6">
                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Nome do Setor</label>
                      <input 
                        type="text" 
                        value={sectorName} 
                        onChange={e => setSectorName(e.target.value)} 
                        placeholder="Ex: Recepção" 
                        className="w-full px-4 py-3 rounded-xl border-2 font-bold text-slate-800 outline-none focus:border-blue-400" 
                        required 
                      />
                   </div>

                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Cargos Permitidos</label>
                      <div className="flex gap-2 mb-3">
                         <input 
                           type="text" 
                           value={newRole} 
                           onChange={e => setNewRole(e.target.value)} 
                           placeholder="Novo Cargo (Ex: Recepcionista)" 
                           className="flex-1 px-4 py-2 rounded-xl border-2 font-bold text-sm" 
                         />
                         <button type="button" onClick={handleAddSectorRole} className="p-2 bg-slate-800 text-white rounded-xl"><Plus size={20}/></button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                         {sectorRoles.map((role, idx) => (
                            <span key={idx} className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 flex items-center">
                               {role}
                               <button type="button" onClick={() => handleRemoveSectorRole(idx)} className="ml-2 text-slate-400 hover:text-rose-500"><X size={12}/></button>
                            </span>
                         ))}
                         {sectorRoles.length === 0 && <span className="text-xs text-slate-300 italic">Nenhum cargo definido.</span>}
                      </div>
                   </div>

                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Uniformes Padrão</label>
                      <div className="flex gap-2 mb-3 items-center">
                         <input 
                           type="text" 
                           value={newSectorUniformName} 
                           onChange={e => setNewSectorUniformName(e.target.value)} 
                           placeholder="Item (Ex: Camisa)" 
                           className="flex-1 px-4 py-2 rounded-xl border-2 font-bold text-sm" 
                         />
                         <input 
                           type="number" 
                           value={newSectorUniformQty} 
                           onChange={e => setNewSectorUniformQty(parseInt(e.target.value))} 
                           className="w-16 px-2 py-2 rounded-xl border-2 font-bold text-sm text-center" 
                         />
                         <button type="button" onClick={handleAddSectorUniform} className="p-2 bg-slate-800 text-white rounded-xl"><Plus size={20}/></button>
                      </div>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                         {sectorUniforms.map((uni, idx) => (
                            <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded-xl border border-slate-100">
                               <div className="flex items-center space-x-2">
                                  <Shirt size={14} className="text-slate-400"/>
                                  <span className="text-xs font-bold text-slate-700">{uni.name}</span>
                               </div>
                               <div className="flex items-center space-x-3">
                                  <span className="text-[10px] font-black text-slate-400 bg-white px-2 py-0.5 rounded border">Qtd: {uni.quantity}</span>
                                  <button type="button" onClick={() => handleRemoveSectorUniform(idx)} className="text-slate-300 hover:text-rose-500"><X size={14}/></button>
                               </div>
                            </div>
                         ))}
                         {sectorUniforms.length === 0 && <span className="text-xs text-slate-300 italic">Nenhum uniforme padrão definido.</span>}
                      </div>
                   </div>

                   <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-xs uppercase shadow-lg">Salvar Setor</button>
                </form>
             </div>
          </div>
        )}
      </div>
      );
  }

  // --- Main Employee View (with Sector Selected) ---
  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      
      {/* Header and Controls */}
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
        <div className="space-y-4 animate-in slide-in-from-bottom-2">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <input type="text" placeholder="Buscar colaborador..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-100 text-sm font-bold bg-white shadow-inner" />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredEmployees.map(emp => (
              <div key={emp.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-6 group hover:border-blue-200 transition-all">
                <div className="flex items-center space-x-4 flex-1">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md overflow-hidden ${emp.gender === 'F' ? 'bg-rose-400' : 'bg-blue-400'}`}>
                    {emp.photo ? (
                      <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={24} className="text-white" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800">{emp.name || 'Sem Nome'}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                       {emp.role} • {emp.scheduleType === 'Intermitente' ? 'Intermitente' : `Folga: ${emp.fixedDayOff || 'Rodízio'}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 items-center">
                  <div className="flex space-x-2">
                    <button onClick={() => setSelectedBadge(emp)} className="p-3 bg-slate-50 text-slate-400 hover:text-blue-500 rounded-xl transition-all"><QrCode size={18}/></button>
                    <button onClick={() => setViewingHistoryEmployee(emp)} className="p-3 bg-slate-50 text-slate-400 hover:text-amber-500 rounded-xl transition-all"><History size={18}/></button>
                    <button onClick={() => handleEditEmployee(emp)} className="p-3 bg-slate-50 text-slate-400 hover:text-blue-500 rounded-xl transition-all"><Edit2 size={18}/></button>
                    <button onClick={() => onDelete(emp.id)} className="p-3 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-xl transition-all"><Trash2 size={18}/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'SCALE' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden animate-in slide-in-from-right-2">
           <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h3 className="font-black text-slate-800">Escala Mensal</h3>
              <input 
                 type="month" 
                 value={scaleDate.toISOString().slice(0, 7)}
                 onChange={(e) => setScaleDate(new Date(e.target.value + '-02'))} // +02 prevents timezone issues
                 className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-xs outline-none"
              />
           </div>
           <div className="overflow-x-auto pb-4">
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="bg-slate-50/50">
                       <th className="sticky left-0 bg-white z-10 px-6 py-4 font-black text-[10px] uppercase text-slate-400 tracking-widest border-b border-slate-100 min-w-[200px]">Colaborador</th>
                       {scaleData.map((d, i) => (
                          <th key={i} className={`px-2 py-4 text-[9px] font-black text-center border-b border-slate-100 min-w-[35px] ${d.isSunday ? 'bg-red-50 text-red-400' : 'text-slate-400'}`}>
                             <div className="flex flex-col">
                                <span>{d.date}</span>
                                <span>{d.weekdayShort}</span>
                             </div>
                          </th>
                       ))}
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {filteredEmployees.map(emp => (
                       <tr key={emp.id} className="hover:bg-slate-50/30 transition-colors">
                          <td className="sticky left-0 bg-white z-10 px-6 py-4 border-r border-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                             <p className="font-black text-xs text-slate-800 truncate max-w-[180px]">{emp.name}</p>
                             <p className="text-[8px] font-bold text-slate-400 uppercase">{emp.role}</p>
                          </td>
                          {scaleData.map((d, i) => {
                             const status = getShiftStatus(emp, d);
                             let cellClass = "";
                             let text = "";
                             
                             if (status === 'FÉRIAS') { cellClass = "bg-amber-100 text-amber-600"; text = "F"; }
                             else if (status.startsWith('D')) { cellClass = "bg-red-100 text-red-500"; text = "F"; } // Domingo
                             else if (status === 'F') { cellClass = "bg-blue-100 text-blue-500"; text = "F"; } // Folga Fixa
                             
                             return (
                                <td key={i} className={`text-center p-1 border-r border-slate-50 last:border-none ${d.isSunday ? 'bg-slate-50/50' : ''}`}>
                                   {text && (
                                      <div className={`w-6 h-6 mx-auto rounded flex items-center justify-center text-[9px] font-black ${cellClass}`}>
                                         {text}
                                      </div>
                                   )}
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
         <div className="space-y-4 animate-in slide-in-from-right-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {filteredExtras.length === 0 ? (
                  <div className="col-span-full py-20 text-center text-slate-300 font-bold italic">
                     Nenhum profissional extra cadastrado neste setor.
                  </div>
               ) : (
                  filteredExtras.map(extra => (
                     <div key={extra.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative group hover:shadow-lg transition-all">
                        <div className="flex items-center space-x-4 mb-4">
                           <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-black text-lg">
                              {extra.name[0]}
                           </div>
                           <div>
                              <h4 className="font-black text-slate-800 text-lg">{extra.name}</h4>
                              <p className="text-[10px] font-bold text-slate-400 flex items-center"><Phone size={10} className="mr-1"/> {extra.phone}</p>
                           </div>
                        </div>
                        
                        <div className="space-y-3">
                           <div>
                              <p className="text-[9px] font-black text-slate-300 uppercase mb-1">Disponibilidade</p>
                              <div className="flex flex-wrap gap-1">
                                 {(extra.availability || []).map(day => (
                                    <span key={day} className="px-2 py-1 bg-slate-50 rounded text-[8px] font-bold text-slate-600 uppercase">{day.substring(0, 3)}</span>
                                 ))}
                              </div>
                           </div>
                           <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                              <span className="text-[9px] font-black text-slate-400 uppercase">Qualidade</span>
                              <div className="flex gap-0.5">
                                 {[1,2,3,4,5].map(star => (
                                    <div key={star} className={`w-2 h-2 rounded-full ${star <= extra.serviceQuality ? 'bg-emerald-400' : 'bg-slate-200'}`}></div>
                                 ))}
                              </div>
                           </div>
                        </div>

                        <div className="absolute top-4 right-4 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => handleEditExtra(extra)} className="p-2 bg-white rounded-full shadow-sm text-slate-400 hover:text-blue-500"><Edit2 size={14}/></button>
                           <button onClick={() => onDeleteExtra(extra.id)} className="p-2 bg-white rounded-full shadow-sm text-slate-400 hover:text-rose-500"><Trash2 size={14}/></button>
                        </div>
                     </div>
                  ))
               )}
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
                       <div className="col-span-2 flex flex-col items-center mb-4">
                          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                             <div className={`w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-xl flex items-center justify-center ${gender === 'F' ? 'bg-rose-100' : 'bg-blue-100'}`}>
                                {photoPreview ? (
                                   <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                   <UserIcon size={48} className={gender === 'F' ? 'text-rose-300' : 'text-blue-300'} />
                                )}
                             </div>
                             <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera className="text-white" />
                             </div>
                             <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} className="hidden" accept="image/*" />
                          </div>
                          
                          {photoPreview && (
                            <button 
                                type="button"
                                onClick={handleRemovePhoto}
                                className="mt-2 text-[10px] font-black text-rose-500 uppercase flex items-center hover:text-rose-700 hover:bg-rose-50 px-3 py-1 rounded-full transition-colors"
                            >
                                <Trash2 size={12} className="mr-1" /> Remover Foto
                            </button>
                          )}
                       </div>
                       
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
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Data de Admissão</label>
                          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-5 py-4 rounded-2xl border-2 font-bold text-slate-800" />
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

                       {scheduleType === '6x1' && (
                          <div className="space-y-6 animate-in fade-in">
                             <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Folga Fixa Semanal</label>
                                <div className="flex flex-wrap gap-2">
                                   {weekDays.slice(0, 6).map(day => (
                                      <button 
                                        key={day}
                                        type="button"
                                        onClick={() => setFixedDayOff(day)}
                                        className={`px-4 py-2 rounded-lg border-2 font-black text-[10px] uppercase transition-all ${fixedDayOff === day ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-slate-200 text-slate-400'}`}
                                      >
                                        {day.substring(0, 3)}
                                      </button>
                                   ))}
                                </div>
                             </div>
                             
                             <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Domingos de Folga (no mês)</label>
                                <div className="flex gap-2">
                                   {[1, 2, 3, 4, 5].map(n => (
                                      <button 
                                        key={n}
                                        type="button"
                                        onClick={() => setSundayOffs(prev => prev.includes(n) ? prev.filter(i => i !== n) : [...prev, n])}
                                        className={`w-10 h-10 rounded-xl border-2 font-black flex items-center justify-center transition-all ${sundayOffs.includes(n) ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200 text-slate-400'}`}
                                      >
                                        {n}º
                                      </button>
                                   ))}
                                </div>
                             </div>
                          </div>
                       )}

                       {scheduleType === '12x36' && (
                          <div className="animate-in fade-in">
                             <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Padrão do Turno</label>
                             <div className="flex gap-2">
                                <button type="button" onClick={() => setShiftType('Par')} className={`flex-1 py-3 rounded-xl border-2 font-black text-xs uppercase ${shiftType === 'Par' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-400'}`}>Dias Pares</button>
                                <button type="button" onClick={() => setShiftType('Ímpar')} className={`flex-1 py-3 rounded-xl border-2 font-black text-xs uppercase ${shiftType === 'Ímpar' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-400'}`}>Dias Ímpares</button>
                             </div>
                          </div>
                       )}

                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Horário de Trabalho</label>
                          <input type="text" value={workingHours} onChange={e => setWorkingHours(e.target.value)} className="w-full px-5 py-4 rounded-2xl border-2 font-bold text-slate-800" placeholder="Ex: 08:00 - 16:20" />
                       </div>

                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Status de Férias</label>
                          <div className="flex bg-slate-50 p-1 rounded-xl">
                             <button type="button" onClick={() => setVacationStatus('Pendente')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all ${vacationStatus === 'Pendente' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>Trabalhando</button>
                             <button type="button" onClick={() => setVacationStatus('Concedida')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all ${vacationStatus === 'Concedida' ? 'bg-amber-100 text-amber-600' : 'text-slate-400'}`}>Em Férias</button>
                          </div>
                       </div>
                    </div>
                 )}

                 {activeFormTab === 'UNIFORMES' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4">
                       <div className="flex items-end gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex-1">
                             <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block ml-1">Peça de Uniforme</label>
                             <input type="text" value={newUniformName} onChange={e => setNewUniformName(e.target.value)} placeholder="Ex: Camisa Social" className="w-full px-3 py-2 rounded-xl border-2 font-bold text-sm" />
                          </div>
                          <div className="w-20">
                             <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block ml-1">Qtd</label>
                             <input type="number" value={newUniformQty} onChange={e => setNewUniformQty(parseInt(e.target.value) || 1)} className="w-full px-3 py-2 rounded-xl border-2 font-bold text-sm text-center" />
                          </div>
                          <button type="button" onClick={handleAddUniform} className="bg-slate-800 text-white p-2.5 rounded-xl hover:bg-slate-700 transition-colors">
                             <Plus size={20} />
                          </button>
                       </div>

                       <div className="space-y-2">
                          {uniforms.length === 0 ? (
                             <div className="text-center py-8 text-slate-300 italic font-bold border-2 border-dashed border-slate-100 rounded-2xl">
                                Nenhum uniforme registrado.
                             </div>
                          ) : (
                             uniforms.map((u, idx) => (
                                <div key={idx} className="flex justify-between items-center p-4 bg-white border-2 border-slate-50 rounded-2xl shadow-sm">
                                   <div className="flex items-center space-x-3">
                                      <div className="p-2 bg-blue-50 text-blue-500 rounded-lg">
                                         <Shirt size={16} />
                                      </div>
                                      <div>
                                         <p className="font-black text-slate-800 text-sm leading-none">{u.name}</p>
                                         <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Quantidade: {u.quantity}</p>
                                      </div>
                                   </div>
                                   <button type="button" onClick={() => handleRemoveUniform(idx)} className="text-slate-300 hover:text-rose-500 p-2">
                                      <Trash2 size={16} />
                                   </button>
                                </div>
                             ))
                          )}
                       </div>
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

      {/* Modal EXTRA LABOR */}
      {isAddingExtra && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[400] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
              <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
                 <h2 className="text-xl font-black text-slate-800">{editingExtra ? 'Editar Profissional' : 'Novo Extra'}</h2>
                 <button onClick={resetExtraForm} className="text-slate-300 hover:text-slate-500"><X size={24}/></button>
              </div>
              <form onSubmit={handleSaveExtraSubmit} className="p-8 space-y-4">
                 <input type="text" value={extraName} onChange={e => setExtraName(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold" placeholder="Nome Completo" required />
                 <input type="text" value={extraPhone} onChange={e => setExtraPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold" placeholder="Telefone" />
                 
                 <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-1">Dias de Disponibilidade</label>
                    <div className="flex flex-wrap gap-2">
                       {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map(d => (
                          <button 
                             key={d}
                             type="button" 
                             onClick={() => {
                                if(extraAvailability.includes(d)) setExtraAvailability(extraAvailability.filter(x => x !== d));
                                else setExtraAvailability([...extraAvailability, d]);
                             }}
                             className={`px-3 py-2 rounded-lg text-[10px] font-black border uppercase transition-all ${extraAvailability.includes(d) ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-400'}`}
                          >
                             {d.substr(0, 3)}
                          </button>
                       ))}
                    </div>
                 </div>

                 <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-1">Avaliação de Serviço</label>
                    <div className="flex gap-2">
                       {[1, 2, 3, 4, 5].map(n => (
                          <button key={n} type="button" onClick={() => setExtraQuality(n)} className={`w-10 h-10 rounded-xl font-black border transition-all ${n <= extraQuality ? 'bg-emerald-400 border-emerald-400 text-white' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>{n}</button>
                       ))}
                    </div>
                 </div>

                 <textarea value={extraObservation} onChange={e => setExtraObservation(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold h-24" placeholder="Observações..." />
                 
                 <button type="submit" className="w-full py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 hover:brightness-110" style={{ backgroundColor: theme.primary }}>Salvar Profissional</button>
              </form>
           </div>
        </div>
      )}

      {/* MODAL CRACHÁ DIGITAL (BADGE) - MINIMALIST */}
      {selectedBadge && (
        <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-[300px] rounded-[1.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 relative print:shadow-none print:w-[300px] print:h-auto print:m-0 print:border-0">
              <button onClick={() => setSelectedBadge(null)} className="absolute top-3 right-3 p-1.5 bg-black/10 hover:bg-black/20 backdrop-blur rounded-full text-white transition-all print:hidden z-20"><X size={16}/></button>
              
              {/* Minimalist Header with Hotel Color */}
              <div className="h-28 w-full relative flex items-center justify-center" style={{ backgroundColor: theme.primary }}>
                 <div className="text-center text-white opacity-90">
                    <Briefcase size={24} className="mx-auto mb-1 opacity-50"/>
                    <p className="font-black tracking-[0.2em] text-[10px] uppercase">Crachá Digital</p>
                 </div>
              </div>

              {/* Content */}
              <div className="flex flex-col items-center -mt-14 px-6 pb-8 relative z-10">
                 {/* Photo */}
                 <div className="w-28 h-28 rounded-full border-[6px] border-white shadow-xl overflow-hidden bg-slate-100 mb-4 object-cover">
                    {selectedBadge.photo ? (
                       <img src={selectedBadge.photo} alt={selectedBadge.name} className="w-full h-full object-cover"/>
                    ) : (
                       <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400">
                          <UserIcon size={48}/>
                       </div>
                    )}
                 </div>
                 
                 {/* Info */}
                 <div className="text-center w-full mb-6 space-y-1">
                    <h3 className="text-xl font-black text-slate-900 leading-tight">{selectedBadge.name}</h3>
                    <div className="inline-block px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest" style={{ backgroundColor: theme.primary + '20', color: theme.primary }}>
                       {selectedBadge.role}
                    </div>
                 </div>

                 {/* QR Code */}
                 <div className="p-3 bg-white rounded-xl border-2 border-dashed border-slate-200">
                    <img 
                       src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${selectedBadge.id}`} 
                       alt="QR Code" 
                       className="w-24 h-24 mix-blend-multiply opacity-90"
                    />
                 </div>
              </div>
              
              {/* Print Button */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 print:hidden">
                 <button onClick={() => window.print()} className="w-full py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center space-x-2 shadow-lg text-white transition-transform active:scale-95" style={{ backgroundColor: theme.primary }}>
                    <Printer size={16}/> <span>Imprimir</span>
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL HISTÓRICO DO FUNCIONÁRIO */}
      {viewingHistoryEmployee && (
         <div className="fixed inset-0 bg-slate-900/60 z-[500] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-8">
               <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                  <div className="flex items-center space-x-4">
                     <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-500"><History size={24}/></div>
                     <div>
                        <h3 className="text-lg font-black text-slate-800">Histórico de Retiradas</h3>
                        <p className="text-xs font-bold text-slate-400">{viewingHistoryEmployee.name}</p>
                     </div>
                  </div>
                  <button onClick={() => setViewingHistoryEmployee(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"><X size={24}/></button>
               </div>
               
               <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {inventoryHistory.filter(h => h.recipientName === viewingHistoryEmployee.name || h.recipientId === viewingHistoryEmployee.id).length === 0 ? (
                     <div className="py-20 text-center">
                        <p className="text-slate-300 font-bold italic">Nenhum item retirado por este colaborador.</p>
                     </div>
                  ) : (
                     inventoryHistory
                        .filter(h => h.recipientName === viewingHistoryEmployee.name || h.recipientId === viewingHistoryEmployee.id)
                        .map(op => (
                           <div key={op.id} className="flex items-center justify-between p-4 bg-white border-2 border-slate-50 rounded-2xl">
                              <div className="flex items-center space-x-4">
                                 <div className={`p-3 rounded-xl ${op.type === 'Entrada' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                                    {op.type === 'Entrada' ? <ArrowUpRight size={20}/> : <ArrowDownRight size={20}/>}
                                 </div>
                                 <div>
                                    <p className="font-black text-slate-800 text-sm">{op.itemName}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(op.timestamp).toLocaleString()}</p>
                                 </div>
                              </div>
                              <div className="text-right">
                                 <span className="text-lg font-black text-slate-800">{op.quantity}</span>
                                 <span className="text-[10px] font-bold text-slate-400 uppercase block">Unidades</span>
                              </div>
                           </div>
                        ))
                  )}
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default EmployeesView;
