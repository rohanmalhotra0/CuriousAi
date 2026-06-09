-- Dev seed: IBM Consulting enterprise-applications practice. Gives expert
-- routing a realistic org spanning the consulting hierarchy (intern → analyst →
-- consultant → senior consultant → manager/managing consultant → project
-- manager → senior manager → associate partner → partner) and the two big
-- packaged-app domains: Oracle (ERP/EPM/SCM/HCM) and SAP.
-- Idempotent via fixed UUIDs + ON CONFLICT. last_active_at is relative to now()
-- so recency ranking has spread; evidence_count generally tracks seniority.

INSERT INTO users (id, email, display_name, role, last_active_at) VALUES
  -- Oracle practice
  ('00000000-0000-0000-0000-0000000000b1', 'aisha.khan@curiousai.local',     'Aisha Khan',        'Consulting Intern — Oracle ERP',            now() - interval '4 hours'),
  ('00000000-0000-0000-0000-0000000000b2', 'tom.becker@curiousai.local',     'Tom Becker',        'Business Analyst — Oracle EPM',             now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000b3', 'priya.nair@curiousai.local',     'Priya Nair',        'Consultant — Oracle HCM',                   now() - interval '6 hours'),
  ('00000000-0000-0000-0000-0000000000b4', 'marco.rossi@curiousai.local',    'Marco Rossi',       'Senior Consultant — Oracle SCM',            now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000b5', 'helen.zhao@curiousai.local',     'Helen Zhao',        'Managing Consultant — Oracle ERP Financials', now() - interval '3 days'),
  ('00000000-0000-0000-0000-0000000000b6', 'david.osei@curiousai.local',     'David Osei',        'Project Manager — Oracle ERP Delivery',     now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000b7', 'fatima.aziz@curiousai.local',    'Fatima Aziz',       'Senior Manager — Oracle EPM',               now() - interval '5 days'),
  ('00000000-0000-0000-0000-0000000000b8', 'george.miller@curiousai.local',  'George Miller',     'Associate Partner — Oracle Practice',       now() - interval '9 days'),
  -- SAP practice
  ('00000000-0000-0000-0000-0000000000b9', 'lena.fischer@curiousai.local',   'Lena Fischer',      'Consulting Intern — SAP',                   now() - interval '3 hours'),
  ('00000000-0000-0000-0000-0000000000ba', 'raj.patel@curiousai.local',      'Raj Patel',         'Associate Consultant — SAP FICO',           now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000bb', 'sofia.gomez@curiousai.local',    'Sofia Gomez',       'Consultant — SAP SuccessFactors (HCM)',     now() - interval '12 hours'),
  ('00000000-0000-0000-0000-0000000000bc', 'ken.watanabe@curiousai.local',   'Ken Watanabe',      'Senior Consultant — SAP S/4HANA',           now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000bd', 'olu.adeyemi@curiousai.local',    'Olu Adeyemi',       'Manager — SAP MM/SD',                       now() - interval '4 days'),
  ('00000000-0000-0000-0000-0000000000be', 'clara.santos@curiousai.local',   'Clara Santos',      'Project Manager — SAP S/4HANA Delivery',    now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000bf', 'ahmed.hassan@curiousai.local',   'Ahmed Hassan',      'Senior Manager — SAP Supply Chain',         now() - interval '6 days'),
  ('00000000-0000-0000-0000-0000000000c0', 'nadia.petrov@curiousai.local',   'Nadia Petrov',      'Partner — SAP Practice',                    now() - interval '11 days'),
  -- Cross-practice leadership
  ('00000000-0000-0000-0000-0000000000c1', 'james.carter@curiousai.local',   'James Carter',      'Partner — Enterprise Applications',         now() - interval '14 days'),
  ('00000000-0000-0000-0000-0000000000c2', 'mei.lin@curiousai.local',        'Mei Lin',           'Delivery Lead / Project Manager — ERP',     now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO skills (user_id, name, summary, level, evidence_count, source) VALUES
  -- Aisha Khan — Oracle ERP intern
  ('00000000-0000-0000-0000-0000000000b1', 'Oracle ERP',                   'Oracle Fusion Cloud ERP fundamentals',          'beginner',      2, 'auto'),
  ('00000000-0000-0000-0000-0000000000b1', 'Requirements Gathering',       'Documenting client business processes',         'beginner',      1, 'auto'),
  -- Tom Becker — Oracle EPM analyst
  ('00000000-0000-0000-0000-0000000000b2', 'Oracle EPM',                   'Enterprise Performance Management Cloud',       'intermediate',  5, 'auto'),
  ('00000000-0000-0000-0000-0000000000b2', 'Hyperion Planning',           'Planning and budgeting models',                 'beginner',      3, 'auto'),
  ('00000000-0000-0000-0000-0000000000b2', 'Financial Reporting',          'Management and statutory reporting',            'beginner',      2, 'auto'),
  -- Priya Nair — Oracle HCM consultant
  ('00000000-0000-0000-0000-0000000000b3', 'Oracle HCM',                   'Oracle Fusion HCM Cloud configuration',         'intermediate',  6, 'auto'),
  ('00000000-0000-0000-0000-0000000000b3', 'Payroll',                      'Global payroll and absence management',         'intermediate',  4, 'auto'),
  ('00000000-0000-0000-0000-0000000000b3', 'Core HR',                      'Workforce structures and security',             'intermediate',  5, 'auto'),
  -- Marco Rossi — Oracle SCM senior consultant
  ('00000000-0000-0000-0000-0000000000b4', 'Oracle SCM',                   'Supply Chain Management Cloud',                 'advanced',      9, 'auto'),
  ('00000000-0000-0000-0000-0000000000b4', 'Procurement',                  'Source-to-pay and supplier management',         'advanced',      7, 'auto'),
  ('00000000-0000-0000-0000-0000000000b4', 'Inventory Management',         'Inventory, costing, and fulfillment',           'intermediate',  6, 'auto'),
  -- Helen Zhao — Oracle ERP Financials managing consultant
  ('00000000-0000-0000-0000-0000000000b5', 'Oracle ERP',                   'Fusion Financials end-to-end',                  'advanced',     11, 'auto'),
  ('00000000-0000-0000-0000-0000000000b5', 'Oracle Financials',           'GL, AP, AR, fixed assets',                      'advanced',     10, 'auto'),
  ('00000000-0000-0000-0000-0000000000b5', 'Record to Report',            'R2R process design and close',                  'advanced',      8, 'auto'),
  -- David Osei — Oracle ERP delivery PM
  ('00000000-0000-0000-0000-0000000000b6', 'Project Management',          'Oracle ERP implementation delivery',            'advanced',     12, 'auto'),
  ('00000000-0000-0000-0000-0000000000b6', 'Oracle ERP',                   'Program delivery and cutover',                  'advanced',      9, 'auto'),
  ('00000000-0000-0000-0000-0000000000b6', 'Agile Delivery',              'Scrum and hybrid delivery for ERP',             'intermediate',  6, 'auto'),
  -- Fatima Aziz — Oracle EPM senior manager
  ('00000000-0000-0000-0000-0000000000b7', 'Oracle EPM',                   'EPM Cloud solution architecture',               'advanced',     13, 'auto'),
  ('00000000-0000-0000-0000-0000000000b7', 'Hyperion Planning',           'PBCS/EPBCS and FCCS close',                      'advanced',     11, 'auto'),
  ('00000000-0000-0000-0000-0000000000b7', 'Financial Consolidation',     'FCCS and account reconciliation',               'advanced',      9, 'auto'),
  -- George Miller — Oracle associate partner
  ('00000000-0000-0000-0000-0000000000b8', 'Oracle ERP',                   'Oracle practice leadership and sales',          'advanced',     15, 'auto'),
  ('00000000-0000-0000-0000-0000000000b8', 'Client Engagement',           'Account growth and C-suite advisory',           'advanced',     14, 'auto'),
  ('00000000-0000-0000-0000-0000000000b8', 'Solution Architecture',       'Cross-pillar Oracle Cloud architecture',        'advanced',     12, 'auto'),
  -- Lena Fischer — SAP intern
  ('00000000-0000-0000-0000-0000000000b9', 'SAP',                          'SAP S/4HANA fundamentals',                      'beginner',      2, 'auto'),
  ('00000000-0000-0000-0000-0000000000b9', 'Business Process Mapping',    'As-is / to-be process documentation',           'beginner',      1, 'auto'),
  -- Raj Patel — SAP FICO associate consultant
  ('00000000-0000-0000-0000-0000000000ba', 'SAP FICO',                     'Finance and Controlling configuration',         'intermediate',  5, 'auto'),
  ('00000000-0000-0000-0000-0000000000ba', 'SAP',                          'S/4HANA finance module',                        'intermediate',  4, 'auto'),
  ('00000000-0000-0000-0000-0000000000ba', 'Financial Reporting',          'SAP reporting and period close',                'beginner',      3, 'auto'),
  -- Sofia Gomez — SAP SuccessFactors consultant
  ('00000000-0000-0000-0000-0000000000bb', 'SAP SuccessFactors',           'SuccessFactors HXM suite',                      'intermediate',  6, 'auto'),
  ('00000000-0000-0000-0000-0000000000bb', 'SAP',                          'HCM / HXM cloud',                               'intermediate',  4, 'auto'),
  ('00000000-0000-0000-0000-0000000000bb', 'Employee Central',            'Core HR data model and workflows',              'intermediate',  5, 'auto'),
  -- Ken Watanabe — SAP S/4HANA senior consultant
  ('00000000-0000-0000-0000-0000000000bc', 'SAP S/4HANA',                  'S/4HANA greenfield and conversion',             'advanced',      9, 'auto'),
  ('00000000-0000-0000-0000-0000000000bc', 'SAP',                          'Core S/4HANA architecture',                     'advanced',      8, 'auto'),
  ('00000000-0000-0000-0000-0000000000bc', 'ABAP',                         'Custom development and enhancements',           'intermediate',  5, 'auto'),
  -- Olu Adeyemi — SAP MM/SD manager
  ('00000000-0000-0000-0000-0000000000bd', 'SAP MM',                       'Materials Management and procurement',          'advanced',      8, 'auto'),
  ('00000000-0000-0000-0000-0000000000bd', 'SAP SD',                       'Sales and Distribution',                        'advanced',      7, 'auto'),
  ('00000000-0000-0000-0000-0000000000bd', 'SAP',                          'Logistics modules',                             'advanced',      9, 'auto'),
  -- Clara Santos — SAP delivery PM
  ('00000000-0000-0000-0000-0000000000be', 'Project Management',          'SAP S/4HANA program delivery',                  'advanced',     11, 'auto'),
  ('00000000-0000-0000-0000-0000000000be', 'SAP S/4HANA',                  'Activate methodology and cutover',              'advanced',      8, 'auto'),
  ('00000000-0000-0000-0000-0000000000be', 'Change Management',           'Org change and training for SAP rollouts',      'intermediate',  6, 'auto'),
  -- Ahmed Hassan — SAP Supply Chain senior manager
  ('00000000-0000-0000-0000-0000000000bf', 'SAP',                          'SAP supply chain solution lead',                'advanced',     12, 'auto'),
  ('00000000-0000-0000-0000-0000000000bf', 'SAP SCM',                      'Integrated Business Planning and EWM',          'advanced',     10, 'auto'),
  ('00000000-0000-0000-0000-0000000000bf', 'Supply Chain Planning',       'Demand and supply planning design',             'advanced',      9, 'auto'),
  -- Nadia Petrov — SAP partner
  ('00000000-0000-0000-0000-0000000000c0', 'SAP',                          'SAP practice leadership and sales',             'advanced',     16, 'auto'),
  ('00000000-0000-0000-0000-0000000000c0', 'Client Engagement',           'Transformation deals and C-suite advisory',     'advanced',     15, 'auto'),
  ('00000000-0000-0000-0000-0000000000c0', 'SAP S/4HANA',                  'Enterprise S/4HANA transformation strategy',    'advanced',     13, 'auto'),
  -- James Carter — Enterprise Applications partner (cross-practice)
  ('00000000-0000-0000-0000-0000000000c1', 'Enterprise Applications',     'Oracle + SAP portfolio leadership',             'advanced',     17, 'auto'),
  ('00000000-0000-0000-0000-0000000000c1', 'Client Engagement',           'Multi-tower transformation programs',           'advanced',     16, 'auto'),
  ('00000000-0000-0000-0000-0000000000c1', 'Digital Transformation',      'ERP-led business transformation',               'advanced',     14, 'auto'),
  -- Mei Lin — ERP delivery lead / PM (cross-practice)
  ('00000000-0000-0000-0000-0000000000c2', 'Project Management',          'Multi-ERP delivery leadership',                 'advanced',     13, 'auto'),
  ('00000000-0000-0000-0000-0000000000c2', 'Oracle ERP',                   'Oracle Cloud ERP delivery',                     'intermediate',  7, 'auto'),
  ('00000000-0000-0000-0000-0000000000c2', 'SAP S/4HANA',                  'S/4HANA delivery oversight',                    'intermediate',  6, 'auto')
ON CONFLICT DO NOTHING;
