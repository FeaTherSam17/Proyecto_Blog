"""
=============================================================================
selenium_bot_detectado.py
=============================================================================
Demuestra cómo el servidor PROYECTO_BLOG detecta y bloquea a Selenium.

El script ejecuta TRES intentos consecutivos sobre http://localhost:5174/login:

  Intento 1 — CAPTCHA vacío + navigator.webdriver expuesto
      → El frontend reporta navigator.webdriver = True
      → El formulario se envía sin resolver el CAPTCHA
      → El servidor responde: CAPTCHA inválido (HTTP 400)
      → Clasificación en BD: SOSPECHOSO

  Intento 2 — CAPTCHA correcto + comportamiento de bot
      (se lee la pregunta matemática y se resuelve automáticamente)
      → mousemove_count = 0, keydown_count = 0, focus_submit_ms < 200 ms
      → El servidor acepta la petición pero la clasifica como SOSPECHOSO
        porque ninguna métrica de comportamiento humano está presente

  Intento 3 — Rafaga directa a la API (sin pasar por el navegador)
      → Sin Referer → señal de automatización para botDetection.js
      → Sin Accept-Language → +15 puntos al score de bot
      → El servidor responde HTTP 400 o HTTP 429 (rate limit)

Requisitos:
    pip install selenium webdriver-manager requests

Ejecución:
    python selenium_bot_detectado.py
=============================================================================
"""

from __future__ import annotations

import logging
import re
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

# ─────────────────────────────────────────────
#  Configuración
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(message)s",
    datefmt="%H:%M:%S",
)
LOG = logging.getLogger("BOT")

FRONTEND = "http://localhost:5174"
BACKEND  = "http://localhost:3000"
LOGIN_URL = f"{FRONTEND}/login"

EMAIL    = "erikaadmin@gmail.com"   # cambia por un email real registrado
PASSWORD = "admin123"               # cambia por la contraseña real


# ─────────────────────────────────────────────
#  Utilidades
# ─────────────────────────────────────────────
def separador(titulo: str) -> None:
    LOG.info("")
    LOG.info("=" * 55)
    LOG.info("  %s", titulo)
    LOG.info("=" * 55)


def crear_driver() -> webdriver.Chrome:
    """
    Crea Chrome SIN deshabilitar AutomationControlled.
    navigator.webdriver permanece en True → detectado por evaluarHuellaNavegador()
    en Login.vue, que lo incluye en el payload enviado al backend.
    """
    opts = Options()
    # ── NO añadimos --disable-blink-features=AutomationControlled ──
    # Esto deja navigator.webdriver = true, que el frontend detecta y reporta.
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1280,800")
    # opts.add_argument("--headless")  # descomenta para modo sin ventana

    return webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=opts,
    )


# ─────────────────────────────────────────────
#  INTENTO 1: CAPTCHA vacío + webdriver expuesto
# ─────────────────────────────────────────────
def intento_captcha_vacio(driver: webdriver.Chrome) -> None:
    separador("INTENTO 1 — CAPTCHA vacío + navigator.webdriver expuesto")

    driver.get(LOGIN_URL)
    time.sleep(1.5)

    # ── Confirmar que navigator.webdriver está activo ──
    webdriver_flag = driver.execute_script("return navigator.webdriver")
    LOG.info("navigator.webdriver = %s  ← Selenium identificado", webdriver_flag)

    # ── Buscar campos por tipo (los IDs son dinámicos/ofuscados) ──
    wait = WebDriverWait(driver, 10)
    try:
        campo_email    = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='email']")))
        campo_password = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
        LOG.info("Campos localizados por tipo (ofuscacion de ID no bloqueo el acceso)")
    except TimeoutException:
        LOG.error("No se encontraron los campos. ¿Está corriendo el frontend?")
        return

    # ── Rellenar sin movimiento de ratón ni pausas entre teclas ──
    t0 = time.perf_counter()
    campo_email.send_keys(EMAIL)       # inserción instantánea (no dispara keydown real)
    campo_password.send_keys(PASSWORD)
    ms_llenado = (time.perf_counter() - t0) * 1000
    LOG.info("Tiempo de llenado = %.0f ms  (humano: ~2000-5000 ms)", ms_llenado)

    # ── Leer pregunta del CAPTCHA ──
    try:
        texto_captcha = driver.find_element(By.CSS_SELECTOR, ".captcha-question").text.strip()
        LOG.info("CAPTCHA visible: '%s'", texto_captcha)
    except NoSuchElementException:
        LOG.info("CAPTCHA no visible por selector estatico (IDs dinamicos)")

    # ── Enviar con CAPTCHA vacío (campo de texto en blanco) ──
    LOG.info("Enviando formulario SIN resolver el CAPTCHA...")
    try:
        btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
        btn.click()
    except NoSuchElementException:
        LOG.error("Botón submit no encontrado")
        return

    time.sleep(2)

    # ── Leer respuesta visible en pantalla ──
    try:
        msg = driver.find_element(By.CSS_SELECTOR, ".text-danger").text.strip()
        LOG.info("Respuesta del servidor (en pantalla): '%s'", msg)
    except NoSuchElementException:
        LOG.info("No se encontro mensaje de error visible en el DOM")

    url_final = driver.current_url
    if "/login" in url_final:
        LOG.warning("BLOQUEADO — El bot sigue en /login (no fue autenticado)")
    else:
        LOG.error("Login exitoso — revisar configuracion de seguridad")


# ─────────────────────────────────────────────
#  INTENTO 2: CAPTCHA resuelto pero métricas = 0
# ─────────────────────────────────────────────
def intento_captcha_resuelto_sin_comportamiento(driver: webdriver.Chrome) -> None:
    separador("INTENTO 2 — CAPTCHA resuelto pero sin comportamiento humano")

    driver.get(LOGIN_URL)
    time.sleep(1.5)

    wait = WebDriverWait(driver, 10)

    # ── Obtener la pregunta del CAPTCHA desde el DOM ──
    try:
        texto_captcha = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".captcha-question"))
        ).text.strip()
        LOG.info("Pregunta CAPTCHA: '%s'", texto_captcha)
    except TimeoutException:
        LOG.error("No se pudo leer el CAPTCHA")
        return

    # ── Resolver el CAPTCHA matemáticamente ──
    respuesta_captcha = resolver_captcha(texto_captcha)
    LOG.info("Respuesta calculada: %s", respuesta_captcha)

    # ── Rellenar campos SIN ningún movimiento de ratón ──
    campo_email    = driver.find_element(By.CSS_SELECTOR, "input[type='email']")
    campo_password = driver.find_element(By.CSS_SELECTOR, "input[type='password']")

    t0 = time.perf_counter()
    campo_email.send_keys(EMAIL)
    campo_password.send_keys(PASSWORD)

    # Campo del CAPTCHA: también por tipo=text (el ID es ofuscado)
    campos_text = driver.find_elements(By.CSS_SELECTOR, "input[type='text']")
    if campos_text:
        campos_text[0].send_keys(respuesta_captcha)

    ms_llenado = (time.perf_counter() - t0) * 1000
    LOG.info("Tiempo total de llenado = %.0f ms", ms_llenado)
    LOG.info("mousemove_count = 0  (send_keys no mueve el raton)")
    LOG.info("keydown_count   = 0  (send_keys no dispara eventos keydown del DOM)")
    LOG.info("focus_submit_ms = ~%.0f ms  (demasiado rapido para un humano)", ms_llenado)

    # ── Enviar ──
    btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
    btn.click()
    time.sleep(2)

    # ── Resultado ──
    try:
        msg = driver.find_element(By.CSS_SELECTOR, ".text-danger").text.strip()
        LOG.info("Respuesta del servidor: '%s'", msg)
    except NoSuchElementException:
        pass

    url_final = driver.current_url
    if "/login" in url_final:
        LOG.warning("BLOQUEADO — Permanece en /login")
        LOG.warning("El servidor registro el evento como SOSPECHOSO en la BD y en acceso.log")
    else:
        LOG.info("Redirigido a: %s", url_final)
        LOG.warning("Login exitoso pero clasificado como SOSPECHOSO en METRICAS_ACCESO")


def resolver_captcha(texto: str) -> str:
    """Evalúa expresiones tipo '3 + 8', '9 - 4', '6 * 2'."""
    try:
        # Extraer operandos y operador de forma segura
        m = re.match(r"(\d+)\s*([+\-*])\s*(\d+)", texto.replace("×", "*").replace("x", "*"))
        if m:
            a, op, b = int(m.group(1)), m.group(2), int(m.group(3))
            if op == "+":
                return str(a + b)
            if op == "-":
                return str(a - b)
            if op == "*":
                return str(a * b)
    except Exception:
        pass
    return "0"


# ─────────────────────────────────────────────
#  INTENTO 3: Ráfaga directa a la API (sin navegador)
# ─────────────────────────────────────────────
def intento_api_directa() -> None:
    separador("INTENTO 3 — Rafaga directa a la API (sin navegador)")

    LOG.info("Enviando 8 peticiones POST a /api/auth/login cada 50 ms...")
    LOG.info("(Sin Referer, sin Accept-Language → señales de bot para botDetection.js)")

    for i in range(1, 9):
        payload = {
            "email": EMAIL,
            "contrasena": PASSWORD,
            "captchaRespuesta": "",       # CAPTCHA vacío
            "comportamiento": {
                "mousemove_count": 0,
                "keydown_count": 0,
                "keyup_count": 0,
                "focus_submit_ms": 0,
                "navigator_webdriver": True,  # se delata como bot
            },
        }
        try:
            resp = requests.post(
                f"{BACKEND}/api/auth/login",
                json=payload,
                headers={"Content-Type": "application/json"},
                # ── Sin Referer ni Accept-Language ──
                timeout=5,
            )
            estado = resp.status_code
            razon = ""
            if estado == 400:
                razon = "← CAPTCHA invalido"
            elif estado == 429:
                razon = "← RATE LIMIT ACTIVADO"
            elif estado == 403:
                razon = "← BOT DETECTADO"
            elif estado == 200:
                razon = "← LOGIN EXITOSO (sin bloqueo)"

            LOG.info("  Peticion %d/8 → HTTP %d  %s", i, estado, razon)

            if estado == 429:
                LOG.warning("BLOQUEADO por Rate Limit en la peticion #%d", i)
                break

        except requests.ConnectionError:
            LOG.error("Sin conexion al backend en %s", BACKEND)
            break

        time.sleep(0.05)   # 50 ms entre peticiones = cadencia típica de bot


# ─────────────────────────────────────────────
#  PUNTO DE ENTRADA
# ─────────────────────────────────────────────
def main() -> None:
    LOG.info("==========================================================")
    LOG.info("  PROYECTO_BLOG — Selenium detectado como bot")
    LOG.info("==========================================================")
    LOG.info("")
    LOG.info("Asegurate de que el backend  (puerto 3000) este activo.")
    LOG.info("Asegurate de que el frontend (puerto 5174) este activo.")
    LOG.info("")

    driver = crear_driver()

    try:
        intento_captcha_vacio(driver)
        time.sleep(1)

        intento_captcha_resuelto_sin_comportamiento(driver)
        time.sleep(1)
    finally:
        driver.quit()

    intento_api_directa()

    LOG.info("")
    LOG.info("Script finalizado.")
    LOG.info("Revisa logs/acceso.log y el panel Admin > Auditoria para")
    LOG.info("ver los eventos clasificados como SOSPECHOSO.")


if __name__ == "__main__":
    main()
