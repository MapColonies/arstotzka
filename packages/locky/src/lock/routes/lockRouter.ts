import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { LockController as LockController } from '../controllers/lockController';

export const LOCK_ROUTER_SYMBOL = Symbol('lockRouterFactory');

export const lockRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(LockController);

  router.post('/', controller.createLock);
  router.delete('/:lockId', controller.deleteLock);
  router.post('/reserve', controller.reserveAccess);

  return router;
};
