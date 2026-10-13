"""Extracción controlada de libros desde Books to Scrape."""

from __future__ import annotations

import argparse
import logging
import re
import time
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import pandas as pd
from selenium import webdriver
from selenium.common.exceptions import (
    NoSuchElementException,
    StaleElementReferenceException,
    TimeoutException,
    WebDriverException,
)
from selenium.webdriver.common.by import By
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


LOGGER = logging.getLogger(__name__)
DEFAULT_URL = "https://books.toscrape.com/"
RATINGS = {"One": 1, "Two": 2, "Three": 3, "Four": 4, "Five": 5}


def extraer_libros(driver: WebDriver, pagina: int) -> list[dict[str, Any]]:
    """Extrae y valida los libros visibles en la página actual."""
    productos = driver.find_elements(By.CSS_SELECTOR, "article.product_pod")
    datos: list[dict[str, Any]] = []
    LOGGER.info("Página %s: %s productos encontrados", pagina, len(productos))

    for numero, producto in enumerate(productos, start=1):
        try:
            enlace = producto.find_element(By.CSS_SELECTOR, "h3 a")
            nombre = enlace.get_attribute("title") or enlace.text.strip()
            precio_texto = producto.find_element(
                By.CSS_SELECTOR, ".price_color"
            ).text.strip()
            rating_clase = producto.find_element(
                By.CSS_SELECTOR, ".star-rating"
            ).get_attribute("class") or ""
            rating_nombre = rating_clase.split()[-1]
            url = urljoin(driver.current_url, enlace.get_attribute("href") or "")

            precio_match = re.search(r"[\d,.]+", precio_texto)
            if not nombre or not precio_match or rating_nombre not in RATINGS or not url:
                raise ValueError("El producto contiene datos incompletos o inválidos")

            datos.append(
                {
                    "pagina": pagina,
                    "nombre": nombre,
                    "precio": float(precio_match.group().replace(",", "")),
                    "rating": RATINGS[rating_nombre],
                    "url": url,
                }
            )
        except (NoSuchElementException, StaleElementReferenceException, ValueError) as error:
            LOGGER.warning("Producto #%s omitido: %s", numero, error)

    return datos


def procesar_pagina(
    driver: WebDriver,
    wait: WebDriverWait,
    pagina: int,
    max_intentos: int,
) -> list[dict[str, Any]] | None:
    """Espera y extrae una página, repitiendo sólo ante fallos recuperables."""
    for intento in range(1, max_intentos + 1):
        try:
            wait.until(
                EC.presence_of_all_elements_located(
                    (By.CSS_SELECTOR, "article.product_pod")
                )
            )
            libros = extraer_libros(driver, pagina)
            if not libros:
                raise WebDriverException("No se encontraron libros válidos")
            return libros
        except (TimeoutException, WebDriverException) as error:
            LOGGER.warning(
                "Página %s: intento %s/%s fallido: %s",
                pagina,
                intento,
                max_intentos,
                error,
            )
            if intento < max_intentos:
                time.sleep(1)
    return None


def avanzar_pagina(
    driver: WebDriver, wait: WebDriverWait, max_intentos: int
) -> bool:
    """Avanza con control de elementos obsoletos y confirma el cambio de página."""
    for intento in range(1, max_intentos + 1):
        try:
            productos_actuales = driver.find_elements(
                By.CSS_SELECTOR, "article.product_pod"
            )
            siguiente = wait.until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, ".next a"))
            )
            siguiente.click()
            if productos_actuales:
                wait.until(EC.staleness_of(productos_actuales[0]))
            return True
        except (TimeoutException, StaleElementReferenceException, WebDriverException) as error:
            LOGGER.warning(
                "Next: intento %s/%s fallido: %s", intento, max_intentos, error
            )
            if intento < max_intentos:
                time.sleep(1)
    return False


def crear_driver(headless: bool) -> WebDriver:
    """Crea el navegador Firefox con configuración reproducible."""
    options = Options()
    if headless:
        options.add_argument("-headless")
    return webdriver.Firefox(options=options)


def extraer_catalogo(
    url: str,
    timeout: int = 15,
    max_intentos: int = 3,
    max_paginas: int | None = None,
    headless: bool = True,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Recorre el catálogo y devuelve datos extraídos junto con fallos controlados."""
    datos: list[dict[str, Any]] = []
    errores: list[dict[str, Any]] = []
    pagina = 1
    visitadas: set[str] = set()
    driver = crear_driver(headless)
    wait = WebDriverWait(driver, timeout)

    try:
        driver.get(url)
        while True:
            url_actual = driver.current_url
            if url_actual in visitadas:
                errores.append(
                    {"pagina": pagina, "url": url_actual, "error": "Página repetida"}
                )
                break
            visitadas.add(url_actual)

            libros = procesar_pagina(driver, wait, pagina, max_intentos)
            if libros is None:
                errores.append(
                    {
                        "pagina": pagina,
                        "url": url_actual,
                        "error": f"Falló después de {max_intentos} intentos",
                    }
                )
            else:
                datos.extend(libros)

            if max_paginas is not None and pagina >= max_paginas:
                break
            if not driver.find_elements(By.CSS_SELECTOR, ".next a"):
                break
            if not avanzar_pagina(driver, wait, max_intentos):
                errores.append(
                    {
                        "pagina": pagina,
                        "url": driver.current_url,
                        "error": "No se pudo avanzar con Next",
                    }
                )
                break
            pagina += 1
    finally:
        driver.quit()

    return datos, errores


def guardar_resultados(
    datos: list[dict[str, Any]],
    errores: list[dict[str, Any]],
    directorio_salida: Path,
) -> tuple[Path, Path | None]:
    """Guarda los resultados y devuelve las rutas generadas."""
    directorio_salida.mkdir(parents=True, exist_ok=True)
    archivo_datos = directorio_salida / "books.csv"
    pd.DataFrame(
        datos,
        columns=["pagina", "nombre", "precio", "rating", "url"],
    ).drop_duplicates(subset=["url"]).to_csv(
        archivo_datos, index=False, encoding="utf-8"
    )

    archivo_errores: Path | None = None
    if errores:
        archivo_errores = directorio_salida / "errores.csv"
        pd.DataFrame(errores).to_csv(archivo_errores, index=False, encoding="utf-8")
    return archivo_datos, archivo_errores


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=DEFAULT_URL, help="URL inicial del catálogo")
    parser.add_argument("--timeout", type=int, default=15, help="Espera máxima en segundos")
    parser.add_argument("--intentos", type=int, default=3, help="Intentos por operación")
    parser.add_argument("--max-paginas", type=int, help="Límite opcional de páginas")
    parser.add_argument(
        "--visible",
        action="store_true",
        help="Muestra Firefox; por defecto se ejecuta en modo headless",
    )
    parser.add_argument(
        "--salida",
        type=Path,
        default=Path(__file__).resolve().parent,
        help="Directorio donde se guardarán los CSV",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    if args.timeout <= 0 or args.intentos <= 0 or (
        args.max_paginas is not None and args.max_paginas <= 0
    ):
        parser.error("timeout, intentos y max-paginas deben ser mayores que cero")

    datos, errores = extraer_catalogo(
        url=args.url,
        timeout=args.timeout,
        max_intentos=args.intentos,
        max_paginas=args.max_paginas,
        headless=not args.visible,
    )
    archivo_datos, archivo_errores = guardar_resultados(datos, errores, args.salida)

    LOGGER.info("Scraping terminado: %s libros, %s incidencias", len(datos), len(errores))
    LOGGER.info("Datos guardados en %s", archivo_datos)
    if archivo_errores:
        LOGGER.info("Incidencias guardadas en %s", archivo_errores)


if __name__ == "__main__":
    main()
