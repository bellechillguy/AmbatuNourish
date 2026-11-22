from dataclasses import dataclass
from typing import Optional, Protocol

from .common import pending


class Identity(Protocol):
    def register(self, body: dict) -> dict: ...
    def login(self, body: dict) -> dict: ...
    def profile(self, token: str) -> dict: ...
    def update_profile(self, token: str, body: dict) -> dict: ...
    def logout(self, token: str) -> None: ...
    def request_reset(self, body: dict) -> None: ...


class SharedIdentity:
    def __init__(self, integration=None):
        self.integration = integration

    def register(self, body):
        # to do: sepakati registrasi yang memetakan nama tampilan dan mengembalikan sesi.
        raise pending()

    def login(self, body):
        if not self.integration:
            raise pending()
        return self.integration.request('/identity/login', method='POST', identity=True,
                                        body={key: body.get(key) for key in ('email', 'password')})

    def profile(self, token):
        if not self.integration:
            raise pending()
        return self.integration.request('/identity/me', token=token, identity=True)

    def update_profile(self, token, body):
        # to do: kirim perubahan profil ke Identity & Access sesuai field yang disepakati.
        raise pending()

    def logout(self, token):
        # to do: ikuti kontrak pencabutan atau penutupan sesi Ambatufit.
        raise pending()

    def request_reset(self, body):
        # to do: teruskan permintaan reset ke Ambatufit sesuai kontrak recovery.
        raise pending()


@dataclass(frozen=True)
class PlanData:
    display: dict
    rules: tuple
    daily_targets: dict
    conflicts: tuple = ()


class NutritionPartner(Protocol):
    def nutrition_plan(self, owner: str) -> Optional[PlanData]: ...
    def share_consumption(self, owner: str, record: dict, operation: str) -> None: ...
    def booking_offer(self, owner: str) -> Optional[dict]: ...


class Ambatufit:
    def nutrition_plan(self, owner):
        # to do: terima Nutrition Plan Ambatufit dan petakan versi, masa berlaku, aturan, dan target read-only.
        return None

    def share_consumption(self, owner, record, operation):
        # to do: setelah kontrak tersedia, antrekan pengiriman create/update/delete riwayat di luar STB.
        raise pending()

    def booking_offer(self, owner):
        # to do: petakan trigger konsultasi dan handoff booking Ambatufit yang disepakati.
        return None


class RestaurantPartner(Protocol):
    def find(self, owner: str, meal: dict, location: dict) -> list: ...
    def suggest(self, owner: str, query: str) -> list: ...
    def publish_nutrition(self, product: dict) -> None: ...


class Ambatueat:
    def find(self, owner, meal, location):
        # to do: konsumsi API Ambatueat untuk restoran terdekat setelah kontrak lokasi dan menu tersedia.
        raise pending()

    def suggest(self, owner, query):
        # to do: pastikan sumber dan format saran lokasi manual dengan Ambatueat.
        raise pending()

    def publish_nutrition(self, product):
        # to do: petakan informasi gizi menu ke kontrak pertukaran data Ambatueat.
        raise pending()
