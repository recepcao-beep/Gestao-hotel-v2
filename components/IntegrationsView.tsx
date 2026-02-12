
import React, { useState } from 'react';
import { Integration, HotelTheme } from '../types';
import { Copy, FileSpreadsheet, XCircle } from 'lucide-react';

interface IntegrationsViewProps {
  integrations: Integration[];
  theme: HotelTheme;
  onUpdate: (integration: Integration) => void;
}

const APPS_SCRIPT_CODE = `/**
 * Google Apps Script para Gestão Hotel Village - V33 (Ultra Sync + Recipient)
 * CORREÇÃO CRÍTICA: Adicionado SpreadsheetApp.flush() para forçar atualização imediata.
 * Suporte COMPLETO para: Orçamentos, Estoque, Fornecedores, Setores, Funcionários, Extras e Apartamentos.
 */

function doGet(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hotel = e.parameter.hotel || 'VILLAGE';
    var result = {
      apartments: {}, budgets: [], employees: [], extras: [], sectors: [], inventory: [], inventoryHistory: [], suppliers: [], config: {}
    };

    // 1. Apartamentos
    var sheetApts = ss.getSheetByName('Apartamentos_' + hotel);
    if (sheetApts) {
      var data = sheetApts.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        var num = data[i][0]; var floor = data[i][1]; if(!num || !floor) continue;
        var aptId = floor + "-" + num;
        result.apartments[aptId] = {
          id: aptId, roomNumber: num, floor: floor, pisoType: data[i][2], pisoStatus: data[i][3], banheiroType: data[i][4],
          banheiroStatus: data[i][5], temCofre: data[i][6] === 'Sim', temCortina: data[i][7] === 'Sim',
          cortinaStatus: data[i][8], cortinaSize: data[i][9], cortinaCoverage: data[i][10], temEspelhoCorpo: data[i][11] === 'Sim',
          espelhoCorpoStatus: data[i][12], acBrand: data[i][13], moveisStatus: data[i][14],
          moveisDetalhes: safeParse(data[i][15], []), beds: safeParse(data[i][16], []),
          temPortaControle: data[i][17] === 'Sim', temCabide: data[i][18] === 'Sim', cabideQuantity: data[i][19] || 0,
          temSuportePapel: data[i][20] === 'Sim', temSuporteShampoo: data[i][21] === 'Sim', suporteShampooStatus: data[i][22],
          luminariaType: data[i][23], luminariaColor: data[i][24], tvBrand: data[i][25], defects: safeParse(data[i][26], [])
        };
      }
    }

    // 2. Funcionários (CLT)
    var sheetEmp = ss.getSheetByName('Funcionarios_' + hotel);
    if (sheetEmp) {
      var dE = sheetEmp.getDataRange().getValues();
      for (var k = 1; k < dE.length; k++) { 
        if(!dE[k][0]) continue; 
        result.employees.push({ 
          id: dE[k][0].toString(), name: dE[k][1], role: dE[k][2], gender: dE[k][3] || 'M',
          contact: dE[k][4], salary: dE[k][5], sectorId: dE[k][6] ? dE[k][6].toString() : '', 
          fixedDayOff: dE[k][7], sundayOffs: safeParse(dE[k][8], []), workingHours: dE[k][9], 
          status: dE[k][10] || 'Ativo', startDate: dE[k][11], scheduleType: dE[k][12], 
          vacationStatus: dE[k][13] || 'Pendente', uniforms: safeParse(dE[k][14], []) 
        }); 
      }
    }

    // 3. Profissionais Extras (Freelancers)
    var sheetExtra = ss.getSheetByName('Extras_' + hotel);
    if (sheetExtra) {
      var dExt = sheetExtra.getDataRange().getValues();
      for (var l = 1; l < dExt.length; l++) {
        if(!dExt[l][0]) continue;
        result.extras.push({
          id: dExt[l][0].toString(), name: dExt[l][1], phone: dExt[l][2],
          availability: safeParse(dExt[l][3], []), serviceQuality: dExt[l][4],
          observation: dExt[l][5], sectorId: dExt[l][6].toString()
        });
      }
    }

    // 4. Estoque
    var sheetInv = ss.getSheetByName('Estoque_' + hotel);
    if (sheetInv) {
      var dataI = sheetInv.getDataRange().getValues();
      for (var m = 1; m < dataI.length; m++) {
        if(!dataI[m][0]) continue;
        result.inventory.push({ 
          id: dataI[m][0].toString(), ean: dataI[m][1].toString(), name: dataI[m][2], category: dataI[m][3], 
          quantity: parseFloat(dataI[m][4]) || 0, minQuantity: dataI[m][5] || 0, unit: dataI[m][6], price: dataI[m][7] || 0, 
          supplierId: dataI[m][8] ? dataI[m][8].toString() : '', lastUpdate: dataI[m][9] ? new Date(dataI[m][9]).getTime() : Date.now()
        });
      }
    }

    // 5. Histórico Estoque
    var sheetHist = ss.getSheetByName('Historico_Estoque_' + hotel);
    if (sheetHist) {
      var dH = sheetHist.getDataRange().getValues();
      // Pega apenas os ultimos 200 registros para não pesar
      var start = Math.max(1, dH.length - 200);
      for (var n = start; n < dH.length; n++) {
         if(!dH[n][0]) continue;
         result.inventoryHistory.unshift({
           id: dH[n][0].toString(), itemId: dH[n][1].toString(), itemName: dH[n][2],
           type: dH[n][3], quantity: dH[n][4], timestamp: dH[n][5], user: dH[n][6], reason: dH[n][7], recipientName: dH[n][8] || ''
         });
      }
    }

    // 6. Setores
    var sheetSec = ss.getSheetByName('Setores_' + hotel);
    if (sheetSec) {
      var dSc = sheetSec.getDataRange().getValues();
      for (var s = 1; s < dSc.length; s++) {
        if(!dSc[s][0]) continue;
        result.sectors.push({ id: dSc[s][0].toString(), name: dSc[s][1], standardUniform: safeParse(dSc[s][2], []) });
      }
    }

    // 7. Fornecedores
    var sheetSup = ss.getSheetByName('Fornecedores_' + hotel);
    if (sheetSup) {
      var dSup = sheetSup.getDataRange().getValues();
      for (var su = 1; su < dSup.length; su++) {
         if(!dSup[su][0]) continue;
         result.suppliers.push({
           id: dSup[su][0].toString(), name: dSup[su][1], contact: dSup[su][2], category: dSup[su][3]
         });
      }
    }

    // 8. Orçamentos
    var sheetBud = ss.getSheetByName('Orcamentos_' + hotel);
    if (sheetBud) {
      var dB = sheetBud.getDataRange().getValues();
      for (var b = 1; b < dB.length; b++) {
         if(!dB[b][0]) continue;
         result.budgets.push({
            id: dB[b][0].toString(), title: dB[b][1], objective: dB[b][2], 
            items: safeParse(dB[b][3], []), quotes: safeParse(dB[b][4], []), 
            status: dB[b][5], createdAt: dB[b][6]
         });
      }
    }

    // 9. Config
    var sheetConf = ss.getSheetByName('Config_' + hotel);
    if (sheetConf) {
       var dC = sheetConf.getDataRange().getValues();
       for(var c=0; c<dC.length; c++) {
          if(dC[c][0] === 'showSuppliersTab') result.config.showSuppliersTab = dC[c][1] === 'true';
       }
    }

    return ContentService.createTextOutput(JSON.stringify({status: 'success', data: result})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var req = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hotel = req.hotel || 'VILLAGE';

    if (req.dataType === 'DELETE') {
       var target = "";
       if(req.targetType === 'INVENTORY') target = 'Estoque_' + hotel;
       else if(req.targetType === 'EMPLOYEE') target = 'Funcionarios_' + hotel;
       else if(req.targetType === 'EXTRA') target = 'Extras_' + hotel;
       else if(req.targetType === 'SECTOR') target = 'Setores_' + hotel;
       else if(req.targetType === 'BUDGET') target = 'Orcamentos_' + hotel;
       else if(req.targetType === 'SUPPLIER') target = 'Fornecedores_' + hotel;
       
       if(target) deleteRow(ss.getSheetByName(target), req.id);
    } 
    else if (req.dataType === 'EMPLOYEE') {
       var sheet = ss.getSheetByName('Funcionarios_' + hotel) || ss.insertSheet('Funcionarios_' + hotel);
       var rowData = [
         req.id.toString(), req.name, req.role, req.gender || 'M', req.contact, req.salary, req.sectorId.toString(), req.fixedDayOff, 
         JSON.stringify(req.sundayOffs || []), req.workingHours, req.status || 'Ativo', req.startDate, req.scheduleType, req.vacationStatus, JSON.stringify(req.uniforms || [])
       ];
       upsert(sheet, req.id.toString(), rowData);
    }
    else if (req.dataType === 'EXTRA') {
       var sheet = ss.getSheetByName('Extras_' + hotel) || ss.insertSheet('Extras_' + hotel);
       var rowData = [
         req.id.toString(), req.name, req.phone, JSON.stringify(req.availability || []), req.serviceQuality, req.observation, req.sectorId.toString()
       ];
       upsert(sheet, req.id.toString(), rowData);
    }
    else if (req.dataType === 'APARTMENT') {
       var sheet = ss.getSheetByName('Apartamentos_' + hotel) || ss.insertSheet('Apartamentos_' + hotel);
       upsert(sheet, req.roomNumber + '-' + req.floor, [req.roomNumber, req.floor, req.pisoType, req.pisoStatus, req.banheiroType, req.banheiroStatus, req.temCofre?'Sim':'Não', req.temCortina?'Sim':'Não', req.cortinaStatus, req.cortinaSize, req.cortinaCoverage, req.temEspelhoCorpo?'Sim':'Não', req.espelhoCorpoStatus, req.acBrand, req.moveisStatus, JSON.stringify(req.moveisDetalhes), JSON.stringify(req.beds), req.temPortaControle?'Sim':'Não', req.temCabide?'Sim':'Não', req.cabideQuantity, req.temSuportePapel?'Sim':'Não', req.temSuporteShampoo?'Sim':'Não', req.suporteShampooStatus, req.luminariaType, req.luminariaColor, req.tvBrand, JSON.stringify(req.defects)]);
    }
    else if (req.dataType === 'INVENTORY') {
       var sheet = ss.getSheetByName('Estoque_' + hotel) || ss.insertSheet('Estoque_' + hotel);
       var rowData = [req.id.toString(), req.ean, req.name, req.category, req.quantity, req.minQuantity, req.unit, req.price, req.supplierId, new Date().toISOString()];
       upsert(sheet, req.id.toString(), rowData);
    }
    else if (req.dataType === 'INVENTORY_OP') {
       var sheet = ss.getSheetByName('Historico_Estoque_' + hotel) || ss.insertSheet('Historico_Estoque_' + hotel);
       sheet.appendRow([req.id.toString(), req.itemId, req.itemName, req.type, req.quantity, new Date().toISOString(), req.user, req.reason, req.recipientName || '']);
    }
    else if (req.dataType === 'BUDGET') {
       var sheet = ss.getSheetByName('Orcamentos_' + hotel) || ss.insertSheet('Orcamentos_' + hotel);
       var rowData = [req.id.toString(), req.title, req.objective, JSON.stringify(req.items), JSON.stringify(req.quotes), req.status, new Date().toISOString()];
       upsert(sheet, req.id.toString(), rowData);
    }
    else if (req.dataType === 'SUPPLIER') {
       var sheet = ss.getSheetByName('Fornecedores_' + hotel) || ss.insertSheet('Fornecedores_' + hotel);
       var rowData = [req.id.toString(), req.name, req.contact, req.category];
       upsert(sheet, req.id.toString(), rowData);
    }
    else if (req.dataType === 'SECTOR') {
       var sheet = ss.getSheetByName('Setores_' + hotel) || ss.insertSheet('Setores_' + hotel);
       var rowData = [req.id.toString(), req.name, JSON.stringify(req.standardUniform)];
       upsert(sheet, req.id.toString(), rowData);
    }
    else if (req.dataType === 'CONFIG') {
       var sheet = ss.getSheetByName('Config_' + hotel) || ss.insertSheet('Config_' + hotel);
       if(req.showSuppliersTab !== undefined) upsert(sheet, 'showSuppliersTab', ['showSuppliersTab', req.showSuppliersTab.toString()]);
    }

    SpreadsheetApp.flush(); // FORÇA A ATUALIZAÇÃO IMEDIATA

    return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function safeParse(s, f) { try { if (!s || s == "") return f; return JSON.parse(s); } catch(e) { return f; } }
function upsert(s, id, r) { var d = s.getDataRange().getValues(); var ids = id.toString().trim(); for (var i = 0; i < d.length; i++) { if (d[i][0].toString().trim() == ids) { s.getRange(i+1, 1, 1, r.length).setValues([r]); return; } } s.appendRow(r); }
function deleteRow(s, id) { if(!s) return; var d = s.getDataRange().getValues(); var ids = id.toString().trim(); for (var i = 0; i < d.length; i++) { if (d[i][0].toString().trim() == ids) { s.deleteRow(i + 1); break; } } }
`;

const IntegrationsView: React.FC<IntegrationsViewProps> = ({ integrations, theme, onUpdate }) => {
  const [showScriptModal, setShowScriptModal] = useState(false);
  const globalInt = integrations[0];
  const [url, setUrl] = useState(globalInt?.url || '');

  const saveUrl = () => {
    onUpdate({ ...globalInt, url, status: url ? 'Connected' : 'Disconnected', lastSync: Date.now() });
    alert('Conexão Global V33 configurada! Certifique-se de atualizar o código no Apps Script.');
  };

  return (
    <div className="space-y-6">
      <div className="p-8 rounded-[2.5rem] text-white relative overflow-hidden shadow-lg" style={{ backgroundColor: theme.primary }}>
        <h2 className="text-xl font-black mb-1">Google Sheets & Drive Sync</h2>
        <p className="opacity-80 text-[10px] font-bold uppercase tracking-widest">Versão V33: Recipient Tracking</p>
        <FileSpreadsheet className="absolute right-[-20px] bottom-[-20px] text-white/10" size={160} />
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
        <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="Link do Apps Script Web App..." className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 focus:border-blue-400 outline-none text-sm font-bold bg-slate-50" />
        <button onClick={saveUrl} className="w-full py-4 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all" style={{ backgroundColor: theme.primary }}>Atualizar Conexão Global</button>
        <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100">
           <button onClick={() => setShowScriptModal(true)} className="text-[9px] font-black text-blue-600 underline uppercase tracking-widest mt-2 hover:text-blue-800 transition-colors">Copiar Código V33</button>
        </div>
      </div>

      {showScriptModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
              <h3 className="text-xl font-black text-slate-800">Apps Script V33</h3>
              <button onClick={() => setShowScriptModal(false)} className="p-3 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><XCircle size={32} /></button>
            </div>
            <div className="p-8 overflow-y-auto flex-1">
              <div className="relative">
                <button onClick={() => { navigator.clipboard.writeText(APPS_SCRIPT_CODE); alert('Código V33 copiado! Cole no editor do Google Apps Script e faça uma Nova Implantação.'); }} className="absolute top-4 right-4 p-3 bg-slate-900 text-white rounded-2xl shadow-xl flex items-center space-x-2 text-[10px] font-black uppercase">
                  <Copy size={16} /> <span>Copiar V33</span>
                </button>
                <pre className="bg-slate-950 text-emerald-400 p-10 rounded-[2.5rem] overflow-x-auto text-[10px] leading-relaxed font-mono shadow-inner border border-slate-800">
                  {APPS_SCRIPT_CODE}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegrationsView;