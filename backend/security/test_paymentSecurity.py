from security.paymentSecurity import can_transition


def test_admin_manual_review_transitions():
    assert can_transition('pending', 'succeeded') is True
    assert can_transition('pending', 'rejected') is True
    assert can_transition('processing', 'succeeded') is True
    assert can_transition('processing', 'rejected') is True
    assert can_transition('submitted', 'succeeded') is True
    assert can_transition('verified', 'rejected') is True


def test_rejected_is_terminal():
    assert can_transition('rejected', 'succeeded') is False
    assert can_transition('rejected', 'processing') is False
