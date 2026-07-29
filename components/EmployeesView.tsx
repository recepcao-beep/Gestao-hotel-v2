
import React, { useState, useRef, useMemo, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import villageInnLogoUrl from '../village-inn-logo.png';
import { Employee, Sector, HotelTheme, UniformItem, ExtraLabor, InventoryOperation, EmployeeHistoryEntry, EmployeeTagDefinition } from '../types';
import { compressImage } from '../utils/imageUtils';
import Logo from './Logo';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

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
  PhoneOff,
  Settings,
  List,
  AlertCircle,
  ShoppingCart,
  Upload,
  Sun,
  Sunset,
  Moon,
  Users,
  Mars,
  Venus,
  Tag,
  SlidersHorizontal,
  RotateCcw
} from 'lucide-react';

type ShiftPeriod = 'MANHA' | 'TARDE' | 'MADRUGADA';
type ShiftPeriodFilter = 'TODOS' | ShiftPeriod;
type GenderFilter = 'TODOS' | 'M' | 'F';
type ScheduleType = Employee['scheduleType'];
type ScheduleTypeFilter = 'TODOS' | ScheduleType;

const EMPLOYEE_TAG_COLORS = [
  { name: 'Azul', value: '#2563eb' },
  { name: 'Azul claro', value: '#0284c7' },
  { name: 'Roxo', value: '#7c3aed' },
  { name: 'Rosa', value: '#db2777' },
  { name: 'Vermelho', value: '#e11d48' },
  { name: 'Amarelo', value: '#d97706' },
  { name: 'Verde', value: '#059669' },
  { name: 'Turquesa', value: '#0f766e' },
  { name: 'Cinza', value: '#475569' },
] as const;

const normalizeTagLabel = (value?: string) => String(value || '').trim().toUpperCase();

const colorWithAlpha = (color: string, alpha: number) => {
  const hex = color.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return `rgba(71, 85, 105, ${alpha})`;
  const numeric = Number.parseInt(hex, 16);
  return `rgba(${(numeric >> 16) & 255}, ${(numeric >> 8) & 255}, ${numeric & 255}, ${alpha})`;
};

const getTagStyle = (color?: string) => {
  const resolvedColor = color || EMPLOYEE_TAG_COLORS[0].value;
  return {
    color: resolvedColor,
    borderColor: colorWithAlpha(resolvedColor, 0.55),
    backgroundColor: colorWithAlpha(resolvedColor, 0.1),
  };
};

const normalizeEmployeeTagDefinitions = (tags: EmployeeTagDefinition[] = []) => Array.from(
  new Map(
    tags
      .map(tag => ({
        label: normalizeTagLabel(tag?.label),
        color: tag?.color || EMPLOYEE_TAG_COLORS[0].value,
      }))
      .filter(tag => tag.label)
      .map(tag => [tag.label, tag] as const)
  ).values()
).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }));

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
  onSaveEmployeesBulk: (employees: Employee[]) => void;
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
  onSaveEmployeesBulk,
  onDeleteSector 
}) => {
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isAddingExtra, setIsAddingExtra] = useState(false);
  const [editingExtra, setEditingExtra] = useState<ExtraLabor | null>(null);
  
  // Sector Management State
  const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [sectorToDelete, setSectorToDelete] = useState<Sector | null>(null);
  const [sectorName, setSectorName] = useState('');
  const [sectorRoles, setSectorRoles] = useState<string[]>([]);
  const [sectorRoleSalaries, setSectorRoleSalaries] = useState<Record<string, number>>({});
  const [roleRenameFrom, setRoleRenameFrom] = useState('');
  const [roleRenameTo, setRoleRenameTo] = useState('');
  const [newRole, setNewRole] = useState('');
  const [sectorUniforms, setSectorUniforms] = useState<UniformItem[]>([]);
  const [newSectorUniformName, setNewSectorUniformName] = useState('');
  const [newSectorUniformQty, setNewSectorUniformQty] = useState(1);
  const [newSectorUniformRole, setNewSectorUniformRole] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [shiftPeriodFilter, setShiftPeriodFilter] = useState<ShiftPeriodFilter>('TODOS');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('TODOS');
  const [roleFilter, setRoleFilter] = useState('TODOS');
  const [tagFilter, setTagFilter] = useState('TODOS');
  const [scheduleTypeFilter, setScheduleTypeFilter] = useState<ScheduleTypeFilter>('TODOS');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'LIST' | 'SCALE' | 'TODAY' | 'EXTRAS' | 'ORDERS' | 'WEEKLY_SCALE'>('LIST');
  const [scaleView, setScaleView] = useState<'YEAR' | 'MONTH'>('YEAR');
  const [activeFormTab, setActiveFormTab] = useState<'DADOS' | 'ESCALA' | 'UNIFORMES'>('DADOS');
  const [selectedBadge, setSelectedBadge] = useState<Employee | null>(null);
  const [viewingHistoryEmployee, setViewingHistoryEmployee] = useState<Employee | null>(null);

  // Scale Date State
  const [scaleDate, setScaleDate] = useState(new Date());
  const [isDownloadingScale, setIsDownloadingScale] = useState(false);
  const [hpoUploaded, setHpoUploaded] = useState(false);
  const [weeklyScaleData, setWeeklyScaleData] = useState<any[]>([]);

  const handleHpoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert("Por favor, selecione um arquivo PDF.");
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }

      console.log("PDF Text Extracted:", fullText);

      // Regex to find: Date UHs Int Ocupação Disponível Pax CheckIn WalkIn CheckOut
      const rowRegex = /(\d{2}\s*\/\s*\d{2}\s*\/\s*\d{2,4})\s+(\d+)\s+(\d+)\s+(\d+(?:\s*\(\s*[\d.,\s]+%?\s*\))?)\s+(\d+(?:\s*\(\s*[\d.,\s]+%?\s*\))?)\s+((?:\d+\s*\/\s*)*\d+)\s+(\d+)\s+(\d+)\s+(\d+)/g;
      const matches = [...fullText.matchAll(rowRegex)];
      
      console.log("Matches found:", matches.length);

      const parsedData = matches.map(match => {
        const dateStr = match[1].replace(/\s/g, ''); // DD/MM/YY
        const checkIn = parseInt(match[7], 10);
        const checkOut = parseInt(match[9], 10);
        
        // Convert DD/MM/YY to Date object
        const [day, month, year] = dateStr.split('/');
        const fullYear = year.length === 2 ? parseInt(year) + 2000 : parseInt(year);
        const dateObj = new Date(fullYear, parseInt(month) - 1, parseInt(day));
        
        const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const weekday = weekdays[dateObj.getDay()];
        
        const formattedDate = `${weekday} ${day}/${month}/${fullYear}`;

        return {
          date: formattedDate,
          in: checkIn,
          out: checkOut,
          shifts: [] as string[]
        };
      });

      // Generate shifts based on actual employees and their schedules
      const sectorEmployees = employees.filter(emp => emp.sectorId === currentSector?.id);
      
      if (parsedData.length > 0) {
        parsedData.forEach(day => {
          const dateParts = day.date.split(' ')[1].split('/'); // "Segunda-feira 09/03/2026" -> "09/03/2026"
          const yearPart = dateParts[2].length === 2 ? parseInt(dateParts[2]) + 2000 : parseInt(dateParts[2]);
          const dateObj = new Date(yearPart, parseInt(dateParts[1]) - 1, parseInt(dateParts[0]));
          
          const workingEmps: Employee[] = [];
          const offEmps: Employee[] = [];

          sectorEmployees.forEach(emp => {
            let isWorking = false;
            if (emp.scheduleType === '12x36') {
              const dayOfMonth = dateObj.getDate();
              if (emp.shiftType === 'Par') {
                isWorking = dayOfMonth % 2 === 0;
              } else if (emp.shiftType === 'Ímpar') {
                isWorking = dayOfMonth % 2 !== 0;
              } else {
                // Fallback if shiftType is not set, we can use startDate or default to Par
                if (emp.startDate) {
                  const start = new Date(emp.startDate + 'T00:00:00');
                  const current = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
                  const diffTime = current.getTime() - start.getTime();
                  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                  isWorking = Math.abs(diffDays) % 2 === 0;
                } else {
                  isWorking = dayOfMonth % 2 === 0;
                }
              }
            } else if (emp.scheduleType === '6x1') {
              const dayOfWeek = dateObj.getDay();
              const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
              const dayName = weekdays[dayOfWeek];

              if (dayOfWeek === 0) {
                const nthSunday = Math.ceil(dateObj.getDate() / 7);
                if (emp.sundayOffs && emp.sundayOffs.includes(nthSunday)) {
                  isWorking = false;
                } else if (emp.fixedDayOff === 'Domingo') {
                  isWorking = false;
                } else {
                  isWorking = true;
                }
              } else {
                if (emp.fixedDayOff === dayName) {
                  isWorking = false;
                } else {
                  isWorking = true;
                }
              }
            } else {
              // Intermitente
              isWorking = false;
            }

            if (isWorking) {
              workingEmps.push(emp);
            } else {
              offEmps.push(emp);
            }
          });

          // Base shifts
          const scheduledShifts = new Set<string>();
          day.shifts = workingEmps.map(emp => {
            const shiftTime = emp.workingHours || '08:00-16:20';
            scheduledShifts.add(shiftTime);
            return `${shiftTime} - ${emp.name.split(' ')[0]}`;
          });

          // Ensure all unique working hours in the sector are covered
          const allSectorShifts = new Set<string>(sectorEmployees.map(e => e.workingHours || '08:00-16:20'));
          allSectorShifts.forEach(shiftTime => {
            if (!scheduledShifts.has(shiftTime)) {
              // We need an extra for this shift
              const availableExtraIndex = offEmps.findIndex(e => !day.shifts.some(s => s.includes(e.name.split(' ')[0])));
              if (availableExtraIndex !== -1) {
                const extraEmp = offEmps[availableExtraIndex];
                day.shifts.push(`${shiftTime} - ${extraEmp.name.split(' ')[0]} (Extra)`);
                // Remove from offEmps so they aren't used again for another missing shift
                offEmps.splice(availableExtraIndex, 1);
              } else {
                day.shifts.push(`${shiftTime} - Extra (Não definido)`);
              }
            }
          });

          // Rule: If checkIn > 50, add up to 2 off employees (preferably receptionists) from 14:00-19:00
          if (day.in > 50) {
            let availableExtras = offEmps.filter(e => e.role.toLowerCase().includes('recep') && !day.shifts.some(s => s.includes(e.name.split(' ')[0])));
            if (availableExtras.length < 2) {
               const others = offEmps.filter(e => !e.role.toLowerCase().includes('recep') && !day.shifts.some(s => s.includes(e.name.split(' ')[0])));
               availableExtras = [...availableExtras, ...others];
            }
            
            const selectedExtras = availableExtras.slice(0, 2);
            selectedExtras.forEach(emp => {
              day.shifts.push(`14:00-19:00 - ${emp.name.split(' ')[0]} (Extra)`);
            });
          }
          
          // Sort shifts chronologically
          day.shifts.sort((a, b) => {
            const timeA = a.split('-')[0].trim();
            const timeB = b.split('-')[0].trim();
            return timeA.localeCompare(timeB);
          });
          
          // Fallback if no employees are registered in the sector
          if (sectorEmployees.length === 0) {
             day.shifts.push("Sem funcionários cadastrados neste setor");
          }
        });
        
        setWeeklyScaleData(parsedData);
        setHpoUploaded(true);
      } else {
        alert("Não foi possível encontrar dados de ocupação no PDF. Verifique o formato do arquivo.");
      }
    } catch (error) {
      console.error("Error parsing PDF:", error);
      alert("Erro ao ler o arquivo PDF.");
    }
  };

  // Form State Employee
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState('');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [contact, setContact] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [salary, setSalary] = useState('');
  const [scheduleType, setScheduleType] = useState<ScheduleType>('6x1');
  const [shiftType, setShiftType] = useState<'Par' | 'Ímpar'>('Par');
  const [shiftPeriod, setShiftPeriod] = useState<ShiftPeriod>('MANHA');
  const [workingHours, setWorkingHours] = useState('08:00 - 16:20');
  const [fixedDayOff, setFixedDayOff] = useState('Segunda-feira');
  const [sundayOffs, setSundayOffs] = useState<number[]>([]);
  const [hourlyWorkDays, setHourlyWorkDays] = useState<string[]>([]);
  const [hourlyDaysOff, setHourlyDaysOff] = useState<number[]>([]);
  const [vacationStatus, setVacationStatus] = useState<'Pendente' | 'Concedida' | 'Férias Atuais'>('Pendente');
  const [vacationStart, setVacationStart] = useState('');
  const [vacationDays, setVacationDays] = useState(30);
  const [vacationAccrualStart, setVacationAccrualStart] = useState('');
  const [vacationDeadline, setVacationDeadline] = useState('');
  const [bankHoursDaysOff, setBankHoursDaysOff] = useState<string[]>([]);
  const [newBankHoursDay, setNewBankHoursDay] = useState('');
  const [tagText, setTagText] = useState('');
  const [tagColor, setTagColor] = useState<string>(EMPLOYEE_TAG_COLORS[0].value);
  
  // Uniforms State (Employee)
  const [uniforms, setUniforms] = useState<UniformItem[]>([]);
  
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

  const weekDays = ['Segunda-feira', 'Terca-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sabado', 'Domingo'];
  const weekdaysFull = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERCA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SABADO'];
  const weekdaysShort = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
  const monthCircleLabels = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  const shiftPeriodOptions: { value: ShiftPeriod; label: string; Icon: React.ElementType }[] = [
    { value: 'MANHA', label: 'Manha', Icon: Sun },
    { value: 'TARDE', label: 'Tarde', Icon: Sunset },
    { value: 'MADRUGADA', label: 'Madrugada', Icon: Moon },
  ];
  const genderFilterOptions: { value: GenderFilter; label: string; Icon: React.ElementType }[] = [
    { value: 'TODOS', label: 'Todos', Icon: Users },
    { value: 'M', label: 'Masculino', Icon: Mars },
    { value: 'F', label: 'Feminino', Icon: Venus },
  ];

  const normalizeRoleName = (value?: string) => String(value || '').trim().toUpperCase();

  const getSortedUniqueRoles = (roles: string[] = []) => Array.from(
    new Map(
      roles
        .map(roleName => normalizeRoleName(roleName))
        .filter(Boolean)
        .map(roleName => [roleName, roleName])
    ).values()
  ).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));

  const normalizeWeekday = (value?: string) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/^SEGUNDA$/, 'SEGUNDA-FEIRA')
    .replace(/^TERCA$/, 'TERCA-FEIRA')
    .replace(/^QUARTA$/, 'QUARTA-FEIRA')
    .replace(/^QUINTA$/, 'QUINTA-FEIRA')
    .replace(/^SEXTA$/, 'SEXTA-FEIRA')
    .replace(/^SABADO$/, 'SABADO');

  const getEmployeeShiftPeriod = (emp: Employee): ShiftPeriod => {
    const value = (emp.shiftPeriod || '').toString().toUpperCase();
    if (value === 'TARDE' || value === 'MADRUGADA' || value === 'MANHA') return value as ShiftPeriod;
    const hourMatch = String(emp.workingHours || '').match(/(\d{1,2})\s*:/);
    const hour = hourMatch ? Number(hourMatch[1]) : NaN;
    if (Number.isFinite(hour)) {
      if (hour < 6 || hour >= 22) return 'MADRUGADA';
      if (hour >= 12) return 'TARDE';
    }
    return 'MANHA';
  };

  const getShiftPeriodMeta = (value: ShiftPeriod) =>
    shiftPeriodOptions.find(option => option.value === value) || shiftPeriodOptions[0];

  const parseLocalDate = (value?: string, endOfDay = false) => {
    if (!value) return null;
    const date = new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}`);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const isVacationRegistered = (emp: Employee) => emp.scheduleType !== 'Intermitente' && Boolean(emp.vacationStatus && emp.vacationStatus !== 'Pendente');

  const getVacationDueInfo = (emp: Employee) => {
    if (emp.scheduleType === 'Intermitente') return null;
    const deadline = parseLocalDate(emp.vacationDeadline, true);
    if (!deadline) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return { label: 'Ferias vencidas', tone: 'danger' as const };
    if (diffDays <= 60) return { label: `Ferias vencem em ${diffDays} dias`, tone: 'warning' as const };
    return { label: `Limite ferias ${formatShortDate(emp.vacationDeadline)}`, tone: 'neutral' as const };
  };

  const getVacationDaysInMonth = (emp: Employee, year: number, month: number) => {
    if (!isVacationRegistered(emp) || !emp.vacationStart || !emp.vacationEnd) return 0;
    const vacationStartDate = parseLocalDate(emp.vacationStart);
    const vacationEndDate = parseLocalDate(emp.vacationEnd, true);
    if (!vacationStartDate || !vacationEndDate) return 0;

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
    const overlapStart = new Date(Math.max(monthStart.getTime(), vacationStartDate.getTime()));
    const overlapEnd = new Date(Math.min(monthEnd.getTime(), vacationEndDate.getTime()));

    if (overlapStart > overlapEnd) return 0;
    return Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 86400000) + 1;
  };

  const formatShortDate = (value?: string) => {
    const date = parseLocalDate(value);
    return date ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
  };

  const formatDateInputValue = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const addDaysToInputDate = (value?: string, days = 0) => {
    const date = parseLocalDate(value);
    if (!date) return '';
    date.setDate(date.getDate() + days);
    return formatDateInputValue(date);
  };

  const getVacationDayCount = (start?: string, end?: string) => {
    const startDate = parseLocalDate(start);
    const endDate = parseLocalDate(end);
    if (!startDate || !endDate || endDate < startDate) return 0;
    return Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  };

  const getVacationEndFromStartAndDays = (start?: string, days = 0) => {
    const normalizedDays = Math.floor(Number(days) || 0);
    if (!start || normalizedDays < 1) return '';
    return addDaysToInputDate(start, normalizedDays - 1);
  };

  const getVacationReturnDateFromEnd = (end?: string) => end ? addDaysToInputDate(end, 1) : '';

  const formVacationEnd = getVacationEndFromStartAndDays(vacationStart, vacationDays);
  const formVacationReturn = getVacationReturnDateFromEnd(formVacationEnd);

  const getVacationBadgeText = (emp: Employee) => {
    if (!isVacationRegistered(emp)) return '';
    const start = formatShortDate(emp.vacationStart);
    const days = emp.vacationDays || getVacationDayCount(emp.vacationStart, emp.vacationEnd);
    const returnDate = getVacationReturnDateFromEnd(emp.vacationEnd);
    return start && days ? `Ferias ${start} - ${days} dias - Volta ${formatShortDate(returnDate)}` : 'Ferias';
  };

  const getVacationReturnLabel = (emp: Employee) => {
    const returnDate = getVacationReturnDateFromEnd(emp.vacationEnd);
    return returnDate ? `VOLTA ${formatShortDate(returnDate)}` : '';
  };

  const isEmployeeOnVacationToday = (emp: Employee) => {
    if (emp.status !== 'Ativo' || !isVacationRegistered(emp)) return false;
    const start = parseLocalDate(emp.vacationStart);
    const end = parseLocalDate(emp.vacationEnd, true);
    if (!start || !end) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today >= start && today <= end;
  };

  const getBankHoursDates = (emp: Employee) => Array.from(new Set(emp.bankHoursDaysOff || []))
    .filter((value) => Boolean(parseLocalDate(value)))
    .sort();

  const getBankHoursDaysInMonth = (emp: Employee, year: number, month: number) => {
    const datedDays = getBankHoursDates(emp).filter((value) => {
      const date = parseLocalDate(value);
      return date?.getFullYear() === year && date.getMonth() === month;
    }).length;
    if (datedDays > 0 || getBankHoursDates(emp).length > 0) return datedDays;
    return getBankHoursDays(emp);
  };

  const employeeAppearsInMonthlyScale = (emp: Employee) => emp.scheduleType === '6x1' || emp.scheduleType === 'Horista';

  const getScheduleSummary = (emp: Employee) => {
    if (emp.scheduleType === 'Intermitente') return 'Intermitente';
    if (emp.scheduleType === '12x36') return '12x36';
    if (emp.scheduleType === 'Horista') {
      const days = (emp.hourlyWorkDays || []).map(day => normalizeWeekday(day).slice(0, 3)).filter(Boolean).join(', ');
      return days ? `Horista: ${days}` : 'Horista sem dias';
    }
    return `Folga: ${emp.fixedDayOff || 'Rodizio'}`;
  };

  const getBankHoursDays = (emp: Employee) => {
    const data = emp as unknown as Record<string, any>;
    const rawValue = data.bankHoursDays ?? data.timeBankDays ?? data.bancoHorasDias ?? data.bancoDeHorasDias ?? data.bankHours;
    const parsedValue = Number(rawValue);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
  };

  const formatMoneyValue = (value?: number | string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed)
      ? parsed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : '-';
  };

  const getRoleSalary = (roleName?: string, sector?: Sector) => {
    const normalizedRole = normalizeRoleName(roleName);
    const value = sector?.roleSalaries?.[normalizedRole];
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  const createHistoryEntry = (field: string, before: string, after: string, source = 'Cadastro do colaborador'): EmployeeHistoryEntry => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    field,
    before,
    after,
    source,
  });

  const withEmployeeHistory = (emp: Employee, entries: EmployeeHistoryEntry[]) => ({
    ...emp,
    history: [...(emp.history || []), ...entries].slice(-200),
  });

  const describeValue = (value: any, formatter?: (value: any) => string) => {
    if (formatter) return formatter(value);
    if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
    if (value === undefined || value === null || value === '') return '-';
    return String(value);
  };

  const buildEmployeeChangeHistory = (before: Employee | null, after: Employee, source = 'Cadastro do colaborador') => {
    if (!before) {
      return [createHistoryEntry('Cadastro', '-', 'Colaborador criado', source)];
    }
    const fields: Array<[keyof Employee, string, ((value: any) => string)?]> = [
      ['name', 'Nome'],
      ['role', 'Função'],
      ['gender', 'Sexo'],
      ['contact', 'Telefone'],
      ['startDate', 'Data de admissão'],
      ['salary', 'Salário', formatMoneyValue],
      ['scheduleType', 'Regime'],
      ['shiftType', 'Padrão 12x36'],
      ['shiftPeriod', 'Turno'],
      ['workingHours', 'Horário'],
      ['fixedDayOff', 'Folga fixa'],
      ['sundayOffs', 'Domingos'],
      ['hourlyWorkDays', 'Dias horista'],
      ['hourlyDaysOff', 'Folgas horista'],
      ['bankHoursDaysOff', 'Folgas - banco de horas'],
      ['vacationStatus', 'Status de férias'],
      ['vacationStart', 'Início das férias'],
      ['vacationEnd', 'Fim das férias'],
      ['vacationDays', 'Dias de férias'],
      ['vacationAccrualStart', 'Início aquisitivo'],
      ['vacationDeadline', 'Limite de férias'],
      ['tagText', 'Etiqueta'],
      ['tagColor', 'Cor da etiqueta'],
    ];
    const entries = fields.flatMap(([key, label, formatter]) => {
      const previous = describeValue(before[key], formatter);
      const next = describeValue(after[key], formatter);
      return previous !== next ? [createHistoryEntry(label, previous, next, source)] : [];
    });
    const beforeUniforms = JSON.stringify((before.uniforms || []).map(item => ({ name: item.name, quantity: item.quantity, size: item.size })));
    const afterUniforms = JSON.stringify((after.uniforms || []).map(item => ({ name: item.name, quantity: item.quantity, size: item.size })));
    if (beforeUniforms !== afterUniforms) {
      entries.push(createHistoryEntry('Uniformes', `${before.uniforms?.length || 0} itens`, `${after.uniforms?.length || 0} itens`, source));
    }
    if ((before.photo || '') !== (after.photo || '')) {
      entries.push(createHistoryEntry('Foto', before.photo ? 'Com foto' : 'Sem foto', after.photo ? 'Com foto' : 'Sem foto', source));
    }
    return entries;
  };

  // --- Effects ---
  
  // Sync Uniform Standards when Role or Sector Changes in Employee Modal
  useEffect(() => {
    if (!isAddingEmployee) return;
    
    // Find current sector definition
    const sectorId = selectedSectorId || editingEmployee?.sectorId;
    const sec = sectors.find(s => s.id === sectorId);
    if (!sec || !role) return;

    // Get standards for this role
    const standards = (sec.standardUniform || []).filter(u => u.role === role);
    
    setUniforms(prev => {
        // Merge standards with existing values (preserving held quantity/size if item exists)
        return standards.map(std => {
            const existing = prev.find(p => p.name === std.name);
            return {
                name: std.name,
                // If existing, use its held quantity, otherwise 0
                quantity: existing ? existing.quantity : 0,
                // Keep existing size if present
                size: existing?.size || '',
                // Required comes from Sector Standard
                required: std.quantity,
                // Keep role ref
                role: role
            };
        });
    });
  }, [role, selectedSectorId, editingEmployee, isAddingEmployee, sectors]);


  const resetEmployeeForm = () => {
    setName(''); setRole(''); setNewEmployeeRole(''); setGender('M'); setContact(''); setSalary('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setUniforms([]); setScheduleType('6x1'); setShiftType('Par');
    setShiftPeriod('MANHA');
    setWorkingHours('08:00 - 16:20'); setFixedDayOff('Segunda-feira');
    setSundayOffs([]); setHourlyWorkDays([]); setHourlyDaysOff([]); setVacationStatus('Pendente');
    setVacationStart(''); setVacationDays(30); setVacationAccrualStart(''); setVacationDeadline('');
    setBankHoursDaysOff([]); setNewBankHoursDay('');
    setTagText(''); setTagColor(EMPLOYEE_TAG_COLORS[0].value);
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
    setSectorRoleSalaries({});
    setRoleRenameFrom('');
    setRoleRenameTo('');
    setNewRole('');
    setSectorUniforms([]);
    setNewSectorUniformName('');
    setNewSectorUniformQty(1);
    setNewSectorUniformRole('');
    setEditingSector(null);
    setIsSectorModalOpen(false);
  };

  const handleEditSector = (sec: Sector) => {
    setEditingSector(sec);
    setSectorName(sec.name);
    setSectorRoles(getSortedUniqueRoles(sec.roles || []));
    setSectorRoleSalaries(sec.roleSalaries || {});
    setRoleRenameFrom('');
    setRoleRenameTo('');
    setSectorUniforms(sec.standardUniform || []);
    setIsSectorModalOpen(true);
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setName(emp.name || ''); 
    // Important: Set Role first to trigger effect, but we need the existing uniforms to merge correctly
    setRole(emp.role || ''); 
    setNewEmployeeRole('');
    setGender(emp.gender || 'M');
    setContact(emp.contact || ''); setStartDate(emp.startDate || ''); setSalary((emp.salary || 0).toString());
    
    // We preload existing uniforms so the Effect can merge them
    setUniforms(emp.uniforms || []); 
    
    setScheduleType(emp.scheduleType || '6x1');
    setShiftType(emp.shiftType || 'Par'); setShiftPeriod(getEmployeeShiftPeriod(emp)); setWorkingHours(emp.workingHours || '08:00 - 16:20');
    setFixedDayOff(emp.fixedDayOff || 'Segunda-feira');
    setSundayOffs(emp.sundayOffs || []);
    setHourlyWorkDays(emp.hourlyWorkDays || []);
    setHourlyDaysOff(emp.hourlyDaysOff || []);
    setVacationStatus(emp.vacationStatus || 'Pendente');
    setVacationStart(emp.vacationStart || '');
    setVacationDays(emp.vacationDays || getVacationDayCount(emp.vacationStart, emp.vacationEnd) || 30);
    setVacationAccrualStart(emp.vacationAccrualStart || '');
    setVacationDeadline(emp.vacationDeadline || '');
    setBankHoursDaysOff(getBankHoursDates(emp));
    setNewBankHoursDay('');
    setTagText(emp.tagText || '');
    setTagColor(emp.tagColor || EMPLOYEE_TAG_COLORS[0].value);
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressedDataUrl = await compressImage(file, 512, 512, 0.7);
      
      const fullBase64 = compressedDataUrl;
      const base64Data = fullBase64.split(',')[1] || '';
      const mimeType = fullBase64.split(':')[1].split(';')[0] || file.type;
      
      setPhotoPreview(fullBase64);
      setNewPhotoFile({ data: base64Data, mimeType: mimeType, fileName: file.name });
      setIsPhotoRemoved(false);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setNewPhotoFile(null);
    setIsPhotoRemoved(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpdateEmployeeUniform = (index: number, field: 'quantity' | 'size', value: any) => {
    const newArr = [...uniforms];
    newArr[index] = { ...newArr[index], [field]: value };
    setUniforms(newArr);
  };

  // Sector Modal Handlers
  const handleAddSectorRole = () => {
    const roleName = normalizeRoleName(newRole);
    if(!roleName) return;
    setSectorRoles(getSortedUniqueRoles([...sectorRoles, roleName]));
    setSectorRoleSalaries(prev => ({ ...prev, [roleName]: prev[roleName] || 0 }));
    setNewRole('');
  };

  const handleAddEmployeeRoleToSector = () => {
    const roleName = normalizeRoleName(newEmployeeRole);
    if (!currentSector || !roleName) return;
    const updatedRoles = getSortedUniqueRoles([...(currentSector.roles || []), roleName]);
    onSaveSector({ ...currentSector, roles: updatedRoles });
    setRole(roleName);
    setNewEmployeeRole('');
  };

  const handleRemoveSectorRole = (index: number) => {
    const newArr = [...sectorRoles];
    const removedRole = newArr[index];
    newArr.splice(index, 1);
    setSectorRoles(newArr);
    setSectorRoleSalaries(prev => {
      const next = { ...prev };
      delete next[removedRole];
      return next;
    });
  };

  const handleAddSectorUniform = () => {
    if(!newSectorUniformName.trim() || !newSectorUniformRole) return;
    setSectorUniforms([...sectorUniforms, { 
        name: newSectorUniformName, 
        quantity: newSectorUniformQty,
        role: newSectorUniformRole
    }]);
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
    const sectorId = editingSector?.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const renameFrom = normalizeRoleName(roleRenameFrom);
    const renameTo = normalizeRoleName(roleRenameTo);
    const shouldRenameRole = Boolean(editingSector && renameFrom && renameTo && renameFrom !== renameTo);
    const nextRoles = getSortedUniqueRoles(
      sectorRoles.map(roleName => shouldRenameRole && roleName === renameFrom ? renameTo : roleName)
    );
    const nextRoleSalaries = nextRoles.reduce<Record<string, number>>((acc, roleName) => {
      const sourceRole = shouldRenameRole && roleName === renameTo ? renameFrom : roleName;
      const salaryValue = Number(sectorRoleSalaries[roleName] ?? sectorRoleSalaries[sourceRole]) || 0;
      if (salaryValue > 0) acc[roleName] = salaryValue;
      return acc;
    }, {});
    const nextUniforms = sectorUniforms.map(item => ({
      ...item,
      role: shouldRenameRole && normalizeRoleName(item.role) === renameFrom ? renameTo : item.role
    }));
    onSaveSector({
      id: sectorId,
      name: sectorName.trim(),
      standardUniform: nextUniforms,
      roles: nextRoles,
      roleSalaries: nextRoleSalaries,
      employeeTags: editingSector?.employeeTags || []
    });
    const updatedEmployees = employees
      .filter(emp => emp.sectorId === sectorId)
      .map(emp => {
        const originalRole = normalizeRoleName(emp.role);
        let updatedEmp = { ...emp };
        const entries: EmployeeHistoryEntry[] = [];
        if (shouldRenameRole && originalRole === renameFrom) {
          updatedEmp = { ...updatedEmp, role: renameTo };
          entries.push(createHistoryEntry('Função', emp.role || '-', renameTo, 'Configuração do setor'));
        }
        const roleSalary = nextRoleSalaries[normalizeRoleName(updatedEmp.role)];
        if (updatedEmp.scheduleType !== 'Intermitente' && roleSalary > 0 && Number(updatedEmp.salary) !== roleSalary) {
          entries.push(createHistoryEntry('Salário', formatMoneyValue(updatedEmp.salary), formatMoneyValue(roleSalary), 'Configuração do setor'));
          updatedEmp = { ...updatedEmp, salary: roleSalary };
        }
        return entries.length ? withEmployeeHistory(updatedEmp, entries) : null;
      })
      .filter((emp): emp is Employee => Boolean(emp));
    if (updatedEmployees.length > 0) {
      onSaveEmployeesBulk(updatedEmployees);
    }
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

    const selectedRole = normalizeRoleName(role);
    const activeSector = currentSector || sectors.find(sec => sec.id === (editingEmployee?.sectorId || selectedSectorId));
    const normalizedTagText = normalizeTagLabel(tagText);
    if (activeSector) {
      const updatedRoles = getSortedUniqueRoles([...(activeSector.roles || []), selectedRole]);
      const existingTags = normalizeEmployeeTagDefinitions(activeSector.employeeTags || []);
      const updatedTags = normalizedTagText
        ? normalizeEmployeeTagDefinitions([
            ...existingTags.filter(tag => tag.label !== normalizedTagText),
            { label: normalizedTagText, color: tagColor || EMPLOYEE_TAG_COLORS[0].value },
          ])
        : existingTags;
      const rolesChanged = updatedRoles.join('|') !== getSortedUniqueRoles(activeSector.roles || []).join('|');
      const tagsChanged = JSON.stringify(updatedTags) !== JSON.stringify(existingTags);
      if (rolesChanged || tagsChanged) {
        onSaveSector({ ...activeSector, roles: updatedRoles, employeeTags: updatedTags });
      }
    }
    const normalizedVacationDays = Math.floor(Number(vacationDays) || 0);
    const shouldSaveVacationPeriod = scheduleType !== 'Intermitente' && vacationStatus !== 'Pendente' && vacationStart && normalizedVacationDays > 0;
    const calculatedVacationEnd = shouldSaveVacationPeriod ? getVacationEndFromStartAndDays(vacationStart, normalizedVacationDays) : '';
    const roleSalary = scheduleType === 'Intermitente' ? 0 : getRoleSalary(selectedRole, activeSector);

    const employeeDraft: Employee = {
      id: editingEmployee?.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: (name || 'Sem Nome').toUpperCase(), 
      role: selectedRole || 'CARGO',
      gender, 
      contact, 
      startDate,
      salary: scheduleType === 'Intermitente' ? 0 : roleSalary || parseFloat(salary) || 0,
      department: sectors.find(s => s.id === (selectedSectorId || editingEmployee?.sectorId))?.name || 'Geral',
      sectorId: (selectedSectorId || editingEmployee?.sectorId)!, 
      status: 'Ativo', 
      scheduleType, 
      shiftType: scheduleType === '12x36' ? shiftType : undefined,
      shiftPeriod: scheduleType === 'Intermitente' ? undefined : shiftPeriod,
      workingHours: scheduleType === 'Intermitente' ? '' : workingHours,
      fixedDayOff: scheduleType === '6x1' ? fixedDayOff : '', 
      sundayOffs: scheduleType === '6x1' || scheduleType === 'Horista' ? sundayOffs : [],
      hourlyWorkDays: scheduleType === 'Horista' ? hourlyWorkDays : [],
      hourlyDaysOff: scheduleType === 'Horista' ? hourlyDaysOff : [],
      weeklyDayOff: scheduleType === '6x1' ? fixedDayOff : '', 
      monthlySundayOff: '', 
      vacationStatus: scheduleType === 'Intermitente' ? 'Pendente' : vacationStatus,
      vacationStart: shouldSaveVacationPeriod ? vacationStart : undefined,
      vacationEnd: shouldSaveVacationPeriod ? calculatedVacationEnd : undefined,
      vacationDays: shouldSaveVacationPeriod ? normalizedVacationDays : 0,
      vacationAccrualStart: scheduleType === 'Intermitente' ? undefined : vacationAccrualStart || undefined,
      vacationDeadline: scheduleType === 'Intermitente' ? undefined : vacationDeadline || undefined,
      bankHoursDaysOff: scheduleType === 'Intermitente' ? [] : Array.from(new Set<string>(bankHoursDaysOff)).sort(),
      uniforms,
      history: editingEmployee?.history || [],
      tagText: normalizedTagText,
      tagColor: tagColor || EMPLOYEE_TAG_COLORS[0].value,
      photo: finalPhoto
    };
    const historyEntries = buildEmployeeChangeHistory(editingEmployee, employeeDraft);
    const newEmp = historyEntries.length ? withEmployeeHistory(employeeDraft, historyEntries) : employeeDraft;
    
    onSave(newEmp, newPhotoFile ? [newPhotoFile] : undefined);
    resetEmployeeForm();
  };

  const handleSaveExtraSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveExtra({
      id: editingExtra?.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: extraName.toUpperCase(),
      phone: extraPhone,
      availability: extraAvailability,
      serviceQuality: extraQuality,
      observation: extraObservation,
      sectorId: selectedSectorId || editingExtra?.sectorId || '',
      doNotCall: editingExtra?.doNotCall || false
    });
    resetExtraForm();
  };

  const currentSector = sectors.find(s => s.id === selectedSectorId);
  const currentSectorRoles = useMemo(() => getSortedUniqueRoles(currentSector?.roles || []), [currentSector]);
  const availableEmployeeRoles = useMemo(() => getSortedUniqueRoles([...currentSectorRoles, role]), [currentSectorRoles, role]);
  const roleFilterOptions = useMemo(() => getSortedUniqueRoles([
    ...currentSectorRoles,
    ...employees
      .filter(emp => emp.sectorId === selectedSectorId)
      .map(emp => emp.role)
  ]), [currentSectorRoles, employees, selectedSectorId]);
  const savedTagOptions = useMemo(() => normalizeEmployeeTagDefinitions([
    ...employees
      .filter(emp => emp.sectorId === selectedSectorId && normalizeTagLabel(emp.tagText))
      .map(emp => ({ label: normalizeTagLabel(emp.tagText), color: emp.tagColor || EMPLOYEE_TAG_COLORS[0].value })),
    ...(currentSector?.employeeTags || []),
  ]), [currentSector?.employeeTags, employees, selectedSectorId]);
  const tagFilterOptions = useMemo(() => savedTagOptions.map(tag => tag.label), [savedTagOptions]);
  const getEmployeeTagColor = (emp: Employee) =>
    savedTagOptions.find(tag => tag.label === normalizeTagLabel(emp.tagText))?.color
      || emp.tagColor
      || EMPLOYEE_TAG_COLORS[0].value;
  const activeFilterCount = [
    shiftPeriodFilter !== 'TODOS',
    genderFilter !== 'TODOS',
    roleFilter !== 'TODOS',
    tagFilter !== 'TODOS',
    scheduleTypeFilter !== 'TODOS'
  ].filter(Boolean).length;

  useEffect(() => {
    if (roleFilter !== 'TODOS' && !roleFilterOptions.includes(roleFilter)) {
      setRoleFilter('TODOS');
    }
  }, [roleFilter, roleFilterOptions]);

  useEffect(() => {
    if (tagFilter !== 'TODOS' && !tagFilterOptions.includes(tagFilter)) {
      setTagFilter('TODOS');
    }
  }, [tagFilter, tagFilterOptions]);

  useEffect(() => {
    if (!isAddingEmployee || scheduleType === 'Intermitente') return;
    const salaryByRole = getRoleSalary(role, currentSector);
    if (salaryByRole > 0) {
      setSalary(String(salaryByRole));
    }
  }, [role, scheduleType, isAddingEmployee, currentSector?.roleSalaries]);

  const sortedSectors = useMemo(
    () => [...sectors].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' })),
    [sectors]
  );

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
        weekdayShort: weekdaysShort[dayOfWeek],
        weekdayFull: weekdaysFull[dayOfWeek],
        isSunday: dayOfWeek === 0,
        sundayIndex
      };
    });
  }, [scaleDate]);

  const monthOptions = useMemo(() => {
    const base = new Date(scaleDate.getFullYear(), 0, 1);
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(base.getFullYear(), index, 1);
      return {
        value: `${date.getFullYear()}-${String(index + 1).padStart(2, '0')}`,
        label: monthCircleLabels[index],
        longLabel: date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase(),
      };
    });
  }, [scaleDate]);

  const scaleTitle = `ESCALA DE FOLGA ${currentSector?.name || 'FUNCIONARIOS'} DE ${scaleDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}`;

  const formatFixedDay = (value?: string) => normalizeWeekday(value || '-') || '-';

  const getShiftStatus = (emp: Employee, dayInfo: typeof scaleData[0]) => {
    const scaleDay = formatDateInputValue(new Date(scaleDate.getFullYear(), scaleDate.getMonth(), dayInfo.date));
    if (getBankHoursDates(emp).includes(scaleDay)) return 'BC';
    if (isVacationRegistered(emp) && emp.vacationStart && emp.vacationEnd) {
        const date = new Date(scaleDate.getFullYear(), scaleDate.getMonth(), dayInfo.date);
        const vacationStartDate = parseLocalDate(emp.vacationStart);
        const vacationEndDate = parseLocalDate(emp.vacationEnd, true);
        if (!vacationStartDate || !vacationEndDate) return '';
        if (date >= vacationStartDate && date <= vacationEndDate) return 'FÉRIAS';
    }
    if (emp.vacationStatus === 'Concedida' || emp.vacationStatus === 'Férias Atuais') {
        const date = new Date(scaleDate.getFullYear(), scaleDate.getMonth(), dayInfo.date);
        if (emp.vacationStart && emp.vacationEnd) {
             const vStart = new Date(emp.vacationStart + 'T00:00:00');
             const vEnd = new Date(emp.vacationEnd + 'T23:59:59');
             if (date >= vStart && date <= vEnd) return 'FÉRIAS';
        } else {
             return 'FÉRIAS'; 
        }
    }
    if (emp.scheduleType === '6x1') {
      const dayName = normalizeWeekday(dayInfo.weekdayFull).split('-')[0];
      const empOffDay = normalizeWeekday(emp.fixedDayOff).split('-')[0];
      
      if (dayInfo.isSunday) {
        const empSundayOffs = (emp.sundayOffs || []).slice().sort((a, b) => a - b);
        const offIndex = empSundayOffs.indexOf(dayInfo.sundayIndex);
        if (offIndex !== -1) return `D${offIndex + 1}`;
      }
      
      if (dayName === empOffDay && !dayInfo.isSunday) return 'F';
    }
    if (emp.scheduleType === 'Horista') {
      const dayName = normalizeWeekday(dayInfo.weekdayFull);
      const configuredWorkDays = (emp.hourlyWorkDays || []).map(normalizeWeekday);
      const configuredDaysOff = (emp.hourlyDaysOff || []).map(Number);
      const empSundayOffs = (emp.sundayOffs || []).slice().sort((a, b) => a - b);

      if (configuredDaysOff.includes(dayInfo.date)) return 'F';
      if (dayInfo.isSunday && empSundayOffs.includes(dayInfo.sundayIndex)) return `D${empSundayOffs.indexOf(dayInfo.sundayIndex) + 1}`;
      if (configuredWorkDays.length === 0) return 'F';
      if (!configuredWorkDays.includes(dayName)) return 'F';
    }
    return '';
  };

  const downloadScaleExcel = async () => {
    if (isDownloadingScale) return;
    setIsDownloadingScale(true);

    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Gestão Hotel Village Inn';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('VILAGE', {
        pageSetup: {
          orientation: 'landscape',
          paperSize: 9,
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 1,
          margins: { left: 0.2, right: 0.2, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 }
        }
      });
      worksheet.views = [{ showGridLines: false }];

      const dayStartColumn = 6;
      const lastColumn = dayStartColumn + scaleData.length - 1;
      const employeeStartRow = 5;
      const employeeRowCount = Math.max(scaleEmployees.length, 1);
      const employeeEndRow = employeeStartRow + employeeRowCount - 1;
      const thinBorder = {
        top: { style: 'thin', color: { argb: 'FF64748B' } },
        left: { style: 'thin', color: { argb: 'FF64748B' } },
        bottom: { style: 'thin', color: { argb: 'FF64748B' } },
        right: { style: 'thin', color: { argb: 'FF64748B' } }
      } as const;
      const center = { horizontal: 'center', vertical: 'middle', wrapText: true } as const;

      worksheet.getColumn(1).width = 4;
      worksheet.getColumn(2).width = 5;
      worksheet.getColumn(3).width = 38;
      worksheet.getColumn(4).width = 16;
      worksheet.getColumn(5).width = 19;
      for (let column = dayStartColumn; column <= lastColumn; column++) {
        worksheet.getColumn(column).width = 4.2;
      }

      worksheet.getRow(1).height = 31;
      worksheet.getRow(2).height = 31;
      worksheet.getRow(3).height = 78;
      worksheet.getRow(4).height = 25;

      worksheet.mergeCells(1, dayStartColumn, 2, lastColumn);
      const titleCell = worksheet.getCell(1, dayStartColumn);
      titleCell.value = scaleTitle;
      titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF0F172A' } };
      titleCell.alignment = center;

      const logoResponse = await fetch(villageInnLogoUrl);
      if (!logoResponse.ok) throw new Error('Não foi possível carregar a logo do Village Inn.');
      const logoBlob = await logoResponse.blob();
      const logoBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(logoBlob);
      });
      const logoId = workbook.addImage({ base64: logoBase64, extension: 'png' });
      worksheet.addImage(logoId, {
        tl: { col: 0.35, row: 0.55 },
        ext: { width: 210, height: 54 }
      });

      scaleData.forEach((day, index) => {
        const column = dayStartColumn + index;
        const weekdayCell = worksheet.getCell(3, column);
        weekdayCell.value = day.weekdayFull.toLowerCase();
        weekdayCell.font = { name: 'Arial', size: 8, bold: true };
        weekdayCell.alignment = { ...center, textRotation: 90 };
        weekdayCell.border = thinBorder as any;

        const dateCell = worksheet.getCell(4, column);
        dateCell.value = day.date;
        dateCell.font = { name: 'Arial', size: 9, bold: true };
        dateCell.alignment = center;
        dateCell.border = thinBorder as any;

        if (day.isSunday) {
          weekdayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2F1' } };
          dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB2DFDB' } };
        }
      });

      worksheet.mergeCells(4, 1, employeeEndRow, 1);
      const staffFrame = worksheet.getCell(4, 1);
      staffFrame.value = 'QUADRO DE FUNCIONÁRIOS';
      staffFrame.font = { name: 'Arial', size: 9, bold: true };
      staffFrame.alignment = { ...center, textRotation: 90 };
      staffFrame.border = thinBorder as any;

      const fixedHeaders: Array<[number, string]> = [
        [2, 'Nº'],
        [3, 'COLABORADOR'],
        [4, 'JORNADA'],
        [5, 'FOLGA FIXA']
      ];
      fixedHeaders.forEach(([column, label]) => {
        const cell = worksheet.getCell(4, column);
        cell.value = label;
        cell.font = { name: 'Arial', size: 9, bold: true };
        cell.alignment = center;
        cell.border = thinBorder as any;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      });

      if (scaleEmployees.length === 0) {
        worksheet.getCell(employeeStartRow, 3).value = 'NENHUM COLABORADOR 6X1 OU HORISTA CADASTRADO';
      }

      scaleEmployees.forEach((employee, employeeIndex) => {
        const row = employeeStartRow + employeeIndex;
        worksheet.getRow(row).height = 20;
        worksheet.getCell(row, 2).value = employeeIndex + 1;
        worksheet.getCell(row, 3).value = employee.name.toUpperCase();
        worksheet.getCell(row, 4).value = employee.workingHours || '08:00-16:20';
        worksheet.getCell(row, 5).value = formatFixedDay(employee.fixedDayOff);

        scaleData.forEach((day, dayIndex) => {
          const status = getShiftStatus(employee, day);
          const displayStatus = status === 'F'
            ? 'F'
            : status.startsWith('D')
              ? status
              : status
                ? 'FR'
                : '';
          worksheet.getCell(row, dayStartColumn + dayIndex).value = displayStatus;
        });

        for (let column = 2; column <= lastColumn; column++) {
          const cell = worksheet.getCell(row, column);
          cell.border = thinBorder as any;
          cell.font = { name: 'Arial', size: column === 3 ? 8.5 : 8, bold: column !== 4 };
          cell.alignment = column === 3
            ? { horizontal: 'left', vertical: 'middle', shrinkToFit: true }
            : center;
          if (column >= dayStartColumn && scaleData[column - dayStartColumn]?.isSunday) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };
          }
          if (cell.value === 'FR') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
            cell.font = { ...cell.font, color: { argb: 'FF1D4ED8' }, bold: true };
          }
        }
      });

      const legendStartRow = employeeEndRow + 3;
      const legendEntries = [
        ['F', 'FOLGA CONFORME REGISTRO'],
        ['D1', 'PRIMEIRO DOMINGO DO MÊS'],
        ['D2', 'SEGUNDO DOMINGO DO MÊS'],
        ['FF+ DIA DO FERIADO', 'FOLGA REF AO FERIADO DO DIA X'],
        ['FR', 'FÉRIAS'],
        ['AF', 'SE O COLABORADOR ESTIVER AFASTADO'],
        ['BC', 'BANCO DE HORAS']
      ];
      worksheet.mergeCells(legendStartRow, 3, legendStartRow, 11);
      const legendTitle = worksheet.getCell(legendStartRow, 3);
      legendTitle.value = 'LEGENDA';
      legendTitle.font = { name: 'Arial', size: 9, bold: true };
      legendTitle.alignment = center;
      legendTitle.border = thinBorder as any;
      legendTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

      legendEntries.forEach(([code, description], index) => {
        const row = legendStartRow + 1 + index;
        worksheet.getRow(row).height = 20;
        worksheet.getCell(row, 3).value = code;
        worksheet.mergeCells(row, 4, row, 11);
        worksheet.getCell(row, 4).value = description;
        for (let column = 3; column <= 11; column++) {
          const cell = worksheet.getCell(row, column);
          cell.border = thinBorder as any;
          cell.font = { name: 'Arial', size: 8, bold: column === 3 };
          cell.alignment = column === 3 ? center : { horizontal: 'left', vertical: 'middle' };
        }
      });

      const observationsStartColumn = 13;
      worksheet.mergeCells(legendStartRow, observationsStartColumn, legendStartRow, lastColumn);
      const observationsTitle = worksheet.getCell(legendStartRow, observationsStartColumn);
      observationsTitle.value = 'OBSERVAÇÕES GERAIS:';
      observationsTitle.font = { name: 'Arial', size: 9, bold: true };
      observationsTitle.alignment = { horizontal: 'left', vertical: 'middle' };
      observationsTitle.border = thinBorder as any;
      observationsTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      for (let index = 1; index <= 5; index++) {
        const row = legendStartRow + index;
        worksheet.mergeCells(row, observationsStartColumn, row, lastColumn);
        worksheet.getCell(row, observationsStartColumn).border = thinBorder as any;
      }

      const signatureRow = legendStartRow + legendEntries.length + 3;
      worksheet.mergeCells(signatureRow, 8, signatureRow, Math.min(lastColumn - 5, 24));
      const signatureCell = worksheet.getCell(signatureRow, 8);
      signatureCell.value = 'Ass: ( Nome do Lider de Setor)';
      signatureCell.font = { name: 'Arial', size: 8 };
      signatureCell.alignment = { horizontal: 'center', vertical: 'top' };
      signatureCell.border = { top: { style: 'thin', color: { argb: 'FF64748B' } } } as any;

      const lastColumnLetter = worksheet.getColumn(lastColumn).letter;
      worksheet.pageSetup.printArea = `A1:${lastColumnLetter}${signatureRow}`;
      worksheet.pageSetup.printTitlesRow = '1:4';

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Escala_${(currentSector?.name || 'Setor').replace(/[^a-z0-9]+/gi, '_')}_${scaleDate.toISOString().slice(0, 7)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao gerar escala em Excel:', error);
      window.alert('Não foi possível gerar a escala em Excel. Tente novamente.');
    } finally {
      setIsDownloadingScale(false);
    }
  };

  const filteredEmployees = employees
    .filter(e => {
      const matchesSector = e.sectorId === selectedSectorId;
      const normalizedSearch = searchTerm.toLowerCase();
      const matchesSearch = (e.name || '').toLowerCase().includes(normalizedSearch)
        || (e.role || '').toLowerCase().includes(normalizedSearch)
        || (e.tagText || '').toLowerCase().includes(normalizedSearch);
      const matchesShift = e.scheduleType === 'Intermitente'
        ? shiftPeriodFilter === 'TODOS'
        : shiftPeriodFilter === 'TODOS' || getEmployeeShiftPeriod(e) === shiftPeriodFilter;
      const employeeGender = String(e.gender || 'M').toUpperCase();
      const matchesGender = genderFilter === 'TODOS' || employeeGender === genderFilter;
      const matchesRole = roleFilter === 'TODOS' || normalizeRoleName(e.role) === roleFilter;
      const matchesTag = tagFilter === 'TODOS' || String(e.tagText || '').trim().toUpperCase() === tagFilter;
      const matchesScheduleType = scheduleTypeFilter === 'TODOS' || e.scheduleType === scheduleTypeFilter;
      return matchesSector && matchesSearch && matchesShift && matchesGender && matchesRole && matchesTag && matchesScheduleType;
    })
    .sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }) ||
      (a.role || '').localeCompare(b.role || '', 'pt-BR', { sensitivity: 'base' })
    );

  const scaleEmployees = filteredEmployees.filter(employeeAppearsInMonthlyScale);
  
  const filteredExtras = extras
    .filter(ext => ext.sectorId === selectedSectorId && (ext.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));

  const getEmployeeAuditHistory = (emp: Employee) =>
    [...(emp.history || [])].sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

  const getEmployeeInventoryHistory = (emp: Employee) =>
    inventoryHistory
      .filter(h => h.recipientName === emp.name || h.recipientId === emp.id)
      .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

  const employeeOverview = useMemo(() => {
    const activeEmployees = employees.filter(emp => emp.status !== 'Inativo');
    return {
      totalEmployees: employees.length,
      activeEmployees: activeEmployees.length,
      totalExtras: extras.length,
      bySector: sortedSectors.map(sector => ({
        ...sector,
        employees: employees.filter(emp => emp.sectorId === sector.id).length,
        extras: extras.filter(extra => extra.sectorId === sector.id).length
      }))
    };
  }, [employees, extras, sortedSectors]);

  const monthlyScaleOverview = useMemo(() => {
    const year = scaleDate.getFullYear();
    return monthOptions.map((month, monthIndex) => {
      const vacationItems = filteredEmployees
        .map(emp => ({
          id: emp.id,
          name: emp.name,
          days: getVacationDaysInMonth(emp, year, monthIndex)
        }))
        .filter(item => item.days > 0);

      const bankHourItems = filteredEmployees
        .map(emp => ({
          id: emp.id,
          name: emp.name,
          days: getBankHoursDaysInMonth(emp, year, monthIndex)
        }))
        .filter(item => item.days > 0);

      const vacationDueItems = filteredEmployees
        .map(emp => ({ id: emp.id, name: emp.name, deadline: parseLocalDate(emp.vacationDeadline), dueInfo: getVacationDueInfo(emp) }))
        .filter(item => {
          if (!item.deadline || !item.dueInfo) return false;
          const currentMonth = new Date();
          const isDeadlineMonth = item.deadline.getFullYear() === year && item.deadline.getMonth() === monthIndex;
          const isOverdueCurrentMonth = item.dueInfo.tone === 'danger' && currentMonth.getFullYear() === year && currentMonth.getMonth() === monthIndex;
          return isDeadlineMonth || isOverdueCurrentMonth;
        });

      return { ...month, monthIndex, vacationItems, bankHourItems, vacationDueItems };
    });
  }, [filteredEmployees, monthOptions, scaleDate]);

  const sectorVacationEmployees = useMemo(() => employees
    .filter(emp => emp.sectorId === selectedSectorId && isEmployeeOnVacationToday(emp))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  [employees, selectedSectorId]);

  const sectorBankHoursToday = useMemo(() => {
    const today = formatDateInputValue(new Date());
    return employees
      .filter(emp => emp.sectorId === selectedSectorId && emp.status === 'Ativo' && getBankHoursDates(emp).includes(today))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [employees, selectedSectorId]);

  // Calculation for ORDERS view (Card Display)
  const ordersBySector = useMemo(() => {
    const result: Record<string, Employee[]> = {};
    const empsToCheck = selectedSectorId ? filteredEmployees : employees;

    empsToCheck.forEach(emp => {
        if (emp.status !== 'Ativo') return;
        const hasShortage = (emp.uniforms || []).some(u => (u.required || 0) - u.quantity > 0);
        if (hasShortage) {
            const secName = sectors.find(s => s.id === emp.sectorId)?.name || 'Sem Setor';
            if (!result[secName]) result[secName] = [];
            result[secName].push(emp);
        }
    });
    return result;
  }, [employees, filteredEmployees, selectedSectorId, sectors]);

  // Aggregation for PRINT view (Table Display)
  const printAggregatedOrders = useMemo(() => {
    const data: Record<string, { sector: string, name: string, size: string, qty: number }> = {};
    let grandTotal = 0;

    // Use all employees if no sector selected, otherwise filter
    const empsToPrint = selectedSectorId ? filteredEmployees : employees;

    empsToPrint.forEach(emp => {
        if(emp.status !== 'Ativo') return;
        const secName = sectors.find(s => s.id === emp.sectorId)?.name || 'Outros';
        
        emp.uniforms?.forEach(u => {
            const shortage = Math.max(0, (u.required || 0) - u.quantity);
            if(shortage > 0) {
                // Key to group same item + size within same sector
                const key = `${secName}-${u.name}-${u.size || 'UN'}`;
                if(!data[key]) {
                    data[key] = { sector: secName, name: u.name, size: u.size || 'Único', qty: 0 };
                }
                data[key].qty += shortage;
                grandTotal += shortage;
            }
        });
    });

    return {
        items: Object.values(data).sort((a,b) => {
            // Sort by Sector Name, then Item Name
            if (a.sector !== b.sector) return a.sector.localeCompare(b.sector);
            return a.name.localeCompare(b.name);
        }),
        total: grandTotal
    };
  }, [employees, filteredEmployees, selectedSectorId, sectors]);

  // Return specific render for non-selected sector
  if (!selectedSectorId && viewMode !== 'TODAY' && viewMode !== 'ORDERS') {
      return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Painel de Equipe</p>
          <div className="flex gap-2">
            <button 
              onClick={() => { resetSectorForm(); setIsSectorModalOpen(true); }} 
              className="text-white px-6 py-3 rounded-xl font-bold flex items-center space-x-2 shadow-lg" 
              style={{ backgroundColor: theme.primary }}
            >
              <Plus size={18} /> <span>Novo Setor</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <UserIcon size={22} />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total de funcionarios</p>
              <p className="text-2xl font-black text-slate-900">{employeeOverview.totalEmployees}</p>
              <p className="text-[10px] font-bold text-slate-400">{employeeOverview.activeEmployees} ativos</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Briefcase size={22} />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Extras cadastrados</p>
              <p className="text-2xl font-black text-slate-900">{employeeOverview.totalExtras}</p>
              <p className="text-[10px] font-bold text-slate-400">profissionais de apoio</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Funcionarios por setor</p>
              <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">{sectors.length} setores</span>
            </div>
            <div className="space-y-2 max-h-28 overflow-y-auto pr-1">
              {employeeOverview.bySector.map(sector => (
                <div key={sector.id} className="flex items-center justify-between gap-3 text-xs font-bold">
                  <span className="text-slate-600 truncate">{sector.name}</span>
                  <span className="text-slate-900 whitespace-nowrap">{sector.employees} func. / {sector.extras} extras</span>
                </div>
              ))}
              {employeeOverview.bySector.length === 0 && (
                <p className="text-xs text-slate-300 font-bold italic">Nenhum setor cadastrado.</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedSectors.map((sec) => (
            <div key={sec.id} className="relative group">
              <div className="absolute top-4 right-4 z-10 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleEditSector(sec); }}
                  className="p-2 bg-white/80 rounded-full text-slate-300 hover:text-blue-500 hover:bg-white transition-all shadow-sm"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setSectorToDelete(sec); }}
                  className="p-2 bg-white/80 rounded-full text-slate-300 hover:text-rose-500 hover:bg-white transition-all shadow-sm"
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
             <div className="bg-white w-[95%] md:w-full md:max-w-lg rounded-2xl md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90dvh]">
                <div className="p-6 md:p-8 border-b flex justify-between items-center bg-slate-50/50 shrink-0">
                   <h3 className="font-black text-slate-800 uppercase text-sm tracking-widest">{editingSector ? 'Editar Setor' : 'Novo Setor'}</h3>
                   <button onClick={resetSectorForm} className="text-slate-300 hover:text-slate-500 transition-colors"><X size={24}/></button>
                </div>
                <form onSubmit={handleSaveSectorSubmit} className="p-6 md:p-8 space-y-6 overflow-y-auto">
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
                           onChange={e => setNewRole(e.target.value.toUpperCase())}
                           placeholder="Novo Cargo (Ex: Recepcionista)" 
                           className="flex-1 px-4 py-2 rounded-xl border-2 font-bold text-sm uppercase"
                         />
                         <button type="button" onClick={handleAddSectorRole} className="p-2 bg-slate-800 text-white rounded-xl"><Plus size={20}/></button>
                      </div>
                      <div className="space-y-2">
                         {sectorRoles.map((role, idx) => (
                            <div key={role} className="grid grid-cols-1 sm:grid-cols-[1fr_150px_auto] gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
                               <div className="px-3 py-2 bg-white rounded-lg text-xs font-black text-slate-700 uppercase flex items-center">
                                 {role}
                               </div>
                               <input
                                 type="number"
                                 min={0}
                                 step="0.01"
                                 value={sectorRoleSalaries[role] || ''}
                                 onChange={e => setSectorRoleSalaries(prev => ({ ...prev, [role]: Number(e.target.value) || 0 }))}
                                 placeholder="Salário"
                                 className="px-3 py-2 bg-white rounded-lg border border-slate-100 text-xs font-black text-slate-700"
                               />
                               <button type="button" onClick={() => handleRemoveSectorRole(idx)} className="px-3 py-2 bg-white rounded-lg text-slate-400 hover:text-rose-500 flex justify-center"><X size={14}/></button>
                            </div>
                         ))}
                         {sectorRoles.length === 0 && <span className="text-xs text-slate-300 italic">Nenhum cargo definido.</span>}
                      </div>
                   </div>

                   {editingSector && sectorRoles.length > 0 && (
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                      <label className="block text-[10px] font-black text-amber-700 uppercase mb-3 ml-1">Substituir cargo em massa</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <select
                          value={roleRenameFrom}
                          onChange={e => setRoleRenameFrom(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border-2 border-amber-100 bg-white font-bold text-sm uppercase text-slate-700"
                        >
                          <option value="">Cargo atual...</option>
                          {sectorRoles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <input
                          type="text"
                          value={roleRenameTo}
                          onChange={e => setRoleRenameTo(e.target.value.toUpperCase())}
                          placeholder="Novo nome do cargo"
                          className="w-full px-4 py-3 rounded-xl border-2 border-amber-100 bg-white font-bold text-sm uppercase text-slate-700"
                        />
                      </div>
                      <p className="mt-3 text-[10px] font-bold text-amber-700 uppercase tracking-widest">
                        Ao salvar, colaboradores, uniformes e salário da função serão atualizados.
                      </p>
                    </div>
                   )}

                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Uniformes Padrão (Por Função)</label>
                      <div className="flex flex-col gap-2 mb-3">
                         <select 
                            value={newSectorUniformRole}
                            onChange={e => setNewSectorUniformRole(e.target.value)}
                            className="w-full px-4 py-2 rounded-xl border-2 font-bold text-sm bg-white"
                         >
                            <option value="">Selecione a Função...</option>
                            {sectorRoles.map(r => <option key={r} value={r}>{r}</option>)}
                         </select>
                         <div className="flex gap-2">
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
                            <button type="button" onClick={handleAddSectorUniform} disabled={!newSectorUniformRole} className="p-2 bg-slate-800 text-white rounded-xl disabled:opacity-50"><Plus size={20}/></button>
                         </div>
                      </div>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                         {sectorUniforms.map((uni, idx) => (
                            <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded-xl border border-slate-100">
                               <div className="flex flex-col">
                                  <span className="text-[9px] font-black text-blue-500 uppercase">{uni.role}</span>
                                  <div className="flex items-center space-x-2">
                                     <Shirt size={14} className="text-slate-400"/>
                                     <span className="text-xs font-bold text-slate-700">{uni.name}</span>
                                  </div>
                               </div>
                               <div className="flex items-center space-x-3">
                                  <span className="text-[10px] font-black text-slate-400 bg-white px-2 py-0.5 rounded border">Padrão: {uni.quantity}</span>
                                  <button type="button" onClick={() => handleRemoveSectorUniform(idx)} className="text-slate-300 hover:text-rose-500"><X size={14}/></button>
                               </div>
                            </div>
                         ))}
                         {sectorUniforms.length === 0 && <span className="text-xs text-slate-300 italic">Nenhum uniforme padrão definido.</span>}
                      </div>
                   </div>

                   <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase shadow-xl hover:brightness-110 active:scale-95 transition-all">Salvar Setor</button>
                </form>
             </div>
          </div>
        )}

        {sectorToDelete && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
            <div className="bg-white w-[95%] md:w-full md:max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
              <div className="p-6 md:p-8 text-center">
                <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">Excluir Setor?</h3>
                <p className="text-sm font-bold text-slate-500 mb-6">
                  Tem certeza que deseja excluir o setor <strong>{sectorToDelete.name}</strong>? Esta ação não pode ser desfeita e pode afetar os colaboradores vinculados a ele.
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setSectorToDelete(null)}
                    className="flex-1 py-3 rounded-xl font-black text-xs uppercase text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => {
                      onDeleteSector(sectorToDelete.id);
                      setSectorToDelete(null);
                    }}
                    className="flex-1 py-3 rounded-xl font-black text-xs uppercase text-white bg-rose-500 hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/30"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      );
  }

  // --- Main Employee View (with Sector Selected) ---
  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      
      {/* HIDDEN PRINT LAYOUT */}
      {viewMode === 'ORDERS' && (
      <div className="hidden print:block fixed inset-0 z-[9999] bg-white p-8 overflow-y-auto">
         <div className="text-center mb-8 border-b-2 border-slate-800 pb-4">
            <h1 className="text-2xl font-black uppercase tracking-widest text-slate-900">Pedido de Uniformes</h1>
            <p className="text-xs font-bold text-slate-500 mt-1">Gerado em {new Date().toLocaleDateString()}</p>
         </div>
         
         <table className="w-full text-left border-collapse">
            <thead>
               <tr className="border-b-2 border-slate-200">
                  <th className="py-2 text-xs font-black uppercase text-slate-500">Setor</th>
                  <th className="py-2 text-xs font-black uppercase text-slate-500">Peça</th>
                  <th className="py-2 text-center text-xs font-black uppercase text-slate-500">Tam.</th>
                  <th className="py-2 text-right text-xs font-black uppercase text-slate-500">Qtd.</th>
               </tr>
            </thead>
            <tbody>
               {printAggregatedOrders.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                     <td className="py-3 text-xs font-bold text-slate-800 uppercase">{item.sector}</td>
                     <td className="py-3 text-xs font-medium text-slate-700">{item.name}</td>
                     <td className="py-3 text-center text-xs font-bold text-slate-600 uppercase">{item.size}</td>
                     <td className="py-3 text-right text-sm font-black text-slate-900">{item.qty}</td>
                  </tr>
               ))}
            </tbody>
            <tfoot>
               <tr className="border-t-2 border-slate-800">
                  <td colSpan={3} className="py-4 text-right text-sm font-black uppercase text-slate-800 tracking-widest">Total Geral</td>
                  <td className="py-4 text-right text-xl font-black text-slate-900">{printAggregatedOrders.total}</td>
               </tr>
            </tfoot>
         </table>
      </div>
      )}

      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm print:hidden">
        <div className="flex items-center space-x-3">
          <button onClick={() => { onSelectSector(null); setViewMode('LIST'); }} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{currentSector?.name || 'Gestão de Equipe'}</h2>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                {viewMode === 'EXTRAS' ? `${filteredExtras.length} Profissionais` : (viewMode === 'ORDERS' ? 'Pedido de Uniformes' : `${filteredEmployees.length} Colaboradores`)}
            </p>
          </div>
        </div>
        
        <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100 overflow-x-auto">
          <button onClick={() => setViewMode('LIST')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${viewMode === 'LIST' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>Listagem</button>
          <button onClick={() => { setViewMode('SCALE'); setScaleView('YEAR'); }} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${viewMode === 'SCALE' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>Escala Mensal</button>
          <button onClick={() => setViewMode('EXTRAS')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${viewMode === 'EXTRAS' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>Extras</button>
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
        <div className="space-y-4 animate-in slide-in-from-bottom-2 print:hidden">
          <div className="space-y-3">
            <div className="flex gap-2 items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input type="text" placeholder="Buscar colaborador..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-100 text-sm font-bold bg-white shadow-inner" />
            </div>
            <button
              type="button"
              onClick={() => setIsFilterPanelOpen(prev => !prev)}
              className={`relative shrink-0 h-12 w-12 rounded-xl border flex items-center justify-center transition-all ${isFilterPanelOpen || activeFilterCount > 0 ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'}`}
              aria-label="Filtros"
            >
              <SlidersHorizontal size={18} />
              {activeFilterCount > 0 && (
                <span className="absolute -right-1 -top-1 h-5 min-w-5 px-1 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            </div>

            {isFilterPanelOpen && (
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Sexo</label>
                  <select value={genderFilter} onChange={e => setGenderFilter(e.target.value as GenderFilter)} className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 text-xs font-black uppercase text-slate-700">
                    {genderFilterOptions.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Turno</label>
                  <select value={shiftPeriodFilter} onChange={e => setShiftPeriodFilter(e.target.value as ShiftPeriodFilter)} className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 text-xs font-black uppercase text-slate-700">
                    <option value="TODOS">Todos</option>
                    {shiftPeriodOptions.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Função</label>
                  <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 text-xs font-black uppercase text-slate-700">
                    <option value="TODOS">Todas</option>
                    {roleFilterOptions.map(roleName => (
                      <option key={roleName} value={roleName}>{roleName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Regime</label>
                  <select value={scheduleTypeFilter} onChange={e => setScheduleTypeFilter(e.target.value as ScheduleTypeFilter)} className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 text-xs font-black uppercase text-slate-700">
                    <option value="TODOS">Todos</option>
                    {(['6x1', '12x36', 'Intermitente', 'Horista'] as const).map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Etiqueta</label>
                  <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 text-xs font-black uppercase text-slate-700">
                    <option value="TODOS">Todas</option>
                    {tagFilterOptions.map(tag => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                </div>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => { setShiftPeriodFilter('TODOS'); setGenderFilter('TODOS'); setRoleFilter('TODOS'); setTagFilter('TODOS'); setScheduleTypeFilter('TODOS'); }}
                    className="sm:col-span-2 xl:col-span-5 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-50 text-slate-500 text-[10px] font-black uppercase hover:bg-slate-100"
                  >
                    <RotateCcw size={14} />
                    Limpar filtros
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredEmployees.map(emp => (
              <div key={emp.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-5 group hover:border-blue-200 transition-all">
                <div className="grid grid-cols-[56px_1fr] items-center gap-4 min-w-0">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md overflow-hidden ${emp.gender === 'F' ? 'bg-rose-400' : 'bg-blue-400'}`}>
                    {emp.photo ? (
                      <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={24} className="text-white" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="grid grid-cols-[minmax(0,1fr)_96px] sm:grid-cols-[minmax(0,1fr)_128px] items-center gap-2 min-w-0 mb-1">
                      <h4 className="min-w-0 font-black text-slate-800 uppercase truncate">{emp.name || 'Sem Nome'}</h4>
                      <div className="min-w-0 h-7 flex items-center">
                        {emp.tagText && (
                          <span
                            className="w-full min-w-0 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg border text-[8px] font-black uppercase tracking-wider"
                            style={getTagStyle(getEmployeeTagColor(emp))}
                            title={emp.tagText}
                          >
                            <Tag size={10} className="shrink-0 opacity-70" />
                            <span className="truncate">{emp.tagText}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {getVacationBadgeText(emp) && (
                        <span className="inline-flex px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-widest">
                          {getVacationBadgeText(emp)}
                        </span>
                      )}
                      {getVacationDueInfo(emp) && (
                        <span className={`inline-flex px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                          getVacationDueInfo(emp)?.tone === 'danger'
                            ? 'bg-rose-50 text-rose-700'
                            : getVacationDueInfo(emp)?.tone === 'warning'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-500'
                        }`}>
                          {getVacationDueInfo(emp)?.label}
                        </span>
                      )}
                      {getBankHoursDates(emp).length > 0 && (
                        <span className="inline-flex px-3 py-1 rounded-lg bg-violet-50 text-violet-700 text-[9px] font-black uppercase tracking-widest">
                          Banco de horas: {getBankHoursDates(emp).length} folga(s)
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                       <span>{emp.role}</span>
                       <span>{getScheduleSummary(emp)}</span>
                       {emp.scheduleType !== 'Intermitente' && (() => {
                         const ShiftIcon = getShiftPeriodMeta(getEmployeeShiftPeriod(emp)).Icon;
                         return (
                           <span className="inline-flex items-center gap-1 text-slate-400">
                             <ShiftIcon size={13} className="text-slate-300" />
                             {emp.workingHours || 'Sem horario'}
                           </span>
                         );
                       })()}
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 items-center w-full md:w-auto">
                  <div className="flex flex-wrap justify-center gap-2 w-full">
                    <button onClick={() => setSelectedBadge(emp)} className="p-3 bg-slate-50 text-slate-400 hover:text-blue-500 rounded-xl transition-all flex-1 md:flex-none flex justify-center"><QrCode size={18}/></button>
                    <button onClick={() => setViewingHistoryEmployee(emp)} className="p-3 bg-slate-50 text-slate-400 hover:text-amber-500 rounded-xl transition-all flex-1 md:flex-none flex justify-center"><History size={18}/></button>
                    <button onClick={() => handleEditEmployee(emp)} className="p-3 bg-slate-50 text-slate-400 hover:text-blue-500 rounded-xl transition-all flex-1 md:flex-none flex justify-center"><Edit2 size={18}/></button>
                    <button onClick={() => onDelete(emp.id)} className="p-3 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-xl transition-all flex-1 md:flex-none flex justify-center"><Trash2 size={18}/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="border-y border-slate-200 bg-white px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[10px] font-black uppercase text-slate-400">Resumo do setor</div>
                <div className="mt-1 text-sm font-black text-slate-900">
                  {sectorVacationEmployees.length} funcionario(s) de ferias hoje
                </div>
                {sectorVacationEmployees.length > 0 && (
                  <div className="mt-1 text-xs font-bold text-slate-500">
                    {sectorVacationEmployees.map(emp => emp.name).join(', ')}
                  </div>
                )}
              </div>
              <div className="sm:text-right">
                <div className="text-sm font-black text-violet-700">
                  {sectorBankHoursToday.length} de folga por banco de horas
                </div>
                {sectorBankHoursToday.length > 0 && (
                  <div className="mt-1 text-xs font-bold text-slate-500">
                    {sectorBankHoursToday.map(emp => emp.name).join(', ')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'SCALE' && (
        <div className="monthly-scale-document bg-white rounded-[1rem] border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-right-2 print:border-none print:shadow-none">
          {scaleView === 'YEAR' ? (
            <div className="p-5 md:p-8 bg-white print:hidden">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Escala mensal</p>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight">
                    {scaleDate.getFullYear()} - {currentSector?.name || 'Setor'}
                  </h3>
                  <p className="text-xs font-bold text-slate-400 mt-1">
                    Clique em um mes para abrir a planilha mensal. Ferias e banco de horas aparecem como aviso no proprio mes.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setScaleDate(new Date(scaleDate.getFullYear() - 1, scaleDate.getMonth(), 2))}
                    className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
                    title="Ano anterior"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-black">{scaleDate.getFullYear()}</span>
                  <button
                    onClick={() => setScaleDate(new Date(scaleDate.getFullYear() + 1, scaleDate.getMonth(), 2))}
                    className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
                    title="Proximo ano"
                  >
                    <ChevronLeft size={18} className="rotate-180" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {monthlyScaleOverview.map(month => (
                  <button
                    key={month.value}
                    onClick={() => {
                      setScaleDate(new Date(`${month.value}-02`));
                      setScaleView('MONTH');
                    }}
                    className="min-h-[190px] rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-blue-200 hover:shadow-lg transition-all text-left p-5 flex flex-col"
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{month.label}</p>
                        <h4 className="text-xl font-black text-slate-900 capitalize">
                          {new Date(scaleDate.getFullYear(), month.monthIndex, 1).toLocaleDateString('pt-BR', { month: 'long' })}
                        </h4>
                      </div>
                      <CalendarDays size={22} className="text-slate-300" />
                    </div>

                    <div className="space-y-2 flex-1">
                      {month.vacationItems.slice(0, 3).map(item => (
                        <div key={`vacation-${item.id}`} className="rounded-xl bg-blue-50 text-blue-700 px-3 py-2">
                          <p className="text-[10px] font-black uppercase tracking-widest">Ferias</p>
                          <p className="text-xs font-bold truncate">{item.name}, {item.days} dias</p>
                        </div>
                      ))}
                      {month.bankHourItems.slice(0, 2).map(item => (
                        <div key={`bank-${item.id}`} className="rounded-xl bg-amber-50 text-amber-700 px-3 py-2">
                          <p className="text-[10px] font-black uppercase tracking-widest">Banco de horas</p>
                          <p className="text-xs font-bold truncate">{item.name}, {item.days} dias</p>
                        </div>
                      ))}
                      {month.vacationDueItems.slice(0, 2).map(item => (
                        <div key={`due-${item.id}`} className={`rounded-xl px-3 py-2 ${item.dueInfo?.tone === 'danger' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                          <p className="text-[10px] font-black uppercase tracking-widest">{item.dueInfo?.tone === 'danger' ? 'Ferias vencidas' : 'Controle de ferias'}</p>
                          <p className="text-xs font-bold truncate">{item.name}, {item.dueInfo?.label}</p>
                        </div>
                      ))}
                      {month.vacationItems.length === 0 && month.bankHourItems.length === 0 && month.vacationDueItems.length === 0 && (
                        <div className="h-full min-h-16 rounded-xl border border-dashed border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-300 uppercase tracking-widest">
                          Sem avisos
                        </div>
                      )}
                    </div>

                    {(month.vacationItems.length + month.bankHourItems.length + month.vacationDueItems.length) > 3 && (
                      <p className="text-[10px] font-black text-slate-400 mt-3">
                        +{month.vacationItems.length + month.bankHourItems.length + month.vacationDueItems.length - 3} avisos na planilha
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
          <>
           <div className="p-4 border-b border-slate-200 bg-slate-50 print:hidden space-y-4">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-800 uppercase text-lg tracking-widest">{scaleTitle}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Modelo mensal automatico com folgas fixas, domingos e ferias cadastradas.</p>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <button onClick={() => setScaleView('YEAR')} className="bg-white text-slate-700 px-3 py-2 rounded border border-slate-200 font-bold flex items-center space-x-2 hover:bg-slate-100 transition-colors text-xs">
                     <ChevronLeft size={14} /> <span>Meses</span>
                   </button>
                  <button onClick={() => window.print()} className="bg-slate-200 text-slate-700 px-3 py-2 rounded font-bold flex items-center space-x-2 hover:bg-slate-300 transition-colors text-xs">
                     <Printer size={14} /> <span>Imprimir</span>
                   </button>
                  <button
                    onClick={downloadScaleExcel}
                    disabled={isDownloadingScale}
                    className="bg-emerald-600 text-white px-3 py-2 rounded font-bold flex items-center space-x-2 hover:bg-emerald-700 transition-colors text-xs disabled:cursor-wait disabled:opacity-60"
                  >
                     <Download size={14} /> <span>{isDownloadingScale ? 'Gerando...' : 'Excel'}</span>
                  </button>
                 <input 
                    type="month" 
                    value={scaleDate.toISOString().slice(0, 7)}
                     onChange={(e) => setScaleDate(new Date(e.target.value + '-02'))}
                     className="px-4 py-2 rounded border border-slate-300 font-bold text-xs outline-none"
                  />
                </div>
              </div>
           </div>
           <div className="scale-sheet-header flex flex-col sm:flex-row items-center justify-between gap-5 p-5 border-b border-slate-300 bg-white print:flex-row print:p-2">
               <img src={villageInnLogoUrl} alt="Hotel Village Inn" className="w-[220px] max-w-[55vw] h-auto object-contain" />
               <h3 className="flex-1 text-center font-black text-slate-800 uppercase text-lg sm:text-xl tracking-widest">{scaleTitle}</h3>
           </div>
           <div className="monthly-scale-scroll overflow-x-auto">
               <table className="monthly-scale-table w-full text-left border-collapse border border-slate-300">
                 <thead>
                    <tr>
                       <th rowSpan={2} className="sticky left-0 bg-white z-20 px-4 py-2 font-black text-xs uppercase text-slate-800 border border-slate-300 min-w-[250px] text-center align-bottom">
                          <div className="flex items-end justify-between h-full">
                             <span className="[writing-mode:vertical-rl] transform rotate-180 text-[10px] text-slate-500 mr-2">QUADRO DE FUNCIONARIOS</span>
                             <span className="flex-1 text-center pb-1">Nº / COLABORADOR</span>
                          </div>
                       </th>
                       <th rowSpan={2} className="sticky left-[250px] bg-white z-20 px-2 py-2 font-black text-xs uppercase text-slate-800 border border-slate-300 min-w-[100px] text-center align-bottom pb-1">JORNADA</th>
                        <th rowSpan={2} className="sticky left-[350px] bg-white z-20 px-2 py-2 font-black text-xs uppercase text-slate-800 border border-slate-300 min-w-[100px] text-center align-bottom pb-1">FOLGA FIXA</th>
                       {scaleData.map((d, i) => (
                          <th key={i} className={`px-1 py-2 text-[10px] font-bold text-center border border-slate-300 min-w-[24px] h-32 align-bottom ${d.isSunday ? 'bg-slate-100' : ''}`}>
                             <div className="[writing-mode:vertical-rl] transform rotate-180 flex items-center justify-start h-full pb-2">
                                {d.weekdayFull}
                             </div>
                          </th>
                       ))}
                    </tr>
                    <tr>
                       {scaleData.map((d, i) => (
                          <th key={i} className={`px-1 py-1 text-xs font-black text-center border border-slate-300 ${d.isSunday ? 'bg-slate-200' : 'bg-slate-100'}`}>
                             {d.date}
                          </th>
                       ))}
                    </tr>
                 </thead>
                 <tbody>
                     {scaleEmployees.map((emp, empIndex) => (
                        <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                           <td className="sticky left-0 bg-white z-10 px-2 py-1 border border-slate-300 text-xs font-bold text-slate-700 uppercase max-w-[250px]">
                              <div className="flex items-center gap-2">
                                <span className="w-6 shrink-0 text-center text-[10px] font-black text-slate-500">{empIndex + 1}</span>
                                <span className="truncate">{emp.name}</span>
                              </div>
                           </td>
                          <td className="sticky left-[250px] bg-white z-10 px-2 py-1 border border-slate-300 text-xs font-medium text-slate-700 text-center">
                             {emp.workingHours || '08:00-16:20'}
                           </td>
                           <td className="sticky left-[350px] bg-white z-10 px-2 py-1 border border-slate-300 text-[10px] font-bold text-slate-700 text-center uppercase">
                              {formatFixedDay(emp.fixedDayOff)}
                          </td>
                          {(() => {
                             const dayStatuses = scaleData.map(d => ({ ...d, status: getShiftStatus(emp, d) }));
                             const cells = [];
                             let i = 0;
                             while (i < dayStatuses.length) {
                                 if (dayStatuses[i].status === 'FÉRIAS') {
                                     let j = i;
                                     while (j < dayStatuses.length && dayStatuses[j].status === 'FÉRIAS') { j++; }
                                     const span = j - i;
                                     const returnLabel = getVacationReturnLabel(emp);
                                     cells.push(
                                        <td key={`vacation-${i}`} colSpan={span} className="text-center p-0 border border-slate-300 text-[10px] sm:text-xs font-black bg-blue-100 text-blue-700 tracking-widest relative overflow-hidden group">
                                           <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-1">
                                             <span className="truncate">FÉRIAS{returnLabel ? ` - ${returnLabel}` : ''}</span>
                                           </div>
                                           <span className="opacity-0">F</span>
                                        </td>
                                     );
                                     i = j;
                                 } else {
                                     const d = dayStatuses[i];
                                     const status = d.status;
                                     let text = "";
                                     if (status.startsWith('D')) { text = status; }
                                     else if (status === 'F') { text = "F"; }
                                     
                                     cells.push(
                                        <td key={`day-${i}`} className={`text-center p-0 border border-slate-300 text-xs font-bold ${text ? 'text-slate-800' : ''} ${d.isSunday ? 'bg-slate-100' : ''}`}>
                                           {text}
                                        </td>
                                     );
                                     i++;
                                 }
                             }
                             return cells;
                          })()}
                        </tr>
                     ))}
                     {scaleEmployees.length === 0 && (
                        <tr>
                          <td colSpan={scaleData.length + 3} className="p-8 text-center text-xs font-black uppercase tracking-widest text-slate-300">
                            Nenhum colaborador 6x1 ou horista para esta escala.
                          </td>
                        </tr>
                     )}
                  </tbody>
              </table>
           </div>
           
           <div className="flex flex-col md:flex-row gap-4 p-4 bg-white border-t border-slate-200">
              <div className="w-full md:w-1/3">
                 <table className="w-full border-collapse border border-slate-300 text-xs font-bold">
                    <thead>
                       <tr>
                          <th colSpan={2} className="border border-slate-300 bg-slate-100 py-1 text-center uppercase">LEGENDA</th>
                       </tr>
                     </thead>
                     <tbody>
                        {[
                          ['F', 'FOLGA CONFORME REGISTRO'],
                          ['D1', 'PRIMEIRO DOMINGO DO MÊS'],
                          ['D2', 'SEGUNDO DOMINGO DO MÊS'],
                          ['FF+ DIA DO FERIADO', 'FOLGA REF AO FERIADO DO DIA X'],
                          ['FR', 'FÉRIAS'],
                          ['AF', 'SE O COLABORADOR ESTIVER AFASTADO'],
                          ['BC', 'BANCO DE HORAS']
                        ].map(([code, description]) => (
                          <tr key={code}>
                            <td className="border border-slate-300 py-1 text-center w-1/3 text-[9px]">{code}</td>
                            <td className="border border-slate-300 py-1 px-2 uppercase text-[9px]">{description}</td>
                          </tr>
                        ))}
                     </tbody>
                 </table>
              </div>
              <div className="w-full md:w-2/3">
                 <table className="w-full border-collapse border border-slate-300 text-xs font-bold h-full">
                    <thead>
                       <tr>
                          <th className="border border-slate-300 bg-slate-100 py-1 text-center uppercase">OBSERVAÇÕES GERAIS:</th>
                       </tr>
                     </thead>
                     <tbody>
                        {[0, 1, 2, 3, 4].map(line => (
                          <tr key={line}><td className="border border-slate-300 h-6"></td></tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
            <div className="mx-auto mt-8 mb-5 w-2/3 border-t border-slate-500 pt-2 text-center text-[9px] font-bold text-slate-600">
              Ass: ( Nome do Lider de Setor)
            </div>
          </>
          )}
        </div>
      )}

      {viewMode === 'WEEKLY_SCALE' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden animate-in slide-in-from-right-2 p-8 print:p-0 print:border-none print:shadow-none">
          {!hpoUploaded ? (
            <div className="text-center py-16 print:hidden">
              <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Download size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Upload de HPO</h3>
              <p className="text-slate-500 font-bold mb-8 max-w-md mx-auto">
                Faça o upload do arquivo HPO (Previsão de Ocupação Semanal) para gerar a escala da semana automaticamente.
              </p>
              <label className="cursor-pointer inline-flex items-center space-x-2 bg-slate-900 text-white px-8 py-4 rounded-xl font-black uppercase text-sm shadow-lg hover:bg-slate-800 transition-colors">
                <Upload size={20} />
                <span>Selecionar Arquivo HPO</span>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".pdf"
                  onChange={handleHpoUpload}
                />
              </label>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex justify-between items-center border-b border-slate-100 pb-6 print:hidden">
                <div>
                  <h3 className="text-2xl font-black text-slate-800">Escala Semanal Gerada</h3>
                  <p className="text-slate-500 font-bold text-sm">Baseado no HPO importado</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => window.print()} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold flex items-center space-x-2 hover:bg-slate-200 transition-colors">
                    <Printer size={16} /> <span>Imprimir</span>
                  </button>
                  <button onClick={() => setHpoUploaded(false)} className="bg-rose-50 text-rose-500 px-4 py-2 rounded-xl font-bold flex items-center space-x-2 hover:bg-rose-100 transition-colors">
                    <Trash2 size={16} /> <span>Remover HPO</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4">
                {weeklyScaleData.map((day, i) => (
                  <div key={i} className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                    <h4 className="font-black text-slate-800 text-lg mb-2">{day.date}</h4>
                    <div className="flex gap-4 mb-4 text-sm font-bold">
                      <span className="text-emerald-600">Check inn {day.in}</span>
                      <span className="text-rose-600">Check out {day.out}</span>
                    </div>
                    <div className="w-full h-px bg-slate-200 mb-4"></div>
                    <div className="space-y-2">
                      {day.shifts.map((shift, j) => (
                        <div key={`${shift}-${j}`} className="text-slate-700 font-medium text-sm flex items-center">
                          <Clock size={14} className="mr-2 text-slate-400" />
                          {shift}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode === 'EXTRAS' && (
         <div className="space-y-4 animate-in slide-in-from-right-2 print:hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {filteredExtras.length === 0 ? (
                  <div className="col-span-full py-20 text-center text-slate-300 font-bold italic">
                     Nenhum profissional extra cadastrado neste setor.
                  </div>
               ) : (
                  filteredExtras.map(extra => (
                     <div
                       key={extra.id}
                       className={`p-6 rounded-[2rem] border shadow-sm relative group hover:shadow-lg transition-all ${
                         extra.doNotCall
                           ? 'bg-rose-50 border-rose-300 shadow-rose-100'
                           : 'bg-white border-slate-100'
                       }`}
                     >
                        <div className="flex items-center space-x-4 mb-4">
                           <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg ${extra.doNotCall ? 'bg-rose-200 text-rose-700' : 'bg-slate-100 text-slate-400'}`}>
                              {extra.name[0]}
                           </div>
                           <div>
                              <div className="flex flex-wrap items-center gap-2 pr-16">
                                <h4 className={`font-black text-lg ${extra.doNotCall ? 'text-rose-900' : 'text-slate-800'}`}>{extra.name}</h4>
                                {extra.doNotCall && (
                                  <span className="rounded-full bg-rose-600 px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-white">Não chamar</span>
                                )}
                              </div>
                              <p className={`text-[10px] font-bold flex items-center ${extra.doNotCall ? 'text-rose-600' : 'text-slate-400'}`}><Phone size={10} className="mr-1"/> {extra.phone}</p>
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
                           <div className={`flex justify-between items-center p-3 rounded-xl ${extra.doNotCall ? 'bg-white/70' : 'bg-slate-50'}`}>
                              <span className="text-[9px] font-black text-slate-400 uppercase">Qualidade</span>
                              <div className="flex gap-0.5">
                                 {[1, 2, 3, 4, 5].map(star => (
                                    <div key={star} className={`w-2 h-2 rounded-full ${star <= extra.serviceQuality ? 'bg-emerald-400' : 'bg-slate-200'}`}></div>
                                 ))}
                              </div>
                           </div>
                           <button
                             type="button"
                             onClick={() => onSaveExtra({ ...extra, doNotCall: !extra.doNotCall })}
                             className={`w-full rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                               extra.doNotCall
                                 ? 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-100'
                                 : 'bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100'
                             }`}
                             title={extra.doNotCall ? 'Permitir que esta extra volte a ser chamada' : 'Marcar esta extra para não chamar'}
                           >
                             <PhoneOff size={14} />
                             {extra.doNotCall ? 'Voltar a chamar' : 'Não chamar'}
                           </button>
                        </div>

                        <div className="absolute top-4 right-4 flex space-x-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
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
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[400] flex items-center justify-center p-4 print:hidden">
           <div className="bg-white w-[98%] md:w-full md:max-w-3xl rounded-2xl md:rounded-[3rem] shadow-2xl max-h-[92dvh] md:max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in duration-300">
              <div className="p-6 md:p-8 border-b flex justify-between items-center bg-slate-50/50 shrink-0">
                 <div>
                    <h2 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tighter">{editingEmployee ? 'Editar' : 'Novo'} Colaborador</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{currentSector?.name}</p>
                 </div>
                 <div className="flex items-center gap-1">
                   {editingEmployee && (
                     <button type="button" onClick={() => setViewingHistoryEmployee(editingEmployee)} className="p-2 text-slate-300 hover:text-amber-500 transition-all" title="Histórico">
                       <History size={24}/>
                     </button>
                   )}
                   <button onClick={resetEmployeeForm} className="p-2 text-slate-300 hover:text-slate-900 transition-all"><X size={28}/></button>
                 </div>
              </div>

              <div className="flex bg-slate-100 p-1.5 mx-4 md:mx-8 mt-6 rounded-2xl border overflow-x-auto shrink-0">
                 <button onClick={() => setActiveFormTab('DADOS')} className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeFormTab === 'DADOS' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>Dados Pessoais</button>
                 <button onClick={() => setActiveFormTab('ESCALA')} className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeFormTab === 'ESCALA' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>Escala & Folgas</button>
                 <button onClick={() => setActiveFormTab('UNIFORMES')} className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeFormTab === 'UNIFORMES' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>Uniformes</button>
              </div>

               <form onSubmit={handleSaveEmployeeSubmit} className="p-4 sm:p-6 md:p-8 flex-1 overflow-y-auto space-y-8">
                 {activeFormTab === 'DADOS' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 animate-in slide-in-from-left-4">
                       <div className="md:col-span-2 flex flex-col items-center mb-4">
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
                       
                       <div className="md:col-span-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Nome Completo</label>
                          <input type="text" value={name} onChange={e => setName(e.target.value.toUpperCase())} className="w-full px-5 py-4 rounded-2xl border-2 font-bold text-slate-800 uppercase" required />
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
                          {availableEmployeeRoles.length > 0 ? (
                             <select value={role} onChange={e => setRole(e.target.value)} className="w-full px-5 py-4 rounded-2xl border-2 font-bold text-slate-800 bg-white" required>
                                <option value="">Selecione...</option>
                                {availableEmployeeRoles.map(r => <option key={r} value={r}>{r}</option>)}
                             </select>
                          ) : (
                             <input type="text" value={role} onChange={e => setRole(e.target.value.toUpperCase())} className="w-full px-5 py-4 rounded-2xl border-2 font-bold text-slate-800 uppercase" required />
                          )}
                          {currentSector && (
                            <div className="mt-2 flex gap-2">
                              <input
                                type="text"
                                value={newEmployeeRole}
                                onChange={e => setNewEmployeeRole(e.target.value.toUpperCase())}
                                placeholder="Novo cargo"
                                className="min-w-0 flex-1 px-4 py-2 rounded-xl border-2 font-bold text-xs text-slate-800 uppercase"
                              />
                              <button
                                type="button"
                                onClick={handleAddEmployeeRoleToSector}
                                disabled={!newEmployeeRole.trim()}
                                className="px-3 py-2 bg-slate-800 text-white rounded-xl disabled:opacity-40"
                                title="Adicionar cargo ao setor"
                              >
                                <Plus size={18}/>
                              </button>
                            </div>
                          )}
                       </div>
                       <div className="md:col-span-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Etiqueta do colaborador</label>
                          {savedTagOptions.length > 0 && (
                            <div className="mb-4">
                              <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-300">Etiquetas salvas</p>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => { setTagText(''); setTagColor(EMPLOYEE_TAG_COLORS[0].value); }}
                                  className={`h-9 px-3 rounded-lg border text-[9px] font-black uppercase transition-all ${!tagText ? 'border-slate-500 bg-slate-100 text-slate-700' : 'border-slate-200 bg-white text-slate-400'}`}
                                >
                                  Sem etiqueta
                                </button>
                                {savedTagOptions.map(tag => {
                                  const selected = normalizeTagLabel(tagText) === tag.label;
                                  return (
                                    <button
                                      key={tag.label}
                                      type="button"
                                      onClick={() => { setTagText(tag.label); setTagColor(tag.color); }}
                                      className="h-9 max-w-full px-3 rounded-lg border text-[9px] font-black uppercase transition-all inline-flex items-center gap-1.5"
                                      style={{ ...getTagStyle(tag.color), boxShadow: selected ? `0 0 0 2px ${colorWithAlpha(tag.color, 0.24)}` : 'none' }}
                                    >
                                      <Tag size={11} />
                                      <span className="max-w-40 truncate">{tag.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-300">Criar ou editar etiqueta</p>
                          <input
                            type="text"
                            value={tagText}
                            onChange={e => setTagText(e.target.value.toUpperCase())}
                            maxLength={30}
                            placeholder="Ex: LIDER, TREINAMENTO, TEMPORARIO"
                            className="min-w-0 w-full px-5 py-4 rounded-2xl border-2 font-bold text-slate-800 uppercase"
                          />
                          <div className="mt-3 flex flex-wrap gap-2" aria-label="Cores da etiqueta">
                            {EMPLOYEE_TAG_COLORS.map(color => (
                              <button
                                key={color.value}
                                type="button"
                                onClick={() => setTagColor(color.value)}
                                className="h-10 w-10 rounded-xl border-2 flex items-center justify-center transition-transform hover:scale-105"
                                style={{ ...getTagStyle(color.value), borderColor: tagColor === color.value ? color.value : colorWithAlpha(color.value, 0.38) }}
                                aria-label={color.name}
                                title={color.name}
                              >
                                {tagColor === color.value && <CheckCircle2 size={16} />}
                              </button>
                            ))}
                          </div>
                          {tagText.trim() && (
                            <span
                              className="mt-3 inline-flex max-w-full items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest"
                              style={getTagStyle(tagColor)}
                            >
                              <Tag size={11} />
                              <span className="truncate">{tagText}</span>
                            </span>
                          )}
                       </div>
                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Telefone de Contato</label>
                          <input type="text" value={contact} onChange={e => setContact(e.target.value)} placeholder="(00) 00000-0000" className="w-full px-5 py-4 rounded-2xl border-2 font-bold text-slate-800" />
                       </div>
                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Data de Admissão</label>
                          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-5 py-4 rounded-2xl border-2 font-bold text-slate-800" />
                       </div>
                       {scheduleType !== 'Intermitente' && (
                         <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Salário Base (R$)</label>
                            <input type="number" value={salary} onChange={e => setSalary(e.target.value)} className="w-full px-5 py-4 rounded-2xl border-2 font-bold text-slate-800" />
                            {getRoleSalary(role, currentSector) > 0 && (
                              <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                                Salário definido pela função: {formatMoneyValue(getRoleSalary(role, currentSector))}
                              </p>
                            )}
                         </div>
                       )}
                    </div>
                 )}

                 {activeFormTab === 'ESCALA' && (
                    <div className="space-y-8 animate-in slide-in-from-right-4">
                        <div className="md:col-span-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Tipo de Escala</label>
                           <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {(['6x1', '12x36', 'Intermitente', 'Horista'] as const).map(type => (
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
                                        {normalizeWeekday(day)}
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

                        {scheduleType === 'Horista' && (
                          <div className="space-y-6 animate-in fade-in">
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Dias que trabalha</label>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {weekDays.map(day => {
                                  const normalizedDay = normalizeWeekday(day);
                                  const selected = hourlyWorkDays.map(normalizeWeekday).includes(normalizedDay);
                                  return (
                                    <button
                                      key={day}
                                      type="button"
                                      onClick={() => setHourlyWorkDays(prev => {
                                        const normalizedPrev = prev.map(normalizeWeekday);
                                        return normalizedPrev.includes(normalizedDay)
                                          ? prev.filter(item => normalizeWeekday(item) !== normalizedDay)
                                          : [...prev, day];
                                      })}
                                      className={`px-3 py-3 rounded-xl border-2 font-black text-[10px] uppercase transition-all ${selected ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-400'}`}
                                    >
                                      {normalizedDay.slice(0, 3)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Folgas por data do mês</label>
                              <div className="grid grid-cols-7 sm:grid-cols-10 gap-1.5">
                                {Array.from({ length: 31 }, (_, index) => index + 1).map(day => (
                                  <button
                                    key={day}
                                    type="button"
                                    onClick={() => setHourlyDaysOff(prev => prev.includes(day) ? prev.filter(item => item !== day) : [...prev, day].sort((a, b) => a - b))}
                                    className={`h-9 rounded-lg border font-black text-[10px] transition-all ${hourlyDaysOff.includes(day) ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white border-slate-200 text-slate-400'}`}
                                  >
                                    {day}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Domingos de folga no mês</label>
                              <div className="flex flex-wrap gap-2">
                                {[1, 2, 3, 4, 5].map(n => (
                                  <button
                                    key={n}
                                    type="button"
                                    onClick={() => setSundayOffs(prev => prev.includes(n) ? prev.filter(i => i !== n) : [...prev, n].sort((a, b) => a - b))}
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

                        {scheduleType === 'Intermitente' && (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
                            Intermitente fica sem salario base, sem horario fixo e sem controle de ferias neste cadastro.
                          </div>
                        )}

                        {scheduleType !== 'Intermitente' && (
                          <div className="space-y-3 border-y border-slate-200 py-5">
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Folga - banco de horas</label>
                              <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-2">
                                <input
                                  type="date"
                                  value={newBankHoursDay}
                                  onChange={event => setNewBankHoursDay(event.target.value)}
                                  className="min-w-0 w-full px-4 py-3 rounded-xl border-2 border-slate-200 font-bold text-slate-800"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!newBankHoursDay) return;
                                    setBankHoursDaysOff(current => Array.from(new Set([...current, newBankHoursDay])).sort());
                                    setNewBankHoursDay('');
                                  }}
                                  disabled={!newBankHoursDay}
                                  className="inline-flex h-12 w-11 items-center justify-center rounded-xl bg-violet-600 text-white disabled:opacity-40"
                                  title="Adicionar folga de banco de horas"
                                >
                                  <Plus size={17} />
                                </button>
                              </div>
                            </div>
                            {bankHoursDaysOff.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {bankHoursDaysOff.map(day => (
                                  <div key={day} className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3">
                                    <span className="text-xs font-black text-violet-800">{parseLocalDate(day)?.toLocaleDateString('pt-BR')}</span>
                                    <button
                                      type="button"
                                      onClick={() => setBankHoursDaysOff(current => current.filter(item => item !== day))}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-violet-500 hover:bg-white hover:text-rose-600"
                                      title="Remover folga"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs font-bold text-slate-400">Nenhuma folga de banco de horas registrada.</div>
                            )}
                          </div>
                        )}

                       {scheduleType !== 'Intermitente' && (
                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Turno</label>
                           <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                             {shiftPeriodOptions.map(({ value, label, Icon }) => (
                               <button
                                 key={value}
                                 type="button"
                                 onClick={() => setShiftPeriod(value)}
                                 className={`py-3 rounded-xl border-2 font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2 ${shiftPeriod === value ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
                               >
                                 <Icon size={15} />
                                 {label}
                               </button>
                             ))}
                          </div>
                       </div>
                       )}

                        {(scheduleType === '6x1' || scheduleType === '12x36' || scheduleType === 'Horista') && (
                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Horário de Trabalho</label>
                           <input type="text" value={workingHours} onChange={e => setWorkingHours(e.target.value)} className="w-full px-5 py-4 rounded-2xl border-2 font-bold text-slate-800" placeholder="Ex: 08:00 - 16:20" />
                        </div>
                        )}

                        {scheduleType !== 'Intermitente' && (
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Status de Férias</label>
                          <div className="flex bg-slate-50 p-1 rounded-xl mb-4">
                             <button type="button" onClick={() => setVacationStatus('Pendente')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all ${vacationStatus === 'Pendente' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>Trabalhando</button>
                             <button type="button" onClick={() => setVacationStatus('Concedida')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all ${vacationStatus === 'Concedida' || vacationStatus === 'Férias Atuais' ? 'bg-blue-100 text-blue-700' : 'text-slate-400'}`}>Em Férias</button>
                          </div>
                           {(vacationStatus === 'Concedida' || vacationStatus === 'Férias Atuais') && (
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                               <div>
                                   <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Início</label>
                                  <input type="date" value={vacationStart} onChange={e => setVacationStart(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 font-bold text-slate-800 focus:border-blue-500" required />
                               </div>
                               <div>
                                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Quantidade de dias</label>
                                  <input type="number" min={1} value={vacationDays} onChange={e => setVacationDays(Math.max(1, Number(e.target.value) || 1))} className="w-full px-4 py-3 rounded-xl border-2 font-bold text-slate-800 focus:border-blue-500" required />
                               </div>
                               <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="rounded-xl bg-blue-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-blue-700">
                                    Fim calculado: {formVacationEnd ? formatShortDate(formVacationEnd) : '--'}
                                  </div>
                                  <div className="rounded-xl bg-emerald-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                    Volta ao trabalho: {formVacationReturn ? formatShortDate(formVacationReturn) : '--'}
                                  </div>
                               </div>
                             </div>
                           )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Início do período aquisitivo</label>
                              <input type="date" value={vacationAccrualStart} onChange={e => setVacationAccrualStart(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 font-bold text-slate-800 focus:border-blue-500" />
                            </div>
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Limite para conceder</label>
                              <input type="date" value={vacationDeadline} onChange={e => setVacationDeadline(e.target.value)} className={`w-full px-4 py-3 rounded-xl border-2 font-bold text-slate-800 focus:border-blue-500 ${vacationDeadline && parseLocalDate(vacationDeadline, true)! < new Date() ? 'border-rose-300 bg-rose-50' : ''}`} />
                            </div>
                          </div>
                          {vacationDeadline && (
                            <div className={`mt-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${getVacationDueInfo({ vacationDeadline } as Employee)?.tone === 'danger' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                              {getVacationDueInfo({ vacationDeadline } as Employee)?.label}
                            </div>
                          )}
                        </div>
                        )}
                    </div>
                 )}

                 {activeFormTab === 'UNIFORMES' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4">
                       <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-start space-x-3 mb-4">
                          <AlertCircle size={20} className="text-blue-500 mt-0.5" />
                          <p className="text-[10px] font-bold text-blue-700">
                             Os itens listados abaixo são o padrão definido para a função <strong>{role || 'Não Selecionada'}</strong>. 
                             Informe a quantidade que o funcionário já possui e o sistema calculará a reposição necessária.
                          </p>
                       </div>

                       {uniforms.length === 0 ? (
                          <div className="text-center py-8 text-slate-300 italic font-bold border-2 border-dashed border-slate-100 rounded-2xl">
                             {role ? 'Nenhum uniforme padrão definido para esta função.' : 'Selecione um Cargo na aba Dados Pessoais.'}
                          </div>
                       ) : (
                          <div className="space-y-3">
                             {/* Desktop Header */}
                             <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 bg-slate-50 rounded-xl text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <div className="col-span-4">Item</div>
                                <div className="col-span-2 text-center">Tamanho</div>
                                <div className="col-span-2 text-center">Qtd Atual</div>
                                <div className="col-span-2 text-center">Padrão</div>
                                <div className="col-span-2 text-right">A Repor</div>
                             </div>

                             {uniforms.map((u, idx) => {
                                const replenish = Math.max(0, (u.required || 0) - u.quantity);
                                return (
                                   <div key={idx} className="bg-white border-2 border-slate-50 rounded-2xl p-4 md:grid md:grid-cols-12 md:gap-4 md:items-center shadow-sm">
                                      {/* Item Name */}
                                      <div className="col-span-4 flex items-center space-x-3 mb-3 md:mb-0">
                                         <div className="p-2 bg-slate-100 text-slate-500 rounded-lg">
                                            <Shirt size={16} />
                                         </div>
                                         <p className="font-black text-slate-800 text-sm leading-tight">{u.name}</p>
                                      </div>

                                      {/* Size Input */}
                                      <div className="col-span-2 flex flex-col md:items-center mb-3 md:mb-0">
                                         <span className="md:hidden text-[9px] font-black text-slate-400 uppercase mb-1">Tamanho</span>
                                         <input 
                                            type="text" 
                                            value={u.size || ''} 
                                            onChange={e => handleUpdateEmployeeUniform(idx, 'size', e.target.value)}
                                            placeholder="P/M/G" 
                                            className="w-full md:w-20 px-3 py-2 rounded-xl border-2 bg-slate-50 font-bold text-sm text-center uppercase" 
                                         />
                                      </div>

                                      {/* Current Qty Input */}
                                      <div className="col-span-2 flex flex-col md:items-center mb-3 md:mb-0">
                                         <span className="md:hidden text-[9px] font-black text-slate-400 uppercase mb-1">Qtd Atual</span>
                                         <input 
                                            type="number" 
                                            value={u.quantity} 
                                            onChange={e => handleUpdateEmployeeUniform(idx, 'quantity', parseInt(e.target.value) || 0)}
                                            className="w-full md:w-20 px-3 py-2 rounded-xl border-2 font-bold text-sm text-center" 
                                         />
                                      </div>

                                      {/* Standard Qty Display */}
                                      <div className="col-span-2 flex justify-between md:justify-center items-center mb-3 md:mb-0 px-2 md:px-0 bg-slate-50 md:bg-transparent rounded-lg py-2 md:py-0">
                                         <span className="md:hidden text-[9px] font-black text-slate-400 uppercase">Padrão</span>
                                         <span className="text-xs font-black text-slate-500">{u.required} un</span>
                                      </div>

                                      {/* Replenish Display */}
                                      <div className="col-span-2 flex justify-between md:justify-end items-center px-2 md:px-0 bg-rose-50 md:bg-transparent rounded-lg py-2 md:py-0">
                                         <span className="md:hidden text-[9px] font-black text-rose-400 uppercase">A Repor</span>
                                         <span className={`text-sm font-black ${replenish > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                            {replenish > 0 ? `-${replenish}` : 'OK'}
                                         </span>
                                      </div>
                                   </div>
                                );
                             })}
                          </div>
                       )}

                       {/* Total Summary */}
                       {uniforms.length > 0 && (
                          <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                             <div className="bg-slate-900 text-white px-6 py-3 rounded-xl shadow-lg text-right">
                                <p className="text-[9px] font-bold opacity-60 uppercase tracking-widest">Total a Repor</p>
                                <p className="text-xl font-black">
                                   {uniforms.reduce((acc, curr) => acc + Math.max(0, (curr.required || 0) - curr.quantity), 0)} itens
                                </p>
                             </div>
                          </div>
                       )}
                    </div>
                 )}
                 
                 <div className="flex gap-4 pt-6 mt-6 border-t shrink-0">
                    <button type="button" onClick={resetEmployeeForm} className="flex-1 py-5 font-black uppercase text-[11px] text-slate-400">Cancelar</button>
                    <button type="submit" className="flex-1 py-5 rounded-[1.5rem] font-black uppercase text-sm text-white shadow-xl active:scale-95 transition-all" style={{ backgroundColor: theme.primary }}>Salvar</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Modal EXTRA LABOR */}
      {isAddingExtra && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[400] flex items-center justify-center p-4 print:hidden">
           <div className="bg-white w-[95%] md:w-full md:max-w-lg rounded-2xl md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90dvh]">
              <div className="p-6 md:p-8 border-b flex justify-between items-center bg-slate-50/50 shrink-0">
                 <h2 className="text-xl font-black text-slate-800">{editingExtra ? 'Editar Profissional' : 'Novo Extra'}</h2>
                 <button onClick={resetExtraForm} className="text-slate-300 hover:text-slate-500 transition-colors"><X size={24}/></button>
              </div>
              <form onSubmit={handleSaveExtraSubmit} className="p-6 md:p-8 space-y-4 overflow-y-auto">
                 <input type="text" value={extraName} onChange={e => setExtraName(e.target.value.toUpperCase())} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800 placeholder:text-slate-400 uppercase" placeholder="Nome Completo" required />
                 <input type="text" value={extraPhone} onChange={e => setExtraPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800 placeholder:text-slate-400" placeholder="Telefone" />
                 
                 <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-1">Dias de Disponibilidade</label>
                    <div className="flex flex-wrap gap-2">
                       {weekDays.map(d => (
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

                 <textarea value={extraObservation} onChange={e => setExtraObservation(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold h-24 bg-white text-slate-800 placeholder:text-slate-400" placeholder="Observações..." />
                 
                 <button type="submit" className="w-full py-5 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95 hover:brightness-110 shrink-0" style={{ backgroundColor: theme.primary }}>Salvar Profissional</button>
              </form>
           </div>
        </div>
      )}

      {/* MODAL CRACHÁ DIGITAL (BADGE) - MINIMALIST */}
      {selectedBadge && (
        <div className="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white w-[95%] md:w-full md:max-w-[300px] rounded-[1.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 relative flex flex-col max-h-[90dvh] print:shadow-none print:w-[300px] print:h-auto print:m-0 print:border-0">
              <button onClick={() => setSelectedBadge(null)} className="absolute top-3 right-3 p-1.5 bg-black/10 hover:bg-black/20 backdrop-blur rounded-full text-white transition-all print:hidden z-20"><X size={16}/></button>
              
              <div className="overflow-y-auto flex-1">
                {/* Minimalist Header with Hotel Color */}
                <div className="h-28 w-full relative flex items-center justify-center shrink-0" style={{ backgroundColor: theme.primary }}>
                   <div className="text-center text-white opacity-90">
                      <Briefcase size={24} className="mx-auto mb-1 opacity-50"/>
                      <p className="font-black tracking-[0.2em] text-[10px] uppercase">Crachá Digital</p>
                   </div>
                </div>

                {/* Content */}
                <div className="flex flex-col items-center -mt-14 px-6 pb-8 relative z-10">
                   {/* Photo */}
                   <div className="w-28 h-28 rounded-full border-[6px] border-white shadow-xl overflow-hidden bg-slate-100 mb-4 bg-cover">
                      {selectedBadge.photo ? (
                         <img src={selectedBadge.photo} alt={selectedBadge.name} className="w-full h-full object-cover"/>
                      ) : (
                         <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400">
                            <UserIcon size={48}/>
                         </div>
                      )}
                   </div>
                   
                   <div className="mb-3">
                      <Logo className="h-auto justify-center" themeColor={theme.primary} showText={false} />
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
              </div>
              
              {/* Print Button */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 print:hidden shrink-0">
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
            <div className="bg-white w-[95%] md:w-full md:max-w-2xl rounded-2xl md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] animate-in slide-in-from-bottom-8">
               <div className="p-6 md:p-8 border-b flex justify-between items-center bg-slate-50 shrink-0">
                  <div className="flex items-center space-x-4">
                     <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-500"><History size={24}/></div>
                     <div>
                        <h3 className="text-base md:text-lg font-black text-slate-800">Histórico do Colaborador</h3>
                        <p className="text-[10px] md:text-xs font-bold text-slate-400">{viewingHistoryEmployee.name}</p>
                     </div>
                  </div>
                  <button onClick={() => setViewingHistoryEmployee(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"><X size={24}/></button>
               </div>
               
               <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4">
                  {getEmployeeAuditHistory(viewingHistoryEmployee).length === 0 ? (
                     <div className="py-10 text-center bg-slate-50 rounded-2xl">
                        <p className="text-slate-300 font-bold italic">Nenhuma alteração cadastral registrada.</p>
                     </div>
                  ) : (
                     getEmployeeAuditHistory(viewingHistoryEmployee).map(entry => (
                        <div key={entry.id} className="p-4 bg-white border-2 border-slate-50 rounded-2xl">
                           <p className="font-black text-slate-800 text-sm uppercase">{entry.field}</p>
                           <p className="text-[10px] font-bold text-slate-400 uppercase">{entry.source || 'Cadastro'} - {new Date(entry.timestamp).toLocaleString('pt-BR')}</p>
                           <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 text-xs font-bold">
                              <div className="rounded-xl bg-rose-50 text-rose-700 px-3 py-2 break-words">{entry.before || '-'}</div>
                              <div className="hidden sm:flex items-center justify-center text-slate-300">→</div>
                              <div className="rounded-xl bg-emerald-50 text-emerald-700 px-3 py-2 break-words">{entry.after || '-'}</div>
                           </div>
                        </div>
                     ))
                  )}

                  <div className="pt-3 border-t border-slate-100">
                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Retiradas de Uniforme/Estoque</h4>
                     {getEmployeeInventoryHistory(viewingHistoryEmployee).length === 0 ? (
                        <p className="text-xs text-slate-300 font-bold italic">Nenhum item retirado por este colaborador.</p>
                     ) : (
                        getEmployeeInventoryHistory(viewingHistoryEmployee).map(op => (
                           <div key={op.id} className="flex items-center justify-between p-4 bg-white border-2 border-slate-50 rounded-2xl mb-2">
                              <div className="flex items-center space-x-4">
                                 <div className={`p-3 rounded-xl ${op.type === 'Entrada' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                                    {op.type === 'Entrada' ? <ArrowUpRight size={20}/> : <ArrowDownRight size={20}/>}
                                 </div>
                                 <div>
                                    <p className="font-black text-slate-800 text-sm leading-tight">{op.itemName}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(op.timestamp).toLocaleString('pt-BR')}</p>
                                 </div>
                              </div>
                              <div className="text-right">
                                 <span className="text-lg font-black text-slate-800 leading-none block">{op.quantity}</span>
                                 <span className="text-[10px] font-bold text-slate-400 uppercase block">Und.</span>
                              </div>
                           </div>
                        ))
                     )}
                  </div>
               </div>
            </div>
         </div>
      )}
      <style>{`
        @media print {
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .no-print, .print\\:hidden { display: none !important; }
          main { margin-left: 0 !important; padding: 0 !important; width: 100% !important; }
          .bg-white { background-color: white !important; }
          table { width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; }
          th, td { border: 1px solid #cbd5e1 !important; padding: 2px !important; font-size: 8px !important; }
          th { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; }
          .sticky { position: static !important; }
          .max-w-\\[250px\\] { max-width: none !important; width: auto !important; }
          @page { size: landscape; margin: 0.5cm; }
        }
      `}</style>
    </div>
  );
};

export default EmployeesView;
