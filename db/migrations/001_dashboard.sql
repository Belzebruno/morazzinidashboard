CREATE TABLE public.planning_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  currency char(3) NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.planning_profiles(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 300),
  price numeric(14,2) NOT NULL DEFAULT 0 CHECK (price >= 0 AND price < 1000000000000),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'purchased')),
  source_url text CHECK (source_url IS NULL OR (length(source_url) <= 8192 AND source_url ~ '^https?://[^[:space:]]+$')),
  purchased_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'planned' AND purchased_at IS NULL) OR (status = 'purchased' AND purchased_at IS NOT NULL))
);
CREATE INDEX items_profile_status_order_idx ON public.items (profile_id, status, sort_order, id);

CREATE TABLE public.financial_settings (
  profile_id uuid PRIMARY KEY REFERENCES public.planning_profiles(id) ON DELETE RESTRICT,
  saved_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (saved_amount >= 0 AND saved_amount < 1000000000000),
  monthly_salary numeric(14,2) NOT NULL DEFAULT 0 CHECK (monthly_salary >= 0 AND monthly_salary < 1000000000000),
  saving_percent numeric(5,2) NOT NULL DEFAULT 20 CHECK (saving_percent BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION public.dashboard_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER planning_profiles_updated_at BEFORE UPDATE ON public.planning_profiles
FOR EACH ROW EXECUTE FUNCTION public.dashboard_touch_updated_at();
CREATE TRIGGER items_updated_at BEFORE UPDATE ON public.items
FOR EACH ROW EXECUTE FUNCTION public.dashboard_touch_updated_at();
CREATE TRIGGER financial_settings_updated_at BEFORE UPDATE ON public.financial_settings
FOR EACH ROW EXECUTE FUNCTION public.dashboard_touch_updated_at();

INSERT INTO public.planning_profiles (id, name) VALUES ('c1acfc7e-9c85-4e23-a451-d518e59c1332', 'Morazzini');
INSERT INTO public.financial_settings (profile_id) VALUES ('c1acfc7e-9c85-4e23-a451-d518e59c1332');
