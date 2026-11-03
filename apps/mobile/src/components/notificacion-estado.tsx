import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { styles } from '@/screens/vendedor-estilos';

export function NotificacionEstado({
  tipo,
  mensaje,
  top,
  onCerrar,
}: {
  tipo: 'error' | 'exito';
  mensaje: string;
  top: number;
  onCerrar: () => void;
}) {
  const esError = tipo === 'error';
  const coincidenciaCodigo = esError ? mensaje.match(/^(HTTP \d{3}|SIN RESPUESTA HTTP|VALIDACIÓN|ERROR LOCAL|ERROR DE CARGA|SIN RESULTADOS|ROL NO PERMITIDO) · (.+)$/s) : null;
  const codigo = coincidenciaCodigo?.[1] ?? null;
  const mensajeVisible = coincidenciaCodigo?.[2] ?? mensaje;
  const [progreso] = useState(() => new Animated.Value(0));
  const cerrandoRef = useRef(false);

  const cerrarAnimado = useCallback(() => {
    if (cerrandoRef.current) return;
    cerrandoRef.current = true;
    Animated.timing(progreso, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => { if (finished) onCerrar(); });
  }, [onCerrar, progreso]);

  useEffect(() => {
    cerrandoRef.current = false;
    progreso.setValue(0);
    Animated.spring(progreso, {
      toValue: 1,
      damping: 18,
      stiffness: 220,
      mass: 0.85,
      useNativeDriver: true,
    }).start();

    const temporizador = setTimeout(cerrarAnimado, esError ? 5200 : 3800);
    return () => { clearTimeout(temporizador); progreso.stopAnimation(); };
  }, [cerrarAnimado, esError, mensaje, progreso]);

  return (
    <View pointerEvents="box-none" style={[styles.notificacionZona, { top }]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.notificacion,
          esError ? styles.notificacionError : styles.notificacionExito,
          {
            opacity: progreso,
            transform: [
              {
                translateY: progreso.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-18, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View
          style={[
            styles.notificacionIcono,
            esError ? styles.notificacionIconoError : styles.notificacionIconoExito,
          ]}
        >
          <Text style={styles.notificacionIconoTexto}>{esError ? '!' : '✓'}</Text>
        </View>
        <View style={styles.flex}>
          <Text
            style={[
              styles.notificacionTitulo,
              esError ? styles.notificacionTituloError : styles.notificacionTituloExito,
            ]}
          >
            {esError ? 'No se pudo completar' : 'Operación completada'}
          </Text>
          {codigo ? <Text style={styles.notificacionCodigo}>{codigo}</Text> : null}
          <Text style={styles.notificacionMensaje}>{mensajeVisible}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar notificación"
          hitSlop={10}
          onPress={cerrarAnimado}
          style={styles.notificacionCerrar}
        >
          <Text style={styles.notificacionCerrarTexto}>×</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
