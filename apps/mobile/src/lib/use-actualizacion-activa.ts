import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/** Sólo consulta mientras la app está en primer plano; nunca registra operaciones. */
export function useActualizacionActiva(actualizar: () => Promise<void>, pausada: boolean) {
  const estado = useRef({ actualizar, pausada });
  useEffect(() => { estado.current = { actualizar, pausada }; }, [actualizar, pausada]);
  useEffect(() => {
    let ocupada = false;
    let ultima = Date.now();
    async function revisar() {
      if (ocupada || estado.current.pausada || AppState.currentState !== 'active' || Date.now() - ultima < 5000) return;
      ocupada = true;
      ultima = Date.now();
      try { await estado.current.actualizar(); } finally { ocupada = false; }
    }
    const listener = AppState.addEventListener('change', estadoApp => { if (estadoApp === 'active') void revisar(); });
    const intervalo = setInterval(() => { void revisar(); }, 30000);
    return () => { listener.remove(); clearInterval(intervalo); };
  }, []);
}
