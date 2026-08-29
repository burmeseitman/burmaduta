# backend/deduplicator.py
import os

class NewsDeduplicator:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(NewsDeduplicator, cls).__new__(cls, *args, **kwargs)
            cls._instance.model = None
            cls._instance.initialized = False
            cls._instance.degraded = False
        return cls._instance

    def initialize_model(self):
        """Lazy load the sentence transformer model to save memory during startup."""
        if self.initialized:
            return
            
        print("🧠 Loading Multilingual Sentence Transformer Model for De-duplication...")
        model_name = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
        try:
            from sentence_transformers import SentenceTransformer
            # Multilingual model handling Burmese + English text embeddings efficiently
            self.model = SentenceTransformer(model_name)
            self.initialized = True
            self.degraded = False
            print("✅ Semantic Deduplicator model loaded successfully.")
        except Exception as e:
            # Loud on purpose. This used to fail silently — sentence-transformers
            # 2.2.2 could not import against a newer huggingface-hub — and the
            # scraper went on scoring bigram Jaccard while the README advertised
            # Sentence-BERT. A one-line error was too easy to miss in the logs.
            self.degraded = True
            print("=" * 72)
            print("❌ SEMANTIC DEDUPLICATION DEGRADED")
            print(f"   Could not load {model_name!r}: {e}")
            print("   Falling back to bigram Jaccard similarity, which scores on a")
            print("   different scale — DEDUP_SIMILARITY_THRESHOLD is calibrated for")
            print("   embeddings and will not mean the same thing here.")
            print("=" * 72)
            self.initialized = False

    def get_similarity_score(self, text1: str, text2: str) -> float:
        """Calculate cosine similarity score between two texts (0.0 to 1.0)."""
        if not text1 or not text2:
            return 0.0

        if not self.initialized:
            self.initialize_model()

        if not self.model:
            # Fallback to simple Jaccard similarity if model failed to load
            return self._jaccard_similarity(text1, text2)

        try:
            import numpy as np
            embeddings = self.model.encode([text1, text2])
            emb1 = embeddings[0]
            emb2 = embeddings[1]
            # Calculate cosine similarity
            similarity = np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))
            return float(similarity)
        except Exception as e:
            print(f"Error computing similarity: {e}")
            return self._jaccard_similarity(text1, text2)

    def _jaccard_similarity(self, text1: str, text2: str) -> float:
        """Fast fallback bigram-level Jaccard similarity helper for Burmese/script texts."""
        import re
        # Clean spacing and punctuation
        t1 = re.sub(r'[\s၊။]', '', text1.lower())
        t2 = re.sub(r'[\s၊။]', '', text2.lower())
        
        # Generate 2-character n-grams (bigrams)
        bigrams1 = {t1[i:i+2] for i in range(len(t1)-1)} if len(t1) > 1 else set(t1)
        bigrams2 = {t2[i:i+2] for i in range(len(t2)-1)} if len(t2) > 1 else set(t2)
        
        intersection = bigrams1.intersection(bigrams2)
        union = bigrams1.union(bigrams2)
        if not union:
            return 0.0
        return float(len(intersection) / len(union))
