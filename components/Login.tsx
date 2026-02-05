
import React, { useState, useEffect } from 'react';
import { UserRole, HotelType, User, Sector, Employee } from '../types';
import { Hotel, User as UserIcon, Lock, ChevronRight, AlertCircle, Building2, Briefcase, Eye, EyeOff, Users } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
  onFetchHotelData: (hotel: HotelType) => Promise<any>;
}

const Login: React.FC<LoginProps> = ({ onLogin, onFetchHotelData }) => {
  const [accessType, setAccessType] = useState<'ADMIN' | 'EMPLOYEE' | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [hotel, setHotel] = useState<HotelType | ''>('');
  const [selectedSectorId, setSelectedSectorId] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [availableSectors, setAvailableSectors] = useState<Sector[]>([]);
  const [availableEmployees, setAvailableEmployees] = useState<Employee[]>([]);

  const hotels: { id: HotelType; label: string }[] = [
    { id: 'VILLAGE', label: 'Village Inn' },
    { id: 'GOLDEN_PARK', label: 'Hotel Golden Park' },
    { id: 'THERMAL_RESORT', label: 'Thermas Resort' },
  ];

  const handleFetchData = async (h: HotelType) => {
    setIsLoading(true);
    setError('');
    setSelectedSectorId('');
    setSelectedEmployeeId('');
    setPassword('');
    
    try {
      const data = await onFetchHotelData(h);
      if (data) {
        setAvailableSectors(data.sectors || []);
        setAvailableEmployees(data.employees || []);
      }
    } catch (err) {
      setError('Erro ao carregar dados do hotel. Verifique a conexão.');
    } finally {
      setIsLoading(false);
    }
  };

  const normalizeString = (str: string) => {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  };

  const handleEnter = () => {
    setError('');
    
    if (accessType === 'ADMIN') {
      if (!role) return;
      if (role === 'GERENCIA') {
        if (!hotel) { setError('Selecione uma unidade'); return; }
        if (password === '123') onLogin({ role, hotel });
        else setError('Senha incorreta para Supervisão');
      } else if (role === 'DIRETORIA') {
        if (password === '0000') onLogin({ role });
        else setError('Senha incorreta para Diretoria');
      }
    } else if (accessType === 'EMPLOYEE') {
      if (!hotel || !selectedSectorId || !selectedEmployeeId) {
        setError('Preencha todos os campos para entrar');
        return;
      }

      const employee = availableEmployees.find(e => e.id.toString() === selectedEmployeeId.toString());
      const sector = availableSectors.find(s => s.id.toString() === selectedSectorId.toString());

      if (employee && sector) {
        const firstName = normalizeString(employee.name.split(' ')[0]);
        
        let regYear = '2024';
        if (employee.startDate) {
          const dateStr = employee.startDate.toString();
          if (dateStr.includes('-')) {
            regYear = dateStr.split('-')[0];
          } else if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            regYear = parts[parts.length - 1];
          }
        }

        const expectedPassword = firstName + regYear;

        if (normalizeString(password) === expectedPassword) {
          onLogin({ 
            role: 'FUNCIONARIO', 
            hotel: hotel as HotelType, 
            name: employee.name, 
            sectorId: selectedSectorId,
            sectorName: sector.name
          });
        } else {
          setError(`Senha incorreta. Dica: seu primeiro nome + ano de registro (${regYear})`);
        }
      }
    }
  };

  const getThemeColor = () => {
    if (hotel === 'VILLAGE') return '#26A6A6';
    if (hotel === 'GOLDEN_PARK') return '#BF984E';
    if (hotel === 'THERMAL_RESORT') return '#68A672';
    return '#1e293b';
  };

  // Comparação flexível para evitar problemas com string vs number do Sheets
  const filteredEmployees = availableEmployees.filter(e => e.sectorId.toString() === selectedSectorId.toString());

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500">
        <div className="p-10 space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-black text-slate-800 tracking-tighter">Nacional Inn</h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em]">Gestão Hotel Village</p>
          </div>

          {!accessType ? (
            <div className="space-y-4">
              <p className="text-sm font-bold text-slate-500 text-center mb-6">Selecione o tipo de acesso</p>
              <button 
                onClick={() => setAccessType('EMPLOYEE')}
                className="w-full flex items-center justify-between p-6 bg-slate-50 hover:bg-emerald-50 border-2 border-transparent hover:border-emerald-200 rounded-3xl transition-all group"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-white rounded-2xl text-emerald-500 shadow-sm"><Users size={24} /></div>
                  <div className="text-left">
                    <p className="font-black text-slate-800">Colaborador</p>
                    <p className="text-xs text-slate-400 font-medium">Equipe Operacional</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-slate-300 group-hover:text-emerald-500" />
              </button>

              <button 
                onClick={() => setAccessType('ADMIN')}
                className="w-full flex items-center justify-between p-6 bg-slate-50 hover:bg-slate-900 hover:text-white border-2 border-transparent hover:border-slate-800 rounded-3xl transition-all group"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-white group-hover:bg-slate-800 rounded-2xl text-slate-800 group-hover:text-white shadow-sm transition-colors"><Lock size={24} /></div>
                  <div className="text-left">
                    <p className="font-black group-hover:text-white text-slate-800">Administrativo</p>
                    <p className="text-xs text-slate-400 group-hover:text-slate-400 font-medium">Gestão & Diretoria</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-slate-300 group-hover:text-white" />
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <button 
                onClick={() => { setAccessType(null); setRole(null); setError(''); setHotel(''); setPassword(''); setSelectedEmployeeId(''); setSelectedSectorId(''); }}
                className="text-xs font-black text-blue-500 hover:underline flex items-center"
              >
                <ChevronRight size={14} className="rotate-180 mr-1" /> Voltar
              </button>

              <div className="space-y-4">
                {(accessType === 'EMPLOYEE' || (accessType === 'ADMIN' && role === 'GERENCIA')) && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center"><Building2 size={12} className="mr-1"/> Unidade</label>
                    <div className="grid grid-cols-1 gap-2">
                      {hotels.map(h => (
                        <button 
                          key={h.id}
                          onClick={() => { setHotel(h.id); handleFetchData(h.id); }}
                          className={`p-4 rounded-2xl border-2 text-sm font-bold transition-all text-left ${
                            hotel === h.id ? 'border-slate-800 bg-slate-800 text-white shadow-md' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {h.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {accessType === 'ADMIN' && !role && (
                  <div className="grid grid-cols-1 gap-2 animate-in fade-in">
                    <button onClick={() => setRole('GERENCIA')} className="p-5 rounded-2xl border-2 border-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-50">Supervisão / Gerência</button>
                    <button onClick={() => setRole('DIRETORIA')} className="p-5 rounded-2xl border-2 border-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-50">Diretoria Nacional Inn</button>
                  </div>
                )}

                {accessType === 'EMPLOYEE' && hotel && (
                  <div className="space-y-4 animate-in slide-in-from-top-2">
                    {isLoading ? (
                      <div className="flex flex-col items-center py-8">
                        <div className="w-8 h-8 border-4 border-slate-100 border-t-blue-500 rounded-full animate-spin"></div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-4 tracking-widest">Sincronizando...</p>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center"><Briefcase size={12} className="mr-1"/> Setor</label>
                          <select 
                            value={selectedSectorId} 
                            onChange={(e) => { setSelectedSectorId(e.target.value); setSelectedEmployeeId(''); setPassword(''); }}
                            className="w-full p-4 rounded-2xl border-2 border-slate-100 font-bold text-slate-800 outline-none focus:border-blue-400"
                          >
                            <option value="">Selecione o setor...</option>
                            {availableSectors.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                        
                        {selectedSectorId && (
                          <div className="animate-in slide-in-from-top-2 space-y-4">
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center"><UserIcon size={12} className="mr-1"/> Colaborador</label>
                              <select 
                                value={selectedEmployeeId} 
                                onChange={(e) => { setSelectedEmployeeId(e.target.value); setPassword(''); }}
                                className="w-full p-4 rounded-2xl border-2 border-slate-100 font-bold text-slate-800 outline-none focus:border-blue-400"
                              >
                                <option value="">Quem está acessando?</option>
                                {filteredEmployees.map(e => (
                                  <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                              </select>
                            </div>

                            {selectedEmployeeId && (
                              <div className="animate-in slide-in-from-top-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center"><Lock size={12} className="mr-1"/> Senha de Acesso</label>
                                <div className="relative">
                                  <input 
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Senha (nome+ano)"
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-400 outline-none transition-all font-bold text-slate-900"
                                  />
                                  <button 
                                    type="button" 
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                                  >
                                    {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {accessType === 'ADMIN' && role && (
                  <div className="animate-in slide-in-from-top-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center"><Lock size={12} className="mr-1"/> Senha de {role}</label>
                    <input 
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(''); }}
                      className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-400 outline-none transition-all font-bold tracking-widest text-slate-900"
                    />
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-50 text-red-500 rounded-2xl flex items-center space-x-3 text-xs font-bold border border-red-100 animate-shake">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button 
                  onClick={handleEnter}
                  disabled={isLoading || (accessType === 'EMPLOYEE' && !selectedEmployeeId)}
                  className="w-full py-5 rounded-[1.5rem] font-black text-white shadow-xl transition-all active:scale-95 hover:brightness-110 disabled:opacity-50"
                  style={{ backgroundColor: getThemeColor() }}
                >
                  {isLoading ? 'Aguarde...' : 'Entrar no Sistema'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
