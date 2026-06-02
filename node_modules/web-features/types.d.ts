import type { BaselineEnum as BaselineHighLow, BrowserData, Browsers, Discouraged, GroupData, Kind, FeatureData as QuicktypeMonolithicFeatureData, Status as QuicktypeStatus, StatusHeadline as QuicktypeStatusHeadline, WebFeaturesData as QuicktypeWebFeaturesData, Release, SnapshotData, Support } from "./types.quicktype";
export type { BaselineHighLow, BrowserData, Browsers, Discouraged, GroupData, Release, SnapshotData, Support, };
export interface Status extends QuicktypeStatus {
    baseline: false | BaselineHighLow;
}
export interface SupportStatus extends QuicktypeStatusHeadline {
    baseline: false | BaselineHighLow;
}
export interface WebFeaturesData extends Pick<QuicktypeWebFeaturesData, "browsers" | "groups" | "snapshots"> {
    features: {
        [key: string]: FeatureData | FeatureMovedData | FeatureSplitData;
    };
}
export type FeatureData = {
    kind: "feature";
} & Required<Pick<QuicktypeMonolithicFeatureData, "description_html" | "description" | "name" | "spec" | "status">> & Partial<Pick<QuicktypeMonolithicFeatureData, "caniuse" | "compat_features" | "discouraged" | "group" | "snapshot">>;
type FeatureRedirectData = {
    kind: Exclude<Kind, "feature">;
} & Required<Pick<QuicktypeMonolithicFeatureData, "redirect_target" | "redirect_targets">>;
export interface FeatureMovedData extends Omit<FeatureRedirectData, "redirect_targets"> {
    kind: "moved";
}
export interface FeatureSplitData extends Omit<FeatureRedirectData, "redirect_target"> {
    kind: "split";
}
export type BrowserIdentifier = keyof Browsers;
