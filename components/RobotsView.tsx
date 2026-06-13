import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Bot, CheckCircle2, Clock3, ExternalLink, Play, RefreshCw } from 'lucide-react';
import { HotelTheme } from '../types';

type Rotina = 'verificacao_diaria' | 'vinculacao_semanal' | 'mapa';

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

const rotinaLabels: Record<Rotina, string> = {
  verificacao_diaria: 'Verificacao diaria',
  vinculacao_semanal: 'Vinculacao semanal',
  mapa: 'Atualizar mapa',
};

const RobotsView: React.FC<RobotsViewProps> = ({ theme }) => {
  const [run, setRun] = useState<RobotRun | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [running, setRunning] = useState<Rotina | null>(null);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    setError('');
    try {
      const response = await fetch('/api/robots/vinculacao/status');
      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'Falha ao consultar status.');
      }
      setRun(data.run);
    } catch (err: any) {
      setError(err.message || 'Falha ao consultar status.');
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const runRobot = async (rotina: Rotina) => {
    setRunning(rotina);
    setMessage('');
    setError('');
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
      window.setTimeout(loadStatus, 2500);
    } catch (err: any) {
      setError(err.message || 'Falha ao disparar robo.');
    } finally {
      setRunning(null);
    }
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

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: theme.primary }}>
              <Bot size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Robos de vinculacao</h1>
              <p className="text-sm font-semibold text-slate-500">GitHub Actions</p>
            </div>
          </div>
        </div>

        <button
          onClick={loadStatus}
          disabled={loadingStatus}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={16} className={loadingStatus ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(Object.keys(rotinaLabels) as Rotina[]).map((rotina) => (
          <button
            key={rotina}
            onClick={() => runRobot(rotina)}
            disabled={!!running}
            className="h-24 rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-slate-300 hover:shadow-sm disabled:opacity-60 transition-all"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-black text-slate-900">{rotinaLabels[rotina]}</span>
              <Play size={18} style={{ color: theme.primary }} />
            </div>
            <div className="mt-3 text-xs font-bold text-slate-500">
              {running === rotina ? 'Enviando...' : 'Executar agora'}
            </div>
          </button>
        ))}
      </div>

      {(message || error) && (
        <div className={`rounded-lg border px-4 py-3 text-sm font-bold ${error ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
          {error || message}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-black text-slate-900">Ultima execucao</span>
          <span className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-black ${statusColor}`}>
            <StatusIcon size={14} />
            {statusLabel}
          </span>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-[10px] font-black uppercase text-slate-400">Workflow</div>
            <div className="font-bold text-slate-800">{run?.name || '-'}</div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-slate-400">Criado</div>
            <div className="font-bold text-slate-800">{run ? new Date(run.createdAt).toLocaleString('pt-BR') : '-'}</div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-slate-400">Atualizado</div>
            <div className="font-bold text-slate-800">{run ? new Date(run.updatedAt).toLocaleString('pt-BR') : '-'}</div>
          </div>
          <div className="flex md:justify-end items-end">
            {run?.htmlUrl && (
              <a
                href={run.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-50"
              >
                <ExternalLink size={14} />
                Abrir log
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RobotsView;
