import time
import requests
from bs4 import BeautifulSoup
from langchain.schema import Document

URLS = [
    "https://www.alz.org/alzheimers-dementia/what-is-alzheimers",
    "https://www.alz.org/help-support/caregiving",
    "https://www.nia.nih.gov/health/alzheimers-and-dementia",
    "https://en.wikipedia.org/wiki/Alzheimer%27s_disease",
]

HEADERS = {"User-Agent": "Mozilla/5.0"}


def _get_reliability(url: str) -> float:
    if "alz.org" in url:
        return 1.0
    elif "nih.gov" in url:
        return 0.9
    elif "wikipedia" in url:
        return 0.6
    return 0.5


def _clean_text(soup: BeautifulSoup) -> str:
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()
    text = soup.get_text(separator=" ", strip=True)
    return " ".join(text.split())


def load_web_data() -> list:
    """Scrape trusted Alzheimer's medical sources."""
    docs = []
    for url in URLS:
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            if r.status_code != 200:
                continue
            text = _clean_text(BeautifulSoup(r.text, "html.parser"))
            if len(text) < 800:
                continue
            docs.append(
                Document(
                    page_content=text,
                    metadata={"source": url, "type": "web", "reliability": _get_reliability(url)},
                )
            )
            time.sleep(1)
        except Exception as e:
            print(f"Warning: could not load {url}: {e}")
    return docs
