import { FormFieldConfig } from './types';

export const DEFAULT_CHECKLIST: FormFieldConfig[] = [
  { id: 'pisoType', title: 'Piso do Quarto', type: 'single_choice', options: ['Granito', 'Madeira', 'Cerâmica'], color: 'text-blue-600', icon: 'Droplets' },
  { id: 'moveisStatus', title: 'Mobiliário Geral', type: 'single_choice', options: ['Bom estado', 'Danificado'], color: 'text-slate-700', icon: 'Layout' },
  { id: 'banheiroType', title: 'Banheiro', type: 'single_choice', options: ['Reformado', 'Antigo'], color: 'text-indigo-600', icon: 'Layers' },
  { id: 'acBrand', title: 'Marca do Ar', type: 'single_choice', options: ['Midea', 'LG', 'Gree'], color: 'text-cyan-600', icon: 'Wind' },
  { id: 'tvBrand', title: 'Marca da TV', type: 'single_choice', options: ['LG', 'Samsung', 'Philco', 'Smart Roku', 'Toshiba'], color: 'text-slate-800', icon: 'Tv' },
  { id: 'temCortina', title: 'Cortina', type: 'boolean', color: 'text-blue-600', icon: 'Box' },
  { id: 'temCofre', title: 'Cofre', type: 'boolean', color: 'text-blue-600', icon: 'Box' },
  { id: 'temPortaControle', title: 'Porta-Controles', type: 'boolean', color: 'text-blue-600', icon: 'Box' },
  { id: 'temEspelhoCorpo', title: 'Espelho de Corpo', type: 'boolean', color: 'text-amber-500', icon: 'Box' },
  { id: 'temCabide', title: 'Cabides', type: 'boolean', color: 'text-slate-800', icon: 'Box' },
  { id: 'temSuporteShampoo', title: 'Suporte de Shampoo', type: 'boolean', color: 'text-cyan-600', icon: 'Droplets' },
  { id: 'temSuportePapel', title: 'Suporte de Papel Higiênico', type: 'boolean', color: 'text-slate-800', icon: 'Droplets' },
  { id: 'luminariaType', title: 'Iluminação', type: 'single_choice', options: ['Arandela', 'Vidro', 'Quadrado'], color: 'text-yellow-600', icon: 'Lightbulb' },
  { id: 'beds', title: 'Configuração das Camas', type: 'boolean', color: 'text-emerald-600', icon: 'Bed' },
  { id: 'defects', title: 'Relato de Defeitos', type: 'boolean', color: 'text-rose-500', icon: 'Paperclip' }
];
