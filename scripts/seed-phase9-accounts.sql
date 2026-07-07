WITH admin_user AS (
  SELECT id
  FROM iam_users
  WHERE email = 'admin@expenseflow.local'
  ORDER BY created_at
  LIMIT 1
),
subjects AS (
  SELECT *
  FROM (
    VALUES
      ('100101', '库存现金', 'ASSET'::"GlAccountCategory", 'DEBIT'::"GlNormalBalance", '现金付款默认科目'),
      ('100201', '银行存款', 'ASSET'::"GlAccountCategory", 'DEBIT'::"GlNormalBalance", '银行转账付款默认科目'),
      ('112201', '其他应收款-员工借款', 'ASSET'::"GlAccountCategory", 'DEBIT'::"GlNormalBalance", '员工借款或备用金往来科目'),
      ('220201', '应付职工报销款', 'LIABILITY'::"GlAccountCategory", 'CREDIT'::"GlNormalBalance", '报销确认后、付款前的员工往来科目'),
      ('22210101', '应交税费-应交增值税-进项税额', 'TAX'::"GlAccountCategory", 'DEBIT'::"GlNormalBalance", '可抵扣进项税科目'),
      ('224101', '其他应付款-公务卡', 'LIABILITY'::"GlAccountCategory", 'CREDIT'::"GlNormalBalance", '公务卡付款清算科目'),
      ('660201', '管理费用-差旅费', 'EXPENSE'::"GlAccountCategory", 'DEBIT'::"GlNormalBalance", '差旅费默认费用科目'),
      ('660202', '管理费用-交通费', 'EXPENSE'::"GlAccountCategory", 'DEBIT'::"GlNormalBalance", '交通费默认费用科目'),
      ('660203', '管理费用-业务招待费', 'EXPENSE'::"GlAccountCategory", 'DEBIT'::"GlNormalBalance", '招待费默认费用科目'),
      ('660204', '管理费用-办公费', 'EXPENSE'::"GlAccountCategory", 'DEBIT'::"GlNormalBalance", '办公费默认费用科目'),
      ('660299', '管理费用-其他费用', 'EXPENSE'::"GlAccountCategory", 'DEBIT'::"GlNormalBalance", '其他费用默认费用科目')
  ) AS value(code, name, category, normal_balance, description)
),
inserted_subjects AS (
  INSERT INTO gl_account_subjects (
    id,
    code,
    name,
    category,
    normal_balance,
    description,
    status,
    created_by,
    updated_at
  )
  SELECT
    'glsub_seed_' || lower(regexp_replace(code, '[^a-zA-Z0-9]+', '_', 'g')),
    code,
    name,
    category,
    normal_balance,
    description,
    'ACTIVE'::"GlStatus",
    admin_user.id,
    CURRENT_TIMESTAMP
  FROM subjects
  CROSS JOIN admin_user
  ON CONFLICT (code) DO UPDATE
  SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    normal_balance = EXCLUDED.normal_balance,
    description = EXCLUDED.description,
    status = 'ACTIVE'::"GlStatus",
    updated_at = CURRENT_TIMESTAMP,
    deleted_at = NULL
  RETURNING code
),
mappings AS (
  SELECT *
  FROM (
    VALUES
      ('glmap_seed_expense_travel', 'EXPENSE_TYPE'::"GlAccountMappingPurpose", 'TRAVEL', NULL::"PaymentMethod", NULL, '660201', 100),
      ('glmap_seed_expense_transport', 'EXPENSE_TYPE'::"GlAccountMappingPurpose", 'TRANSPORT', NULL::"PaymentMethod", NULL, '660202', 100),
      ('glmap_seed_expense_entertainment', 'EXPENSE_TYPE'::"GlAccountMappingPurpose", 'ENTERTAINMENT', NULL::"PaymentMethod", NULL, '660203', 100),
      ('glmap_seed_expense_office', 'EXPENSE_TYPE'::"GlAccountMappingPurpose", 'OFFICE', NULL::"PaymentMethod", NULL, '660204', 100),
      ('glmap_seed_expense_other', 'EXPENSE_TYPE'::"GlAccountMappingPurpose", 'OTHER', NULL::"PaymentMethod", NULL, '660299', 100),
      ('glmap_seed_employee_payable', 'EMPLOYEE_PAYABLE'::"GlAccountMappingPurpose", NULL, NULL::"PaymentMethod", NULL, '220201', 100),
      ('glmap_seed_input_tax', 'INPUT_TAX'::"GlAccountMappingPurpose", NULL, NULL::"PaymentMethod", NULL, '22210101', 100),
      ('glmap_seed_bank_transfer', 'BANK_PAYMENT'::"GlAccountMappingPurpose", NULL, 'BANK_TRANSFER'::"PaymentMethod", NULL, '100201', 90),
      ('glmap_seed_cash_payment', 'BANK_PAYMENT'::"GlAccountMappingPurpose", NULL, 'CASH'::"PaymentMethod", NULL, '100101', 90),
      ('glmap_seed_corporate_card', 'BANK_PAYMENT'::"GlAccountMappingPurpose", NULL, 'CORPORATE_CARD'::"PaymentMethod", NULL, '224101', 90),
      ('glmap_seed_bank_default', 'BANK_PAYMENT'::"GlAccountMappingPurpose", NULL, NULL::"PaymentMethod", NULL, '100201', 100)
  ) AS value(id, purpose, expense_type_code, payment_method, payer_account, account_subject_code, priority)
)
INSERT INTO gl_account_mappings (
  id,
  purpose,
  expense_type_code,
  payment_method,
  payer_account,
  account_subject_code,
  priority,
  status,
  created_by,
  updated_at
)
SELECT
  mappings.id,
  mappings.purpose,
  mappings.expense_type_code,
  mappings.payment_method,
  mappings.payer_account,
  mappings.account_subject_code,
  mappings.priority,
  'ACTIVE'::"GlStatus",
  admin_user.id,
  CURRENT_TIMESTAMP
FROM mappings
CROSS JOIN admin_user
ON CONFLICT (id) DO UPDATE
SET
  purpose = EXCLUDED.purpose,
  expense_type_code = EXCLUDED.expense_type_code,
  payment_method = EXCLUDED.payment_method,
  payer_account = EXCLUDED.payer_account,
  account_subject_code = EXCLUDED.account_subject_code,
  priority = EXCLUDED.priority,
  status = 'ACTIVE'::"GlStatus",
  updated_at = CURRENT_TIMESTAMP,
  deleted_at = NULL;
