"""Admin panel API: separate auth (owner/staff), dashboard, agenda, CRM, catalog and settings management."""
import os
import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, EmailStr, Field
from pwdlib import PasswordHash

from scheduling import (
    ACTIVE_STATUSES, compute_slots, get_settings, now_local, parse_dt, professional_window,
    slot_conflict, t2m, m2t, busy_intervals, load_day, SETTINGS_ID,
)

logger = logging.getLogger(__name__)
password_hash = PasswordHash.recommended()
bearer = HTTPBearer(auto_error=False)

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ISSUER = os.getenv("JWT_ISSUER", "refugio-beleza-api")
ADMIN_ACCESS_MINUTES = int(os.getenv("ADMIN_ACCESS_MINUTES", "720"))

Role = Literal["owner", "staff"]

# Seed admins (idempotent, $setOnInsert)
SEED_ADMINS = [
    {"name": "Marcelo", "email": "celocarnagueto@gmail.com", "password": "mister@santos01", "role": "owner"},
    {"name": "Marta Cristhoffer", "email": "marta.cristhoffer12@gmail.com", "password": "mister@1533", "role": "owner"},
    {"name": "Recepção", "email": "recepcao@refugio.com", "password": "equipe123", "role": "staff"},
]


async def seed_admins(db):
    await db.admin_users.create_index("email", unique=True)
    for a in SEED_ADMINS:
        await db.admin_users.update_one(
            {"email": a["email"].lower()},
            {"$setOnInsert": {
                "_id": str(uuid.uuid4()),
                "name": a["name"],
                "email": a["email"].lower(),
                "password_hash": password_hash.hash(a["password"]),
                "role": a["role"],
                "active": True,
                "created_at": datetime.now(timezone.utc),
            }},
            upsert=True,
        )


# ---------- Auth ----------
class AdminLoginBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class AdminOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: Role
    active: bool = True


def admin_to_out(a: dict) -> AdminOut:
    return AdminOut(id=a["_id"], name=a["name"], email=a["email"], role=a["role"], active=a.get("active", True))


def issue_admin_token(admin: dict) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": f"admin:{admin['_id']}", "typ": "admin", "role": admin["role"], "iss": JWT_ISSUER,
         "iat": now, "exp": now + timedelta(minutes=ADMIN_ACCESS_MINUTES)},
        JWT_SECRET, algorithm="HS256",
    )


async def current_admin(request: Request, creds: HTTPAuthorizationCredentials = Depends(bearer)):
    unauthorized = HTTPException(401, "Sessão inválida. Faça login novamente.")
    if not creds or creds.scheme.lower() != "bearer":
        raise unauthorized
    try:
        claims = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"], issuer=JWT_ISSUER,
                            options={"require": ["sub", "typ", "role", "exp"]})
        if claims["typ"] != "admin" or not str(claims["sub"]).startswith("admin:"):
            raise unauthorized
    except HTTPException:
        raise
    except Exception:
        raise unauthorized
    admin = await request.app.state.db.admin_users.find_one({"_id": claims["sub"][6:], "active": True}, {"password_hash": 0})
    if not admin or admin["role"] != claims["role"]:
        raise unauthorized
    return admin


async def require_owner(admin=Depends(current_admin)):
    if admin["role"] != "owner":
        raise HTTPException(403, "Acesso restrito ao Dono")
    return admin


router = APIRouter(prefix="/admin")


@router.post("/auth/login")
async def admin_login(body: AdminLoginBody, request: Request):
    db = request.app.state.db
    admin = await db.admin_users.find_one({"email": body.email.lower().strip()})
    valid = password_hash.verify(body.password, admin["password_hash"] if admin else password_hash.hash("dummy"))
    if not admin or not valid or not admin.get("active", True):
        raise HTTPException(401, "E-mail ou senha inválidos")
    return {"access_token": issue_admin_token(admin), "token_type": "bearer", "admin": admin_to_out(admin).model_dump()}


@router.get("/me", response_model=AdminOut)
async def admin_me(admin=Depends(current_admin)):
    return admin_to_out(admin)


# ---------- Team management (owner) ----------
class AdminCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    role: Role


@router.get("/admins", response_model=List[AdminOut])
async def list_admins(request: Request, _=Depends(require_owner)):
    return [admin_to_out(a) async for a in request.app.state.db.admin_users.find({}, {"password_hash": 0}).sort("created_at", 1)]


@router.post("/admins", response_model=AdminOut)
async def create_admin(body: AdminCreate, request: Request, _=Depends(require_owner)):
    db = request.app.state.db
    email = body.email.lower().strip()
    if await db.admin_users.find_one({"email": email}):
        raise HTTPException(409, "E-mail já cadastrado na equipe")
    doc = {"_id": str(uuid.uuid4()), "name": body.name.strip(), "email": email,
           "password_hash": password_hash.hash(body.password), "role": body.role, "active": True,
           "created_at": datetime.now(timezone.utc)}
    await db.admin_users.insert_one(doc)
    return admin_to_out(doc)


@router.delete("/admins/{admin_id}")
async def delete_admin(admin_id: str, request: Request, me=Depends(require_owner)):
    if admin_id == me["_id"]:
        raise HTTPException(400, "Você não pode remover a própria conta")
    r = await request.app.state.db.admin_users.delete_one({"_id": admin_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Conta não encontrada")
    return {"ok": True}


# ---------- Shared serializers ----------
def service_out(s: dict) -> dict:
    return {"id": s["_id"], "category": s["category"], "name": s["name"], "description": s.get("description", ""),
            "duration_min": s["duration_min"], "price": s["price"], "image_url": s.get("image_url"),
            "featured": s.get("featured", False)}


def professional_out(p: dict) -> dict:
    return {"id": p["_id"], "name": p["name"], "specialties": p.get("specialties", []), "photo_url": p.get("photo_url"),
            "work_hours": p.get("work_hours") or {}, "active": p.get("active", True)}


async def hydrate_admin_appointment(db, a: dict) -> dict:
    services = [service_out(s) async for s in db.services.find({"_id": {"$in": a.get("service_ids", [])}})]
    prof = None
    if a.get("professional_id"):
        p = await db.professionals.find_one({"_id": a["professional_id"]})
        if p:
            prof = professional_out(p)
    client = None
    if a.get("user_id"):
        u = await db.users.find_one({"_id": a["user_id"]}, {"name": 1, "phone": 1, "email": 1})
        if u:
            client = {"id": u["_id"], "name": u["name"], "phone": u.get("phone", ""), "email": u.get("email")}
    if not client:
        client = {"id": None, "name": a.get("client_name") or "Cliente", "phone": a.get("client_phone") or "", "email": None}
    duration = int(a.get("total_duration_min") or sum(s["duration_min"] for s in services) or 30)
    return {
        "id": a["_id"], "client": client, "services": services, "professional": prof,
        "date": a["date"], "time": a["time"], "end_time": m2t(t2m(a["time"]) + duration),
        "total_duration_min": duration, "total_price": a.get("total_price", sum(s["price"] for s in services)),
        "status": a.get("status", "scheduled"), "source": a.get("source", "app"), "notes": a.get("notes", ""),
        "created_at": a.get("created_at"),
    }


# ---------- Dashboard ----------
@router.get("/dashboard")
async def dashboard(request: Request, admin=Depends(current_admin)):
    db = request.app.state.db
    today_dt = now_local()
    today = today_dt.strftime("%Y-%m-%d")
    week_start = (today_dt - timedelta(days=today_dt.weekday())).strftime("%Y-%m-%d")
    week_end = (today_dt + timedelta(days=6 - today_dt.weekday())).strftime("%Y-%m-%d")
    month_start = today_dt.strftime("%Y-%m-01")

    active_q = {"status": {"$in": ACTIVE_STATUSES}}
    today_count = await db.appointments.count_documents({**active_q, "date": today})
    week_count = await db.appointments.count_documents({**active_q, "date": {"$gte": week_start, "$lte": week_end}})
    week_start_utc = datetime.strptime(week_start, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    new_clients_week = await db.users.count_documents({"created_at": {"$gte": week_start_utc}})
    total_clients = await db.users.count_documents({})

    # occupancy for today: booked slots / total working slots across active professionals
    settings = await get_settings(db)
    step = int(settings.get("slot_minutes", 30))
    appts, blocks = await load_day(db, today)
    total_slots = 0
    busy_slots = 0
    async for p in db.professionals.find({"active": {"$ne": False}}):
        win = professional_window(p, settings, today)
        if not win:
            continue
        busy = busy_intervals(appts, blocks, p["_id"])
        for m in range(win[0], win[1], step):
            total_slots += 1
            if any(s < m + step and m < e for s, e in busy):
                busy_slots += 1
    occupancy = round(busy_slots / total_slots * 100) if total_slots else 0

    upcoming_today = []
    cursor = db.appointments.find({"date": today, "status": "scheduled"}).sort("time", 1).limit(6)
    async for a in cursor:
        upcoming_today.append(await hydrate_admin_appointment(db, a))

    data = {
        "today": today, "today_count": today_count, "week_count": week_count,
        "new_clients_week": new_clients_week, "total_clients": total_clients,
        "occupancy_rate": occupancy, "upcoming_today": upcoming_today,
    }

    if admin["role"] == "owner":
        async def revenue(q):
            pipeline = [{"$match": {**active_q, **q}}, {"$group": {"_id": None, "total": {"$sum": "$total_price"}}}]
            r = [d async for d in db.appointments.aggregate(pipeline)]
            return round(r[0]["total"], 2) if r else 0.0

        data["finance"] = {
            "revenue_today": await revenue({"date": today}),
            "revenue_week": await revenue({"date": {"$gte": week_start, "$lte": week_end}}),
            "revenue_month": await revenue({"date": {"$gte": month_start, "$lte": today_dt.strftime("%Y-%m-%d")}}),
            "revenue_month_forecast": await revenue({"date": {"$gte": month_start, "$lt": (today_dt.replace(day=28) + timedelta(days=4)).strftime("%Y-%m-01")}}),
        }
        since = (today_dt - timedelta(days=30)).strftime("%Y-%m-%d")
        pipeline = [
            {"$match": {**active_q, "date": {"$gte": since}}},
            {"$unwind": "$service_ids"},
            {"$group": {"_id": "$service_ids", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}, {"$limit": 5},
        ]
        top = []
        async for r in db.appointments.aggregate(pipeline):
            s = await db.services.find_one({"_id": r["_id"]})
            if s:
                top.append({"service_id": s["_id"], "name": s["name"], "category": s["category"], "count": r["count"],
                            "revenue": round(r["count"] * s["price"], 2)})
        data["top_services"] = top
    return data


# ---------- Agenda ----------
class AdminAppointmentCreate(BaseModel):
    user_id: Optional[str] = None
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    service_ids: List[str] = Field(min_length=1)
    professional_id: Optional[str] = None
    date: str
    time: str
    notes: Optional[str] = ""
    fit_in: bool = False  # encaixe: ignore conflicts


class AdminAppointmentUpdate(BaseModel):
    status: Optional[Literal["scheduled", "done", "cancelled", "no_show"]] = None
    date: Optional[str] = None
    time: Optional[str] = None
    professional_id: Optional[str] = None
    notes: Optional[str] = None
    fit_in: bool = False


@router.get("/appointments")
async def admin_list_appointments(request: Request, date_from: str, date_to: Optional[str] = None,
                                  professional_id: Optional[str] = None, status: Optional[str] = None,
                                  _=Depends(current_admin)):
    db = request.app.state.db
    q: dict = {"date": {"$gte": date_from, "$lte": date_to or date_from}}
    if professional_id:
        q["professional_id"] = professional_id
    if status:
        q["status"] = status
    items = []
    async for a in db.appointments.find(q).sort([("date", 1), ("time", 1)]):
        items.append(await hydrate_admin_appointment(db, a))
    return items


@router.post("/appointments")
async def admin_create_appointment(body: AdminAppointmentCreate, request: Request, admin=Depends(current_admin)):
    db = request.app.state.db
    services = [s async for s in db.services.find({"_id": {"$in": body.service_ids}})]
    if len(services) != len(set(body.service_ids)):
        raise HTTPException(400, "Serviço inválido")
    if body.professional_id and not await db.professionals.find_one({"_id": body.professional_id}):
        raise HTTPException(400, "Profissional inválido")
    try:
        parse_dt(body.date, body.time)
    except ValueError:
        raise HTTPException(400, "Data ou hora inválida")
    user = None
    if body.user_id:
        user = await db.users.find_one({"_id": body.user_id})
        if not user:
            raise HTTPException(400, "Cliente não encontrada")
    elif not (body.client_name or "").strip():
        raise HTTPException(400, "Informe a cliente ou o nome para o encaixe")
    duration = sum(s["duration_min"] for s in services)
    if not body.fit_in and await slot_conflict(db, body.date, body.time, duration, body.professional_id):
        raise HTTPException(409, "Horário em conflito para esta profissional. Use 'encaixe' para forçar.")
    doc = {
        "_id": str(uuid.uuid4()), "user_id": user["_id"] if user else None,
        "client_name": (body.client_name or "").strip() or None, "client_phone": (body.client_phone or "").strip() or None,
        "service_ids": body.service_ids, "professional_id": body.professional_id,
        "date": body.date, "time": body.time, "total_duration_min": duration,
        "total_price": sum(s["price"] for s in services), "status": "scheduled",
        "source": "admin", "notes": body.notes or "", "created_by": admin["_id"],
        "created_at": datetime.now(timezone.utc),
    }
    await db.appointments.insert_one(doc)
    return await hydrate_admin_appointment(db, doc)


@router.patch("/appointments/{appt_id}")
async def admin_update_appointment(appt_id: str, body: AdminAppointmentUpdate, request: Request, _=Depends(current_admin)):
    db = request.app.state.db
    a = await db.appointments.find_one({"_id": appt_id})
    if not a:
        raise HTTPException(404, "Agendamento não encontrado")
    updates: dict = {}
    if body.status:
        updates["status"] = body.status
        if body.status == "cancelled":
            updates["cancelled_at"] = datetime.now(timezone.utc)
    if body.notes is not None:
        updates["notes"] = body.notes
    new_date, new_time = body.date or a["date"], body.time or a["time"]
    new_prof = body.professional_id if body.professional_id is not None else a.get("professional_id")
    if body.date or body.time or body.professional_id is not None:
        try:
            parse_dt(new_date, new_time)
        except ValueError:
            raise HTTPException(400, "Data ou hora inválida")
        if new_prof and not await db.professionals.find_one({"_id": new_prof}):
            raise HTTPException(400, "Profissional inválido")
        if not body.fit_in and await slot_conflict(db, new_date, new_time, int(a.get("total_duration_min") or 30), new_prof, exclude_id=appt_id):
            raise HTTPException(409, "Horário em conflito para esta profissional. Use 'encaixe' para forçar.")
        updates.update({"date": new_date, "time": new_time, "professional_id": new_prof or None})
    if updates:
        await db.appointments.update_one({"_id": appt_id}, {"$set": updates})
    fresh = await db.appointments.find_one({"_id": appt_id})
    return await hydrate_admin_appointment(db, fresh)


@router.get("/availability")
async def admin_availability(request: Request, date: str, professional_id: Optional[str] = None,
                             duration_min: int = 30, _=Depends(current_admin)):
    return {"date": date, "slots": await compute_slots(request.app.state.db, date, professional_id, duration_min)}


# ---------- Blocks ----------
class BlockCreate(BaseModel):
    professional_id: Optional[str] = None  # None = whole salon
    date: str
    start_time: str
    end_time: str
    reason: Optional[str] = ""


def block_out(b: dict) -> dict:
    return {"id": b["_id"], "professional_id": b.get("professional_id"), "date": b["date"],
            "start_time": b["start_time"], "end_time": b["end_time"], "reason": b.get("reason", "")}


@router.get("/blocks")
async def list_blocks(request: Request, date_from: str, date_to: Optional[str] = None,
                      professional_id: Optional[str] = None, _=Depends(current_admin)):
    q: dict = {"date": {"$gte": date_from, "$lte": date_to or date_from}}
    if professional_id:
        q["$or"] = [{"professional_id": professional_id}, {"professional_id": None}]
    return [block_out(b) async for b in request.app.state.db.blocks.find(q).sort([("date", 1), ("start_time", 1)])]


@router.post("/blocks")
async def create_block(body: BlockCreate, request: Request, admin=Depends(current_admin)):
    try:
        parse_dt(body.date, body.start_time)
        parse_dt(body.date, body.end_time)
    except ValueError:
        raise HTTPException(400, "Data ou hora inválida")
    if t2m(body.end_time) <= t2m(body.start_time):
        raise HTTPException(400, "Hora final deve ser após a inicial")
    doc = {"_id": str(uuid.uuid4()), "professional_id": body.professional_id or None, "date": body.date,
           "start_time": body.start_time, "end_time": body.end_time, "reason": (body.reason or "").strip(),
           "created_by": admin["_id"], "created_at": datetime.now(timezone.utc)}
    await request.app.state.db.blocks.insert_one(doc)
    return block_out(doc)


@router.delete("/blocks/{block_id}")
async def delete_block(block_id: str, request: Request, _=Depends(current_admin)):
    r = await request.app.state.db.blocks.delete_one({"_id": block_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Bloqueio não encontrado")
    return {"ok": True}


# ---------- Clients (CRM) ----------
class ClientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    internal_notes: Optional[str] = None


def client_out(u: dict) -> dict:
    return {"id": u["_id"], "name": u["name"], "phone": u.get("phone", ""), "email": u.get("email"),
            "photo_path": u.get("photo_path"), "internal_notes": u.get("internal_notes", ""),
            "created_at": u.get("created_at")}


@router.get("/clients")
async def list_clients(request: Request, search: Optional[str] = None, limit: int = 200, _=Depends(current_admin)):
    db = request.app.state.db
    q: dict = {}
    if search and search.strip():
        import re
        term = re.escape(search.strip())
        digits = "".join(ch for ch in search if ch.isdigit())
        ors = [{"name": {"$regex": term, "$options": "i"}}, {"email": {"$regex": term, "$options": "i"}}]
        if digits:
            ors.append({"phone": {"$regex": ".*".join(digits)}})
        q["$or"] = ors
    items = []
    async for u in db.users.find(q, {"password_hash": 0}).sort("name", 1).limit(limit):
        c = client_out(u)
        c["appointments_count"] = await db.appointments.count_documents({"user_id": u["_id"], "status": {"$in": ACTIVE_STATUSES}})
        last = await db.appointments.find_one({"user_id": u["_id"], "status": {"$in": ACTIVE_STATUSES}}, sort=[("date", -1), ("time", -1)])
        c["last_visit"] = last["date"] if last else None
        items.append(c)
    return items


@router.get("/clients/{client_id}")
async def get_client(client_id: str, request: Request, _=Depends(current_admin)):
    db = request.app.state.db
    u = await db.users.find_one({"_id": client_id}, {"password_hash": 0})
    if not u:
        raise HTTPException(404, "Cliente não encontrada")
    history = []
    async for a in db.appointments.find({"user_id": client_id}).sort([("date", -1), ("time", -1)]):
        history.append(await hydrate_admin_appointment(db, a))
    out = client_out(u)
    out["history"] = history
    out["total_spent"] = round(sum(h["total_price"] for h in history if h["status"] == "done"), 2)
    return out


@router.patch("/clients/{client_id}")
async def update_client(client_id: str, body: ClientUpdate, request: Request, _=Depends(current_admin)):
    db = request.app.state.db
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if updates:
        await db.users.update_one({"_id": client_id}, {"$set": updates})
    u = await db.users.find_one({"_id": client_id}, {"password_hash": 0})
    if not u:
        raise HTTPException(404, "Cliente não encontrada")
    return client_out(u)


# ---------- Services CRUD ----------
@router.get("/services")
async def admin_list_services(request: Request, _=Depends(current_admin)):
    return [service_out(s) async for s in request.app.state.db.services.find({}).sort([("category", 1), ("name", 1)])]


@router.get("/professionals")
async def admin_list_professionals(request: Request, _=Depends(current_admin)):
    return [professional_out(p) async for p in request.app.state.db.professionals.find({}).sort("name", 1)]


class ServiceBody(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=60)
    description: str = ""
    duration_min: int = Field(ge=5, le=600)
    price: float = Field(ge=0)
    image_url: Optional[str] = None
    featured: bool = False


class ServicePatch(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    duration_min: Optional[int] = Field(default=None, ge=5, le=600)
    price: Optional[float] = Field(default=None, ge=0)
    image_url: Optional[str] = None
    featured: Optional[bool] = None


@router.post("/services")
async def create_service(body: ServiceBody, request: Request, _=Depends(current_admin)):
    doc = {"_id": str(uuid.uuid4()), **body.model_dump()}
    doc["name"], doc["category"] = doc["name"].strip(), doc["category"].strip()
    await request.app.state.db.services.insert_one(doc)
    return service_out(doc)


@router.patch("/services/{service_id}")
async def update_service(service_id: str, body: ServicePatch, request: Request, _=Depends(current_admin)):
    db = request.app.state.db
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None or k == "image_url"}
    if updates:
        await db.services.update_one({"_id": service_id}, {"$set": updates})
    s = await db.services.find_one({"_id": service_id})
    if not s:
        raise HTTPException(404, "Serviço não encontrado")
    return service_out(s)


@router.delete("/services/{service_id}")
async def delete_service(service_id: str, request: Request, _=Depends(current_admin)):
    r = await request.app.state.db.services.delete_one({"_id": service_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Serviço não encontrado")
    return {"ok": True}


# ---------- Professionals CRUD ----------
class WorkDay(BaseModel):
    start: str = "09:00"
    end: str = "18:00"
    off: bool = False


class ProfessionalBody(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    specialties: List[str] = []
    photo_url: Optional[str] = None
    work_hours: Optional[dict] = None
    active: bool = True


class ProfessionalPatch(BaseModel):
    name: Optional[str] = None
    specialties: Optional[List[str]] = None
    photo_url: Optional[str] = None
    work_hours: Optional[dict] = None
    active: Optional[bool] = None


def validate_work_hours(wh: Optional[dict]):
    if not wh:
        return
    for k, v in wh.items():
        if k not in [str(i) for i in range(7)]:
            raise HTTPException(400, "Dia da semana inválido")
        WorkDay(**v)
        if not v.get("off") and t2m(v.get("end", "18:00")) <= t2m(v.get("start", "09:00")):
            raise HTTPException(400, "Horário de trabalho inválido")


@router.post("/professionals")
async def create_professional(body: ProfessionalBody, request: Request, _=Depends(current_admin)):
    validate_work_hours(body.work_hours)
    doc = {"_id": str(uuid.uuid4()), **body.model_dump()}
    doc["name"] = doc["name"].strip()
    await request.app.state.db.professionals.insert_one(doc)
    return professional_out(doc)


@router.patch("/professionals/{prof_id}")
async def update_professional(prof_id: str, body: ProfessionalPatch, request: Request, _=Depends(current_admin)):
    db = request.app.state.db
    validate_work_hours(body.work_hours)
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None or k == "photo_url"}
    if updates:
        await db.professionals.update_one({"_id": prof_id}, {"$set": updates})
    p = await db.professionals.find_one({"_id": prof_id})
    if not p:
        raise HTTPException(404, "Profissional não encontrada")
    return professional_out(p)


@router.delete("/professionals/{prof_id}")
async def delete_professional(prof_id: str, request: Request, _=Depends(current_admin)):
    db = request.app.state.db
    r = await db.professionals.delete_one({"_id": prof_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Profissional não encontrada")
    # future appointments keep history but lose the assignment
    await db.appointments.update_many({"professional_id": prof_id, "status": "scheduled"}, {"$set": {"professional_id": None}})
    return {"ok": True}


@router.post("/professionals/{prof_id}/photo")
async def upload_professional_photo(prof_id: str, request: Request, file: UploadFile = File(...), _=Depends(current_admin)):
    from server import put_object, APP_NAME, public_file_url  # lazy import to avoid cycle
    db = request.app.state.db
    if not await db.professionals.find_one({"_id": prof_id}):
        raise HTTPException(404, "Profissional não encontrada")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(413, "Imagem muito grande (máx 5MB)")
    ext = (file.filename or "jpg").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        ext = "jpg"
    path = f"{APP_NAME}/public/professionals/{prof_id}/{uuid.uuid4()}.{ext}"
    try:
        await run_in_threadpool(put_object, path, data, file.content_type or "image/jpeg")
    except Exception as e:
        logger.exception("professional photo upload failed")
        raise HTTPException(500, f"Falha no upload: {e}")
    url = public_file_url(request, path)
    await db.professionals.update_one({"_id": prof_id}, {"$set": {"photo_url": url}})
    return {"photo_url": url}


# ---------- Settings ----------
class OpeningDay(BaseModel):
    open: str = "09:00"
    close: str = "19:00"
    closed: bool = False


class SettingsPatch(BaseModel):
    cancel_min_hours: Optional[int] = Field(default=None, ge=0, le=168)
    slot_minutes: Optional[int] = Field(default=None, ge=10, le=120)
    opening_hours: Optional[dict] = None
    days_off: Optional[List[str]] = None


def settings_out(s: dict) -> dict:
    return {"cancel_min_hours": s["cancel_min_hours"], "slot_minutes": s["slot_minutes"],
            "opening_hours": s["opening_hours"], "days_off": sorted(s.get("days_off", []))}


@router.get("/settings")
async def get_salon_settings(request: Request, _=Depends(current_admin)):
    return settings_out(await get_settings(request.app.state.db))


@router.patch("/settings")
async def update_salon_settings(body: SettingsPatch, request: Request, _=Depends(require_owner)):
    db = request.app.state.db
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "opening_hours" in updates:
        for k, v in updates["opening_hours"].items():
            if k not in [str(i) for i in range(7)]:
                raise HTTPException(400, "Dia da semana inválido")
            d = OpeningDay(**v)
            if not d.closed and t2m(d.close) <= t2m(d.open):
                raise HTTPException(400, "Horário de fechamento deve ser após a abertura")
    if "days_off" in updates:
        for d in updates["days_off"]:
            try:
                datetime.strptime(d, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(400, f"Data inválida: {d}")
        updates["days_off"] = sorted(set(updates["days_off"]))
    await get_settings(db)  # ensure doc exists
    if updates:
        await db.settings.update_one({"_id": SETTINGS_ID}, {"$set": updates})
    return settings_out(await get_settings(db))
