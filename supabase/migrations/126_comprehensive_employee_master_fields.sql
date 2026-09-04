-- Migration 126: Comprehensive 70+ Employee Master Fields across 7 Lifecycle Sections

ALTER TABLE public.employee_profiles
  -- 1. Personal & Contact Details
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS blood_group TEXT,
  ADD COLUMN IF NOT EXISTS marital_status TEXT,
  ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT 'Indian',
  ADD COLUMN IF NOT EXISTS personal_email TEXT,
  ADD COLUMN IF NOT EXISTS personal_phone TEXT,
  ADD COLUMN IF NOT EXISTS alternate_phone TEXT,
  ADD COLUMN IF NOT EXISTS permanent_address TEXT,

  -- 2. Family & Nominee Details
  ADD COLUMN IF NOT EXISTS father_name TEXT,
  ADD COLUMN IF NOT EXISTS mother_name TEXT,
  ADD COLUMN IF NOT EXISTS spouse_name TEXT,
  ADD COLUMN IF NOT EXISTS family_details JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pf_nominee_name TEXT,
  ADD COLUMN IF NOT EXISTS pf_nominee_relation TEXT,
  ADD COLUMN IF NOT EXISTS pf_nominee_dob DATE,
  ADD COLUMN IF NOT EXISTS pf_nominee_share_pct NUMERIC DEFAULT 100,
  ADD COLUMN IF NOT EXISTS esi_nominee_name TEXT,
  ADD COLUMN IF NOT EXISTS esi_nominee_relation TEXT,
  ADD COLUMN IF NOT EXISTS esi_nominee_share_pct NUMERIC DEFAULT 100,
  ADD COLUMN IF NOT EXISTS gratuity_nominee_name TEXT,
  ADD COLUMN IF NOT EXISTS gratuity_nominee_relation TEXT,
  ADD COLUMN IF NOT EXISTS gratuity_nominee_share_pct NUMERIC DEFAULT 100,

  -- 3. Bank & Statutory Details
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_ifsc_code TEXT,
  ADD COLUMN IF NOT EXISTS bank_branch_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_type TEXT DEFAULT 'SAVINGS',
  ADD COLUMN IF NOT EXISTS pan_number TEXT,
  ADD COLUMN IF NOT EXISTS aadhaar_number TEXT,
  ADD COLUMN IF NOT EXISTS uan_number TEXT,
  ADD COLUMN IF NOT EXISTS pf_account_number TEXT,
  ADD COLUMN IF NOT EXISTS esi_ip_number TEXT,
  ADD COLUMN IF NOT EXISTS passport_number TEXT,
  ADD COLUMN IF NOT EXISTS passport_expiry_date DATE,

  -- 4. Educational Qualifications
  ADD COLUMN IF NOT EXISTS highest_qualification TEXT,
  ADD COLUMN IF NOT EXISTS education_details JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '[]'::jsonb,

  -- 5. Previous Work Experience
  ADD COLUMN IF NOT EXISTS total_experience_years NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS previous_work_history JSONB DEFAULT '[]'::jsonb,

  -- 6. Document Vault & Metadata
  ADD COLUMN IF NOT EXISTS document_vault JSONB DEFAULT '[]'::jsonb,

  -- 7. Statutory & Work Location Details
  ADD COLUMN IF NOT EXISTS work_location TEXT,
  ADD COLUMN IF NOT EXISTS probation_end_date DATE,
  ADD COLUMN IF NOT EXISTS confirmation_date DATE,
  ADD COLUMN IF NOT EXISTS notice_period_days INTEGER DEFAULT 30;

-- Comments for Schema Documentation
COMMENT ON COLUMN public.employee_profiles.family_details IS 'Array of dependent family members: name, relation, dob, phone, is_dependent';
COMMENT ON COLUMN public.employee_profiles.education_details IS 'Array of educational degrees: degree, institute, passing_year, percentage, specialization';
COMMENT ON COLUMN public.employee_profiles.previous_work_history IS 'Array of previous employment history: company_name, designation, start_date, end_date, ctc, reason_for_leaving, manager_contact';
COMMENT ON COLUMN public.employee_profiles.document_vault IS 'Array of employee documents: doc_type, title, file_url, uploaded_at, status';
