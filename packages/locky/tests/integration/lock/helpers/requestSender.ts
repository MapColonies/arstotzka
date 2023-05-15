import { LockRequest } from '@map-colonies/arstotzka-common';
import * as supertest from 'supertest';

export class LockRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async postLock(body: LockRequest): Promise<supertest.Response> {
    return supertest.agent(this.app).post(`/lock`).set('Content-Type', 'application/json').send(body);
  }

  public async deleteLock(lockId: string): Promise<supertest.Response> {
    return supertest.agent(this.app).delete(`/lock/${lockId}`);
  }

  public async reserveAccess(serviceId: string): Promise<supertest.Response> {
    return supertest.agent(this.app).post(`/lock/reserve`).query({ service: serviceId });
  }
}
