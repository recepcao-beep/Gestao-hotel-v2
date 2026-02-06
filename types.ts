
export enum ViewType {
  DASHBOARD = 'DASHBOARD',
  APARTMENTS = 'APARTMENTS',
  BUDGETS = 'BUDGETS',
  SETTINGS = 'SETTINGS',
  EMPLOYEES = 'EMPLOYEES',
  INVENTORY = 'INVENTORY',
  REPORTS = 'REPORTS'
}

export type UserRole = 'GESTOR' | 'FUNCIONARIO';

export interface User {
  role: UserRole;
  hotel?: HotelType;
  name?: string;
}

export type HotelType = 'VILLAGE' | 'GOLDEN_PARK' | 'THERMAL_RESORT';

export interface HotelTheme {
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  text: string;
  chartColors: string[];
}

export interface Defect {
  id: string;
  driveLink: string;
  description: string;
  timestamp: number;
  fileName?: string;
  fileType?: string;
  data?: string;
}

export interface MaterialQuote {
  supplier: string;
  value: number;
}

export interface MaterialItem {
  id: string;
  name: string;
  quantity: number;
  unit?: string;
  observation?: string;
  quotes: MaterialQuote[]; // Array fixo de 3 fornecedores
}

export interface BudgetItem {
  id: string;
  description: string;
  materials: MaterialItem[];
  laborCost: number;
  estimatedTime: string;
  serviceProvider?: string;
}

export interface BudgetFile {
  id: string;
  driveLink: string;
  timestamp: number;
  fileName?: string;
  fileType?: string;
  data?: string;
}

export interface Quote {
  id: string;
  supplier: string;
  value: number;
  files: BudgetFile[];
}

export interface Budget {
  id: string;
  title: string;
  objective: string;
  items: BudgetItem[];
  quotes: Quote[];
  status: 'Pendente' | 'Aprovado' | 'Rejeitado';
  createdAt: number;
}

export interface UniformItem {
  name: string;
  quantity: number;
}

export interface Sector {
  id: string;
  name: string;
  standardUniform: UniformItem[];
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  contact: string;
  startDate: string;
  salary: number;
  department: string;
  sectorId: string;
  status: 'Ativo' | 'Inativo';
  scheduleType: '6x1' | '12x36' | 'Intermitente';
  shiftType?: 'Par' | 'Ímpar';
  workingHours: string;
  weeklyDayOff: string;
  monthlySundayOff: string;
  vacationStatus: 'Pendente' | 'Concedida';
  uniforms: UniformItem[];
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  category: string;
}

export interface InventoryItem {
  id: string;
  ean?: string;
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  unit: string;
  price: number;
  supplierId?: string;
  lastUpdate: number;
}

export interface InventoryOperation {
  id: string;
  itemId: string;
  itemName: string;
  type: 'Entrada' | 'Saída';
  quantity: number;
  timestamp: number;
  user: string;
  reason?: string;
}

export interface Integration {
  id: string;
  name: string;
  type: 'Spreadsheet' | 'ExternalAPI';
  status: 'Connected' | 'Disconnected' | 'Pending';
  lastSync?: number;
  url?: string;
}

export interface BedConfig {
  type: 'Casal' | 'Solteiro';
  baseStatus?: 'Nova' | 'Antiga';
  baseColor?: string;
  mattressStatus?: 'Novo' | 'Antigo';
  mattressColor?: string;
  hasSkirt?: boolean;
  skirtColor?: string;
}

export interface Apartment {
  id: string;
  floor: number;
  roomNumber: number;
  defects: Defect[];
  pisoType?: 'Granito' | 'Madeira' | 'Cerâmica';
  pisoStatus?: 'Bom estado' | 'Tolerável' | 'Reparo urgente';
  banheiroType?: 'Reformado' | 'Antigo';
  banheiroStatus?: 'Tolerável' | 'Reparo urgente';
  temCofre?: boolean;
  temCortina?: boolean;
  cortinaStatus?: 'Nova' | 'Antiga';
  cortinaSize?: string;
  cortinaCoverage?: 'Dois lados' | 'Um lado';
  temEspelhoCorpo?: boolean;
  espelhoCorpoStatus?: 'Bom estado' | 'Manchado' | 'Danificado';
  acBrand?: 'Midea' | 'LG' | 'Grey';
  moveisStatus?: 'Bom estado' | 'Danificado';
  moveisDetalhes?: string[];
  beds?: BedConfig[];
  temPortaControle?: boolean;
  temCabide?: boolean;
  cabideQuantity?: number;
  temSuportePapel?: boolean;
  temSuporteShampoo?: boolean;
  suporteShampooStatus?: 'Bom estado' | 'Enferrujado';
  luminariaType?: 'Arandela' | 'Vidro' | 'Quadrado';
  luminariaColor?: 'Branco' | 'Preto';
  tvBrand?: 'LG' | 'Samsung' | 'Philco' | 'Smart Roku' | 'Toshiba';
}

export interface HotelData {
  apartments: Record<string, Apartment>;
  budgets: Budget[];
  employees: Employee[];
  sectors: Sector[];
  inventory: InventoryItem[];
  inventoryHistory: InventoryOperation[];
  suppliers: Supplier[];
  config?: {
    showSuppliersTab: boolean;
  };
}

export interface AppState {
  currentView: ViewType;
  currentHotel: HotelType;
  hotels: Record<HotelType, HotelData>;
  selectedFloor: number | null;
  selectedApartmentId: string | null;
  selectedSectorId: string | null;
  integrations: Integration[];
  currentUser: User | null;
}
