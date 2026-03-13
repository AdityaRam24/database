"""
Prompt-Injection Firewall — Heuristic scanner for NL prompt jailbreak attempts.

Scans user prompts for common injection patterns before they reach the SQL generator.
"""

import re
import logging
from typing import Dict

logger = logging.getLogger(__name__)

# --- Injection pattern categories ---

# Attempts to override system instructions
INSTRUCTION_OVERRIDE_PATTERNS = [
    r"ignore\s+(all\s+)?previous\s+(instructions|rules|limits|prompts|guidelines)",
    r"forget\s+(your|all|previous)\s+(rules|instructions|training|constraints)",
    r"disregard\s+(all\s+)?(prior|previous|above)\s+(instructions|rules)",
    r"you\s+are\s+now\s+(a|an|the)\s+(unrestricted|uncensored|jailbroken)",
    r"act\s+as\s+(root|admin|superuser|dba|database\s+admin)",
    r"pretend\s+(you|that)\s+(are|have)\s+no\s+(restrictions|rules|limits)",
    r"override\s+(your|the)\s+(system|safety|security)\s+(prompt|rules|instructions)",
    r"enter\s+(developer|debug|test|admin)\s+mode",
    r"new\s+system\s+prompt",
    r"system\s*:\s*you\s+are",
    r"<\|?im_start\|?>system",
]

# SQL injection in natural language
SQL_INJECTION_PATTERNS = [
    r"';\s*DROP\s+",
    r"';\s*DELETE\s+",
    r"';\s*TRUNCATE\s+",
    r"';\s*ALTER\s+",
    r"';\s*UPDATE\s+.*SET",
    r"UNION\s+SELECT\s+",
    r"--\s*(DROP|DELETE|TRUNCATE|ALTER)",
    r"\/\*.*\*\/\s*(DROP|DELETE|TRUNCATE)",
    r";\s*GRANT\s+",
    r";\s*REVOKE\s+",
    r"pg_sleep\s*\(",
    r"information_schema\.",
    r"pg_catalog\.",
]

# Direct destructive intent
DESTRUCTIVE_INTENT_PATTERNS = [
    r"\b(drop|delete|truncate|destroy|remove|wipe|erase)\s+(the\s+)?(entire\s+)?(database|all\s+tables|all\s+data|everything|all\s+records)",
    r"(delete|remove|drop)\s+all\s+(users|customers|orders|data)",
    r"(clear|empty|flush)\s+(the\s+)?(entire\s+)?(database|all\s+tables)",
]

# Social engineering
SOCIAL_ENGINEERING_PATTERNS = [
    r"this\s+is\s+a\s+(test|drill|emergency)\s*(,|\.|\s)?\s*(so\s+)?you\s+can",
    r"my\s+boss\s+(told|asked|wants)\s+me\s+to\s+(drop|delete|truncate)",
    r"i\s+have\s+(permission|authorization|clearance)\s+to\s+(drop|delete|truncate)",
    r"trust\s+me\s*(,|\.|\s)?\s*(just\s+)?(drop|delete|run|execute)",
]


def scan_prompt(prompt: str) -> Dict:
    """
    Scan a natural language prompt for injection/jailbreak attempts.
    
    Returns: {
        is_safe: bool,
        threat_type: str | None,
        threat_detail: str | None,
        confidence: float (0-1),
        sanitized_prompt: str
    }
    """
    if not prompt or not prompt.strip():
        return {
            "is_safe": True,
            "threat_type": None,
            "threat_detail": None,
            "confidence": 1.0,
            "sanitized_prompt": prompt
        }

    lower_prompt = prompt.lower().strip()
    threats_found = []

    # Check each category
    for pattern in INSTRUCTION_OVERRIDE_PATTERNS:
        match = re.search(pattern, lower_prompt, re.IGNORECASE)
        if match:
            threats_found.append({
                "type": "instruction_override",
                "detail": f"Detected instruction override attempt: '{match.group()}'",
                "confidence": 0.9
            })

    for pattern in SQL_INJECTION_PATTERNS:
        match = re.search(pattern, prompt, re.IGNORECASE)
        if match:
            threats_found.append({
                "type": "sql_injection",
                "detail": f"Detected embedded SQL injection: '{match.group()}'",
                "confidence": 0.95
            })

    for pattern in DESTRUCTIVE_INTENT_PATTERNS:
        match = re.search(pattern, lower_prompt, re.IGNORECASE)
        if match:
            threats_found.append({
                "type": "destructive_intent",
                "detail": f"Detected destructive intent: '{match.group()}'",
                "confidence": 0.85
            })

    for pattern in SOCIAL_ENGINEERING_PATTERNS:
        match = re.search(pattern, lower_prompt, re.IGNORECASE)
        if match:
            threats_found.append({
                "type": "social_engineering",
                "detail": f"Detected social engineering attempt: '{match.group()}'",
                "confidence": 0.8
            })

    if threats_found:
        # Return the highest-confidence threat
        worst = max(threats_found, key=lambda t: t["confidence"])
        logger.warning(f"Prompt firewall BLOCKED: {worst['type']} — {worst['detail']}")
        return {
            "is_safe": False,
            "threat_type": worst["type"],
            "threat_detail": worst["detail"],
            "confidence": worst["confidence"],
            "sanitized_prompt": prompt,
            "all_threats": threats_found
        }

    return {
        "is_safe": True,
        "threat_type": None,
        "threat_detail": None,
        "confidence": 1.0,
        "sanitized_prompt": prompt
    }
