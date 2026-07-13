# Global66 CRM B2C API

Base FastAPI para la futura lógica de negocio y capa de datos del CRM. En esta
etapa, Cliente 360 utiliza datos mock y no establece conexiones con Redshift.

## Ejecución local

Desde la raíz del repositorio:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

En Windows, activa el entorno virtual con `.venv\Scripts\activate`.

Prueba los endpoints:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/customers/demo-customer/summary
curl http://localhost:8000/cases
curl http://localhost:8000/cases/demo-case-001
curl http://localhost:8000/accounts/DEMO-CUSTOMER-001/360
curl http://localhost:8000/accounts/DEMO-CUSTOMER-001/products/compras_tarjeta
```

La lista acepta los filtros `status`, `lifecycle_status`, `routing_status`,
`assigned_agent_id`, `customer_id` y `channel`, además de paginación con `limit`
y `offset`. Por ejemplo:

```bash
curl "http://localhost:8000/cases?status=ASSIGNED&channel=WHATSAPP&limit=20&offset=0"
```

## Fuente de datos de Casos

El modo mock está activo por defecto y no requiere credenciales:

```dotenv
CASES_USE_MOCK_DATA=true
```

Para habilitar lectura real desde Supabase, configura estas variables en tu
archivo local `backend/.env` y reinicia Uvicorn:

```dotenv
CASES_USE_MOCK_DATA=false
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

No agregues valores reales al repositorio. Si falta la URL o la clave, Casos usa
automáticamente el repositorio mock aunque `CASES_USE_MOCK_DATA` sea `false`.
Cuando el modo real está correctamente configurado, una falla de Supabase genera
una respuesta controlada `502`; no cambia silenciosamente a datos mock.

La lectura real consulta los campos definidos por `CaseSummary` y `CaseDetail`,
incluida la relación `customer:customers(name,email,phone)`. Los campos ausentes o
nulos en un registro se devuelven como `null`, excepto `id`, que es obligatorio y
se normaliza como texto. Esta etapa no consulta Redshift ni habilita mutaciones.

## Account 360

Account 360 usa un mock completo por defecto, sin conectarse a AWS ni Redshift:

```dotenv
ACCOUNT_360_USE_MOCK_DATA=true
```

En este modo no se inicializa Redshift Data API, no se requieren variables
`REDSHIFT_*` ni credenciales AWS, y cualquier ID solicitado devuelve la cuenta
canónica `DEMO-CUSTOMER-001`. El fixture incluye perfil, billeteras, productos,
resumen transaccional y cinco transacciones recientes, con
`data_source="mock"`.

Para habilitar el perfil base desde Redshift Data API, configura localmente:

```dotenv
ACCOUNT_360_USE_MOCK_DATA=false
AWS_REGION=
REDSHIFT_ACCESS_MODE=data_api
REDSHIFT_CLUSTER_IDENTIFIER=
REDSHIFT_DATABASE=
REDSHIFT_SECRET_ARN=
REDSHIFT_DATA_API_POLL_INTERVAL_SECONDS=0.5
REDSHIFT_DATA_API_TIMEOUT_SECONDS=30
```

`REDSHIFT_SECRET_ARN` es obligatorio para activar este primer corte real. Las
credenciales AWS se resuelven mediante la cadena estándar de `boto3` y nunca deben
guardarse en el repositorio. En modo real, una configuración esencial incompleta
o un error en la consulta principal produce un `502` controlado, sin exponer
detalles sensibles ni el ARN.

`ACCOUNT_360_USE_MOCK_DATA` es el único interruptor que habilita datos demo. Si
su valor es `false`, una configuración incompleta o una falla de Redshift produce
un error controlado y nunca cambia silenciosamente al perfil mock. Reinicia
Uvicorn después de modificar variables, porque el repositorio se selecciona al
iniciar la aplicación.

La consulta principal usa `customer.customer` y filtra `customer_id` mediante el
parámetro `:account_id` de Redshift Data API. Lee `customer_id`, `email`, `country`,
`id_number`, `id_type`, `last_name`, `name`, `calling_code`, `phone_number`,
`username`, `is_company`, `kyc_stage_1`, `kyc_stage_2`,
`kyc_stage_3`, `compliance_status` y `nationality`. Estas columnas reemplazan el
perfil base. Si el cliente no existe en modo real, el endpoint responde `404`; no
se inventa una identidad mock.

Después de encontrar el perfil, Account 360 intenta enriquecerlo con consultas
independientes: la segmentación desde `customer.segmentation`; el plan activo desde `subscription.subscription`,
`subscription.plan_country` y `subscription.plan_locale`; los últimos cinco
movimientos y el conteo histórico desde `transaction.transaction`; y la versión de
app/dispositivo desde `customer.device_info`. Todas usan `:account_id` como
parámetro. Una falla secundaria se registra sin datos sensibles y deja solamente
esa sección vacía o con `—`; no invalida el perfil existente. Las transacciones
recientes alimentan la actividad unificada. El conteo histórico queda disponible
en `metrics.transactions_count`.

Productos se obtiene de `datawarehouse.b2x_products.fact_transaction`, unido por
`product_id` con `datawarehouse.dimension.dim_product`. La consulta trae hasta 200
movimientos recientes y los agrupa por `product_family`; cada grupo incluye conteo,
suma de `origin_amount_usd`, última fecha y sus transacciones ordenadas. Si esta
consulta complementaria falla, el perfil sigue respondiendo y `products` queda
vacío, sin recuperar productos demo silenciosamente.

Billeteras, historial KYC, beneficios, términos y los demás módulos aún sin fuente
confirmada siguen siendo complemento mock. La respuesta se identifica con
`data_source=redshift_partial` mientras dure esta integración progresiva.

Ejemplos:

```bash
curl http://localhost:8000/accounts/DEMO-CUSTOMER-001/360
curl http://localhost:8000/accounts/DEMO-CUSTOMER-001/products/compras_tarjeta
```

La respuesta de `/accounts/{account_id}/360` expone Remesa, P2P, Exchange, Pagos y
Compras tarjeta con el contrato `code`, `label`, `family`, `movement_count`,
`volume_usd`, `last_transaction_at` y `transactions`. Familias nuevas se publican
con un código estable y un label humanizado, sin requerir cambios en el endpoint.
