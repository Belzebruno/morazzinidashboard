CREATE TABLE public.tentativas_login (
  chave text PRIMARY KEY,
  tentativas integer NOT NULL CHECK (tentativas >= 1),
  inicio_janela timestamptz NOT NULL DEFAULT now()
);
