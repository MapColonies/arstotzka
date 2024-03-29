import { FactoryFunction } from 'tsyringe';
import { DataSource } from 'typeorm';
import { DATA_SOURCE_PROVIDER } from '../../../common/db';
import { RotationRequest } from '../../models/service';
import { Rotation as RotationEntity, ROTATION_IDENTIFIER_COLUMN } from './rotation';
import { Service as ServiceEntity } from './service';
import { Block as BlockEntity } from './block';

interface RotationCreationResult {
  [ROTATION_IDENTIFIER_COLUMN]: string;
  serviceId: string;
  parentRotation: number | null;
  serviceRotation: number;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createServiceRepository = (dataSource: DataSource) => {
  return dataSource.getRepository(ServiceEntity).extend({
    async findDetailedServiceById(id: string): Promise<ServiceEntity | null> {
      return this.manager
        .createQueryBuilder(ServiceEntity, 'service')
        .leftJoinAndSelect('service.namespace', 'namespace')
        .leftJoinAndSelect('service.rotations', 'rotation')
        .where('service.id = :id', { id })
        .andWhere('rotation.rotation_id IS NOT NULL')
        .orderBy('rotation.parent_rotation', 'DESC', 'NULLS LAST')
        .addOrderBy('rotation.service_rotation', 'DESC')
        .limit(1)
        .getOne();
    },
    async findCurrentRotations(ids: string[]): Promise<ServiceEntity[]> {
      return this.manager
        .createQueryBuilder(ServiceEntity, 'service')
        .leftJoinAndSelect('service.rotations', 'rotation')
        .where('service.id IN(:...ids)', { ids })
        .andWhere('rotation.rotation_id IS NOT NULL')
        .distinctOn(['service.id'])
        .orderBy('service.id')
        .addOrderBy('rotation.parent_rotation', 'DESC', 'NULLS LAST')
        .addOrderBy('rotation.service_rotation', 'DESC')
        .getMany();
    },
    async findDescendants(service: ServiceEntity, inTreeFormat: boolean, depth?: number): Promise<ServiceEntity[] | ServiceEntity> {
      const treeRepository = this.manager.getTreeRepository(ServiceEntity);
      if (inTreeFormat) {
        return treeRepository.findDescendantsTree(service, { depth, relations: [] });
      }
      return treeRepository.findDescendants(service, { depth, relations: [] });
    },
    async findBlocks(id: string): Promise<BlockEntity[]> {
      return this.manager
        .createQueryBuilder(BlockEntity, 'block')
        .leftJoinAndSelect('block.blockeeService', 'blockee')
        .where('block.blocker_id = :id', { id })
        .getMany();
    },
    async createServiceRotation(rotationRequest: RotationRequest): Promise<RotationCreationResult[]> {
      const service = (await this.findOneBy({ id: rotationRequest.serviceId })) as ServiceEntity;

      // get a flat descendants tree of the service in full depth, this includes the service itself
      const descendants = (await this.findDescendants(service, false)) as ServiceEntity[];

      // get the current rotations of all descendants and the service
      const servicesWithCurrentRotation = await this.findCurrentRotations(descendants.map((descendant) => descendant.id));

      // create the new rotations
      const newRotations = servicesWithCurrentRotation.map((service: ServiceEntity) => {
        const currentRotation = service.rotations[0];

        return {
          serviceId: service.id,
          parentRotation:
            currentRotation.serviceId === rotationRequest.serviceId
              ? currentRotation.parentRotation
              : +(currentRotation.parentRotation as number) + 1,
          serviceRotation: +currentRotation.serviceRotation + 1,
          description: rotationRequest.description,
        };
      });

      const returningColumns: (keyof RotationEntity)[] = [ROTATION_IDENTIFIER_COLUMN, 'serviceId', 'parentRotation', 'serviceRotation'];

      // save the new rotations
      const insertResult = await this.manager
        .createQueryBuilder(RotationEntity, 'rotation')
        .insert()
        .into(RotationEntity)
        .values(newRotations)
        .returning(returningColumns)
        .execute();

      return insertResult.generatedMaps as RotationCreationResult[];
    },
  });
};

export const SERVICE_REPOSITORY_SYMBOL = Symbol('serviceRepository');

export type ServiceRepository = ReturnType<typeof createServiceRepository>;

export const serviceRepositoryFactory: FactoryFunction<ServiceRepository> = (depContainer) => {
  const dataSource = depContainer.resolve<DataSource>(DATA_SOURCE_PROVIDER);
  return createServiceRepository(dataSource);
};
