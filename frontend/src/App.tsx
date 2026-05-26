import React, { useState } from 'react';
import { useSecuritySocket, Coordenadas } from './hooks/useSecuritySocket.js';
import { SafeMap } from './components/SafeMap.tsx';
import { Shield, Mail, User, LogOut, Bell, EyeOff, AlertTriangle } from 'lucide-react';

export const App: React.FC = () => {
  // Estado de autenticación local para demostración y desarrollo
  const [token, setToken] = useState<string | null>(localStorage.getItem('safecampus_jwt'));
  const [usuario, setUsuario] = useState<any>(
    JSON.parse(localStorage.getItem('safecampus_user') || 'null')
  );

  // Estados del formulario de ingreso
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Inicializar hook de WebSockets (se auto-conecta cuando el token cambia)
  const {
    connected: socketConnected,
    nearbyStudents,
    activeAlert,
    joinRoute,
    updateLocation,
    triggerPanicButton,
    dismissAlert
  } = useSecuritySocket(token);

  // Manejar el login contra nuestra API del backend
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    // Validación preliminar del correo en el cliente
    if (!email.endsWith('@ucb.edu.bo')) {
      setAuthError('Acceso denegado: Se requiere un correo institucional de la UCB (@ucb.edu.bo).');
      return;
    }

    setLoginLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/auth/login-mock`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, email })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.mensaje || 'Error al autenticar.');
      }

      // Guardar sesión
      localStorage.setItem('safecampus_jwt', data.token);
      localStorage.setItem('safecampus_user', JSON.stringify(data.usuario));
      
      setToken(data.token);
      setUsuario(data.usuario);
    } catch (err: any) {
      setAuthError(err.message || 'Error de conexión con el servidor.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('safecampus_jwt');
    localStorage.removeItem('safecampus_user');
    setToken(null);
    setUsuario(null);
  };

  // Enviar evento de actualización de coordenadas al WebSocket
  const handleLocationUpdate = (posicion: Coordenadas) => {
    updateLocation('route-1', posicion);
  };

  // Enviar alerta del botón de pánico de alta prioridad
  const handlePanicTrigger = (posicion: Coordenadas) => {
    triggerPanicButton(posicion, '¡Botón de pánico activado por emergencia en el trayecto nocturno!');
  };

  // Inicializar suscripción a la ruta segura
  const handleJoinRoute = (origen: Coordenadas, destino: Coordenadas, trayecto: Coordenadas[]) => {
    joinRoute('route-1', origen, destino, trayecto);
  };

  // Pantalla de Login (Si el usuario no está autenticado)
  if (!token || !usuario) {
    return (
      <div className="h-full flex items-center justify-center bg-night-950 p-6 font-sans">
        <div className="w-full max-w-md p-8 rounded-3xl glass-panel shadow-glass border border-white/5 relative overflow-hidden">
          {/* Círculos decorativos premium */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl" />

          <div className="flex flex-col items-center mb-8 relative">
            <div className="w-16 h-16 bg-blue-600/10 border border-blue-500/30 rounded-2xl flex items-center justify-center mb-3">
              <Shield className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight font-sans">SafeCampus UCB</h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">Red de Acompañamiento Estudiantil</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-5 relative">
            {authError && (
              <div className="p-3.5 bg-red-950/40 border border-red-800/50 rounded-xl flex gap-2 items-start text-xs text-red-200">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 tracking-wide uppercase">Nombre Completo</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="w-4 h-4 text-slate-500" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="Ej. Sebastián Tapia"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-night-900 border border-night-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-slate-100 placeholder-slate-500 text-sm outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 tracking-wide uppercase">Correo Institucional</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="w-4 h-4 text-slate-500" />
                </span>
                <input
                  type="email"
                  required
                  placeholder="Ej. s.tapia@ucb.edu.bo"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-night-900 border border-night-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-slate-100 placeholder-slate-500 text-sm outline-none transition-all"
                />
              </div>
              <span className="text-[10px] text-slate-400 block px-1">
                Restringido estrictamente al dominio de la UCB (@ucb.edu.bo).
              </span>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-75 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-blue-600/10 flex items-center justify-center gap-2"
            >
              {loginLoading ? 'Ingresando...' : 'Iniciar Sesión'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Interfaz de Dashboard Principal (Usuario Autenticado)
  return (
    <div className="h-full flex flex-col bg-night-950 font-sans">
      {/* Encabezado Principal Premium */}
      <header className="px-5 py-3 border-b border-night-800 bg-night-900/60 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-blue-600/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-100 tracking-tight leading-none">SafeCampus</h1>
            <span className="text-[10px] text-blue-400 font-semibold tracking-wider">UNIVERSIDAD CATÓLICA BOLIVIANA</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-200">{usuario.nombre}</p>
            <p className="text-[9px] text-slate-400">{usuario.email}</p>
          </div>
          
          <button
            onClick={handleLogout}
            className="w-8 h-8 rounded-lg border border-night-850 hover:border-red-500/30 bg-night-800 hover:bg-red-500/10 flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors"
            title="Cerrar Sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Contenedor del Mapa e Overlays de Alerta */}
      <main className="flex-grow relative overflow-hidden">
        {/* Banner de Alerta de Pánico en Pantalla Completa de Alta Prioridad */}
        {activeAlert && (
          <div className="absolute top-4 left-4 right-4 z-50 animate-bounce">
            <div className="p-4 bg-red-600/95 backdrop-blur-md border border-red-500 rounded-2xl shadow-glow-red flex items-start justify-between gap-4 text-white">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0 animate-pulse">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold tracking-wide uppercase">🚨 ALERTA DE PÁNICO ACTIVA</h3>
                  <p className="text-xs font-bold text-white/95 mt-0.5">Estudiante: {activeAlert.nombre}</p>
                  <p className="text-[10px] text-white/80 mt-1">{activeAlert.mensaje}</p>
                </div>
              </div>
              <button
                onClick={dismissAlert}
                className="px-2.5 py-1 rounded bg-white/20 hover:bg-white/30 text-[10px] font-bold tracking-wider uppercase transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Mapa Interactivo de Mapbox */}
        <SafeMap
          nearbyStudents={nearbyStudents}
          onLocationUpdate={handleLocationUpdate}
          onPanicTrigger={handlePanicTrigger}
          socketConnected={socketConnected}
          onJoinRoute={handleJoinRoute}
        />
      </main>
    </div>
  );
};
export default App;
