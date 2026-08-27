/**
 * Restricted Go-Live guard.
 * Automation and external publishing stay disabled until a dedicated Z Media
 * orchestration environment is intentionally enabled.
 */
export const isRestrictedGoLive =
  typeof import.meta !== 'undefined'
    ? import.meta.env?.VITE_RESTRICTED_GO_LIVE !== 'false'
    : true;

export const RESTRICTED_GO_LIVE_MESSAGE =
  'External automation and publishing are disabled for Restricted Go-Live. Enable only after the Z Media orchestration environment is verified.';

export const isExternalAutomationDisabled = isRestrictedGoLive;

export default isRestrictedGoLive;

