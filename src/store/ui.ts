import { create } from 'zustand';

// Hojas (bottom sheets) que se pueden abrir desde cualquier pantalla.
export type SheetSpec =
  | { kind: 'player'; id?: string }
  | { kind: 'match'; id?: string }
  | { kind: 'training'; id?: string }
  | { kind: 'eval'; playerId?: string }
  | { kind: 'objective' }
  | { kind: 'callup'; id?: string }
  | { kind: 'settings' };

interface ConfirmSpec {
  title: string;
  message?: string;
  ok?: string;
  danger?: boolean;
  resolve: (v: boolean) => void;
}

interface UI {
  toastMsg: string | null;
  toastKey: number;
  sheets: SheetSpec[];
  confirmSpec: ConfirmSpec | null;
  toast: (msg: string) => void;
  open: (s: SheetSpec) => void;
  close: () => void;
  confirm: (spec: Omit<ConfirmSpec, 'resolve'>) => Promise<boolean>;
  _resolveConfirm: (v: boolean) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUI = create<UI>((set, get) => ({
  toastMsg: null,
  toastKey: 0,
  sheets: [],
  confirmSpec: null,
  toast(msg) {
    clearTimeout(toastTimer);
    set((s) => ({ toastMsg: msg, toastKey: s.toastKey + 1 }));
    toastTimer = setTimeout(() => set({ toastMsg: null }), 2600);
  },
  open(s) {
    set((st) => ({ sheets: [...st.sheets, s] }));
  },
  close() {
    set((st) => ({ sheets: st.sheets.slice(0, -1) }));
  },
  confirm(spec) {
    return new Promise<boolean>((resolve) => {
      get().confirmSpec?.resolve(false);
      set({ confirmSpec: { ...spec, resolve } });
    });
  },
  _resolveConfirm(v) {
    get().confirmSpec?.resolve(v);
    set({ confirmSpec: null });
  },
}));

export const toast = (m: string) => useUI.getState().toast(m);
export const confirmDialog = (s: Omit<ConfirmSpec, 'resolve'>) => useUI.getState().confirm(s);
export const openSheet = (s: SheetSpec) => useUI.getState().open(s);
export const closeSheet = () => useUI.getState().close();
