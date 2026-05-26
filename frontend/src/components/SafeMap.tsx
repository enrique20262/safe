import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Shield, AlertTriangle, Play, Pause, AlertOctagon } from 'lucide-react';
import { Coordenadas, EstudianteCercano } from '../hooks/useSecuritySocket.js';

// Establecer el token público de Mapbox
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';
mapboxgl.accessToken = MAPBOX_TOKEN;

// Estilo de mapa oscuro personalizado de Mapbox (Night Style)
const DARK_MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';

// Coordenadas centrales por defecto: Universidad Católica Boliviana (UCB), Santa Cruz
const UCB_COORDS: Coordenadas = {
  lat: -17.6942106,
  lng: -63.1490448
};

// Ruta de ejemplo alrededor del campus
const MOCK_ROUTE_COORDS: Coordenadas[] = [
  { lat: -17.6930, lng: -63.1505 },
  { lat: -17.6936, lng: -63.1498 },
  { lat: -17.6942106, lng: -63.1490448 }, // Campus UCB Santa Cruz
  { lat: -17.6948, lng: -63.1483 },
  { lat: -17.6955, lng: -63.1475 }
];

interface SafeMapProps {
  nearbyStudents: EstudianteCercano[];
  onLocationUpdate: (posicion: Coordenadas) => void;
  onPanicTrigger: (posicion: Coordenadas) => void;
  socketConnected: boolean;
  onJoinRoute: (origen: Coordenadas, destino: Coordenadas, trayecto: Coordenadas[]) => void;
}

export const SafeMap: React.FC<SafeMapProps> = ({
  nearbyStudents,
  onLocationUpdate,
  onPanicTrigger,
  socketConnected,
  onJoinRoute
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const studentMarkersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});

  const [userLocation, setUserLocation] = useState<Coordenadas>(UCB_COORDS);
  const [isSimulatingWalk, setIsSimulatingWalk] = useState(false);
  const [simulationIndex, setSimulationIndex] = useState(0);
  const [riskZones, setRiskZones] = useState<any[]>([]);
  const [panicLoading, setPanicLoading] = useState(false);

  // Obtener ubicación real del usuario con alta precisión al montar el componente
  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const realLocation: Coordenadas = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setUserLocation(realLocation);
        onLocationUpdate(realLocation);

        if (mapRef.current) {
          mapRef.current.flyTo({
            center: [realLocation.lng, realLocation.lat],
            zoom: 16.5,
            duration: 2000
          });
        }
      },
      (error) => {
        console.warn('Error obteniendo ubicación:', error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, []);

  // Cargar reportes de zonas de riesgo desde la API
  useEffect(() => {
    fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/api/reportes`)
      .then(res => res.json())
      .then(data => setRiskZones(data))
      .catch(() => {
        // Fallback local si el backend no está iniciado
        setRiskZones([
          { id: '1', tipo_riesgo: 'falta_iluminacion', descripcion: 'Esquina oscura detrás del Bloque C', ubicacion: { lat: -17.6938, lng: -63.1500 } },
          { id: '2', tipo_riesgo: 'zona_solitaria', descripcion: 'Parada de micro desolada', ubicacion: { lat: -17.6950, lng: -63.1480 } }
        ]);
      });
  }, []);

  // Inicializar el mapa de Mapbox
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: DARK_MAP_STYLE,
      center: [userLocation.lng, userLocation.lat],
      zoom: 16.5,
      pitch: 45, // Vista inclinada 3D premium
      bearing: -10,
      antialias: true
    });

    mapRef.current = map;

    // Añadir controles de navegación (zoom, rotación)
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Control de geolocalización nativo
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true
    });
    map.addControl(geolocateControl, 'top-right');

    map.on('load', () => {
      console.log('Estilos del mapa cargados correctamente.');
      
      // Dibujar la "Ruta Segura" (Línea de acompañamiento)
      map.addSource('safe-route-source', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: MOCK_ROUTE_COORDS.map(c => [c.lng, c.lat])
          }
        }
      });

      // Añadir la capa visual de la ruta
      map.addLayer({
        id: 'safe-route-layer',
        type: 'line',
        source: 'safe-route-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#1E90FF', // Azul brillante de seguridad
          'line-width': 6,
          'line-opacity': 0.8
        }
      });

      // Efecto de resplandor para la ruta
      map.addLayer({
        id: 'safe-route-glow',
        type: 'line',
        source: 'safe-route-source',
        paint: {
          'line-color': '#00F0FF',
          'line-width': 12,
          'line-blur': 6,
          'line-opacity': 0.3
        }
      });

      // Unirse a la ruta en el servidor de WebSocket
      onJoinRoute(
        MOCK_ROUTE_COORDS[0],
        MOCK_ROUTE_COORDS[MOCK_ROUTE_COORDS.length - 1],
        MOCK_ROUTE_COORDS
      );
    });

    // Marcador del usuario actual (Estudiante Local)
    const el = document.createElement('div');
    el.className = 'w-5 h-5 bg-blue-500 border-2 border-white rounded-full shadow-lg ring-4 ring-blue-500/30 animate-pulse';
    
    const userMarker = new mapboxgl.Marker(el)
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map);

    userMarkerRef.current = userMarker;

    return () => {
      map.remove();
    };
  }, []);

  // Actualizar el marcador del usuario actual cuando se mueve
  useEffect(() => {
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    }
  }, [userLocation]);

  // Renderizar marcadores dinámicos de los estudiantes cercanos (WebSocket Sync)
  useEffect(() => {
    if (!mapRef.current) return;

    // Eliminar marcadores de estudiantes que ya no están activos
    const activeStudentIds = new Set(nearbyStudents.map(s => s.usuario_id));
    Object.keys(studentMarkersRef.current).forEach(id => {
      if (!activeStudentIds.has(id)) {
        studentMarkersRef.current[id].remove();
        delete studentMarkersRef.current[id];
      }
    });

    // Agregar o actualizar marcadores para estudiantes activos
    nearbyStudents.forEach(student => {
      const { usuario_id, nombre_usuario, posicion_actual } = student;

      if (studentMarkersRef.current[usuario_id]) {
        // Actualizar posición del marcador existente con una transición fluida
        studentMarkersRef.current[usuario_id].setLngLat([posicion_actual.lng, posicion_actual.lat]);
      } else {
        // Crear un nuevo elemento DOM para el marcador del compañero
        const peerEl = document.createElement('div');
        peerEl.className = 'w-6 h-6 bg-emerald-500 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-[10px] font-bold text-white ring-4 ring-emerald-500/30';
        peerEl.innerText = nombre_usuario.split(' ').map(n => n[0]).join('').substring(0, 2);

        // Crear Popup con el nombre
        const popup = new mapboxgl.Popup({ offset: 12 }).setHTML(
          `<div class="text-xs">
            <p class="font-bold text-slate-100">${nombre_usuario}</p>
            <p class="text-[10px] text-emerald-400 font-medium">Caminando cerca</p>
          </div>`
        );

        const newMarker = new mapboxgl.Marker(peerEl)
          .setLngLat([posicion_actual.lng, posicion_actual.lat])
          .setPopup(popup)
          .addTo(mapRef.current!);

        studentMarkersRef.current[usuario_id] = newMarker;
      }
    });
  }, [nearbyStudents]);

  // Dibujar las zonas de riesgo (Risk Zones) en el mapa
  useEffect(() => {
    if (!mapRef.current || riskZones.length === 0) return;

    riskZones.forEach(zone => {
      const zoneEl = document.createElement('div');
      zoneEl.className = 'w-8 h-8 bg-amber-500/20 border border-amber-500 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform duration-200';
      
      const iconEl = document.createElement('div');
      iconEl.className = 'text-amber-500';
      iconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
      zoneEl.appendChild(iconEl);

      const popup = new mapboxgl.Popup({ offset: 10 }).setHTML(
        `<div class="text-xs">
          <p class="font-bold text-amber-400 flex items-center gap-1">
            ⚠️ Zona de Riesgo
          </p>
          <p class="text-slate-300 mt-1 font-medium">${zone.tipo_riesgo.replace('_', ' ').toUpperCase()}</p>
          <p class="text-[10px] text-slate-400 mt-0.5">${zone.descripcion}</p>
        </div>`
      );

      new mapboxgl.Marker(zoneEl)
        .setLngLat([zone.ubicacion.lng, zone.ubicacion.lat])
        .setPopup(popup)
        .addTo(mapRef.current!);
    });
  }, [riskZones]);

  // Loop de simulación de caminata a lo largo de los puntos de la ruta segura
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isSimulatingWalk) {
      interval = setInterval(() => {
        setSimulationIndex(prevIndex => {
          const nextIndex = (prevIndex + 1) % MOCK_ROUTE_COORDS.length;
          const nextCoords = MOCK_ROUTE_COORDS[nextIndex];
          
          setUserLocation(nextCoords);
          onLocationUpdate(nextCoords);

          // Centrar el mapa suavemente en la nueva ubicación
          if (mapRef.current) {
            mapRef.current.easeTo({
              center: [nextCoords.lng, nextCoords.lat],
              duration: 1000
            });
          }

          return nextIndex;
        });
      }, 4000); // Avanzar un punto cada 4 segundos
    }

    return () => clearInterval(interval);
  }, [isSimulatingWalk, onLocationUpdate]);

  const handlePanicClick = () => {
    setPanicLoading(true);
    // Simular un retraso táctil pequeño para dar feedback de envío
    setTimeout(() => {
      onPanicTrigger(userLocation);
      setPanicLoading(false);
    }, 1000);
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Contenedor del mapa de Mapbox */}
      <div ref={mapContainerRef} className="w-full flex-grow rounded-2xl overflow-hidden border border-night-800" />

      {/* Botones de control del mapa flotantes (Simulación y estado) */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        {/* Indicador de Conexión del WebSocket */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold glass-panel text-slate-200">
          <span className={`w-2.5 h-2.5 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
          {socketConnected ? 'Canal en Tiempo Real Activo' : 'Reconectando...'}
        </div>
      </div>

      {/* Panel Inferior Flotante Móvil - Mobile First Dashboard */}
      <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-col gap-3">
        
        {/* Controles de Simulación de Ruta */}
        <div className="flex items-center justify-between p-3 rounded-xl glass-panel shadow-glass">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-100 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-blue-400" /> Ruta de Acompañamiento
            </span>
            <span className="text-[10px] text-slate-400">Ruta UCB Campus Nocturno</span>
          </div>

          <button
            onClick={() => setIsSimulatingWalk(!isSimulatingWalk)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              isSimulatingWalk 
                ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isSimulatingWalk ? (
              <>
                <Pause className="w-3.5 h-3.5" /> Pausar Paseo
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> Simular Paseo
              </>
            )}
          </button>
        </div>

        {/* Botón de Pánico de Alta Prioridad */}
        <button
          onClick={handlePanicClick}
          disabled={panicLoading}
          className={`w-full py-4 rounded-2xl font-extrabold text-lg tracking-wider flex items-center justify-center gap-2 border-2 border-panic bg-panic/20 text-white shadow-glow-red active:scale-95 transition-all duration-300 ${
            panicLoading ? 'animate-pulse opacity-85' : 'hover:bg-panic/40'
          }`}
        >
          <AlertOctagon className="w-6 h-6 animate-bounce" />
          {panicLoading ? 'DESPACHANDO ALERTA...' : 'BOTÓN DE PÁNICO'}
        </button>
      </div>
    </div>
  );
};
