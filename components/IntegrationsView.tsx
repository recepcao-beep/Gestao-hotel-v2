
import React, { useState } from 'react';
import { Integration, HotelTheme } from '../types';
import { Copy, FileSpreadsheet, XCircle } from 'lucide-react';

interface IntegrationsViewProps {
  integrations: Integration[];
  theme: HotelTheme;
  onUpdate: (integration: Integration) => void;
}

const APPS_SCRIPT_CODE = `/**
 * Google Apps Script para Gestão Hotel Village - V47 (Setores com Cargos e Uniformes por Função)
 */

function isHeaderRow(val) {
  if (!val) return false;
  var s = val.toString().toLowerCase().trim();
  return s === 'id' || s === 'código' || s === 'codigo' || s === 'apartamento' || s === 'nome' || s === 'data' || s === 'chave' || s === 'numero' || s === 'número';
}

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
      for (var i = 0; i < data.length; i++) {
        if (i === 0 && isHeaderRow(data[i][0])) continue;
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
      for (var k = 0; k < dE.length; k++) { 
        if (k === 0 && isHeaderRow(dE[k][0])) continue;
        if(!dE[k][0]) continue; 
        result.employees.push({ 
          id: dE[k][0].toString(), name: dE[k][1], role: dE[k][2], gender: dE[k][3] || 'M',
          contact: dE[k][4], salary: dE[k][5], sectorId: dE[k][6] ? dE[k][6].toString() : '', 
          fixedDayOff: dE[k][7], sundayOffs: safeParse(dE[k][8], []), workingHours: dE[k][9], 
          status: dE[k][10] || 'Ativo', startDate: dE[k][11], scheduleType: dE[k][12], 
          vacationStatus: dE[k][13] || 'Pendente', uniforms: safeParse(dE[k][14], []),
          photo: dE[k][15] || '' 
        }); 
      }
    }

    // 3. Profissionais Extras
    var sheetExtra = ss.getSheetByName('Extras_' + hotel);
    if (sheetExtra) {
      var dExt = sheetExtra.getDataRange().getValues();
      for (var l = 0; l < dExt.length; l++) {
        if (l === 0 && isHeaderRow(dExt[l][0])) continue;
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
      for (var m = 0; m < dataI.length; m++) {
        if (m === 0 && isHeaderRow(dataI[m][0])) continue;
        if(!dataI[m][0]) continue;
        result.inventory.push({ 
          id: dataI[m][0].toString(), ean: dataI[m][1].toString(), name: dataI[m][2], category: dataI[m][3], 
          quantity: parseFloat(dataI[m][4]) || 0, minQuantity: dataI[m][5] || 0, unit: dataI[m][6], price: dataI[m][7] || 0, 
          supplierId: dataI[m][8] ? dataI[m][8].toString() : '', lastUpdate: dataI[m][9] ? new Date(dataI[m][9]).getTime() : Date.now(),
          sectorId: dataI[m][10] ? dataI[m][10].toString() : ''
        });
      }
    }

    // 5. Histórico Estoque
    var sheetHist = ss.getSheetByName('Historico_Estoque_' + hotel);
    if (sheetHist) {
      var dH = sheetHist.getDataRange().getValues();
      var start = Math.max(0, dH.length - 200);
      for (var n = start; n < dH.length; n++) {
         if (n === 0 && isHeaderRow(dH[n][0])) continue;
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
      for (var s = 0; s < dSc.length; s++) {
        if (s === 0 && isHeaderRow(dSc[s][0])) continue;
        if(!dSc[s][0]) continue;
        result.sectors.push({ 
            id: dSc[s][0].toString(), 
            name: dSc[s][1], 
            standardUniform: safeParse(dSc[s][2], []),
            roles: safeParse(dSc[s][3], []) // Carrega os Cargos
        });
      }
    }

    // 7. Fornecedores
    var sheetSup = ss.getSheetByName('Fornecedores_' + hotel);
    if (sheetSup) {
      var dSup = sheetSup.getDataRange().getValues();
      for (var su = 0; su < dSup.length; su++) {
         if (su === 0 && isHeaderRow(dSup[su][0])) continue;
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
      for (var b = 0; b < dB.length; b++) {
         if (b === 0 && isHeaderRow(dB[b][0])) continue;
         if(!dB[b][0]) continue;
         result.budgets.push({
            id: dB[b][0].toString(), title: dB[b][1], objective: dB[b][2], 
            items: safeParse(dB[b][3], []), quotes: safeParse(dB[b][4], []), 
            status: dB[b][5], createdAt: dB[b][6],
            files: safeParse(dB[b][7], []) 
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

    // 10. Users
    var sheetUsers = ss.getSheetByName('Users_' + hotel);
    if (sheetUsers) {
      var dU = sheetUsers.getDataRange().getValues();
      for (var u = 0; u < dU.length; u++) {
        if (u === 0 && isHeaderRow(dU[u][0])) continue;
        if(!dU[u][0]) continue;
        result.users = result.users || [];
        result.users.push({
          id: dU[u][0].toString(),
          name: dU[u][1],
          password: dU[u][2],
          role: dU[u][3],
          allowedTabs: dU[u][4],
          email: dU[u][5] || '',
          status: dU[u][6] || 'APPROVED'
        });
      }
    }

    // 11. Vehicles
    var sheetVehicles = ss.getSheetByName('Vehicles_' + hotel);
    if (sheetVehicles) {
      var dV = sheetVehicles.getDataRange().getValues();
      for (var v = 0; v < dV.length; v++) {
        if (v === 0 && isHeaderRow(dV[v][0])) continue;
        if(!dV[v][0]) continue;
        result.vehicles = result.vehicles || [];
        result.vehicles.push({
          id: dV[v][0].toString(),
          guest_name: dV[v][1],
          plate: dV[v][2],
          identifier: dV[v][3],
          location: dV[v][4],
          check_out_date: dV[v][5],
          model: dV[v][6],
          color: dV[v][7],
          is_on_trip: dV[v][8] === true || dV[v][8] === 'true',
          payment_pending: dV[v][9] === true || dV[v][9] === 'true',
          trip_start: dV[v][10],
          check_in_date: dV[v][11],
          is_active: dV[v][12] === true || dV[v][12] === 'true',
          deleted_date: dV[v][13],
          photos: safeParse(dV[v][14], []),
          driveFolderId: dV[v][15]
        });
      }
    }

    // 12. Parking Locations
    var sheetParking = ss.getSheetByName('Patios_' + hotel);
    if (sheetParking) {
      var dP = sheetParking.getDataRange().getValues();
      for (var p = 0; p < dP.length; p++) {
        if (p === 0 && isHeaderRow(dP[p][0])) continue;
        if(!dP[p][0]) continue;
        result.parkingLocations = result.parkingLocations || [];
        result.parkingLocations.push({
          id: dP[p][0].toString(),
          name: dP[p][1],
          totalSpots: dP[p][2]
        });
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
    lock.waitLock(30000); 
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
       else if(req.targetType === 'USER') target = 'Users_' + hotel;
       else if(req.targetType === 'PARKING_LOCATION') target = 'Patios_' + hotel;
       else if(req.targetType === 'VEHICLE') {
         target = 'Vehicles_' + hotel;
         // Handle Drive folder deletion
         var sheetVehicles = ss.getSheetByName(target);
         if (sheetVehicles) {
           var dV = sheetVehicles.getDataRange().getValues();
           for (var i = 1; i < dV.length; i++) {
             if (dV[i][0].toString() === req.id.toString()) {
               var folderId = dV[i][15];
               if (folderId) {
                 try {
                   DriveApp.getFolderById(folderId).setTrashed(true);
                 } catch(e) {
                   // Ignore if folder not found
                 }
               }
               break;
             }
           }
         }
       }
       
       if(target) deleteRow(ss.getSheetByName(target), req.id);
    } 
    else if (req.dataType === 'EMPLOYEE') {
       var sheet = ss.getSheetByName('Funcionarios_' + hotel) || ss.insertSheet('Funcionarios_' + hotel);
       
       // Handle Photo Upload with Organized Structure
       var photoLink = req.photo || ""; 
       
       if (req.newFiles && req.newFiles.length > 0) {
          // Hierarchy: Root -> Hotel -> Employees -> Sector -> Employee Name
          var sectorName = req.department || "Geral"; 
          photoLink = saveEmployeePhotoToFolder(req.newFiles[0], hotel, sectorName, req.name);
       }

       var rowData = [
         req.id.toString(), req.name, req.role, req.gender || 'M', req.contact, req.salary, req.sectorId.toString(), req.fixedDayOff, 
         JSON.stringify(req.sundayOffs || []), req.workingHours, req.status || 'Ativo', req.startDate, req.scheduleType, req.vacationStatus, 
         JSON.stringify(req.uniforms || []), photoLink
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
       // Handle Apartment Defects Files
       var defects = req.defects || [];
       if (req.newFiles && req.newFiles.length > 0) {
          req.newFiles.forEach(function(file) {
             var link = saveFileToDrive(file, hotel + "_Defects");
             // Find defect matching filename to update link
             for(var i=0; i<defects.length; i++) {
                if(defects[i].fileName === file.fileName && defects[i].driveLink === 'pendente') {
                   defects[i].driveLink = link;
                   defects[i].data = ""; // Clear base64
                }
             }
          });
       }
       upsert(sheet, req.roomNumber + '-' + req.floor, [req.roomNumber, req.floor, req.pisoType, req.pisoStatus, req.banheiroType, req.banheiroStatus, req.temCofre?'Sim':'Não', req.temCortina?'Sim':'Não', req.cortinaStatus, req.cortinaSize, req.cortinaCoverage, req.temEspelhoCorpo?'Sim':'Não', req.espelhoCorpoStatus, req.acBrand, req.moveisStatus, JSON.stringify(req.moveisDetalhes), JSON.stringify(req.beds), req.temPortaControle?'Sim':'Não', req.temCabide?'Sim':'Não', req.cabideQuantity, req.temSuportePapel?'Sim':'Não', req.temSuporteShampoo?'Sim':'Não', req.suporteShampooStatus, req.luminariaType, req.luminariaColor, req.tvBrand, JSON.stringify(defects)]);
    }
    else if (req.dataType === 'INVENTORY') {
       var sheet = ss.getSheetByName('Estoque_' + hotel) || ss.insertSheet('Estoque_' + hotel);
       var rowData = [req.id.toString(), req.ean, req.name, req.category, req.quantity, req.minQuantity, req.unit, req.price, req.supplierId, new Date().toISOString(), req.sectorId.toString()];
       upsert(sheet, req.id.toString(), rowData);
    }
    else if (req.dataType === 'INVENTORY_OP') {
       var sheet = ss.getSheetByName('Historico_Estoque_' + hotel) || ss.insertSheet('Historico_Estoque_' + hotel);
       sheet.appendRow([req.id.toString(), req.itemId, req.itemName, req.type, req.quantity, new Date().toISOString(), req.user, req.reason, req.recipientName || '']);
    }
    else if (req.dataType === 'BUDGET') {
       var sheet = ss.getSheetByName('Orcamentos_' + hotel) || ss.insertSheet('Orcamentos_' + hotel);
       
       // Handle Budget Files
       var existingFiles = req.files || [];
       if (req.newFiles && req.newFiles.length > 0) {
          req.newFiles.forEach(function(file) {
             var link = saveFileToDrive(file, hotel + "_Budgets");
             existingFiles.push({
                id: Date.now().toString() + Math.random().toString(),
                fileName: file.fileName,
                fileType: file.mimeType,
                driveLink: link,
                timestamp: Date.now()
             });
          });
       }

       var rowData = [req.id.toString(), req.title, req.objective, JSON.stringify(req.items), JSON.stringify(req.quotes), req.status, new Date().toISOString(), JSON.stringify(existingFiles)];
       upsert(sheet, req.id.toString(), rowData);
    }
    else if (req.dataType === 'SUPPLIER') {
       var sheet = ss.getSheetByName('Fornecedores_' + hotel) || ss.insertSheet('Fornecedores_' + hotel);
       var rowData = [req.id.toString(), req.name, req.contact, req.category];
       upsert(sheet, req.id.toString(), rowData);
    }
    else if (req.dataType === 'SECTOR') {
       var sheet = ss.getSheetByName('Setores_' + hotel) || ss.insertSheet('Setores_' + hotel);
       // Now saves Roles in column 4
       var rowData = [req.id.toString(), req.name, JSON.stringify(req.standardUniform), JSON.stringify(req.roles || [])];
       upsert(sheet, req.id.toString(), rowData);
    }
    else if (req.dataType === 'CONFIG') {
       var sheet = ss.getSheetByName('Config_' + hotel) || ss.insertSheet('Config_' + hotel);
       if(req.showSuppliersTab !== undefined) upsert(sheet, 'showSuppliersTab', ['showSuppliersTab', req.showSuppliersTab.toString()]);
    }
    else if (req.dataType === 'USER') {
       var sheet = ss.getSheetByName('Users_' + hotel) || ss.insertSheet('Users_' + hotel);
       var rowData = [
         req.id ? req.id.toString() : '', 
         req.name || '', 
         req.password || '', 
         req.role || 'FUNCIONARIO', 
         req.allowedTabs || '[]', 
         req.email || '', 
         req.status || 'APPROVED'
       ];
       upsert(sheet, req.id.toString(), rowData);
    }
    else if (req.dataType === 'PARKING_LOCATION') {
       var sheet = ss.getSheetByName('Patios_' + hotel) || ss.insertSheet('Patios_' + hotel);
       var rowData = [
         req.id.toString(), req.name, req.totalSpots
       ];
       upsert(sheet, req.id.toString(), rowData);
    }
    else if (req.dataType === 'VEHICLE') {
       var sheet = ss.getSheetByName('Vehicles_' + hotel) || ss.insertSheet('Vehicles_' + hotel);
       
       var folderId = req.driveFolderId || "";
       var photos = req.photos ? JSON.parse(req.photos) : [];
       
       if (req.newFiles && req.newFiles.length > 0) {
          // Create hierarchy: Avaria dos veículos -> Month -> Day -> Guest Name - Plate
          var rootFolder = getOrCreateFolder(DriveApp.getRootFolder(), "Avaria dos veículos");
          var date = new Date();
          var monthName = date.toLocaleString('pt-BR', { month: 'long' });
          monthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
          var monthFolder = getOrCreateFolder(rootFolder, monthName);
          var dayFolder = getOrCreateFolder(monthFolder, date.getDate().toString());
          
          var folderName = req.guest_name + " - " + req.plate;
          var vehicleFolder;
          
          if (folderId) {
             try {
               vehicleFolder = DriveApp.getFolderById(folderId);
             } catch(e) {
               vehicleFolder = getOrCreateFolder(dayFolder, folderName);
             }
          } else {
             vehicleFolder = getOrCreateFolder(dayFolder, folderName);
          }
          
          folderId = vehicleFolder.getId();
          
          req.newFiles.forEach(function(file) {
             var decoded = Utilities.base64Decode(file.data);
             var blob = Utilities.newBlob(decoded, file.mimeType, file.fileName);
             var newFile = vehicleFolder.createFile(blob);
             newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
             
             // Replace base64 string with drive link
             for(var i=0; i<photos.length; i++) {
                if(typeof photos[i] === 'string' && photos[i].indexOf(file.data) !== -1) {
                   photos[i] = newFile.getDownloadUrl();
                }
             }
          });
       }
       
       var rowData = [
         req.id.toString(), req.guest_name || '', req.plate || '', req.identifier || '', req.location || '', req.check_out_date || '',
         req.model || '', req.color || '', req.is_on_trip || false, req.payment_pending || false, req.trip_start || '',
         req.check_in_date || '', req.is_active || false, req.deleted_date || '', JSON.stringify(photos), folderId
       ];
       upsert(sheet, req.id.toString(), rowData);
    }
    else if (req.dataType === 'CHECKOUT_VEHICLE') {
       var sheet = ss.getSheetByName('Vehicles_' + hotel);
       if (sheet) {
         var dV = sheet.getDataRange().getValues();
         for (var i = 1; i < dV.length; i++) {
           if (dV[i][0].toString() === req.id.toString()) {
             sheet.getRange(i + 1, 6).setValue(new Date().toISOString()); // Update check_out_date
             sheet.getRange(i + 1, 13).setValue(false); // Update is_active to false
             sheet.getRange(i + 1, 14).setValue(new Date().toISOString()); // Set deleted_date
             var folderId = dV[i][15];
             if (folderId) {
               // Schedule deletion for 24 hours later
               ScriptApp.newTrigger('deleteVehicleFolder')
                 .timeBased()
                 .after(24 * 60 * 60 * 1000)
                 .create();
                 
               // Store folder ID in script properties to know what to delete
               var props = PropertiesService.getScriptProperties();
               var pendingDeletions = JSON.parse(props.getProperty('pendingDeletions') || '[]');
               pendingDeletions.push(folderId);
               props.setProperty('pendingDeletions', JSON.stringify(pendingDeletions));
             }
             break;
           }
         }
       }
    }

    SpreadsheetApp.flush();

    return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Function to save employee photos in strict hierarchy: Hotel -> Funcionarios -> Setor -> Nome
function saveEmployeePhotoToFolder(fileObj, hotel, sectorName, empName) {
  try {
    var rootName = hotel + " - Funcionarios";
    var rootFolder = getOrCreateFolder(DriveApp.getRootFolder(), rootName);
    
    // Ensure sector folder exists (clean name)
    var safeSector = (sectorName || "Geral").replace(/[/\\?%*:|"<>\.]/g, '-');
    var sectorFolder = getOrCreateFolder(rootFolder, safeSector);

    // Create file
    var decoded = Utilities.base64Decode(fileObj.data);
    var blob = Utilities.newBlob(decoded, fileObj.mimeType, empName); // Name the file after employee
    var file = sectorFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getDownloadUrl();
  } catch(e) {
    return "error: " + e.toString();
  }
}

function getOrCreateFolder(parent, name) {
  var it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

function saveFileToDrive(fileObj, folderName) {
  try {
    var folders = DriveApp.getFoldersByName(folderName);
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    var decoded = Utilities.base64Decode(fileObj.data);
    var blob = Utilities.newBlob(decoded, fileObj.mimeType, fileObj.fileName);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getDownloadUrl(); 
  } catch(e) {
    return "error: " + e.toString();
  }
}

function safeParse(s, f) { try { if (!s || s == "") return f; return JSON.parse(s); } catch(e) { return f; } }
function upsert(s, id, r) { var d = s.getDataRange().getValues(); var ids = id.toString().trim(); for (var i = 0; i < d.length; i++) { if (d[i][0].toString().trim() == ids) { s.getRange(i+1, 1, 1, r.length).setValues([r]); return; } } s.appendRow(r); }
function deleteRow(s, id) { if(!s) return; var d = s.getDataRange().getValues(); var ids = id.toString().trim(); for (var i = 0; i < d.length; i++) { if (d[i][0].toString().trim() == ids) { s.deleteRow(i + 1); break; } } }

function deleteVehicleFolder() {
  var props = PropertiesService.getScriptProperties();
  var pendingDeletions = JSON.parse(props.getProperty('pendingDeletions') || '[]');
  var newPending = [];
  
  for (var i = 0; i < pendingDeletions.length; i++) {
    var folderId = pendingDeletions[i];
    try {
      var folder = DriveApp.getFolderById(folderId);
      folder.setTrashed(true);
    } catch(e) {
      // If folder not found or already deleted, ignore
    }
  }
  
  props.setProperty('pendingDeletions', JSON.stringify(newPending));
  
  // Clean up triggers
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'deleteVehicleFolder') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}
`;

const IntegrationsView: React.FC<IntegrationsViewProps> = ({ integrations, theme, onUpdate }) => {
  const [showScriptModal, setShowScriptModal] = useState(false);
  const globalInt = integrations[0];
  const [url, setUrl] = useState(globalInt?.url || '');

  const saveUrl = () => {
    onUpdate({ ...globalInt, url, status: url ? 'Connected' : 'Disconnected', lastSync: Date.now() });
    alert('Conexão Global V47 configurada! Atualize o Apps Script para ativar o suporte a cargos por setor.');
  };

  return (
    <div className="space-y-6">
      <div className="p-8 rounded-[2.5rem] text-white relative overflow-hidden shadow-lg" style={{ backgroundColor: theme.primary }}>
        <h2 className="text-xl font-black mb-1">Google Sheets & Drive Sync</h2>
        <p className="opacity-80 text-[10px] font-bold uppercase tracking-widest">Versão V47: Setores com Cargos</p>
        <FileSpreadsheet className="absolute right-[-20px] bottom-[-20px] text-white/10" size={160} />
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
        <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="Link do Apps Script Web App..." className="w-full px-4 py-3 rounded-xl border-2 border-slate-50 focus:border-blue-400 outline-none text-sm font-bold bg-slate-50" />
        <button onClick={saveUrl} className="w-full py-4 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all" style={{ backgroundColor: theme.primary }}>Atualizar Conexão Global</button>
        <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100">
           <button onClick={() => setShowScriptModal(true)} className="text-[9px] font-black text-blue-600 underline uppercase tracking-widest mt-2 hover:text-blue-800 transition-colors">Copiar Código V47</button>
        </div>
      </div>

      {showScriptModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
              <h3 className="text-xl font-black text-slate-800">Apps Script V47</h3>
              <button onClick={() => setShowScriptModal(false)} className="p-3 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><XCircle size={32} /></button>
            </div>
            <div className="p-8 overflow-y-auto flex-1">
              <div className="relative">
                <button onClick={() => { navigator.clipboard.writeText(APPS_SCRIPT_CODE); alert('Código V47 copiado! Cole no editor do Google Apps Script e faça uma Nova Implantação.'); }} className="absolute top-4 right-4 p-3 bg-slate-900 text-white rounded-2xl shadow-xl flex items-center space-x-2 text-[10px] font-black uppercase">
                  <Copy size={16} /> <span>Copiar V47</span>
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
