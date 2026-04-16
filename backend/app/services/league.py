"""
StreamMatch — League Assignment Logic.

Determines a streamer's league tier based on their average concurrent viewers.
League boundaries are fixed and cannot be overridden by users.
"""

from app.models.user import League


def calculate_league(avg_viewers: int) -> League:
    """
    Assign a league based on average concurrent viewer count.

    Thresholds:
    - Bronze:   0 – 50 viewers
    - Silver:   51 – 250 viewers
    - Gold:     251 – 1000 viewers
    - Platinum: 1001+ viewers
    """
    if avg_viewers <= 50:
        return League.bronze
    if avg_viewers <= 250:
        return League.silver
    if avg_viewers <= 1000:
        return League.gold
    return League.platinum
