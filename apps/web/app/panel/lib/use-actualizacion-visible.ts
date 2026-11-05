"use client";
import { useEffect, useRef } from 'react';

/** Consulta datos compartidos sin recargar la página ni interrumpir un formulario. */
export function useActualizacionVisible(actualizar: () => void | Promise<void>, pausada = false) {
  const estado = useRef({ actualizar, pausada });
  useEffect(() => { estado.current = { actualizar, pausada }; }, [actualizar, pausada]);
  useEffect(() => {
    let ocupada = false;
    let ultima = Date.now();
    async function revisar() {
      if (ocupada || estado.current.pausada || document.visibilityState !== 'visible' || !navigator.onLine || Date.now() - ultima < 5000) return;
      if (document.querySelector('dialog[open]') || document.activeElement?.matches('input,select,textarea,[contenteditable="true"]')) return;
      ocupada = true;
      ultima = Date.now();
      try { await estado.current.actualizar(); } finally { ocupada = false; }
    }
    const alVolver = () => { void revisar(); };
    const intervalo = window.setInterval(alVolver, 30000);
    window.addEventListener('focus', alVolver);
    window.addEventListener('online', alVolver);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener('focus', alVolver);
      window.removeEventListener('online', alVolver);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);
}
