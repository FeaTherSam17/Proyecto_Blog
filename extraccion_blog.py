"""
=============================================================================
extraccion_blog.py
=============================================================================
FASE 3 — Extracción, Procesamiento y Almacenamiento de Datos Oficiales

Script de scraping ético sobre PROYECTO_BLOG (localhost:5174/inicio).

ESTRATEGIA EN DOS FASES
------------------------
  Fase A — Selenium (navegación dinámica):
      1. Abre http://localhost:5174/inicio con Chrome.
      2. Espera a que Cloudflare Turnstile valide el acceso (automático en
         modo test: VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA).
      3. Extrae tarjetas de artículo usando WebDriverWait + localizadores CSS.
      4. Recorre la paginación (botón "SIG →") hasta agotar todas las páginas.
      5. Captura para cada tarjeta: título, categoría, fecha, autor, URL.

  Fase B — API REST (datos completos con sesión):
      1. Abre una sesión HTTP (requests.Session) para conservar la cookie.
      2. Llama a POST /api/blog/access con token vacío (modo test lo acepta).
      3. Llama a GET /api/blog/posts  → lista completa de publicaciones.
      4. Llama a GET /api/blog/categorias → catálogo de categorías.
      5. Obtiene el texto_publicacion completo (que Selenium solo ve truncado).

LIMPIEZA CON PANDAS
--------------------
  · Eliminación de duplicados (por id_publicacion).
  · Eliminación de filas con valores nulos en campos críticos.
  · Formateo de fechas → columna fecha_dt (datetime64).
  · Normalización de texto (strip, título capitalizado).
  · Extracción de longitud de texto (num_palabras).
  · Generación de resumen estadístico por categoría.

ENTREGABLES
-----------
  df_articulos   → impreso en consola y guardado en scraping_output/articulos.csv
  df_categorias  → impreso en consola y guardado en scraping_output/categorias.csv
  df_stats       → resumen por categoría impreso en consola
  scraping_output/comparacion_selenium_api.csv → diferencias entre ambas fases

Requisitos:
    pip install selenium webdriver-manager requests pandas tabulate

Ejecución:
    python extraccion_blog.py
    python extraccion_blog.py --max-paginas 3    # limitar páginas Selenium
    python extraccion_blog.py --solo-api         # saltar Selenium
    python extraccion_blog.py --visible          # mostrar ventana Chrome
=============================================================================
"""

from __future__ import annotations

import argparse
import logging
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd
import requests
from selenium import webdriver
from selenium.common.exceptions import (
    NoSuchElementException,
    StaleElementReferenceException,
    TimeoutException,
)
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

# ─────────────────────────────────────────────────────────────────────────────
#  Configuración global
# ─────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
LOG = logging.getLogger("BLOG_SCRAPER")

FRONTEND   = "http://localhost:5174"
BACKEND    = "http://localhost:3002"   # puerto real del .env (PORT=3002)
INICIO_URL = f"{FRONTEND}/inicio"
OUTPUT_DIR = Path(__file__).resolve().parent / "scraping_output"


# ─────────────────────────────────────────────────────────────────────────────
#  FASE A — SELENIUM: Navegación dinámica en el frontend Vue
# ─────────────────────────────────────────────────────────────────────────────

def crear_driver(headless: bool = True) -> webdriver.Chrome:
    """
    Crea Chrome con configuración mínima de detección.
    Se mantiene navigator.webdriver = true a propósito para que
    el entorno de prueba pueda registrar la visita.
    """
    opts = Options()
    if headless:
        opts.add_argument("--headless=new")          # Chrome headless moderno
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1400,900")
    opts.add_argument("--lang=es-MX")
    opts.add_experimental_option(
        "prefs", {"profile.default_content_setting_values.notifications": 2}
    )
    return webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=opts,
    )


def esperar_contenido_blog(wait: WebDriverWait) -> bool:
    """
    Espera a que desaparezca el estado de carga de Turnstile y aparezcan
    las tarjetas de artículo. Retorna True si se cargó correctamente.
    """
    LOG.info("Esperando validación Turnstile y carga del blog...")
    try:
        # Esperar que el spinner/verificación desaparezca
        wait.until(
            EC.invisibility_of_element_located(
                (By.CSS_SELECTOR, ".blog-access-state")
            )
        )
        LOG.info("Proteccion Turnstile superada o en modo test.")
    except TimeoutException:
        LOG.warning("blog-access-state no se ocultó en tiempo — continuando.")

    try:
        wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "a.blog-card"))
        )
        LOG.info("Tarjetas de articulo detectadas en el DOM.")
        return True
    except TimeoutException:
        LOG.error("No se encontraron tarjetas (.blog-card) — revisar si hay publicaciones.")
        return False


def extraer_tarjetas_pagina(driver: webdriver.Chrome, pagina: int) -> list[dict[str, Any]]:
    """
    Extrae los datos visibles de cada tarjeta .blog-card en la página actual.
    Usa localizadores CSS robustos derivados de Inicio.vue.

    Estructura DOM de cada tarjeta (segun Inicio.vue):
      <a class="blog-card" href="/articulo/{id}">
        <div class="category-tag"> CATEGORÍA • FECHA </div>
        <h2> TÍTULO... </h2>
        <p class="text-secondary serif"> EXTRACTO... </p>
        <div class="d-flex ...">
          <span> POR AUTOR </span>
          <span> LEER MÁS → </span>
        </div>
      </a>
    """
    registros: list[dict[str, Any]] = []

    try:
        tarjetas = driver.find_elements(By.CSS_SELECTOR, "a.blog-card")
    except Exception as exc:
        LOG.warning("Error al buscar tarjetas en pagina %s: %s", pagina, exc)
        return registros

    LOG.info("Pagina %s: %s tarjetas encontradas.", pagina, len(tarjetas))

    for idx, tarjeta in enumerate(tarjetas, start=1):
        try:
            # ── URL del artículo ──────────────────────────────────────────
            href = tarjeta.get_attribute("href") or ""
            id_match = re.search(r"/articulo/(\d+)", href)
            id_pub = int(id_match.group(1)) if id_match else None

            # ── Categoría y fecha ─────────────────────────────────────────
            cat_fecha_el = tarjeta.find_element(By.CSS_SELECTOR, ".category-tag")
            cat_fecha_texto = cat_fecha_el.text.strip()
            partes = [p.strip() for p in cat_fecha_texto.split("•")]
            categoria = partes[0] if len(partes) > 0 else ""
            fecha_raw = partes[1] if len(partes) > 1 else ""

            # ── Título ────────────────────────────────────────────────────
            titulo_el = tarjeta.find_element(By.CSS_SELECTOR, "h2")
            titulo = titulo_el.text.strip().rstrip(".").strip()

            # ── Extracto ──────────────────────────────────────────────────
            try:
                extracto_el = tarjeta.find_element(By.CSS_SELECTOR, "p.serif")
                extracto = extracto_el.text.strip().rstrip(".").strip()
            except NoSuchElementException:
                extracto = ""

            # ── Autor ─────────────────────────────────────────────────────
            spans = tarjeta.find_elements(
                By.CSS_SELECTOR, ".d-flex.align-items-center span"
            )
            autor_raw = spans[0].text.strip() if spans else ""
            autor = re.sub(r"^POR\s+", "", autor_raw, flags=re.IGNORECASE).strip()

            registros.append(
                {
                    "fuente": "selenium",
                    "pagina_scraping": pagina,
                    "id_publicacion": id_pub,
                    "titulo_selenium": titulo,
                    "categoria": categoria,
                    "fecha_raw": fecha_raw,
                    "autor_selenium": autor,
                    "extracto": extracto,
                    "url": href,
                }
            )

        except (NoSuchElementException, StaleElementReferenceException) as exc:
            LOG.warning("  Tarjeta #%s en pag. %s omitida: %s", idx, pagina, exc)

    return registros


def avanzar_pagina_blog(driver: webdriver.Chrome, wait: WebDriverWait) -> bool:
    """
    Hace clic en el botón de paginación 'SIG →' del blog Vue.
    Detecta el cambio de contenido esperando staleness de las tarjetas previas.
    Retorna True si se avanzó correctamente.
    """
    try:
        botones = driver.find_elements(
            By.CSS_SELECTOR, "button.pagination-nav:not([disabled])"
        )
        btn_siguiente = None
        for btn in botones:
            if "SIG" in btn.text.upper() or "→" in btn.text:
                btn_siguiente = btn
                break

        if btn_siguiente is None:
            LOG.info("No hay boton 'SIG' activo — ultima pagina alcanzada.")
            return False

        tarjetas_actuales = driver.find_elements(By.CSS_SELECTOR, "a.blog-card")
        btn_siguiente.click()
        LOG.info("Click en 'SIG' — esperando carga de nueva pagina...")

        if tarjetas_actuales:
            try:
                wait.until(EC.staleness_of(tarjetas_actuales[0]))
            except TimeoutException:
                pass

        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "a.blog-card")))
        time.sleep(0.8)   # pausa educada entre páginas
        return True

    except (TimeoutException, StaleElementReferenceException) as exc:
        LOG.warning("No se pudo avanzar de pagina: %s", exc)
        return False


def scraping_selenium(
    max_paginas: int | None = None,
    headless: bool = True,
    timeout: int = 20,
) -> list[dict[str, Any]]:
    """
    Punto de entrada de la Fase A.
    Navega http://localhost:5174/inicio, extrae todas las tarjetas de artículo
    recorriendo la paginación Vue, y devuelve una lista de registros crudos.
    """
    LOG.info("")
    LOG.info("=" * 65)
    LOG.info("  FASE A — Selenium: Navegacion dinamica en el frontend Vue")
    LOG.info("=" * 65)
    LOG.info("URL objetivo : %s", INICIO_URL)
    LOG.info("Max paginas  : %s", max_paginas or "todas")
    LOG.info("Modo headless: %s", headless)
    LOG.info("")

    driver = crear_driver(headless=headless)
    wait   = WebDriverWait(driver, timeout)
    datos: list[dict[str, Any]] = []

    try:
        LOG.info("Navegando a %s ...", INICIO_URL)
        driver.get(INICIO_URL)

        # Verificar presencia de navigator.webdriver
        webdriver_flag = driver.execute_script("return navigator.webdriver")
        LOG.info(
            "navigator.webdriver = %s  (Selenium visible para el servidor)",
            webdriver_flag,
        )

        cargado = esperar_contenido_blog(wait)
        if not cargado:
            LOG.error("El blog no cargo contenido. Abortando Fase A.")
            return datos

        pagina = 1
        while True:
            LOG.info("")
            LOG.info("── Extrayendo pagina %s ──", pagina)
            registros_pagina = extraer_tarjetas_pagina(driver, pagina)
            datos.extend(registros_pagina)

            if not registros_pagina:
                LOG.warning("Pagina %s sin registros — deteniendo paginacion.", pagina)
                break

            if max_paginas is not None and pagina >= max_paginas:
                LOG.info("Limite de %s paginas alcanzado.", max_paginas)
                break

            if not avanzar_pagina_blog(driver, wait):
                break

            pagina += 1

        LOG.info("")
        LOG.info(
            "Selenium: %s registros crudos extraidos de %s pagina(s).",
            len(datos),
            pagina,
        )

    except Exception as exc:
        LOG.error("Error inesperado en Fase A: %s", exc, exc_info=True)
    finally:
        driver.quit()
        LOG.info("Navegador cerrado.")

    return datos


# ─────────────────────────────────────────────────────────────────────────────
#  FASE B — API REST: Datos completos vía sesión HTTP con cookie
# ─────────────────────────────────────────────────────────────────────────────

def obtener_acceso_blog(sesion: requests.Session) -> bool:
    """
    Llama a POST /api/blog/access para obtener la cookie de sesión.
    En modo test (TURNSTILE_SECRET_KEY = 1x0000...AA) el token vacío es aceptado.
    """
    LOG.info("Solicitando acceso al blog via API (POST /api/blog/access)...")
    try:
        resp = sesion.post(
            f"{BACKEND}/api/blog/access",
            json={"token": ""},   # token vacio aceptado en modo test
            headers={
                "Content-Type": "application/json",
                "Origin":  FRONTEND,
                "Referer": INICIO_URL,
            },
            timeout=10,
        )
        if resp.status_code == 200 and resp.json().get("accessGranted"):
            LOG.info("Acceso concedido. Cookie de sesion establecida.")
            return True
        LOG.error("HTTP %s al solicitar acceso: %s", resp.status_code, resp.text[:200])
        return False
    except requests.ConnectionError:
        LOG.error("Sin conexion al backend en %s", BACKEND)
        return False


def obtener_publicaciones_api(sesion: requests.Session) -> list[dict[str, Any]]:
    """Obtiene todas las publicaciones desde GET /api/blog/posts."""
    LOG.info("Obteniendo publicaciones desde GET /api/blog/posts ...")
    try:
        resp = sesion.get(
            f"{BACKEND}/api/blog/posts",
            headers={"Referer": INICIO_URL},
            timeout=15,
        )
        if resp.status_code == 200:
            datos = resp.json()
            LOG.info("API devolvio %s publicaciones.", len(datos))
            return datos
        elif resp.status_code == 403:
            LOG.error("HTTP 403 — Acceso bloqueado (sesion no valida o Turnstile activo).")
        else:
            LOG.error("HTTP %s: %s", resp.status_code, resp.text[:200])
    except requests.ConnectionError:
        LOG.error("Sin conexion al backend.")
    return []


def obtener_categorias_api(sesion: requests.Session) -> list[dict[str, Any]]:
    """Obtiene el catálogo de categorías desde GET /api/blog/categorias."""
    LOG.info("Obteniendo categorias desde GET /api/blog/categorias ...")
    try:
        resp = sesion.get(
            f"{BACKEND}/api/blog/categorias",
            headers={"Referer": INICIO_URL},
            timeout=10,
        )
        if resp.status_code == 200:
            datos = resp.json()
            LOG.info("API devolvio %s categorias.", len(datos))
            return datos
        else:
            LOG.error("HTTP %s al obtener categorias.", resp.status_code)
    except requests.ConnectionError:
        LOG.error("Sin conexion al backend.")
    return []


def scraping_api() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Punto de entrada de la Fase B.
    Establece sesión HTTP, obtiene acceso al blog, y retorna
    (publicaciones, categorias) como listas de dicts crudos.
    """
    LOG.info("")
    LOG.info("=" * 65)
    LOG.info("  FASE B — API REST: Extraccion con sesion HTTP")
    LOG.info("=" * 65)
    LOG.info("Backend URL : %s", BACKEND)
    LOG.info("")

    sesion = requests.Session()
    sesion.headers.update({
        "User-Agent": "PROYECTO_BLOG-Scraper/1.0 (Fase3-TAD; fines academicos)",
        "Accept": "application/json",
        "Accept-Language": "es-MX,es;q=0.9",
    })

    if not obtener_acceso_blog(sesion):
        LOG.warning("No se pudo obtener acceso al blog. Extraccion API vacia.")
        return [], []

    time.sleep(0.5)
    publicaciones = obtener_publicaciones_api(sesion)

    time.sleep(0.3)
    categorias = obtener_categorias_api(sesion)

    return publicaciones, categorias


# ─────────────────────────────────────────────────────────────────────────────
#  LIMPIEZA Y ESTRUCTURACIÓN CON PANDAS
# ─────────────────────────────────────────────────────────────────────────────

def limpiar_publicaciones(raw: list[dict[str, Any]]) -> pd.DataFrame:
    """
    Transforma la lista cruda de publicaciones de la API en un DataFrame limpio.

    Pasos de limpieza:
      1. Crear DataFrame desde la lista de dicts.
      2. Seleccionar y renombrar columnas relevantes.
      3. Eliminar duplicados por id_publicacion.
      4. Eliminar filas con título o texto nulos/vacíos.
      5. Normalizar texto: strip, capitalización del título.
      6. Formatear fecha_publicacion → datetime64.
      7. Extraer año y mes de publicación.
      8. Calcular longitud del texto (num_palabras, num_chars).
      9. Generar URL canónica del artículo.
    """
    if not raw:
        LOG.warning("Sin datos de API para limpiar.")
        return pd.DataFrame()

    LOG.info("")
    LOG.info("── Limpieza de publicaciones (API) ──")

    df = pd.DataFrame(raw)
    LOG.info("Columnas recibidas de la API: %s", list(df.columns))
    LOG.info("Shape inicial: %s filas x %s columnas", *df.shape)

    # ── 1. Renombrar columnas para consistencia ───────────────────────────
    columnas_mapa = {
        "id_publicacion":    "id",
        "titulo":            "titulo",
        "texto_publicacion": "texto",
        "fecha_publicacion": "fecha_publicacion",
        "nombre_categoria":  "categoria",
        "autor_nombre":      "autor",
    }
    columnas_existentes = {k: v for k, v in columnas_mapa.items() if k in df.columns}
    df = df[list(columnas_existentes.keys())].rename(columns=columnas_existentes)

    LOG.info("Columnas seleccionadas: %s", list(df.columns))

    # ── 2. Duplicados ─────────────────────────────────────────────────────
    antes = len(df)
    df = df.drop_duplicates(subset=["id"])
    LOG.info("Duplicados eliminados: %s -> %s filas", antes, len(df))

    # ── 3. Nulos / vacíos en campos críticos ─────────────────────────────
    antes = len(df)
    df = df.dropna(subset=["titulo", "texto"])
    df = df[df["titulo"].str.strip() != ""]
    df = df[df["texto"].str.strip() != ""]
    LOG.info("Filas con nulos criticos eliminadas: %s -> %s filas", antes, len(df))

    # ── 4. Normalización de texto ─────────────────────────────────────────
    df["titulo"]    = df["titulo"].str.strip().str.title()
    df["texto"]     = df["texto"].str.strip()
    df["categoria"] = (
        df["categoria"].str.strip().str.upper()
        if "categoria" in df.columns else "SIN CATEGORIA"
    )
    df["autor"] = (
        df["autor"].str.strip().str.title()
        if "autor" in df.columns else "Desconocido"
    )
    df["categoria"] = df["categoria"].fillna("SIN CATEGORIA")
    df["autor"]     = df["autor"].fillna("Desconocido")

    # ── 5. Formateo de fecha ──────────────────────────────────────────────
    if "fecha_publicacion" in df.columns:
        df["fecha_dt"] = pd.to_datetime(df["fecha_publicacion"], errors="coerce", utc=True)
        df["fecha_dt"] = df["fecha_dt"].dt.tz_localize(None)
        df["anio"]     = df["fecha_dt"].dt.year.astype("Int64")
        df["mes"]      = df["fecha_dt"].dt.month.astype("Int64")
        df["fecha_fmt"] = df["fecha_dt"].dt.strftime("%d/%m/%Y")
        nulos_fecha = df["fecha_dt"].isna().sum()
        if nulos_fecha:
            LOG.warning("%s fechas no pudieron parsearse -> NaT.", nulos_fecha)
    else:
        df["fecha_dt"]  = pd.NaT
        df["fecha_fmt"] = ""
        df["anio"]      = pd.NA
        df["mes"]       = pd.NA

    # ── 6. Métricas de texto ──────────────────────────────────────────────
    df["num_palabras"] = df["texto"].str.split().str.len()
    df["num_chars"]    = df["texto"].str.len()

    # ── 7. URL canónica ───────────────────────────────────────────────────
    df["url_articulo"] = FRONTEND + "/articulo/" + df["id"].astype(str)

    # ── 8. Reordenar columnas ─────────────────────────────────────────────
    orden = [
        "id", "titulo", "autor", "categoria", "fecha_fmt", "anio", "mes",
        "num_palabras", "num_chars", "url_articulo", "texto",
    ]
    orden_final = [c for c in orden if c in df.columns]
    df = df[orden_final].reset_index(drop=True)

    LOG.info("Shape final limpio: %s filas x %s columnas", *df.shape)
    return df


def limpiar_categorias(raw: list[dict[str, Any]]) -> pd.DataFrame:
    """Limpia el catálogo de categorías devuelto por la API."""
    if not raw:
        return pd.DataFrame()

    LOG.info("")
    LOG.info("── Limpieza de categorias ──")
    df = pd.DataFrame(raw)
    LOG.info("Columnas recibidas: %s", list(df.columns))

    cols = [c for c in ["id_categoria", "nombre_categoria", "descripcion"] if c in df.columns]
    df = df[cols].drop_duplicates().dropna(subset=["nombre_categoria"])
    df["nombre_categoria"] = df["nombre_categoria"].str.strip().str.upper()
    df = df.reset_index(drop=True)

    LOG.info("Categorias limpias: %s", len(df))
    return df


def limpiar_selenium(raw: list[dict[str, Any]]) -> pd.DataFrame:
    """Limpia los datos extraídos por Selenium (tarjetas del frontend)."""
    if not raw:
        return pd.DataFrame()

    LOG.info("")
    LOG.info("── Limpieza de datos Selenium ──")
    df = pd.DataFrame(raw)
    antes = len(df)
    df = df.drop_duplicates(subset=["id_publicacion"])
    df = df.dropna(subset=["titulo_selenium"])
    df = df[df["titulo_selenium"].str.strip() != ""]
    LOG.info("Selenium: %s -> %s filas tras limpieza.", antes, len(df))

    df["titulo_selenium"] = df["titulo_selenium"].str.strip().str.title()
    df["categoria"]       = df["categoria"].str.strip().str.upper()
    df["autor_selenium"]  = df["autor_selenium"].str.strip().str.title()
    df["extracto"]        = df["extracto"].str.strip()

    return df.reset_index(drop=True)


def generar_estadisticas(df: pd.DataFrame) -> pd.DataFrame:
    """Genera un resumen estadístico agrupado por categoría."""
    if df.empty or "categoria" not in df.columns:
        return pd.DataFrame()

    stats = (
        df.groupby("categoria", as_index=False)
        .agg(
            total_articulos=("id", "count"),
            promedio_palabras=("num_palabras", "mean"),
            max_palabras=("num_palabras", "max"),
            min_palabras=("num_palabras", "min"),
            autores_unicos=("autor", pd.Series.nunique),
        )
        .sort_values("total_articulos", ascending=False)
        .reset_index(drop=True)
    )
    stats["promedio_palabras"] = stats["promedio_palabras"].round(1)
    return stats


def comparar_fuentes(
    df_selenium: pd.DataFrame, df_api: pd.DataFrame
) -> pd.DataFrame:
    """
    Cruza los datos de Selenium con los de la API por id_publicacion.
    Detecta discrepancias entre el frontend y los datos reales.
    """
    if df_selenium.empty or df_api.empty:
        return pd.DataFrame()

    df_sel = df_selenium[["id_publicacion", "titulo_selenium", "autor_selenium"]].copy()
    df_sel = df_sel.rename(columns={"id_publicacion": "id"})

    df_api_cmp = df_api[["id", "titulo", "autor"]].copy()

    merged = df_sel.merge(df_api_cmp, on="id", how="outer", suffixes=("_sel", "_api"))
    merged["titulo_coincide"] = (
        merged["titulo_selenium"].str.lower().str[:40]
        == merged["titulo"].str.lower().str[:40]
    )
    merged["autor_coincide"] = (
        merged["autor_selenium"].str.lower() == merged["autor"].str.lower()
    )
    return merged


# ─────────────────────────────────────────────────────────────────────────────
#  IMPRESIÓN Y EXPORTACIÓN
# ─────────────────────────────────────────────────────────────────────────────

def imprimir_df(df: pd.DataFrame, titulo: str, max_filas: int = 10) -> None:
    """Imprime un DataFrame en consola con un encabezado decorativo."""
    print()
    print("+" + "-" * (len(titulo) + 2) + "+")
    print(f"| {titulo} |")
    print("+" + "-" * (len(titulo) + 2) + "+")
    if df.empty:
        print("  (sin datos)")
        return

    # Columnas a mostrar (excluir 'texto' para no saturar la consola)
    cols_mostrar = [c for c in df.columns if c not in ("texto", "texto_completo")]

    try:
        from tabulate import tabulate
        print(tabulate(
            df[cols_mostrar].head(max_filas),
            headers="keys",
            tablefmt="rounded_outline",
            showindex=False,
            maxcolwidths=35,
        ))
    except ImportError:
        with pd.option_context(
            "display.max_columns", None,
            "display.width", 160,
            "display.max_colwidth", 35,
        ):
            print(df[cols_mostrar].head(max_filas).to_string(index=False))

    total = len(df)
    if total > max_filas:
        print(f"  ... y {total - max_filas} filas mas (total: {total})")


def guardar_csv(df: pd.DataFrame, nombre: str) -> Path:
    """Guarda un DataFrame como CSV en OUTPUT_DIR."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ruta = OUTPUT_DIR / nombre
    df.to_csv(ruta, index=False, encoding="utf-8-sig")
    LOG.info("Guardado: %s  (%s filas)", ruta, len(df))
    return ruta


# ─────────────────────────────────────────────────────────────────────────────
#  PUNTO DE ENTRADA
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scraper etico de PROYECTO_BLOG — Fase 3 TAD"
    )
    parser.add_argument(
        "--max-paginas", type=int, default=None,
        help="Limite de paginas a recorrer con Selenium (por defecto: todas)",
    )
    parser.add_argument(
        "--visible", action="store_true",
        help="Mostrar ventana de Chrome (por defecto: headless)",
    )
    parser.add_argument(
        "--solo-api", action="store_true",
        help="Saltar Fase A (Selenium) y ejecutar solo Fase B (API)",
    )
    parser.add_argument(
        "--timeout", type=int, default=20,
        help="Segundos de espera maxima en WebDriverWait (por defecto: 20)",
    )
    args = parser.parse_args()

    print()
    print("=" * 65)
    print("  PROYECTO_BLOG — Script de Extraccion y Limpieza de Datos")
    print("  Fase 3: Extraccion, Procesamiento y Almacenamiento")
    print("=" * 65)
    print(f"  Frontend : {FRONTEND}")
    print(f"  Backend  : {BACKEND}")
    print(f"  Salida   : {OUTPUT_DIR}")
    print(f"  Inicio   : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 65)

    # ── FASE A: Selenium ──────────────────────────────────────────────────
    df_selenium = pd.DataFrame()

    if not args.solo_api:
        datos_selenium = scraping_selenium(
            max_paginas=args.max_paginas,
            headless=not args.visible,
            timeout=args.timeout,
        )
        df_selenium = limpiar_selenium(datos_selenium)
    else:
        LOG.info("Fase A (Selenium) omitida por --solo-api.")

    # ── FASE B: API REST ──────────────────────────────────────────────────
    raw_publicaciones, raw_categorias = scraping_api()

    df_articulos  = limpiar_publicaciones(raw_publicaciones)
    df_categorias = limpiar_categorias(raw_categorias)

    # ── ESTADÍSTICAS ──────────────────────────────────────────────────────
    df_stats = generar_estadisticas(df_articulos)

    # ── COMPARACIÓN SELENIUM vs API ───────────────────────────────────────
    df_comparacion = comparar_fuentes(df_selenium, df_articulos)

    # ── IMPRESIÓN EN CONSOLA ──────────────────────────────────────────────
    print()
    print("=" * 65)
    print("  RESULTADOS — DATOS PROCESADOS CON PANDAS")
    print("=" * 65)

    imprimir_df(df_articulos,  "ARTICULOS DEL BLOG (API + Pandas)", max_filas=15)
    imprimir_df(df_categorias, "CATALOGO DE CATEGORIAS",            max_filas=20)
    imprimir_df(df_stats,      "ESTADISTICAS POR CATEGORIA",        max_filas=20)

    if not df_selenium.empty:
        imprimir_df(df_selenium,    "DATOS EXTRAIDOS POR SELENIUM", max_filas=10)

    if not df_comparacion.empty:
        imprimir_df(df_comparacion, "COMPARACION: Selenium vs API", max_filas=10)

    # ── RESUMEN GENERAL ───────────────────────────────────────────────────
    print()
    print("-" * 65)
    print("  RESUMEN FINAL")
    print("-" * 65)
    print(f"  Articulos extraidos (API)        : {len(df_articulos)}")
    print(f"  Categorias extraidas (API)       : {len(df_categorias)}")
    print(f"  Tarjetas extraidas (Selenium)    : {len(df_selenium)}")
    if not df_articulos.empty and "num_palabras" in df_articulos.columns:
        print(f"  Promedio palabras por articulo   : {df_articulos['num_palabras'].mean():.0f}")
    if not df_articulos.empty and "categoria" in df_articulos.columns:
        print(f"  Categorias unicas                : {df_articulos['categoria'].nunique()}")
    print("-" * 65)

    # ── EXPORTAR CSV ──────────────────────────────────────────────────────
    print()
    LOG.info("Exportando archivos CSV a %s ...", OUTPUT_DIR)

    if not df_articulos.empty:
        guardar_csv(df_articulos,  "articulos.csv")
    if not df_categorias.empty:
        guardar_csv(df_categorias, "categorias.csv")
    if not df_stats.empty:
        guardar_csv(df_stats,      "estadisticas_por_categoria.csv")
    if not df_selenium.empty:
        guardar_csv(df_selenium,   "datos_selenium.csv")
    if not df_comparacion.empty:
        guardar_csv(df_comparacion, "comparacion_selenium_api.csv")

    print()
    print("=" * 65)
    print(f"  Script finalizado: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Archivos guardados en: {OUTPUT_DIR}")
    print("=" * 65)
    print()


if __name__ == "__main__":
    main()
