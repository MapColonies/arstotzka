import { Logger } from '@map-colonies/js-logger';
import {
  Action,
  ActionFilter,
  ParallelismMismatchError,
  ServiceNotFoundError,
  ActionAlreadyClosedError,
  ActionNotFoundError,
  ActionParams,
  UpdatableActionParams,
} from '@map-colonies/arstotzka-common';
import { RequestHandler } from 'express';
import httpStatus, { StatusCodes } from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { HttpError } from '../../common/errors';
import { ActionId } from '../models/action';
import { ActionManager } from '../models/actionManager';

type GetActionsHandler = RequestHandler<undefined, Action[], undefined, ActionFilter>;
type PostActionHandler = RequestHandler<undefined, ActionId, ActionParams>;
type PatchActionHandler = RequestHandler<ActionId, undefined, UpdatableActionParams>;

@injectable()
export class ActionController {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(ActionManager) private readonly manager: ActionManager) {}

  public getActions: GetActionsHandler = async (req, res, next) => {
    try {
      const actions = await this.manager.getActions(req.query);
      return res.status(httpStatus.OK).json(actions);
    } catch (error) {
      return next(error);
    }
  };

  public postAction: PostActionHandler = async (req, res, next) => {
    try {
      const actionId = await this.manager.createAction(req.body);
      return res.status(httpStatus.CREATED).json({ actionId });
    } catch (error) {
      if (error instanceof ServiceNotFoundError) {
        (error as HttpError).status = StatusCodes.NOT_FOUND;
      } else if (error instanceof ParallelismMismatchError) {
        (error as HttpError).status = StatusCodes.CONFLICT;
      }
      return next(error);
    }
  };

  public patchAction: PatchActionHandler = async (req, res, next) => {
    try {
      await this.manager.updateAction(req.params.actionId, req.body);
      return res.status(httpStatus.OK).json();
    } catch (error) {
      if (error instanceof ActionNotFoundError) {
        (error as HttpError).status = StatusCodes.NOT_FOUND;
      } else if (error instanceof ActionAlreadyClosedError) {
        (error as HttpError).status = StatusCodes.CONFLICT;
      }
      return next(error);
    }
  };
}
