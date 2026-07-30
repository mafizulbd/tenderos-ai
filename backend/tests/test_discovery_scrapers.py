from unittest.mock import Mock, patch

import discovery


# Trimmed real response from eprocure.gov.bd's TenderDetailsServlet (funName=AllTenders),
# kept as a fixture so the parser is tested without hitting the live government site.
EPROCURE_FRAGMENT = """
<tr class='bgColor-white'><td class="t-align-center">1</td><td class="t-align-center">1313417,<br/>KR/Fuel wood/2026-2027,<br/><label style="color: red;font-weight: bold;">Live</label></td><td class="t-align-left">Goods,<br /><form name="viewtenderform_0" id="viewtenderform_0" method="POST" action="/resources/common/ViewTender.jsp" target="_blank"><input type="hidden" name="id" value="1313417" /><input type="hidden" name="h" value="t" /><a onclick="document.getElementById('viewtenderform_0').submit();" href='javascript:void(0);'><span id='tenderBrief_0'><p>KR/Fuel wood/2026-2027<br />
Supply of dry sawn fuel wood at Police Ration Store Kushtia. FY/2026-2027, (July,2026-June, 2027)</p>
</span></a></form></td><td class="t-align-left">Ministry of Home Affairs,<br/> Bangladesh Police,<br/> Office of the Superintendent of Police, Kushtia</td><td class="t-align-center">NCT,<br /> OTM</td><td class="t-align-center">30-Jul-2026 13:30,<br />10-Aug-2026 12:30</td></tr>
<tr class='bgColor-Green'><td class="t-align-center">2</td><td class="t-align-center">1308806,<br/>251  dated:  04.03.2026,<br/><label style="color: gray;font-weight: bold;">Closed</label></td><td class="t-align-left">Works,<br /><form name="viewtenderform_1" id="viewtenderform_1" method="POST" action="/resources/common/ViewTender.jsp" target="_blank"><input type="hidden" name="id" value="1308806" /><input type="hidden" name="h" value="t" /><a onclick="document.getElementById('viewtenderform_1').submit();" href='javascript:void(0);'><span id='tenderBrief_1'><p>Construction of 1265 nos Improved Latrin (Twin Pit) in Bajitpur Upazila of Kishoreganj District under Rural Sanitation Project FY 2025-26.</p>
</span></a></form></td><td class="t-align-left">Ministry of Local Government, Rural Development and Co-operatives,<br/> Local Government Division,<br/> Department of Public Health Engineering (DPHE),<br/> Office of the Executive Engineer DPHE,  Kishoreganj</td><td class="t-align-center">NCT,<br /> OTM</td><td class="t-align-center">30-Jul-2026 13:30,<br />24-Aug-2026 12:00</td></tr>
<input type="hidden" id="cntTenBrief" value="2"><input type="hidden" id="totalPages" value="61791">
"""


def _mock_response():
    resp = Mock()
    resp.text = EPROCURE_FRAGMENT
    resp.raise_for_status = Mock()
    return resp


def test_scrape_eprocure_bd_parses_live_notice():
    with patch("discovery.requests.post", return_value=_mock_response()) as mock_post:
        results = discovery.scrape_eprocure_bd()

    mock_post.assert_called_once()
    assert mock_post.call_args.kwargs["data"]["funName"] == "AllTenders"

    assert len(results) == 1  # the "Closed" row must be filtered out
    item = results[0]
    assert item["source"] == "eGP Bangladesh"
    assert item["external_id"] == "eprocure_1313417"
    assert "Fuel wood" in item["title"]
    assert "Supply of dry sawn fuel wood" in item["title"]
    assert item["category"] == "Goods, NCT, OTM"
    assert "Ministry of Home Affairs" in item["description"]
    assert item["url"] == "https://www.eprocure.gov.bd/resources/common/ViewTender.jsp?id=1313417&h=t"
    assert item["country"] == "Bangladesh"
    assert item["deadline"] is not None
    assert item["deadline"].isoformat() == "2026-08-10T12:30:00"


def test_scrape_eprocure_bd_returns_empty_list_on_request_failure():
    with patch("discovery.requests.post", side_effect=RuntimeError("network down")):
        results = discovery.scrape_eprocure_bd()
    assert results == []


def test_run_all_scrapers_includes_eprocure_first():
    with patch("discovery.scrape_eprocure_bd", return_value=[{"external_id": "eprocure_1"}]), \
         patch("discovery.scrape_world_bank", return_value=[{"external_id": "wb_1"}]), \
         patch("discovery.scrape_ungm", return_value=[]), \
         patch("discovery.scrape_undp", return_value=[]):
        results = discovery.run_all_scrapers()

    assert [r["external_id"] for r in results] == ["eprocure_1", "wb_1"]


# Trimmed real response from search.worldbank.org/api/v2/procnotices?qterm=Bangladesh —
# one Bangladesh "Invitation for Bids" (should be kept), one Bangladesh "Contract Award"
# (already awarded, should be filtered out) and one non-Bangladesh false-positive keyword
# match (should be filtered out by project_ctry_name).
WORLD_BANK_PAYLOAD = {
    "procnotices": [
        {
            "id": "OP00455112",
            "notice_type": "Invitation for Bids",
            "project_ctry_name": "Bangladesh",
            "project_id": "P178985",
            "project_name": "Bangladesh Resilient Urban and Territorial Development Project",
            "bid_description": "Construction of RCC/BC Road with street light, drain and culvert",
            "submission_deadline_date": "2026-07-16T00:00:00Z",
            "notice_text": "<p>e-Tender Notice No-01/2025-2026(OTM)</p>",
        },
        {
            "id": "OP00459229",
            "notice_type": "Contract Award",
            "project_ctry_name": "Bangladesh",
            "project_id": "P178985",
            "project_name": "Bangladesh Resilient Urban and Territorial Development Project",
            "bid_description": "Improvement of BC Road, Drain with Street Light",
            "notice_text": "<p>Contract Award</p>",
        },
        {
            "id": "OP00459270",
            "notice_type": "Contract Award",
            "project_ctry_name": "Eastern and Southern Africa",
            "project_id": "P999999",
            "bid_description": "Construction works of Cattle Crash",
            "notice_text": "<p>Contract Award</p>",
        },
    ]
}


def test_scrape_world_bank_filters_country_and_open_notice_types():
    resp = Mock()
    resp.json = Mock(return_value=WORLD_BANK_PAYLOAD)
    resp.raise_for_status = Mock()

    with patch("discovery.requests.get", return_value=resp) as mock_get:
        results = discovery.scrape_world_bank()

    assert mock_get.call_args.kwargs["params"]["qterm"] == "Bangladesh"
    assert len(results) == 1
    item = results[0]
    assert item["external_id"] == "wb_OP00455112"
    assert item["title"] == "Construction of RCC/BC Road with street light, drain and culvert"
    assert item["url"] == "https://projects.worldbank.org/en/projects-operations/project-detail/P178985"
    assert item["deadline"].isoformat() == "2026-07-16T00:00:00"


def test_scrape_world_bank_returns_empty_list_on_request_failure():
    with patch("discovery.requests.get", side_effect=RuntimeError("network down")):
        results = discovery.scrape_world_bank()
    assert results == []


# Trimmed real fragment from procurement-notices.undp.org/search.cfm — one Bangladesh
# notice (kept) and one non-Bangladesh notice (filtered out).
UNDP_FRAGMENT = """
<a href="view_negotiation.cfm?nego_id=48093" class="vacanciesTableLink vacanciesTable__row">
  <div class="vacanciesTable__cell"><div class="vacanciesTable__cell__label">Title</div><span>Supply, Installation, Testing and Commissioning of Fire Hydrant System</span></div>
  <div class="vacanciesTable__cell"><div class="vacanciesTable__cell__label">Ref No</div><span>UNDP-BGD-01188</span></div>
  <div class="vacanciesTable__cell"><div class="vacanciesTable__cell__label">UNDP Office/Country</div><span>UNDP-BGD/BANGLADESH</span></div>
  <div class="vacanciesTable__cell"><div class="vacanciesTable__cell__label">Process</div><span>RFQ - Request for quotation</span></div>
  <div class="vacanciesTable__cell"><div class="vacanciesTable__cell__label">Deadline</div><span><nobr>13-Aug-26<br>06:30 AM (New York time)</nobr></span></div>
</a>
<a href="view_negotiation.cfm?nego_id=48089" class="vacanciesTableLink vacanciesTable__row">
  <div class="vacanciesTable__cell"><div class="vacanciesTable__cell__label">Title</div><span>RFQ-Supply, Delivery and Set-up of Community Nursery Infrastructure</span></div>
  <div class="vacanciesTable__cell"><div class="vacanciesTable__cell__label">Ref No</div><span>UNDP-WSM-00247</span></div>
  <div class="vacanciesTable__cell"><div class="vacanciesTable__cell__label">UNDP Office/Country</div><span>UNDP-WSM/SAMOA</span></div>
  <div class="vacanciesTable__cell"><div class="vacanciesTable__cell__label">Process</div><span>RFQ - Request for quotation</span></div>
  <div class="vacanciesTable__cell"><div class="vacanciesTable__cell__label">Deadline</div><span><nobr>13-Aug-26<br>09:59 AM (New York time)</nobr></span></div>
</a>
"""


def test_scrape_undp_filters_to_bangladesh():
    resp = Mock()
    resp.text = UNDP_FRAGMENT
    resp.raise_for_status = Mock()

    with patch("discovery.requests.get", return_value=resp):
        results = discovery.scrape_undp()

    assert len(results) == 1
    item = results[0]
    assert item["external_id"] == "undp_48093"
    assert "Fire Hydrant" in item["title"]
    assert item["category"] == "RFQ - Request for quotation"
    assert item["url"] == "https://procurement-notices.undp.org/view_negotiation.cfm?nego_id=48093"
    assert item["deadline"].isoformat() == "2026-08-13T00:00:00"


def test_scrape_undp_returns_empty_list_on_request_failure():
    with patch("discovery.requests.get", side_effect=RuntimeError("network down")):
        results = discovery.scrape_undp()
    assert results == []
