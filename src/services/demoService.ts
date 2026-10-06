export interface DemoPersona {
  id: string;
  name: string;
  defaultContactName: string;
  defaultPhone: string;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'طالب ١',
    defaultContactName: 'طالب ١',
    defaultPhone: '0501111111',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'طالب ٢',
    defaultContactName: 'طالب ٢',
    defaultPhone: '0502222222',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'طالب ٣',
    defaultContactName: 'طالب ٣',
    defaultPhone: '0503333333',
  },
];

const DEMO_STORAGE_KEY = 'taman:demo_mode';
const REAL_DEVICE_ID_KEY = 'taman:real_device_id';

export const demoService = {
  /**
   * Checks whether demo mode is active.
   * Enabled ONLY when URL contains ?demo=1 or stored in sessionStorage.
   * Survives navigation inside the app, and is dropped when tab closes.
   */
  isDemoActive(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('demo') === '1') {
        sessionStorage.setItem(DEMO_STORAGE_KEY, 'true');
        return true;
      }
      return sessionStorage.getItem(DEMO_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  },

  /**
   * Initializes demo mode: saves real device id to sessionStorage and defaults to persona 1.
   */
  initDemoMode(): DemoPersona {
    const currentDeviceId = localStorage.getItem('taman:device_id');
    const savedRealId = sessionStorage.getItem(REAL_DEVICE_ID_KEY);

    // Save real device ID on first activation if not saved yet and current is not a demo persona
    if (!savedRealId && currentDeviceId) {
      const isCurrentDemo = DEMO_PERSONAS.some((p) => p.id === currentDeviceId);
      if (!isCurrentDemo) {
        sessionStorage.setItem(REAL_DEVICE_ID_KEY, currentDeviceId);
      }
    }

    // Determine current active persona, or set to persona 1 if not a demo persona
    const found = DEMO_PERSONAS.find((p) => p.id === currentDeviceId);
    if (found) {
      return found;
    }

    const defaultPersona = DEMO_PERSONAS[0];
    localStorage.setItem('taman:device_id', defaultPersona.id);
    return defaultPersona;
  },

  /**
   * Gets current active persona based on current device ID.
   */
  getActivePersona(): DemoPersona | null {
    if (typeof localStorage === 'undefined') return null;
    const currentDeviceId = localStorage.getItem('taman:device_id');
    return DEMO_PERSONAS.find((p) => p.id === currentDeviceId) || null;
  },

  /**
   * Switches active persona to chosen uuid.
   */
  switchPersona(persona: DemoPersona): void {
    localStorage.setItem('taman:device_id', persona.id);
  },

  /**
   * Exits demo mode: restores real device id, cleans sessionStorage and URL.
   */
  exitDemoMode(): string | null {
    if (typeof window === 'undefined') return null;
    let restoredId: string | null = null;
    try {
      const realId = sessionStorage.getItem(REAL_DEVICE_ID_KEY);
      if (realId) {
        localStorage.setItem('taman:device_id', realId);
        restoredId = realId;
      }
      sessionStorage.removeItem(REAL_DEVICE_ID_KEY);
      sessionStorage.removeItem(DEMO_STORAGE_KEY);

      // Clean URL if ?demo=1 is present
      const url = new URL(window.location.href);
      if (url.searchParams.has('demo')) {
        url.searchParams.delete('demo');
        window.history.replaceState({}, '', url.toString());
      }
    } catch (err) {
      console.warn('Error exiting demo mode:', err);
    }
    return restoredId;
  },
};
