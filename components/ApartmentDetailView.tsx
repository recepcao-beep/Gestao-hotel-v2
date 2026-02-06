
import React, { useState, useRef } from 'react';
import { Apartment, Defect, HotelTheme, BedConfig } from '../types';
import { 
  ChevronLeft, 
  Save, 
  Trash2, 
  Wind,
  Bed,
  Tv,
  Lightbulb,
  Box,
  Droplets,
  Layers,
  Layout,
  Image as ImageIcon,
  Paperclip,
  ExternalLink,
  Plus,
  Minus,
  X,
  Maximize2
} from 'lucide-react';

interface ApartmentDetailViewProps {
  apartment: Apartment;
  theme: HotelTheme;
  onBack: () => void;
  onSave: (apt: Apartment, files?: any[]) => void;
  integrationUrl?: string;
}

const ApartmentDetailView: React.FC<ApartmentDetailViewProps> = ({ apartment, theme, onBack, onSave, integrationUrl }) => {
  const [data, setData] = useState<Apartment>(() => {
    const initial = { ...apartment };
    if (!initial.beds || initial.beds.length === 0) {
      initial.beds = initial.floor === 200 
        ? [{ type: 'Casal', baseStatus: 'Nova', mattressStatus: 'Novo', hasSkirt: false }, { type: 'Casal', baseStatus: 'Nova', mattressStatus: 'Novo', hasSkirt: false }]
        : [{ type: 'Casal', baseStatus: 'Nova', mattressStatus: 'Novo', hasSkirt: false }, { type: 'Solteiro', baseStatus: 'Nova', mattressStatus: 'Novo', hasSkirt: false }, { type: 'Solteiro', baseStatus: 'Nova', mattressStatus: 'Novo', hasSkirt: false }];
    }
    if (!initial.moveisDetalhes) initial.moveisDetalhes = [];
    if (!initial.defects) initial.defects = [];
    return initial;
  });

  const [newDefectText, setNewDefectText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [newFiles, setNewFiles] = useState<{data: string, mimeType: string, fileName: string}[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateField = (field: keyof Apartment, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const updateBed = (index: number, bedUpdate: Partial<BedConfig>) => {
    const newBeds = [...(data.beds || [])];
    newBeds[index] = { ...newBeds[index], ...bedUpdate };
    updateField('beds', newBeds);
  };

  const toggleMoveisDetalhe = (item: string) => {
    const current = data.moveisDetalhes || [];
    const next = current.includes(item) ? current.filter(i => i !== item) : [...current, item];
    updateField('moveisDetalhes', next);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const fullBase64 = reader.result?.toString() || '';
        const base64Data = fullBase64.split(',')[1] || '';
        const desc = newDefectText.trim() || 'Avaria fotografada';
        
        const newDefect: Defect = {
          id: `${data.id}-${Date.now()}`,
          description: desc,
          driveLink: 'pendente',
          timestamp: Date.now(),
          fileName: file.name,
          fileType: file.type,
          data: fullBase64
        };
        
        setNewFiles(prev => [...prev, { data: base64Data, mimeType: file.type, fileName: file.name }]);
        setData(prev => ({ ...prev, defects: [...(prev.defects || []), newDefect] }));
        setNewDefectText('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveAndExit = async () => {
    setIsSaving(true);
    onSave(data, newFiles);
    setTimeout(() => { 
      setIsSaving(false); 
      onBack(); 
    }, 1200);
  };

  const SectionTitle = ({ icon: Icon, title, color = "text-slate-800" }: { icon: any, title: string, color?: string }) => (
    <div className="flex items-center space-x-2 mb-4 border-l-4 pl-3 py-1" style={{ borderColor: color.replace('text-', '') }}>
      <div className={`${color}`}><Icon size={18} /></div>
      <h3 className={`text-[11px] font-black ${color} uppercase tracking-widest`}>{title}</h3>
    </div>
  );

  const getStatusBtnClass = (current: any, target: any, activeBg: string) => {
    const isActive = current === target;
    return `flex-1 py-4 rounded-2xl text-[10px] font-black border-2 transition-all shadow-sm ${
      isActive 
      ? `${activeBg} text-white border-transparent` 
      : 'bg-white border-slate-50 text-slate-300'
    }`;
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-40 font-sans text-slate-900">
      {/* Lightbox Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setSelectedImage(null)}>
          <button className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all">
            <X size={32} />
          </button>
          <img src={selectedImage} alt="Visualização" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in duration-300" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <div className="sticky top-0 z-[110] bg-white border-b border-slate-100 px-4 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <button onClick={onBack} className="p-2 -ml-2 text-slate-400 active:bg-slate-100 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-xl font-black text-slate-800 leading-none">Apto {data.roomNumber}</h2>
        </div>
      </div>

      <div className="px-4 py-6 space-y-5 max-w-lg mx-auto">
        
        {/* PISO */}
        <section className="bg-white p-6 rounded-[2.5rem] border border-slate-50 shadow-sm space-y-4">
          <SectionTitle icon={Droplets} title="Piso do Quarto" color="text-blue-600" />
          <div className="grid grid-cols-3 gap-2">
            {['Granito', 'Madeira', 'Cerâmica'].map(t => (
              <button key={t} onClick={() => updateField('pisoType', t as any)} className={getStatusBtnClass(data.pisoType, t, 'bg-blue-600')}>{t}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => updateField('pisoStatus', 'Bom estado')} className={getStatusBtnClass(data.pisoStatus, 'Bom estado', 'bg-emerald-500')}>BOM</button>
            <button onClick={() => updateField('pisoStatus', 'Tolerável')} className={getStatusBtnClass(data.pisoStatus, 'Tolerável', 'bg-amber-400 !text-slate-900')}>TOLERÁVEL</button>
            <button onClick={() => updateField('pisoStatus', 'Reparo urgente')} className={getStatusBtnClass(data.pisoStatus, 'Reparo urgente', 'bg-rose-500')}>URGENTE</button>
          </div>
        </section>

        {/* MOBILIÁRIO */}
        <section className="bg-white p-6 rounded-[2.5rem] border border-slate-50 shadow-sm space-y-4">
          <SectionTitle icon={Layout} title="Mobiliário Geral" color="text-slate-700" />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { updateField('moveisStatus', 'Bom estado'); updateField('moveisDetalhes', []); }} className={getStatusBtnClass(data.moveisStatus, 'Bom estado', 'bg-emerald-500')}>BOM ESTADO</button>
            <button onClick={() => updateField('moveisStatus', 'Danificado')} className={getStatusBtnClass(data.moveisStatus, 'Danificado', 'bg-rose-500')}>DANIFICADO</button>
          </div>
          {data.moveisStatus === 'Danificado' && (
            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 space-y-3">
              <p className="text-[9px] font-black text-rose-600 uppercase">Indique os móveis danificados:</p>
              <div className="flex flex-col gap-2">
                {['Guarda Roupa', 'Criado mudo', 'Cômoda'].map(item => (
                  <button key={item} onClick={() => toggleMoveisDetalhe(item)} className={`py-3 rounded-xl text-[10px] font-bold border-2 transition-all ${data.moveisDetalhes?.includes(item) ? 'bg-rose-500 text-white border-transparent' : 'bg-white text-rose-300 border-rose-100'}`}>{item}</button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* BANHEIRO */}
        <section className="bg-white p-6 rounded-[2.5rem] border border-slate-50 shadow-sm space-y-4">
          <SectionTitle icon={Layers} title="Banheiro" color="text-indigo-600" />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => updateField('banheiroType', 'Reformado')} className={getStatusBtnClass(data.banheiroType, 'Reformado', 'bg-indigo-600')}>Reformado</button>
            <button onClick={() => updateField('banheiroType', 'Antigo')} className={getStatusBtnClass(data.banheiroType, 'Antigo', 'bg-indigo-600')}>Antigo</button>
          </div>
          {data.banheiroType === 'Antigo' && (
            <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-2">
              <button onClick={() => updateField('banheiroStatus', 'Tolerável')} className={getStatusBtnClass(data.banheiroStatus, 'Tolerável', 'bg-amber-400 !text-slate-900')}>TOLERÁVEL</button>
              <button onClick={() => updateField('banheiroStatus', 'Reparo urgente')} className={getStatusBtnClass(data.banheiroStatus, 'Reparo urgente', 'bg-rose-500')}>URGENTE</button>
            </div>
          )}
        </section>

        {/* CLIMATIZAÇÃO & TV */}
        <section className="bg-white p-6 rounded-[2.5rem] border border-slate-50 shadow-sm space-y-4">
          <SectionTitle icon={Wind} title="Climatização & TV" color="text-cyan-600" />
          <div>
            <p className="text-[9px] font-black text-slate-300 uppercase mb-2 ml-1">Marca do Ar:</p>
            <div className="grid grid-cols-3 gap-2">
              {['Midea', 'LG', 'Gree'].map(b => (
                <button key={b} onClick={() => updateField('acBrand', b as any)} className={getStatusBtnClass(data.acBrand, b, 'bg-cyan-600')}>{b}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-300 uppercase mb-2 ml-1">Marca da TV:</p>
            <div className="grid grid-cols-3 gap-2">
              {['LG', 'Samsung', 'Philco', 'Smart Roku', 'Toshiba'].map(b => (
                <button key={b} onClick={() => updateField('tvBrand', b as any)} className={getStatusBtnClass(data.tvBrand, b, 'bg-slate-800')}>{b}</button>
              ))}
            </div>
          </div>
        </section>

        {/* ACESSÓRIOS DO QUARTO */}
        <section className="bg-white p-6 rounded-[2.5rem] border border-slate-50 shadow-sm space-y-5">
          <SectionTitle icon={Box} title="Acessórios & Itens" color="text-amber-600" />
          
          <div className="space-y-4">
            {/* Cortina */}
            <div className="p-5 bg-slate-50 rounded-[2rem] space-y-4">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">CORTINA</span>
                <button 
                  onClick={() => updateField('temCortina', !data.temCortina)} 
                  className={`px-5 py-2 rounded-xl text-[9px] font-black transition-all ${data.temCortina ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-300 border-2 border-slate-50'}`}
                >
                  {data.temCortina ? 'POSSUI' : 'NÃO TEM'}
                </button>
              </div>
              {data.temCortina && (
                <div className="space-y-3 animate-in fade-in">
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => updateField('cortinaStatus', 'Nova')} className={getStatusBtnClass(data.cortinaStatus, 'Nova', 'bg-slate-800')}>NOVA</button>
                    <button onClick={() => updateField('cortinaStatus', 'Antiga')} className={getStatusBtnClass(data.cortinaStatus, 'Antiga', 'bg-slate-800')}>ANTIGA</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => updateField('cortinaCoverage', 'Dois lados')} className={getStatusBtnClass(data.cortinaCoverage, 'Dois lados', 'bg-slate-800')}>DOIS LADOS</button>
                    <button onClick={() => updateField('cortinaCoverage', 'Um lado')} className={getStatusBtnClass(data.cortinaCoverage, 'Um lado', 'bg-slate-800')}>UM LADO</button>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Informe a metragem..." 
                    value={data.cortinaSize} 
                    onChange={e => updateField('cortinaSize', e.target.value)} 
                    className="w-full p-4 rounded-xl border-2 border-white text-[10px] font-bold outline-none bg-white shadow-inner text-slate-800" 
                  />
                </div>
              )}
            </div>

            {/* Cofre e Porta Controle */}
            <div className="grid grid-cols-2 gap-2">
               <button onClick={() => updateField('temCofre', !data.temCofre)} className="p-5 rounded-[2rem] bg-white border border-slate-50 shadow-sm flex flex-col items-center justify-center transition-all active:scale-95">
                 <span className="text-[7px] font-black text-slate-400 uppercase mb-1 tracking-widest">Possui Cofre?</span>
                 <span className={`text-xs font-black ${data.temCofre ? 'text-blue-600' : 'text-slate-400'}`}>{data.temCofre ? 'SIM' : 'NÃO'}</span>
               </button>
               <button onClick={() => updateField('temPortaControle', !data.temPortaControle)} className="p-5 rounded-[2rem] bg-white border border-slate-50 shadow-sm flex flex-col items-center justify-center transition-all active:scale-95">
                 <span className="text-[7px] font-black text-slate-400 uppercase mb-1 tracking-widest">Porta-Controles?</span>
                 <span className={`text-xs font-black ${data.temPortaControle ? 'text-blue-600' : 'text-slate-400'}`}>{data.temPortaControle ? 'SIM' : 'NÃO'}</span>
               </button>
            </div>

            {/* Espelho Corpo */}
            <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase">Espelho de Corpo</span>
                <button onClick={() => updateField('temEspelhoCorpo', !data.temEspelhoCorpo)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black ${data.temEspelhoCorpo ? 'bg-amber-500 text-white shadow-md' : 'bg-white border text-slate-300'}`}>{data.temEspelhoCorpo ? 'POSSUI' : 'NÃO TEM'}</button>
              </div>
              {data.temEspelhoCorpo && (
                <div className="grid grid-cols-3 gap-1">
                  {['Bom estado', 'Manchado', 'Danificado'].map(s => (
                    <button key={s} onClick={() => updateField('espelhoCorpoStatus', s as any)} className={`py-2 rounded-lg text-[8px] font-black border-2 ${data.espelhoCorpoStatus === s ? 'bg-slate-800 text-white border-transparent' : 'bg-white text-slate-400 border-slate-100'}`}>{s.toUpperCase()}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Cabides */}
            <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase">Cabides</span>
                <button onClick={() => updateField('temCabide', !data.temCabide)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black ${data.temCabide ? 'bg-slate-800 text-white' : 'bg-white border text-slate-300'}`}>{data.temCabide ? 'POSSUI' : 'NÃO TEM'}</button>
              </div>
              {data.temCabide && (
                <div className="flex items-center justify-center space-x-6 py-2">
                  <button onClick={() => updateField('cabideQuantity', Math.max(0, (data.cabideQuantity || 0) - 1))} className="w-10 h-10 bg-white border-2 rounded-xl flex items-center justify-center shadow-sm"><Minus size={18}/></button>
                  <span className="text-2xl font-black text-slate-800">{data.cabideQuantity || 0}</span>
                  <button onClick={() => updateField('cabideQuantity', (data.cabideQuantity || 0) + 1)} className="w-10 h-10 bg-white border-2 rounded-xl flex items-center justify-center shadow-sm"><Plus size={18}/></button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* BANHEIRO: ACESSÓRIOS */}
        <section className="bg-white p-6 rounded-[2.5rem] border border-slate-50 shadow-sm space-y-4">
           <SectionTitle icon={Droplets} title="Banheiro: Acessórios" color="text-cyan-600" />
           <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase">Suporte de Shampoo</span>
                <button onClick={() => updateField('temSuporteShampoo', !data.temSuporteShampoo)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black ${data.temSuporteShampoo ? 'bg-cyan-600 text-white shadow-md' : 'bg-white border text-slate-300'}`}>{data.temSuporteShampoo ? 'POSSUI' : 'NÃO TEM'}</button>
              </div>
              {data.temSuporteShampoo && (
                <div className="grid grid-cols-2 gap-2 animate-in fade-in">
                  <button onClick={() => updateField('suporteShampooStatus', 'Bom estado')} className={getStatusBtnClass(data.suporteShampooStatus, 'Bom estado', 'bg-emerald-500')}>BOM ESTADO</button>
                  <button onClick={() => updateField('suporteShampooStatus', 'Enferrujado')} className={getStatusBtnClass(data.suporteShampooStatus, 'Enferrujado', 'bg-rose-500')}>ENFERRUJADO</button>
                </div>
              )}
            </div>
            <button onClick={() => updateField('temSuportePapel', !data.temSuportePapel)} className={`w-full p-5 rounded-2xl border-2 flex items-center justify-between transition-all ${data.temSuportePapel ? 'bg-slate-800 border-transparent text-white shadow-lg' : 'bg-white border-slate-50 text-slate-400'}`}>
               <span className="text-[9px] font-black uppercase">Suporte de Papel Higiênico</span>
               <span className="text-xs font-black">{data.temSuportePapel ? 'POSSUI' : 'NÃO TEM'}</span>
            </button>
        </section>

        {/* ILUMINAÇÃO */}
        <section className="bg-white p-6 rounded-[2.5rem] border border-slate-50 shadow-sm space-y-4">
          <SectionTitle icon={Lightbulb} title="Iluminação" color="text-yellow-600" />
          <div className="grid grid-cols-3 gap-2">
            {['Arandela', 'Vidro', 'Quadrado'].map(t => (
              <button key={t} onClick={() => updateField('luminariaType', t as any)} className={getStatusBtnClass(data.luminariaType, t, 'bg-yellow-600')}>{t}</button>
            ))}
          </div>
          {data.luminariaType === 'Quadrado' && (
             <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
                <div className="grid grid-cols-2 gap-2">
                   {['Branco', 'Preto'].map(color => (
                     <button key={color} onClick={() => updateField('luminariaColor', color as any)} className={`py-4 rounded-xl text-[10px] font-black border-2 transition-all ${data.luminariaColor === color ? 'bg-white border-slate-200 text-slate-800 shadow-sm' : 'bg-white border-transparent text-slate-300'}`}>{color.toUpperCase()}</button>
                   ))}
                </div>
             </div>
          )}
        </section>

        {/* CONFIGURAÇÃO DAS CAMAS */}
        <div className="pt-2 space-y-4">
          <SectionTitle icon={Bed} title="Configuração das Camas" color="text-emerald-600" />
          
          {(data.beds || []).map((bed, idx) => (
            <section key={idx} className="bg-white p-6 rounded-[2.5rem] border border-slate-50 shadow-sm space-y-6">
              <div className="flex justify-between items-center">
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-tighter">Cama {idx + 1}</h4>
                <div className="bg-emerald-50 text-emerald-500 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">
                  {bed.type}
                </div>
              </div>

              {/* Base da Cama */}
              <div className="space-y-3">
                <label className="text-[9px] font-black text-slate-300 uppercase ml-1 tracking-widest">Base da Cama:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => updateBed(idx, { baseStatus: 'Nova' })} className={getStatusBtnClass(bed.baseStatus, 'Nova', 'bg-emerald-500')}>NOVA</button>
                  <button onClick={() => updateBed(idx, { baseStatus: 'Antiga' })} className={getStatusBtnClass(bed.baseStatus, 'Antiga', 'bg-amber-400 !text-slate-900')}>ANTIGA</button>
                </div>
                {bed.baseStatus === 'Antiga' && (
                  <div className="grid grid-cols-3 gap-1.5 animate-in slide-in-from-top-2">
                    {['Rosa', 'Beje', 'Amarela', 'Branca', 'Preta Fosca', 'Cinza'].map(color => (
                      <button 
                        key={color} 
                        onClick={() => updateBed(idx, { baseColor: color })} 
                        className={`py-2 rounded-lg text-[8px] font-black border-2 transition-all ${bed.baseColor === color ? 'bg-slate-800 text-white border-transparent' : 'bg-white text-slate-300 border-slate-50'}`}
                      >
                        {color.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Colchão */}
              <div className="space-y-3">
                <label className="text-[9px] font-black text-slate-300 uppercase ml-1 tracking-widest">Colchão:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => updateBed(idx, { mattressStatus: 'Novo' })} className={getStatusBtnClass(bed.mattressStatus, 'Novo', 'bg-emerald-500')}>NOVO</button>
                  <button onClick={() => updateBed(idx, { mattressStatus: 'Antigo' })} className={getStatusBtnClass(bed.mattressStatus, 'Antigo', 'bg-amber-400 !text-slate-900')}>ANTIGO</button>
                </div>
                {bed.mattressStatus === 'Antigo' && (
                  <div className="grid grid-cols-3 gap-1.5 animate-in slide-in-from-top-2">
                    {['Cinza', 'Bege', 'Rosa'].map(color => (
                      <button 
                        key={color} 
                        onClick={() => updateBed(idx, { mattressColor: color })} 
                        className={`py-2 rounded-lg text-[8px] font-black border-2 transition-all ${bed.mattressColor === color ? 'bg-slate-800 text-white border-transparent' : 'bg-white text-slate-300 border-slate-50'}`}
                      >
                        {color.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Saia de Cama */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Saia de Cama?</span>
                  <button 
                    onClick={() => updateBed(idx, { hasSkirt: !bed.hasSkirt })} 
                    className={`px-5 py-2 rounded-xl text-[9px] font-black transition-all ${bed.hasSkirt ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-50 text-slate-300 border-2 border-slate-50'}`}
                  >
                    {bed.hasSkirt ? 'POSSUI' : 'NÃO TEM'}
                  </button>
                </div>
                {bed.hasSkirt && (
                  <div className="grid grid-cols-2 gap-2 animate-in fade-in">
                    {['Cinza', 'Verde'].map(color => (
                      <button 
                        key={color} 
                        onClick={() => updateBed(idx, { skirtColor: color })} 
                        className={`py-3 rounded-2xl text-[9px] font-black border-2 transition-all ${bed.skirtColor === color ? 'bg-slate-800 text-white border-transparent' : 'bg-white text-slate-300 border-slate-50'}`}
                      >
                        {color.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>

        {/* RELATO DE DEFEITOS */}
        <section className="bg-white p-6 rounded-[2.5rem] border border-slate-50 shadow-xl space-y-4">
          <SectionTitle icon={Paperclip} title="Relato de Defeitos" color="text-rose-500" />
          <textarea 
            value={newDefectText} 
            onChange={(e) => setNewDefectText(e.target.value)} 
            placeholder="Descreva o problema..." 
            className="w-full p-4 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-rose-200 outline-none transition-all text-xs font-bold min-h-[100px] shadow-inner text-slate-700" 
          />
          <button onClick={() => fileInputRef.current?.click()} className="w-full bg-rose-500 text-white py-4 rounded-2xl font-black text-xs flex items-center justify-center space-x-3 active:scale-95 transition-all shadow-lg uppercase tracking-widest">
            <ImageIcon size={20} />
            <span>FOTOGRAFAR AVARIA</span>
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" capture="environment" />
          
          <div className="space-y-4 pt-2">
            {(data.defects || []).map(defect => (
              <div key={defect.id} className="flex flex-col p-4 bg-slate-50 rounded-2xl border border-slate-100 animate-in slide-in-from-right-2">
                <div className="flex items-start justify-between gap-4">
                   <div className="flex items-start space-x-3 flex-1">
                      {(defect.data || (defect.driveLink && defect.driveLink !== 'pendente')) && (
                        <div className="relative group cursor-pointer" onClick={() => setSelectedImage(defect.data || defect.driveLink || null)}>
                          <img src={defect.data || defect.driveLink} className="w-20 h-20 rounded-xl object-cover shadow-sm border group-hover:brightness-75 transition-all" alt="Evidência" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Maximize2 size={20} className="text-white" />
                          </div>
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-[11px] font-black text-slate-800 uppercase leading-tight">{defect.description}</p>
                      </div>
                   </div>
                   <button onClick={() => setData(prev => ({ ...prev, defects: prev.defects.filter(d => d.id !== defect.id) }))} className="text-slate-300 hover:text-rose-500 transition-colors">
                     <Trash2 size={20}/>
                   </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="fixed bottom-8 left-0 right-0 px-6 z-[120]">
        <button onClick={handleSaveAndExit} disabled={isSaving} className="w-full bg-slate-900 text-white py-5 rounded-[2.2rem] font-black text-sm shadow-2xl flex items-center justify-center space-x-3 active:scale-95 transition-all hover:bg-slate-800">
          {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={20} className="text-emerald-400" />}
          <span>SALVAR VISTORIA</span>
        </button>
      </div>
    </div>
  );
};

export default ApartmentDetailView;
