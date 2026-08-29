# backend/test_geolocator.py
from geolocator import resolve_location, is_within_myanmar, MYANMAR_COORDINATES

def test_geolocator():
    print("🧪 Starting Geolocator Unit Tests...")
    
    # Test case 1: Kamayut township (Yangon)
    res1 = resolve_location("ကမာရွတ်")
    assert res1 is not None, "Kamayut lookup failed"
    assert res1["lat"] == 16.82, f"Expected lat 16.82, got {res1['lat']}"
    assert res1["region"] == "ရန်ကုန်", f"Expected region ရန်ကုန်, got {res1['region']}"
    print("✅ Test Case 1 (Kamayut Township) Passed.")

    # Test case 2: Hlaing township with suffix
    res2 = resolve_location("လှိုင်မြို့နယ်")
    assert res2 is not None, "Hlaing with suffix lookup failed"
    assert res2["lat"] == 16.84, f"Expected lat 16.84, got {res2['lat']}"
    print("✅ Test Case 2 (Hlaing with Suffix) Passed.")

    # Test case 3: Mindat township (Chin)
    res3 = resolve_location("မင်းတပ်")
    assert res3 is not None, "Mindat lookup failed"
    assert res3["region"] == "ချင်း", f"Expected region ချင်း, got {res3['region']}"
    print("✅ Test Case 3 (Mindat Township) Passed.")

    # Test case 4: Fallback to region (when township is not found but region is present)
    res4 = resolve_location("unknown_township", None, "ကချင်ပြည်နယ်")
    assert res4 is not None, "Rakhine region fallback lookup failed"
    assert res4["region"] == "ကချင်", f"Expected region ကချင်, got {res4['region']}"
    print("✅ Test Case 4 (Region Fallback) Passed.")

    # Test case 5: Unmatched location returns None
    res5 = resolve_location("unknown_township", None, "unknown_region")
    assert res5 is None, "Expected None for unmatched locations"
    print("✅ Test Case 5 (Unmatched locations) Passed.")

    print("\n🎉 All Geolocator tests completed successfully!")

def test_is_within_myanmar():
    print("\n🧪 Starting Myanmar bounds Unit Tests...")

    # Every township in the ontology must pass, or the guard would reject
    # coordinates the pipeline produces itself. This caught Coco Island and
    # Maungdaw when the bands were first written.
    outside = [
        (name, c) for name, c in MYANMAR_COORDINATES.items()
        if not is_within_myanmar(c["lat"], c["lon"])
    ]
    assert not outside, f"Ontology entries rejected by the guard: {outside}"
    print(f"✅ All {len(MYANMAR_COORDINATES)} ontology townships accepted.")

    # Hard cases inside the country: the western tip, an offshore exclave,
    # the eastern reach of Shan, and the southern tip.
    for name, lat, lon in [
        ("Maungdaw", 20.82, 92.36),
        ("Coco Island", 14.11, 93.37),
        ("Kengtung", 21.30, 99.60),
        ("Tachileik", 20.45, 99.88),
        ("Kawthaung", 9.98, 98.55),
        ("Putao", 27.33, 97.40),
    ]:
        assert is_within_myanmar(lat, lon), f"{name} should be inside Myanmar"
    print("✅ Border, offshore and extremity locations accepted.")

    # Neighbours that a single bounding rectangle would wrongly swallow.
    for name, lat, lon in [
        ("Bangkok", 13.75, 100.50),
        ("Chiang Mai", 18.79, 98.98),
        ("Kunming", 25.03, 102.70),
        ("Hanoi", 21.02, 105.80),
        ("Dhaka", 23.81, 90.41),
        ("Vientiane", 17.97, 102.60),
    ]:
        assert not is_within_myanmar(lat, lon), f"{name} should be outside Myanmar"
    print("✅ Neighbouring capitals and border cities rejected.")

    # Junk must be refused rather than raise: these arrive straight from the
    # model and from the database.
    for value in [(None, None), ("x", "y"), (0, 0), (0.0, 0.0), (float("nan"), 96.0), ("", "")]:
        assert is_within_myanmar(*value) is False, f"{value} should be rejected"
    print("✅ Null, zero and non-numeric coordinates rejected.")


if __name__ == "__main__":
    test_geolocator()
    test_is_within_myanmar()
