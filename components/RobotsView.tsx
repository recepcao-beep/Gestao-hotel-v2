import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileSpreadsheet,
  Play,
  Printer,
  RefreshCw,
  RotateCw,
  UsersRound,
} from 'lucide-react';
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

interface MapinhaData {
  range: string;
  values: string[][];
}

const rotinaLabels: Record<Rotina, string> = {
  verificacao_diaria: 'Verificacao diaria',
  vinculacao_semanal: 'Vinculacao semanal',
  mapa: 'Atualizar mapa',
};

const rotinaDescriptions: Record<Rotina, string> = {
  verificacao_diaria: 'MR + OBS + vinculacao',
  vinculacao_semanal: 'Limpeza + MR + OBS + vinculacao',
  mapa: 'Ocupacao, entradas e saidas',
};

const RobotsView: React.FC<RobotsViewProps> = ({ theme }) => {
  const [run, setRun] = useState<RobotRun | null>(null);
  const [mapinha, setMapinha] = useState<MapinhaData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingMapinha, setLoadingMapinha] = useState(false);
  const [syncingScale, setSyncingScale] = useState(false);
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

  const loadMapinha = useCallback(async () => {
    setLoadingMapinha(true);
    setError('');
    try {
      const response = await fetch('/api/mapinha/load');
      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'Falha ao carregar Mapinha.');
      }
      setMapinha(data.mapinha);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar Mapinha.');
    } finally {
      setLoadingMapinha(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadMapinha();
  }, [loadStatus, loadMapinha]);

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

  const syncScale = async () => {
    setSyncingScale(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/mapinha/sync-scale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'Falha ao atualizar escala.');
      }
      setMessage(`Escala ${data.matchedDay || ''} atualizada no Mapinha.`);
      await loadMapinha();
    } catch (err: any) {
      setError(err.message || 'Falha ao atualizar escala.');
    } finally {
      setSyncingScale(false);
    }
  };

  const printMapinha = async () => {
    if (!mapinha) await loadMapinha();
    window.setTimeout(() => window.print(), 250);
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

  const maxCols = useMemo(() => {
    return Math.max(1, ...(mapinha?.values || []).map((row) => row.length));
  }, [mapinha]);

  const mapinhaRows = useMemo(() => {
    const values = mapinha?.values || [];
    return values.map((row) => Array.from({ length: maxCols }, (_, index) => row[index] || ''));
  }, [mapinha, maxCols]);

  const cellClass = (value: string) => {
    const text = String(value || '').toUpperCase();
    if (text.includes('CONTROLE DE OCUPANTES')) return 'font-black text-[11px]';
    if (['APTO', 'OCUPADO', 'N PESSOAS', 'Nº PESSOAS', 'VAGOS', 'RESERVADO'].some((item) => text.includes(item))) return 'font-black text-[8px]';
    if (/^\d{3}$/.test(text)) return 'font-black';
    if (text === 'INTERDITADO') return 'font-black bg-slate-200';
    return '';
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-5">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .mapinha-print-area, .mapinha-print-area * { visibility: visible !important; }
          .mapinha-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; }
          .mapinha-print-hidden { display: none !important; }
          @page { size: A4 portrait; margin: 7mm; }
        }
        .mapinha-preview-table td {
          border: 1px solid #111827;
          min-width: 46px;
          height: 17px;
          padding: 1px 3px;
          text-align: center;
          vertical-align: middle;
          white-space: pre-line;
          font-size: 9px;
          line-height: 1.05;
        }
      `}</style>

      <div className="mapinha-print-hidden flex flex-col xl:flex-row xl:items-start justify-between gap-4">
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
            onClick={syncScale}
            disabled={syncingScale}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <UsersRound size={16} className={syncingScale ? 'animate-pulse' : ''} />
            Escala
          </button>
          <button
            onClick={loadMapinha}
            disabled={loadingMapinha}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RotateCw size={16} className={loadingMapinha ? 'animate-spin' : ''} />
            Mapinha
          </button>
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
            Imprimir
          </button>
        </div>
      </div>

      <div className="mapinha-print-hidden grid grid-cols-1 md:grid-cols-3 gap-3">
        {(Object.keys(rotinaLabels) as Rotina[]).map((rotina) => (
          <button
            key={rotina}
            onClick={() => runRobot(rotina)}
            disabled={!!running}
            className="group min-h-28 rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-slate-300 hover:shadow-sm disabled:opacity-60 transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-sm font-black text-slate-900">{rotinaLabels[rotina]}</span>
                <div className="mt-1 text-xs font-bold text-slate-500">{rotinaDescriptions[rotina]}</div>
              </div>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-50 group-hover:bg-slate-100">
                <Play size={17} style={{ color: theme.primary }} />
              </div>
            </div>
            <div className="mt-4 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: running === rotina ? '70%' : '28%', backgroundColor: theme.primary }} />
            </div>
          </button>
        ))}
      </div>

      {(message || error) && (
        <div className={`mapinha-print-hidden rounded-lg border px-4 py-3 text-sm font-bold ${error ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
          {error || message}
        </div>
      )}

      <div className="mapinha-print-area rounded-lg border border-slate-200 bg-white overflow-auto">
        <div className="mapinha-print-hidden px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={17} style={{ color: theme.primary }} />
            <span className="text-sm font-black text-slate-900">Mapinha</span>
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase">{mapinha?.range || '-'}</span>
        </div>

        <div className="p-3 md:p-4">
          {loadingMapinha && !mapinha ? (
            <div className="h-64 flex items-center justify-center text-sm font-black text-slate-400">
              Carregando...
            </div>
          ) : (
            <table className="mapinha-preview-table border-collapse bg-white text-slate-950 mx-auto">
              <tbody>
                {mapinhaRows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, colIndex) => (
                      <td key={`${rowIndex}-${colIndex}`} className={cellClass(cell)}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default RobotsView;
