
import React, { useState } from 'react';
import { UserRole, HotelType, User } from '../types';
import { Building2, Lock, ChevronRight, AlertCircle, Users, CheckCircle2 } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
  onFetchHotelData: (hotel: HotelType) => Promise<any>;
}

const Login: React.FC<LoginProps> = ({ onLogin, onFetchHotelData }) => {
  const [accessType, setAccessType] = useState<'GESTOR' | 'FUNCIONARIO' | null>(null);
  const [selectedHotel, setSelectedHotel] = useState<HotelType | ''>('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const hotels: { id: HotelType; label: string }[] = [
    { id: 'VILLAGE', label: 'Village Inn' },
    { id: 'GOLDEN_PARK', label: 'Hotel Golden Park' },
    { id: 'THERMAL_RESORT', label: 'Thermas Resort' },
  ];

  const handleEnter = async () => {
    setError('');
    setIsLoading(true);

    if (accessType === 'GESTOR') {
      if (password === '0000') {
        onLogin({ role: 'GESTOR' });
      } else {
        setError('Senha de Gestor incorreta');
        setIsLoading(false);
      }
      return;
    }

    if (accessType === 'FUNCIONARIO') {
      if (!selectedHotel) {
        setError('Por favor, selecione sua unidade');
        setIsLoading(false);
        return;
      }
      // Para funcionário, o acesso é direto após selecionar o hotel
      onLogin({ role: 'FUNCIONARIO', hotel: selectedHotel as HotelType, name: 'Colaborador' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500">
        <div className="p-10 space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-black text-slate-800 tracking-tighter">Nacional Inn</h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em]">Gestão Hotel Village</p>
          </div>

          {!accessType ? (
            <div className="space-y-4">
              <p className="text-sm font-bold text-slate-500 text-center mb-6">Selecione o seu perfil</p>
              
              <button 
                onClick={() => setAccessType('FUNCIONARIO')}
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
                onClick={() => setAccessType('GESTOR')}
                className="w-full flex items-center justify-between p-6 bg-slate-50 hover:bg-slate-900 hover:text-white border-2 border-transparent hover:border-slate-800 rounded-3xl transition-all group"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-white group-hover:bg-slate-800 rounded-2xl text-slate-800 group-hover:text-white shadow-sm transition-colors"><Lock size={24} /></div>
                  <div className="text-left">
                    <p className="font-black group-hover:text-white text-slate-800">Gestor</p>
                    <p className="text-xs text-slate-400 group-hover:text-slate-400 font-medium">Administrativo</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-slate-300 group-hover:text-white" />
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <button 
                onClick={() => { setAccessType(null); setSelectedHotel(''); setPassword(''); setError(''); }}
                className="text-xs font-black text-blue-500 hover:underline flex items-center"
              >
                <ChevronRight size={14} className="rotate-180 mr-1" /> Voltar
              </button>

              <div className="space-y-6">
                {accessType === 'FUNCIONARIO' && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center"><Building2 size={12} className="mr-1"/> Selecione sua Unidade</label>
                    <div className="grid grid-cols-1 gap-3">
                      {hotels.map(h => (
                        <button 
                          key={h.id}
                          onClick={() => setSelectedHotel(h.id)}
                          className={`p-5 rounded-3xl border-2 text-sm font-bold transition-all text-left flex items-center justify-between ${
                            selectedHotel === h.id 
                            ? 'border-emerald-500 bg-emerald-500 text-white shadow-lg' 
                            : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          <span>{h.label}</span>
                          {selectedHotel === h.id && <CheckCircle2 size={18} />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {accessType === 'GESTOR' && (
                  <div className="space-y-4 animate-in slide-in-from-top-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center"><Lock size={12} className="mr-1"/> Senha de Gestor</label>
                    <input 
                      type="password"
                      placeholder="••••"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(''); }}
                      className="w-full px-4 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:border-slate-800 outline-none transition-all font-black text-center text-2xl tracking-[0.5em] text-slate-900"
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
                  disabled={isLoading}
                  className={`w-full py-5 rounded-[2rem] font-black text-white shadow-xl transition-all active:scale-95 hover:brightness-110 disabled:opacity-50 ${
                    accessType === 'GESTOR' ? 'bg-slate-900' : 'bg-emerald-500'
                  }`}
                >
                  {isLoading ? 'Acessando...' : 'Entrar no Sistema'}
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
