
import React, { useState, useRef, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Employee, Sector, HotelTheme, UniformItem, ExtraLabor, InventoryOperation } from '../types';

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
  Settings,
  List,
  AlertCircle,
  ShoppingCart,
  Upload
} from 'lucide-react';

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
  const [newRole, setNewRole] = useState('');
  const [sectorUniforms, setSectorUniforms] = useState<UniformItem[]>([]);
  const [newSectorUniformName, setNewSectorUniformName] = useState('');
  const [newSectorUniformQty, setNewSectorUniformQty] = useState(1);
  const [newSectorUniformRole, setNewSectorUniformRole] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'LIST' | 'SCALE' | 'TODAY' | 'EXTRAS' | 'ORDERS' | 'WEEKLY_SCALE'>('LIST');
  const [activeFormTab, setActiveFormTab] = useState<'DADOS' | 'ESCALA' | 'UNIFORMES'>('DADOS');
  const [selectedBadge, setSelectedBadge] = useState<Employee | null>(null);
  const [viewingHistoryEmployee, setViewingHistoryEmployee] = useState<Employee | null>(null);

  // Scale Date State
  const [scaleDate, setScaleDate] = useState(new Date());
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
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [contact, setContact] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [salary, setSalary] = useState('');
  const [scheduleType, setScheduleType] = useState<'6x1' | '12x36' | 'Intermitente'>('6x1');
  const [shiftType, setShiftType] = useState<'Par' | 'Ímpar'>('Par');
  const [workingHours, setWorkingHours] = useState('08:00 - 16:20');
  const [fixedDayOff, setFixedDayOff] = useState('Segunda-feira');
  const [sundayOffs, setSundayOffs] = useState<number[]>([]);
  const [vacationStatus, setVacationStatus] = useState<'Pendente' | 'Concedida' | 'Férias Atuais'>('Pendente');
  const [vacationStart, setVacationStart] = useState('');
  const [vacationEnd, setVacationEnd] = useState('');
  
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

  const weekDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

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
    setName(''); setRole(''); setGender('M'); setContact(''); setSalary('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setUniforms([]); setScheduleType('6x1'); setShiftType('Par');
    setWorkingHours('08:00 - 16:20'); setFixedDayOff('Segunda-feira');
    setSundayOffs([]); setVacationStatus('Pendente');
    setVacationStart(''); setVacationEnd('');
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
    setSectorRoles(sec.roles || []);
    setSectorUniforms(sec.standardUniform || []);
    setIsSectorModalOpen(true);
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setName(emp.name || ''); 
    // Important: Set Role first to trigger effect, but we need the existing uniforms to merge correctly
    setRole(emp.role || ''); 
    setGender(emp.gender || 'M');
    setContact(emp.contact || ''); setStartDate(emp.startDate || ''); setSalary((emp.salary || 0).toString());
    
    // We preload existing uniforms so the Effect can merge them
    setUniforms(emp.uniforms || []); 
    
    setScheduleType(emp.scheduleType || '6x1');
    setShiftType(emp.shiftType || 'Par'); setWorkingHours(emp.workingHours || '08:00 - 16:20');
    setFixedDayOff(emp.fixedDayOff || 'Segunda-feira');
    setSundayOffs(emp.sundayOffs || []); setVacationStatus(emp.vacationStatus || 'Pendente');
    setVacationStart(emp.vacationStart || '');
    setVacationEnd(emp.vacationEnd || '');
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
      const { compressImage } = await import('../utils/imageUtils');
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
    if(!newRole.trim()) return;
    setSectorRoles([...sectorRoles, newRole]);
    setNewRole('');
  };

  const handleRemoveSectorRole = (index: number) => {
    const newArr = [...sectorRoles];
    newArr.splice(index, 1);
    setSectorRoles(newArr);
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
    onSaveSector({ 
      id: editingSector?.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, 
      name: sectorName, 
      standardUniform: sectorUniforms,
      roles: sectorRoles
    });
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

    const newEmp: Employee = {
      id: editingEmployee?.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name || 'Sem Nome', 
      role: role || 'Cargo', 
      gender, 
      contact, 
      startDate,
      salary: parseFloat(salary) || 0, 
      department: sectors.find(s => s.id === (selectedSectorId || editingEmployee?.sectorId))?.name || 'Geral',
      sectorId: (selectedSectorId || editingEmployee?.sectorId)!, 
      status: 'Ativo', 
      scheduleType, 
      shiftType: scheduleType === '12x36' ? shiftType : undefined,
      workingHours: scheduleType === 'Intermitente' ? '' : workingHours, 
      fixedDayOff: scheduleType === '6x1' ? fixedDayOff : '', 
      sundayOffs: scheduleType === '6x1' ? sundayOffs : [], 
      weeklyDayOff: scheduleType === '6x1' ? fixedDayOff : '', 
      monthlySundayOff: '', 
      vacationStatus, 
      vacationStart: vacationStatus === 'Concedida' || vacationStatus === 'Férias Atuais' ? vacationStart : undefined,
      vacationEnd: vacationStatus === 'Concedida' || vacationStatus === 'Férias Atuais' ? vacationEnd : undefined,
      uniforms,
      photo: finalPhoto
    };
    
    onSave(newEmp, newPhotoFile ? [newPhotoFile] : undefined);
    resetEmployeeForm();
  };

  const handleSaveExtraSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveExtra({
      id: editingExtra?.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: extraName,
      phone: extraPhone,
      availability: extraAvailability,
      serviceQuality: extraQuality,
      observation: extraObservation,
      sectorId: selectedSectorId || editingExtra?.sectorId || ''
    });
    resetExtraForm();
  };

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
        weekdayShort: ['d', 's', 't', 'q', 'q', 's', 's'][dayOfWeek],
        weekdayFull: d.toLocaleDateString('pt-BR', { weekday: 'long' }),
        isSunday: dayOfWeek === 0,
        sundayIndex
      };
    });
  }, [scaleDate]);

  const getShiftStatus = (emp: Employee, dayInfo: typeof scaleData[0]) => {
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
      const dayName = dayInfo.weekdayFull.toLowerCase().split('-')[0];
      const empOffDay = (emp.fixedDayOff || '').toLowerCase().split('-')[0];
      
      if (dayInfo.isSunday) {
        const empSundayOffs = (emp.sundayOffs || []).slice().sort((a, b) => a - b);
        const offIndex = empSundayOffs.indexOf(dayInfo.sundayIndex);
        if (offIndex !== -1) return `D${offIndex + 1}`;
      }
      
      if (dayName === empOffDay && !dayInfo.isSunday) return 'F';
    }
    return '';
  };

  const downloadScaleExcel = () => {
    const workbook = XLSX.utils.book_new();
    const rows = [
      ['COLABORADOR', 'JORNADA', 'FOLGA FIXA', ...scaleData.map(d => d.date.toString())],
      ['', '', '', ...scaleData.map(d => d.weekdayShort.toUpperCase())]
    ];
    
    filteredEmployees.forEach(emp => {
      const row = [
        emp.name,
        emp.workingHours || '08:00-16:20',
        emp.fixedDayOff || '-',
        ...scaleData.map(d => {
          const status = getShiftStatus(emp, d);
          if (status === 'FÉRIAS') return 'F';
          return status || '';
        })
      ];
      rows.push(row);
    });
    
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Escala");
    XLSX.writeFile(workbook, `Escala_${scaleDate.toISOString().slice(0, 7)}.xlsx`);
  };

  const filteredEmployees = employees.filter(e => 
    e.sectorId === selectedSectorId && (e.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredExtras = extras.filter(ext => 
    ext.sectorId === selectedSectorId && (ext.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentSector = sectors.find(s => s.id === selectedSectorId);

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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sectors.map((sec) => (
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
                           onChange={e => setNewRole(e.target.value)} 
                           placeholder="Novo Cargo (Ex: Recepcionista)" 
                           className="flex-1 px-4 py-2 rounded-xl border-2 font-bold text-sm" 
                         />
                         <button type="button" onClick={handleAddSectorRole} className="p-2 bg-slate-800 text-white rounded-xl"><Plus size={20}/></button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                         {sectorRoles.map((role, idx) => (
                            <span key={idx} className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 flex items-center">
                               {role}
                               <button type="button" onClick={() => handleRemoveSectorRole(idx)} className="ml-2 text-slate-400 hover:text-rose-500"><X size={12}/></button>
                            </span>
                         ))}
                         {sectorRoles.length === 0 && <span className="text-xs text-slate-300 italic">Nenhum cargo definido.</span>}
                      </div>
                   </div>

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
          <button onClick={() => setViewMode('SCALE')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${viewMode === 'SCALE' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>Escala Mensal</button>
          <button onClick={() => setViewMode('WEEKLY_SCALE')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${viewMode === 'WEEKLY_SCALE' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>Escala Semanal</button>
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
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <input type="text" placeholder="Buscar colaborador..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-100 text-sm font-bold bg-white shadow-inner" />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredEmployees.map(emp => (
              <div key={emp.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-6 group hover:border-blue-200 transition-all">
                <div className="flex items-center space-x-4 flex-1">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md overflow-hidden ${emp.gender === 'F' ? 'bg-rose-400' : 'bg-blue-400'}`}>
                    {emp.photo ? (
                      <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={24} className="text-white" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800">{emp.name || 'Sem Nome'}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                       {emp.role} • {emp.scheduleType === 'Intermitente' ? 'Intermitente' : `Folga: ${emp.fixedDayOff || 'Rodízio'}`}
                    </p>
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
        </div>
      )}

      {viewMode === 'SCALE' && (
        <div className="bg-white rounded-[1rem] border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-right-2 print:border-none print:shadow-none">
           <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
              <h3 className="font-black text-slate-800 uppercase text-lg tracking-widest">ESCALA {currentSector?.name} - {scaleDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}</h3>
              <div className="flex gap-2 items-center">
                 <button onClick={() => window.print()} className="bg-slate-200 text-slate-700 px-3 py-2 rounded font-bold flex items-center space-x-2 hover:bg-slate-300 transition-colors text-xs">
                    <Printer size={14} /> <span>Imprimir</span>
                  </button>
                  <button onClick={downloadScaleExcel} className="bg-emerald-600 text-white px-3 py-2 rounded font-bold flex items-center space-x-2 hover:bg-emerald-700 transition-colors text-xs">
                     <Download size={14} /> <span>Excel</span>
                 </button>
                 <input 
                    type="month" 
                    value={scaleDate.toISOString().slice(0, 7)}
                    onChange={(e) => setScaleDate(new Date(e.target.value + '-02'))}
                    className="px-4 py-2 rounded border border-slate-300 font-bold text-xs outline-none"
                 />
              </div>
           </div>
           <div className="hidden print:block p-4 text-center">
              <h3 className="font-black text-slate-800 uppercase text-xl tracking-widest">ESCALA {currentSector?.name} - {scaleDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}</h3>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-slate-300">
                 <thead>
                    <tr>
                       <th rowSpan={2} className="sticky left-0 bg-white z-20 px-4 py-2 font-black text-xs uppercase text-slate-800 border border-slate-300 min-w-[250px] text-center align-bottom">
                          <div className="flex items-end justify-between h-full">
                             <span className="[writing-mode:vertical-rl] transform rotate-180 text-[10px] text-slate-500 mr-2">QUADRO DE FUNCIONÁRIOS</span>
                             <span className="flex-1 text-center pb-1">COLABORADOR</span>
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
                    {filteredEmployees.map(emp => (
                       <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                          <td className="sticky left-0 bg-white z-10 px-2 py-1 border border-slate-300 text-xs font-bold text-slate-700 uppercase truncate max-w-[250px]">
                             {emp.name}
                          </td>
                          <td className="sticky left-[250px] bg-white z-10 px-2 py-1 border border-slate-300 text-xs font-medium text-slate-700 text-center">
                             {emp.workingHours || '08:00-16:20'}
                           </td>
                           <td className="sticky left-[350px] bg-white z-10 px-2 py-1 border border-slate-300 text-[10px] font-bold text-slate-700 text-center uppercase">
                              {emp.fixedDayOff || '-'}
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
                                     cells.push(
                                        <td key={`vacation-${i}`} colSpan={span} className="text-center p-0 border border-slate-300 text-[10px] sm:text-xs font-black bg-amber-100 text-amber-600 tracking-widest relative overflow-hidden group">
                                           <div className="absolute inset-0 flex items-center justify-center pointer-events-none">FÉRIAS</div>
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
                       <tr>
                          <td className="border border-slate-300 py-1 text-center w-1/3">F</td>
                          <td className="border border-slate-300 py-1 px-2 uppercase text-[10px]">FOLGA</td>
                       </tr>
                       <tr>
                          <td className="border border-slate-300 py-1 text-center"></td>
                          <td className="border border-slate-300 py-1 px-2 uppercase text-[10px]">DIA DE TRABALHO</td>
                       </tr>
                       <tr>
                          <td className="border border-slate-300 py-1 text-center">BH</td>
                          <td className="border border-slate-300 py-1 px-2 uppercase text-[10px]">BANCO DE HORA</td>
                       </tr>
                       <tr>
                          <td className="border border-slate-300 py-1 text-center">D</td>
                          <td className="border border-slate-300 py-1 px-2 uppercase text-[10px]">DOMINGO</td>
                       </tr>
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
                       <tr><td className="border border-slate-300 h-6"></td></tr>
                       <tr><td className="border border-slate-300 h-6"></td></tr>
                       <tr><td className="border border-slate-300 h-6"></td></tr>
                    </tbody>
                 </table>
              </div>
           </div>
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
                     <div key={extra.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative group hover:shadow-lg transition-all">
                        <div className="flex items-center space-x-4 mb-4">
                           <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-black text-lg">
                              {extra.name[0]}
                           </div>
                           <div>
                              <h4 className="font-black text-slate-800 text-lg">{extra.name}</h4>
                              <p className="text-[10px] font-bold text-slate-400 flex items-center"><Phone size={10} className="mr-1"/> {extra.phone}</p>
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
                           <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                              <span className="text-[9px] font-black text-slate-400 uppercase">Qualidade</span>
                              <div className="flex gap-0.5">
                                 {[1, 2, 3, 4, 5].map(star => (
                                    <div key={star} className={`w-2 h-2 rounded-full ${star <= extra.serviceQuality ? 'bg-emerald-400' : 'bg-slate-200'}`}></div>
                                 ))}
                              </div>
                           </div>
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
                 <button onClick={resetEmployeeForm} className="p-2 text-slate-300 hover:text-slate-900 transition-all"><X size={28}/></button>
              </div>

              <div className="flex bg-slate-100 p-1.5 mx-4 md:mx-8 mt-6 rounded-2xl border overflow-x-auto shrink-0">
                 <button onClick={() => setActiveFormTab('DADOS')} className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeFormTab === 'DADOS' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>Dados Pessoais</button>
                 <button onClick={() => setActiveFormTab('ESCALA')} className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeFormTab === 'ESCALA' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>Escala & Folgas</button>
                 <button onClick={() => setActiveFormTab('UNIFORMES')} className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeFormTab === 'UNIFORMES' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>Uniformes</button>
              </div>

              <form onSubmit={handleSaveEmployeeSubmit} className="p-6 md:p-8 flex-1 overflow-y-auto space-y-8">
                 {activeFormTab === 'DADOS' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-left-4">
                       <div className="col-span-2 flex flex-col items-center mb-4">
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
                       
                       <div className="col-span-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Nome Completo</label>
                          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-5 py-4 rounded-2xl border-2 font-bold text-slate-800" required />
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
                          {currentSector && currentSector.roles && currentSector.roles.length > 0 ? (
                             <select value={role} onChange={e => setRole(e.target.value)} className="w-full px-5 py-4 rounded-2xl border-2 font-bold text-slate-800 bg-white" required>
                                <option value="">Selecione...</option>
                                {currentSector.roles.map(r => <option key={r} value={r}>{r}</option>)}
                             </select>
                          ) : (
                             <input type="text" value={role} onChange={e => setRole(e.target.value)} className="w-full px-5 py-4 rounded-2xl border-2 font-bold text-slate-800" required />
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
                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Salário Base (R$)</label>
                          <input type="number" value={salary} onChange={e => setSalary(e.target.value)} className="w-full px-5 py-4 rounded-2xl border-2 font-bold text-slate-800" />
                       </div>
                    </div>
                 )}

                 {activeFormTab === 'ESCALA' && (
                    <div className="space-y-8 animate-in slide-in-from-right-4">
                       <div className="col-span-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Tipo de Escala</label>
                          <div className="flex gap-2">
                             {(['6x1', '12x36', 'Intermitente'] as const).map(type => (
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
                                        {day.substring(0, 3)}
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

                       {scheduleType === '12x36' && (
                          <div className="animate-in fade-in">
                             <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Padrão do Turno</label>
                             <div className="flex gap-2">
                                <button type="button" onClick={() => setShiftType('Par')} className={`flex-1 py-3 rounded-xl border-2 font-black text-xs uppercase ${shiftType === 'Par' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-400'}`}>Dias Pares</button>
                                <button type="button" onClick={() => setShiftType('Ímpar')} className={`flex-1 py-3 rounded-xl border-2 font-black text-xs uppercase ${shiftType === 'Ímpar' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-400'}`}>Dias Ímpares</button>
                             </div>
                          </div>
                       )}

                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Horário de Trabalho</label>
                          <input type="text" value={workingHours} onChange={e => setWorkingHours(e.target.value)} className="w-full px-5 py-4 rounded-2xl border-2 font-bold text-slate-800" placeholder="Ex: 08:00 - 16:20" />
                       </div>

                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Status de Férias</label>
                          <div className="flex bg-slate-50 p-1 rounded-xl mb-4">
                             <button type="button" onClick={() => setVacationStatus('Pendente')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all ${vacationStatus === 'Pendente' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>Trabalhando</button>
                             <button type="button" onClick={() => setVacationStatus('Concedida')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all ${vacationStatus === 'Concedida' || vacationStatus === 'Férias Atuais' ? 'bg-amber-100 text-amber-600' : 'text-slate-400'}`}>Em Férias</button>
                          </div>
                          {(vacationStatus === 'Concedida' || vacationStatus === 'Férias Atuais') && (
                            <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                               <div>
                                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Início</label>
                                  <input type="date" value={vacationStart} onChange={e => setVacationStart(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 font-bold text-slate-800 focus:border-amber-500" required />
                               </div>
                               <div>
                                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Fim</label>
                                  <input type="date" value={vacationEnd} onChange={e => setVacationEnd(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 font-bold text-slate-800 focus:border-amber-500" required />
                               </div>
                            </div>
                          )}
                       </div>
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
                 <input type="text" value={extraName} onChange={e => setExtraName(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800 placeholder:text-slate-400" placeholder="Nome Completo" required />
                 <input type="text" value={extraPhone} onChange={e => setExtraPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 outline-none font-bold bg-white text-slate-800 placeholder:text-slate-400" placeholder="Telefone" />
                 
                 <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-1">Dias de Disponibilidade</label>
                    <div className="flex flex-wrap gap-2">
                       {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map(d => (
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
                        <h3 className="text-base md:text-lg font-black text-slate-800">Histórico de Retiradas</h3>
                        <p className="text-[10px] md:text-xs font-bold text-slate-400">{viewingHistoryEmployee.name}</p>
                     </div>
                  </div>
                  <button onClick={() => setViewingHistoryEmployee(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"><X size={24}/></button>
               </div>
               
               <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4">
                  {inventoryHistory.filter(h => h.recipientName === viewingHistoryEmployee.name || h.recipientId === viewingHistoryEmployee.id).length === 0 ? (
                     <div className="py-20 text-center">
                        <p className="text-slate-300 font-bold italic">Nenhum item retirado por este colaborador.</p>
                     </div>
                  ) : (
                     inventoryHistory
                        .filter(h => h.recipientName === viewingHistoryEmployee.name || h.recipientId === viewingHistoryEmployee.id)
                        .map(op => (
                           <div key={op.id} className="flex items-center justify-between p-4 bg-white border-2 border-slate-50 rounded-2xl">
                              <div className="flex items-center space-x-4">
                                 <div className={`p-3 rounded-xl ${op.type === 'Entrada' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                                    {op.type === 'Entrada' ? <ArrowUpRight size={20}/> : <ArrowDownRight size={20}/>}
                                 </div>
                                 <div>
                                    <p className="font-black text-slate-800 text-sm leading-tight">{op.itemName}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(op.timestamp).toLocaleString()}</p>
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
