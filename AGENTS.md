<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Global66 CRM B2C

## Contexto del proyecto

- Este repositorio es la base oficial del CRM B2C de Global66, con funcionalidades similares a Salesforce Service Cloud.
- El frontend actual usa Next.js y TypeScript.
- La aplicación funciona actualmente en Vercel y se preparará para una migración gradual a AWS.
- La data transaccional del cliente vivirá en Redshift, pero todavía no existen usuario ni credenciales disponibles.
- El desarrollo de código se realiza en macOS. El despliegue a AWS se hará posteriormente desde Windows y con la cuenta corporativa.

## Restricciones vigentes

- No trabajar directamente sobre `main`. Usar siempre la rama de trabajo actual.
- No conectar Redshift hasta que el equipo entregue acceso y defina el contrato de integración.
- No modificar Terraform, infraestructura ni recursos de AWS en esta etapa.
- No modificar el composer de correo, los templates de correo, la IA de correo ni la integración de Aircall, salvo que una tarea futura lo autorice explícitamente.
- No crear, modificar ni versionar archivos `.env` reales.
- No incluir secretos, tokens, credenciales ni valores sensibles en el código, fixtures, logs o documentación.
- Preservar cambios preexistentes del usuario en el worktree que no pertenezcan a la tarea activa.

## Arquitectura y diseño

- Mantener el frontend desacoplado del backend y de proveedores concretos de persistencia.
- Separar componentes visuales, tipos, servicios y endpoints.
- Los componentes React deben concentrarse en presentación e interacción; no colocar en ellos consultas directas, integraciones ni lógica pesada de negocio nueva.
- Encapsular el acceso a datos e integraciones en servicios con contratos tipados para facilitar el reemplazo gradual de Supabase/Vercel por servicios desplegados en AWS.
- Mantener los Route Handlers del App Router como capa HTTP delgada: validación, autorización, invocación de servicios y traducción de respuestas.
- No mezclar tipos de dominio con props puramente visuales. Ubicar los tipos compartidos fuera de los componentes que los consumen.
- Evitar dependencias de infraestructura en la UI. El frontend debe consumir contratos estables sin conocer Redshift, AWS ni detalles de almacenamiento.
- Antes de cambiar código de Next.js, leer la guía relevante incluida en `node_modules/next/dist/docs/` y respetar sus APIs y avisos de deprecación.

## Alcance de la migración

- La migración será incremental; no asumir un reemplazo completo de la arquitectura actual en una sola tarea.
- Hasta nuevo aviso, conservar el comportamiento funcional existente y no introducir conexiones simuladas o reales a Redshift.
- Cualquier adaptador futuro de datos debe permitir desarrollo y pruebas sin credenciales productivas.
- Los cambios de infraestructura, Terraform, credenciales y despliegue AWS quedan fuera de alcance hasta autorización explícita.

## Validación y entrega

- Ejecutar `npm run lint` si el script existe.
- Ejecutar `npm run build` antes de terminar cualquier tarea con cambios.
- Informar los archivos modificados y el resultado de cada validación.
- Informar errores preexistentes o bloqueos de entorno sin ocultarlos ni corregir fuera del alcance solicitado.
- No realizar cambios funcionales, de rutas, componentes o endpoints cuando la tarea sea exclusivamente de análisis o documentación.
