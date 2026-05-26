import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extender la interfaz Request de Express para guardar la información del usuario autenticado
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        nombre: string;
        email: string;
        rol?: string;
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkeyforlocaldevelopment_safecampusucb';

/**
 * Middleware para requerir autenticación mediante JWT.
 * Adicionalmente, restringe el acceso al dominio institucional de la UCB (@ucb.edu.bo).
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'No autorizado',
      mensaje: 'Token de acceso no proporcionado.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      nombre: string;
      email: string;
      rol?: string;
    };

    // Validar de forma estricta que pertenezca al dominio institucional @ucb.edu.bo
    // (Esto previene accesos de cuentas externas y alinea con la seguridad de la universidad)
    if (!decoded.email || !decoded.email.endsWith('@ucb.edu.bo')) {
      return res.status(403).json({
        error: 'Acceso prohibido',
        mensaje: 'Solo se permiten cuentas institucionales de la Universidad Católica Boliviana (@ucb.edu.bo).'
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Token inválido',
      mensaje: 'El token proporcionado ha expirado o es incorrecto.'
    });
  }
};

/**
 * NOTA DE ARQUITECTURA DE INTEGRACIÓN CON GOOGLE STITCH:
 * 
 * En producción, el flujo de autenticación institucional utiliza Google Sign-In para Workspace.
 * El MCP de Google Stitch interviene para:
 * 
 * 1. Validar el token de ID de Google (`id_token`) directamente con las APIs de Google Identity.
 * 2. Verificar que la cuenta de usuario esté activa en la consola de Google Admin Workspace de la UCB.
 * 3. Sincronizar perfiles y roles (ej. si el usuario es Personal de Seguridad / Centro de Monitoreo).
 */
export const verifyGoogleWorkspaceToken = async (idToken: string) => {
  // Boilerplate para flujo con Google Stitch / Google OAuth2 Client
  // En producción, llamaríamos a: oauth2Client.verifyIdToken({ idToken, audience: CLIENT_ID })
  
  if (!idToken) throw new Error('Token de Google requerido');
  
  // Simulación de respuesta exitosa de validación de Google
  return {
    email: 'estudiante.prueba@ucb.edu.bo',
    name: 'Estudiante Prueba UCB',
    sub: 'google-sub-id-123456789',
    domain: 'ucb.edu.bo'
  };
};
