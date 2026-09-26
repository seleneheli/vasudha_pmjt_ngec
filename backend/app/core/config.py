import os


class Settings:
    SECRET_KEY = os.getenv("SECRET_KEY", "vasudha-vasudha-demo-secret-2026")
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 480
    REFRESH_TOKEN_EXPIRE_DAYS = 7

    # Comma-separated list of allowed origins. Defaults cover local + any Vercel preview/prod.
    _cors = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,https://vasudha-pmjt-ngec.vercel.app,https://*.vercel.app",
    )
    CORS_ORIGINS = [o.strip() for o in _cors.split(",") if o.strip()]

    # Optional explicit frontend origin for production (e.g. https://vasudha.vercel.app)
    FRONTEND_URL = os.getenv("FRONTEND_URL", "https://vasudha-pmjt-ngec.vercel.app")


settings = Settings()
