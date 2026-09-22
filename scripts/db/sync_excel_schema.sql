-- Table: account
CREATE TABLE IF NOT EXISTS "account" (
  "account_id" TEXT,
  "request" TEXT,
  "account_name" TEXT,
  "type" TEXT,
  "currency" TEXT,
  "account_infor" TEXT,
  "account_status" TEXT,
  "account_number" TEXT,
  "bank_name" TEXT,
  "exchange_rate" NUMERIC,
  "transaction_managed_by" TEXT,
  "finance_control" TEXT,
  "company_entity" TEXT,
  PRIMARY KEY ("account_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'account_id') THEN
    ALTER TABLE "account" ADD COLUMN "account_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'request') THEN
    ALTER TABLE "account" ADD COLUMN "request" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'account_name') THEN
    ALTER TABLE "account" ADD COLUMN "account_name" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'type') THEN
    ALTER TABLE "account" ADD COLUMN "type" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'currency') THEN
    ALTER TABLE "account" ADD COLUMN "currency" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'account_infor') THEN
    ALTER TABLE "account" ADD COLUMN "account_infor" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'account_status') THEN
    ALTER TABLE "account" ADD COLUMN "account_status" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'account_number') THEN
    ALTER TABLE "account" ADD COLUMN "account_number" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'bank_name') THEN
    ALTER TABLE "account" ADD COLUMN "bank_name" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'exchange_rate') THEN
    ALTER TABLE "account" ADD COLUMN "exchange_rate" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'transaction_managed_by') THEN
    ALTER TABLE "account" ADD COLUMN "transaction_managed_by" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'finance_control') THEN
    ALTER TABLE "account" ADD COLUMN "finance_control" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'company_entity') THEN
    ALTER TABLE "account" ADD COLUMN "company_entity" TEXT;
  END IF;
END $$;

-- Table: asset
CREATE TABLE IF NOT EXISTS "asset" (
  "office_asset_id" TEXT,
  "asset_name" TEXT,
  "request" TEXT,
  "identity_number" TEXT,
  "type" TEXT,
  "qty" NUMERIC,
  "status" TEXT,
  "purchase_date" DATE,
  "purchase_cost" NUMERIC,
  "currency" TEXT,
  "exchange_rate" NUMERIC,
  "current_owner" TEXT,
  "location" TEXT,
  "note" TEXT,
  PRIMARY KEY ("office_asset_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'asset' AND column_name = 'office_asset_id') THEN
    ALTER TABLE "asset" ADD COLUMN "office_asset_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'asset' AND column_name = 'asset_name') THEN
    ALTER TABLE "asset" ADD COLUMN "asset_name" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'asset' AND column_name = 'request') THEN
    ALTER TABLE "asset" ADD COLUMN "request" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'asset' AND column_name = 'identity_number') THEN
    ALTER TABLE "asset" ADD COLUMN "identity_number" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'asset' AND column_name = 'type') THEN
    ALTER TABLE "asset" ADD COLUMN "type" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'asset' AND column_name = 'qty') THEN
    ALTER TABLE "asset" ADD COLUMN "qty" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'asset' AND column_name = 'status') THEN
    ALTER TABLE "asset" ADD COLUMN "status" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'asset' AND column_name = 'purchase_date') THEN
    ALTER TABLE "asset" ADD COLUMN "purchase_date" DATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'asset' AND column_name = 'purchase_cost') THEN
    ALTER TABLE "asset" ADD COLUMN "purchase_cost" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'asset' AND column_name = 'currency') THEN
    ALTER TABLE "asset" ADD COLUMN "currency" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'asset' AND column_name = 'exchange_rate') THEN
    ALTER TABLE "asset" ADD COLUMN "exchange_rate" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'asset' AND column_name = 'current_owner') THEN
    ALTER TABLE "asset" ADD COLUMN "current_owner" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'asset' AND column_name = 'location') THEN
    ALTER TABLE "asset" ADD COLUMN "location" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'asset' AND column_name = 'note') THEN
    ALTER TABLE "asset" ADD COLUMN "note" TEXT;
  END IF;
END $$;

-- Table: company
CREATE TABLE IF NOT EXISTS "company" (
  "company_id" TEXT,
  "company_shortname" TEXT,
  "company_fullname" TEXT,
  "type" TEXT,
  "logo" TEXT,
  "website" TEXT,
  "address" TEXT,
  "country" TEXT,
  "city" TEXT,
  PRIMARY KEY ("company_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'company_id') THEN
    ALTER TABLE "company" ADD COLUMN "company_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'company_shortname') THEN
    ALTER TABLE "company" ADD COLUMN "company_shortname" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'company_fullname') THEN
    ALTER TABLE "company" ADD COLUMN "company_fullname" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'type') THEN
    ALTER TABLE "company" ADD COLUMN "type" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'logo') THEN
    ALTER TABLE "company" ADD COLUMN "logo" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'website') THEN
    ALTER TABLE "company" ADD COLUMN "website" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'address') THEN
    ALTER TABLE "company" ADD COLUMN "address" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'country') THEN
    ALTER TABLE "company" ADD COLUMN "country" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'city') THEN
    ALTER TABLE "company" ADD COLUMN "city" TEXT;
  END IF;
END $$;

-- Table: contact
CREATE TABLE IF NOT EXISTS "contact" (
  "contact_id" TEXT,
  "company" TEXT,
  "title" TEXT,
  "name" TEXT,
  "gen" TEXT,
  "address" TEXT,
  "email" TEXT,
  "mobile_no" TEXT,
  "birthday" DATE,
  PRIMARY KEY ("contact_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'contact' AND column_name = 'contact_id') THEN
    ALTER TABLE "contact" ADD COLUMN "contact_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'contact' AND column_name = 'company') THEN
    ALTER TABLE "contact" ADD COLUMN "company" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'contact' AND column_name = 'title') THEN
    ALTER TABLE "contact" ADD COLUMN "title" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'contact' AND column_name = 'name') THEN
    ALTER TABLE "contact" ADD COLUMN "name" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'contact' AND column_name = 'gen') THEN
    ALTER TABLE "contact" ADD COLUMN "gen" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'contact' AND column_name = 'address') THEN
    ALTER TABLE "contact" ADD COLUMN "address" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'contact' AND column_name = 'email') THEN
    ALTER TABLE "contact" ADD COLUMN "email" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'contact' AND column_name = 'mobile_no') THEN
    ALTER TABLE "contact" ADD COLUMN "mobile_no" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'contact' AND column_name = 'birthday') THEN
    ALTER TABLE "contact" ADD COLUMN "birthday" DATE;
  END IF;
END $$;

-- Table: country_and_city
CREATE TABLE IF NOT EXISTS "country_and_city" (
  "country_and_city_id" TEXT,
  "country" TEXT,
  "city" TEXT,
  PRIMARY KEY ("country_and_city_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'country_and_city' AND column_name = 'country_and_city_id') THEN
    ALTER TABLE "country_and_city" ADD COLUMN "country_and_city_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'country_and_city' AND column_name = 'country') THEN
    ALTER TABLE "country_and_city" ADD COLUMN "country" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'country_and_city' AND column_name = 'city') THEN
    ALTER TABLE "country_and_city" ADD COLUMN "city" TEXT;
  END IF;
END $$;

-- Table: department
CREATE TABLE IF NOT EXISTS "department" (
  "department_id" TEXT,
  "department_name" TEXT,
  "department_head" TEXT,
  "my_company" TEXT,
  PRIMARY KEY ("department_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'department' AND column_name = 'department_id') THEN
    ALTER TABLE "department" ADD COLUMN "department_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'department' AND column_name = 'department_name') THEN
    ALTER TABLE "department" ADD COLUMN "department_name" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'department' AND column_name = 'department_head') THEN
    ALTER TABLE "department" ADD COLUMN "department_head" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'department' AND column_name = 'my_company') THEN
    ALTER TABLE "department" ADD COLUMN "my_company" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'department' AND column_name = 'department_code') THEN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'department' AND column_name = 'deparment_code') THEN
      ALTER TABLE "department" RENAME COLUMN "deparment_code" TO "department_code";
    ELSE
      ALTER TABLE "department" ADD COLUMN "department_code" TEXT;
    END IF;
  END IF;
END $$;

-- Table: employee
CREATE TABLE IF NOT EXISTS "employee" (
  "no" TEXT,
  "employee_id" TEXT,
  "request" TEXT,
  "full_name" TEXT,
  "picture" TEXT,
  "gen" TEXT,
  "position" TEXT,
  "employee_level" TEXT,
  "my_company" TEXT,
  "department" TEXT,
  "status" TEXT,
  "direct_manager" TEXT,
  "contract_type" TEXT,
  "role_type" TEXT,
  "location_base" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "emergency_contact_name" TEXT,
  "emergency_contact_phone" TEXT,
  "social_insurance_code" TEXT,
  "pit_code" TEXT,
  "start_date" DATE,
  "end_date" DATE,
  "bank_account" TEXT,
  "bank_name" TEXT,
  "bank_city" TEXT,
  "sow" TEXT,
  PRIMARY KEY ("employee_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'no') THEN
    ALTER TABLE "employee" ADD COLUMN "no" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'employee_id') THEN
    ALTER TABLE "employee" ADD COLUMN "employee_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'request') THEN
    ALTER TABLE "employee" ADD COLUMN "request" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'full_name') THEN
    ALTER TABLE "employee" ADD COLUMN "full_name" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'picture') THEN
    ALTER TABLE "employee" ADD COLUMN "picture" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'gen') THEN
    ALTER TABLE "employee" ADD COLUMN "gen" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'position') THEN
    ALTER TABLE "employee" ADD COLUMN "position" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'employee_level') THEN
    ALTER TABLE "employee" ADD COLUMN "employee_level" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'my_company') THEN
    ALTER TABLE "employee" ADD COLUMN "my_company" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'department') THEN
    ALTER TABLE "employee" ADD COLUMN "department" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'status') THEN
    ALTER TABLE "employee" ADD COLUMN "status" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'direct_manager') THEN
    ALTER TABLE "employee" ADD COLUMN "direct_manager" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'contract_type') THEN
    ALTER TABLE "employee" ADD COLUMN "contract_type" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'role_type') THEN
    ALTER TABLE "employee" ADD COLUMN "role_type" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'location_base') THEN
    ALTER TABLE "employee" ADD COLUMN "location_base" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'email') THEN
    ALTER TABLE "employee" ADD COLUMN "email" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'phone') THEN
    ALTER TABLE "employee" ADD COLUMN "phone" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'address') THEN
    ALTER TABLE "employee" ADD COLUMN "address" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'emergency_contact_name') THEN
    ALTER TABLE "employee" ADD COLUMN "emergency_contact_name" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'emergency_contact_phone') THEN
    ALTER TABLE "employee" ADD COLUMN "emergency_contact_phone" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'social_insurance_code') THEN
    ALTER TABLE "employee" ADD COLUMN "social_insurance_code" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'pit_code') THEN
    ALTER TABLE "employee" ADD COLUMN "pit_code" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'start_date') THEN
    ALTER TABLE "employee" ADD COLUMN "start_date" DATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'end_date') THEN
    ALTER TABLE "employee" ADD COLUMN "end_date" DATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'bank_account') THEN
    ALTER TABLE "employee" ADD COLUMN "bank_account" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'bank_name') THEN
    ALTER TABLE "employee" ADD COLUMN "bank_name" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'bank_city') THEN
    ALTER TABLE "employee" ADD COLUMN "bank_city" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'employee' AND column_name = 'sow') THEN
    ALTER TABLE "employee" ADD COLUMN "sow" TEXT;
  END IF;
END $$;

-- Table: expense
CREATE TABLE IF NOT EXISTS "expense" (
  "expense_id" TEXT,
  "request" TEXT,
  "expense" TEXT,
  "description" TEXT,
  "my_company" TEXT,
  "employee" TEXT,
  "value_before_vat" NUMERIC,
  "vat_value" NUMERIC,
  "currency" TEXT,
  "exchange_rate" NUMERIC,
  "expense_type" TEXT,
  "cost_type" TEXT,
  "created_date" DATE,
  "note" TEXT,
  PRIMARY KEY ("expense_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'expense' AND column_name = 'expense_id') THEN
    ALTER TABLE "expense" ADD COLUMN "expense_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'expense' AND column_name = 'request') THEN
    ALTER TABLE "expense" ADD COLUMN "request" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'expense' AND column_name = 'expense') THEN
    ALTER TABLE "expense" ADD COLUMN "expense" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'expense' AND column_name = 'description') THEN
    ALTER TABLE "expense" ADD COLUMN "description" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'expense' AND column_name = 'my_company') THEN
    ALTER TABLE "expense" ADD COLUMN "my_company" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'expense' AND column_name = 'employee') THEN
    ALTER TABLE "expense" ADD COLUMN "employee" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'expense' AND column_name = 'value_before_vat') THEN
    ALTER TABLE "expense" ADD COLUMN "value_before_vat" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'expense' AND column_name = 'vat_value') THEN
    ALTER TABLE "expense" ADD COLUMN "vat_value" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'expense' AND column_name = 'currency') THEN
    ALTER TABLE "expense" ADD COLUMN "currency" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'expense' AND column_name = 'exchange_rate') THEN
    ALTER TABLE "expense" ADD COLUMN "exchange_rate" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'expense' AND column_name = 'expense_type') THEN
    ALTER TABLE "expense" ADD COLUMN "expense_type" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'expense' AND column_name = 'cost_type') THEN
    ALTER TABLE "expense" ADD COLUMN "cost_type" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'expense' AND column_name = 'created_date') THEN
    ALTER TABLE "expense" ADD COLUMN "created_date" DATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'expense' AND column_name = 'note') THEN
    ALTER TABLE "expense" ADD COLUMN "note" TEXT;
  END IF;
END $$;

-- Table: invoice
CREATE TABLE IF NOT EXISTS "invoice" (
  "invoice_id" TEXT,
  "request" TEXT,
  "orders" TEXT,
  "my_company" TEXT,
  "invoice_type" TEXT,
  "counter_party" TEXT,
  "invoice_no" TEXT,
  "description" TEXT,
  "invoice_date" DATE,
  "invoice_status" TEXT,
  "payment_method" TEXT,
  "value_before_vat" NUMERIC,
  "vat_value" NUMERIC,
  "currency" TEXT,
  "exchange_rate" NUMERIC,
  "attached_file" TEXT,
  "invoice_request" TEXT,
  PRIMARY KEY ("invoice_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'invoice' AND column_name = 'invoice_id') THEN
    ALTER TABLE "invoice" ADD COLUMN "invoice_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'invoice' AND column_name = 'request') THEN
    ALTER TABLE "invoice" ADD COLUMN "request" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'invoice' AND column_name = 'orders') THEN
    ALTER TABLE "invoice" ADD COLUMN "orders" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'invoice' AND column_name = 'my_company') THEN
    ALTER TABLE "invoice" ADD COLUMN "my_company" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'invoice' AND column_name = 'invoice_type') THEN
    ALTER TABLE "invoice" ADD COLUMN "invoice_type" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'invoice' AND column_name = 'counter_party') THEN
    ALTER TABLE "invoice" ADD COLUMN "counter_party" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'invoice' AND column_name = 'invoice_no') THEN
    ALTER TABLE "invoice" ADD COLUMN "invoice_no" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'invoice' AND column_name = 'description') THEN
    ALTER TABLE "invoice" ADD COLUMN "description" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'invoice' AND column_name = 'invoice_date') THEN
    ALTER TABLE "invoice" ADD COLUMN "invoice_date" DATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'invoice' AND column_name = 'invoice_status') THEN
    ALTER TABLE "invoice" ADD COLUMN "invoice_status" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'invoice' AND column_name = 'payment_method') THEN
    ALTER TABLE "invoice" ADD COLUMN "payment_method" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'invoice' AND column_name = 'value_before_vat') THEN
    ALTER TABLE "invoice" ADD COLUMN "value_before_vat" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'invoice' AND column_name = 'vat_value') THEN
    ALTER TABLE "invoice" ADD COLUMN "vat_value" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'invoice' AND column_name = 'currency') THEN
    ALTER TABLE "invoice" ADD COLUMN "currency" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'invoice' AND column_name = 'exchange_rate') THEN
    ALTER TABLE "invoice" ADD COLUMN "exchange_rate" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'invoice' AND column_name = 'attached_file') THEN
    ALTER TABLE "invoice" ADD COLUMN "attached_file" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'invoice' AND column_name = 'invoice_request') THEN
    ALTER TABLE "invoice" ADD COLUMN "invoice_request" TEXT;
  END IF;
END $$;

-- Table: mtr
CREATE TABLE IF NOT EXISTS "mtr" (
  "transaction_id" TEXT,
  "request" TEXT,
  "account" TEXT,
  "transaction_date" DATE,
  "transaction_type" TEXT,
  "description" TEXT,
  "amount" NUMERIC,
  "exchange_rate" NUMERIC,
  "note" TEXT,
  "status" TEXT,
  PRIMARY KEY ("transaction_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'mtr' AND column_name = 'transaction_id') THEN
    ALTER TABLE "mtr" ADD COLUMN "transaction_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'mtr' AND column_name = 'request') THEN
    ALTER TABLE "mtr" ADD COLUMN "request" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'mtr' AND column_name = 'account') THEN
    ALTER TABLE "mtr" ADD COLUMN "account" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'mtr' AND column_name = 'transaction_date') THEN
    ALTER TABLE "mtr" ADD COLUMN "transaction_date" DATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'mtr' AND column_name = 'transaction_type') THEN
    ALTER TABLE "mtr" ADD COLUMN "transaction_type" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'mtr' AND column_name = 'description') THEN
    ALTER TABLE "mtr" ADD COLUMN "description" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'mtr' AND column_name = 'amount') THEN
    ALTER TABLE "mtr" ADD COLUMN "amount" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'mtr' AND column_name = 'exchange_rate') THEN
    ALTER TABLE "mtr" ADD COLUMN "exchange_rate" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'mtr' AND column_name = 'note') THEN
    ALTER TABLE "mtr" ADD COLUMN "note" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'mtr' AND column_name = 'status') THEN
    ALTER TABLE "mtr" ADD COLUMN "status" TEXT;
  END IF;
END $$;

-- Table: my_company
CREATE TABLE IF NOT EXISTS "my_company" (
  "my_company_id" TEXT,
  "company_shortname" TEXT,
  "company_fullname" TEXT,
  "logo" TEXT,
  "tax_code" TEXT,
  "website" TEXT,
  "address" TEXT,
  "country" TEXT,
  "base_currency" TEXT,
  "currency_list" TEXT,
  PRIMARY KEY ("my_company_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'my_company' AND column_name = 'my_company_id') THEN
    ALTER TABLE "my_company" ADD COLUMN "my_company_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'my_company' AND column_name = 'company_shortname') THEN
    ALTER TABLE "my_company" ADD COLUMN "company_shortname" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'my_company' AND column_name = 'company_fullname') THEN
    ALTER TABLE "my_company" ADD COLUMN "company_fullname" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'my_company' AND column_name = 'logo') THEN
    ALTER TABLE "my_company" ADD COLUMN "logo" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'my_company' AND column_name = 'tax_code') THEN
    ALTER TABLE "my_company" ADD COLUMN "tax_code" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'my_company' AND column_name = 'website') THEN
    ALTER TABLE "my_company" ADD COLUMN "website" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'my_company' AND column_name = 'address') THEN
    ALTER TABLE "my_company" ADD COLUMN "address" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'my_company' AND column_name = 'country') THEN
    ALTER TABLE "my_company" ADD COLUMN "country" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'my_company' AND column_name = 'base_currency') THEN
    ALTER TABLE "my_company" ADD COLUMN "base_currency" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'my_company' AND column_name = 'currency_list') THEN
    ALTER TABLE "my_company" ADD COLUMN "currency_list" TEXT;
  END IF;
END $$;

-- Table: my_location
CREATE TABLE IF NOT EXISTS "my_location" (
  "my_location_id" TEXT,
  "location_code" TEXT,
  "type" TEXT,
  "address" TEXT,
  "my_company" TEXT,
  "responsible_employee" TEXT,
  "status" TEXT,
  PRIMARY KEY ("my_location_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'my_location' AND column_name = 'my_location_id') THEN
    ALTER TABLE "my_location" ADD COLUMN "my_location_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'my_location' AND column_name = 'location_code') THEN
    ALTER TABLE "my_location" ADD COLUMN "location_code" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'my_location' AND column_name = 'type') THEN
    ALTER TABLE "my_location" ADD COLUMN "type" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'my_location' AND column_name = 'address') THEN
    ALTER TABLE "my_location" ADD COLUMN "address" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'my_location' AND column_name = 'my_company') THEN
    ALTER TABLE "my_location" ADD COLUMN "my_company" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'my_location' AND column_name = 'responsible_employee') THEN
    ALTER TABLE "my_location" ADD COLUMN "responsible_employee" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'my_location' AND column_name = 'status') THEN
    ALTER TABLE "my_location" ADD COLUMN "status" TEXT;
  END IF;
END $$;

-- Table: my_service
CREATE TABLE IF NOT EXISTS "my_service" (
  "my_service_id" TEXT,
  "my_company" TEXT,
  "service_name" TEXT,
  "type" TEXT,
  "vendor" TEXT,
  PRIMARY KEY ("my_service_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'my_service' AND column_name = 'my_service_id') THEN
    ALTER TABLE "my_service" ADD COLUMN "my_service_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'my_service' AND column_name = 'my_company') THEN
    ALTER TABLE "my_service" ADD COLUMN "my_company" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'my_service' AND column_name = 'service_name') THEN
    ALTER TABLE "my_service" ADD COLUMN "service_name" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'my_service' AND column_name = 'type') THEN
    ALTER TABLE "my_service" ADD COLUMN "type" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'my_service' AND column_name = 'vendor') THEN
    ALTER TABLE "my_service" ADD COLUMN "vendor" TEXT;
  END IF;
END $$;

-- Table: operation_program
CREATE TABLE IF NOT EXISTS "operation_program" (
  "oper_id" TEXT,
  "expense_code" TEXT,
  "expense_name" TEXT,
  "expense_type" TEXT,
  "description" TEXT,
  PRIMARY KEY ("oper_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'operation_program' AND column_name = 'oper_id') THEN
    ALTER TABLE "operation_program" ADD COLUMN "oper_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'operation_program' AND column_name = 'expense_code') THEN
    ALTER TABLE "operation_program" ADD COLUMN "expense_code" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'operation_program' AND column_name = 'expense_name') THEN
    ALTER TABLE "operation_program" ADD COLUMN "expense_name" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'operation_program' AND column_name = 'expense_type') THEN
    ALTER TABLE "operation_program" ADD COLUMN "expense_type" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'operation_program' AND column_name = 'description') THEN
    ALTER TABLE "operation_program" ADD COLUMN "description" TEXT;
  END IF;
END $$;

-- Table: opportunities
CREATE TABLE IF NOT EXISTS "opportunities" (
  "request" TEXT,
  "end-user" TEXT,
  "previous_project" TEXT,
  "sales" TEXT,
  "my_company" TEXT,
  "project_id" TEXT,
  "project_name" TEXT,
  "oracle_od_number" TEXT,
  "project_type" TEXT,
  "contract_start_date" DATE,
  "contract_end_date" DATE,
  "estimated_gm" NUMERIC,
  "currency" TEXT,
  "exchange_rate" NUMERIC,
  "status" TEXT,
  "target_close_date" DATE,
  "action_to_close" TEXT,
  PRIMARY KEY ("request")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'request') THEN
    ALTER TABLE "opportunities" ADD COLUMN "request" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'end-user') THEN
    ALTER TABLE "opportunities" ADD COLUMN "end-user" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'previous_project') THEN
    ALTER TABLE "opportunities" ADD COLUMN "previous_project" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'sales') THEN
    ALTER TABLE "opportunities" ADD COLUMN "sales" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'my_company') THEN
    ALTER TABLE "opportunities" ADD COLUMN "my_company" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'project_id') THEN
    ALTER TABLE "opportunities" ADD COLUMN "project_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'project_name') THEN
    ALTER TABLE "opportunities" ADD COLUMN "project_name" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'oracle_od_number') THEN
    ALTER TABLE "opportunities" ADD COLUMN "oracle_od_number" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'project_type') THEN
    ALTER TABLE "opportunities" ADD COLUMN "project_type" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'contract_start_date') THEN
    ALTER TABLE "opportunities" ADD COLUMN "contract_start_date" DATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'contract_end_date') THEN
    ALTER TABLE "opportunities" ADD COLUMN "contract_end_date" DATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'estimated_gm') THEN
    ALTER TABLE "opportunities" ADD COLUMN "estimated_gm" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'currency') THEN
    ALTER TABLE "opportunities" ADD COLUMN "currency" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'exchange_rate') THEN
    ALTER TABLE "opportunities" ADD COLUMN "exchange_rate" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'status') THEN
    ALTER TABLE "opportunities" ADD COLUMN "status" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'target_close_date') THEN
    ALTER TABLE "opportunities" ADD COLUMN "target_close_date" DATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'action_to_close') THEN
    ALTER TABLE "opportunities" ADD COLUMN "action_to_close" TEXT;
  END IF;
END $$;

-- Table: orders
CREATE TABLE IF NOT EXISTS "orders" (
  "order_id" TEXT,
  "request" TEXT,
  "my_company" TEXT,
  "sale_person" TEXT,
  "order_type" TEXT,
  "customer_type" TEXT,
  "company" TEXT,
  "contact" TEXT,
  "order_no" TEXT,
  "order_description" TEXT,
  "order_date" DATE,
  "value_before_vat" NUMERIC,
  "vat_value" NUMERIC,
  "currency" TEXT,
  "exchange_rate" NUMERIC,
  "order_file" TEXT,
  "opportunities" TEXT,
  "pal" TEXT,
  "sale_type" TEXT,
  PRIMARY KEY ("order_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_id') THEN
    ALTER TABLE "orders" ADD COLUMN "order_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'request') THEN
    ALTER TABLE "orders" ADD COLUMN "request" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'my_company') THEN
    ALTER TABLE "orders" ADD COLUMN "my_company" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'sale_person') THEN
    ALTER TABLE "orders" ADD COLUMN "sale_person" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_type') THEN
    ALTER TABLE "orders" ADD COLUMN "order_type" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_type') THEN
    ALTER TABLE "orders" ADD COLUMN "customer_type" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'company') THEN
    ALTER TABLE "orders" ADD COLUMN "company" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'contact') THEN
    ALTER TABLE "orders" ADD COLUMN "contact" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_no') THEN
    ALTER TABLE "orders" ADD COLUMN "order_no" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_description') THEN
    ALTER TABLE "orders" ADD COLUMN "order_description" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_date') THEN
    ALTER TABLE "orders" ADD COLUMN "order_date" DATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'value_before_vat') THEN
    ALTER TABLE "orders" ADD COLUMN "value_before_vat" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'vat_value') THEN
    ALTER TABLE "orders" ADD COLUMN "vat_value" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'currency') THEN
    ALTER TABLE "orders" ADD COLUMN "currency" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'exchange_rate') THEN
    ALTER TABLE "orders" ADD COLUMN "exchange_rate" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_file') THEN
    ALTER TABLE "orders" ADD COLUMN "order_file" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'opportunities') THEN
    ALTER TABLE "orders" ADD COLUMN "opportunities" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'pal') THEN
    ALTER TABLE "orders" ADD COLUMN "pal" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'sale_type') THEN
    ALTER TABLE "orders" ADD COLUMN "sale_type" TEXT;
  END IF;
END $$;

-- Table: pal
CREATE TABLE IF NOT EXISTS "pal" (
  "pal_id" TEXT,
  "request" TEXT,
  "opportunities" TEXT,
  "description" TEXT,
  PRIMARY KEY ("pal_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pal' AND column_name = 'pal_id') THEN
    ALTER TABLE "pal" ADD COLUMN "pal_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pal' AND column_name = 'request') THEN
    ALTER TABLE "pal" ADD COLUMN "request" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pal' AND column_name = 'opportunities') THEN
    ALTER TABLE "pal" ADD COLUMN "opportunities" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pal' AND column_name = 'description') THEN
    ALTER TABLE "pal" ADD COLUMN "description" TEXT;
  END IF;
END $$;

-- Table: pal_service
CREATE TABLE IF NOT EXISTS "pal_service" (
  "pal_service_id" TEXT,
  "pal" TEXT,
  "my_service" TEXT,
  "my_company" TEXT,
  "selling_party" TEXT,
  "buying_party" TEXT,
  "contract_selling_price" NUMERIC,
  "net_selling_price" NUMERIC,
  "mktf" NUMERIC,
  "buying_price" NUMERIC,
  "note" TEXT,
  "currency" TEXT,
  "exchange_rate" NUMERIC,
  PRIMARY KEY ("pal_service_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pal_service' AND column_name = 'pal_service_id') THEN
    ALTER TABLE "pal_service" ADD COLUMN "pal_service_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pal_service' AND column_name = 'pal') THEN
    ALTER TABLE "pal_service" ADD COLUMN "pal" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pal_service' AND column_name = 'my_service') THEN
    ALTER TABLE "pal_service" ADD COLUMN "my_service" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pal_service' AND column_name = 'my_company') THEN
    ALTER TABLE "pal_service" ADD COLUMN "my_company" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pal_service' AND column_name = 'selling_party') THEN
    ALTER TABLE "pal_service" ADD COLUMN "selling_party" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pal_service' AND column_name = 'buying_party') THEN
    ALTER TABLE "pal_service" ADD COLUMN "buying_party" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pal_service' AND column_name = 'contract_selling_price') THEN
    ALTER TABLE "pal_service" ADD COLUMN "contract_selling_price" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pal_service' AND column_name = 'net_selling_price') THEN
    ALTER TABLE "pal_service" ADD COLUMN "net_selling_price" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pal_service' AND column_name = 'mktf') THEN
    ALTER TABLE "pal_service" ADD COLUMN "mktf" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pal_service' AND column_name = 'buying_price') THEN
    ALTER TABLE "pal_service" ADD COLUMN "buying_price" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pal_service' AND column_name = 'note') THEN
    ALTER TABLE "pal_service" ADD COLUMN "note" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pal_service' AND column_name = 'currency') THEN
    ALTER TABLE "pal_service" ADD COLUMN "currency" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pal_service' AND column_name = 'exchange_rate') THEN
    ALTER TABLE "pal_service" ADD COLUMN "exchange_rate" NUMERIC;
  END IF;
END $$;

-- Table: payment
CREATE TABLE IF NOT EXISTS "payment" (
  "payment_id" TEXT,
  "request" TEXT,
  "orders" TEXT,
  "my_company" TEXT,
  "payment_type" TEXT,
  "counter_party" TEXT,
  "company" TEXT,
  "employee" TEXT,
  "payment_description" TEXT,
  "payment_period" NUMERIC,
  "payment_term" TEXT,
  "due_date" DATE,
  "value" NUMERIC,
  "currency" TEXT,
  "exchange_rate" NUMERIC,
  "payment_method" TEXT,
  "bank_info" TEXT,
  "payment_status" TEXT,
  "payment_date" DATE,
  "transaction_id" TEXT,
  "payment_request" TEXT,
  PRIMARY KEY ("payment_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment' AND column_name = 'payment_id') THEN
    ALTER TABLE "payment" ADD COLUMN "payment_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment' AND column_name = 'request') THEN
    ALTER TABLE "payment" ADD COLUMN "request" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment' AND column_name = 'orders') THEN
    ALTER TABLE "payment" ADD COLUMN "orders" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment' AND column_name = 'my_company') THEN
    ALTER TABLE "payment" ADD COLUMN "my_company" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment' AND column_name = 'payment_type') THEN
    ALTER TABLE "payment" ADD COLUMN "payment_type" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment' AND column_name = 'counter_party') THEN
    ALTER TABLE "payment" ADD COLUMN "counter_party" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment' AND column_name = 'company') THEN
    ALTER TABLE "payment" ADD COLUMN "company" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment' AND column_name = 'employee') THEN
    ALTER TABLE "payment" ADD COLUMN "employee" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment' AND column_name = 'payment_description') THEN
    ALTER TABLE "payment" ADD COLUMN "payment_description" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment' AND column_name = 'payment_period') THEN
    ALTER TABLE "payment" ADD COLUMN "payment_period" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment' AND column_name = 'payment_term') THEN
    ALTER TABLE "payment" ADD COLUMN "payment_term" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment' AND column_name = 'due_date') THEN
    ALTER TABLE "payment" ADD COLUMN "due_date" DATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment' AND column_name = 'value') THEN
    ALTER TABLE "payment" ADD COLUMN "value" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment' AND column_name = 'currency') THEN
    ALTER TABLE "payment" ADD COLUMN "currency" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment' AND column_name = 'exchange_rate') THEN
    ALTER TABLE "payment" ADD COLUMN "exchange_rate" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment' AND column_name = 'payment_method') THEN
    ALTER TABLE "payment" ADD COLUMN "payment_method" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment' AND column_name = 'bank_info') THEN
    ALTER TABLE "payment" ADD COLUMN "bank_info" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment' AND column_name = 'payment_status') THEN
    ALTER TABLE "payment" ADD COLUMN "payment_status" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment' AND column_name = 'payment_date') THEN
    ALTER TABLE "payment" ADD COLUMN "payment_date" DATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment' AND column_name = 'transaction_id') THEN
    ALTER TABLE "payment" ADD COLUMN "transaction_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment' AND column_name = 'payment_request') THEN
    ALTER TABLE "payment" ADD COLUMN "payment_request" TEXT;
  END IF;
END $$;

-- Table: policy_and_program
CREATE TABLE IF NOT EXISTS "policy_and_program" (
  "process_id" TEXT,
  "request" TEXT,
  "process_type" TEXT,
  "process_name" TEXT,
  "description" TEXT,
  "procedure_file" TEXT,
  "procedure_link" TEXT,
  "is_standard" TEXT,
  "tier_2_approval" TEXT,
  "tier_3_approval" TEXT,
  "approval_level" TEXT,
  "policy_lead" TEXT,
  "sr_owner" TEXT,
  "elements" TEXT,
  PRIMARY KEY ("process_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'policy_and_program' AND column_name = 'process_id') THEN
    ALTER TABLE "policy_and_program" ADD COLUMN "process_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'policy_and_program' AND column_name = 'request') THEN
    ALTER TABLE "policy_and_program" ADD COLUMN "request" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'policy_and_program' AND column_name = 'process_type') THEN
    ALTER TABLE "policy_and_program" ADD COLUMN "process_type" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'policy_and_program' AND column_name = 'process_name') THEN
    ALTER TABLE "policy_and_program" ADD COLUMN "process_name" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'policy_and_program' AND column_name = 'description') THEN
    ALTER TABLE "policy_and_program" ADD COLUMN "description" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'policy_and_program' AND column_name = 'procedure_file') THEN
    ALTER TABLE "policy_and_program" ADD COLUMN "procedure_file" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'policy_and_program' AND column_name = 'procedure_link') THEN
    ALTER TABLE "policy_and_program" ADD COLUMN "procedure_link" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'policy_and_program' AND column_name = 'is_standard') THEN
    ALTER TABLE "policy_and_program" ADD COLUMN "is_standard" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'policy_and_program' AND column_name = 'tier_2_approval') THEN
    ALTER TABLE "policy_and_program" ADD COLUMN "tier_2_approval" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'policy_and_program' AND column_name = 'tier_3_approval') THEN
    ALTER TABLE "policy_and_program" ADD COLUMN "tier_3_approval" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'policy_and_program' AND column_name = 'approval_level') THEN
    ALTER TABLE "policy_and_program" ADD COLUMN "approval_level" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'policy_and_program' AND column_name = 'policy_lead') THEN
    ALTER TABLE "policy_and_program" ADD COLUMN "policy_lead" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'policy_and_program' AND column_name = 'sr_owner') THEN
    ALTER TABLE "policy_and_program" ADD COLUMN "sr_owner" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'policy_and_program' AND column_name = 'elements') THEN
    ALTER TABLE "policy_and_program" ADD COLUMN "elements" TEXT;
  END IF;
END $$;

-- Table: request
CREATE TABLE IF NOT EXISTS "request" (
  "request_id" TEXT,
  "request_type" TEXT,
  "sr_creater" TEXT,
  "requester" TEXT,
  "description" TEXT,
  "is_standard" TEXT,
  "tier_1_approval" TEXT,
  "tier_1_status" TEXT,
  "tier_1_update_date" TIMESTAMP,
  "tier_2_approval" TEXT,
  "tier_2_status" TEXT,
  "tier_2_update_date" TIMESTAMP,
  "tier_3_approval" TEXT,
  "tier_3_status" TEXT,
  "tier_3_update_date" TIMESTAMP,
  "sr_start_date" TIMESTAMP,
  "policy_lead" TEXT,
  "sr_owner" TEXT,
  "sr_status" TEXT,
  "sr_created_date" TIMESTAMP,
  "sr_close_date" TIMESTAMP,
  "process_status" TEXT,
  "process_start_date" TIMESTAMP,
  "process_end_date" DATE,
  "approval_level" TEXT,
  "elements" TEXT,
  "rating" TEXT,
  "rating_comment" TEXT,
  "my_company" TEXT,
  PRIMARY KEY ("request_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'request_id') THEN
    ALTER TABLE "request" ADD COLUMN "request_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'request_type') THEN
    ALTER TABLE "request" ADD COLUMN "request_type" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'sr_creater') THEN
    ALTER TABLE "request" ADD COLUMN "sr_creater" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'requester') THEN
    ALTER TABLE "request" ADD COLUMN "requester" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'description') THEN
    ALTER TABLE "request" ADD COLUMN "description" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'is_standard') THEN
    ALTER TABLE "request" ADD COLUMN "is_standard" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'tier_1_approval') THEN
    ALTER TABLE "request" ADD COLUMN "tier_1_approval" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'tier_1_status') THEN
    ALTER TABLE "request" ADD COLUMN "tier_1_status" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'tier_1_update_date') THEN
    ALTER TABLE "request" ADD COLUMN "tier_1_update_date" TIMESTAMP;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'tier_2_approval') THEN
    ALTER TABLE "request" ADD COLUMN "tier_2_approval" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'tier_2_status') THEN
    ALTER TABLE "request" ADD COLUMN "tier_2_status" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'tier_2_update_date') THEN
    ALTER TABLE "request" ADD COLUMN "tier_2_update_date" TIMESTAMP;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'tier_3_approval') THEN
    ALTER TABLE "request" ADD COLUMN "tier_3_approval" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'tier_3_status') THEN
    ALTER TABLE "request" ADD COLUMN "tier_3_status" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'tier_3_update_date') THEN
    ALTER TABLE "request" ADD COLUMN "tier_3_update_date" TIMESTAMP;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'sr_start_date') THEN
    ALTER TABLE "request" ADD COLUMN "sr_start_date" TIMESTAMP;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'policy_lead') THEN
    ALTER TABLE "request" ADD COLUMN "policy_lead" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'sr_owner') THEN
    ALTER TABLE "request" ADD COLUMN "sr_owner" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'sr_status') THEN
    ALTER TABLE "request" ADD COLUMN "sr_status" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'sr_created_date') THEN
    ALTER TABLE "request" ADD COLUMN "sr_created_date" TIMESTAMP;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'sr_close_date') THEN
    ALTER TABLE "request" ADD COLUMN "sr_close_date" TIMESTAMP;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'process_status') THEN
    ALTER TABLE "request" ADD COLUMN "process_status" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'process_start_date') THEN
    ALTER TABLE "request" ADD COLUMN "process_start_date" TIMESTAMP;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'process_end_date') THEN
    ALTER TABLE "request" ADD COLUMN "process_end_date" DATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'approval_level') THEN
    ALTER TABLE "request" ADD COLUMN "approval_level" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'elements') THEN
    ALTER TABLE "request" ADD COLUMN "elements" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'rating') THEN
    ALTER TABLE "request" ADD COLUMN "rating" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'rating_comment') THEN
    ALTER TABLE "request" ADD COLUMN "rating_comment" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'my_company') THEN
    ALTER TABLE "request" ADD COLUMN "my_company" TEXT;
  END IF;
END $$;

-- Table: comment
CREATE TABLE IF NOT EXISTS "comment" (
  "request_detail_id" TEXT,
  "request" TEXT,
  "comment" TEXT,
  "file" TEXT,
  "link" TEXT,
  "comment_by" TEXT,
  "comment_date" TIMESTAMP,
  "reply_to" TEXT,
  "to" TEXT,
  PRIMARY KEY ("request_detail_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'comment' AND column_name = 'request_detail_id') THEN
    ALTER TABLE "comment" ADD COLUMN "request_detail_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'comment' AND column_name = 'request') THEN
    ALTER TABLE "comment" ADD COLUMN "request" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'comment' AND column_name = 'comment') THEN
    ALTER TABLE "comment" ADD COLUMN "comment" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'comment' AND column_name = 'file') THEN
    ALTER TABLE "comment" ADD COLUMN "file" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'comment' AND column_name = 'link') THEN
    ALTER TABLE "comment" ADD COLUMN "link" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'comment' AND column_name = 'comment_by') THEN
    ALTER TABLE "comment" ADD COLUMN "comment_by" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'comment' AND column_name = 'comment_date') THEN
    ALTER TABLE "comment" ADD COLUMN "comment_date" TIMESTAMP;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'comment' AND column_name = 'reply_to') THEN
    ALTER TABLE "comment" ADD COLUMN "reply_to" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'comment' AND column_name = 'to') THEN
    ALTER TABLE "comment" ADD COLUMN "to" TEXT;
  END IF;
END $$;

-- Table: service
CREATE TABLE IF NOT EXISTS "service" (
  "service_id" TEXT,
  "request" TEXT,
  "service_type" TEXT,
  "service_name" TEXT,
  "status" TEXT,
  "start_date" DATE,
  "end_date" DATE,
  "asset" TEXT,
  "note" TEXT,
  "fy" TEXT,
  PRIMARY KEY ("service_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'service' AND column_name = 'service_id') THEN
    ALTER TABLE "service" ADD COLUMN "service_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'service' AND column_name = 'request') THEN
    ALTER TABLE "service" ADD COLUMN "request" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'service' AND column_name = 'service_type') THEN
    ALTER TABLE "service" ADD COLUMN "service_type" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'service' AND column_name = 'service_name') THEN
    ALTER TABLE "service" ADD COLUMN "service_name" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'service' AND column_name = 'status') THEN
    ALTER TABLE "service" ADD COLUMN "status" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'service' AND column_name = 'start_date') THEN
    ALTER TABLE "service" ADD COLUMN "start_date" DATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'service' AND column_name = 'end_date') THEN
    ALTER TABLE "service" ADD COLUMN "end_date" DATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'service' AND column_name = 'asset') THEN
    ALTER TABLE "service" ADD COLUMN "asset" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'service' AND column_name = 'note') THEN
    ALTER TABLE "service" ADD COLUMN "note" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'service' AND column_name = 'fy') THEN
    ALTER TABLE "service" ADD COLUMN "fy" TEXT;
  END IF;
END $$;

-- Table: service_order
CREATE TABLE IF NOT EXISTS "service_order" (
  "service_order_id" TEXT,
  "request" TEXT,
  "orders" TEXT,
  "my_company" TEXT,
  "my_service" TEXT,
  "start_date" DATE,
  "end_date" DATE,
  "status" TEXT,
  "value_before_vat" NUMERIC,
  "vat_value" NUMERIC,
  "currency" TEXT,
  "exchange_rate" NUMERIC,
  PRIMARY KEY ("service_order_id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'service_order' AND column_name = 'service_order_id') THEN
    ALTER TABLE "service_order" ADD COLUMN "service_order_id" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'service_order' AND column_name = 'request') THEN
    ALTER TABLE "service_order" ADD COLUMN "request" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'service_order' AND column_name = 'orders') THEN
    ALTER TABLE "service_order" ADD COLUMN "orders" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'service_order' AND column_name = 'my_company') THEN
    ALTER TABLE "service_order" ADD COLUMN "my_company" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'service_order' AND column_name = 'my_service') THEN
    ALTER TABLE "service_order" ADD COLUMN "my_service" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'service_order' AND column_name = 'start_date') THEN
    ALTER TABLE "service_order" ADD COLUMN "start_date" DATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'service_order' AND column_name = 'end_date') THEN
    ALTER TABLE "service_order" ADD COLUMN "end_date" DATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'service_order' AND column_name = 'status') THEN
    ALTER TABLE "service_order" ADD COLUMN "status" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'service_order' AND column_name = 'value_before_vat') THEN
    ALTER TABLE "service_order" ADD COLUMN "value_before_vat" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'service_order' AND column_name = 'vat_value') THEN
    ALTER TABLE "service_order" ADD COLUMN "vat_value" NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'service_order' AND column_name = 'currency') THEN
    ALTER TABLE "service_order" ADD COLUMN "currency" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'service_order' AND column_name = 'exchange_rate') THEN
    ALTER TABLE "service_order" ADD COLUMN "exchange_rate" NUMERIC;
  END IF;
END $$;

