
# Sistema ZAV

### Sistema web y móvil para la gestión de pedidos, inventario y distribución de ZAV

Proyecto de desarrollo de software realizado como Trabajo Final del Diplomado en Desarrollo Web y Aplicaciones Móviles de la Universidad Autónoma Juan Misael Saracho (UAJMS), Tarija, Bolivia, gestión 2026.

---

## 1. Descripción del proyecto

ZAV es un sistema informático web y móvil orientado a integrar la gestión de pedidos, inventario de productos terminados y distribución de la empresa Fiambres y Embutidos ZAV.

El proyecto busca centralizar la información de los procesos comerciales y operativos, facilitando el registro de productos terminados, el control de existencias, los movimientos de inventario, la atención de pedidos y el seguimiento de las entregas.

La solución se desarrolla mediante una aplicación web y una aplicación móvil que comparten una API REST y una base de datos centralizada.

El sistema contempla dos roles internos: Administrador y Vendedor. Ambos podrán acceder a las aplicaciones web y móvil según sus permisos.

Adicionalmente, se contempla un módulo público para consultar información de la empresa, productos, noticias y promociones sin necesidad de iniciar sesión.

La aplicación móvil incorporará funciones de distribución, incluido el registro puntual de la ubicación GPS al confirmar las entregas.

### Alcance funcional

El desarrollo se centra en los siguientes módulos:

- Autenticación y control de acceso por roles.
- Gestión de clientes y pedidos.
- Registro de productos terminados y lotes.
- Control de existencias y movimientos de inventario.
- Registro de entradas, traslados y salidas de productos.
- Gestión y seguimiento de la distribución.
- Registro de entregas con ubicación GPS.
- Consulta pública de productos, noticias y promociones.

El inventario comprende productos terminados en las áreas de Producción y Almacenamiento y Venta y Despacho.

### Límites del proyecto

Esta versión no contempla la gestión de materias primas, recetas, proveedores, compras, costos de producción, pagos ni facturación fiscal.

Tampoco incluye seguimiento GPS continuo, optimización automática de rutas ni integración automática con servicios de mensajería.

---

## 2. Arquitectura del sistema

El proyecto se organiza como un monorepo, con tres aplicaciones independientes que comparten una estructura de trabajo y un único gestor de dependencias.

```text
                  ┌─────────────────────┐
                  │   Aplicación web    │
                  │   Next.js + React   │
                  └──────────┬──────────┘
                             │
                             │ HTTPS / JSON
                             │
┌─────────────────────┐      │
│  Aplicación móvil   │      │
│ React Native + Expo │      │
└──────────┬──────────┘      │
           │                 │
           │ HTTPS / JSON    │
           │                 │
           ▼                 ▼
      ┌──────────────────────────┐
      │         API REST         │
      │     NestJS + Node.js     │
      │                          │
      │ Reglas de negocio y      │
      │ control de acceso        │
      └────────────┬─────────────┘
                   │
                   │ Conexión PostgreSQL
                   │
                   ▼
      ┌──────────────────────────┐
      │        PostgreSQL        │
      │     Base de datos        │
      │       centralizada       │
      └──────────────────────────┘
```

**Estado de la arquitectura:** las aplicaciones web, móvil y backend cuentan con su configuración inicial. La conexión con PostgreSQL y las funcionalidades empresariales se incorporarán durante el desarrollo.

La aplicación web y la aplicación móvil consumirán una misma API para mantener centralizadas las reglas de negocio y la información del sistema.

---

## 3. Tecnologías utilizadas

### Aplicación web

| Tecnología | Función |
|---|---|
| Next.js 16.3.5 | Framework de desarrollo web |
| React 19.2.8 | Construcción de interfaces |
| TypeScript | Desarrollo con tipado estático |
| Tailwind CSS | Estilos de la interfaz |
| App Router | Navegación y organización de páginas |
| ESLint | Análisis estático del código |

Directorio: `apps/web`

### Aplicación móvil

| Tecnología | Función |
|---|---|
| React Native 0.86.3 | Desarrollo de la aplicación móvil |
| Expo SDK 57 | Herramientas y entorno de desarrollo |
| React | Construcción de interfaces móviles |
| TypeScript | Desarrollo con tipado estático |
| Expo Router | Navegación entre pantallas |
| Expo Go | Ejecución durante el desarrollo en Android |
| Metro Bundler | Empaquetado de la aplicación |

Directorio: `apps/mobile`

La captura de ubicación GPS se implementará mediante las capacidades de geolocalización del dispositivo móvil, solicitando los permisos correspondientes.

### Backend y API

| Tecnología | Función |
|---|---|
| NestJS 12 | Framework del backend |
| Node.js 24 | Entorno de ejecución |
| TypeScript | Lenguaje principal |
| Express | Servidor HTTP utilizado por NestJS |
| Vitest | Pruebas automatizadas |
| Supertest | Pruebas de endpoints HTTP |
| Oxlint | Análisis estático del código |
| Prettier | Formato del código |

Directorio: `apps/api`

### Base de datos y despliegue

| Tecnología o servicio | Función |
|---|---|
| PostgreSQL | Base de datos relacional |
| Neon | Alojamiento de PostgreSQL |
| Vercel | Despliegue de la aplicación web |
| Render | Despliegue de la API |

La conexión con la base de datos y la publicación del sistema forman parte de las siguientes etapas de implementación.

### Herramientas de desarrollo

- Visual Studio Code.
- Git y GitHub.
- pnpm Workspaces.
- PowerShell.
- Trello para la gestión de tareas mediante Kanban.

Las versiones específicas de las dependencias se encuentran registradas en los archivos `package.json` y en el archivo `pnpm-lock.yaml`.

---

## 4. Estructura del repositorio

```text
zav-sistema/
│
├── apps/
│   ├── web/                  # Aplicación web Next.js
│   ├── mobile/               # Aplicación móvil Expo
│   └── api/                  # Backend NestJS
│
├── packages/                 # Código compartido
│
├── docs/                     # Documentación técnica
│   └── licencias/
│
├── .vscode/                  # Configuración del editor
│
├── .gitignore                # Archivos excluidos de Git
├── .gitattributes            # Configuración de atributos Git
│
├── package.json              # Configuración del monorepo
├── pnpm-workspace.yaml       # Definición de los workspaces
├── pnpm-lock.yaml            # Registro de dependencias
│
└── README.md                 # Documentación principal
```

La organización permite desarrollar las aplicaciones de forma independiente y mantener un backend común para las operaciones del sistema.

---

## 5. Requisitos del entorno

Para ejecutar el proyecto en desarrollo se requiere:

| Herramienta | Versión utilizada |
|---|---|
| Node.js | 24.20.0 |
| pnpm | 12.4.2 |
| npm | 11.19.0 |
| Git | Instalación compatible con el entorno |
| Editor | Visual Studio Code u otro editor compatible |

Para ejecutar la aplicación móvil en un dispositivo físico se utiliza Android con Expo Go.

Las pruebas iniciales se realizan en un entorno de desarrollo Windows mediante PowerShell.

---

## 6. Instalación del proyecto

### 6.1. Clonar el repositorio

```bash
git clone https://github.com/RubenMealla/zav-sistema.git
```

Ingresar al directorio del proyecto:

```bash
cd zav-sistema
```

### 6.2. Instalar las dependencias

Ejecutar desde la raíz:

```bash
pnpm install
```

pnpm instalará las dependencias de las aplicaciones definidas en el workspace.

Para comprobar las versiones del entorno:

```bash
node --version
pnpm --version
```

---

## 7. Ejecución de las aplicaciones

Cada aplicación se ejecuta de manera independiente desde la raíz del repositorio.

### 7.1. Aplicación web

Iniciar el servidor de desarrollo:

```bash
pnpm --filter @zav/web dev
```

Abrir en el navegador:

http://localhost:3000

Para generar una compilación de producción:

```bash
pnpm --filter @zav/web build
```

### 7.2. Aplicación móvil

Iniciar Expo:

```bash
pnpm --filter @zav/mobile start
```

Expo iniciará Metro Bundler y mostrará un código QR en la terminal.

Para ejecutar la aplicación en Android:

1. Instalar Expo Go en el dispositivo.
2. Conectar el teléfono y el equipo de desarrollo a una red compatible.
3. Abrir Expo Go y escanear el código QR.
4. Esperar a que se cargue la aplicación.

Para iniciar la versión web de la aplicación móvil:

```bash
pnpm --filter @zav/mobile web
```

La versión web de Expo se utiliza como herramienta de desarrollo y no sustituye a la aplicación web principal desarrollada con Next.js.

### 7.3. Backend

Iniciar la API en modo desarrollo:

```bash
pnpm --filter @zav/api start:dev
```

La API utiliza inicialmente el puerto 3001:

http://localhost:3001

El puerto puede modificarse mediante la variable de entorno `PORT`.

La API cuenta actualmente con el endpoint inicial generado por NestJS. Las rutas correspondientes a los módulos empresariales se incorporarán durante el desarrollo.

---

## 8. Variables de entorno

El backend dispone de un archivo de configuración de ejemplo:

`apps/api/.env.example`

Este archivo documenta las variables necesarias para el entorno local.

Para preparar la configuración de desarrollo, copiarlo dentro de `apps/api` con el nombre `.env` y completar los valores correspondientes.

Ejemplo:

```dotenv
NODE_ENV=development
PORT=3001

DATABASE_URL=postgresql://usuario:contrasena@localhost:5432/zav_db

WEB_ORIGIN=http://localhost:3000
```

Los valores mostrados son únicamente ejemplos.

Actualmente, el backend utiliza la variable `PORT`. La carga de archivos `.env`, la conexión con PostgreSQL y la configuración de CORS deberán implementarse y verificarse durante el desarrollo.

**Seguridad:** no incorporar al repositorio archivos `.env`, contraseñas reales, tokens, claves privadas ni cadenas de conexión que contengan credenciales.

El archivo `.gitignore` excluye los archivos de entorno y permite conservar los archivos de ejemplo sin información sensible.

---

## 9. Comprobaciones y pruebas

### Aplicación web

Ejecutar el análisis estático:

```bash
pnpm --filter @zav/web lint
```

Generar la compilación:

```bash
pnpm --filter @zav/web build
```

### Aplicación móvil

Ejecutar ESLint:

```bash
pnpm --filter @zav/mobile lint
```

Comprobar TypeScript:

```bash
pnpm --filter @zav/mobile exec tsc --noEmit
```

Ejecutar Expo Doctor:

```bash
cd apps/mobile
npx expo-doctor
```

El diagnóstico permite comprobar la compatibilidad de las dependencias con el SDK de Expo instalado.

### Backend

Ejecutar el análisis estático:

```bash
pnpm --filter @zav/api lint
```

Compilar la aplicación:

```bash
pnpm --filter @zav/api build
```

Ejecutar las pruebas unitarias:

```bash
pnpm --filter @zav/api test
```

Ejecutar las pruebas de extremo a extremo:

```bash
pnpm --filter @zav/api test:e2e
```

Los resultados iniciales corresponden a la configuración base de las aplicaciones. Las pruebas funcionales del sistema ZAV se incorporarán conforme se desarrollen los módulos empresariales.

---

## 10. Metodología y seguimiento del desarrollo

El proyecto utiliza Kanban como metodología de organización y seguimiento del trabajo.

Las actividades se gestionan mediante un tablero en Trello, estructurado en cinco columnas:

1. Pendiente.
2. Por realizar.
3. En desarrollo.
4. En verificación.
5. Terminado.

Se establece un límite de dos tareas simultáneas en la columna En desarrollo.

Cada actividad se documenta mediante sus criterios de aceptación, estado de ejecución y evidencias correspondientes.

El desarrollo del software utiliza Git para el control de versiones y GitHub para el almacenamiento del repositorio, la gestión de ramas y la integración de cambios mediante Pull Requests.

### Tablero Kanban

[ZAV 2026 - Desarrollo del sistema](https://trello.com/b/Tn5elZCY/zav-2026-desarrollo-del-sistema-kanban)

### Repositorio GitHub

[Repositorio del sistema ZAV](https://github.com/RubenMealla/zav-sistema)

---

## 11. Estado actual del proyecto

### Configuración inicial

- Monorepo configurado mediante pnpm Workspaces.
- Aplicación web inicializada con Next.js y TypeScript.
- Aplicación móvil inicializada con React Native y Expo.
- Backend inicializado con NestJS y TypeScript.
- Repositorio Git configurado y publicado en GitHub.
- Configuración inicial de análisis estático, compilación y pruebas.
- Corrección de dependencias de la aplicación móvil para Expo SDK 57.

### Comprobaciones realizadas

- Aplicación web: ESLint y compilación de producción completados correctamente.
- Aplicación móvil: ESLint y TypeScript comprobados correctamente.
- Expo Doctor: 21 de 21 comprobaciones superadas después de actualizar las dependencias.
- Ejecución de la aplicación móvil en Android físico mediante Expo Go, con navegación inicial sin errores observados.
- Backend: compilación y análisis estático completados.
- Backend: prueba unitaria inicial y prueba E2E del endpoint de ejemplo superadas.

### Desarrollo pendiente

- Implementación de la autenticación y los permisos.
- Conexión del backend con PostgreSQL.
- Implementación de los módulos de productos, lotes e inventario.
- Registro y seguimiento de pedidos.
- Gestión de movimientos de inventario.
- Integración de las aplicaciones web y móvil con la API.
- Implementación de la distribución y el registro GPS.
- Pruebas funcionales, de integración y seguridad.
- Despliegue y verificación del sistema.

Las funcionalidades se considerarán implementadas una vez que hayan sido desarrolladas y verificadas mediante las pruebas correspondientes.

---

## 12. Información académica

| Dato | Información |
|---|---|
| Proyecto | Sistema web y móvil para la gestión de pedidos, inventario y distribución de ZAV |
| Institución | Universidad Autónoma Juan Misael Saracho |
| Unidad académica | Dirección de Posgrado |
| Programa | Diplomado en Desarrollo Web y Aplicaciones Móviles |
| Modalidad del trabajo | Trabajo Final de Diplomado — Monografía y desarrollo de software |
| Empresa objeto de estudio | Fiambres y Embutidos ZAV |
| Lugar | Tarija, Bolivia |
| Gestión | 2026 |

---

## 13. Autor

**Rubén Darío Mealla Lerma**

Diplomado en Desarrollo Web y Aplicaciones Móviles

Universidad Autónoma Juan Misael Saracho

Tarija, Bolivia — 2026
