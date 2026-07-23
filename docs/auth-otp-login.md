# Login OTP propio del CRM

## Alcance y seguridad de ambientes

LOCAL, CI y DEV comparten actualmente una misma base. La migración
`202607230001_create_auth_otp_login.sql` es aditiva: crea tablas e índices
nuevos e inserta únicamente valores por defecto en `auth_settings`.

No modifica usuarios existentes, no cambia `ka@test.com`, no crea alias ni
crea usuarios durante la migración. El alias corporativo de Katherine se crea
sólo después de validar correctamente un OTP.

`AUTH_OTP_ENABLED` debe permanecer en `false` hasta que el código y la
migración estén disponibles en el ambiente que se desea habilitar.

## Variables

```dotenv
AUTH_OTP_ENABLED=false
AUTH_ALLOWED_EMAIL_DOMAIN=global66.com
AUTH_DEFAULT_ROLE=AGENT
AUTH_PROFILE_ADMIN_EMAILS=katherine.araya@global66.com

AUTH_BOOTSTRAP_ADMIN_EMAIL=katherine.araya@global66.com
AUTH_BOOTSTRAP_ADMIN_LEGACY_EMAIL=ka@test.com

AUTH_SESSION_DAYS=7
AUTH_OTP_EXPIRES_MINUTES=10
AUTH_OTP_MAX_ATTEMPTS=5
AUTH_OTP_MAX_REQUESTS_PER_EMAIL_PER_WINDOW=1
AUTH_OTP_EMAIL_WINDOW_MINUTES=15
AUTH_OTP_MAX_REQUESTS_PER_EMAIL_PER_DAY=5
AUTH_OTP_MAX_REQUESTS_PER_IP_PER_DAY=3

AUTH_EMAIL_PROVIDER=smtp
AUTH_SMTP_HOST=smtp.gmail.com
AUTH_SMTP_PORT=465
AUTH_SMTP_SECURE=true
AUTH_SMTP_USER=<correo smtp>
AUTH_SMTP_PASSWORD=<app password>
AUTH_SMTP_FROM="CRM Global66 DEV <correo smtp>"
```

Las credenciales SMTP son exclusivamente server-side. No deben usar nombres
`GMAIL_*`, prefijo `NEXT_PUBLIC_` ni almacenarse en el repositorio.

El backend también requiere la configuración server-side de Supabase ya usada
por el proyecto: `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_URL` o
`NEXT_PUBLIC_SUPABASE_URL`.

## Flujo

1. `POST /api/auth/request-code` valida dominio y rate limits.
2. Se genera un código criptográficamente aleatorio de seis dígitos.
3. Sólo se guarda un hash `scrypt` con salt.
4. El código se envía mediante `AUTH_SMTP_*`.
5. `POST /api/auth/verify-code` valida expiración, intentos y hash.
6. Se resuelve un alias o usuario existente; sólo después de un OTP válido se
   crea un usuario nuevo con rol `AGENT`.
7. Se crea un token aleatorio, se guarda sólo su SHA-256 y el token se entrega
   en una cookie `httpOnly`, `sameSite=lax`.
8. La sesión se valida server-side contra `auth_sessions` y `crm_users`.

No se guardan OTP ni tokens de sesión en `localStorage` o en texto plano.

## Comportamiento con el flag apagado

1. Configurar `AUTH_OTP_ENABLED=false`.
2. Reiniciar el servidor Next.js.
3. Abrir `/login`.
4. Confirmar que se muestra el selector demo actual.
5. Seleccionar un usuario y validar que el CRM funcione como antes.

La protección del layout y `proxy.ts` no se activa con el flag apagado.

## Prueba local con OTP

1. Aplicar la migración aditiva en la base compartida.
2. Configurar las variables `AUTH_*` sólo en el ambiente local.
3. Configurar correctamente `SUPABASE_SERVICE_ROLE_KEY`.
4. Cambiar `AUTH_OTP_ENABLED=true` y reiniciar Next.js.
5. Abrir `/login`.
6. Validar:
   - un correo externo es rechazado;
   - un correo `@global66.com` recibe el código;
   - un código incorrecto crea `INVALID_CODE`;
   - el quinto intento crea `MAX_ATTEMPTS_EXCEEDED`;
   - un código vencido crea `EXPIRED_CODE`;
   - los límites por correo e IP responden con mensajes controlados;
   - un OTP correcto crea cookie y sesión;
   - un usuario nuevo se crea como `AGENT`;
   - un usuario `INACTIVE` recibe el mensaje de bloqueo;
   - logout revoca la sesión.

No existe un modo que devuelva el OTP al frontend.

## Katherine y el alias corporativo

Al validar `katherine.araya@global66.com`, el servicio:

1. busca un alias existente;
2. busca el usuario legacy configurado como `ka@test.com`;
3. crea el alias apuntando al mismo `user_id`;
4. conserva sin cambios el email principal legacy;
5. aplica permisos efectivos de administrador por
   `AUTH_PROFILE_ADMIN_EMAILS`;
6. registra `ADMIN_BOOTSTRAPPED`.

SQL de validación:

```sql
select id, email, role, status
from public.crm_users
where lower(email) = 'ka@test.com';

select user_id, email, verified_at
from public.auth_user_email_aliases
where lower(email) = 'katherine.araya@global66.com';

select
  legacy.id as legacy_user_id,
  alias.user_id as alias_user_id,
  legacy.id = alias.user_id as same_user
from public.crm_users legacy
join public.auth_user_email_aliases alias
  on lower(alias.email) = 'katherine.araya@global66.com'
where lower(legacy.email) = 'ka@test.com';

-- Debe devolver cero filas.
select id, email
from public.crm_users
where lower(email) = 'katherine.araya@global66.com';
```

También está disponible
`supabase/validation/validate_auth_otp_login.sql`.

## Rate limit configurable por IP

Consultar el valor:

```sql
select key, value
from public.auth_settings
where key = 'AUTH_OTP_MAX_REQUESTS_PER_IP_PER_DAY';
```

Aumentarlo de forma explícita:

```sql
update public.auth_settings
set value = '10', updated_at = now()
where key = 'AUTH_OTP_MAX_REQUESTS_PER_IP_PER_DAY';
```

Los valores válidos deben ser enteros positivos.

## Activar en DEV

1. Aplicar y validar la migración.
2. Cargar secretos SMTP y service role en el entorno DEV.
3. Mantener inicialmente `AUTH_OTP_ENABLED=false` y desplegar.
4. Verificar health y selector demo.
5. Cambiar explícitamente `AUTH_OTP_ENABLED=true`.
6. Reiniciar/redeployar el runtime.
7. Probar primero el acceso de Katherine y validar el alias.

## Desactivar o revertir

Cambiar `AUTH_OTP_ENABLED=false` y reiniciar/redeployar. El selector demo vuelve
a ser el flujo activo. No es necesario borrar tablas, sesiones, eventos,
usuarios ni alias. No se recomienda revertir la migración en la base compartida.

## Auditoría

`auth_login_events` registra dominio, rate limits, fallos SMTP, códigos
inválidos/expirados, máximo de intentos, usuario desactivado, login, logout y
bootstrap admin. `audit_events` registra creación de usuario, login, logout y
bootstrap.

Las tablas auth tienen RLS habilitado, sin permisos para `PUBLIC`, `anon` ni
`authenticated`. Sólo los servicios server-side con service role acceden a
ellas.
