declare module "aircall-everywhere" {
  export type AircallWorkspaceSettings = {
    onLogin?: (settings: unknown) => void;
    onLogout?: () => void;
    integrationToLoad?: "zendesk" | "hubspot";
    domToLoadWorkspace: string;
    size?: "big" | "small" | "auto";
    debug?: boolean;
  };

  export default class AircallWorkspace {
    constructor(settings: AircallWorkspaceSettings);
    isLoggedIn(callback: (isLoggedIn: boolean) => void): void;
    on(eventName: string, callback: (payload: unknown) => void): void;
    removeListener(eventName: string, callback: (payload: unknown) => void): void;
    send(
      eventName: string,
      payload: unknown,
      callback: (success: boolean, data: unknown) => void,
    ): void;
  }
}
