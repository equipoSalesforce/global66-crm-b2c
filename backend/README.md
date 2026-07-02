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
