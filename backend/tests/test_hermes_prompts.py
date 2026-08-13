"""Regression guards on the Gemini prompt text itself (not just parsing).

These don't call the Gemini API — they assert on the prompt strings
hermes_client builds, so a future edit can't silently reintroduce
something PROJECT_AUDIT.md flagged as wrong without a test failing here.
"""

from hermes_client import _build_proposal_prompt


def test_proposal_prompt_does_not_ask_for_a_win_probability():
    """The Proposal Wizard prompt used to ask Gemini for `WIN PROBABILITY: [0-100]`,
    presented to users as a literal predicted chance of winning. That directly
    contradicts this product's own principle against presenting an invented win
    probability as a scientific prediction — see PROJECT_AUDIT.md §10. It was
    replaced with an explicitly-labeled explainable composite score instead.
    """
    prompt = _build_proposal_prompt(
        tender_analysis={"summary": "x", "eligibility": "x", "financial_requirements": "x",
                          "required_documents": "x", "compliance_matrix": "x", "risk_analysis": "x"},
        company_kb={"company_name": "Acme Ltd"},
        wizard_data={"bid_price": "1000"},
        language="english",
    )
    assert "WIN PROBABILITY" not in prompt
    assert "CONFIDENCE LEVEL" not in prompt
    assert "OVERALL BID READINESS" in prompt
    assert "not a prediction of win probability" in prompt.lower()
