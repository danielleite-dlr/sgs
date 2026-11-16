import type { CapacitorConfig } from '@capacitor/cli';

// Casca do Gestor Beauty: as telas vêm do servidor (D-07). Trocar a URL exige nova versão do app.
export const SERVER_URL = 'https://sgs.jessicaseixasmakeup.com.br';

const config: CapacitorConfig = {
  appId: 'br.com.gestorbeauty.app',
  appName: 'Gestor Beauty',
  webDir: 'www',
  server: {
    url: SERVER_URL,
    // Página local sem plugins (a ponte do Capacitor não existe nela).
    errorPath: 'offline.html',
  },
  android: {
    backgroundColor: '#F7F6F3',
    appendUserAgent: 'GestorBeautyApp/1',
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 3000,
      backgroundColor: '#F7F6F3',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    Keyboard: { resize: 'body' },
    SystemBars: { insetsHandling: 'css' },
  },
};

export default config;
