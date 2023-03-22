import { ActionParams } from '@map-colonies/arstotzka-common';
import { ACTION_IDENTIFIER_COLUMN } from '../DAL/typeorm/action';

export interface ActionId {
  [ACTION_IDENTIFIER_COLUMN]: string;
}

export interface CreateActionParams extends ActionParams {
  namespaceId: number;
  serviceRotation: number;
  parentRotation: number | null;
}
