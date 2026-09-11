"""Shared scheduling helpers: salon settings, working windows, slots and busy intervals."""
from datetime import datetime
from typing import List, Optional, Tuple
from zoneinfo import ZoneInfo

SALON_TZ = ZoneInfo("America/Sao_Paulo")
SETTINGS_ID = "salon"
ACTIVE_STATUSES = ["scheduled", "done"]  # statuses that occupy the agenda

DEFAULT_SETTINGS = {
    "_id": SETTINGS_ID,
    "cancel_min_hours": 24,
    "slot_minutes": 30,
    # weekday keys follow python weekday(): 0=Monday ... 6=Sunday
    "opening_hours": {
        "0": {"open": "09:00", "close": "19:00", "closed": False},
        "1": {"open": "09:00", "close": "19:00", "closed": False},
        "2": {"open": "09:00", "close": "19:00", "closed": False},
        "3": {"open": "09:00", "close": "19:00", "closed": False},
        "4": {"open": "09:00", "close": "19:00", "closed": False},
        "5": {"open": "09:00", "close": "17:00", "closed": False},
        "6": {"open": "09:00", "close": "13:00", "closed": True},
    },
    "days_off": [],
}


def now_local() -> datetime:
    """Naive datetime in salon local time (matches the naive date/time stored on appointments)."""
    return datetime.now(SALON_TZ).replace(tzinfo=None)


def parse_dt(date: str, time: str) -> datetime:
    return datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M")


def t2m(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def m2t(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"


async def get_settings(db) -> dict:
    doc = await db.settings.find_one({"_id": SETTINGS_ID})
    if not doc:
        await db.settings.insert_one(DEFAULT_SETTINGS)
        return dict(DEFAULT_SETTINGS)
    merged = {**DEFAULT_SETTINGS, **doc}
    merged["opening_hours"] = {**DEFAULT_SETTINGS["opening_hours"], **(doc.get("opening_hours") or {})}
    return merged


def salon_window(settings: dict, date: str) -> Optional[Tuple[int, int]]:
    if date in settings.get("days_off", []):
        return None
    wd = str(datetime.strptime(date, "%Y-%m-%d").weekday())
    day = settings["opening_hours"].get(wd)
    if not day or day.get("closed"):
        return None
    return t2m(day["open"]), t2m(day["close"])


def professional_window(prof: Optional[dict], settings: dict, date: str) -> Optional[Tuple[int, int]]:
    base = salon_window(settings, date)
    if base is None:
        return None
    if not prof or not prof.get("work_hours"):
        return base
    wd = str(datetime.strptime(date, "%Y-%m-%d").weekday())
    wh = prof["work_hours"].get(wd)
    if not wh:
        return base
    if wh.get("off"):
        return None
    start = max(base[0], t2m(wh.get("start") or m2t(base[0])))
    end = min(base[1], t2m(wh.get("end") or m2t(base[1])))
    return (start, end) if start < end else None


def busy_intervals(appts: List[dict], blocks: List[dict], professional_id: Optional[str]) -> List[Tuple[int, int]]:
    """Intervals (minutes) occupied for a given professional (or salon-wide when professional_id is None)."""
    out: List[Tuple[int, int]] = []
    for a in appts:
        if a.get("status", "scheduled") not in ACTIVE_STATUSES:
            continue
        if professional_id is not None and a.get("professional_id") not in (None, professional_id):
            continue
        s = t2m(a["time"])
        out.append((s, s + int(a.get("total_duration_min") or 30)))
    for b in blocks:
        if b.get("professional_id") not in (None, professional_id):
            continue
        out.append((t2m(b["start_time"]), t2m(b["end_time"])))
    return out


def overlaps(start: int, end: int, intervals: List[Tuple[int, int]]) -> bool:
    return any(s < end and start < e for s, e in intervals)


async def load_day(db, date: str):
    appts = [a async for a in db.appointments.find({"date": date, "status": {"$in": ACTIVE_STATUSES}})]
    blocks = [b async for b in db.blocks.find({"date": date})]
    return appts, blocks


async def compute_slots(db, date: str, professional_id: Optional[str], duration_min: int = 30) -> List[dict]:
    """Slots for a date. With no professional, a slot is available if at least one active professional is free."""
    settings = await get_settings(db)
    step = int(settings.get("slot_minutes", 30))
    appts, blocks = await load_day(db, date)

    if professional_id:
        prof = await db.professionals.find_one({"_id": professional_id})
        pros = [prof] if prof else []
    else:
        pros = [p async for p in db.professionals.find({"active": {"$ne": False}})]

    salon = salon_window(settings, date)
    if salon is None:
        return []

    if not pros:
        busy = busy_intervals(appts, blocks, None)
        return [{"time": m2t(m), "available": not overlaps(m, m + duration_min, busy)}
                for m in range(salon[0], salon[1], step)]

    free_by_slot: dict = {}
    for p in pros:
        win = professional_window(p, settings, date)
        if win is None:
            continue
        busy = busy_intervals(appts, blocks, p["_id"])
        for m in range(win[0], win[1], step):
            free = (m + duration_min <= win[1]) and not overlaps(m, m + duration_min, busy)
            free_by_slot[m] = free_by_slot.get(m, False) or free

    return [{"time": m2t(m), "available": free_by_slot.get(m, False)} for m in range(salon[0], salon[1], step)]


async def slot_conflict(db, date: str, time: str, duration_min: int, professional_id: Optional[str], exclude_id: Optional[str] = None) -> bool:
    appts, blocks = await load_day(db, date)
    appts = [a for a in appts if a["_id"] != exclude_id]
    if professional_id is None:
        return False
    busy = busy_intervals(appts, blocks, professional_id)
    s = t2m(time)
    return overlaps(s, s + duration_min, busy)
