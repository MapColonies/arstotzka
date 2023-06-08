import { Parallelism } from '@map-colonies/arstotzka-common';

export const parallelismToActiveLimitation = (parallelism: Parallelism): number => {
  switch (parallelism) {
    case Parallelism.SINGLE:
      return 0;
    case Parallelism.REPLACEABLE:
      return 1;
    case Parallelism.MULTIPLE:
      return Infinity;
  }
};
