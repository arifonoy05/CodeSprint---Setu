-- Chat and embeddings may live on different endpoints.
--
-- Gateways commonly serve chat only: a router offering 516 chat models returned
-- "No credentials for embedding provider" for every embedding model tried. Setu needs
-- both, so the embedding endpoint is configurable separately and falls back to the chat
-- endpoint when left blank.
ALTER TABLE model_config ADD COLUMN embed_base_url text;
ALTER TABLE model_config ADD COLUMN embed_api_key_encrypted text;
