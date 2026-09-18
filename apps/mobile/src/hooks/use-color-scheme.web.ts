import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Mantiene un valor estable durante el renderizado inicial en web
 * y obtiene el esquema de color real después de la hidratación.
 */
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const colorScheme = useRNColorScheme();

  return hasHydrated ? colorScheme : 'light';
}
