import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { GeoRepository, Coordenadas } from '../repositories/geoRepository';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkeyforlocaldevelopment_safecampusucb';

interface SocketUser {
  id: string;
  nombre: string;
  email: string;
}

/**
 * Registra y maneja los eventos de Socket.io en tiempo real para SafeCampus UCB.
 */
export const registerSecuritySocketHandlers = (io: Server) => {
  
  // Middleware de autenticación para sockets
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers['x-auth-token'];

    if (!token) {
      return next(new Error('Autenticación requerida: No se proporcionó un token de seguridad.'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as SocketUser;
      
      // Validar dominio institucional en el handshake del WebSocket
      if (!decoded.email || !decoded.email.endsWith('@ucb.edu.bo')) {
        return next(new Error('Acceso no autorizado: Debe ingresar con una cuenta institucional @ucb.edu.bo'));
      }

      socket.data.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Autenticación fallida: Token de acceso no válido o expirado.'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as SocketUser;
    console.log(`Estudiante conectado en tiempo real: ${user.nombre} (${user.email}) - Socket ID: ${socket.id}`);

    /**
     * Evento: 'join-route'
     * El estudiante se suscribe a una ruta segura (definida por un ID de segmento o coordenadas).
     * Esto le permite integrarse a un "canal de acompañamiento" específico.
     */
    socket.on('join-route', async (data: { 
      routeId: string; 
      origen: Coordenadas; 
      destino: Coordenadas; 
      trayecto: Coordenadas[] 
    }) => {
      const { routeId, origen, destino, trayecto } = data;
      
      socket.join(routeId);
      console.log(`Estudiante ${user.nombre} se unió a la ruta de acompañamiento: ${routeId}`);

      // Registrar la ruta activa del estudiante en la base de datos (PostGIS)
      await GeoRepository.saveActiveRoute(user.id, origen, destino, trayecto);

      // Notificar a los demás estudiantes de esa ruta que un nuevo compañero se ha sumado
      socket.to(routeId).emit('student-joined-route', {
        usuarioId: user.id,
        nombre: user.nombre,
        posicion: origen
      });

      // Consultar y enviar al estudiante que recién ingresa las coordenadas de otros estudiantes cercanos
      const cercanos = await GeoRepository.findNearbyStudents(user.id, origen, 400); // 400 metros a la redonda
      socket.emit('nearby-students-update', cercanos);
    });

    /**
     * Evento: 'update-coords'
     * El estudiante emite sus coordenadas GPS actualizadas mientras camina.
     */
    socket.on('update-coords', async (data: { routeId: string; posicion: Coordenadas }) => {
      const { routeId, posicion } = data;

      // Actualizar en base de datos geoespacial (PostGIS)
      await GeoRepository.updateStudentLocation(user.id, posicion.lat, posicion.lng);

      // Propagar posición actual de este estudiante a los demás miembros en la misma ruta
      socket.to(routeId).emit('student-location-changed', {
        usuarioId: user.id,
        nombre: user.nombre,
        posicion: posicion
      });

      // Enviar de forma regular actualizaciones de estudiantes cercanos
      const cercanos = await GeoRepository.findNearbyStudents(user.id, posicion, 400);
      socket.emit('nearby-students-update', cercanos);
    });

    /**
     * Evento: 'panic-button-activated' (Botón de Pánico de Alta Prioridad)
     * Despachado inmediatamente cuando un estudiante experimenta o visualiza una situación de peligro inminente.
     */
    socket.on('panic-button-activated', async (data: { posicion: Coordenadas; mensaje?: string }) => {
      const { posicion, mensaje } = data;
      console.error(`🚨 ALERTA DE PÁNICO ACTIVADA por: ${user.nombre} (${user.email}) en [Lat: ${posicion.lat}, Lng: ${posicion.lng}]`);

      // 1. Guardar la alerta en la base de datos (PostGIS) para registro oficial e histórico
      const alerta = await GeoRepository.createPanicAlert(user.id, posicion.lat, posicion.lng);

      // 2. Difundir la alarma de forma instantánea a TODOS los usuarios conectados (Broadcast Global)
      // para que los estudiantes cercanos busquen resguardo o eviten la calle/zona.
      io.emit('panic-alert-received', {
        alertaId: alerta.id,
        usuarioId: user.id,
        nombre: user.nombre,
        posicion: posicion,
        mensaje: mensaje || '¡Ayuda requerida de inmediato en los alrededores del campus!',
        creado_en: alerta.creado_en || new Date()
      });

      // 3. Emitir de forma exclusiva al Dashboard del Centro de Monitoreo de Seguridad de la UCB
      io.to('monitoring-center').emit('security-panic-alarm', {
        alertaId: alerta.id,
        estudiante: {
          id: user.id,
          nombre: user.nombre,
          email: user.email
        },
        ubicacion: posicion,
        creado_en: alerta.creado_en
      });

      // 4. INTEGRACIÓN DE FLUJO CON GOOGLE STITCH (Notificación / Registro)
      triggerGoogleStitchEmergencyFlow(user, posicion, mensaje || 'Alerta de pánico activada');
    });

    /**
     * Canal especial para el Centro de Monitoreo de Seguridad de la UCB
     */
    socket.on('register-monitoring', () => {
      socket.join('monitoring-center');
      console.log(`🛡️ Centro de Monitoreo UCB registrado en el socket: ${socket.id}`);
    });

    socket.on('disconnect', () => {
      console.log(`Estudiante desconectado de los servicios de tiempo real: ${user.nombre}`);
    });
  });
};

/**
 * Simulación de disparador para Google Stitch MCP.
 * Automatiza las tareas del ecosistema Google para emergencias.
 */
function triggerGoogleStitchEmergencyFlow(user: SocketUser, posicion: Coordenadas, mensaje: string) {
  console.log(`[Google Stitch MCP] Automatizando tareas de emergencia en la nube:`);
  
  // 1. Registro automático en Bitácora de Google Sheets
  console.log(`  -> Registrando fila en Google Sheet de Emergencia (ID del estudiante: ${user.id})`);
  
  // 2. Notificación enriquecida a canal de Google Chat de la Guardia de Seguridad
  console.log(`  -> Enviando tarjeta de emergencia a Google Chat con enlace a ubicación: https://maps.google.com/?q=${posicion.lat},${posicion.lng}`);
  
  // 3. Sincronización con base de datos analítica en Google BigQuery para reportes de fin de año
  console.log(`  -> Almacenando registro analítico en Google BigQuery.`);
}
