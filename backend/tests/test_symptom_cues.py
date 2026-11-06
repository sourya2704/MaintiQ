from app.services.symptoms import detect_hazard, tag_symptoms


def test_lookalike_words_are_not_symptoms():
    assert tag_symptoms("The room is humid and there is a hotel nearby") == []
    assert tag_symptoms("Human error; the gauge sits on a tripod") == []
    assert not detect_hazard("The firewall blocked the update")


def test_inflected_cues_still_match():
    assert tag_symptoms("Motor is vibrating and hotter than usual") == ["vibration", "overheating"]
    assert set(tag_symptoms("Breaker tripped, pump leaking, grinding noise")) == {
        "electrical_fault", "leak", "abnormal_noise"}
    assert tag_symptoms("Heavy smoking from the panel") == ["smoke_or_burning"]
    assert tag_symptoms("No smoke, but it is humming") == ["abnormal_noise"]
