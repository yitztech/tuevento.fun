import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: process.env.MOBILE_APP_ID || 'com.tueventofun.app',
  appName: 'TuEventoFun', webDir: 'dist',
  plugins: { CapacitorHttp: { enabled: true } },
  // Bundled React assets; never loads remote application code.
};
export default config;
