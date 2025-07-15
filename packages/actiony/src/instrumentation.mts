// This file handles the tracing initialization and starts the tracing process before the app starts.
// You should be careful about editing this file, as it is a critical part of the application's functionality.
// Because this file is a module it should imported using the `--import` flag in the `node` command, and should not be imported by any other file.
import { TracingOptions } from '@map-colonies/telemetry';
import config from 'config';
import { tracingFactory } from './common/tracing.js';

const tracingConfig = config.get<Partial<TracingOptions>>('telemetry.tracing');

const tracing = tracingFactory({ ...tracingConfig });

tracing.start();
