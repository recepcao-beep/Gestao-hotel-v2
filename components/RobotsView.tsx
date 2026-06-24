import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BedDouble,
  BellRing,
  Bot,
  CalendarDays,
  CalendarCheck2,
  CalendarRange,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  Clock3,
  ConciergeBell,
  ExternalLink,
  FileText,
  Home,
  Loader2,
  MailCheck,
  MessageCircle,
  Play,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Send,
  Terminal,
  Trash2,
  Utensils,
} from 'lucide-react';
import { HotelTheme } from '../types';

type Rotina = 'verificacao_diaria' | 'vinculacao_semanal' | 'checkin_email' | 'checkin_whatsapp';
type ObservacaoSetor = 'restaurante' | 'governanca' | 'recepcao';

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
  verificacao_diaria: 'Verificacao diaria',
  vinculacao_semanal: 'Vinculacao semanal',
  checkin_email: 'Check-in por email',
  checkin_whatsapp: 'Contatos WhatsApp',
};

const rotinaDescriptions: Record<Rotina, string> = {
  verificacao_diaria: 'MR + OBS + vinculacao',
  vinculacao_semanal: 'Limpeza + MR + OBS + vinculacao',
  checkin_email: 'Anexos + cadastro + etiquetas',
  checkin_whatsapp: 'Entradas de hoje + telefones',
};

const rotinaIcons: Record<Rotina, React.ElementType> = {
  verificacao_diaria: CalendarCheck2,
  vinculacao_semanal: CalendarRange,
  checkin_email: MailCheck,
  checkin_whatsapp: MessageCircle,
};

const vinculacaoRotinas: Rotina[] = ['verificacao_diaria', 'vinculacao_semanal'];
const outrosRobos: Rotina[] = ['checkin_email', 'checkin_whatsapp'];

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

const defaultWhatsappTemplate = `Olá {nome}, seja muito bem-vindo ao Hotel Vilage Inn.

Estamos muito felizes em recebê-lo. Para tornar sua chegada mais rápida e confortável, você pode nos enviar por aqui os dados necessários para adiantar o check-in.

Segue também o link do nosso informativo:
{link_informativo}

Qualquer dúvida, estamos à disposição. Obrigado e até logo!`;

const isSpecialHousekeeping = (text: string) => {
  const normalized = String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return normalized.includes('arrumacao especial');
};

const RobotsView: React.FC<RobotsViewProps> = ({ theme }) => {
  const lastStatusKeyRef = useRef('');
  const [run, setRun] = useState<RobotRun | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [running, setRunning] = useState<Rotina | null>(null);
  const [trackingRotina, setTrackingRotina] = useState<Rotina>('verificacao_diaria');
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
  const [selectedDate, setSelectedDate] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [checkinContacts, setCheckinContacts] = useState<CheckinWhatsappContact[]>([]);
  const [loadingCheckinContacts, setLoadingCheckinContacts] = useState(false);
  const [checkinContactsError, setCheckinContactsError] = useState('');
  const [whatsappTemplate, setWhatsappTemplate] = useState(defaultWhatsappTemplate);
  const [informativeLink, setInformativeLink] = useState('');
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

  const loadObservacoes = useCallback(async () => {
    setLoadingObservacoes(true);
    setObservacoesError('');
    try {
      const response = await fetch('/api/robots/observacoes');
      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'Falha ao carregar observacoes.');
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
      setObservacoesError(err.message || 'Falha ao carregar observacoes.');
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
        } else {
          addRobotLog(`Execucao finalizada com status: ${latestRun.conclusion || 'falha'}.`, 'error');
          setError(`Robo finalizado com status: ${latestRun.conclusion || 'falha'}.`);
        }
        setIsWatchingRun(false);
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [addRobotLog, isWatchingRun, loadStatus, trackedRunId, trackingRotina, trackingStartedAt]);

  const runRobot = async (rotina: Rotina) => {
    setRunning(rotina);
    setTrackingRotina(rotina);
    setIsWatchingRun(false);
    setTrackedRunId(null);
    lastStatusKeyRef.current = '';
    setTrackingStartedAt(Date.now());
    setRobotLogs([]);
    setMessage('');
    setError('');
    addRobotLog(`${rotinaLabels[rotina]} solicitada pelo app.`);
    try {
      const response = await fetch('/api/robots/vinculacao/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotina }),
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
    setExceptionsDraft((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const saveExceptions = async () => {
    setSavingExceptions(true);
    setObservacoesError('');
    try {
      const response = await fetch('/api/robots/excecoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exceptions: exceptionsDraft }),
      });
      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'Falha ao salvar excecoes.');
      }
      setMessage('Andares bloqueados atualizados na planilha.');
      await loadObservacoes();
    } catch (err: any) {
      setObservacoesError(err.message || 'Falha ao salvar excecoes.');
    } finally {
      setSavingExceptions(false);
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
  const availableDates = Array.from(new Set(
    (Object.values(observacoes?.sections || {}) as ObservacaoSection[])
      .flatMap((section) => section.items.map((item) => item.date).filter(Boolean))
  ));
  const filteredObservationItems = currentSectionItems.filter((item) => {
    if (!selectedDate) return true;
    return dateToIso(item.date) === selectedDate;
  });
  const filteredObservationText = filteredObservationItems
    .map((item) => `${item.voucher || 'sem voucher'} - ${item.apartment || 'sem apto'} - ${item.request}`)
    .join('\n');
  const specialHousekeepingItems = filteredObservationItems.filter((item) => isSpecialHousekeeping(item.request));

  useEffect(() => {
    if (!notificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    if (specialHousekeepingItems.length === 0) return;
    const key = specialHousekeepingItems.map((item) => `${item.voucher}-${item.apartment}-${item.request}`).join('|');
    if (lastNotificationKeyRef.current === key) return;
    lastNotificationKeyRef.current = key;
    new Notification('Arrumacao especial', {
      body: `${specialHousekeepingItems.length} solicitacao(oes) em destaque na Governanca.`,
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

  const renderRobotCard = (rotina: Rotina) => {
    const RotinaIcon = rotinaIcons[rotina];
    return (
      <button
        key={rotina}
        onClick={() => runRobot(rotina)}
        disabled={!!running}
        className="group min-h-28 rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-slate-300 hover:shadow-sm disabled:opacity-60 transition-all"
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
          <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-100">
            <Play size={15} style={{ color: theme.primary }} />
          </div>
        </div>
        <div className="mt-4 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: running === rotina ? '70%' : '28%', backgroundColor: theme.primary }} />
        </div>
      </button>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-5">
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: theme.primary }}>
            <Bot size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Robos e Mapinha</h1>
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
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Mensagem padrao</label>
              <textarea
                value={whatsappTemplate}
                onChange={(event) => setWhatsappTemplate(event.target.value)}
                className="mt-1 w-full min-h-[220px] resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-800 outline-none focus:border-slate-300"
              />
              <div className="mt-2 text-[11px] font-bold text-slate-400">
                Variaveis: {'{nome}'}, {'{nome_completo}'}, {'{voucher}'}, {'{telefone}'}, {'{link_informativo}'}
              </div>
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

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
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
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-red-600 hover:bg-red-50"
                    title="Remover"
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
                onClick={saveExceptions}
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
              <span className="text-sm font-black text-slate-900">Observacoes da semana</span>
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
                  <span>Arrumacao especial em destaque</span>
                </div>
                <div className="mt-2 space-y-1 font-bold">
                  {specialHousekeepingItems.map((item) => (
                    <div key={`${item.voucher}-${item.apartment}-${item.request}`}>
                      {item.voucher} - {item.apartment || 'sem apto'} - {item.request}
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

            <textarea
              readOnly
              value={filteredObservationText}
              className="w-full min-h-[260px] resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs font-bold text-slate-800 outline-none focus:border-slate-300"
              placeholder="Sem observacoes para este setor."
            />

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
