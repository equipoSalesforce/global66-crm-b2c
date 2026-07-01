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
```
