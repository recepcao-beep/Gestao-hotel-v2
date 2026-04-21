
import React, { useState } from 'react';
import { UserRole, HotelType, User } from '../types';
import { Building2, Lock, ChevronRight, AlertCircle, Users, CheckCircle2, User as UserIcon } from 'lucide-react';
import Logo from './Logo';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";

interface LoginProps {
  onLogin: (user: User) => void;
  onFetchHotelData: (hotel: HotelType) => Promise<any>;
  onGoogleLogin: (email: string, name: string, hotel: HotelType) => Promise<{success: boolean, message?: string}>;
}

const Login: React.FC<LoginProps> = ({ onLogin, onFetchHotelData, onGoogleLogin }) => {
  const [accessType, setAccessType] = useState<'GESTOR' | 'FUNCIONARIO' | null>(null);
  const [selectedHotel, setSelectedHotel] = useState<HotelType | ''>('');
  const [userName, setUserName] = useState('');
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
        onLogin({ id: 'gestor-admin', name: 'Gestor Admin', role: 'GESTOR' });
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
      if (!userName || !password) {
        setError('Por favor, informe seu nome e senha');
        setIsLoading(false);
        return;
      }
      
      try {
        const hotelData = await onFetchHotelData(selectedHotel as HotelType);
        console.log("Hotel Data received:", hotelData);
        if (hotelData && hotelData.users && hotelData.users.length > 0) {
          const user = hotelData.users.find((u: any) => {
            const nameMatch = u.name?.toString().toLowerCase().trim() === userName.toLowerCase().trim();
            const passMatch = u.password?.toString().trim() === password.trim();
            console.log(`Checking user: ${u.name} against ${userName}. Name match: ${nameMatch}, Pass match: ${passMatch}`);
            return nameMatch && passMatch;
          });
          if (user) {
            onLogin({ ...user, hotel: selectedHotel as HotelType });
          } else {
            setError('Usuário ou senha incorretos');
          }
        } else {
          setError('Nenhum usuário cadastrado nesta unidade. Crie um usuário na aba Configurações > Usuários.');
        }
      } catch (err) {
        console.error("Login Error:", err);
        setError('Erro ao conectar com o servidor');
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500">
        <div className="p-10 space-y-8">
          <div className="flex flex-col items-center space-y-2">
            <Logo className="h-16" />
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em]">Ambiente de Gestão Unificado</p>
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
                    <p className="text-xs text-slate-400 font-medium">Acesso com Nome e Senha</p>
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
                    <p className="font-black group-hover:text-white text-slate-800">Administrador Geral</p>
                    <p className="text-xs text-slate-400 group-hover:text-slate-400 font-medium">Acesso Master</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-slate-300 group-hover:text-white" />
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <button 
                onClick={() => { setAccessType(null); setSelectedHotel(''); setUserName(''); setPassword(''); setError(''); }}
                className="text-xs font-black text-blue-500 hover:underline flex items-center"
              >
                <ChevronRight size={14} className="rotate-180 mr-1" /> Voltar
              </button>

              <div className="space-y-6">
                {accessType === 'FUNCIONARIO' && (
                  <>
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

                    {selectedHotel && (
                      <div className="space-y-4 animate-in slide-in-from-top-2 flex flex-col items-center justify-center pt-4">
                        <p className="text-xs font-bold text-slate-400 text-center mb-2">Faça login com sua conta Google para acessar o sistema.</p>
                        <GoogleLogin
                          onSuccess={async (credentialResponse) => {
                            setIsLoading(true);
                            setError('');
                            try {
                              const decoded: any = jwtDecode(credentialResponse.credential!);
                              const result = await onGoogleLogin(decoded.email, decoded.name, selectedHotel as HotelType);
                              if (!result.success) {
                                setError(result.message || 'Erro ao realizar login');
                              }
                            } catch (err) {
                              console.error(err);
                              setError('Erro ao processar login com o Google');
                            }
                            setIsLoading(false);
                          }}
                          onError={() => {
                            setError('Falha ao conectar com o Google');
                          }}
                          theme="filled_blue"
                          shape="pill"
                        />
                      </div>
                    )}
                  </>
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

                {accessType === 'GESTOR' && (
                  <button 
                    onClick={handleEnter}
                    disabled={isLoading}
                    className="w-full py-5 rounded-[2rem] font-black text-white shadow-xl transition-all active:scale-95 hover:brightness-110 disabled:opacity-50 bg-slate-900"
                  >
                    {isLoading ? 'Acessando...' : 'Entrar no Sistema'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
