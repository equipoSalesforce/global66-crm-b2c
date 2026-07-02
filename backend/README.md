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

Los endpoints de Casos usan datos mock en esta etapa y no requieren credenciales
ni conexiones a Supabase o Redshift.
