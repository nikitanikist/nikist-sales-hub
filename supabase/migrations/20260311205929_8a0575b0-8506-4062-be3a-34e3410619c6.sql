ALTER TABLE public.whatsapp_sessions 
ADD COLUMN IF NOT EXISTS proxy_config JSONB DEFAULT NULL;

COMMENT ON COLUMN public.whatsapp_sessions.proxy_config IS 
'Optional SOCKS5 proxy for this session. Format: {"host": "1.2.3.4", "port": 1080, "username": "user", "password": "pass"}';