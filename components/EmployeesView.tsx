
import React, { useState, useMemo } from 'react';
import { Employee, HotelTheme, Sector, UniformItem } from '../types';
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
  Layers,
  ChevronLeft,
  Shirt,
  Edit2,
  Package,
  Info
} from 'lucide-react';

interface EmployeesViewProps {
  employees: Employee[];
  sectors: Sector[];
  selectedSectorId: string | null;
  onSelectSector: (id: string | null) => void;
  theme: HotelTheme;
  onSave: (employee: Employee) => void;
  onDelete: (id: string) => void;
  onSaveSector: (sector: Sector) => void;
  onDeleteSector: (id: string) => void;
}

const EmployeesView: React.FC<EmployeesViewProps> = ({ 
  employees, 
  sectors, 
  selectedSectorId, 
  onSelectSector, 
  theme, 
  onSave, 
  onDelete, 
  onSaveSector, 
  onDeleteSector 
}) => {
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isAddingSector, setIsAddingSector] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'DADOS' | 'UNIFORMES'>('DADOS');

  // Form State Employee
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [contact, setContact] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [salary, setSalary] = useState('');
  const [uniforms, setUniforms] = useState<UniformItem[]>([]);
  const [scheduleType, setScheduleType] = useState<'6x1' | '12x36' | 'Intermitente'>('6x1');
  const [shiftType, setShiftType] = useState<'Par' | 'Ímpar'>('Par');
  const [workingHours, setWorkingHours] = useState('08:00 - 16:20');
  const [weeklyDayOff, setWeeklyDayOff] = useState('Segunda-feira');
  const [monthlySundayOff, setMonthlySundayOff] = useState('1º Domingo');
  const [vacationStatus, setVacationStatus] = useState<'Pendente' | 'Concedida'>('Pendente');

  // Form State Sector
  const [sectorName, setSectorName] = useState('');
  const [standardUniforms, setStandardUniforms] = useState<UniformItem[]>([]);

  const resetEmployeeForm = () => {
    setName('');
    setRole('');
    setContact('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setSalary('');
    setUniforms([]);
    setScheduleType('6x1');
    setShiftType('Par');
    setWorkingHours('08:00 - 16:20');
    setWeeklyDayOff('Segunda-feira');
    setMonthlySundayOff('1º Domingo');
    setVacationStatus('Pendente');
    setIsAddingEmployee(false);
    setEditingEmployee(null);
    setActiveTab('DADOS');
  };

  const resetSectorForm = () => {
    setSectorName('');
    setStandardUniforms([]);
    setIsAddingSector(false);
    setEditingSector(null);
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setName(emp.name);
    setRole(emp.role);
    setContact(emp.contact);
    setStartDate(emp.startDate);
    setSalary(emp.salary.toString());
    setUniforms(emp.uniforms || []);
    setScheduleType(emp.scheduleType);
    setShiftType(emp.shiftType || 'Par');
    setWorkingHours(emp.workingHours);
    setWeeklyDayOff(emp.weeklyDayOff);
    setMonthlySundayOff(emp.monthlySundayOff);
    setVacationStatus(emp.vacationStatus);
    setIsAddingEmployee(true);
  };

  const handleEditSector = (e: React.MouseEvent, sec: Sector) => {
    e.stopPropagation();
    setEditingSector(sec);
    setSectorName(sec.name);
    setStandardUniforms(sec.standardUniform || []);
    setIsAddingSector(true);
  };

  const handleSaveEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name && !role) { // Non-mandatory logic
       // alert("Pelo menos o nome ou cargo deve ser informado.");
    }

    const newEmp: Employee = {
      id: editingEmployee?.id || Date.now().toString(),
      name: name || 'Funcionário sem Nome',
      role: role || 'Cargo não informado',
      contact,
      startDate,
      salary: parseFloat(salary) || 0,
      department: sectors.find(s => s.id === selectedSectorId)?.name || '',
      sectorId: selectedSectorId!,
      status: 'Ativo',
      scheduleType,
      shiftType: scheduleType === '12x36' ? shiftType : undefined,
      workingHours,
      weeklyDayOff,
      monthlySundayOff,
      vacationStatus,
      uniforms
    };

    onSave(newEmp);
    resetEmployeeForm();
  };

  const handleSaveSectorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectorName) return;

    const newSec: Sector = {
      id: editingSector?.id || Date.now().toString(),
      name: sectorName,
      standardUniform: standardUniforms
    };

    onSaveSector(newSec);
    resetSectorForm();
  };

  const addUniformItem = (type: 'STANDARD' | 'EMPLOYEE') => {
    if (type === 'STANDARD') {
      setStandardUniforms([...standardUniforms, { name: '', quantity: 1 }]);
    } else {
      setUniforms([...uniforms, { name: '', quantity: 1 }]);
    }
  };

  const updateUniformItem = (type: 'STANDARD' | 'EMPLOYEE', idx: number, field: keyof UniformItem, val: any) => {
    if (type === 'STANDARD') {
      const next = [...standardUniforms];
      next[idx] = { ...next[idx], [field]: val };
      setStandardUniforms(next);
    } else {
      const next = [...uniforms];
      next[idx] = { ...next[idx], [field]: val };
      setUniforms(next);
    }
  };

  const removeUniformItem = (type: 'STANDARD' | 'EMPLOYEE', idx: number) => {
    if (type === 'STANDARD') {
      setStandardUniforms(standardUniforms.filter((_, i) => i !== idx));
    } else {
      setUniforms(uniforms.filter((_, i) => i !== idx));
    }
  };

  const filteredEmployees = employees.filter(e => e.sectorId === selectedSectorId && e.name.toLowerCase().includes(searchTerm.toLowerCase()));
  
  const currentSector = sectors.find(s => s.id === selectedSectorId);

  const calculateDiscrepancy = (emp: Employee, sec: Sector) => {
    return (sec.standardUniform || []).map(std => {
      const has = (emp.uniforms || []).find(u => u.name.toLowerCase().trim() === std.name.toLowerCase().trim());
      const missing = Math.max(0, std.quantity - (has?.quantity || 0));
      return { name: std.name, needed: std.quantity, has: has?.quantity || 0, missing };
    }).filter(d => d.missing > 0);
  };

  if (!selectedSectorId) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Escolha o setor para gerenciar</p>
          <button 
            onClick={() => setIsAddingSector(true)}
            className="text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center space-x-2 shadow-lg transition-all active:scale-95"
            style={{ backgroundColor: theme.primary }}
          >
            <Plus size={18} />
            <span>Novo Setor</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {sectors.map((sec) => (
            <button
              key={sec.id}
              onClick={() => onSelectSector(sec.id)}
              className="group relative bg-white h-48 md:h-72 rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col items-center justify-center border border-slate-50 overflow-hidden transform active:scale-95 md:hover:-translate-y-2"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 transition-all duration-500" style={{ backgroundColor: theme.primary }}></div>
              <div 
                className="p-5 md:p-8 rounded-2xl md:rounded-3xl mb-3 md:mb-6 group-hover:scale-110 transition-transform duration-500"
                style={{ backgroundColor: theme.primary + '10', color: theme.primary }}
              >
                <Building2 size={32} strokeWidth={1.5} className="md:w-14 md:h-14" />
              </div>
              <div className="text-center">
                <h3 className="text-xl md:text-3xl font-black text-slate-800">{sec.name}</h3>
                <p className="text-slate-400 mt-1 font-black uppercase tracking-[0.2em] text-[8px] md:text-[10px]">
                  {employees.filter(e => e.sectorId === sec.id).length} Colaboradores
                </p>
              </div>
              
              <div className="absolute top-4 right-4 flex space-x-2">
                <button 
                  onClick={(e) => handleEditSector(e, sec)}
                  className="p-2 bg-white/80 text-slate-400 hover:text-blue-500 rounded-full transition-colors border shadow-sm"
                >
                  <Edit2 size={14} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDeleteSector(sec.id); }}
                  className="p-2 bg-white/80 text-slate-400 hover:text-red-500 rounded-full transition-colors border shadow-sm"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </button>
          ))}
          {sectors.length === 0 && (
            <div className="col-span-full py-20 text-center text-slate-300 italic font-bold">Nenhum setor cadastrado.</div>
          )}
        </div>

        {isAddingSector && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-200 overflow-hidden">
               <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                  <h2 className="text-xl font-black text-slate-800">{editingSector ? 'Editar Setor' : 'Novo Setor'}</h2>
                  <button onClick={resetSectorForm} className="text-slate-300 hover:text-slate-500"><X size={24}/></button>
               </div>
               <form onSubmit={handleSaveSectorSubmit} className="p-8 space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Nome do Setor</label>
                    <input type="text" value={sectorName} onChange={e => setSectorName(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 focus:border-blue-400 outline-none font-bold text-slate-800 bg-white" placeholder="Ex: Recepção" />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Enxoval de Uniforme Padrão</label>
                      <button type="button" onClick={() => addUniformItem('STANDARD')} className="text-[8px] font-black text-emerald-600 uppercase">+ Adicionar Peça</button>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                       {standardUniforms.map((item, idx) => (
                         <div key={idx} className="flex gap-2 animate-in slide-in-from-left-2">
                           <input type="text" placeholder="Peça" value={item.name} onChange={e => updateUniformItem('STANDARD', idx, 'name', e.target.value)} className="flex-1 px-3 py-2 rounded-lg border bg-white text-[10px] font-bold" />
                           <input type="number" placeholder="Qtd" value={item.quantity} onChange={e => updateUniformItem('STANDARD', idx, 'quantity', parseInt(e.target.value))} className="w-16 px-3 py-2 rounded-lg border bg-white text-[10px] font-bold" />
                           <button type="button" onClick={() => removeUniformItem('STANDARD', idx)} className="text-rose-300 hover:text-rose-500"><Trash2 size={14}/></button>
                         </div>
                       ))}
                       {standardUniforms.length === 0 && <p className="text-[9px] text-slate-300 text-center py-4 italic border-2 border-dashed rounded-xl">Defina as peças que o funcionário deste setor deve ter.</p>}
                    </div>
                  </div>
                  <button type="submit" className="w-full py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all" style={{ backgroundColor: theme.primary }}>Salvar Configuração de Setor</button>
               </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex items-center space-x-3">
          <button onClick={() => onSelectSector(null)} className="p-2 bg-white rounded-xl shadow-sm text-slate-400 hover:text-slate-600 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-black text-slate-800">{currentSector?.name}</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase">{filteredEmployees.length} Colaboradores registrados</p>
          </div>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <input 
              type="text"
              placeholder="Buscar por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-100 focus:border-blue-500 outline-none shadow-sm transition-all text-sm font-bold bg-white"
            />
          </div>
          <button 
            onClick={() => setIsAddingEmployee(true)}
            className="text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center space-x-2 shadow-lg transition-all active:scale-95"
            style={{ backgroundColor: theme.primary }}
          >
            <UserPlus size={18} />
            <span className="hidden sm:inline">Adicionar Funcionário</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredEmployees.map(emp => {
          const discrepancies = currentSector ? calculateDiscrepancy(emp, currentSector) : [];
          return (
            <div key={emp.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 flex flex-col md:flex-row gap-6 hover:shadow-md transition-all">
              <div className="flex items-center space-x-4 min-w-[200px]">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-lg" style={{ backgroundColor: theme.primary }}>
                  {(emp.name || "U")[0]}
                </div>
                <div>
                  <h4 className="font-black text-slate-800 leading-tight">{emp.name}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{emp.role}</p>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 border-t md:border-t-0 md:border-l border-slate-50 pt-4 md:pt-0 md:pl-6">
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Horário & Escala</p>
                  <div className="flex items-center text-xs font-black text-slate-900">
                    <Clock size={12} className="mr-1.5 text-slate-300" />
                    {emp.scheduleType} {emp.shiftType && `(${emp.shiftType})`}
                  </div>
                  <div className="flex items-center text-[10px] font-bold text-slate-500 mt-1">{emp.workingHours}</div>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Uniformes Possuídos</p>
                  <div className="flex items-center text-xs font-bold text-slate-700">
                    <Shirt size={12} className="mr-1.5 text-slate-300" />
                    {emp.uniforms?.reduce((acc, u) => acc + u.quantity, 0) || 0} Peças no total
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Necessidade de Uniforme</p>
                  {discrepancies.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {discrepancies.map((d, di) => (
                        <div key={di} className="px-2 py-0.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg text-[8px] font-black uppercase flex items-center">
                          <AlertTriangle size={8} className="mr-1" /> Faltam {d.missing} {d.name}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center text-emerald-500 text-[9px] font-black uppercase">
                      <CheckCircle2 size={12} className="mr-1.5" /> Enxoval Completo
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2">
                <button onClick={() => handleEditEmployee(emp)} className="p-3 text-slate-300 hover:text-blue-500 transition-colors bg-slate-50 rounded-xl">
                  <Edit2 size={20} />
                </button>
                <button onClick={() => onDelete(emp.id)} className="p-3 text-slate-300 hover:text-rose-500 transition-colors bg-slate-50 rounded-xl">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          );
        })}
        {filteredEmployees.length === 0 && (
          <div className="bg-white p-20 rounded-[3rem] border border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300">
             <Package size={64} className="mb-4 opacity-10" />
             <p className="text-xl font-black italic uppercase tracking-tighter">Nenhum funcionário cadastrado aqui</p>
          </div>
        )}
      </div>

      {isAddingEmployee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in duration-200">
             <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">{editingEmployee ? 'Editar Cadastro' : 'Novo Cadastro'}</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Setor: {currentSector?.name}</p>
                </div>
                <button onClick={resetEmployeeForm} className="text-slate-300 hover:text-slate-500"><X size={24}/></button>
             </div>

             <div className="flex bg-slate-50 p-2 mx-8 mt-6 rounded-2xl border border-slate-100">
                <button onClick={() => setActiveTab('DADOS')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'DADOS' ? 'bg-white shadow-md text-blue-600' : 'text-slate-400'}`}>Dados & Escala</button>
                <button onClick={() => setActiveTab('UNIFORMES')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'UNIFORMES' ? 'bg-white shadow-md text-blue-600' : 'text-slate-400'}`}>Uniforme (O que possui)</button>
             </div>

             <form onSubmit={handleSaveEmployeeSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
                {activeTab === 'DADOS' ? (
                  <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="col-span-1 md:col-span-2">
                        <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5 ml-1">Nome Completo</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 focus:border-blue-400 outline-none bg-white font-bold text-slate-900" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5 ml-1">Cargo</label>
                        <input type="text" value={role} onChange={e => setRole(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 focus:border-blue-400 outline-none bg-white font-bold text-slate-900" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5 ml-1">Data de Admissão</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 focus:border-blue-400 outline-none bg-white font-bold text-slate-900" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5 ml-1">Salário Base (R$)</label>
                        <input type="number" step="0.01" value={salary} onChange={e => setSalary(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 focus:border-blue-400 outline-none bg-white font-bold text-slate-900" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5 ml-1">Tipo de Escala</label>
                        <select value={scheduleType} onChange={e => setScheduleType(e.target.value as any)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 bg-white font-bold text-slate-800 outline-none">
                          <option value="6x1">6x1</option>
                          <option value="12x36">12x36</option>
                          <option value="Intermitente">Intermitente</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100">
                       <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-widest flex items-center mb-4">
                         <Package size={14} className="mr-2" /> Peças em posse do funcionário:
                       </h4>
                       <div className="space-y-3">
                          {uniforms.map((u, ui) => (
                            <div key={ui} className="flex gap-2 animate-in slide-in-from-left-2">
                              <input type="text" placeholder="Nome da Peça (Ex: Camisa G)" value={u.name} onChange={e => updateUniformItem('EMPLOYEE', ui, 'name', e.target.value)} className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white text-xs font-bold" />
                              <input type="number" placeholder="Qtd" value={u.quantity} onChange={e => updateUniformItem('EMPLOYEE', ui, 'quantity', parseInt(e.target.value))} className="w-20 px-4 py-3 rounded-xl border border-slate-200 bg-white text-xs font-bold" />
                              <button type="button" onClick={() => removeUniformItem('EMPLOYEE', ui)} className="text-rose-300 hover:text-rose-500"><Trash2 size={18}/></button>
                            </div>
                          ))}
                          <button type="button" onClick={() => addUniformItem('EMPLOYEE')} className="w-full py-3 border-2 border-dashed border-blue-200 rounded-xl text-blue-400 text-[10px] font-black uppercase hover:bg-white transition-all">+ Adicionar Peça Recebida</button>
                       </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center mb-4">
                         <Info size={14} className="mr-2" /> Enxoval Obrigatório do Setor:
                       </h4>
                       <div className="flex flex-wrap gap-2">
                          {currentSector?.standardUniform?.map((std, si) => (
                            <div key={si} className="bg-white px-3 py-1.5 rounded-lg border border-slate-100 text-[10px] font-bold text-slate-600">
                              {std.quantity}x {std.name}
                            </div>
                          ))}
                          {(!currentSector?.standardUniform || currentSector?.standardUniform.length === 0) && (
                            <p className="text-[9px] text-slate-300 italic">Nenhum enxoval padrão configurado.</p>
                          )}
                       </div>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-4 pt-4">
                   <button type="button" onClick={resetEmployeeForm} className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Cancelar</button>
                   <button type="submit" className="flex-1 py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all" style={{ backgroundColor: theme.primary }}>
                     {editingEmployee ? 'Atualizar Cadastro' : 'Salvar Cadastro'}
                   </button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeesView;
