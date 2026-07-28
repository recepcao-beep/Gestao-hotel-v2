import { Apartment } from '../types';

export type ApartmentFloorType = 'COLD' | 'WOOD' | 'UNINFORMED';

const normalizeText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

export function resolveApartmentRoomNumber(apt: Apartment, fallbackId?: string): number | null {
  const direct = Number((apt as any).roomNumber ?? (apt as any).numero ?? (apt as any).quarto);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const raw = String((apt as any).id ?? fallbackId ?? '');
  const matches = raw.match(/\d+/g);
  if (!matches?.length) return null;
  const roomNumber = Number(matches[matches.length - 1]);
  return Number.isFinite(roomNumber) && roomNumber > 0 ? roomNumber : null;
}

export function resolveApartmentFloor(apt: Apartment, fallbackId?: string): number | null {
  const direct = Number((apt as any).floor ?? (apt as any).andar ?? (apt as any).chao ?? (apt as any)['chão']);
  if (Number.isFinite(direct) && direct >= 100) return direct;

  const roomNumber = resolveApartmentRoomNumber(apt, fallbackId);
  return roomNumber && roomNumber >= 100 ? Math.floor(roomNumber / 100) * 100 : null;
}

export function resolveApartmentFloorType(apt?: Apartment): ApartmentFloorType {
  const value = normalizeText((apt as any)?.pisoType ?? (apt as any)?.tipoPiso ?? (apt as any)?.piso);
  if (!value) return 'UNINFORMED';
  if (['madeira', 'piso de madeira'].some((term) => value.includes(term))) return 'WOOD';
  if (['frio', 'granito', 'ceramica', 'porcelanato'].some((term) => value.includes(term))) return 'COLD';
  return 'UNINFORMED';
}

export function getApartmentFloorTypeLabel(type: ApartmentFloorType) {
  if (type === 'COLD') return 'Piso frio';
  if (type === 'WOOD') return 'Piso de madeira';
  return 'Não informado';
}

export function apartmentNeedsAttention(apt?: Apartment) {
  if (!apt) return true;
  return (apt.defects || []).length > 0
    || normalizeText(apt.pisoStatus).includes('reparo urgente')
    || normalizeText(apt.banheiroStatus).includes('reparo urgente');
}
