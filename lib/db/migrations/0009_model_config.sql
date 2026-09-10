-- Model endpoint configured in the app rather than the environment, so it can be changed
-- and tested without a redeploy.
--
-- Supersedes part of D31: the boot-time assertion refused any public endpoint outright.
-- Reaching a hosted provider is now possible, but never by accident — it needs an explicit
-- per-configuration acknowledgement that client business logic will leave the network.
CREATE TABLE model_config (
    id                 bigserial PRIMARY KEY,
    base_url           text NOT NULL,
    api_key_encrypted  text,                    -- AES-256-GCM, never plaintext
    chat_model         text NOT NULL,
    embed_model        text NOT NULL,
    embed_dims         integer,
    reasoning_effort   text NOT NULL DEFAULT 'none',
    is_private         boolean NOT NULL DEFAULT true,   -- resolved at test time
    egress_acknowledged boolean NOT NULL DEFAULT false, -- required when not private
    verified_at        timestamptz,
    verified_by        bigint REFERENCES users(id),
    last_error         text,
    last_report        jsonb,                   -- what the connection test found
    is_active          boolean NOT NULL DEFAULT true,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

-- One active configuration at a time.
CREATE UNIQUE INDEX idx_model_config_active ON model_config (is_active) WHERE is_active;
