import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CalendarCheck2,
  CalendarRange,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  Play,
  Printer,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { HotelTheme } from '../types';

type Rotina = 'verificacao_diaria' | 'vinculacao_semanal';

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

const rotinaLabels: Record<Rotina, string> = {
  verificacao_diaria: 'Verificacao diaria',
  vinculacao_semanal: 'Vinculacao semanal',
};

const rotinaDescriptions: Record<Rotina, string> = {
  verificacao_diaria: 'MR + OBS + vinculacao',
  vinculacao_semanal: 'Limpeza + MR + OBS + vinculacao',
};

const rotinaIcons: Record<Rotina, React.ElementType> = {
  verificacao_diaria: CalendarCheck2,
  vinculacao_semanal: CalendarRange,
};

const RobotsView: React.FC<RobotsViewProps> = ({ theme }) => {
  const lastStatusKeyRef = useRef('');
  const [run, setRun] = useState<RobotRun | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [running, setRunning] = useState<Rotina | null>(null);
  const [trackingStartedAt, setTrackingStartedAt] = useState<number | null>(null);
  const [trackedRunId, setTrackedRunId] = useState<number | null>(null);
  const [isWatchingRun, setIsWatchingRun] = useState(false);
  const [robotLogs, setRobotLogs] = useState<RobotLogEntry[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [configWarning, setConfigWarning] = useState('');

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

  const loadStatus = useCallback(async (silent = false) => {
    if (!silent) setLoadingStatus(true);
    setConfigWarning('');
    try {
      const response = await fetch('/api/robots/vinculacao/status');
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
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!isWatchingRun) return;

    const interval = window.setInterval(async () => {
      const latestRun = await loadStatus(true);
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
  }, [addRobotLog, isWatchingRun, loadStatus, trackedRunId, trackingStartedAt]);

  const runRobot = async (rotina: Rotina) => {
    setRunning(rotina);
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
      window.setTimeout(() => loadStatus(true), 2500);
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
            onClick={loadStatus}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(Object.keys(rotinaLabels) as Rotina[]).map((rotina) => {
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
        })}
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

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="text-sm font-black text-slate-900">Impressao do Mapinha</div>
            <div className="mt-1 text-xs font-bold text-slate-500">
              O botao abre o PDF exportado diretamente da aba Mapinha da planilha.
            </div>
          </div>
          <button
            onClick={printMapinha}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black text-white shadow-sm hover:brightness-95"
            style={{ backgroundColor: theme.primary }}
          >
            <Printer size={16} />
            Abrir PDF para imprimir
          </button>
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
