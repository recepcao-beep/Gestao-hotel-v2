import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  BedDouble,
  BellRing,
  Bot,
  Building2,
  CalendarDays,
  CalendarCheck2,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  Clock3,
  ConciergeBell,
  DoorOpen,
  ExternalLink,
  FileText,
  Home,
  LayoutDashboard,
  Loader2,
  MailCheck,
  MessageCircle,
  Play,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings2,
  Shirt,
  Terminal,
  Trash2,
  Utensils,
  X,
} from 'lucide-react';
import { HotelTheme } from '../types';

type Rotina = 'vinculacao_diaria' | 'mr' | 'obs' | 'vinc3' | 'limpeza' | 'checkin_email' | 'checkin_whatsapp';
type VinculacaoEtapa = 'limpeza' | 'mr' | 'obs' | 'vinc3';
type ObservacaoSetor = 'restaurante' | 'governanca' | 'recepcao';
type ReceptionTab = 'robos' | 'mensagens' | 'observacoes' | 'lavanderia';
type OperationalSection = 'recepcao' | 'governanca';

interface RobotsViewProps {
  theme: HotelTheme;
}

interface RobotRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
}

interface RobotLogEntry {
  id: number;
  at: string;
  text: string;
  tone: 'info' | 'success' | 'error' | 'warning';
}

interface ObservacaoItem {
  date: string;
  voucher: string;
  apartment: string;
  floor: string;
  linkedVoucher: string;
  request: string;
}

interface ObservacaoSection {
  items: ObservacaoItem[];
  text: string;
}

interface ObservacoesPayload {
  updatedAt: string;
  exceptions: { date: string; floor: string }[];
  sections: Record<ObservacaoSetor, ObservacaoSection>;
}

interface ExceptionFloor {
  date: string;
  floor: string;
}

interface HousekeepingMetrics {
  occupied?: number;
  vacant: number;
  interdicted?: number;
  checkins: number;
  checkouts: number;
  mapCheckins?: number;
  mapCheckouts?: number;
  hitsCheckins?: number;
  hitsCheckouts?: number;
}

interface HousekeepingCorridor {
  corridor: string;
  rooms: number;
  selected: HousekeepingMetrics;
  today: HousekeepingMetrics;
  tomorrow: HousekeepingMetrics;
  workload: number;
}

interface HousekeepingDashboard {
  updatedAt: string;
  dates: {
    today: string;
    tomorrow: string;
    selected: string;
    selectedLabel: string;
    todayLabel: string;
    tomorrowLabel: string;
  };
  availableDates: { date: string; label: string }[];
  requestedDateAvailable: boolean;
  mapComparisonAvailable: boolean;
  hasData: boolean;
  totals: {
    rooms: number;
    occupied: number;
    vacant: number;
    interdicted: number;
    checkins: number;
    checkouts: number;
    checkinsToday: number;
    checkoutsToday: number;
    checkinsTomorrow: number;
    checkoutsTomorrow: number;
  };
  unassignedCheckins: {
    selected: number;
    today: number;
    tomorrow: number;
  };
  unassignedCheckouts: {
    selected: number;
    today: number;
    tomorrow: number;
  };
  corridors: HousekeepingCorridor[];
}

interface CheckinWhatsappContact {
  id: string;
  updatedAt: string;
  voucher: string;
  name: string;
  shortName: string;
  phone: string;
  whatsappPhone: string;
  status: string;
}

const rotinaLabels: Record<Rotina, string> = {
  vinculacao_diaria: 'Vinculacao diaria',
  mr: 'Atualizar mapinha',
  obs: 'Atualizar observacoes',
  vinc3: 'Vinculacao',
  limpeza: 'Limpar mapa',
  checkin_email: 'Check-in por email',
  checkin_whatsapp: 'Contatos WhatsApp',
};

const rotinaDescriptions: Record<Rotina, string> = {
  vinculacao_diaria: 'Limpeza + MR + OBS + VINC3',
  mr: 'Roda apenas o MR e atualiza a projecao do mapinha.',
  obs: 'Roda apenas o OBS e atualiza as observacoes.',
  vinc3: 'Roda apenas o VINC3 para vincular apartamentos de hoje.',
  limpeza: 'Roda apenas a limpeza do mapa de reservas.',
  checkin_email: 'Anexos + cadastro + etiquetas',
  checkin_whatsapp: 'Entradas de hoje + telefones',
};

const rotinaIcons: Record<Rotina, React.ElementType> = {
  vinculacao_diaria: CalendarCheck2,
  mr: CalendarDays,
  obs: FileText,
  vinc3: Bot,
  limpeza: Trash2,
  checkin_email: MailCheck,
  checkin_whatsapp: MessageCircle,
};

const vinculacaoRotinas: Rotina[] = ['vinculacao_diaria', 'mr', 'obs', 'vinc3', 'limpeza'];
const outrosRobos: Rotina[] = ['checkin_email'];
const vinculacaoEtapas: { id: VinculacaoEtapa; label: string }[] = [
  { id: 'limpeza', label: 'Limpeza' },
  { id: 'mr', label: 'MR' },
  { id: 'obs', label: 'OBS' },
  { id: 'vinc3', label: 'Vinc3' },
];

const receptionTabs: { id: ReceptionTab; label: string; description: string; icon: React.ElementType }[] = [
  { id: 'robos', label: 'Robos', description: 'Mapinha e automacoes', icon: Bot },
  { id: 'mensagens', label: 'Mensagens', description: 'Contatos e WhatsApp', icon: MessageCircle },
  { id: 'observacoes', label: 'Observacoes', description: 'Setores e alertas', icon: FileText },
  { id: 'lavanderia', label: 'Lavanderia', description: 'Orcamentos de pecas', icon: Shirt },
];

const operationalSections: { id: OperationalSection; label: string; description: string; icon: React.ElementType }[] = [
  { id: 'recepcao', label: 'Recepcao', description: 'Automacoes e ferramentas do atendimento', icon: ConciergeBell },
  { id: 'governanca', label: 'Governanca', description: 'Mapa, bloqueios e planejamento dos andares', icon: BedDouble },
];

const corridorPlanningWeekdays = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
const operationalCorridors = ['200', '300', '400', '500', '600', '700'];
const emptyCorridorPlan = () => Object.fromEntries(operationalCorridors.map(corridor => [corridor, Array(7).fill(0)])) as Record<string, number[]>;

const laundryPriceList = [
  { name: 'MAIO/BIQUINI / SUNGA', price: 15 },
  { name: 'ROUPAO', price: 25 },
  { name: 'TOALHAS', price: 15 },
  { name: 'FRONHA', price: 10 },
  { name: 'BLUSAS', price: 12 },
  { name: 'LINGERIE / CUECAS / MEIAS', price: 8 },
  { name: 'CAMISETAS', price: 12 },
  { name: 'CAMISA / CALCA SOCIAL', price: 25 },
  { name: 'BLAZER', price: 35 },
  { name: 'PIJAMAS', price: 15 },
  { name: 'SAIAS', price: 12 },
  { name: 'CALCAS', price: 12 },
  { name: 'VESTIDOS', price: 15 },
  { name: 'VESTIDO LONGO', price: 25 },
  { name: 'SHORTS', price: 10 },
  { name: 'JAQUETAS', price: 15 },
  { name: 'MACACAO', price: 20 },
  { name: 'BOLSA / MOCHILA', price: 35 },
  { name: 'TENIS', price: 25 },
  { name: 'COBERTAS / MANTA / TRAVESSEIRO', price: 20 },
  { name: 'LENCOL', price: 10 },
  { name: 'CAMISETA INFANTIL', price: 9 },
  { name: 'MAIO / BIQUINI / SUNGA INFANTIL', price: 5 },
  { name: 'BABADOR / FRALDINHA', price: 5 },
  { name: 'CAPA CADEIRINHA', price: 40 },
  { name: 'CAMISA / CALCA SOCIAL INFANTIL', price: 15 },
  { name: 'SHORTS INFANTIL', price: 8 },
  { name: 'CALCAS INFANTIL', price: 10 },
  { name: 'MACACAO BEBE', price: 15 },
  { name: 'VESTIDO INFANTIL', price: 12 },
];

const observacaoLabels: Record<ObservacaoSetor, string> = {
  restaurante: 'Restaurante',
  governanca: 'Governanca',
  recepcao: 'Recepcao',
};

const observacaoDescriptions: Record<ObservacaoSetor, string> = {
  restaurante: 'Alergenicos e mimos',
  governanca: 'Colchao, berco e arrumacao',
  recepcao: 'Proximidade e andares',
};

const observacaoIcons: Record<ObservacaoSetor, React.ElementType> = {
  restaurante: Utensils,
  governanca: BedDouble,
  recepcao: ConciergeBell,
};

const formatTodayIso = () => new Date().toISOString().slice(0, 10);

const dateToIso = (value: string) => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return '';
  const [, rawDay, rawMonth, rawYear] = match;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  return `${year.padStart(4, '0')}-${rawMonth.padStart(2, '0')}-${rawDay.padStart(2, '0')}`;
};

const isoToBrDate = (value: string) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
};

const formatOperationalDate = (value: string) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return 'Selecionar data';
  return `${match[3]}/${match[2]}/${match[1]}`;
};

const normalizeSearch = (value: string) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const defaultWhatsappTemplate = `Olá {nome}, seja muito bem-vindo ao Hotel Vilage Inn.

Estamos muito felizes em recebê-lo. Para tornar sua chegada mais rápida e confortável, você pode nos enviar por aqui os dados necessários para adiantar o check-in.

Segue também o link do nosso informativo:
{link_informativo}

Qualquer dúvida, estamos à disposição. Obrigado e até logo!`;

const defaultInformativeLink = 'https://mesquite-hisser-6e8.notion.site/1c0fb9fb7e0280488794ff5b9abbaf4c?v=1c0fb9fb7e0280e5ba6b000ce896f969';

const isSpecialHousekeeping = (text: string) => {
  const normalized = String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return normalized.includes('arrumacao romantica') || normalized.includes('arrumacao romant');
};

const formatObservationLine = (item: ObservacaoItem) =>
  `${item.voucher || 'sem voucher'} - ${item.apartment || 'sem apto'} - ${item.request}`;

const RobotsView: React.FC<RobotsViewProps> = ({ theme }) => {
  const lastStatusKeyRef = useRef('');
  const [run, setRun] = useState<RobotRun | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [running, setRunning] = useState<Rotina | null>(null);
  const [trackingRotina, setTrackingRotina] = useState<Rotina>('vinculacao_diaria');
  const [trackingStartedAt, setTrackingStartedAt] = useState<number | null>(null);
  const [trackedRunId, setTrackedRunId] = useState<number | null>(null);
  const [isWatchingRun, setIsWatchingRun] = useState(false);
  const [robotLogs, setRobotLogs] = useState<RobotLogEntry[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [configWarning, setConfigWarning] = useState('');
  const [observacoes, setObservacoes] = useState<ObservacoesPayload | null>(null);
  const [loadingObservacoes, setLoadingObservacoes] = useState(false);
  const [observacoesError, setObservacoesError] = useState('');
  const [activeObservacao, setActiveObservacao] = useState<ObservacaoSetor>('restaurante');
  const [copiedObservacao, setCopiedObservacao] = useState<ObservacaoSetor | null>(null);
  const [exceptionsDraft, setExceptionsDraft] = useState<ExceptionFloor[]>([]);
  const [savingExceptions, setSavingExceptions] = useState(false);
  const [selectedDate, setSelectedDate] = useState(formatTodayIso());
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [checkinContacts, setCheckinContacts] = useState<CheckinWhatsappContact[]>([]);
  const [loadingCheckinContacts, setLoadingCheckinContacts] = useState(false);
  const [checkinContactsError, setCheckinContactsError] = useState('');
  const [whatsappTemplate, setWhatsappTemplate] = useState(defaultWhatsappTemplate);
  const [informativeLink, setInformativeLink] = useState(defaultInformativeLink);
  const [savingWhatsappConfig, setSavingWhatsappConfig] = useState(false);
  const [whatsappConfigMessage, setWhatsappConfigMessage] = useState('');
  const [activeOperationalSection, setActiveOperationalSection] = useState<OperationalSection>('recepcao');
  const [activeReceptionTab, setActiveReceptionTab] = useState<ReceptionTab>('robos');
  const [housekeepingDashboard, setHousekeepingDashboard] = useState<HousekeepingDashboard | null>(null);
  const [loadingHousekeeping, setLoadingHousekeeping] = useState(false);
  const [housekeepingError, setHousekeepingError] = useState('');
  const [housekeepingMessage, setHousekeepingMessage] = useState('');
  const [selectedHousekeepingDate, setSelectedHousekeepingDate] = useState('');
  const [isHousekeepingCalendarOpen, setIsHousekeepingCalendarOpen] = useState(false);
  const [corridorArrivalsPlan, setCorridorArrivalsPlan] = useState<Record<string, number[]>>(emptyCorridorPlan);
  const [selectedPlanningWeekday, setSelectedPlanningWeekday] = useState(new Date().getDay());
  const [loadingCorridorPlan, setLoadingCorridorPlan] = useState(false);
  const [savingCorridorPlan, setSavingCorridorPlan] = useState(false);
  const [corridorPlanMessage, setCorridorPlanMessage] = useState('');
  const [corridorPlanError, setCorridorPlanError] = useState('');
  const [showVinculacaoConfig, setShowVinculacaoConfig] = useState(false);
  const [vinculacaoEtapasSelecionadas, setVinculacaoEtapasSelecionadas] = useState<VinculacaoEtapa[]>(
    vinculacaoEtapas.map((etapa) => etapa.id)
  );
  const [laundrySearch, setLaundrySearch] = useState('');
  const [laundryCart, setLaundryCart] = useState<{ id: string; name: string; price: number; quantity: number }[]>([]);
  const [laundryUrgent, setLaundryUrgent] = useState(false);
  const [dismissedRomanticAlertKey, setDismissedRomanticAlertKey] = useState('');
  const lastNotificationKeyRef = useRef('');

  const addRobotLog = useCallback((text: string, tone: RobotLogEntry['tone'] = 'info') => {
    setRobotLogs((current) => [
      ...current.slice(-7),
      {
        id: Date.now() + Math.random(),
        at: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        text,
        tone,
      },
    ]);
  }, []);

  const loadStatus = useCallback(async (silent = false, rotina: Rotina = trackingRotina) => {
    if (!silent) setLoadingStatus(true);
    setConfigWarning('');
    try {
      const response = await fetch(`/api/robots/vinculacao/status?rotina=${encodeURIComponent(rotina)}`);
      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'Falha ao consultar status.');
      }
      setRun(data.run);
      return data.run as RobotRun | null;
    } catch (err: any) {
      setConfigWarning(err.message || 'Falha ao consultar status.');
      return null;
    } finally {
      if (!silent) setLoadingStatus(false);
    }
  }, [trackingRotina]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const loadHousekeepingDashboard = useCallback(async (date?: string, showSuccess = false) => {
    setLoadingHousekeeping(true);
    setHousekeepingError('');
    setHousekeepingMessage('');
    try {
      const query = date ? `?date=${encodeURIComponent(date)}` : '';
      const response = await fetch(`/api/robots/governanca-painel${query}`);
      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'Falha ao carregar painel da Governanca.');
      }
      setHousekeepingDashboard(data);
      setSelectedHousekeepingDate(data.dates?.selected || date || '');
      if (showSuccess) setHousekeepingMessage('Dados atualizados para a data selecionada.');
    } catch (err: any) {
      setHousekeepingError(err.message || 'Falha ao carregar painel da Governanca.');
    } finally {
      setLoadingHousekeeping(false);
    }
  }, []);

  const loadCorridorPlan = useCallback(async () => {
    setLoadingCorridorPlan(true);
    setCorridorPlanError('');
    try {
      const response = await fetch('/api/robots/planejamento-corredores');
      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'Falha ao carregar planejamento dos corredores.');
      }
      setCorridorArrivalsPlan({ ...emptyCorridorPlan(), ...(data.plan || {}) });
    } catch (err: any) {
      setCorridorPlanError(err.message || 'Falha ao carregar planejamento dos corredores.');
    } finally {
      setLoadingCorridorPlan(false);
    }
  }, []);

  const saveCorridorPlan = async () => {
    setSavingCorridorPlan(true);
    setCorridorPlanError('');
    setCorridorPlanMessage('');
    try {
      const response = await fetch('/api/robots/planejamento-corredores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: corridorArrivalsPlan }),
      });
      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'Falha ao salvar planejamento dos corredores.');
      }
      setCorridorArrivalsPlan({ ...emptyCorridorPlan(), ...(data.plan || {}) });
      setCorridorPlanMessage('Planejamento semanal salvo na planilha.');
    } catch (err: any) {
      setCorridorPlanError(err.message || 'Falha ao salvar planejamento dos corredores.');
    } finally {
      setSavingCorridorPlan(false);
    }
  };

  useEffect(() => {
    if (activeOperationalSection === 'governanca' && !housekeepingDashboard) {
      loadHousekeepingDashboard();
    }
  }, [activeOperationalSection, housekeepingDashboard, loadHousekeepingDashboard]);

  useEffect(() => {
    if (activeOperationalSection === 'governanca') void loadCorridorPlan();
  }, [activeOperationalSection, loadCorridorPlan]);

  useEffect(() => {
    if (!selectedHousekeepingDate) return;
    const selectedDate = new Date(`${selectedHousekeepingDate}T12:00:00`);
    if (!Number.isNaN(selectedDate.getTime())) setSelectedPlanningWeekday(selectedDate.getDay());
  }, [selectedHousekeepingDate]);

  const loadObservacoes = useCallback(async () => {
    setLoadingObservacoes(true);
    setObservacoesError('');
    try {
      const response = await fetch('/api/robots/observacoes');
      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'Falha ao carregar observações.');
      }
      const nextObservacoes = {
        updatedAt: data.updatedAt,
        exceptions: data.exceptions || [],
        sections: data.sections || {
          restaurante: { items: [], text: '' },
          governanca: { items: [], text: '' },
          recepcao: { items: [], text: '' },
        },
      };
      setObservacoes(nextObservacoes);
      setExceptionsDraft(nextObservacoes.exceptions);
    } catch (err: any) {
      setObservacoesError(err.message || 'Falha ao carregar observações.');
    } finally {
      setLoadingObservacoes(false);
    }
  }, []);

  useEffect(() => {
    loadObservacoes();
  }, [loadObservacoes]);

  const loadCheckinContacts = useCallback(async () => {
    setLoadingCheckinContacts(true);
    setCheckinContactsError('');
    try {
      const response = await fetch('/api/robots/checkin-whatsapp');
      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'Falha ao carregar contatos.');
      }
      setCheckinContacts(data.contacts || []);
    } catch (err: any) {
      setCheckinContactsError(err.message || 'Falha ao carregar contatos.');
    } finally {
      setLoadingCheckinContacts(false);
    }
  }, []);

  useEffect(() => {
    loadCheckinContacts();
  }, [loadCheckinContacts]);

  const loadWhatsappConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/robots/checkin-whatsapp/config');
      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'Falha ao carregar mensagem do WhatsApp.');
      }
      setWhatsappTemplate(data.template || defaultWhatsappTemplate);
      setInformativeLink(data.informativeLink || defaultInformativeLink);
    } catch (err: any) {
      setCheckinContactsError(err.message || 'Falha ao carregar mensagem do WhatsApp.');
    }
  }, []);

  useEffect(() => {
    loadWhatsappConfig();
  }, [loadWhatsappConfig]);

  useEffect(() => {
    if (!isWatchingRun) return;

    const interval = window.setInterval(async () => {
      const latestRun = await loadStatus(true, trackingRotina);
      if (!latestRun) return;

      const latestCreatedAt = new Date(latestRun.createdAt).getTime();
      if (trackingStartedAt && latestCreatedAt < trackingStartedAt - 60000) {
        addRobotLog('Aguardando o GitHub Actions criar a execucao...', 'warning');
        return;
      }

      if (trackedRunId !== latestRun.id) {
        setTrackedRunId(latestRun.id);
        addRobotLog(`Execucao encontrada no GitHub: #${latestRun.id}.`, 'info');
      }

      const statusKey = `${latestRun.id}-${latestRun.status}-${latestRun.conclusion || ''}`;
      if (lastStatusKeyRef.current === statusKey) return;
      lastStatusKeyRef.current = statusKey;

      if (latestRun.status === 'queued') {
        addRobotLog('Workflow na fila do GitHub Actions.', 'warning');
        return;
      }

      if (latestRun.status === 'in_progress') {
        addRobotLog('Robo em execucao. Aguarde a conclusao.', 'info');
        return;
      }

      if (latestRun.status === 'completed') {
        if (latestRun.conclusion === 'success') {
          addRobotLog('Execucao concluida com sucesso.', 'success');
          setMessage('Robo concluido com sucesso.');
          if (trackingRotina === 'mr') {
            addRobotLog('Atualizando indicadores da Governanca...', 'info');
            void loadHousekeepingDashboard(selectedHousekeepingDate, true);
          }
        } else {
          addRobotLog(`Execucao finalizada com status: ${latestRun.conclusion || 'falha'}.`, 'error');
          setError(`Robo finalizado com status: ${latestRun.conclusion || 'falha'}.`);
        }
        setIsWatchingRun(false);
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [addRobotLog, isWatchingRun, loadHousekeepingDashboard, loadStatus, selectedHousekeepingDate, trackedRunId, trackingRotina, trackingStartedAt]);

  const runRobot = async (rotina: Rotina, etapas?: VinculacaoEtapa[]) => {
    const etapasPayload = rotina === 'vinculacao_diaria' && etapas ? etapas : undefined;
    const etapasLabel = etapasPayload?.length
      ? vinculacaoEtapas
        .filter((etapa) => etapasPayload.includes(etapa.id))
        .map((etapa) => etapa.label)
        .join(' + ')
      : '';
    setRunning(rotina);
    setTrackingRotina(rotina);
    setIsWatchingRun(false);
    setTrackedRunId(null);
    lastStatusKeyRef.current = '';
    setTrackingStartedAt(Date.now());
    setRobotLogs([]);
    setMessage('');
    setError('');
    addRobotLog(
      etapasLabel
        ? `${rotinaLabels[rotina]} solicitada pelo app: ${etapasLabel}.`
        : `${rotinaLabels[rotina]} solicitada pelo app.`
    );
    try {
      const response = await fetch('/api/robots/vinculacao/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotina, etapas: etapasPayload }),
      });
      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'Falha ao disparar robo.');
      }
      setMessage(`${rotinaLabels[rotina]} enviada para execucao.`);
      addRobotLog('Workflow enviado ao GitHub Actions.', 'success');
      addRobotLog('Aguardando inicio da execucao...', 'warning');
      setIsWatchingRun(true);
      window.setTimeout(() => loadStatus(true, rotina), 2500);
    } catch (err: any) {
      setError(err.message || 'Falha ao disparar robo.');
      addRobotLog(err.message || 'Falha ao disparar robo.', 'error');
    } finally {
      setRunning(null);
    }
  };

  const printMapinha = () => {
    window.open('/api/mapinha/pdf', '_blank', 'noopener,noreferrer');
  };

  const copyObservacoes = async (setor: ObservacaoSetor) => {
    const text = filteredObservationText;
    if (!text.trim()) return;
    await navigator.clipboard.writeText(text);
    setCopiedObservacao(setor);
    window.setTimeout(() => setCopiedObservacao(null), 1500);
  };

  const updateExceptionDraft = (index: number, field: keyof ExceptionFloor, value: string) => {
    setExceptionsDraft((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const addExceptionDraft = () => {
    setExceptionsDraft((current) => [...current, { date: isoToBrDate(formatTodayIso()), floor: '' }]);
  };

  const removeExceptionDraft = (index: number) => {
    const nextExceptions = exceptionsDraft.filter((_, itemIndex) => itemIndex !== index);
    setExceptionsDraft(nextExceptions);
    saveExceptions(nextExceptions);
  };

  const saveExceptions = async (exceptionsToSave?: ExceptionFloor[]) => {
    const nextExceptions = Array.isArray(exceptionsToSave) ? exceptionsToSave : exceptionsDraft;
    setSavingExceptions(true);
    setObservacoesError('');
    try {
      const response = await fetch('/api/robots/excecoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exceptions: nextExceptions }),
      });
      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'Falha ao salvar exceções.');
      }
      const savedExceptions = data.exceptions || [];
      setExceptionsDraft(savedExceptions);
      setObservacoes((current) => current ? { ...current, exceptions: savedExceptions } : current);
      setMessage('Andares bloqueados atualizados na planilha.');
    } catch (err: any) {
      setObservacoesError(err.message || 'Falha ao salvar exceções.');
    } finally {
      setSavingExceptions(false);
    }
  };

  const saveWhatsappConfig = async () => {
    setSavingWhatsappConfig(true);
    setWhatsappConfigMessage('');
    setCheckinContactsError('');
    try {
      const response = await fetch('/api/robots/checkin-whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: whatsappTemplate, informativeLink }),
      });
      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'Falha ao salvar mensagem do WhatsApp.');
      }
      setWhatsappTemplate(data.template || whatsappTemplate);
      setInformativeLink(data.informativeLink || informativeLink);
      setWhatsappConfigMessage('Mensagem salva permanentemente.');
    } catch (err: any) {
      setCheckinContactsError(err.message || 'Falha ao salvar mensagem do WhatsApp.');
    } finally {
      setSavingWhatsappConfig(false);
    }
  };

  const enableNotifications = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === 'granted');
  };

  const buildWhatsappMessage = (contact: CheckinWhatsappContact) => whatsappTemplate
    .replaceAll('{nome}', contact.shortName || contact.name)
    .replaceAll('{nome_completo}', contact.name)
    .replaceAll('{voucher}', contact.voucher)
    .replaceAll('{telefone}', contact.phone)
    .replaceAll('{link_informativo}', informativeLink || 'link do informativo');

  const buildWhatsappUrl = (contact: CheckinWhatsappContact) => {
    const phone = String(contact.whatsappPhone || '').replace(/\D/g, '');
    return `https://wa.me/${phone}?text=${encodeURIComponent(buildWhatsappMessage(contact))}`;
  };

  const currentSectionItems = observacoes?.sections?.[activeObservacao]?.items || [];
  const allObservationItems = (Object.values(observacoes?.sections || {}) as ObservacaoSection[])
    .flatMap((section) => section.items);
  const availableDates = Array.from(new Set(
    allObservationItems.map((item) => item.date).filter(Boolean)
  ));
  const filteredObservationItems = currentSectionItems.filter((item) => {
    if (!selectedDate) return true;
    return dateToIso(item.date) === selectedDate;
  });
  const filteredObservationText = filteredObservationItems
    .map(formatObservationLine)
    .join('\n');
  const specialHousekeepingItems = allObservationItems
    .filter((item) => !selectedDate || dateToIso(item.date) === selectedDate)
    .filter((item) => isSpecialHousekeeping(item.request));
  const romanticAlertKey = specialHousekeepingItems.map((item) => `${item.date}-${item.voucher}-${item.apartment}-${item.request}`).join('|');

  useEffect(() => {
    if (!notificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    if (specialHousekeepingItems.length === 0) return;
    const key = specialHousekeepingItems.map((item) => `${item.voucher}-${item.apartment}-${item.request}`).join('|');
    if (lastNotificationKeyRef.current === key) return;
    lastNotificationKeyRef.current = key;
    new Notification('Arrumacao romantica', {
      body: specialHousekeepingItems.map((item) => `${item.date || 'sem data'} - ${item.apartment || 'sem apto'} - ${item.voucher}`).join('\n'),
    });
  }, [notificationsEnabled, specialHousekeepingItems]);

  const statusLabel = run
    ? run.status === 'completed'
      ? (run.conclusion === 'success' ? 'Concluido' : 'Falhou')
      : 'Em andamento'
    : 'Sem execucoes';

  const StatusIcon = run?.status === 'completed'
    ? (run.conclusion === 'success' ? CheckCircle2 : AlertCircle)
    : Clock3;

  const statusColor = run?.status === 'completed'
    ? (run.conclusion === 'success' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-red-600 bg-red-50 border-red-100')
    : 'text-amber-600 bg-amber-50 border-amber-100';

  const terminalToneClass: Record<RobotLogEntry['tone'], string> = {
    info: 'text-slate-600',
    success: 'text-emerald-700',
    error: 'text-red-700',
    warning: 'text-amber-700',
  };

  const toggleVinculacaoEtapa = (etapa: VinculacaoEtapa) => {
    setVinculacaoEtapasSelecionadas((current) => (
      current.includes(etapa)
        ? current.filter((item) => item !== etapa)
        : [...current, etapa]
    ));
  };

  const renderRobotCard = (rotina: Rotina) => {
    const RotinaIcon = rotinaIcons[rotina];
    const isVinculacao = rotina === 'vinculacao_diaria';
    const etapasSelecionadasOrdenadas = vinculacaoEtapas
      .map((etapa) => etapa.id)
      .filter((etapa) => vinculacaoEtapasSelecionadas.includes(etapa));
    return (
      <div
        key={rotina}
        className="group min-h-28 rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-slate-300 hover:shadow-sm transition-all"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-50 group-hover:bg-slate-100">
              <RotinaIcon size={18} style={{ color: theme.primary }} />
            </div>
            <div>
              <span className="text-sm font-black text-slate-900">{rotinaLabels[rotina]}</span>
              <div className="mt-1 text-xs font-bold text-slate-500">{rotinaDescriptions[rotina]}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isVinculacao && (
              <button
                type="button"
                onClick={() => setShowVinculacaoConfig((current) => !current)}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 bg-white hover:bg-slate-50"
                title="Configurar etapas"
              >
                <Settings2 size={15} className="text-slate-600" />
              </button>
            )}
            <button
              type="button"
              onClick={() => runRobot(rotina)}
              disabled={!!running}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-100 hover:bg-slate-50 disabled:opacity-60"
              title="Executar"
            >
              <Play size={15} style={{ color: theme.primary }} />
            </button>
          </div>
        </div>
        {isVinculacao && showVinculacaoConfig && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="grid grid-cols-2 gap-2">
              {vinculacaoEtapas.map((etapa) => (
                <label
                  key={etapa.id}
                  className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={vinculacaoEtapasSelecionadas.includes(etapa.id)}
                    onChange={() => toggleVinculacaoEtapa(etapa.id)}
                    className="h-4 w-4"
                  />
                  {etapa.label}
                </label>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setVinculacaoEtapasSelecionadas(vinculacaoEtapas.map((etapa) => etapa.id))}
                className="text-xs font-black text-slate-500 hover:text-slate-800"
              >
                Marcar todos
              </button>
              <button
                type="button"
                onClick={() => runRobot(rotina, etapasSelecionadasOrdenadas)}
                disabled={!!running || etapasSelecionadasOrdenadas.length === 0}
                className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-black text-white disabled:opacity-60"
                style={{ backgroundColor: theme.primary }}
              >
                <Play size={14} />
                Executar marcado
              </button>
            </div>
          </div>
        )}
        <div className="mt-4 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: running === rotina ? '70%' : '28%', backgroundColor: theme.primary }} />
        </div>
      </div>
    );
  };

  const laundrySuggestions = laundrySearch.trim()
    ? laundryPriceList.filter((item) => normalizeSearch(item.name).includes(normalizeSearch(laundrySearch))).slice(0, 8)
    : laundryPriceList.slice(0, 8);

  const laundrySubtotal = laundryCart.reduce((total, item) => total + item.price * item.quantity, 0);
  const laundryTotal = laundryUrgent ? laundrySubtotal * 1.5 : laundrySubtotal;

  const addLaundryItem = (item: { name: string; price: number }) => {
    setLaundryCart((current) => {
      const existing = current.find((cartItem) => cartItem.name === item.name);
      if (existing) {
        return current.map((cartItem) => cartItem.name === item.name ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem);
      }
      return [...current, { id: `${Date.now()}-${Math.random()}`, name: item.name, price: item.price, quantity: 1 }];
    });
    setLaundrySearch('');
  };

  const updateLaundryQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setLaundryCart((current) => current.filter((item) => item.id !== id));
      return;
    }
    setLaundryCart((current) => current.map((item) => item.id === id ? { ...item, quantity } : item));
  };

  const maxHousekeepingWorkload = Math.max(
    1,
    ...(housekeepingDashboard?.corridors.map((corridor) => corridor.workload) || [1]),
  );
  const priorityCorridor = housekeepingDashboard?.corridors.reduce<HousekeepingCorridor | null>(
    (priority, corridor) => !priority || corridor.workload > priority.workload ? corridor : priority,
    null,
  );
  const housekeepingUpdatedAt = housekeepingDashboard?.updatedAt
    ? new Date(housekeepingDashboard.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : '';
  const selectedDateWeekday = selectedHousekeepingDate
    ? new Date(`${selectedHousekeepingDate}T12:00:00`).getDay()
    : new Date().getDay();
  const selectedPlanningTotal = operationalCorridors.reduce(
    (total, corridor) => total + Number(corridorArrivalsPlan[corridor]?.[selectedPlanningWeekday] || 0),
    0,
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-5">
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: theme.primary }}>
            <ConciergeBell size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Operacional</h1>
            <div className="mt-1 flex items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-black ${statusColor}`}>
                <StatusIcon size={14} />
                {statusLabel}
              </span>
              {run?.htmlUrl && (
                <a href={run.htmlUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-black text-slate-500 hover:text-slate-900">
                  <ExternalLink size={13} />
                  Log
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:flex gap-2">
          <button
            onClick={() => loadStatus()}
            disabled={loadingStatus}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loadingStatus ? 'animate-spin' : ''} />
            Status
          </button>
          <button
            onClick={printMapinha}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black text-white shadow-sm hover:brightness-95"
            style={{ backgroundColor: theme.primary }}
          >
            <Printer size={16} />
            Imprimir Mapinha
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 border-b border-slate-200 pb-4">
        {operationalSections.map((section) => {
          const SectionIcon = section.icon;
          const active = activeOperationalSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => setActiveOperationalSection(section.id)}
              className={`flex min-h-16 items-center gap-3 border-b-2 px-3 py-3 text-left transition-colors ${
                active ? 'bg-slate-50' : 'border-transparent hover:bg-slate-50'
              }`}
              style={active ? { borderBottomColor: theme.primary } : undefined}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${active ? 'text-white' : 'bg-slate-100 text-slate-500'}`} style={active ? { backgroundColor: theme.primary } : undefined}>
                <SectionIcon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-slate-900">{section.label}</span>
                <span className="mt-0.5 block text-[11px] font-bold text-slate-500">{section.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      {activeOperationalSection === 'recepcao' && (
      <div className="rounded-lg border border-slate-200 bg-white p-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {receptionTabs.map((tab) => {
          const TabIcon = tab.icon;
          const active = activeReceptionTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReceptionTab(tab.id)}
              className={`group flex items-center gap-3 rounded-[1rem] px-4 py-4 text-left transition-all ${
                active
                  ? 'text-white shadow-lg'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
              style={active ? { backgroundColor: theme.primary } : undefined}
            >
              <span
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  active ? 'bg-white/15 text-white' : 'bg-slate-50 text-slate-500 group-hover:bg-white'
                }`}
              >
                <TabIcon size={17} />
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-black ${active ? 'text-white' : 'text-slate-800'}`}>{tab.label}</span>
                <span className={`mt-0.5 block text-[10px] font-bold ${active ? 'text-white/85' : 'text-slate-400'}`}>{tab.description}</span>
              </span>
            </button>
          );
        })}
      </div>
      )}

      {activeOperationalSection === 'governanca' && (
      <div className="space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <LayoutDashboard size={18} style={{ color: theme.primary }} />
              <h2 className="text-base font-black text-slate-900">Painel dos corredores</h2>
            </div>
            <p className="mt-1 text-xs font-bold text-slate-500">
              Projecao operacional dos apartamentos e demanda dos andares.
              {housekeepingUpdatedAt && ` Atualizado em ${housekeepingUpdatedAt}.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsHousekeepingCalendarOpen((current) => !current)}
                disabled={!housekeepingDashboard?.availableDates?.length}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 disabled:opacity-50"
                aria-expanded={isHousekeepingCalendarOpen}
                title="Selecionar data operacional"
              >
                <CalendarDays size={16} style={{ color: theme.primary }} />
                <span>{formatOperationalDate(selectedHousekeepingDate)}</span>
              </button>
              {isHousekeepingCalendarOpen && housekeepingDashboard?.availableDates?.length > 0 && (
                <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                  <div className="px-2 pb-2 pt-1 text-[10px] font-black uppercase text-slate-400">Datas disponiveis</div>
                  <div className="grid grid-cols-1 gap-1">
                    {housekeepingDashboard.availableDates.map((item) => {
                      const active = item.date === selectedHousekeepingDate;
                      return (
                        <button
                          type="button"
                          key={item.date}
                          onClick={() => {
                            setSelectedHousekeepingDate(item.date);
                            setIsHousekeepingCalendarOpen(false);
                            void loadHousekeepingDashboard(item.date);
                          }}
                          className={`flex min-h-11 items-center justify-between rounded-lg px-3 text-left text-xs font-black ${active ? 'text-white' : 'text-slate-700 hover:bg-slate-50'}`}
                          style={active ? { backgroundColor: theme.primary } : undefined}
                        >
                          <span>{formatOperationalDate(item.date)}</span>
                          <span className={`text-[10px] ${active ? 'text-white/80' : 'text-slate-400'}`}>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => runRobot('mr')}
              disabled={!!running}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black text-white disabled:opacity-60"
              style={{ backgroundColor: theme.primary }}
              title="Executar apenas o robo MR"
            >
              {running === 'mr' ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              <span className="hidden sm:inline">Atualizar mapa</span>
            </button>
            <button
              type="button"
              onClick={() => loadHousekeepingDashboard(selectedHousekeepingDate, true)}
              disabled={loadingHousekeeping}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 disabled:opacity-60"
              title="Atualizar a data selecionada"
            >
              <RefreshCw size={15} className={loadingHousekeeping ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <button
              type="button"
              onClick={printMapinha}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700"
              title="Abrir PDF do mapinha"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">Mapinha</span>
            </button>
          </div>
        </div>

        {housekeepingError && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {housekeepingError}
          </div>
        )}

        {housekeepingMessage && (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            {housekeepingMessage}
          </div>
        )}

        {loadingHousekeeping && !housekeepingDashboard && (
          <div className="flex min-h-48 items-center justify-center border-y border-slate-200 bg-slate-50 text-sm font-black text-slate-500">
            <Loader2 size={18} className="mr-2 animate-spin" /> Carregando operacao dos andares...
          </div>
        )}

        {housekeepingDashboard && !housekeepingDashboard.requestedDateAvailable && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            A data solicitada nao existe na projecao atual. Exibindo a primeira data disponivel.
          </div>
        )}

        {housekeepingDashboard && !housekeepingDashboard.hasData && (
          <div className="border-y border-amber-200 bg-amber-50 px-4 py-8 text-center">
            <CalendarDays size={22} className="mx-auto text-amber-600" />
            <div className="mt-2 text-sm font-black text-amber-900">
              {housekeepingDashboard.availableDates.length === 0 ? 'Base operacional ainda nao atualizada' : 'Nenhum apartamento encontrado'}
            </div>
            <div className="mt-1 text-xs font-bold text-amber-700">Atualize o mapa e tente novamente.</div>
          </div>
        )}

        {housekeepingDashboard?.hasData && (
        <>
          <div className={`space-y-4 transition-opacity ${loadingHousekeeping ? 'opacity-60' : 'opacity-100'}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: 'Ocupados', value: housekeepingDashboard.totals.occupied, icon: BedDouble, tone: 'text-sky-700 bg-sky-50 border-sky-100' },
              { label: 'Entradas', value: housekeepingDashboard.totals.checkins, icon: ArrowDownToLine, tone: 'text-indigo-700 bg-indigo-50 border-indigo-100' },
              { label: 'Saidas', value: housekeepingDashboard.totals.checkouts, icon: ArrowUpFromLine, tone: 'text-amber-700 bg-amber-50 border-amber-100' },
              { label: 'Vagos disponiveis', value: housekeepingDashboard.totals.vacant, icon: DoorOpen, tone: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
            ].map((item) => {
              const MetricIcon = item.icon;
              return (
                <div key={item.label} className={`min-h-24 rounded-lg border p-3 ${item.tone}`}>
                  <MetricIcon size={16} />
                  <div className="mt-2 text-2xl font-black leading-none">{item.value}</div>
                  <div className="mt-1 text-[10px] font-black uppercase">{item.label}</div>
                </div>
              );
            })}
          </div>

          {(housekeepingDashboard.totals.interdicted > 0 || housekeepingDashboard.unassignedCheckins.selected > 0 || housekeepingDashboard.unassignedCheckouts.selected > 0) && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600">
              {housekeepingDashboard.totals.interdicted > 0 && (
                <span className="inline-flex items-center gap-2 text-rose-700"><AlertTriangle size={15} /> {housekeepingDashboard.totals.interdicted} interditados fora das vagas disponiveis</span>
              )}
              {housekeepingDashboard.unassignedCheckins.selected > 0 && (
                <span className="inline-flex items-center gap-2 text-indigo-700"><ArrowDownToLine size={15} /> {housekeepingDashboard.unassignedCheckins.selected} entradas ainda sem andar definido</span>
              )}
              {housekeepingDashboard.unassignedCheckouts.selected > 0 && (
                <span className="inline-flex items-center gap-2 text-amber-700"><ArrowUpFromLine size={15} /> {housekeepingDashboard.unassignedCheckouts.selected} saidas ainda sem andar definido</span>
              )}
            </div>
          )}

          {priorityCorridor && priorityCorridor.workload > 0 && (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-y border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <BellRing size={17} />
                </div>
                <div>
                  <div className="text-sm font-black text-amber-950">Maior demanda em {formatOperationalDate(selectedHousekeepingDate)}: andar {priorityCorridor.corridor}</div>
                  <div className="text-xs font-bold text-amber-800">
                    {priorityCorridor.selected.checkouts} saidas, {priorityCorridor.selected.checkins} entradas e {priorityCorridor.selected.vacant} apartamentos vagos.
                  </div>
                </div>
              </div>
              <div className="text-xs font-black uppercase text-amber-800">{priorityCorridor.workload} movimentos</div>
            </div>
          )}

          <div className="space-y-2">
            {housekeepingDashboard.corridors.map((corridor) => {
              const isPriority = priorityCorridor?.corridor === corridor.corridor && corridor.workload > 0;
              return (
                <div key={corridor.corridor} className={`rounded-lg border bg-white p-3 md:p-4 ${isPriority ? 'border-amber-300' : 'border-slate-200'}`}>
                  <div className="grid grid-cols-1 xl:grid-cols-[150px_1fr_160px] gap-4 xl:items-center">
                    <div className="flex items-center justify-between xl:block">
                      <div className="flex items-center gap-2">
                        <Building2 size={18} style={{ color: theme.primary }} />
                        <div className="text-lg font-black text-slate-900">Corredor {corridor.corridor}</div>
                      </div>
                      <div className="mt-1 text-[10px] font-black uppercase text-slate-400">{corridor.rooms} apartamentos</div>
                    </div>

                    <div>
                      <div className="mb-2 text-[10px] font-black uppercase text-slate-400">{formatOperationalDate(selectedHousekeepingDate)}</div>
                      <div className="grid grid-cols-3 sm:grid-cols-5 xl:grid-cols-3 2xl:grid-cols-5 gap-1.5">
                        {[
                          ['Ocup.', corridor.selected.occupied || 0, 'text-sky-700'],
                          ['Entram', corridor.selected.checkins, 'text-indigo-700'],
                          ['Saem', corridor.selected.checkouts, 'text-amber-700'],
                          ['Vagos', corridor.selected.vacant, 'text-emerald-700'],
                          ['Interd.', corridor.selected.interdicted || 0, 'text-rose-700'],
                        ].map(([label, value, tone]) => (
                          <div key={String(label)} className="min-w-0 rounded-lg bg-slate-50 px-2 py-2 text-center">
                            <div className={`text-base font-black ${tone}`}>{value}</div>
                            <div className="truncate text-[9px] font-black uppercase text-slate-400">{label}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-black uppercase">
                        <span className="text-violet-700">
                          Planejado: {corridorArrivalsPlan[corridor.corridor]?.[selectedDateWeekday] || 0} chegadas
                        </span>
                        {housekeepingDashboard.mapComparisonAvailable && (
                          <span className={(corridor.selected.hitsCheckins !== corridor.selected.checkins || corridor.selected.hitsCheckouts !== corridor.selected.checkouts) ? 'text-rose-700' : 'text-emerald-700'}>
                            HITS vinculado: {corridor.selected.hitsCheckins || 0} entram / {corridor.selected.hitsCheckouts || 0} saem
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
                        <span>Demanda</span>
                        <span>{corridor.workload}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-amber-500"
                          style={{ width: `${Math.max(4, (corridor.workload / maxHousekeepingWorkload) * 100)}%` }}
                        />
                      </div>
                      <div className={`mt-2 text-[10px] font-black uppercase ${isPriority ? 'text-amber-700' : 'text-slate-400'}`}>
                        {isPriority ? 'Maior prioridade' : corridor.workload > 20 ? 'Demanda alta' : corridor.workload > 10 ? 'Demanda media' : 'Demanda leve'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </>
        )}

        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Home size={17} style={{ color: theme.primary }} />
              <div>
                <span className="text-sm font-black text-slate-900">Andares bloqueados</span>
                <div className="text-[10px] font-bold text-slate-400">Excecoes usadas na atualizacao do mapa</div>
              </div>
            </div>
            <button
              onClick={loadObservacoes}
              disabled={loadingObservacoes}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              title="Atualizar bloqueios"
            >
              <RefreshCw size={15} className={loadingObservacoes ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="p-4 space-y-2">
            {exceptionsDraft.length > 0 ? exceptionsDraft.map((item, index) => (
              <div key={`${index}-${item.date}-${item.floor}`} className="grid grid-cols-[1fr_1fr_32px] gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
                <input
                  type="date"
                  value={dateToIso(item.date)}
                  onChange={(event) => updateExceptionDraft(index, 'date', isoToBrDate(event.target.value))}
                  className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-black text-slate-700 outline-none"
                />
                <input
                  value={item.floor}
                  onChange={(event) => updateExceptionDraft(index, 'floor', event.target.value)}
                  placeholder="Ex.: 500, 300"
                  className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-black text-slate-700 outline-none"
                />
                <button
                  onClick={() => removeExceptionDraft(index)}
                  disabled={savingExceptions}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-red-50 hover:text-red-600"
                  title="Remover e salvar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )) : (
              <div className="text-xs font-bold text-slate-400">Nenhum andar bloqueado.</div>
            )}
            <div className="flex items-center gap-2 pt-2">
              <button onClick={addExceptionDraft} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">
                <Plus size={14} /> Adicionar
              </button>
              <button
                onClick={() => saveExceptions()}
                disabled={savingExceptions}
                className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black text-white disabled:opacity-60"
                style={{ backgroundColor: theme.primary }}
              >
                <Save size={14} /> Salvar
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CalendarCheck2 size={17} style={{ color: theme.primary }} />
              <div>
                <div className="text-sm font-black text-slate-900">Chegadas planejadas por corredor</div>
                <div className="text-[10px] font-bold text-slate-400">Distribuicao padrao para cada dia da semana</div>
              </div>
            </div>
            <div className="text-xs font-black text-violet-700">{selectedPlanningTotal} chegadas planejadas</div>
          </div>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-4 gap-1 sm:grid-cols-7">
              {corridorPlanningWeekdays.map((weekday, index) => (
                <button
                  key={weekday}
                  type="button"
                  onClick={() => setSelectedPlanningWeekday(index)}
                  className={`min-h-10 rounded-lg px-2 text-[10px] font-black uppercase transition-colors ${selectedPlanningWeekday === index ? 'text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                  style={selectedPlanningWeekday === index ? { backgroundColor: theme.primary } : undefined}
                >
                  {weekday.slice(0, 3)}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {operationalCorridors.map((corridor) => (
                <label key={corridor} className="grid min-h-12 grid-cols-[1fr_88px] items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3">
                  <span className="text-xs font-black text-slate-700">Corredor {corridor}</span>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={corridorArrivalsPlan[corridor]?.[selectedPlanningWeekday] || 0}
                    onChange={(event) => {
                      const value = Math.max(0, Math.min(999, Math.floor(Number(event.target.value) || 0)));
                      setCorridorArrivalsPlan(current => ({
                        ...current,
                        [corridor]: (current[corridor] || Array(7).fill(0)).map((item, index) => index === selectedPlanningWeekday ? value : item),
                      }));
                    }}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-center text-sm font-black text-slate-800 outline-none focus:border-violet-400"
                  />
                </label>
              ))}
            </div>

            {corridorPlanError && <div className="text-xs font-bold text-rose-700">{corridorPlanError}</div>}
            {corridorPlanMessage && <div className="text-xs font-bold text-emerald-700">{corridorPlanMessage}</div>}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={saveCorridorPlan}
                disabled={savingCorridorPlan || loadingCorridorPlan}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-xs font-black text-white disabled:opacity-50"
                style={{ backgroundColor: theme.primary }}
              >
                {savingCorridorPlan ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar planejamento
              </button>
              <button
                type="button"
                onClick={loadCorridorPlan}
                disabled={loadingCorridorPlan}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50"
                title="Recarregar planejamento"
              >
                <RefreshCw size={14} className={loadingCorridorPlan ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {activeOperationalSection === 'recepcao' && activeReceptionTab === 'robos' && (
      <>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Home size={17} style={{ color: theme.primary }} />
          <h2 className="text-sm font-black text-slate-900">Vinculacao e Mapinha</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {vinculacaoRotinas.map(renderRobotCard)}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-col md:flex-row lg:flex-col xl:flex-row md:items-center lg:items-start xl:items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-900">Impressao do Mapinha</div>
                <div className="mt-1 text-xs font-bold text-slate-500">PDF direto da aba Mapinha.</div>
              </div>
              <button
                onClick={printMapinha}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black text-white shadow-sm hover:brightness-95"
                style={{ backgroundColor: theme.primary }}
              >
                <Printer size={16} />
                Abrir PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Bot size={17} style={{ color: theme.primary }} />
          <h2 className="text-sm font-black text-slate-900">Outros robos</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {outrosRobos.map(renderRobotCard)}
        </div>
      </div>

      <div className="hidden rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Home size={17} style={{ color: theme.primary }} />
            <span className="text-sm font-black text-slate-900">Andares bloqueados</span>
          </div>
          <button
            onClick={loadObservacoes}
            disabled={loadingObservacoes}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            title="Atualizar"
          >
            <RefreshCw size={15} className={loadingObservacoes ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {exceptionsDraft.length > 0 ? (
            exceptionsDraft.map((item, index) => (
              <div key={`${index}-${item.date}-${item.floor}`} className="grid grid-cols-[1fr_1fr_32px] gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
                <input
                  type="date"
                  value={dateToIso(item.date)}
                  onChange={(event) => updateExceptionDraft(index, 'date', isoToBrDate(event.target.value))}
                  className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-black text-slate-700 outline-none focus:border-slate-300"
                />
                <input
                  value={item.floor}
                  onChange={(event) => updateExceptionDraft(index, 'floor', event.target.value)}
                  placeholder="500, 300"
                  className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-black text-slate-700 outline-none focus:border-slate-300"
                />
                <button
                  onClick={() => removeExceptionDraft(index)}
                  disabled={savingExceptions}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-red-600 hover:bg-red-50"
                  title="Remover e salvar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          ) : (
            <div className="text-xs font-bold text-slate-400">Nenhuma excecao carregada.</div>
          )}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={addExceptionDraft}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-700 hover:bg-slate-50"
            >
              <Plus size={14} />
              Adicionar
            </button>
            <button
              onClick={() => saveExceptions()}
              disabled={savingExceptions}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-black text-white shadow-sm hover:brightness-95 disabled:opacity-60"
              style={{ backgroundColor: theme.primary }}
            >
              <Save size={14} />
              Salvar
            </button>
          </div>
        </div>
      </div>
      </>
      )}

      {activeOperationalSection === 'recepcao' && activeReceptionTab === 'mensagens' && (
      <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {renderRobotCard('checkin_whatsapp')}
      </div>
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageCircle size={17} style={{ color: theme.primary }} />
            <div>
              <span className="text-sm font-black text-slate-900">Check-in online por WhatsApp</span>
              <div className="text-[11px] font-bold text-slate-400">{checkinContacts.length} contato(s) valido(s) coletado(s)</div>
            </div>
          </div>
          <button
            onClick={loadCheckinContacts}
            disabled={loadingCheckinContacts}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={15} className={loadingCheckinContacts ? 'animate-spin' : ''} />
            Atualizar lista
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-4">
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Link do informativo</label>
              <input
                value={informativeLink}
                onChange={(event) => setInformativeLink(event.target.value)}
                placeholder="https://..."
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-300"
              />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Mensagem padrão</label>
                <button
                  onClick={saveWhatsappConfig}
                  disabled={savingWhatsappConfig}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  <Save size={14} />
                  {savingWhatsappConfig ? 'Salvando' : 'Salvar mensagem'}
                </button>
              </div>
              <textarea
                value={whatsappTemplate}
                onChange={(event) => setWhatsappTemplate(event.target.value)}
                className="mt-1 w-full min-h-[220px] resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-800 outline-none focus:border-slate-300"
              />
              <div className="mt-2 text-[11px] font-bold text-slate-400">
                Variaveis: {'{nome}'}, {'{nome_completo}'}, {'{voucher}'}, {'{telefone}'}, {'{link_informativo}'}
              </div>
              {whatsappConfigMessage && (
                <div className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                  {whatsappConfigMessage}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {checkinContacts.length > 0 ? (
              checkinContacts.map((contact) => (
                <div key={contact.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-900 truncate">{contact.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">
                      <span>Voucher {contact.voucher || '-'}</span>
                      <span>{contact.phone}</span>
                      <span className="text-amber-600">{contact.status || 'Pendente'}</span>
                    </div>
                  </div>
                  <a
                    href={buildWhatsappUrl(contact)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-black text-white shadow-sm hover:brightness-95"
                    style={{ backgroundColor: theme.primary }}
                  >
                    <Send size={14} />
                    Abrir WhatsApp
                  </a>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm font-bold text-slate-400">
                Nenhum contato carregado. Execute o robo Contatos WhatsApp e atualize a lista.
              </div>
            )}

            {checkinContactsError && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                {checkinContactsError}
              </div>
            )}
          </div>
        </div>
      </div>
      </>
      )}

      {(robotLogs.length > 0 || isWatchingRun) && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Terminal size={17} style={{ color: theme.primary }} />
              <span className="text-sm font-black text-slate-900">Acompanhamento do robo</span>
              {isWatchingRun && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-100 bg-sky-50 px-2 py-1 text-[10px] font-black text-sky-700">
                  <Loader2 size={12} className="animate-spin" />
                  Ao vivo
                </span>
              )}
            </div>
            {run?.htmlUrl && (
              <a href={run.htmlUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-black text-slate-500 hover:text-slate-900">
                <ExternalLink size={13} />
                Abrir log completo
              </a>
            )}
          </div>

          <div className="bg-slate-50 px-4 py-3 space-y-2">
            {robotLogs.map((item) => (
              <div key={item.id} className="flex items-start gap-2 text-xs font-bold">
                <span className="mt-0.5 min-w-[62px] text-slate-400 font-mono">{item.at}</span>
                <span className={terminalToneClass[item.tone]}>{item.text}</span>
              </div>
            ))}
            {robotLogs.length === 0 && (
              <div className="text-xs font-bold text-slate-400">Aguardando primeira atualizacao...</div>
            )}
          </div>
        </div>
      )}

      {activeOperationalSection === 'recepcao' && activeReceptionTab === 'observacoes' && (
      <div className="grid grid-cols-1 gap-4">
        <div className="hidden rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Home size={17} style={{ color: theme.primary }} />
              <span className="text-sm font-black text-slate-900">Andares bloqueados</span>
            </div>
            <button
              onClick={loadObservacoes}
              disabled={loadingObservacoes}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              title="Atualizar"
            >
              <RefreshCw size={15} className={loadingObservacoes ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="p-4 space-y-2">
            {exceptionsDraft.length > 0 ? (
              exceptionsDraft.map((item, index) => (
                <div key={`${index}-${item.date}-${item.floor}`} className="grid grid-cols-[1fr_1fr_32px] gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
                  <input
                    type="date"
                    value={dateToIso(item.date)}
                    onChange={(event) => updateExceptionDraft(index, 'date', isoToBrDate(event.target.value))}
                    className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-black text-slate-700 outline-none focus:border-slate-300"
                  />
                  <input
                    value={item.floor}
                    onChange={(event) => updateExceptionDraft(index, 'floor', event.target.value)}
                    placeholder="500, 300"
                    className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-black text-slate-700 outline-none focus:border-slate-300"
                  />
                  <button
                    onClick={() => removeExceptionDraft(index)}
                    disabled={savingExceptions}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-red-600 hover:bg-red-50"
                    title="Remover e salvar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            ) : (
              <div className="text-xs font-bold text-slate-400">Nenhuma excecao carregada.</div>
            )}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={addExceptionDraft}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-700 hover:bg-slate-50"
              >
                <Plus size={14} />
                Adicionar
              </button>
              <button
                onClick={() => saveExceptions()}
                disabled={savingExceptions}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-black text-white shadow-sm hover:brightness-95 disabled:opacity-60"
                style={{ backgroundColor: theme.primary }}
              >
                <Save size={14} />
                Salvar
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText size={17} style={{ color: theme.primary }} />
              <span className="text-sm font-black text-slate-900">Observações da semana</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(observacaoLabels) as ObservacaoSetor[]).map((setor) => (
                (() => {
                  const SetorIcon = observacaoIcons[setor];
                  return (
                    <button
                      key={setor}
                      onClick={() => setActiveObservacao(setor)}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-black border transition-colors ${
                        activeObservacao === setor
                          ? 'text-white border-transparent'
                          : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                      style={activeObservacao === setor ? { backgroundColor: theme.primary } : undefined}
                    >
                      <SetorIcon size={14} />
                      {observacaoLabels[setor]}
                    </button>
                  );
                })()
              ))}
            </div>
          </div>

          <div className="p-4 space-y-3">
            {specialHousekeepingItems.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-black text-amber-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} />
                  <span>Arrumacao romantica em destaque</span>
                </div>
                <div className="mt-2 space-y-1 font-bold">
                  {specialHousekeepingItems.map((item) => (
                    <div key={`${item.voucher}-${item.apartment}-${item.request}`}>
                      {item.date} - {formatObservationLine(item)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <div className="text-xs font-black text-slate-900">{observacaoDescriptions[activeObservacao]}</div>
                <div className="mt-1 text-[11px] font-bold text-slate-400">
                  {filteredObservationItems.length} solicitacao(oes)
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <CalendarDays size={15} className="text-slate-500" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    className="text-xs font-black text-slate-700 outline-none"
                  />
                </div>
                <button
                  onClick={() => setSelectedDate('')}
                  className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-700 hover:bg-slate-50"
                >
                  Todos
                </button>
                <button
                  onClick={enableNotifications}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-700 hover:bg-slate-50"
                  title="Ativar notificacoes do navegador"
                >
                  <BellRing size={15} />
                  {notificationsEnabled ? 'Alertas ativos' : 'Alertas'}
                </button>
                <button
                  onClick={loadObservacoes}
                  disabled={loadingObservacoes}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  <RefreshCw size={15} className={loadingObservacoes ? 'animate-spin' : ''} />
                  Atualizar
                </button>
                <button
                  onClick={() => copyObservacoes(activeObservacao)}
                  disabled={!filteredObservationText}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-black text-white shadow-sm hover:brightness-95 disabled:opacity-60"
                  style={{ backgroundColor: theme.primary }}
                >
                  {copiedObservacao === activeObservacao ? <ClipboardCheck size={15} /> : <Clipboard size={15} />}
                  {copiedObservacao === activeObservacao ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
              {filteredObservationItems.length > 0 ? (
                <div className="divide-y divide-slate-200">
                  {filteredObservationItems.map((item) => (
                    <div
                      key={`${item.date}-${item.voucher}-${item.apartment}-${item.request}`}
                      className="grid grid-cols-1 md:grid-cols-[92px_96px_1fr] gap-2 md:gap-3 px-3 py-3 bg-white/70 text-xs font-bold text-slate-800"
                    >
                      <div className="flex md:block items-center gap-2">
                        <span className="md:hidden text-[9px] font-black uppercase text-slate-400">Voucher</span>
                        <span className="font-black text-slate-900">{item.voucher || '-'}</span>
                      </div>
                      <div className="flex md:block items-center gap-2">
                        <span className="md:hidden text-[9px] font-black uppercase text-slate-400">Apto</span>
                        <span className="font-black text-slate-700">{item.apartment || 'sem apto'}</span>
                      </div>
                      <div className="uppercase tracking-wide text-slate-700">
                        {item.request}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-12 text-center text-xs font-bold text-slate-400">
                  Sem observacoes para este setor.
                </div>
              )}
            </div>

            {availableDates.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {availableDates.map((date) => (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(dateToIso(date))}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-black ${
                      selectedDate && selectedDate === dateToIso(date)
                        ? 'border-transparent text-white'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                    style={selectedDate && selectedDate === dateToIso(date) ? { backgroundColor: theme.primary } : undefined}
                  >
                    {date}
                  </button>
                ))}
              </div>
            )}

            {observacoesError && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                {observacoesError}
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {activeOperationalSection === 'recepcao' && activeReceptionTab === 'observacoes' && romanticAlertKey && dismissedRomanticAlertKey !== romanticAlertKey && (
        <div className="fixed bottom-4 right-4 z-[450] w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-amber-200 bg-amber-50 shadow-2xl p-4 animate-in slide-in-from-bottom-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-xs font-black uppercase text-amber-900 tracking-widest">Arrumacao romantica</p>
                <div className="mt-1 space-y-1 text-xs font-bold text-amber-800">
                  {specialHousekeepingItems.slice(0, 3).map((item) => (
                    <p key={`${item.date}-${item.voucher}-${item.apartment}`}>{item.date} - apto {item.apartment || 'sem apto'} - voucher {item.voucher}</p>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => setDismissedRomanticAlertKey(romanticAlertKey)}
              className="p-1 rounded-lg text-amber-700 hover:bg-amber-100"
              title="Fechar alerta"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {activeOperationalSection === 'recepcao' && activeReceptionTab === 'lavanderia' && (
        <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-4">
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <Shirt size={17} style={{ color: theme.primary }} />
              <span className="text-sm font-black text-slate-900">Orcamento de lavanderia</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3.5 text-slate-400" />
                <input
                  value={laundrySearch}
                  onChange={(event) => setLaundrySearch(event.target.value)}
                  placeholder="Digite a peca..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-300"
                />
              </div>
              <div className="grid grid-cols-1 gap-2 max-h-[420px] overflow-y-auto pr-1">
                {laundrySuggestions.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => addLaundryItem(item)}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-left hover:bg-white hover:border-slate-200"
                  >
                    <span className="text-xs font-black text-slate-700">{item.name}</span>
                    <span className="text-xs font-black" style={{ color: theme.primary }}>{formatCurrency(item.price)}</span>
                  </button>
                ))}
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">
                Prazo normal: 48h. Com taxa de urgencia: 24h e acrescimo de 50%.
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-900">Comanda</div>
                <div className="text-[11px] font-bold text-slate-400">{laundryCart.length} item(ns) selecionado(s)</div>
              </div>
              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700">
                <input type="checkbox" checked={laundryUrgent} onChange={(event) => setLaundryUrgent(event.target.checked)} />
                Taxa de urgencia +50%
              </label>
            </div>
            <div className="p-4 space-y-3">
              {laundryCart.length > 0 ? laundryCart.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-slate-900">{item.name}</div>
                    <div className="text-[11px] font-bold text-slate-500">{formatCurrency(item.price)} por peca</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(event) => updateLaundryQuantity(item.id, Number(event.target.value) || 0)}
                      className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-sm font-black"
                    />
                    <div className="w-28 text-right text-sm font-black text-slate-900">{formatCurrency(item.price * item.quantity)}</div>
                    <button onClick={() => updateLaundryQuantity(item.id, 0)} className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-red-600">
                      <X size={14} className="mx-auto" />
                    </button>
                  </div>
                </div>
              )) : (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm font-bold text-slate-400">
                  Nenhuma peca adicionada.
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-slate-900 p-4 text-white">
                <div className="flex justify-between text-xs font-bold text-slate-300">
                  <span>Subtotal</span>
                  <span>{formatCurrency(laundrySubtotal)}</span>
                </div>
                {laundryUrgent && (
                  <div className="mt-2 flex justify-between text-xs font-bold text-amber-200">
                    <span>Taxa de urgencia</span>
                    <span>{formatCurrency(laundrySubtotal * 0.5)}</span>
                  </div>
                )}
                <div className="mt-3 flex justify-between text-lg font-black">
                  <span>Total</span>
                  <span>{formatCurrency(laundryTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {(message || error || configWarning) && (
        <div className={`rounded-lg border px-4 py-3 text-sm font-bold ${
          error
            ? 'border-red-100 bg-red-50 text-red-700'
            : configWarning
              ? 'border-amber-100 bg-amber-50 text-amber-700'
              : 'border-emerald-100 bg-emerald-50 text-emerald-700'
        }`}>
          {error || message || configWarning}
        </div>
      )}
    </div>
  );
};

export default RobotsView;
