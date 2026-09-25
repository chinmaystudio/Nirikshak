export interface AppEnvironment {
  apiBaseUrl: string;
  demoMode: boolean;
  appName: string;
  version: string;
}

const env = import.meta.env;

export const environment: AppEnvironment = {
  apiBaseUrl: (env.VITE_API_BASE_URL as string | undefined) ?? "",
  demoMode: !(env.VITE_API_BASE_URL as string | undefined),
  appName: "NIRIKSHAN",
  version: "7.0.0"
};
