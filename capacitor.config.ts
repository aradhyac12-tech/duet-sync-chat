import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.4c6af4cfa18a4d3aae68a54cea48c034',
  appName: 'DuoSpace',
  webDir: 'dist',
  server: {
    url: 'https://4c6af4cf-a18a-4d3a-ae68-a54cea48c034.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
