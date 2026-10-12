export interface PreviewDeploymentConfig {
  enabled: boolean
  branch: string
  siteUrl: string
  convexUrl: string
  convexSiteUrl: string
}

export declare function resolvePreviewBuildEnv(
  currentEnv: Record<string, string | undefined>,
  deployment: PreviewDeploymentConfig,
  branch: string | undefined,
): Record<string, string | undefined>
