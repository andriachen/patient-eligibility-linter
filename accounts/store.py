"""Read and write the signed-in user's row in public.profiles (see schema.sql)."""

from accounts.client import get_client


def load_profile(user_id: str) -> dict | None:
    """{"role", "answers", "completed"}, or None if they haven't started."""
    res = (
        get_client().table("profiles")
        .select("role, answers, completed")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def save_profile(user_id: str, answers: dict, completed: bool) -> None:
    get_client().table("profiles").upsert(
        {"user_id": user_id, "role": answers["role"], "answers": answers, "completed": completed},
        on_conflict="user_id",
    ).execute()
