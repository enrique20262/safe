import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface Coordenadas {
  lat: number;
  lng: number;
}

export interface EstudianteCercano {
  id: string;
  usuario_id: string;
  nombre_usuario: string;
  posicion_actual: Coordenadas;
  origen: Coordenadas;
  destino: Coordenadas;
  estado: string;
}

export interface AlertaPanico {
  alertaId: string;
  usuarioId: string;
  nombre: string;
  posicion: Coordenadas;
  mensaje: string;
  creado_en: string;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export const useSecuritySocket = (token: string | null) => {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Listas de estudiantes cercanos y alertas de pánico activas en tiempo real
  const [nearbyStudents, setNearbyStudents] = useState<EstudianteCercano[]>([]);
  const [activeAlert, setActiveAlert] = useState<AlertaPanico | null>(null);

  // Inicializar la conexión de Socket.io
  useEffect(() => {
    if (!token) {
      setConnected(false);
      return;
    }

    // Configuración de la conexión del cliente Socket.io
    const socket = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket'], // Forzar transporte WebSocket por rendimiento y baja latencia
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Conectado al Gateway de Tiempo Real de SafeCampus UCB.');
      setConnected(true);
      setError(null);
    });

    socket.on('connect_error', (err) => {
      console.error('Error de conexión WebSocket:', err.message);
      setError(err.message);
      setConnected(false);
    });

    // Escuchar actualizaciones de estudiantes cercanos recalculadas en PostGIS
    socket.on('nearby-students-update', (students: EstudianteCercano[]) => {
      setNearbyStudents(students);
    });

    // Escuchar el movimiento en tiempo real de estudiantes que comparten nuestra ruta
    socket.on('student-location-changed', (data: { usuarioId: string; nombre: string; posicion: Coordenadas }) => {
      setNearbyStudents(prev => {
        return prev.map(student => {
          if (student.usuario_id === data.usuarioId) {
            return { ...student, posicion_actual: data.posicion };
          }
          return student;
        });
      });
    });

    // Escuchar cuando un estudiante se suma a la misma ruta
    socket.on('student-joined-route', (data: { usuarioId: string; nombre: string; posicion: Coordenadas }) => {
      console.log(`Compañero ${data.nombre} se ha unido a tu ruta.`);
      // Si no existe ya en la lista, lo agregamos provisionalmente
      setNearbyStudents(prev => {
        if (prev.some(s => s.usuario_id === data.usuarioId)) return prev;
        return [...prev, {
          id: `temp-${data.usuarioId}`,
          usuario_id: data.usuarioId,
          nombre_usuario: data.nombre,
          posicion_actual: data.posicion,
          origen: data.posicion,
          destino: data.posicion,
          estado: 'activa'
        }];
      });
    });

    // Escuchar alerta global de pánico de alta prioridad
    socket.on('panic-alert-received', (alerta: AlertaPanico) => {
      console.error(`🚨 ALERTA GENERAL DE SEGURIDAD: ${alerta.nombre} necesita ayuda.`);
      setActiveAlert(alerta);

      // Auto-ocultar la alerta después de 15 segundos en UI
      setTimeout(() => {
        setActiveAlert(prev => prev?.alertaId === alerta.alertaId ? null : prev);
      }, 15000);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token]);

  /**
   * Método para suscribirse a un segmento de ruta segura y enviar los datos del trayecto.
   */
  const joinRoute = useCallback((
    routeId: string,
    origen: Coordenadas,
    destino: Coordenadas,
    trayecto: Coordenadas[]
  ) => {
    if (!socketRef.current || !connected) return;
    
    socketRef.current.emit('join-route', {
      routeId,
      origen,
      destino,
      trayecto
    });
  }, [connected]);

  /**
   * Método para emitir actualizaciones de ubicación GPS periódicas.
   */
  const updateLocation = useCallback((routeId: string, posicion: Coordenadas) => {
    if (!socketRef.current || !connected) return;
    
    socketRef.current.emit('update-coords', {
      routeId,
      posicion
    });
  }, [connected]);

  /**
   * Dispara una alarma de pánico con nuestra ubicación exacta y de alta prioridad.
   */
  const triggerPanicButton = useCallback((posicion: Coordenadas, mensaje?: string) => {
    if (!socketRef.current || !connected) {
      console.error('No se puede enviar alerta de pánico: Socket desconectado.');
      return;
    }
    
    socketRef.current.emit('panic-button-activated', {
      posicion,
      mensaje
    });
  }, [connected]);

  /**
   * Limpia manualmente la alerta de pánico activa de la pantalla.
   */
  const dismissAlert = useCallback(() => {
    setActiveAlert(null);
  }, []);

  return {
    connected,
    error,
    nearbyStudents,
    activeAlert,
    joinRoute,
    updateLocation,
    triggerPanicButton,
    dismissAlert
  };
};
