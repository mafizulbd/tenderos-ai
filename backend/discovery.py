"""Tender discovery scrapers for external procurement sources."""

import logging
import re
from datetime import datetime

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


def _safe_date(val: str | None) -> datetime | None:
    if not val:
        return None
    for fmt in (
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%d-%b-%Y %H:%M",
    ):
        try:
            return datetime.strptime(val.strip()[:19], fmt)
        except Exception:
            continue
    return None


def _cells(td) -> list[str]:
    """Split a <td> into its <br>-separated text pieces, trimmed of stray commas."""
    text = td.get_text("\x01", strip=True)
    return [p.strip().rstrip(",").strip() for p in text.split("\x01") if p.strip()]


# ---------------------------------------------------------------------------
# eprocure.gov.bd (Bangladesh e-GP) — the primary government tender source
# ---------------------------------------------------------------------------

def scrape_eprocure_bd() -> list[dict]:
    try:
        url = "https://www.eprocure.gov.bd/TenderDetailsServlet"
        payload = {
            "funName": "AllTenders",
            "keyword": "",
            "pageNo": "1",
            "size": "30",
            "homeWSearch": "homeWSearch",
            "approve": "false",
            "h": "t",
        }
        resp = requests.post(url, data=payload, timeout=20, headers=HEADERS)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        results = []
        for row in soup.find_all("tr"):
            cols = row.find_all("td")
            if len(cols) < 6:
                continue

            id_input = cols[2].find("input", {"name": "id"})
            if not id_input or not id_input.get("value"):
                continue
            tender_id = id_input["value"].strip()

            status_parts = _cells(cols[1])
            status = status_parts[-1] if status_parts else ""
            if status.lower() != "live":
                continue

            nature = cols[2].contents[0].strip().rstrip(",") if cols[2].contents else ""
            brief = cols[2].find("span", id=lambda v: bool(v) and v.startswith("tenderBrief_"))
            title = brief.get_text(" ", strip=True) if brief else ""

            pe_text = ", ".join(_cells(cols[3]))
            type_method = ", ".join(_cells(cols[4]))
            dates = _cells(cols[5])
            deadline = _safe_date(dates[1]) if len(dates) > 1 else None

            results.append({
                "source": "eGP Bangladesh",
                "external_id": f"eprocure_{tender_id}",
                "title": (title or "eGP Tender")[:500],
                "description": f"Procuring Entity: {pe_text}"[:800],
                "category": ", ".join(p for p in [nature, type_method] if p)[:300],
                "deadline": deadline,
                "estimated_value": "",
                "url": f"https://www.eprocure.gov.bd/resources/common/ViewTender.jsp?id={tender_id}&h=t",
                "country": "Bangladesh",
            })
        logger.info("eGP Bangladesh: found %d notices", len(results))
        return results
    except Exception as e:
        logger.warning("eGP Bangladesh scrape failed: %s", e)
        return []


# ---------------------------------------------------------------------------
# World Bank Bangladesh procurement notices (public JSON API)
# ---------------------------------------------------------------------------

def scrape_world_bank() -> list[dict]:
    try:
        url = "https://search.worldbank.org/api/v2/procnotices"
        params = {
            "format": "json",
            "fl": "id,noticetitle,noticedate,submission_date_deadline,noticetext,prodline,regionname",
            "fq": "country_code:BD",
            "rows": 25,
            "os": 0,
            "srt": "noticedate",
            "order": "desc",
        }
        resp = requests.get(url, params=params, timeout=15, headers=HEADERS)
        resp.raise_for_status()
        data = resp.json()
        notices = data.get("procnotices", {}).get("procurement", [])
        results = []
        for n in notices:
            nid = str(n.get("id", ""))
            if not nid:
                continue
            results.append({
                "source": "World Bank",
                "external_id": f"wb_{nid}",
                "title": (n.get("noticetitle") or "Untitled")[:500],
                "description": (n.get("noticetext") or "")[:800],
                "category": (n.get("prodline") or "")[:300],
                "deadline": _safe_date(n.get("submission_date_deadline")),
                "estimated_value": "",
                "url": f"https://projects.worldbank.org/en/projects-operations/procurement/dombyguid?guid={nid}",
                "country": "Bangladesh",
            })
        logger.info("World Bank: found %d notices", len(results))
        return results
    except Exception as e:
        logger.warning("World Bank scrape failed: %s", e)
        return []


# ---------------------------------------------------------------------------
# UNGM (UN Global Marketplace) — Bangladesh notices
# ---------------------------------------------------------------------------

def scrape_ungm() -> list[dict]:
    try:
        url = "https://www.ungm.org/Public/Notice"
        params = {"Country": "BGD", "PageIndex": 0}
        resp = requests.get(url, params=params, timeout=20, headers=HEADERS)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        results = []
        for row in soup.select("table.tablesorter tbody tr")[:20]:
            cols = row.find_all("td")
            if len(cols) < 4:
                continue
            link_tag = cols[1].find("a")
            title = link_tag.get_text(strip=True) if link_tag else cols[1].get_text(strip=True)
            href = link_tag.get("href", "") if link_tag else ""
            notice_id = re.search(r"\d+", href)
            eid = f"ungm_{notice_id.group()}" if notice_id else f"ungm_{title[:30]}"
            deadline_text = cols[3].get_text(strip=True) if len(cols) > 3 else ""
            results.append({
                "source": "UNGM",
                "external_id": eid,
                "title": title[:500],
                "description": "",
                "category": cols[0].get_text(strip=True)[:300] if cols else "",
                "deadline": _safe_date(deadline_text),
                "estimated_value": "",
                "url": f"https://www.ungm.org{href}" if href.startswith("/") else href,
                "country": "Bangladesh",
            })
        logger.info("UNGM: found %d notices", len(results))
        return results
    except Exception as e:
        logger.warning("UNGM scrape failed: %s", e)
        return []


# ---------------------------------------------------------------------------
# ADB (Asian Development Bank) — Bangladesh projects
# ---------------------------------------------------------------------------

def scrape_adb() -> list[dict]:
    try:
        url = "https://www.adb.org/projects/feed"
        params = {"field_project_country_tid": 20, "field_project_type_tid": 31038}
        resp = requests.get(url, params=params, timeout=15, headers=HEADERS)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.content, "xml")
        results = []
        for item in soup.find_all("item")[:20]:
            title = item.find("title")
            link  = item.find("link")
            desc  = item.find("description")
            pub   = item.find("pubDate")
            title_text = title.get_text(strip=True) if title else "ADB Tender"
            link_text  = link.get_text(strip=True) if link else ""
            eid = f"adb_{re.sub(r'[^a-z0-9]', '_', title_text.lower())[:40]}"
            results.append({
                "source": "ADB",
                "external_id": eid,
                "title": title_text[:500],
                "description": BeautifulSoup(desc.get_text() if desc else "", "html.parser").get_text()[:800],
                "category": "ADB Project",
                "deadline": None,
                "estimated_value": "",
                "url": link_text,
                "country": "Bangladesh",
            })
        logger.info("ADB: found %d notices", len(results))
        return results
    except Exception as e:
        logger.warning("ADB scrape failed: %s", e)
        return []


# ---------------------------------------------------------------------------
# UNDP Bangladesh procurement notices
# ---------------------------------------------------------------------------

def scrape_undp() -> list[dict]:
    try:
        url = "https://procurement-notices.undp.org/view_notices.cfm"
        params = {"notice_type_id": 2, "country_id": 16, "lcc": "BGD"}
        resp = requests.get(url, params=params, timeout=20, headers=HEADERS)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        results = []
        for row in soup.select("table.procurement-table tr, div.notice-row, tr.odd, tr.even")[:20]:
            cols = row.find_all(["td", "th"])
            if len(cols) < 3:
                continue
            link_tag = row.find("a")
            title = link_tag.get_text(strip=True) if link_tag else cols[0].get_text(strip=True)
            if not title or len(title) < 5:
                continue
            href = link_tag.get("href", "") if link_tag else ""
            eid = f"undp_{re.sub(r'[^a-z0-9]', '_', title.lower())[:40]}"
            deadline_text = cols[-1].get_text(strip=True) if cols else ""
            results.append({
                "source": "UNDP",
                "external_id": eid,
                "title": title[:500],
                "description": "",
                "category": "UNDP Procurement",
                "deadline": _safe_date(deadline_text),
                "estimated_value": "",
                "url": href if href.startswith("http") else f"https://procurement-notices.undp.org/{href}",
                "country": "Bangladesh",
            })
        logger.info("UNDP: found %d notices", len(results))
        return results
    except Exception as e:
        logger.warning("UNDP scrape failed: %s", e)
        return []


# ---------------------------------------------------------------------------
# Combined runner
# ---------------------------------------------------------------------------

def run_all_scrapers() -> list[dict]:
    """Run all scrapers and return deduplicated results."""
    results = []
    for fn in [scrape_eprocure_bd, scrape_world_bank, scrape_ungm, scrape_adb, scrape_undp]:
        results.extend(fn())
    # Deduplicate by external_id
    seen: set[str] = set()
    unique = []
    for r in results:
        if r["external_id"] not in seen:
            seen.add(r["external_id"])
            unique.append(r)
    return unique
