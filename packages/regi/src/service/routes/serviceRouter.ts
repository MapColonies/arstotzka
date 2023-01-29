import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { ServiceController } from '../controllers/serviceController';

export const serviceRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(ServiceController);

  router.get('/', controller.getResource);
  router.post('/', controller.createResource);

  return router;
};

export const SERVICE_ROUTER_SYMBOL = Symbol('serviceRouterFactory');
