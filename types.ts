
export enum ViewType {
  DASHBOARD = 'DASHBOARD',
  APARTMENTS = 'APARTMENTS',
  BUDGETS = 'BUDGETS',
  SETTINGS = 'SETTINGS',
  EMPLOYEES = 'EMPLOYEES',
  INVENTORY = 'INVENTORY',
  REPORTS = 'REPORTS',
  TODAY_SCHEDULE = 'TODAY_SCHEDULE',
  PARKING = 'PARKING'
}

export type UserRole = 'GESTOR' | 'FUNCIONARIO';

export interface User {
  id: string;
  name: string;
  password?: string;
  role: UserRole;
  hotel?: HotelType;
  allowedTabs?: ViewType[];
  email?: string;
  status?: 'PENDING' | 'APPROVED';
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
  quotes: MaterialQuote[];
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
  files?: BudgetFile[]; // Added files support
  status: 'Pendente' | 'Aprovado' | 'Rejeitado';
  createdAt: number;
}

export interface UniformItem {
  name: string;
  quantity: number; // For Sector: Standard Qty. For Employee: Held Qty.
  size?: string; // Specific to Employee
  role?: string; // Specific to Sector (which role this uniform belongs to)
  required?: number; // Calculated field for Employee (Standard Qty)
}

export interface Sector {
  id: string;
  name: string;
  standardUniform: UniformItem[];
  roles?: string[]; // Added roles field
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  gender: 'M' | 'F';
  contact: string;
  startDate: string;
  salary: number;
  department: string;
  sectorId: string;
  status: 'Ativo' | 'Inativo';
  scheduleType: '6x1' | '12x36' | 'Intermitente';
  shiftType?: 'Par' | 'Ímpar';
  workingHours: string;
  fixedDayOff: string;
  sundayOffs: number[];
  monthlySundayOff: string;
  weeklyDayOff: string;
  vacationStatus: 'Pendente' | 'Concedida';
  uniforms: UniformItem[];
  photo?: string; // Added photo support (Drive Link)
}

export interface ExtraLabor {
  id: string;
  name: string;
  phone: string;
  availability: string[]; // Dias da semana: ["Segunda", "Terça"...]
  serviceQuality: number; // 0 a 10
  observation: string;
  sectorId: string;
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
  sectorId?: string; // New field for sector organization
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
  recipientId?: string;
  recipientName?: string;
  withdrawalLocation?: string;
}

export interface Integration {
  id: string;
  name: string;
  type: 'Spreadsheet' | 'ExternalAPI';
  status: 'Connected' | 'Disconnected' | 'Pending';
  lastSync?: number;
  url?: string;
}

export interface Vehicle {
  id: string;
  guest_name: string;
  plate: string;
  identifier: string;
  location: string;
  check_out_date: string;
  model?: string;
  color?: string;
  is_on_trip: boolean;
  payment_pending: boolean;
  trip_start?: string;
  check_in_date?: string;
  is_active: boolean;
  deleted_date?: string;
  photos?: string[];
  history?: VehicleHistory[];
}

export interface VehicleHistory {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  action: string;
  timestamp: string;
  user: string;
  details?: string;
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
  acBrand?: 'Midea' | 'LG' | 'Gree';
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
  customAnswers?: Record<string, any>;
}

export type FieldType = 'single_choice' | 'multiple_choice' | 'boolean' | 'number' | 'text';

export interface FormFieldConfig {
  id: string;
  title: string;
  icon: string;
  color: string;
  type: FieldType;
  options?: string[];
}

export interface ParkingLocation {
  id: string;
  name: string;
  totalSpots: number;
}

export interface HotelData {
  apartments: Record<string, Apartment>;
  budgets: Budget[];
  employees: Employee[];
  extras: ExtraLabor[];
  sectors: Sector[];
  inventory: InventoryItem[];
  inventoryHistory: InventoryOperation[];
  suppliers: Supplier[];
  parkingLocations?: ParkingLocation[];
  vehicles?: Vehicle[];
  users?: User[];
  config?: {
    showSuppliersTab: boolean;
    apartmentChecklist?: FormFieldConfig[];
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
  users?: User[];
}
