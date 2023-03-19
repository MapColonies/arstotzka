import { Parallelism } from '@map-colonies/vector-management-common';

export const parallelismToActiveBarrier = (parallelism: Parallelism): number => {
  switch (parallelism) {
    case Parallelism.SINGLE:
      return 0;
    case Parallelism.REPLACEABLE:
      return 1;
    case Parallelism.MULTIPLE:
      return Infinity;
  }
};
