# backend/test_deduplicator.py
from deduplicator import NewsDeduplicator

def test_deduplicator():
    print("🧪 Starting Semantic Deduplicator Unit Tests...")
    
    dedup = NewsDeduplicator()
    # Initialize model early to catch any load errors
    dedup.initialize_model()
    
    # Test case 1: Very similar sentences (Burmese)
    t1_a = "ယနေ့ ရန်ကုန်၊ ကမာရွတ်တွင် ပစ်ခတ်မှုဖြစ်ပြီး ၁ ဦး သေဆုံးသည်။"
    t1_b = "ကမာရွတ်မြို့နယ်၌ သေနတ်ဖြင့် အပြန်အလှန် ပစ်ခတ်မှုဖြစ်ပွားကာ တစ်ဦး သေဆုံးသွားကြောင်း သိရသည်။"
    score1 = dedup.get_similarity_score(t1_a, t1_b)
    print(f"Similarity score for matches: {score1:.4f}")
    
    # Test case 2: Totally different events
    t2_a = "မန္တလေးတွင် ယနေ့ညနေပိုင်း၌ မီးလောင်မှုဖြစ်ပွားခဲ့သည်။"
    t2_b = "ရန်ကုန်တိုင်း လှိုင်မြို့နယ်တွင် သေနတ်ပစ်ခတ်မှုဖြစ်ပြီး ရဲတစ်ဦး ထိခိုက်ဒဏ်ရာရရှိသည်။"
    score2 = dedup.get_similarity_score(t2_a, t2_b)
    print(f"Similarity score for non-matches: {score2:.4f}")

    if not dedup.initialized:
        print("⚠️ Model not loaded. Testing assertions in Jaccard Bigram fallback mode.")
        assert score1 > 0.25, f"Expected Jaccard fallback match > 0.25, got {score1}"
        assert score2 < 0.25, f"Expected Jaccard fallback non-match < 0.25, got {score2}"
    else:
        print("🤖 Model loaded. Testing assertions in Semantic ML mode.")
        assert score1 > 0.80, f"Expected ML match > 0.80, got {score1}"
        assert score2 < 0.40, f"Expected ML non-match < 0.40, got {score2}"

    print("\n🎉 Semantic Deduplicator tests completed successfully!")

if __name__ == "__main__":
    test_deduplicator()
