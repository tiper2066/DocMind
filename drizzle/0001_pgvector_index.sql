-- Custom SQL migration file, put your code below! --
-- pgvector ivfflat index for source_chunks.embedding (cosine distance, lists=100).
-- Separate from 0000 init so it can be tuned/rebuilt without recreating tables.
CREATE INDEX IF NOT EXISTS "source_chunks_embedding_ivfflat_idx"
  ON "source_chunks"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);
