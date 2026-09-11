import os
import uuid
import secrets
import logging
import hashlib
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

import jwt
import requests as http_requests
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from pwdlib import PasswordHash


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------- Setup ----------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

password_hash = PasswordHash.recommended()
bearer = HTTPBearer(auto_error=False)

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ISSUER = os.getenv("JWT_ISSUER", "refugio-beleza-api")
ACCESS_MINUTES = int(os.getenv("ACCESS_MINUTES", "10080"))

# Emergent Object Storage
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "refugio-da-beleza"
_storage_key: Optional[str] = None


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def init_storage() -> Optional[str]:
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_KEY:
        return None
    try:
        resp = http_requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        _storage_key = resp.json()["storage_key"]
        return _storage_key
    except Exception as e:
        logger.warning("Storage init failed: %s", e)
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise RuntimeError("Storage unavailable")
    resp = http_requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    if not key:
        raise RuntimeError("Storage unavailable")
    resp = http_requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------- Models ----------
class RegisterBody(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=8, max_length=30)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    lgpd_accepted: bool


class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ForgotBody(BaseModel):
    email: EmailStr


class UserOut(BaseModel):
    id: str
    name: str
    phone: str
    email: EmailStr
    photo_path: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None


class ServiceOut(BaseModel):
    id: str
    category: str
    name: str
    description: str
    duration_min: int
    price: float
    image_url: Optional[str] = None
    featured: bool = False


class ProfessionalOut(BaseModel):
    id: str
    name: str
    specialties: List[str]
    photo_url: Optional[str] = None


class AppointmentCreate(BaseModel):
    service_ids: List[str] = Field(min_length=1)
    professional_id: Optional[str] = None  # None means no preference
    date: str  # YYYY-MM-DD
    time: str  # HH:MM


class AppointmentOut(BaseModel):
    id: str
    user_id: str
    services: List[ServiceOut]
    professional: Optional[ProfessionalOut]
    date: str
    time: str
    total_duration_min: int
    total_price: float
    status: str  # scheduled, cancelled, done
    created_at: datetime


# ---------- Auth utils ----------
def create_access_token(user_id: str) -> str:
    return jwt.encode(
        {
            "sub": user_id,
            "type": "access",
            "iss": JWT_ISSUER,
            "iat": now_utc(),
            "exp": now_utc() + timedelta(minutes=ACCESS_MINUTES),
        },
        JWT_SECRET,
        algorithm="HS256",
    )


async def current_user(request: Request, creds: HTTPAuthorizationCredentials = Depends(bearer)):
    if not creds or creds.scheme.lower() != "bearer":
        raise HTTPException(401, "Unauthorized")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"], issuer=JWT_ISSUER)
        if payload.get("type") != "access" or not payload.get("sub"):
            raise ValueError()
    except Exception:
        raise HTTPException(401, "Unauthorized")
    user = await request.app.state.db.users.find_one({"_id": payload["sub"]}, {"password_hash": 0})
    if not user:
        raise HTTPException(401, "Unauthorized")
    return user


def user_to_out(u: dict) -> UserOut:
    return UserOut(
        id=u["_id"], name=u["name"], phone=u["phone"], email=u["email"], photo_path=u.get("photo_path"),
    )


# ---------- Seed data ----------
SEED_SERVICES = [
    # Cabelo
    {"category": "Cabelo", "name": "Corte Feminino", "description": "Corte moderno e personalizado para o seu estilo.", "duration_min": 60, "price": 90.0, "featured": True,
     "image_url": "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80"},
    {"category": "Cabelo", "name": "Escova Modeladora", "description": "Escova com finalização e brilho intenso.", "duration_min": 45, "price": 70.0, "featured": True,
     "image_url": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80"},
    {"category": "Cabelo", "name": "Progressiva / Alisamento", "description": "Alisamento profissional com tratamento capilar.", "duration_min": 180, "price": 350.0,
     "image_url": "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?auto=format&fit=crop&w=800&q=80"},
    {"category": "Cabelo", "name": "Coloração", "description": "Coloração completa com produtos premium.", "duration_min": 120, "price": 220.0,
     "image_url": "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=800&q=80"},
    {"category": "Cabelo", "name": "Hidratação Profunda", "description": "Tratamento restaurador de brilho e maciez.", "duration_min": 60, "price": 120.0,
     "image_url": "https://images.unsplash.com/photo-1519415387722-a1c3bbef716c?auto=format&fit=crop&w=800&q=80"},
    {"category": "Cabelo", "name": "Cuidados Cachos", "description": "Corte, hidratação e finalização para cabelos cacheados.", "duration_min": 90, "price": 150.0, "featured": True,
     "image_url": "https://images.unsplash.com/photo-1580618864194-1d3e6c88a41d?auto=format&fit=crop&w=800&q=80"},
    # Unhas
    {"category": "Unhas", "name": "Manicure", "description": "Cutilagem e esmaltação impecável.", "duration_min": 45, "price": 50.0, "featured": True,
     "image_url": "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=80"},
    {"category": "Unhas", "name": "Pedicure", "description": "Cuidado completo para seus pés.", "duration_min": 60, "price": 60.0,
     "image_url": "https://images.unsplash.com/photo-1610992015762-45dca7a58fc4?auto=format&fit=crop&w=800&q=80"},
    {"category": "Unhas", "name": "Esmaltação em Gel", "description": "Durabilidade e brilho por semanas.", "duration_min": 60, "price": 85.0,
     "image_url": "https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=800&q=80"},
    # Depilação
    {"category": "Depilação", "name": "Depilação Pernas Inteiras", "description": "Cera quente com produtos hipoalergênicos.", "duration_min": 45, "price": 80.0,
     "image_url": "https://images.unsplash.com/photo-1519415943484-9fa1873496d4?auto=format&fit=crop&w=800&q=80"},
    {"category": "Depilação", "name": "Depilação Axilas", "description": "Rápida, suave e duradoura.", "duration_min": 15, "price": 25.0,
     "image_url": "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=800&q=80"},
    {"category": "Depilação", "name": "Depilação Buço", "description": "Detalhe fino para um acabamento perfeito.", "duration_min": 10, "price": 20.0,
     "image_url": "https://images.unsplash.com/photo-1596178060810-72c6de7c95d2?auto=format&fit=crop&w=800&q=80"},
]

SEED_PROFESSIONALS = [
    {"name": "Camila Rocha", "specialties": ["Cabelo", "Coloração"],
     "photo_url": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80"},
    {"name": "Juliana Alves", "specialties": ["Unhas"],
     "photo_url": "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80"},
    {"name": "Beatriz Souza", "specialties": ["Depilação", "Unhas"],
     "photo_url": "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=400&q=80"},
    {"name": "Marina Costa", "specialties": ["Cabelo", "Cachos"],
     "photo_url": "https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=400&q=80"},
]


async def seed_db(db):
    if await db.services.count_documents({}) == 0:
        docs = [{"_id": str(uuid.uuid4()), **s} for s in SEED_SERVICES]
        await db.services.insert_many(docs)
        logger.info("Seeded %d services", len(docs))
    if await db.professionals.count_documents({}) == 0:
        docs = [{"_id": str(uuid.uuid4()), **p} for p in SEED_PROFESSIONALS]
        await db.professionals.insert_many(docs)
        logger.info("Seeded %d professionals", len(docs))


# ---------- App ----------
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    app.state.db = app.state.client[os.environ["DB_NAME"]]
    await app.state.db.users.create_index("email", unique=True)
    await seed_db(app.state.db)
    try:
        init_storage()
    except Exception as e:
        logger.warning("storage init at startup: %s", e)
    yield
    app.state.client.close()


app = FastAPI(title="Refúgio da Beleza API", lifespan=lifespan)

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "Refúgio da Beleza API", "status": "ok"}


# ---------- Auth ----------
@api_router.post("/auth/register")
async def register(body: RegisterBody, request: Request):
    if not body.lgpd_accepted:
        raise HTTPException(400, "Aceite a política de privacidade (LGPD)")
    email = body.email.lower().strip()
    existing = await request.app.state.db.users.find_one({"email": email})
    if existing:
        raise HTTPException(409, "E-mail já cadastrado")
    user = {
        "_id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "phone": body.phone.strip(),
        "email": email,
        "password_hash": password_hash.hash(body.password),
        "photo_path": None,
        "created_at": now_utc(),
        "lgpd_accepted_at": now_utc(),
    }
    await request.app.state.db.users.insert_one(user)
    token = create_access_token(user["_id"])
    return {"access_token": token, "token_type": "bearer", "user": user_to_out(user).model_dump()}


@api_router.post("/auth/login")
async def login(body: LoginBody, request: Request):
    email = body.email.lower().strip()
    user = await request.app.state.db.users.find_one({"email": email})
    dummy = password_hash.hash("dummy-check")
    valid = password_hash.verify(body.password, user["password_hash"] if user else dummy)
    if not user or not valid:
        raise HTTPException(401, "E-mail ou senha inválidos")
    token = create_access_token(user["_id"])
    return {"access_token": token, "token_type": "bearer", "user": user_to_out(user).model_dump()}


@api_router.post("/auth/forgot-password")
async def forgot_password(body: ForgotBody, request: Request):
    # MVP: sempre retorna sucesso, sem envio de e-mail real
    email = body.email.lower().strip()
    user = await request.app.state.db.users.find_one({"email": email})
    logger.info("Password reset requested for %s (found=%s)", email, bool(user))
    return {"message": "Se o e-mail existir, enviaremos instruções para redefinir sua senha."}


@api_router.get("/auth/me", response_model=UserOut)
async def me(user=Depends(current_user)):
    return user_to_out(user)


@api_router.patch("/auth/me", response_model=UserOut)
async def update_me(body: UserUpdate, request: Request, user=Depends(current_user)):
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "email" in updates:
        updates["email"] = updates["email"].lower().strip()
        conflict = await request.app.state.db.users.find_one({"email": updates["email"], "_id": {"$ne": user["_id"]}})
        if conflict:
            raise HTTPException(409, "E-mail já em uso")
    if updates:
        await request.app.state.db.users.update_one({"_id": user["_id"]}, {"$set": updates})
    fresh = await request.app.state.db.users.find_one({"_id": user["_id"]}, {"password_hash": 0})
    return user_to_out(fresh)


@api_router.post("/auth/me/photo")
async def upload_photo(request: Request, file: UploadFile = File(...), user=Depends(current_user)):
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(413, "Imagem muito grande (máx 5MB)")
    ext = (file.filename or "jpg").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    path = f"{APP_NAME}/uploads/{user['_id']}/{uuid.uuid4()}.{ext}"
    content_type = file.content_type or "image/jpeg"
    try:
        await run_in_threadpool(put_object, path, data, content_type)
    except Exception as e:
        logger.exception("photo upload failed")
        raise HTTPException(500, f"Falha no upload: {e}")
    await request.app.state.db.users.update_one({"_id": user["_id"]}, {"$set": {"photo_path": path}})
    return {"photo_path": path}


@api_router.get("/files/{path:path}")
async def get_file(path: str, request: Request, token: Optional[str] = None):
    # allow token in query for <img> tags on web
    auth_ok = False
    header = request.headers.get("authorization")
    if header and header.lower().startswith("bearer "):
        try:
            jwt.decode(header.split(" ", 1)[1], JWT_SECRET, algorithms=["HS256"], issuer=JWT_ISSUER)
            auth_ok = True
        except Exception:
            pass
    if not auth_ok and token:
        try:
            jwt.decode(token, JWT_SECRET, algorithms=["HS256"], issuer=JWT_ISSUER)
            auth_ok = True
        except Exception:
            pass
    if not auth_ok:
        raise HTTPException(401, "Unauthorized")
    try:
        content, ctype = await run_in_threadpool(get_object, path)
    except Exception:
        raise HTTPException(404, "Arquivo não encontrado")
    return Response(content=content, media_type=ctype)


# ---------- Services ----------
@api_router.get("/services", response_model=List[ServiceOut])
async def list_services(request: Request, category: Optional[str] = None, featured: Optional[bool] = None):
    q: dict = {}
    if category:
        q["category"] = category
    if featured is not None:
        q["featured"] = featured
    cursor = request.app.state.db.services.find(q, {"_id": 1, "category": 1, "name": 1, "description": 1, "duration_min": 1, "price": 1, "image_url": 1, "featured": 1})
    items = []
    async for s in cursor:
        items.append(ServiceOut(id=s["_id"], category=s["category"], name=s["name"], description=s["description"], duration_min=s["duration_min"], price=s["price"], image_url=s.get("image_url"), featured=s.get("featured", False)))
    return items


# ---------- Professionals ----------
@api_router.get("/professionals", response_model=List[ProfessionalOut])
async def list_professionals(request: Request):
    cursor = request.app.state.db.professionals.find({})
    items = []
    async for p in cursor:
        items.append(ProfessionalOut(id=p["_id"], name=p["name"], specialties=p.get("specialties", []), photo_url=p.get("photo_url")))
    return items


# ---------- Availability ----------
BUSINESS_HOURS = [f"{h:02d}:{m:02d}" for h in range(9, 19) for m in (0, 30)]  # 09:00 - 18:30


@api_router.get("/availability")
async def availability(request: Request, date: str, professional_id: Optional[str] = None):
    q: dict = {"date": date, "status": {"$ne": "cancelled"}}
    if professional_id:
        q["professional_id"] = professional_id
    taken = set()
    async for a in request.app.state.db.appointments.find(q, {"time": 1, "_id": 0}):
        taken.add(a["time"])
    slots = [{"time": t, "available": t not in taken} for t in BUSINESS_HOURS]
    return {"date": date, "slots": slots}


# ---------- Appointments ----------
async def _hydrate_appointment(db, a: dict) -> AppointmentOut:
    services = []
    async for s in db.services.find({"_id": {"$in": a["service_ids"]}}):
        services.append(ServiceOut(id=s["_id"], category=s["category"], name=s["name"], description=s["description"], duration_min=s["duration_min"], price=s["price"], image_url=s.get("image_url"), featured=s.get("featured", False)))
    prof: Optional[ProfessionalOut] = None
    if a.get("professional_id"):
        p = await db.professionals.find_one({"_id": a["professional_id"]})
        if p:
            prof = ProfessionalOut(id=p["_id"], name=p["name"], specialties=p.get("specialties", []), photo_url=p.get("photo_url"))
    return AppointmentOut(
        id=a["_id"], user_id=a["user_id"], services=services, professional=prof,
        date=a["date"], time=a["time"],
        total_duration_min=a.get("total_duration_min", sum(s.duration_min for s in services)),
        total_price=a.get("total_price", sum(s.price for s in services)),
        status=a.get("status", "scheduled"),
        created_at=a.get("created_at", now_utc()),
    )


@api_router.post("/appointments", response_model=AppointmentOut)
async def create_appointment(body: AppointmentCreate, request: Request, user=Depends(current_user)):
    db = request.app.state.db
    services = []
    async for s in db.services.find({"_id": {"$in": body.service_ids}}):
        services.append(s)
    if len(services) != len(body.service_ids):
        raise HTTPException(400, "Serviço inválido")
    professional = None
    if body.professional_id:
        professional = await db.professionals.find_one({"_id": body.professional_id})
        if not professional:
            raise HTTPException(400, "Profissional inválido")
    # Validate date/time
    try:
        appt_dt = datetime.strptime(f"{body.date} {body.time}", "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(400, "Data ou hora inválida")
    if appt_dt < now_utc():
        raise HTTPException(400, "Não é possível agendar no passado")
    # Check slot
    slot_q = {"date": body.date, "time": body.time, "status": {"$ne": "cancelled"}}
    if body.professional_id:
        slot_q["professional_id"] = body.professional_id
        exists = await db.appointments.find_one(slot_q)
        if exists:
            raise HTTPException(409, "Este horário já está ocupado com este profissional")

    doc = {
        "_id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "service_ids": body.service_ids,
        "professional_id": body.professional_id,
        "date": body.date,
        "time": body.time,
        "total_duration_min": sum(s["duration_min"] for s in services),
        "total_price": sum(s["price"] for s in services),
        "status": "scheduled",
        "created_at": now_utc(),
    }
    await db.appointments.insert_one(doc)
    return await _hydrate_appointment(db, doc)


@api_router.get("/appointments", response_model=List[AppointmentOut])
async def list_appointments(request: Request, scope: str = "all", user=Depends(current_user)):
    db = request.app.state.db
    q: dict = {"user_id": user["_id"]}
    today = now_utc().strftime("%Y-%m-%d")
    if scope == "upcoming":
        q["date"] = {"$gte": today}
        q["status"] = "scheduled"
    elif scope == "past":
        q["$or"] = [{"date": {"$lt": today}}, {"status": {"$in": ["done", "cancelled"]}}]
    cursor = db.appointments.find(q).sort([("date", 1), ("time", 1)])
    result = []
    async for a in cursor:
        result.append(await _hydrate_appointment(db, a))
    return result


@api_router.post("/appointments/{appt_id}/cancel", response_model=AppointmentOut)
async def cancel_appointment(appt_id: str, request: Request, user=Depends(current_user)):
    db = request.app.state.db
    a = await db.appointments.find_one({"_id": appt_id, "user_id": user["_id"]})
    if not a:
        raise HTTPException(404, "Agendamento não encontrado")
    if a["status"] != "scheduled":
        raise HTTPException(400, "Agendamento não pode ser cancelado")
    appt_dt = datetime.strptime(f"{a['date']} {a['time']}", "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
    if appt_dt - now_utc() < timedelta(hours=24):
        raise HTTPException(400, "Cancelamento requer no mínimo 24h de antecedência")
    await db.appointments.update_one({"_id": appt_id}, {"$set": {"status": "cancelled", "cancelled_at": now_utc()}})
    fresh = await db.appointments.find_one({"_id": appt_id})
    return await _hydrate_appointment(db, fresh)


class RescheduleBody(BaseModel):
    date: str
    time: str


@api_router.post("/appointments/{appt_id}/reschedule", response_model=AppointmentOut)
async def reschedule_appointment(appt_id: str, body: RescheduleBody, request: Request, user=Depends(current_user)):
    db = request.app.state.db
    a = await db.appointments.find_one({"_id": appt_id, "user_id": user["_id"]})
    if not a:
        raise HTTPException(404, "Agendamento não encontrado")
    if a["status"] != "scheduled":
        raise HTTPException(400, "Agendamento não pode ser remarcado")
    appt_dt = datetime.strptime(f"{a['date']} {a['time']}", "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
    if appt_dt - now_utc() < timedelta(hours=24):
        raise HTTPException(400, "Reagendamento requer no mínimo 24h de antecedência")
    try:
        new_dt = datetime.strptime(f"{body.date} {body.time}", "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(400, "Data ou hora inválida")
    if new_dt < now_utc():
        raise HTTPException(400, "Não é possível remarcar para o passado")
    if a.get("professional_id"):
        conflict = await db.appointments.find_one({
            "date": body.date, "time": body.time,
            "professional_id": a["professional_id"],
            "status": {"$ne": "cancelled"},
            "_id": {"$ne": appt_id},
        })
        if conflict:
            raise HTTPException(409, "Este horário já está ocupado")
    await db.appointments.update_one({"_id": appt_id}, {"$set": {"date": body.date, "time": body.time}})
    fresh = await db.appointments.find_one({"_id": appt_id})
    return await _hydrate_appointment(db, fresh)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
