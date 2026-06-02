export { LCPBreakdownComputed as LCPBreakdown };
declare const LCPBreakdownComputed: typeof LCPBreakdown & {
    request: (dependencies: import("../../index.js").Artifacts.MetricComputationDataInput, context: LH.Artifacts.ComputedContext) => Promise<{
        ttfb: number;
        loadDelay?: number;
        loadDuration?: number;
        renderDelay?: number;
    }>;
};
/**
 * Note: this omits renderDelay for simulated throttling.
 */
declare class LCPBreakdown {
    /**
     * @param {LH.Artifacts.MetricComputationDataInput} data
     * @param {LH.Artifacts.ComputedContext} context
     * @return {Promise<{ttfb: number, loadDelay?: number, loadDuration?: number, renderDelay?: number}>}
     */
    static compute_(data: LH.Artifacts.MetricComputationDataInput, context: LH.Artifacts.ComputedContext): Promise<{
        ttfb: number;
        loadDelay?: number;
        loadDuration?: number;
        renderDelay?: number;
    }>;
}
//# sourceMappingURL=lcp-breakdown.d.ts.map