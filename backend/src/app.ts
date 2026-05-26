import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

// Cargar variables de entorno
dotenv.config();

import { registerSecuritySocketHandlers } from './socket/securitySocket';
import { GeoRepository } from './repositories/geoRepository';

const app = express();
const httpServer = createServer(app);

// Configuración de CORS para admitir conexiones locales y despliegue del frontend
app.use(cors({
  origin: '*', // Permitir todas las conexiones para desarrollo
  methods: ['GET', 'POST']
}));

app.use(express.json());

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkeyforlocaldevelopment_safecampusucb';

// Inicializar Servidor Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Registrar manejadores de sockets geoespaciales y de seguridad en tiempo real
registerSecuritySocketHandlers(io);

/**
 * RUTA HTTP POST: /api/auth/login-mock
 * Permite simular una autenticación rápida para obtener el JWT y probar el cliente.
 * Valida estrictamente que el dominio sea @ucb.edu.bo.
 */
app.post('/api/auth/login-mock', (req, res) => {
  const { nombre, email } = req.body;

  if (!email || !nombre) {
    return res.status(400).json({ error: 'Nombre y correo son requeridos.' });
  }

  // Validación de dominio institucional
  if (!email.endsWith('@ucb.edu.bo')) {
    return res.status(400).json({ 
      error: 'Correo no válido',
      mensaje: 'Para ingresar a SafeCampus UCB debes usar tu correo institucional (@ucb.edu.bo).' 
    });
  }

  // Generar token JWT con vigencia de 24 horas
  const payload = {
    id: `student-${Math.floor(Math.random() * 10000)}`,
    nombre,
    email,
    rol: 'estudiante'
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

  return res.status(200).json({
    mensaje: 'Autenticación mock completada correctamente.',
    token,
    usuario: payload
  });
});

/**
 * RUTA HTTP GET: /api/reportes
 * Obtiene las zonas de riesgo activas para cargar inicialmente en Mapbox.
 */
app.get('/api/reportes', async (req, res) => {
  try {
    const reportes = await GeoRepository.getActiveReports();
    return res.status(200).json(reportes);
  } catch (error) {
    return res.status(500).json({ error: 'Error al recuperar reportes de seguridad.' });
  }
});

/**
 * Ruta de salud del servidor
 */
app.get('/health', (req, res) => {
  res.status(200).send('SafeCampus UCB Server - ONLINE');
});

// Iniciar el servidor HTTP y WebSocket
httpServer.listen(PORT, () => {
  console.log(`=============================================================`);
  console.log(`🚀 SERVIDOR SAFECAMPUS UCB CORRIENDO EN EL PUERTO: ${PORT}`);
  console.log(`   - HTTP API: http://localhost:${PORT}`);
  console.log(`   - WebSocket: ws://localhost:${PORT}`);
  console.log(`=============================================================`);
});
