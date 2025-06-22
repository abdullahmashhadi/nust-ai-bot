CREATE EXTENSION IF NOT EXISTS "vector";


CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB,
  embedding VECTOR(1536), 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);


CREATE INDEX IF NOT EXISTS documents_embedding_idx ON documents 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);


CREATE INDEX IF NOT EXISTS documents_metadata_idx ON documents USING GIN (metadata);


CREATE INDEX IF NOT EXISTS documents_content_idx ON documents USING GIN (to_tsvector('english', content));


CREATE OR REPLACE FUNCTION match_documents (
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION enable_pgvector()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
  RETURN 'pgvector enabled';
EXCEPTION
  WHEN others THEN
    RETURN 'pgvector already exists or error: ' || SQLERRM;
END;
$$;

-- Function to create documents table (called from Node.js)
CREATE OR REPLACE FUNCTION create_documents_table()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create table if it doesn't exist
  CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    metadata JSONB,
    embedding VECTOR(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
  );
  
  -- Create indexes
  CREATE INDEX IF NOT EXISTS documents_embedding_idx ON documents 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
  
  CREATE INDEX IF NOT EXISTS documents_metadata_idx ON documents USING GIN (metadata);
  CREATE INDEX IF NOT EXISTS documents_content_idx ON documents USING GIN (to_tsvector('english', content));
  
  RETURN 'Documents table created successfully';
EXCEPTION
  WHEN others THEN
    RETURN 'Table creation error: ' || SQLERRM;
END;
$$;
