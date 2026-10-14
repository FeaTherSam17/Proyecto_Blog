"""
===========================================================================
bot_login_test.py  –  Demostración de bloqueo del servidor ante un bot
===========================================================================
Objetivo:
    Simular el comportamiento de un bot automatizado que intenta enviar el
    formulario de login de PROYECTO_BLOG (localhost:5174/login) sin resolver
    el CAPTCHA matemático ni satisfacer las métricas de comportamiento
    humano (mouse, teclado, tiempo).

Dependencias:
    pip install selenium webdriver-manager requests

Ejecución:
    python bot_login_test.py

Resultado esperado:
    El servidor responderá con uno o varios de los siguientes bloqueos:
      - HTTP 400  → CAPTCHA inválido / no enviado
      - HTTP 403  → Bot detectado (navigator.webdriver, User-Agent, Referer)
      - HTTP 429  → Rate limit superado (demasiadas peticiones en poco tiempo)
===========================================================================
"""

from __future__ import annotations

import logging
import time
import requests

from selenium import webdriver
from selenium.common.exceptions import NoSuchElementException, TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

# ---------------------------------------------------------------------------
# Configuracion global
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
LOGGER = logging.getLogger("BotLoginTest")

BASE_URL     = "http://localhost:5174"
LOGIN_URL    = f"{BASE_URL}/login"
API_BASE     = "http://localhost:3000"
EMAIL_BOT    = "bot_test@ejemplo.com"
PASSWORD_BOT = "password123"


# ===========================================================================
# PRUEBA 1 - Ataque directo a la API REST sin pasar por el frontend
# ===========================================================================
def prueba_api_directa() -> None:
    """
    Envia un POST directo a /api/auth/login sin resolver el CAPTCHA.
    Un bot clasico ignoraria el frontend y atacaria la API directamente.
    """
    LOGGER.info("=" * 60)
    LOGGER.info("PRUEBA 1: Ataque directo a la API sin CAPTCHA")
    LOGGER.info("=" * 60)

    payload = {
        "email": EMAIL_BOT,
        "contrasena": PASSWORD_BOT,
        "captchaRespuesta": "",        # Sin resolver el CAPTCHA
        "comportamiento": {            # Sin metricas de comportamiento humano
            "mousemove_count": 0,
            "keydown_count": 0,
            "keyup_count": 0,
            "focus_submit_ms": 0,
            "navigator_webdriver": True,   # Se delata como Selenium
        },
    }

    headers = {
        "Content-Type": "application/json",
        # Sin Referer -> senal de bot para botDetection.js
    }

    try:
        resp = requests.post(
            f"{API_BASE}/api/auth/login",
            json=payload,
            headers=headers,
            timeout=10,
        )
        LOGGER.info("Codigo de respuesta: HTTP %s", resp.status_code)
        LOGGER.info("Respuesta del servidor: %s", resp.text[:300])

        if resp.status_code == 400:
            LOGGER.warning("[BLOQUEADO] CAPTCHA invalido o ausente (HTTP 400)")
        elif resp.status_code == 403:
            LOGGER.warning("[BLOQUEADO] Bot detectado por analisis de cabeceras (HTTP 403)")
        elif resp.status_code == 429:
            LOGGER.warning("[BLOQUEADO] Rate limit superado (HTTP 429)")
        elif resp.status_code == 200:
            LOGGER.error("[FALLO] Login exitoso - las medidas de seguridad no bloquearon al bot")
        else:
            LOGGER.info("Respuesta inesperada: %s", resp.status_code)

    except requests.ConnectionError:
        LOGGER.error("No se pudo conectar al backend en %s", API_BASE)


# ===========================================================================
# PRUEBA 2 - Rate Limit: rafaga de peticiones repetidas
# ===========================================================================
def prueba_rate_limit(intentos: int = 12) -> None:
    """
    Envia multiples peticiones en rafaga para superar el rate limit.
    express-rate-limit esta configurado para 5 intentos por ventana.
    """
    LOGGER.info("=" * 60)
    LOGGER.info("PRUEBA 2: Rate Limit - %s peticiones en rafaga", intentos)
    LOGGER.info("=" * 60)

    for i in range(1, intentos + 1):
        payload = {
            "email": EMAIL_BOT,
            "contrasena": "intento_invalido",
            "captchaRespuesta": "99",
        }
        try:
            resp = requests.post(
                f"{API_BASE}/api/auth/login",
                json=payload,
                timeout=5,
            )
            estado = resp.status_code
            bloqueado = "<- BLOQUEADO (Rate Limit)" if estado == 429 else ""
            LOGGER.info("  Intento %02d/%02d -> HTTP %s %s", i, intentos, estado, bloqueado)
            if estado == 429:
                LOGGER.warning("[BLOQUEADO] Rate limit activado en el intento #%d", i)
                break
        except requests.ConnectionError:
            LOGGER.error("Sin conexion al backend")
            break
        time.sleep(0.05)   # 50 ms entre peticiones = cadencia de bot


# ===========================================================================
# PRUEBA 3 - Selenium intentando rellenar el formulario sin comportamiento humano
# ===========================================================================
def prueba_selenium_formulario() -> None:
    """
    Abre el navegador automaticamente (navigator.webdriver = true),
    rellena el formulario sin movimientos de raton ni tiempos humanos,
    y observa como el servidor rechaza la solicitud.
    """
    LOGGER.info("=" * 60)
    LOGGER.info("PRUEBA 3: Selenium - formulario sin comportamiento humano")
    LOGGER.info("=" * 60)

    options = Options()
    # NO deshabilitamos AutomationControlled para que navigator.webdriver = true
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1280,720")

    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options,
    )
    wait = WebDriverWait(driver, 10)

    try:
        LOGGER.info("Navegando a %s ...", LOGIN_URL)
        driver.get(LOGIN_URL)
        time.sleep(1)

        # Verificar navigator.webdriver
        webdriver_flag = driver.execute_script("return navigator.webdriver")
        LOGGER.info("navigator.webdriver = %s  <- detectado por el frontend", webdriver_flag)

        # Buscar campos por tipo (el ID es dinamico/ofuscado)
        try:
            campo_email = wait.until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='email']"))
            )
            campo_password = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
            LOGGER.info("Campos encontrados por tipo (ofuscacion de ID no impidio el acceso)")
        except TimeoutException:
            LOGGER.error("No se encontraron los campos del formulario")
            return

        # Insercion instantanea (send_keys sin pausas)
        t_inicio = time.time()
        campo_email.clear()
        campo_email.send_keys(EMAIL_BOT)
        campo_password.clear()
        campo_password.send_keys(PASSWORD_BOT)
        t_llenado = (time.time() - t_inicio) * 1000

        LOGGER.info(
            "Tiempo de llenado: %.0f ms (humano promedio: 2,000-5,000 ms)",
            t_llenado,
        )

        # Intentar enviar sin resolver CAPTCHA
        try:
            btn_submit = driver.find_element(
                By.CSS_SELECTOR, "button[type='submit']"
            )
            btn_submit.click()
            LOGGER.info("Click en submit sin movimiento de raton previo")
        except NoSuchElementException:
            LOGGER.warning("Boton de submit no encontrado")

        time.sleep(2)

        # Capturar mensaje de error visible
        try:
            error_msg = driver.find_element(
                By.CSS_SELECTOR, ".error-message, .alert, [class*='error']"
            ).text
            LOGGER.warning("Mensaje en pantalla: '%s'", error_msg)
        except NoSuchElementException:
            pass

        LOGGER.info("URL final: %s", driver.current_url)
        if "/login" in driver.current_url:
            LOGGER.warning("[BLOQUEADO] El bot NO fue redirigido - Login rechazado")
        else:
            LOGGER.error("[FALLO] Login aparentemente exitoso")

    finally:
        LOGGER.info("Cerrando navegador...")
        driver.quit()


# ===========================================================================
# PUNTO DE ENTRADA
# ===========================================================================
def main() -> None:
    LOGGER.info("==========================================================")
    LOGGER.info("  PROYECTO_BLOG - Pruebas de seguridad con Selenium")
    LOGGER.info("==========================================================")
    LOGGER.info("")
    LOGGER.info("Asegurate de que el backend (puerto 3000) y el frontend")
    LOGGER.info("(puerto 5174) esten en ejecucion antes de continuar.")
    LOGGER.info("")

    prueba_api_directa()
    LOGGER.info("")

    prueba_rate_limit(intentos=12)
    LOGGER.info("")

    prueba_selenium_formulario()

    LOGGER.info("")
    LOGGER.info("Pruebas finalizadas. Revisa logs/acceso.log para ver")
    LOGGER.info("los registros de los intentos bloqueados.")


if __name__ == "__main__":
    main()
