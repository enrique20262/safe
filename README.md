# SafeCampus UCB - Red de Acompañamiento Digital (Sprint Challenge)

Este repositorio contiene la arquitectura inicial, modelo de datos geoespacial y boilerplates de código para el sprint actual del proyecto **SafeCampus UCB**. La plataforma está diseñada para acompañar digitalmente a estudiantes de la Universidad Católica Boliviana (UCB) en sus rutas nocturnas y despachar alertas de pánico de alta prioridad directamente al centro de monitoreo de seguridad.

---

## 📁 Estructura del Proyecto

El código está dividido en dos partes principales (Frontend y Backend) para asegurar modularidad y separación de responsabilidades:

```
safe-campus-ucb/
├── backend/
│   ├── src/
│   │   ├── middleware/        # Validaciones de JWT y dominios (@ucb.edu.bo)
│   │   ├── repositories/      # Consultas SQL nativas geoespaciales con PostGIS
│   │   ├── socket/            # Controladores en tiempo real (Socket.io)
│   │   └── app.ts             # Punto de entrada de la API Express y Servidor Sockets
│   ├── package.json           # Dependencias y scripts del backend
│   ├── tsconfig.json          # Configuración de compilación TypeScript
│   └── .env.example           # Variables de entorno del backend
└── frontend/
    ├── src/
    │   ├── components/        # Componentes visuales (Mapa de Mapbox GL JS)
    │   ├── hooks/             # Custom hook para gestión de WebSocket en tiempo real
    │   ├── styles/            # Configuración CSS y Tailwind
    │   ├── App.tsx            # Componente de aplicación principal y login institucional
    │   └── main.tsx           # Punto de entrada de React
    ├── package.json           # Dependencias y scripts de React + Vite
    ├── vite.config.ts         # Configuración de Vite (Port 3000)
    ├── tailwind.config.js     # Configuración de diseño y colores nocturnos de Tailwind
    ├── postcss.config.js      # Configuración de procesamiento CSS
    └── .env.example           # Token de Mapbox y URLs del backend
```

---

## 🚀 Guía de Configuración y Ejecución

### Requisitos Previos
- **Node.js** v18+ e **npm**.
- **PostgreSQL** con la extensión **PostGIS** instalada (para persistencia geoespacial de producción).
- Un token de acceso de **Mapbox** (obtenido gratuitamente en [mapbox.com](https://www.mapbox.com/)).

---

### 1. Configuración del Backend

1. Dirígete a la carpeta del servidor:
   ```bash
   cd backend
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Crea tu archivo de entorno y ajusta las credenciales:
   ```bash
   cp .env.example .env
   ```
4. Ejecuta el servidor en modo desarrollo:
   ```bash
   npm run dev
   ```

*El servidor levantará en `http://localhost:4000` exponiendo los endpoints HTTP y el WebSocket Gateway (`ws://localhost:4000`).*

---

### 2. Inicialización de la Base de Datos (PostgreSQL + PostGIS)

Conéctate a tu instancia de base de datos PostgreSQL mediante pgAdmin o psql y ejecuta las siguientes consultas para inicializar las tablas e índices espaciales:

```sql
-- 1. Habilitar la extensión geoespacial PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Tabla de Usuarios
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL CHECK (email LIKE '%@ucb.edu.bo'),
    password_hash VARCHAR(255) NOT NULL,
    google_sub VARCHAR(255) UNIQUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Rutas Activas (Coordenadas en tiempo real de estudiantes)
CREATE TABLE rutas_activas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    origen GEOMETRY(Point, 4326) NOT NULL,
    destino GEOMETRY(Point, 4326) NOT NULL,
    posicion_actual GEOMETRY(Point, 4326) NOT NULL,
    trayecto GEOMETRY(LineString, 4326),
    estado VARCHAR(20) DEFAULT 'activa',
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_rutas_activas_posicion ON rutas_activas USING GIST(posicion_actual);

-- 4. Tabla de Reportes de Zonas de Riesgo de la Comunidad
CREATE TABLE reportes_seguridad (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    tipo_riesgo VARCHAR(50) NOT NULL,
    descripcion TEXT,
    ubicacion GEOMETRY(Point, 4326) NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expira_en TIMESTAMP
);
CREATE INDEX idx_reportes_seguridad_ubicacion ON reportes_seguridad USING GIST(ubicacion);

-- 5. Tabla de Registro de Alertas del Botón de Pánico
CREATE TABLE alertas_panico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    ubicacion GEOMETRY(Point, 4326) NOT NULL,
    estado VARCHAR(20) DEFAULT 'pendiente',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atendida_en TIMESTAMP,
    notas_seguridad TEXT
);
CREATE INDEX idx_alertas_panico_ubicacion ON alertas_panico USING GIST(ubicacion);
```

---

### 3. Configuración del Frontend

1. Dirígete a la carpeta del cliente:
   ```bash
   cd ../frontend
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Crea tu archivo de entorno:
   ```bash
   cp .env.example .env
   ```
4. Reemplaza el token en `VITE_MAPBOX_ACCESS_TOKEN` en tu archivo `.env` recién creado con tu clave pública de Mapbox.
5. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

*El cliente abrirá en `http://localhost:3000` con visualización móvil adaptativa.*

---

## 🛡️ Características Técnicas Destacadas

1. **Restricción de Acceso Institucional (JWT):** El middleware de autenticación del backend intercepta peticiones HTTP y WebSocket validando de forma rigurosa la terminación del correo `@ucb.edu.bo`.
2. **Consultas Geoespaciales en Tiempo Real (PostGIS):** La función `findNearbyStudents` en `geoRepository.ts` utiliza `ST_DWithin` convirtiendo las geometrías a tipo `geography` para calcular distancias en metros de forma precisa, identificando automáticamente a compañeros en la misma ruta en un radio de 400m.
3. **Optimización Nocturna de Mapbox:** La interfaz utiliza el mapa estilizado `mapbox://styles/mapbox/dark-v11` reduciendo drásticamente el brillo en calle e incorporando popups translúcidos premium con Backdrop Blur (Glassmorphism).
4. **Simulación Integrada:** La UI incluye un control "Simular Paseo" que avanza de forma automatizada por coordenadas GPS del campus de la UCB para probar la comunicación Socket.io sin necesidad de salir del laboratorio.
5. **Flujo de Pánico:** El botón de pánico de alta prioridad difunde alertas de inmediato a todos los compañeros activos de la zona, despacha una notificación exclusiva a la central de monitoreo, y deja listos los ganchos de automatización (Google Chat y Google Sheets) vía el **MCP de Google Stitch**.
