from fastapi import FastAPI

from app.routers import cases, customers, health

app = FastAPI(
    title="Global66 CRM B2C API",
    version="0.1.0",
)

app.include_router(health.router)
app.include_router(customers.router)
app.include_router(cases.router)
