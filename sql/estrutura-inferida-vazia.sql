-- Colafix: modelo INFERIDO do repositorio TIColafix/analise_compras.
-- NAO e um dump do PostgreSQL original e NAO comprova compatibilidade.
-- Somente DDL; nenhuma linha inserida. Execute apenas no banco NOVO e vazio.
BEGIN;
CREATE TABLE IF NOT EXISTS public.cement_loads (
 id uuid PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('granel','ensacado')),
 company text NOT NULL, supplier text, carrier text NOT NULL,
 scheduled_date date NOT NULL, system_order text, supplier_order text,
 order_quantity text, cement_description text, invoice text,
 status text NOT NULL DEFAULT 'Agendado', notes text,
 bag_product text, bag_quantity text, delivery_city text,
 purchase_order text, freight_order text, freight_value text,
 bag_items jsonb NOT NULL DEFAULT '[]'::jsonb,
 due_date text, version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 history jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_cement_loads_scheduled_date ON public.cement_loads(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_cement_loads_company ON public.cement_loads(company);
CREATE TABLE IF NOT EXISTS public.cement_monthly_orders (
 month char(7) NOT NULL, supplier text NOT NULL, system_order text NOT NULL,
 PRIMARY KEY(month,supplier)
);
CREATE TABLE IF NOT EXISTS public.diesel_loads (
 id uuid PRIMARY KEY, scheduled_date date NOT NULL, company text NOT NULL,
 fuel text NOT NULL, liters text NOT NULL, payment_terms text NOT NULL,
 price text NOT NULL, invoice text, purchase_order text,
 status text NOT NULL DEFAULT 'Agendado', notes text,
 version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 history jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_diesel_loads_scheduled_date ON public.diesel_loads(scheduled_date);
CREATE TABLE IF NOT EXISTS public.delivery_deadlines (
 id uuid PRIMARY KEY, code text NOT NULL, product text NOT NULL,
 purchase_order text NOT NULL, contact text, supplier text NOT NULL,
 status text NOT NULL, delivery_date date NOT NULL,
 quantity text NOT NULL, freight text, unit text NOT NULL,
 new_date date, notes text, delivered_quantity text,
 delivery_events jsonb NOT NULL DEFAULT '[]'::jsonb,
 version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 history jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_delivery_deadlines_order ON public.delivery_deadlines(purchase_order);
CREATE INDEX IF NOT EXISTS idx_delivery_deadlines_date ON public.delivery_deadlines(delivery_date);
CREATE TABLE IF NOT EXISTS public.maintenance_requests (
 id uuid PRIMARY KEY, number text UNIQUE NOT NULL,
 category text, type text NOT NULL, origin text NOT NULL,
 requester text NOT NULL, buyer text, oc text, priority text,
 equipment text, description text NOT NULL, quantity text,
 unit text, needed_date date, status text NOT NULL,
 supplier text, system_order text, promised_date date,
 notes text, quotes jsonb NOT NULL DEFAULT '[]'::jsonb,
 company text, version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 history jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_status ON public.maintenance_requests(status);
COMMIT;
