export interface ConvexFrontendEnvironment {
  readonly VITE_CONVEX_URL?: string
  readonly VITE_CONVEX_SITE_URL?: string
}

export type ConvexFrontendConfig =
  | { status: 'missing'; convexUrl: ''; siteUrl: '' }
  | { status: 'ready'; convexUrl: string; siteUrl: string }

export declare function resolveConvexFrontendConfig(
  env: ConvexFrontendEnvironment,
): ConvexFrontendConfig
