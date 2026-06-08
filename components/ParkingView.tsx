import React, { useState, useEffect } from 'react';
import { HotelTheme, Vehicle, VehicleHistory, ParkingLocation, User as AppUser } from '../types';
import { compressImage } from '../utils/imageUtils';
import { Car, LayoutDashboard, History, Plus, Search, MapPin, Calendar, User, CreditCard, CheckCircle2, AlertTriangle, X, KeySquare, Palette, Edit, LogOut, Trash2, DollarSign, Camera, Image as ImageIcon, Settings } from 'lucide-react';

interface ParkingViewProps {
  theme: HotelTheme;
  parkingLocations?: ParkingLocation[];
  vehicles: Vehicle[];
  currentUser: AppUser | null;
  onSaveVehicle: (vehicle: Vehicle, newFiles?: any[]) => void;
  onDeleteVehicle: (id: string) => void;
  onCheckoutVehicle: (id: string, history?: any[]) => void;
  onSaveParkingLocation?: (location: ParkingLocation) => void;
  onDeleteParkingLocation?: (id: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const MOCK_VEHICLES: Vehicle[] = [
  {
    id: '1',
    guest_name: 'CLAUDINEI',
    plate: 'DIF6159',
    identifier: '420',
    location: 'Vaga 12',
    check_out_date: '2026-03-17',
    model: 'Polo',
    color: 'Preto',
    is_on_trip: false,
    payment_pending: true,
    check_in_date: '2026-03-16T10:00:00Z',
    is_active: true
  },
  {
    id: '2',
    guest_name: 'MAX',
    plate: 'ELI6J55',
    identifier: '733',
    location: 'Vaga 05',
    check_out_date: '2026-03-19',
    model: 'Jeep',
    color: 'Branco',
    is_on_trip: false,
    payment_pending: false,
    check_in_date: '2026-03-18T15:00:00Z',
    is_active: true
  },
  {
    id: '3',
    guest_name: 'OUTRO MAX',
    plate: 'ELI6J55',
    identifier: '734',
    location: 'Vaga 06',
    check_out_date: '2026-03-20',
    model: 'Jeep',
    color: 'Branco',
    is_on_trip: false,
    payment_pending: false,
    check_in_date: '2026-03-18T16:00:00Z',
    is_active: true
  }
];

const ParkingView: React.FC<ParkingViewProps> = ({ theme, parkingLocations = [], vehicles, currentUser, onSaveVehicle, onDeleteVehicle, onCheckoutVehicle, onSaveParkingLocation, onDeleteParkingLocation, onRefresh, isRefreshing }) => {
  const [activeTab, setActiveTab] = useState<'VEHICLES' | 'DASHBOARD' | 'HISTORY' | 'LOCATIONS'>('VEHICLES');
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ON_TRIP' | 'CHECKED_OUT_TODAY'>('ALL');
  
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);
  const [viewingPhotos, setViewingPhotos] = useState<string[] | null>(null);
  
  // Return Modal State
  const [returningVehicleId, setReturningVehicleId] = useState<string | null>(null);
  const [parkedBy, setParkedBy] = useState<'GUEST' | 'DRIVER' | null>(null);
  
  // Confirmation Modals State
  const [vehicleToCheckout, setVehicleToCheckout] = useState<Vehicle | null>(null);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<Partial<Vehicle>>({
    guest_name: '',
    plate: '',
    identifier: '',
    location: '',
    check_out_date: '',
    model: '',
    color: '',
    photos: []
  });

  const tabs = [
    { id: 'VEHICLES', label: 'Veículos', icon: Car },
    { id: 'HISTORY', label: 'Histórico', icon: History },
    { id: 'LOCATIONS', label: 'Pátios', icon: Settings },
  ];

  // Parking Locations management state
  const [isAddingParkingLocation, setIsAddingParkingLocation] = useState(false);
  const [editingParkingLocation, setEditingParkingLocation] = useState<ParkingLocation | null>(null);
  const [parkingName, setParkingName] = useState('');
  const [parkingSpots, setParkingSpots] = useState('');

  const handleSaveParkingLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveParkingLocation) return;
    const newLocation: ParkingLocation = {
      id: editingParkingLocation?.id || `parking_${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: parkingName,
      totalSpots: parseInt(parkingSpots, 10) || 0
    };
    onSaveParkingLocation(newLocation);
    setIsAddingParkingLocation(false);
    setEditingParkingLocation(null);
    setParkingName('');
    setParkingSpots('');
  };

  const handleEditParkingLocation = (loc: ParkingLocation) => {
    setEditingParkingLocation(loc);
    setParkingName(loc.name);
    setParkingSpots(loc.totalSpots.toString());
    setIsAddingParkingLocation(true);
  };

  const createHistoryLog = (vehicleId: string, plate: string, action: string, details?: string): VehicleHistory => {
    return {
      id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
      vehicleId,
      vehiclePlate: plate,
      action,
      timestamp: new Date().toISOString(),
      user: currentUser?.name || 'Sistema',
      details
    };
  };

  const historyLogs = vehicles.flatMap(v => v.history || []).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Auto-delete effect
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let changed = false;
    
    vehicles.forEach(v => {
      if (v.is_active && v.check_out_date) {
        const checkoutDate = new Date(v.check_out_date);
        checkoutDate.setHours(0, 0, 0, 0);
        if (checkoutDate < today) {
          changed = true;
          const newLog = createHistoryLog(v.id, v.plate, 'Exclusão Automática', 'Data de checkout expirada');
          newLog.user = 'Sistema';
          const newHistory = [...(v.history || []), newLog];
          onCheckoutVehicle(v.id, newHistory);
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles]);

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = v.plate.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          v.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          v.identifier.toLowerCase().includes(searchTerm.toLowerCase());
                          
    if (!matchesSearch) return false;
    
    if (filter === 'ALL') return v.is_active;
    if (filter === 'ON_TRIP') return v.is_active && v.is_on_trip;
    if (filter === 'CHECKED_OUT_TODAY') {
      if (v.is_active) return false;
      if (!v.deleted_date) return false;
      const deletedDate = new Date(v.deleted_date).toDateString();
      const today = new Date().toDateString();
      return deletedDate === today;
    }
    return false;
  });

  const handleSaveVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVehicleId) {
      const existingVehicle = vehicles.find(v => v.id === editingVehicleId);
      if (existingVehicle) {
        const updatedVehicle = { 
          ...existingVehicle, 
          ...formData, 
          plate: formData.plate?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || '',
          guest_name: formData.guest_name?.toUpperCase() || ''
        };
        const newFiles = formData.photos?.filter(p => p.startsWith('data:')).map((dataUrl, index) => {
          const [header, base64] = dataUrl.split(',');
          const mimeType = header.split(':')[1].split(';')[0];
          return {
            data: base64,
            mimeType,
            fileName: `photo_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}.jpg`
          };
        });
        const newLog = createHistoryLog(updatedVehicle.id, updatedVehicle.plate, 'Edição', 'Informações do veículo atualizadas');
        updatedVehicle.history = [...(updatedVehicle.history || []), newLog];
        onSaveVehicle(updatedVehicle, newFiles);
      }
      setEditingVehicleId(null);
    } else {
      const newVehicle: Vehicle = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        guest_name: formData.guest_name?.toUpperCase() || '',
        plate: formData.plate?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || '',
        identifier: formData.identifier || '',
        location: formData.location || '',
        check_out_date: formData.check_out_date || '',
        model: formData.model,
        color: formData.color,
        is_on_trip: false,
        payment_pending: false,
        check_in_date: new Date().toISOString(),
        is_active: true,
        photos: formData.photos || []
      };
      const newFiles = formData.photos?.filter(p => p.startsWith('data:')).map((dataUrl, index) => {
        const [header, base64] = dataUrl.split(',');
        const mimeType = header.split(':')[1].split(';')[0];
        return {
          data: base64,
          mimeType,
          fileName: `photo_${Date.now()}_${index}.jpg`
        };
      });
      const newLog = createHistoryLog(newVehicle.id, newVehicle.plate, 'Cadastro', 'Veículo registrado no sistema');
      newVehicle.history = [newLog];
      onSaveVehicle(newVehicle, newFiles);
    }
    setIsAddingVehicle(false);
    setFormData({ guest_name: '', plate: '', identifier: '', location: '', check_out_date: '', model: '', color: '', photos: [] });
  };

  const handleEditClick = (vehicle: Vehicle) => {
    setFormData(vehicle);
    setEditingVehicleId(vehicle.id);
    setIsAddingVehicle(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      
      const compressedPhotos = await Promise.all(
        files.map(file => compressImage(file, 1024, 1024, 0.7))
      );
      
      setFormData(prev => ({ ...prev, photos: [...(prev.photos || []), ...compressedPhotos] }));
    }
  };

  const handleTripAction = (vehicle: Vehicle) => {
    if (vehicle.is_on_trip) {
      setReturningVehicleId(vehicle.id);
      setParkedBy(null);
    } else {
      const updatedVehicle = { 
        ...vehicle, 
        is_on_trip: true,
        trip_start: new Date().toISOString()
      };
      const newLog = createHistoryLog(vehicle.id, vehicle.plate, 'Saída para Passeio');
      updatedVehicle.history = [...(vehicle.history || []), newLog];
      onSaveVehicle(updatedVehicle);
    }
  };

  const handleConfirmReturn = () => {
    if (!returningVehicleId || !parkedBy) return;
    
    const vehicle = vehicles.find(v => v.id === returningVehicleId);
    if (vehicle) {
      const updatedVehicle = { 
        ...vehicle, 
        is_on_trip: false,
        trip_start: undefined
      };
      const newLog = createHistoryLog(vehicle.id, vehicle.plate, 'Retorno de Passeio', `Estacionado por: ${parkedBy === 'GUEST' ? 'Hóspede' : 'Motorista'}`);
      updatedVehicle.history = [...(vehicle.history || []), newLog];
      onSaveVehicle(updatedVehicle);
    }
    
    setReturningVehicleId(null);
    setParkedBy(null);
  };

  const togglePayment = (vehicle: Vehicle) => {
    const newStatus = !vehicle.payment_pending;
    const newLog = createHistoryLog(vehicle.id, vehicle.plate, 'Alteração de Pagamento', newStatus ? 'Marcado como Pendente' : 'Marcado como Pago');
    onSaveVehicle({ ...vehicle, payment_pending: newStatus, history: [...(vehicle.history || []), newLog] });
  };

  const handleCheckout = (vehicle: Vehicle) => {
    setVehicleToCheckout(vehicle);
  };

  const confirmCheckout = () => {
    if (!vehicleToCheckout) return;
    const newLog = createHistoryLog(vehicleToCheckout.id, vehicleToCheckout.plate, 'Check Out', 'Veículo finalizado e removido da tela');
    onCheckoutVehicle(vehicleToCheckout.id, [...(vehicleToCheckout.history || []), newLog]);
    setVehicleToCheckout(null);
  };

  const handleDelete = (vehicle: Vehicle) => {
    setVehicleToDelete(vehicle);
  };

  const confirmDelete = () => {
    if (!vehicleToDelete) return;
    onDeleteVehicle(vehicleToDelete.id);
    setVehicleToDelete(null);
  };

  const formatPlate = (plate: string) => {
    return plate.toUpperCase();
  };

  const returningVehicle = vehicles.find(v => v.id === returningVehicleId);

  return (
    <div className="flex flex-col space-y-4 animate-in fade-in duration-500 pb-24 md:pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2 md:px-0">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100" style={{ color: theme.primary }}>
            <Car size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tighter">Estacionamento</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Controle de Vagas e Veículos</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-3 bg-white text-slate-500 rounded-2xl border border-slate-100 shadow-sm hover:bg-slate-50 hover:text-slate-700 transition-all disabled:opacity-50"
              title="Atualizar dados"
            >
              <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 overflow-x-auto scrollbar-hide w-full md:w-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-white shadow-md'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
                style={{ backgroundColor: activeTab === tab.id ? theme.primary : 'transparent' }}
              >
                <tab.icon size={16} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl md:rounded-[2.5rem] border border-slate-100 shadow-sm relative flex flex-col mx-2 md:mx-0">
        {activeTab === 'VEHICLES' && (
          <div className="flex flex-col p-3 md:p-6 bg-slate-50/50 rounded-3xl">
            <div className="flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4 mb-4 md:mb-6">
              <div className="flex flex-col md:flex-row w-full md:w-auto gap-2">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    type="text" 
                    placeholder="Buscar..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-100 text-sm font-bold bg-white shadow-sm outline-none focus:ring-2 focus:ring-slate-200 transition-all"
                  />
                </div>
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100 overflow-x-auto scrollbar-hide w-full md:w-auto">
                  <button 
                    onClick={() => setFilter('ALL')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    Todos
                  </button>
                  <button 
                    onClick={() => setFilter('ON_TRIP')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filter === 'ON_TRIP' ? 'bg-amber-500 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    Passeio
                  </button>
                  <button 
                    onClick={() => setFilter('CHECKED_OUT_TODAY')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filter === 'CHECKED_OUT_TODAY' ? 'bg-rose-500 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    Check Out (Hoje)
                  </button>
                </div>
              </div>
              <button 
                onClick={() => {
                  setFormData({ guest_name: '', plate: '', identifier: '', location: '', check_out_date: '', model: '', color: '', photos: [] });
                  setEditingVehicleId(null);
                  setIsAddingVehicle(true);
                }}
                className="w-full md:w-auto px-6 py-3 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center space-x-2"
                style={{ backgroundColor: theme.primary }}
              >
                <Plus size={16} />
                <span>Registrar Veículo</span>
              </button>
            </div>

            <div className="pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {filteredVehicles.map((vehicle, index) => {
                  const isDuplicated = vehicles.filter(v => v.plate === vehicle.plate && v.is_active).length > 1;
                  const isPending = vehicle.payment_pending;
                  
                  let cardBg = 'bg-white';
                  let cardBorder = 'border-slate-200';
                  let headerBg = 'bg-[#003399]';
                  let idBg = 'bg-[#4F46E5]';
                  let nameColor = 'text-slate-800';
                  let badge = null;
                  
                  if (isDuplicated) {
                    cardBg = 'bg-orange-50';
                    cardBorder = 'border-orange-500 border-2';
                    headerBg = 'bg-[#c2410c]'; // orange-700
                    idBg = 'bg-[#ea580c]'; // orange-600
                    nameColor = 'text-orange-900';
                    badge = (
                      <div className="bg-orange-500 text-white px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center space-x-1 w-fit mb-2">
                        <AlertTriangle size={12} />
                        <span>Placa Duplicada no Sistema</span>
                      </div>
                    );
                  } else if (isPending) {
                    cardBg = 'bg-red-50';
                    cardBorder = 'border-red-500 border-2';
                    headerBg = 'bg-[#991b1b]'; // red-800
                    idBg = 'bg-[#b91c1c]'; // red-700
                    nameColor = 'text-red-900';
                    badge = (
                      <div className="bg-red-400 text-white px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center space-x-1 w-fit mb-2">
                        <AlertTriangle size={12} />
                        <span>Pagamento Pendente - Não Liberar</span>
                      </div>
                    );
                  } else if (vehicle.is_on_trip) {
                    cardBg = 'bg-amber-50';
                    cardBorder = 'border-amber-300 border-2';
                  }

                  return (
                    <div 
                      key={vehicle.id ? `${vehicle.id}-${index}` : `veh-${index}`} 
                      className={`rounded-2xl border shadow-sm p-4 md:p-5 flex flex-col space-y-3 md:space-y-4 transition-colors ${cardBg} ${cardBorder}`}
                    >
                      {/* Header: Name and Pend Badge */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex flex-col">
                          <h3 className={`font-black text-base md:text-lg leading-tight uppercase ${nameColor}`}>{vehicle.guest_name}</h3>
                          {badge}
                        </div>
                        <button 
                          onClick={() => togglePayment(vehicle)}
                          className={`flex items-center space-x-1 px-2 md:px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold shrink-0 transition-colors ${
                            isPending 
                              ? 'bg-red-700 text-white hover:bg-red-800' 
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          <DollarSign size={14} />
                          <span>{isPending ? 'Pago' : 'Pend'}</span>
                        </button>
                      </div>

                      {/* Mercosul Plate */}
                      <div className="border-4 border-black rounded-xl overflow-hidden bg-white flex flex-col">
                        <div className={`${headerBg} text-white px-2 md:px-3 py-1 flex justify-between items-center`}>
                          <span className="text-[8px] font-bold tracking-widest">MERCOSUL</span>
                          <span className="text-[10px] md:text-xs font-black tracking-widest">BRASIL</span>
                          <div className="w-4 h-3 bg-green-500 flex items-center justify-center">
                            <div className="w-2 h-2 bg-yellow-400 rotate-45"></div>
                          </div>
                        </div>
                        <div className="py-2 md:py-3 flex items-center justify-center bg-white">
                          <span className="font-mono text-2xl sm:text-3xl md:text-4xl font-black text-black tracking-[0.1em] md:tracking-[0.2em]">{formatPlate(vehicle.plate)}</span>
                        </div>
                      </div>

                      {/* Identifier Block */}
                      <div className={`${idBg} text-white rounded-xl py-2 md:py-3 flex flex-col items-center justify-center`}>
                        <span className="text-[10px] md:text-xs font-bold mb-1">Identificador</span>
                        <span className="text-xl md:text-2xl font-black">{vehicle.identifier}</span>
                      </div>

                      {/* Details List */}
                      <div className="space-y-2 md:space-y-3 pt-2">
                        <div className="flex items-start space-x-2 md:space-x-3">
                          <MapPin size={16} className="text-rose-500 mt-0.5 md:w-[18px] md:h-[18px]" />
                          <div>
                            <p className="text-[10px] md:text-xs text-slate-500 font-medium leading-none mb-1">Localização</p>
                            <p className="text-xs md:text-sm font-bold text-slate-800 leading-none">{vehicle.location || 'Não informada'}</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2 md:space-x-3">
                          <Car size={16} className="text-blue-500 mt-0.5 md:w-[18px] md:h-[18px]" />
                          <div>
                            <p className="text-[10px] md:text-xs text-slate-500 font-medium leading-none mb-1">Modelo</p>
                            <p className="text-xs md:text-sm font-bold text-slate-800 leading-none">{vehicle.model || 'Não informado'}</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2 md:space-x-3">
                          <Palette size={16} className="text-amber-500 mt-0.5 md:w-[18px] md:h-[18px]" />
                          <div>
                            <p className="text-[10px] md:text-xs text-slate-500 font-medium leading-none mb-1">Cor</p>
                            <p className="text-xs md:text-sm font-bold text-slate-800 leading-none">{vehicle.color || 'Não informada'}</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2 md:space-x-3">
                          <Calendar size={16} className="text-indigo-500 mt-0.5 md:w-[18px] md:h-[18px]" />
                          <div>
                            <p className="text-[10px] md:text-xs text-slate-500 font-medium leading-none mb-1">Check Out</p>
                            <p className="text-xs md:text-sm font-bold text-slate-800 leading-none">
                              {vehicle.check_out_date ? new Date(vehicle.check_out_date).toLocaleDateString('pt-BR') : 'Não informado'}
                            </p>
                          </div>
                        </div>
                        {vehicle.photos && vehicle.photos.length > 0 && (
                          <div className="flex items-start space-x-2 md:space-x-3">
                            <ImageIcon size={16} className="text-emerald-500 mt-0.5 md:w-[18px] md:h-[18px]" />
                            <div>
                              <p className="text-[10px] md:text-xs text-slate-500 font-medium leading-none mb-1">Avarias</p>
                              <button 
                                onClick={() => setViewingPhotos(vehicle.photos || [])}
                                className="text-xs md:text-sm font-bold text-emerald-600 hover:text-emerald-700 leading-none underline"
                              >
                                Ver {vehicle.photos.length} foto(s)
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className={`grid grid-cols-2 gap-1.5 md:gap-2 pt-3 md:pt-4 border-t ${vehicle.is_on_trip ? 'border-amber-200' : 'border-slate-100'}`}>
                        {vehicle.is_active && (
                          <>
                            <button 
                              onClick={() => handleTripAction(vehicle)}
                              className={`flex items-center justify-center space-x-1 py-2 md:py-2.5 text-white rounded-lg font-bold text-[10px] sm:text-xs md:text-sm transition-colors ${
                                vehicle.is_on_trip 
                                  ? 'bg-[#10B981] hover:bg-[#059669]' // Green for Retornou
                                  : 'bg-[#F59E0B] hover:bg-[#D97706]' // Orange for Passeio
                              }`}
                            >
                              {vehicle.is_on_trip ? <CheckCircle2 size={12} className="md:w-4 md:h-4" /> : <Car size={12} className="md:w-4 md:h-4" />}
                              <span>{vehicle.is_on_trip ? 'Retornou' : 'Passeio'}</span>
                            </button>
                            <button 
                              onClick={() => handleEditClick(vehicle)}
                              className="flex items-center justify-center space-x-1 py-2 md:py-2.5 bg-white border border-[#0ea5e9] text-[#0ea5e9] hover:bg-sky-50 rounded-lg font-bold text-[10px] sm:text-xs md:text-sm transition-colors"
                            >
                              <Edit size={12} className="md:w-4 md:h-4" />
                              <span>Editar</span>
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => setViewingHistoryId(vehicle.id)}
                          className={`flex items-center justify-center space-x-1 py-2 md:py-2.5 bg-white border border-[#8b5cf6] text-[#8b5cf6] hover:bg-violet-50 rounded-lg font-bold text-[10px] sm:text-xs md:text-sm transition-colors ${!vehicle.is_active ? 'col-span-2' : ''}`}
                        >
                          <History size={12} className="md:w-4 md:h-4" />
                          <span>Histórico</span>
                        </button>
                        {vehicle.is_active && (
                          <button 
                            onClick={() => handleCheckout(vehicle)}
                            className="flex items-center justify-center space-x-1 py-2 md:py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-lg font-bold text-[10px] sm:text-xs md:text-sm transition-colors"
                          >
                            <LogOut size={12} className="md:w-4 md:h-4" />
                            <span>Check Out</span>
                          </button>
                        )}
                        <button 
                          onClick={() => handleDelete(vehicle)}
                          className="col-span-2 flex items-center justify-center space-x-1 py-2 md:py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-lg font-bold text-[10px] sm:text-xs md:text-sm transition-colors mt-1"
                        >
                          <Trash2 size={12} className="md:w-4 md:h-4" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
                {filteredVehicles.length === 0 && (
                  <div className="col-span-full py-20 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 rounded-[2rem] bg-white">
                    <Car size={48} className="text-slate-200 mb-4" />
                    <p className="text-slate-400 font-bold italic">Nenhum veículo encontrado.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'HISTORY' && (
          <div className="flex-1 flex flex-col p-6 overflow-hidden bg-slate-50/50">
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-6">Histórico Geral</h3>
            <div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide">
              {historyLogs.map(log => (
                <div key={log.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-sm font-black bg-slate-100 px-2 py-1 rounded-md">{log.vehiclePlate}</span>
                      <span className="font-bold text-slate-800">{log.action}</span>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                  </div>
                  {log.details && <p className="text-sm text-slate-600">{log.details}</p>}
                  <div className="flex items-center space-x-1 text-xs text-slate-400">
                    <User size={12} />
                    <span>{log.user}</span>
                  </div>
                </div>
              ))}
              {historyLogs.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 rounded-[2rem] bg-white">
                  <History size={48} className="text-slate-200 mb-4" />
                  <p className="text-slate-400 font-bold italic">Nenhum registro no histórico.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'LOCATIONS' && (
          <div className="flex-1 flex flex-col p-6 overflow-hidden bg-slate-50/50">
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6 animate-in slide-in-from-top-4 flex-1 overflow-y-auto scrollbar-hide">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Configuração de Vagas</h3>
                  <p className="text-xs font-bold text-slate-400 mt-1">Cadastre os locais de estacionamento e a quantidade de vagas.</p>
                </div>
                <button 
                  onClick={() => setIsAddingParkingLocation(true)}
                  className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 active:scale-95 transition-all shadow-lg"
                >
                  <Plus size={14} />
                  <span>Adicionar Local</span>
                </button>
              </div>

              <div className="space-y-3">
                {parkingLocations.map((loc) => (
                  <div key={loc.id} className="p-4 bg-slate-50 rounded-[1.5rem] border border-slate-100 flex items-center justify-between group flex-col sm:flex-row space-y-3 sm:space-y-0 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row items-center sm:space-x-4">
                      <div className="p-3 bg-white rounded-xl text-slate-600 shadow-sm mb-2 sm:mb-0"><Car size={20} /></div>
                      <div>
                        <p className="font-black text-slate-800">{loc.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total de Vagas: {loc.totalSpots}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEditParkingLocation(loc)} className="p-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 rounded-lg transition-colors"><Settings size={16}/></button>
                      <button onClick={() => onDeleteParkingLocation && onDeleteParkingLocation(loc.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                    </div>
                  </div>
                ))}
                {parkingLocations.length === 0 && (
                  <div className="text-center py-8 text-slate-400 font-bold text-sm">Nenhum local cadastrado.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Return Modal */}
      {returningVehicleId && returningVehicle && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-white w-[95%] md:w-full md:max-w-md rounded-[2rem] shadow-2xl animate-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[90dvh]">
            <div className="p-6 pb-4 flex justify-between items-start shrink-0">
              <div>
                <h2 className="text-2xl font-black text-slate-800">Retorno de Passeio</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Veículo: <span className="font-bold text-slate-700">{returningVehicle.plate}</span> - {returningVehicle.guest_name}
                </p>
              </div>
              <button onClick={() => setReturningVehicleId(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 pt-2 overflow-y-auto">
              <p className="text-center font-bold text-slate-700 mb-6">Quem estacionou o veículo?</p>
              
              <div className="space-y-4">
                <button 
                  onClick={() => setParkedBy('GUEST')}
                  className={`w-full flex items-center p-4 rounded-2xl border-2 text-left transition-all ${
                    parkedBy === 'GUEST' 
                      ? 'border-[#4F46E5] bg-indigo-50' 
                      : 'border-slate-100 hover:border-slate-200 bg-white'
                  }`}
                >
                  <div className={`p-3 rounded-xl mr-4 ${parkedBy === 'GUEST' ? 'bg-[#4F46E5] text-white' : 'bg-slate-50 text-slate-400'}`}>
                    <User size={24} />
                  </div>
                  <div>
                    <h4 className={`font-bold text-lg ${parkedBy === 'GUEST' ? 'text-[#4F46E5]' : 'text-slate-800'}`}>Estacionado pelo Hóspede</h4>
                    <p className="text-sm text-slate-500">O próprio hóspede estacionou</p>
                  </div>
                </button>

                <button 
                  onClick={() => setParkedBy('DRIVER')}
                  className={`w-full flex items-center p-4 rounded-2xl border-2 text-left transition-all ${
                    parkedBy === 'DRIVER' 
                      ? 'border-[#4F46E5] bg-indigo-50' 
                      : 'border-slate-100 hover:border-slate-200 bg-white'
                  }`}
                >
                  <div className={`p-3 rounded-xl mr-4 ${parkedBy === 'DRIVER' ? 'bg-[#4F46E5] text-white' : 'bg-slate-50 text-slate-400'}`}>
                    <Car size={24} />
                  </div>
                  <div>
                    <h4 className={`font-bold text-lg ${parkedBy === 'DRIVER' ? 'text-[#4F46E5]' : 'text-slate-800'}`}>Estacionado pelo Motorista</h4>
                    <p className="text-sm text-slate-500">Motorista do hotel estacionou</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="p-6 pt-4 flex gap-4 shrink-0">
              <button 
                onClick={() => setReturningVehicleId(null)}
                className="flex-1 py-3.5 rounded-xl font-bold text-slate-700 bg-white border-2 border-slate-100 hover:bg-slate-50 transition-colors"
              >
                Voltar
              </button>
              <button 
                onClick={handleConfirmReturn}
                disabled={!parkedBy}
                className={`flex-1 py-3.5 rounded-xl font-bold text-white transition-all ${
                  parkedBy 
                    ? 'bg-[#8b5cf6] hover:bg-[#7c3aed] shadow-lg' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Confirmar Retorno
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle History Modal */}
      {viewingHistoryId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-white w-[95%] md:w-full md:max-w-lg rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[90dvh]">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-black text-slate-800">Histórico do Veículo</h2>
              <button onClick={() => setViewingHistoryId(null)} className="text-slate-300 hover:text-slate-500 transition-colors"><X size={24}/></button>
            </div>
            <div className="p-6 overflow-y-auto scrollbar-hide space-y-4">
              {historyLogs.filter(log => log.vehicleId === viewingHistoryId).map(log => (
                <div key={log.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-800">{log.action}</span>
                    <span className="text-xs text-slate-400 font-medium">{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                  </div>
                  {log.details && <p className="text-sm text-slate-600">{log.details}</p>}
                  <div className="flex items-center space-x-1 text-xs text-slate-400">
                    <User size={12} />
                    <span>{log.user}</span>
                  </div>
                </div>
              ))}
              {historyLogs.filter(log => log.vehicleId === viewingHistoryId).length === 0 && (
                <p className="text-center text-slate-400 font-bold italic py-4">Nenhum registro encontrado para este veículo.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Photos Modal */}
      {viewingPhotos && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[400] flex items-center justify-center p-4">
          <div className="w-full max-w-4xl flex flex-col max-h-[90dvh]">
            <div className="flex justify-end mb-4 shrink-0">
              <button onClick={() => setViewingPhotos(null)} className="text-white hover:text-slate-300 bg-white/10 p-2 rounded-full transition-colors"><X size={24}/></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto items-center">
              {viewingPhotos.map((photo, index) => (
                <img key={index} src={photo} alt={`Avaria ${index + 1}`} className="w-full h-auto rounded-xl object-contain bg-black/50" />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Vehicle Modal */}
      {isAddingVehicle && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
           <div className="bg-white w-[95%] md:w-full md:max-w-lg rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[90dvh]">
              <div className="p-6 border-b border-slate-50 flex justify-between items-center shrink-0">
                 <h2 className="text-xl font-black text-slate-800">{editingVehicleId ? 'Editar Veículo' : 'Registrar Veículo'}</h2>
                 <button onClick={() => { setIsAddingVehicle(false); setEditingVehicleId(null); }} className="text-slate-300 hover:text-slate-500 transition-colors"><X size={24}/></button>
              </div>
              <div className="p-6 overflow-y-auto scrollbar-hide flex-1">
                <form id="vehicle-form" onSubmit={handleSaveVehicle} className="space-y-4">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                         <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Nome do Hóspede *</label>
                         <input type="text" value={formData.guest_name} onChange={e => setFormData({...formData, guest_name: e.target.value})} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800 uppercase" required />
                      </div>
                      <div>
                         <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Placa *</label>
                         <input type="text" value={formData.plate} onChange={e => setFormData({...formData, plate: e.target.value})} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800 uppercase" placeholder="ABC1D23" maxLength={7} required />
                      </div>
                      <div>
                         <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Apto / Identificador *</label>
                         <input type="text" value={formData.identifier} onChange={e => setFormData({...formData, identifier: e.target.value})} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800" placeholder="Ex: 514" required />
                      </div>
                      <div>
                         <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Vaga / Localização *</label>
                         {parkingLocations.length > 0 ? (
                           <select 
                             value={formData.location} 
                             onChange={e => setFormData({...formData, location: e.target.value})} 
                             className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800"
                             required
                           >
                             <option value="">Selecione um local...</option>
                             {parkingLocations.map(loc => {
                               const occupiedSpots = vehicles.filter(v => v.location === loc.name && v.is_active).length;
                               const availableSpots = loc.totalSpots - occupiedSpots;
                               return (
                                 <option key={loc.id} value={loc.name} disabled={availableSpots <= 0 && formData.location !== loc.name}>
                                   {loc.name} (Vagas: {availableSpots}/{loc.totalSpots})
                                 </option>
                               );
                             })}
                           </select>
                         ) : (
                           <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800" placeholder="Ex: Vaga 12" required />
                         )}
                      </div>
                      <div>
                         <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Data de Checkout *</label>
                         <input type="date" value={formData.check_out_date} onChange={e => setFormData({...formData, check_out_date: e.target.value})} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800" required />
                      </div>
                      <div>
                         <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Modelo</label>
                         <input type="text" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800" placeholder="Ex: Pulse" />
                      </div>
                      <div>
                         <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Cor</label>
                         <input type="text" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800" placeholder="Ex: Prata" />
                      </div>
                      <div className="md:col-span-2">
                         <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Fotos de Avarias</label>
                         <div className="flex items-center justify-center w-full">
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                               <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                  <Camera className="w-8 h-8 mb-3 text-slate-400" />
                                  <p className="mb-2 text-sm text-slate-500 font-bold"><span className="font-black">Clique para enviar</span> ou arraste as fotos</p>
                                  <p className="text-xs text-slate-400">PNG, JPG (Máx. 20MB)</p>
                               </div>
                               <input type="file" className="hidden" multiple accept="image/*" onChange={handlePhotoUpload} />
                            </label>
                         </div>
                         {formData.photos && formData.photos.length > 0 && (
                           <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                             {formData.photos.map((photo, index) => (
                               <div key={index} className="relative shrink-0">
                                 <img src={photo} alt={`Preview ${index}`} className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                                 <button 
                                   type="button"
                                   onClick={() => setFormData(prev => ({ ...prev, photos: prev.photos?.filter((_, i) => i !== index) }))}
                                   className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow-sm hover:bg-rose-600"
                                 >
                                   <X size={12} />
                                 </button>
                               </div>
                             ))}
                           </div>
                         )}
                      </div>
                   </div>
                </form>
              </div>
              <div className="p-6 border-t border-slate-50 shrink-0">
                <button type="submit" form="vehicle-form" className="w-full py-5 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95" style={{ backgroundColor: theme.primary }}>
                  {editingVehicleId ? 'Salvar Alterações' : 'Salvar Veículo'}
                </button>
              </div>
           </div>
        </div>
      )}

      {/* Checkout Confirmation Modal */}
      {vehicleToCheckout && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
          <div className="bg-white w-[95%] md:w-full md:max-w-md rounded-[2rem] shadow-2xl animate-in zoom-in duration-200 overflow-hidden flex flex-col p-6 text-center max-h-[90dvh]">
            <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 shrink-0">
              <LogOut size={32} />
            </div>
            <div className="overflow-y-auto">
              <h2 className="text-2xl font-black text-slate-800 mb-2">Confirmar Check Out</h2>
              <p className="text-slate-500 mb-6 font-medium">
                Deseja realmente fazer checkout do veículo <span className="font-bold text-slate-700">{vehicleToCheckout.plate}</span>? Ele sairá da tela.
              </p>
            </div>
            <div className="flex gap-4 shrink-0">
              <button 
                onClick={() => setVehicleToCheckout(null)}
                className="flex-1 py-3.5 rounded-xl font-bold text-slate-700 bg-white border-2 border-slate-100 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmCheckout}
                className="flex-1 py-3.5 rounded-xl font-bold text-white bg-rose-500 hover:bg-rose-600 shadow-lg transition-all"
              >
                Fazer Check Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {vehicleToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
          <div className="bg-white w-[95%] md:w-full md:max-w-md rounded-[2rem] shadow-2xl animate-in zoom-in duration-200 overflow-hidden flex flex-col p-6 text-center max-h-[90dvh]">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 shrink-0">
              <Trash2 size={32} />
            </div>
            <div className="overflow-y-auto">
              <h2 className="text-2xl font-black text-slate-800 mb-2">Excluir Veículo</h2>
              <p className="text-slate-500 mb-6 font-medium">
                Deseja realmente excluir o veículo <span className="font-bold text-slate-700">{vehicleToDelete.plate}</span>? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="flex gap-4 shrink-0">
              <button 
                onClick={() => setVehicleToDelete(null)}
                className="flex-1 py-3.5 rounded-xl font-bold text-slate-700 bg-white border-2 border-slate-100 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-3.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg transition-all"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
      {isAddingParkingLocation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
           <div className="bg-white w-[95%] md:w-full md:max-w-lg rounded-2xl md:rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[90dvh]">
              <div className="p-6 md:p-8 border-b border-slate-50 flex justify-between items-center shrink-0">
                 <h2 className="text-xl font-black text-slate-800">{editingParkingLocation ? 'Editar Local' : 'Novo Local de Vagas'}</h2>
                 <button onClick={() => { setIsAddingParkingLocation(false); setEditingParkingLocation(null); setParkingName(''); setParkingSpots(''); }} className="text-slate-300 hover:text-slate-500 transition-colors"><X size={24}/></button>
              </div>
              <form onSubmit={handleSaveParkingLocationSubmit} className="p-6 md:p-8 space-y-4 overflow-y-auto scrollbar-hide">
                 <div className="space-y-4">
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Nome do Local</label>
                       <input type="text" value={parkingName} onChange={e => setParkingName(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800 uppercase" placeholder="Ex: PÁTIO A" required />
                    </div>
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Quantidade de Vagas</label>
                       <input type="number" value={parkingSpots} onChange={e => setParkingSpots(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800" placeholder="Ex: 10" min="1" required />
                    </div>
                 </div>
                 <button type="submit" className="w-full py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 mt-4 shrink-0" style={{ backgroundColor: theme.primary }}>
                   {editingParkingLocation ? 'Atualizar Local' : 'Cadastrar Local'}
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default ParkingView;
