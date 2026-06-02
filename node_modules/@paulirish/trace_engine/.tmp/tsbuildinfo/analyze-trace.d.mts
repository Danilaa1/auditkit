/**
 * @param {Trace.Types.Events.Event[]} traceEvents
 * @returns {Promise<{parsedTrace: Trace.TraceModel.ParsedTrace, model: Trace.TraceModel.Model}>}
 */
export function analyzeEvents(traceEvents: Trace.Types.Events.Event[]): Promise<{
    parsedTrace: Trace.TraceModel.ParsedTrace;
    model: Trace.TraceModel.Model;
}>;
/**
 * @param {string} filename
 * @returns {ReturnType<analyzeEvents>}
 */
export function analyzeTrace(filename: string): ReturnType<typeof analyzeEvents>;
export function polyfillDOMRect(): void;
export type Trace = typeof Trace;
import * as Trace from './models/trace/trace.js';
//# sourceMappingURL=analyze-trace.d.mts.map