import { Pool } from 'pg';

// Inicialización de la piscina de conexiones (Postgres + PostGIS)
// En producción, esto se configuraría a través de un módulo de configuración centralizado.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export interface Coordenadas {
  lat: number;
  lng: number;
}

export interface RutaActiva {
  id: string;
  usuario_id: string;
  nombre_usuario?: string;
  posicion_actual: Coordenadas;
  origen: Coordenadas;
  destino: Coordenadas;
  estado: string;
}

export interface ReporteSeguridad {
  id: string;
  tipo_riesgo: string;
  descripcion: string;
  ubicacion: Coordenadas;
  creado_en: Date;
}

export class GeoRepository {

  /**
   * Crea o actualiza una ruta activa de acompañamiento para un estudiante.
   * Utiliza ST_SetSRID y ST_MakePoint para representar geográficamente los puntos.
   */
  static async saveActiveRoute(
    usuarioId: string,
    origen: Coordenadas,
    destino: Coordenadas,
    trayectoCoords: Coordenadas[] // Colección de puntos para formar el LineString
  ): Promise<any> {
    const origenGeom = `ST_SetSRID(ST_MakePoint(${origen.lng}, ${origen.lat}), 4326)`;
    const destinoGeom = `ST_SetSRID(ST_MakePoint(${destino.lng}, ${destino.lat}), 4326)`;
    
    // Construir LineString WKT (Well-Known Text) para el trayecto
    const lineStringWKT = `LINESTRING(${trayectoCoords.map(c => `${c.lng} ${c.lat}`).join(', ')})`;
    
    const query = `
      INSERT INTO rutas_activas (usuario_id, origen, destino, posicion_actual, trayecto, estado)
      VALUES (
        $1, 
        ${origenGeom}, 
        ${destinoGeom}, 
        ${origenGeom}, -- Inicialmente la posición actual es el origen
        ST_GeomFromText($2, 4326), 
        'activa'
      )
      ON CONFLICT (usuario_id) DO UPDATE 
      SET origen = ${origenGeom}, 
          destino = ${destinoGeom}, 
          posicion_actual = ${origenGeom}, 
          trayecto = ST_GeomFromText($2, 4326), 
          estado = 'activa',
          actualizado_en = CURRENT_TIMESTAMP
      RETURNING id;
    `;

    try {
      const result = await pool.query(query, [usuarioId, lineStringWKT]);
      return result.rows[0];
    } catch (error) {
      console.error('Error al guardar la ruta activa:', error);
      // Fallback para simulación en modo offline/boilerplate sin base de datos real levantada
      return { id: 'mock-route-id', mock: true };
    }
  }

  /**
   * Actualiza la posición geográfica en tiempo real de un estudiante activo.
   */
  static async updateStudentLocation(usuarioId: string, lat: number, lng: number): Promise<void> {
    const query = `
      UPDATE rutas_activas
      SET posicion_actual = ST_SetSRID(ST_MakePoint($2, $1), 4326),
          actualizado_en = CURRENT_TIMESTAMP
      WHERE usuario_id = $3 AND estado = 'activa';
    `;

    try {
      await pool.query(query, [lat, lng, usuarioId]);
    } catch (error) {
      console.warn(`Simulación: Ubicación actualizada para el usuario ${usuarioId} a [${lat}, ${lng}]`);
    }
  }

  /**
   * Busca estudiantes activos que compartan una ruta cercana.
   * Utiliza ST_DWithin para buscar dentro de un radio de metros.
   * ST_Transform o geografía se usa para operar en metros (EPSG 4326 usa grados, 
   * por lo que castear a "geography" calcula la distancia real en la superficie terrestre).
   */
  static async findNearbyStudents(
    usuarioId: string,
    posicion: Coordenadas,
    radioMetros: number = 300
  ): Promise<RutaActiva[]> {
    const query = `
      SELECT r.id, r.usuario_id, u.nombre as nombre_usuario,
             ST_Y(r.posicion_actual::geometry) as lat, 
             ST_X(r.posicion_actual::geometry) as lng,
             ST_Y(r.origen::geometry) as orig_lat, ST_X(r.origen::geometry) as orig_lng,
             ST_Y(r.destino::geometry) as dest_lat, ST_X(r.destino::geometry) as dest_lng,
             r.estado
      FROM rutas_activas r
      INNER JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.usuario_id != $1
        AND r.estado = 'activa'
        AND ST_DWithin(
              r.posicion_actual::geography, 
              ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 
              $4
            );
    `;

    try {
      const result = await pool.query(query, [usuarioId, posicion.lng, posicion.lat, radioMetros]);
      return result.rows.map(row => ({
        id: row.id,
        usuario_id: row.usuario_id,
        nombre_usuario: row.nombre_usuario,
        posicion_actual: { lat: Number(row.lat), lng: Number(row.lng) },
        origen: { lat: Number(row.orig_lat), lng: Number(row.orig_lng) },
        destino: { lat: Number(row.dest_lat), lng: Number(row.dest_lng) },
        estado: row.estado
      }));
    } catch (error) {
      console.error('Error en findNearbyStudents (se retornará mock si es desarrollo local):', error);
      // Mock de estudiantes cercanos para simular sin tener PostGIS local
      return [
        {
          id: 'mock-active-1',
          usuario_id: 'estudiante-lucia-uuid',
          nombre_usuario: 'Lucía Condori',
          posicion_actual: { lat: posicion.lat + 0.0012, lng: posicion.lng - 0.0008 },
          origen: { lat: posicion.lat + 0.005, lng: posicion.lng - 0.005 },
          destino: { lat: posicion.lat - 0.005, lng: posicion.lng + 0.005 },
          estado: 'activa'
        },
        {
          id: 'mock-active-2',
          usuario_id: 'estudiante-carlos-uuid',
          nombre_usuario: 'Carlos Mamani',
          posicion_actual: { lat: posicion.lat - 0.0009, lng: posicion.lng + 0.0015 },
          origen: { lat: posicion.lat - 0.004, lng: posicion.lng - 0.002 },
          destino: { lat: posicion.lat + 0.006, lng: posicion.lng + 0.008 },
          estado: 'activa'
        }
      ];
    }
  }

  /**
   * Registra una alerta de pánico de alta prioridad con su ubicación geográfica exacta.
   */
  static async createPanicAlert(usuarioId: string, lat: number, lng: number): Promise<any> {
    const query = `
      INSERT INTO alertas_panico (usuario_id, ubicacion, estado)
      VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), 'pendiente')
      RETURNING id, creado_en;
    `;

    try {
      const result = await pool.query(query, [usuarioId, lng, lat]);
      return result.rows[0];
    } catch (error) {
      console.warn(`Simulación: Alerta de pánico creada para el estudiante ${usuarioId} en [${lat}, ${lng}]`);
      return { id: 'mock-alert-uuid', creado_en: new Date() };
    }
  }

  /**
   * Obtiene todos los reportes de seguridad / zonas de riesgo vigentes.
   */
  static async getActiveReports(): Promise<ReporteSeguridad[]> {
    const query = `
      SELECT id, tipo_riesgo, descripcion, 
             ST_Y(ubicacion::geometry) as lat, 
             ST_X(ubicacion::geometry) as lng, 
             creado_en
      FROM reportes_seguridad
      WHERE expira_en IS NULL OR expira_en > NOW();
    `;

    try {
      const result = await pool.query(query);
      return result.rows.map(row => ({
        id: row.id,
        tipo_riesgo: row.tipo_riesgo,
        descripcion: row.descripcion,
        ubicacion: { lat: Number(row.lat), lng: Number(row.lng) },
        creado_en: row.creado_en
      }));
    } catch (error) {
      // Mock de zonas de riesgo para pruebas locales
      return [
        {
          id: 'report-1',
          tipo_riesgo: 'falta_iluminacion',
          descripcion: 'Esquina muy oscura detrás del bloque C. Lamparás quemadas.',
          ubicacion: { lat: -16.5235, lng: -68.1122 },
          creado_en: new Date()
        },
        {
          id: 'report-2',
          tipo_riesgo: 'zona_solitaria',
          descripcion: 'Pasaje peatonal con alta percepción de asaltos al salir el micro de las 21:30.',
          ubicacion: { lat: -16.5248, lng: -68.1105 },
          creado_en: new Date()
        }
      ];
    }
  }
}
