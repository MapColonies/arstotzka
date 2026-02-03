import 'reflect-metadata';
import config from 'config';
import { TracingOptions } from '@map-colonies/telemetry';
import { tracingFactory } from '../../src/common/tracing';

const tracingConfig = config.get<Partial<TracingOptions>>('telemetry.tracing');

tracingFactory({ ...tracingConfig });
