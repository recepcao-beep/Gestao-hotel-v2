
import React, { useState } from 'react';
import { Integration, HotelTheme } from '../types';
import { Copy, FileSpreadsheet, XCircle } from 'lucide-react';

interface IntegrationsViewProps {
  integrations: Integration[];
  theme: HotelTheme;
  onUpdate: (integration: Integration) => void;
}

const APPS_SCRIPT_CODE = `/**
 * Google Apps Script para Gestão Hotel Village - V24 (Full Connection)
 * Sincronização Completa: Apartamentos, Estoque, Funcionários, Setores e Orçamentos.
 */

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hotel = e.parameter.hotel || 'VILLAGE';
    var result = {
      apartments: {}, budgets: [], employees: [], sectors: [], inventory: [], inventoryHistory: [], suppliers: [], config: {}
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

    // 2. Estoque
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

    // 3. Fornecedores
    var sheetSup = ss.getSheetByName('Fornecedores_' + hotel);
    if (sheetSup) {
      var dataS = sheetSup.getDataRange().getValues();
      for (var j = 1; j < dataS.length; j++) {
        if(!dataS[j][0]) continue;
        result.suppliers.push({ id: dataS[j][0].toString(), name: dataS[j][1], contact: dataS[j][2], category: dataS[j][3] });
      }
    }

    // 4. Funcionários
    var sheetEmp = ss.getSheetByName('Funcionarios_' + hotel);
    if (sheetEmp) {
      var dE = sheetEmp.getDataRange().getValues();
      for (var k = 1; k < dE.length; k++) { 
        if(!dE[k][0]) continue; 
        result.employees.push({ 
          id: dE[k][0].toString(), 
          name: dE[k][1], 
          role: dE[k][2], 
          contact: dE[k][3], 
          startDate: dE[k][4], 
          salary: dE[k][5], 
          department: dE[k][6], 
          sectorId: dE[k][7] ? dE[k][7].toString() : '', 
          status: dE[k][8], 
          scheduleType: dE[k][9], 
          shiftType: dE[k][10], 
          workingHours: dE[k][11], 
          weeklyDayOff: dE[k][12], 
          monthlySundayOff: dE[k][13], 
          vacationStatus: dE[k][14], 
          uniforms: safeParse(dE[k][15], []) 
        }); 
      }
    }

    // 5. Setores
    var sheetSec = ss.getSheetByName('Setores_' + hotel);
    if (sheetSec) {
      var dSc = sheetSec.getDataRange().getValues();
      for (var s = 1; s < dSc.length; s++) {
        if(!dSc[s][0]) continue;
        result.sectors.push({ id: dSc[s][0].toString(), name: dSc[s][1], standardUniform: safeParse(dSc[s][2], []) });
      }
    }

    // 6. Orçamentos
    var sheetOrc = ss.getSheetByName('Orcamentos_' + hotel);
    if (sheetOrc) {
      var dO = sheetOrc.getDataRange().getValues();
      for (var n = 1; n < dO.length; n++) {
        if(!dO[n][0]) continue;
        result.budgets.push({ id: dO[n][0].toString(), title: dO[n][1], objective: dO[n][2], items: safeParse(dO[n][3], []), quotes: safeParse(dO[n][4], []), status: dO[n][5], createdAt: dO[n][6] ? new Date(dO[n][6]).getTime() : Date.now() });
      }
    }

    return ContentService.createTextOutput(JSON.stringify({status: 'success', data: result})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hotel = req.hotel || 'VILLAGE';
    var folder = getFolder("Gestão Hotel Village - Arquivos");

    if (req.newFiles && req.newFiles.length > 0) {
      req.newFiles.forEach(function(f) {
        var blob = Utilities.newBlob(Utilities.base64Decode(f.data), f.mimeType, f.fileName);
        var driveFile = folder.createFile(blob);
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        var driveUrl = "https://drive.google.com/thumbnail?id=" + driveFile.getId() + "&sz=w1000";

        if (req.dataType === 'APARTMENT') {
           req.defects.forEach(function(d) { if(d.fileName === f.fileName) { d.driveLink = driveUrl; delete d.data; } });
        }
        if (req.dataType === 'BUDGET') {
           req.quotes.forEach(function(q) { 
             if(q.files) q.files.forEach(function(bf) { if(bf.fileName === f.fileName) { bf.driveLink = driveUrl; delete bf.data; } });
           });
        }
      });
    }

    if (req.dataType === 'DELETE') {
       var target = "";
       if(req.targetType === 'INVENTORY') target = 'Estoque_' + hotel;
       else if(req.targetType === 'SUPPLIER') target = 'Fornecedores_' + hotel;
       else if(req.targetType === 'BUDGET') target = 'Orcamentos_' + hotel;
       else if(req.targetType === 'EMPLOYEE') target = 'Funcionarios_' + hotel;
       else if(req.targetType === 'SECTOR') target = 'Setores_' + hotel;
       if(target) deleteRow(ss.getSheetByName(target), req.id);
    } 
    else if (req.dataType === 'EMPLOYEE') {
       var sheet = ss.getSheetByName('Funcionarios_' + hotel) || ss.insertSheet('Funcionarios_' + hotel);
       upsert(sheet, req.id.toString(), [req.id.toString(), req.name, req.role, req.contact, req.startDate, req.salary, req.department, req.sectorId.toString(), req.status, req.scheduleType, req.shiftType || '', req.workingHours, req.weeklyDayOff, req.monthlySundayOff, req.vacationStatus, JSON.stringify(req.uniforms)]);
    }
    else if (req.dataType === 'SECTOR') {
       var sheet = ss.getSheetByName('Setores_' + hotel) || ss.insertSheet('Setores_' + hotel);
       upsert(sheet, req.id.toString(), [req.id.toString(), req.name, JSON.stringify(req.standardUniform)]);
    }
    else if (req.dataType === 'BUDGET') {
       var sheet = ss.getSheetByName('Orcamentos_' + hotel) || ss.insertSheet('Orcamentos_' + hotel);
       upsert(sheet, req.id.toString(), [req.id.toString(), req.title, req.objective, JSON.stringify(req.items), JSON.stringify(req.quotes), req.status, new Date(req.createdAt)]);
    }
    else if (req.dataType === 'INVENTORY_OP') {
       var sheetEst = ss.getSheetByName('Estoque_' + hotel);
       if (sheetEst) updateInventoryBalance(sheetEst, req.itemId, req.type, req.quantity);
    } 
    else if (req.dataType === 'INVENTORY') {
       var sheet = ss.getSheetByName('Estoque_' + hotel) || ss.insertSheet('Estoque_' + hotel);
       upsert(sheet, req.id.toString(), [req.id.toString(), req.ean || '', req.name, req.category, req.quantity, 0, req.unit, req.price || 0, req.supplierId ? req.supplierId.toString() : '', new Date()]);
    } 
    else if (req.dataType === 'SUPPLIER') {
       var sheet = ss.getSheetByName('Fornecedores_' + hotel) || ss.insertSheet('Fornecedores_' + hotel);
       upsert(sheet, req.id.toString(), [req.id.toString(), req.name, req.contact, req.category]);
    } 
    else if (req.dataType === 'APARTMENT') {
       var sheet = ss.getSheetByName('Apartamentos_' + hotel) || ss.insertSheet('Apartamentos_' + hotel);
       upsert(sheet, req.roomNumber + '-' + req.floor, [req.roomNumber, req.floor, req.pisoType, req.pisoStatus, req.banheiroType, req.banheiroStatus, req.temCofre?'Sim':'Não', req.temCortina?'Sim':'Não', req.cortinaStatus, req.cortinaSize, req.cortinaCoverage, req.temEspelhoCorpo?'Sim':'Não', req.espelhoCorpoStatus, req.acBrand, req.moveisStatus, JSON.stringify(req.moveisDetalhes), JSON.stringify(req.beds), req.temPortaControle?'Sim':'Não', req.temCabide?'Sim':'Não', req.cabideQuantity, req.temSuportePapel?'Sim':'Não', req.temSuporteShampoo?'Sim':'Não', req.suporteShampooStatus, req.luminariaType, req.luminariaColor, req.tvBrand, JSON.stringify(req.defects)]);
    }

    return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

function safeParse(s, f) { try { if (!s || s == "") return f; return JSON.parse(s); } catch(e) { return f; } }
function getFolder(n) { var fs = DriveApp.getFoldersByName(n); return fs.hasNext() ? fs.next() : DriveApp.createFolder(n); }
function upsert(s, id, r) { var d = s.getDataRange().getValues(); var ids = id.toString().trim(); for (var i = 1; i < d.length; i++) { if (d[i][0].toString().trim() == ids) { s.getRange(i+1, 1, 1, r.length).setValues([r]); return; } } s.appendRow(r); }
function deleteRow(s, id) { if(!s) return; var d = s.getDataRange().getValues(); var ids = id.toString().trim(); for (var i = 1; i < d.length; i++) { if (d[i][0].toString().trim() == ids) { s.deleteRow(i + 1); break; } } }
function updateInventoryBalance(s, id, t, q) { var d = s.getDataRange().getValues(); var ids = id.toString().trim(); for (var i = 1; i < d.length; i++) { if (d[i][0].toString().trim() == ids) { var cur = parseFloat(d[i][4]) || 0; var nxt = (t === 'Entrada') ? cur + q : cur - q; s.getRange(i + 1, 5).setValue(nxt); s.getRange(i + 1, 10).setValue(new Date()); return; } } }
`;

const IntegrationsView: React.FC<IntegrationsViewProps> = ({ integrations, theme, onUpdate }) => {
  const [showScriptModal, setShowScriptModal] = useState(false);
  const globalInt = integrations[0];
  const [url, setUrl] = useState(globalInt?.url || '');

  const saveUrl = () => {
    onUpdate({ ...globalInt, url, status: url ? 'Connected' : 'Disconnected', lastSync: Date.now() });
    alert('Conexão V24 configurada!');
  };

  return (
    <div className="space-y-6">
      <div className="p-8 rounded-[2.5rem] text-white relative overflow-hidden shadow-lg" style={{ backgroundColor: theme.primary }}>
        <h2 className="text-xl font-black mb-1">Google Sheets & Drive Sync</h2>
        <p className="opacity-80 text-[10px] font-bold uppercase tracking-widest">Versão V24: Conexão Total Restaurada</p>
        <FileSpreadsheet className="absolute right-[-20px] bottom-[-20px] text-white/10" size={160} />
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
        <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="Link do Apps Script Web App..." className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 focus:border-blue-400 outline-none text-sm font-bold bg-slate-50" />
        <button onClick={saveUrl} className="w-full py-4 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all" style={{ backgroundColor: theme.primary }}>Atualizar Conexão Global</button>
        <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100">
           <button onClick={() => setShowScriptModal(true)} className="text-[9px] font-black text-blue-600 underline uppercase tracking-widest mt-2 hover:text-blue-800 transition-colors">Copiar Novo Código V24 (Correção Orçamentos/Equipe)</button>
        </div>
      </div>

      {showScriptModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
              <h3 className="text-xl font-black text-slate-800">Apps Script V24 - Full Sync</h3>
              <button onClick={() => setShowScriptModal(false)} className="p-3 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><XCircle size={32} /></button>
            </div>
            <div className="p-8 overflow-y-auto flex-1">
              <div className="relative">
                <button onClick={() => { navigator.clipboard.writeText(APPS_SCRIPT_CODE); alert('Código V24 copiado!'); }} className="absolute top-4 right-4 p-3 bg-slate-900 text-white rounded-2xl shadow-xl flex items-center space-x-2 text-[10px] font-black uppercase">
                  <Copy size={16} /> <span>Copiar V24</span>
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
