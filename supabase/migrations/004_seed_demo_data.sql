-- RISEMOBILE: Migration 004 - Seed Demo Data
-- Criado pelo Agente de Backend e Supabase

-- Inserir Grades Padrão
INSERT INTO public.grades (id, name, description, badge_color, is_active)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'A++', 'Impecável, sem marcas, bateria 88%+', 'mint', true),
    ('22222222-2222-2222-2222-222222222222', 'AB+', 'Excelente estado, micro-detalhes mínimos, bateria 85%+', 'lavender', true),
    ('33333333-3333-3333-3333-333333333333', 'B-', 'Sinais leves de uso estético, 100% funcional', 'yellow', true)
ON CONFLICT (name) DO NOTHING;

-- Inserir Lojistas Padrão
INSERT INTO public.retailers (id, store_name, contact_name, phone, whatsapp, document, city, state, address, commission_per_unit_usd, notes)
VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'iStore Prime SP', 'Rodrigo Mendes', '+55 11 98888-1111', '+5511988881111', '28.910.456/0001-89', 'São Paulo', 'SP', 'Rua Santa Ifigênia, 450 - Sala 12', 15.00, 'Cliente VIP - Alto volume semanal'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Tech Apple Express RJ', 'Fernanda Lima', '+55 21 97777-2222', '+5521977772222', '34.821.109/0001-44', 'Rio de Janeiro', 'RJ', 'Av. das Américas, 3500 - Barra', 20.00, 'Pagamentos sempre via PIX ou 50% 15D'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Mega Imports Curitiba', 'Carlos Eduardo', '+55 41 99999-3333', '+5541999993333', '19.554.321/0001-12', 'Curitiba', 'PR', 'Rua XV de Novembro, 1200', 10.00, 'Comprador frequente de lotes B- e AB+')
ON CONFLICT DO NOTHING;

-- Inserir Entrada de Estoque Inicial
INSERT INTO public.stock_entries (id, reference_code, model, storage, grade_id, quantity, total_cost_usd, unit_cost_usd, notes)
VALUES 
    ('e1111111-1111-1111-1111-111111111111', 'LOT-MIA-2026-08', 'iPhone 13', '128GB', '11111111-1111-1111-1111-111111111111', 10, 3600.00, 360.00, 'Lote Miami Import Grade A++')
ON CONFLICT DO NOTHING;

-- Inserir Aparelhos Reais com IMEIs Únicos
INSERT INTO public.devices (id, model, storage, grade_id, color, battery_health, imei, cost_price_usd, suggested_price_usd, status)
VALUES 
    -- iPhone 13 128GB A++
    ('d1111111-1111-1111-1111-111111111101', 'iPhone 13', '128GB', '11111111-1111-1111-1111-111111111111', 'Meia-noite', 96, '354890123456781', 360.00, 440.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111102', 'iPhone 13', '128GB', '11111111-1111-1111-1111-111111111111', 'Estelar', 92, '354890123456782', 360.00, 440.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111103', 'iPhone 13', '128GB', '11111111-1111-1111-1111-111111111111', 'Azul', 89, '354890123456783', 360.00, 440.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111104', 'iPhone 13', '128GB', '11111111-1111-1111-1111-111111111111', 'Rosa', 94, '354890123456784', 360.00, 440.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111105', 'iPhone 13', '128GB', '11111111-1111-1111-1111-111111111111', 'Verde', 91, '354890123456785', 360.00, 440.00, 'Disponível'),
    
    -- iPhone 13 128GB AB+
    ('d1111111-1111-1111-1111-111111111106', 'iPhone 13', '128GB', '22222222-2222-2222-2222-222222222222', 'Meia-noite', 87, '354890123456786', 330.00, 410.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111107', 'iPhone 13', '128GB', '22222222-2222-2222-2222-222222222222', 'Estelar', 86, '354890123456787', 330.00, 410.00, 'Disponível'),

    -- iPhone 14 128GB A++
    ('d1111111-1111-1111-1111-111111111108', 'iPhone 14', '128GB', '11111111-1111-1111-1111-111111111111', 'Roxo', 98, '354890123456788', 460.00, 560.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111109', 'iPhone 14', '128GB', '11111111-1111-1111-1111-111111111111', 'Azul', 95, '354890123456789', 460.00, 560.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111110', 'iPhone 14', '128GB', '11111111-1111-1111-1111-111111111111', 'Estelar', 91, '354890123456790', 460.00, 560.00, 'Disponível'),

    -- iPhone 14 Pro 256GB A++
    ('d1111111-1111-1111-1111-111111111111', 'iPhone 14 Pro', '256GB', '11111111-1111-1111-1111-111111111111', 'Roxo-profundo', 93, '354890123456791', 650.00, 780.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111112', 'iPhone 14 Pro', '256GB', '11111111-1111-1111-1111-111111111111', 'Preto-espacial', 90, '354890123456792', 650.00, 780.00, 'Disponível'),
    
    -- iPhone 15 Pro 128GB A++
    ('d1111111-1111-1111-1111-111111111113', 'iPhone 15 Pro', '128GB', '11111111-1111-1111-1111-111111111111', 'Titânio Natural', 99, '354890123456793', 780.00, 920.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111114', 'iPhone 15 Pro', '128GB', '11111111-1111-1111-1111-111111111111', 'Titânio Azul', 97, '354890123456794', 780.00, 920.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111115', 'iPhone 15 Pro', '128GB', '11111111-1111-1111-1111-111111111111', 'Titânio Preto', 95, '354890123456795', 780.00, 920.00, 'Disponível'),

    -- iPhone 15 Pro Max 256GB A++
    ('d1111111-1111-1111-1111-111111111116', 'iPhone 15 Pro Max', '256GB', '11111111-1111-1111-1111-111111111111', 'Titânio Natural', 100, '354890123456796', 920.00, 1090.00, 'Disponível'),
    ('d1111111-1111-1111-1111-111111111117', 'iPhone 15 Pro Max', '256GB', '11111111-1111-1111-1111-111111111111', 'Titânio Branco', 98, '354890123456797', 920.00, 1090.00, 'Disponível')
ON CONFLICT (imei) DO NOTHING;

-- Configurações padrão
INSERT INTO public.settings (key, value)
VALUES 
    ('system_config', '{"app_name": "RiseMobile", "base_currency": "USD", "usd_to_brl_rate": 5.45, "enable_auto_rate": true, "theme": "system"}')
ON CONFLICT (key) DO NOTHING;
