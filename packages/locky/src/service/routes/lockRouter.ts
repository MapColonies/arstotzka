import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { LockController as LockController } from '../controllers/lockController';

export const lockRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(LockController);

  router.get('/', controller.getResource);
  router.post('/', controller.createResource);

  return router;
};

export const LOCK_ROUTER_SYMBOL = Symbol('lockRouterFactory');
