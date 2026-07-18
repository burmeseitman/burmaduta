# backend/test_geolocator.py
from geolocator import resolve_location

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

if __name__ == "__main__":
    test_geolocator()
