from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr


class AppConfigSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    branding_name: str
    support_email: EmailStr
    maintenance_mode: bool


class UpdateAppConfigRequest(BaseModel):
    branding_name: str
    support_email: EmailStr
    maintenance_mode: bool
