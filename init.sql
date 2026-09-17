--
-- PostgreSQL database dump
--

\restrict d3DnwQeFfXguxFvbZmQCfYTEgd9Uwe3mYsNiutpzFNqhSSR8tEtnMOMV03WbyJS

-- Dumped from database version 18.4 (Debian 18.4-1.pgdg13+1)
-- Dumped by pg_dump version 18.4 (Debian 18.4-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: postgres_fdw; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgres_fdw WITH SCHEMA public;


--
-- Name: EXTENSION postgres_fdw; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgres_fdw IS 'foreign-data wrapper for remote PostgreSQL servers';


--
-- Name: audit_log_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_log_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  DECLARE
      v_pk_col TEXT;
      v_record_id TEXT;
      v_action TEXT;
      user_val TEXT;
      changed_fields JSONB;
  BEGIN
      -- Query the primary key column name dynamically from postgres catalogs
      SELECT a.attname INTO v_pk_col
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = TG_RELID AND i.indisprimary
      LIMIT 1;

      IF v_pk_col IS NULL THEN
          v_pk_col := 'id'; -- Fallback
      END IF;

      -- Resolve the record_id based on operation
      IF (TG_OP = 'DELETE') THEN
          v_record_id := COALESCE(to_jsonb(OLD) ->> v_pk_col, 'unknown');
      ELSE
          v_record_id := COALESCE(to_jsonb(NEW) ->> v_pk_col, 'unknown');
      END IF;

      -- Resolve the user executing the change
      BEGIN
          user_val := current_setting('app.current_user', true);
      EXCEPTION WHEN OTHERS THEN
          user_val := NULL;
      END;

      IF user_val IS NULL OR user_val = '' THEN
          IF (TG_OP = 'DELETE') THEN
              user_val := COALESCE(
                  to_jsonb(OLD) ->> 'updated_by',
                  to_jsonb(OLD) ->> 'created_by',
                  'system'
              );
          ELSE
              user_val := COALESCE(
                  to_jsonb(NEW) ->> 'updated_by',
                  to_jsonb(NEW) ->> 'created_by',
                  'system'
              );
          END IF;
      END IF;

      IF (TG_OP = 'INSERT') THEN
          v_action := 'created record';
          
          SELECT jsonb_object_agg(key, jsonb_build_object('old', null, 'new', value)) INTO changed_fields
          FROM jsonb_each(to_jsonb(NEW))
          WHERE key NOT IN ('log', 'updated_date', 'updated_by', 'created_date', 'created_by') AND value IS NOT NULL;

          INSERT INTO audit_logs (table_name, record_id, action, changes, changed_by)
          VALUES (TG_TABLE_NAME, v_record_id, v_action, COALESCE(changed_fields, '{}'::jsonb), user_val);

      ELSIF (TG_OP = 'UPDATE') THEN
          v_action := 'updated record';

          SELECT jsonb_object_agg(key, jsonb_build_object('old', old_val, 'new', new_val)) INTO changed_fields
          FROM (
              SELECT o.key, o.value as old_val, n.value as new_val
              FROM jsonb_each(to_jsonb(OLD)) o
              JOIN jsonb_each(to_jsonb(NEW)) n ON o.key = n.key
              WHERE o.value IS DISTINCT FROM n.value
                AND o.key NOT IN ('log', 'updated_date', 'updated_by', 'created_date', 'created_by')
          ) t;

          IF changed_fields IS NOT NULL AND changed_fields != '{}'::jsonb THEN
              INSERT INTO audit_logs (table_name, record_id, action, changes, changed_by)
              VALUES (TG_TABLE_NAME, v_record_id, v_action, changed_fields, user_val);
          END IF;

      ELSIF (TG_OP = 'DELETE') THEN
          v_action := 'deleted record';
          
          -- Storing the entire old record state as the changes payload during delete
          INSERT INTO audit_logs (table_name, record_id, action, changes, changed_by)
          VALUES (TG_TABLE_NAME, v_record_id, v_action, to_jsonb(OLD), user_val);
          
          RETURN OLD;
      END IF;

      RETURN NEW;
  END;
  $$;


--
-- Name: cascade_soft_delete_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cascade_soft_delete_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
  DECLARE
      r RECORD;
      child_table_name text;
      child_col_name text;
      parent_col_name text;
      val_to_match text;
      has_deleted_at_col boolean;
  BEGIN
      IF (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
          -- Cascade using database foreign key constraints
          FOR r IN (
              SELECT DISTINCT
                  kcu.table_name AS child_table,
                  kcu.column_name AS child_column,
                  ccu.column_name AS parent_column
              FROM information_schema.table_constraints AS tc
              JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
              JOIN information_schema.referential_constraints AS rc
                  ON tc.constraint_name = rc.constraint_name
              JOIN information_schema.constraint_column_usage AS ccu
                  ON rc.unique_constraint_name = ccu.constraint_name
                  AND rc.unique_constraint_schema = ccu.table_schema
              WHERE tc.constraint_type = 'FOREIGN KEY'
                AND ccu.table_name = TG_TABLE_NAME
          ) LOOP
              child_table_name := r.child_table;
              child_col_name := r.child_column;
              parent_col_name := r.parent_column;
              
              EXECUTE format('SELECT ($1).%I::text', parent_col_name) USING NEW INTO val_to_match;
              
              IF val_to_match IS NOT NULL THEN
                  SELECT EXISTS (
                      SELECT 1 FROM information_schema.columns 
                      WHERE table_schema = current_schema() AND table_name = child_table_name AND column_name = 'deleted_at'
                  ) INTO has_deleted_at_col;
                  
                  IF has_deleted_at_col THEN
                      EXECUTE format(
                          'UPDATE %I SET deleted_at = $1 WHERE %I = $2 AND deleted_at IS NULL',
                          child_table_name, child_col_name
                      ) USING NEW.deleted_at, val_to_match;
                  END IF;
              END IF;
          END LOOP;
          
          -- Cascade using logical request relationships
          IF TG_TABLE_NAME = 'request' THEN
              val_to_match := NEW.request_id;
              IF val_to_match IS NOT NULL THEN
                  FOR child_table_name IN 
                      SELECT unnest(ARRAY['payment', 'invoice', 'mtr', 'service', 'asset', 'comment', 'contract'])
                  LOOP
                      SELECT EXISTS (
                          SELECT 1 FROM information_schema.columns 
                          WHERE table_schema = current_schema() AND table_name = child_table_name AND column_name = 'deleted_at'
                      ) INTO has_deleted_at_col;
                      
                      IF has_deleted_at_col THEN
                          EXECUTE format(
                              'UPDATE %I SET deleted_at = $1 WHERE request = $2 AND deleted_at IS NULL',
                              child_table_name
                          ) USING NEW.deleted_at, val_to_match;
                      END IF;
                  END LOOP;
              END IF;
          END IF;
      ELSIF (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) THEN
          -- Cascade restore using database foreign key constraints
          FOR r IN (
              SELECT DISTINCT
                  kcu.table_name AS child_table,
                  kcu.column_name AS child_column,
                  ccu.column_name AS parent_column
              FROM information_schema.table_constraints AS tc
              JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
              JOIN information_schema.referential_constraints AS rc
                  ON tc.constraint_name = rc.constraint_name
              JOIN information_schema.constraint_column_usage AS ccu
                  ON rc.unique_constraint_name = ccu.constraint_name
                  AND rc.unique_constraint_schema = ccu.table_schema
              WHERE tc.constraint_type = 'FOREIGN KEY'
                AND ccu.table_name = TG_TABLE_NAME
          ) LOOP
              child_table_name := r.child_table;
              child_col_name := r.child_column;
              parent_col_name := r.parent_column;
              
              EXECUTE format('SELECT ($1).%I::text', parent_col_name) USING NEW INTO val_to_match;
              
              IF val_to_match IS NOT NULL THEN
                  SELECT EXISTS (
                      SELECT 1 FROM information_schema.columns 
                      WHERE table_schema = current_schema() AND table_name = child_table_name AND column_name = 'deleted_at'
                  ) INTO has_deleted_at_col;
                  
                  IF has_deleted_at_col THEN
                      EXECUTE format(
                          'UPDATE %I SET deleted_at = NULL WHERE %I = $1 AND deleted_at IS NOT NULL',
                          child_table_name, child_col_name
                      ) USING val_to_match;
                  END IF;
              END IF;
          END LOOP;
          
          -- Cascade restore using logical request relationships
          IF TG_TABLE_NAME = 'request' THEN
              val_to_match := NEW.request_id;
              IF val_to_match IS NOT NULL THEN
                  FOR child_table_name IN 
                      SELECT unnest(ARRAY['payment', 'invoice', 'mtr', 'service', 'asset', 'comment', 'contract'])
                  LOOP
                      SELECT EXISTS (
                          SELECT 1 FROM information_schema.columns 
                          WHERE table_schema = current_schema() AND table_name = child_table_name AND column_name = 'deleted_at'
                      ) INTO has_deleted_at_col;
                      
                      IF has_deleted_at_col THEN
                          EXECUTE format(
                              'UPDATE %I SET deleted_at = NULL WHERE request = $1 AND deleted_at IS NOT NULL',
                              child_table_name
                          ) USING val_to_match;
                      END IF;
                  END LOOP;
              END IF;
          END IF;
      END IF;
      RETURN NEW;
  END;
  $_$;


--
-- Name: enforce_request_submit_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_request_submit_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.sr_status = 2 THEN
    IF NEW.sr_submitted_date IS NULL THEN
      NEW.sr_submitted_date := CURRENT_TIMESTAMP;
    END IF;

    IF NEW.approval_flow IS NOT NULL AND jsonb_typeof(NEW.approval_flow) = 'object' AND NEW.approval_flow ? 'steps' THEN
      NEW.approval_flow := jsonb_set(
        NEW.approval_flow,
        '{steps}',
        (
          SELECT jsonb_agg(
            CASE
              WHEN ord = 1 AND (step->>'status' = '7' OR step->>'status' = '1' OR LOWER(step->>'status') IN ('not started yet', 'not started', 'draft'))
              THEN jsonb_set(step, '{status}', '2'::jsonb, true)
              ELSE step
            END
            ORDER BY ord
          )
          FROM jsonb_array_elements(NEW.approval_flow->'steps') WITH ORDINALITY AS s(step, ord)
        ),
        true
      );
    END IF;
  ELSIF NEW.sr_status = 1 THEN
    NEW.process_status := 7;

    IF NEW.approval_flow IS NOT NULL AND jsonb_typeof(NEW.approval_flow) = 'object' AND NEW.approval_flow ? 'steps' THEN
      NEW.approval_flow := jsonb_set(
        NEW.approval_flow,
        '{steps}',
        (
          SELECT jsonb_agg(
            jsonb_set(
              jsonb_set(
                jsonb_set(step, '{status}', '7'::jsonb, true),
                '{action_by}', 'null'::jsonb, true
              ),
              '{action_date}', 'null'::jsonb, true
            )
            ORDER BY ord
          )
          FROM jsonb_array_elements(NEW.approval_flow->'steps') WITH ORDINALITY AS s(step, ord)
        ),
        true
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: normalize_approval_flow_statuses(jsonb, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_approval_flow_statuses(flow jsonb, sr_st integer) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_steps jsonb;
  v_new_steps jsonb;
  v_current_level int := 1;
  v_total_levels int := 1;
  v_elem jsonb;
  v_idx int := 0;
  v_st_raw text;
  v_new_st int;
  v_found_pending boolean := false;
BEGIN
  IF flow IS NULL OR jsonb_typeof(flow) != 'object' OR NOT (flow ? 'steps') THEN
    RETURN flow;
  END IF;

  v_steps := flow->'steps';
  IF jsonb_typeof(v_steps) != 'array' THEN
    RETURN flow;
  END IF;

  v_new_steps := '[]'::jsonb;
  v_total_levels := jsonb_array_length(v_steps);

  FOR v_idx IN 0 .. (v_total_levels - 1) LOOP
    v_elem := v_steps->v_idx;
    v_st_raw := LOWER(TRIM(COALESCE(v_elem->>'status', '')));

    IF v_st_raw IN ('3', 'approved') THEN
      v_new_st := 3;
    ELSIF v_st_raw IN ('4', 'rejected') THEN
      v_new_st := 4;
    ELSIF v_st_raw IN ('2', 'pending', 'pending approval', 'submitted') THEN
      v_new_st := 2;
    ELSE
      -- Not started yet / Draft / 7
      IF v_idx = 0 AND sr_st = 2 AND NOT v_found_pending THEN
        v_new_st := 2; -- Level 1 is pending approval when request is submitted
      ELSE
        v_new_st := 7;
      END IF;
    END IF;

    IF v_new_st = 2 AND NOT v_found_pending THEN
      v_found_pending := true;
      v_current_level := v_idx + 1;
    END IF;

    v_new_steps := v_new_steps || jsonb_build_array(
      jsonb_set(
        v_elem,
        '{status}',
        to_jsonb(v_new_st)
      )
    );
  END LOOP;

  -- Determine current_level if no pending step found
  IF NOT v_found_pending THEN
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_new_steps) s WHERE (s->>'status')::int = 4) THEN
      v_current_level := 1;
    ELSIF (SELECT COUNT(*) FROM jsonb_array_elements(v_new_steps) s WHERE (s->>'status')::int = 3) = v_total_levels THEN
      v_current_level := v_total_levels + 1;
    ELSE
      v_current_level := 1;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'steps', v_new_steps,
    'total_levels', COALESCE((flow->>'total_levels')::int, v_total_levels),
    'current_level', v_current_level,
    'audit_log', COALESCE(flow->'audit_log', '[]'::jsonb)
  );
END;
$$;


--
-- Name: propagate_contract_request_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.propagate_contract_request_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
      IF OLD.request IS DISTINCT FROM NEW.request THEN
          UPDATE public.payment SET request = NEW.request WHERE contract_id = NEW.contract_id;
          UPDATE public.invoice SET request = NEW.request WHERE contract_id = NEW.contract_id;
      END IF;
      RETURN NEW;
  END;
  $$;


--
-- Name: safe_parse_jsonb(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.safe_parse_jsonb(val text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
  BEGIN
      RETURN val::jsonb;
  EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object(
          'timestamp', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'user', 'system',
          'action', val,
          'changes', '{}'::jsonb
      );
  END;
  $$;


--
-- Name: sync_request_and_source_from_contract(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_request_and_source_from_contract() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
      IF NEW.contract_id IS NOT NULL THEN
          SELECT request INTO NEW.request FROM public.contract WHERE contract_id = NEW.contract_id;
          NEW.source := 'Contract';
      ELSE
          IF NEW.source IS NULL THEN
              NEW.source := 'Request';
          END IF;
      END IF;
      RETURN NEW;
  END;
  $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account (
    account_id character varying(50) NOT NULL,
    account_name text,
    type character varying(100),
    currency text,
    account_infor text,
    account_status integer DEFAULT 19,
    account_number text,
    bank_name text,
    exchange_rate integer,
    transaction_managed_by text,
    finance_control text,
    company_entity text,
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone,
    id_request character varying(50),
    id__request character varying(50)
);


--
-- Name: action_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.action_rules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: action_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_rules (
    id integer DEFAULT nextval('public.action_rules_id_seq'::regclass) NOT NULL,
    action_id text,
    view_name text,
    levels text,
    positions text,
    roles text,
    exceptions text,
    description text,
    display_name text,
    display boolean DEFAULT true,
    deleted_at timestamp without time zone,
    log jsonb DEFAULT '[]'::jsonb
);


--
-- Name: asset; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset (
    office_asset_id character varying(50) NOT NULL,
    asset_name text,
    request text,
    identity_number text,
    type character varying(100),
    qty integer,
    status integer DEFAULT 21,
    purchase_date date,
    purchase_cost text,
    currency text,
    exchange_rate text,
    current_owner text,
    location text,
    log jsonb DEFAULT '[]'::jsonb,
    value_in_base_currency numeric,
    deleted_at timestamp without time zone,
    notification_logs jsonb DEFAULT '[]'::jsonb,
    updat character varying(50),
    note text,
    id__my_company character varying(50)
);


--
-- Name: assigned_task; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assigned_task (
    task_id character varying(50) NOT NULL,
    request_id character varying(50),
    employee_id character varying(50),
    deadline date,
    description text,
    task_info_link text,
    task_info_guide_file text,
    task_info_notes text,
    task_info_report text,
    task_info_comment text,
    status integer DEFAULT 62,
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    table_name character varying(100) NOT NULL,
    record_id character varying(100) NOT NULL,
    action character varying(50) NOT NULL,
    changes jsonb,
    changed_by character varying(100),
    tx_id bigint DEFAULT txid_current(),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: automation_registry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_registry (
    automation_id text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone,
    updated_by text
);


--
-- Name: automation_run_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_run_logs (
    id bigint NOT NULL,
    automation_id text NOT NULL,
    source text NOT NULL,
    table_name text,
    record_id text,
    changed_columns text[],
    condition_snapshot jsonb,
    output_snapshot jsonb,
    status text DEFAULT 'success'::text NOT NULL,
    message text,
    run_at timestamp with time zone DEFAULT now() NOT NULL,
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone
);


--
-- Name: automation_run_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.automation_run_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: automation_run_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.automation_run_logs_id_seq OWNED BY public.automation_run_logs.id;


--
-- Name: cms_tenant_info; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cms_tenant_info (
    id integer NOT NULL,
    tenant_domain text NOT NULL,
    tenant_api_key text NOT NULL,
    customer_id text,
    plan_id text,
    plan_name text,
    billing_status text,
    next_payment_date date,
    super_admin_email text,
    subscription_start_date date,
    subscription_status text,
    last_billing_amount numeric(15,2),
    last_sync_signature text,
    last_sync_timestamp bigint,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    user_limit integer,
    log jsonb DEFAULT '[]'::jsonb,
    features jsonb DEFAULT '{}'::jsonb
);


--
-- Name: cms_tenant_info_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cms_tenant_info_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cms_tenant_info_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cms_tenant_info_id_seq OWNED BY public.cms_tenant_info.id;


--
-- Name: column_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.column_permissions (
    id integer NOT NULL,
    table_name text NOT NULL,
    column_name text NOT NULL,
    levels text,
    positions text,
    roles text,
    exceptions text,
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone
);


--
-- Name: column_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.column_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: column_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.column_permissions_id_seq OWNED BY public.column_permissions.id;


--
-- Name: comment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comment (
    comment_id character varying(255) NOT NULL,
    request character varying(255),
    comment text,
    file text,
    link text,
    comment_by character varying(255),
    comment_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reply_to character varying(255),
    tag text,
    logs jsonb,
    deleted_at timestamp without time zone,
    log jsonb DEFAULT '[]'::jsonb
);


--
-- Name: company; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company (
    company_id character varying NOT NULL,
    company_shortname character varying,
    company_fullname character varying,
    type character varying,
    logo character varying,
    website character varying,
    address text,
    country character varying,
    city character varying,
    log jsonb DEFAULT '[]'::jsonb,
    state text,
    province text,
    deleted_at timestamp without time zone,
    tax_code character varying(50)
);


--
-- Name: contact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact (
    contact_id character varying NOT NULL,
    name character varying,
    title character varying,
    email character varying,
    mobile_no character varying,
    gen character varying,
    birthday date,
    company_id character varying,
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone
);


--
-- Name: contract; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract (
    contract_id character varying(50) NOT NULL,
    request text,
    my_company integer,
    contract_owner text,
    type integer DEFAULT 69,
    contractor integer,
    project text,
    contractspood_no text,
    contract_name_or_description text,
    contract_signed_date date,
    value_before_vat numeric,
    vat_value numeric,
    currency text,
    exchance_rate numeric,
    total_value numeric,
    value_before_vat_in_base_currency numeric,
    vat_value_in_base_currency numeric,
    total_value_in_base_currency numeric,
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone,
    department_id character varying,
    notification_logs jsonb DEFAULT '[]'::jsonb,
    finance_splits jsonb DEFAULT '[]'::jsonb,
    note text,
    id__request character varying(59)
);


--
-- Name: customize; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customize (
    id integer NOT NULL,
    setting_name character varying(100) NOT NULL,
    font_family character varying(100),
    font_size character varying(20),
    text_color character varying(20),
    bg_color character varying(20),
    menu_icons jsonb,
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone
);


--
-- Name: department; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department (
    department_id character varying NOT NULL,
    department_name character varying,
    manager_email character varying,
    company_id character varying,
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone,
    department_code character varying(20)
);


--
-- Name: employee; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee (
    full_name character varying,
    picture bytea,
    gen character varying,
    "position" character varying,
    employee_level character varying,
    company_id character varying,
    department_id character varying,
    status integer DEFAULT 17,
    direct_manager character varying,
    role character varying,
    location_base character varying,
    email character varying,
    phone character varying,
    address text,
    emergency_contact_name character varying,
    emergency_contact_phone character varying,
    social_insurance_code character varying,
    pit_code character varying,
    start_date date,
    end_date date,
    bank_account character varying,
    bank_name character varying,
    bank_city character varying,
    sow text,
    avatar bytea,
    password character varying,
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone,
    employee_id character varying(50) NOT NULL,
    username character varying(100),
    app_user_enabled boolean DEFAULT true NOT NULL,
    nick_name character varying(255),
    employee_code character varying(50),
    head_manager character varying(50)
);


--
-- Name: COLUMN employee.app_user_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.employee.app_user_enabled IS 'Controls whether employee can use the app. TRUE = enabled (default). FALSE = disabled by Super Admin. Independent of the status column (Active/Inactive) which tracks employment status.';


--
-- Name: exception_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exception_rules (
    id integer NOT NULL,
    name text,
    table_name text,
    levels text,
    positions text,
    roles text,
    exceptions text,
    deleted_at timestamp without time zone,
    log jsonb DEFAULT '[]'::jsonb
);


--
-- Name: exception_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exception_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exception_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exception_rules_id_seq OWNED BY public.exception_rules.id;


--
-- Name: expense; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    id__request character varying(50),
    description text,
    value_before_vat decimal,
    vat_value decimal,
    exchange_rate decimal,
    total_value decimal,
    value_before_vat_in_base_currency decimal,
    vat_value_in_base_currency decimal,
    total_value_in_base_currency decimal,
    id__currency character varying(10),
    id__employee character varying(100),
    id__expense_type integer,
    id__expense_cost integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    id__my_company character varying(50),
    id__opportunity character varying(50),
    fy character varying(50),
    deleted_at timestamp without time zone,
    log jsonb DEFAULT '[]'::jsonb
);


--
-- Name: finance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance (
    fcid character varying(20) NOT NULL,
    finance_account_number character varying(50) NOT NULL,
    finance_account_name character varying(255) NOT NULL,
    finance_type character varying(50),
    english_name character varying(255),
    description text,
    example text,
    status character varying(50),
    department character varying(100),
    finance_account_standard character varying(100),
    operation_type character varying(100),
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone
);


--
-- Name: finance_fcid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.finance_fcid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: finance_fcid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.finance_fcid_seq OWNED BY public.finance.fcid;


--
-- Name: invoice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice (
    invoice_id character varying(50) NOT NULL,
    request text,
    contract_id character varying(50),
    my_company text,
    invoice_type character varying(100),
    counter_party text,
    invoice_no text,
    description text,
    invoice_date date,
    invoice_status integer DEFAULT 34,
    payment_method text,
    value_before_vat numeric,
    vat_value text,
    currency text,
    exchange_rate integer,
    attached_file text,
    log jsonb DEFAULT '[]'::jsonb,
    invoice_request text,
    deleted_at timestamp without time zone,
    notification_logs jsonb DEFAULT '[]'::jsonb,
    finance_splits jsonb DEFAULT '[]'::jsonb,
    payment_id character varying(50),
    source character varying(50) DEFAULT 'Request'::character varying,
    total_value numeric,
    value_before_vat_in_base_currency numeric,
    vat_value_in_base_currency numeric,
    total_value_in_base_currency numeric,
    request_date date
);


--
-- Name: mtr; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mtr (
    transaction_id character varying(50) NOT NULL,
    account text,
    transaction_date date,
    transaction_type character varying(100),
    description text,
    amount numeric,
    exchange_rate integer,
    note text,
    status integer DEFAULT 55,
    request text,
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone,
    notification_logs jsonb DEFAULT '[]'::jsonb,
    amount_in_base_currency numeric(20,6)
);


--
-- Name: my_company; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.my_company (
    my_company_id character varying NOT NULL,
    company_shortname character varying,
    company_fullname character varying,
    logo bytea,
    tax_code character varying,
    website character varying,
    address text,
    country character varying,
    log jsonb DEFAULT '[]'::jsonb,
    city text,
    base_currency text,
    currency_list text,
    state text,
    province text,
    deleted_at timestamp without time zone,
    status integer DEFAULT 67
);


--
-- Name: my_location; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.my_location (
    my_location_id text NOT NULL,
    location_code text,
    type text,
    address text,
    my_company text,
    responsible_employee text,
    status integer DEFAULT 50,
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone
);


--
-- Name: my_product_and_service; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.my_product_and_service (
    id integer NOT NULL,
    psid text,
    ps_name text,
    type character varying(100),
    vendor text,
    sale_credit numeric,
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone
);


--
-- Name: my_product_and_service_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.my_product_and_service_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: my_product_and_service_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.my_product_and_service_id_seq OWNED BY public.my_product_and_service.id;


--
-- Name: notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255),
    body text,
    link character varying(512),
    is_read boolean DEFAULT false,
    deleted_at timestamp without time zone,
    is_pinned boolean DEFAULT false,
    is_flagged boolean DEFAULT false,
    flagged_note text,
    user_employee_id character varying(100),
    log jsonb DEFAULT '[]'::jsonb,
    created_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: operation_program; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operation_program (
    oper_id character varying(50) NOT NULL,
    payment_code text,
    payment_name text,
    description text,
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone,
    department_id character varying(50),
    company_id character varying(50),
    finance_mappings jsonb DEFAULT '[]'::jsonb,
    payment_type character varying(255)
);


--
-- Name: oppotunity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oppotunity (
    project_id character varying(50) NOT NULL,
    project_name text,
    estimated_revenue numeric,
    currency text,
    exchange_rate integer,
    status integer DEFAULT 52,
    stage text,
    sources text,
    close_date date,
    sale_lead text,
    create_date date,
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone,
    sale_team text,
    id__company character varying(50),
    id__request character varying(50),
    id__my_company character varying(50),
    created_by character varying(50),
    type character varying(50),
    note text
);


--
-- Name: payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment (
    payment_id character varying(50) NOT NULL,
    request text,
    contractspood text,
    my_company text,
    payment_type integer DEFAULT 61,
    counter_party text,
    company text,
    employee text,
    payment_description text,
    payment_period integer,
    due_date date,
    value numeric,
    currency text,
    exchange_rate numeric(20,6),
    payment_method text,
    bank_info text,
    payment_status integer DEFAULT 30,
    payment_date date,
    transaction_id character varying(50),
    payment_request text,
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone,
    notification_logs jsonb DEFAULT '[]'::jsonb,
    contract_id character varying(50),
    source character varying(50) DEFAULT 'Request'::character varying,
    payment_term character varying(500),
    vat numeric DEFAULT 0,
    total_value numeric,
    value_in_base_currency numeric,
    finance_splits jsonb DEFAULT '[]'::jsonb
);


--
-- Name: permission_exceptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission_exceptions (
    id integer NOT NULL,
    permission_id integer,
    email text NOT NULL,
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone
);


--
-- Name: permission_exceptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permission_exceptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permission_exceptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permission_exceptions_id_seq OWNED BY public.permission_exceptions.id;


--
-- Name: permission_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission_levels (
    id integer NOT NULL,
    permission_id integer,
    level text NOT NULL,
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone
);


--
-- Name: permission_levels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permission_levels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permission_levels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permission_levels_id_seq OWNED BY public.permission_levels.id;


--
-- Name: permission_positions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission_positions (
    id integer NOT NULL,
    permission_id integer,
    "position" text NOT NULL,
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone
);


--
-- Name: permission_positions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permission_positions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permission_positions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permission_positions_id_seq OWNED BY public.permission_positions.id;


--
-- Name: permission_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission_roles (
    id integer NOT NULL,
    permission_id integer,
    role text NOT NULL,
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone
);


--
-- Name: permission_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permission_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permission_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permission_roles_id_seq OWNED BY public.permission_roles.id;


--
-- Name: policy_and_program; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_and_program (
    policy_id character varying NOT NULL,
    policy_type character varying,
    policy_name character varying,
    description text,
    procedure_file character varying,
    procedure_link character varying,
    tier1_approval character varying,
    tier2_approval character varying,
    tier3_approval character varying,
    approval_level character varying,
    policy_lead character varying,
    sr_owner character varying,
    elements text,
    company_id text DEFAULT '1'::text,
    department_id text,
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone,
    coordinator text,
    priority character varying(50),
    subscription text,
    server text,
    id__request character varying(50),
    sla character varying(255)
);


--
-- Name: project; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project (
    project_id character varying(50) NOT NULL,
    fy_recognized integer,
    note text,
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id integer NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_employee_id character varying(100)
);


--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.push_subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.push_subscriptions_id_seq OWNED BY public.push_subscriptions.id;


--
-- Name: request; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.request (
    request_id character varying(50) NOT NULL,
    request_type character varying(100),
    sr_creater text,
    requester text,
    description text,
    sr_created_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    policy_lead text,
    sr_owner text[],
    sr_status integer DEFAULT 1,
    sr_submitted_date timestamp without time zone,
    sr_close_date timestamp without time zone,
    process_status integer DEFAULT 7,
    process_start_date timestamp without time zone,
    process_end_date timestamp without time zone,
    approval_level text,
    approval_flow jsonb,
    rating jsonb,
    log jsonb DEFAULT '[]'::jsonb,
    company_id character varying,
    elements text[],
    deleted_at timestamp without time zone,
    notification_logs jsonb DEFAULT '[]'::jsonb,
    parent__id_request character varying(50)
);


--
-- Name: request_rating; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.request_rating (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id character varying(255) NOT NULL,
    from_user character varying(255) NOT NULL,
    to_user character varying(255) NOT NULL,
    point integer NOT NULL,
    comment text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    log jsonb DEFAULT '[]'::jsonb
);


--
-- Name: request_watches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.request_watches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id character varying(255) NOT NULL,
    is_watching boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    user_employee_id character varying(100),
    log jsonb DEFAULT '[]'::jsonb
);


--
-- Name: service; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service (
    service_id character varying(50) NOT NULL,
    request text,
    service_type integer,
    service_name text,
    status integer DEFAULT 26,
    start_date date,
    end_date date,
    note text,
    fy text,
    log jsonb DEFAULT '[]'::jsonb,
    my_company character varying(50),
    deleted_at timestamp without time zone,
    notification_logs jsonb DEFAULT '[]'::jsonb,
    service_owner character varying(50)
);


--
-- Name: status_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.status_catalog (
    id integer NOT NULL,
    table_name character varying(100) NOT NULL,
    column_name character varying(100) NOT NULL,
    status_key character varying(100) NOT NULL,
    display_name_vi character varying(100) NOT NULL,
    display_name_en character varying(100) NOT NULL,
    color_code character varying(50),
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE IF NOT EXISTS public.status_catalog_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.status_catalog_id_seq OWNED BY public.status_catalog.id;
ALTER TABLE ONLY public.status_catalog ALTER COLUMN id SET DEFAULT nextval('public.status_catalog_id_seq'::regclass);


--
-- Name: system_setup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_setup (
    key text NOT NULL,
    value text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    log jsonb DEFAULT '[]'::jsonb
);


--
-- Name: target_table; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.target_table (
    target_table_id character varying(50) NOT NULL,
    request character varying(50),
    type character varying(50),
    table_name character varying(50),
    record_ids text[],
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone
);


--
-- Name: task_subtask; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_subtask (
    subtask_id character varying(50) NOT NULL,
    task_id character varying(50),
    description text,
    status character varying(50) DEFAULT 'Pending'::character varying,
    log jsonb DEFAULT '[]'::jsonb,
    deleted_at timestamp without time zone
);


--
-- Name: ticket; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket (
    ticket_id character varying(50) NOT NULL,
    ticket_type character varying(100),
    sr_creater text,
    requester text,
    description text,
    sr_start_date timestamp without time zone,
    policy_lead text,
    sr_coordinator text[],
    sr_status integer DEFAULT 10,
    sr_created_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    sr_close_date timestamp without time zone,
    process_status integer DEFAULT 14,
    process_start_date timestamp without time zone,
    process_end_date timestamp without time zone,
    approval_level text,
    log jsonb DEFAULT '[]'::jsonb,
    rating jsonb,
    processing_flow jsonb,
    deleted_at timestamp without time zone
);


--
-- Name: ticket_comment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_comment (
    comment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket text,
    comment text,
    file text,
    link text,
    comment_by text,
    comment_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reply_to text,
    tag text,
    deleted_at timestamp without time zone,
    log jsonb DEFAULT '[]'::jsonb
);


--
-- Name: ticket_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_type (
    ticket_type_id character varying NOT NULL,
    ticket_name character varying NOT NULL,
    ticket_type character varying,
    ticket_lead character varying,
    sr_owner character varying,
    coordinator character varying,
    tier_1_engineer character varying,
    tier_2_engineer character varying,
    tier_3_engineer character varying,
    processing_tier character varying(50) DEFAULT 'Tier 3'::character varying,
    priority character varying(50) DEFAULT 'Medium'::character varying,
    subscription character varying,
    server character varying,
    ticket_link character varying,
    ticket_file character varying,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    log jsonb DEFAULT '[]'::jsonb
);


--
-- Name: uploaded_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uploaded_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name character varying(100) NOT NULL,
    record_id character varying(100) NOT NULL,
    column_name character varying(100) NOT NULL,
    file_name character varying(255) NOT NULL,
    mime_type character varying(100) NOT NULL,
    file_path character varying(512) NOT NULL,
    uploaded_by character varying(100) NOT NULL,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    log jsonb DEFAULT '[]'::jsonb
);


--
-- Name: v_department; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_department AS
 SELECT d.department_id,
    d.department_name,
    d.department_code,
    d.type,
    d.manager_email,
    d.company_id,
    d.log,
    d.deleted_at,
    c.company_shortname,
    concat(d.department_name, ' | ', c.company_shortname) AS department_label
   FROM (public.department d
     LEFT JOIN public.my_company c ON (((c.my_company_id)::text = (d.company_id)::text)));


--
-- Name: v_finance; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_finance AS
WITH contract_agg AS (
  SELECT
    c.request AS request_id,
    COUNT(*) FILTER (WHERE c.type = 69 OR LOWER(COALESCE(sc.status_key, sc.status_name, c.type::text)) = 'selling') AS selling_contract_count,
    COUNT(*) FILTER (WHERE c.type = 70 OR LOWER(COALESCE(sc.status_key, sc.status_name, c.type::text)) = 'buying') AS buying_contract_count,
    COALESCE(SUM(c.total_value_in_base_currency) FILTER (WHERE c.type = 69 OR LOWER(COALESCE(sc.status_key, sc.status_name, c.type::text)) = 'selling'), 0) AS selling,
    COALESCE(SUM(c.vat_value_in_base_currency) FILTER (WHERE c.type = 69 OR LOWER(COALESCE(sc.status_key, sc.status_name, c.type::text)) = 'selling'), 0) AS vat_selling,
    COALESCE(SUM(c.value_before_vat_in_base_currency) FILTER (WHERE c.type = 69 OR LOWER(COALESCE(sc.status_key, sc.status_name, c.type::text)) = 'selling'), 0) AS selling_wo_vat,
    COALESCE(SUM(c.total_value_in_base_currency) FILTER (WHERE c.type = 70 OR LOWER(COALESCE(sc.status_key, sc.status_name, c.type::text)) = 'buying'), 0) AS buying,
    COALESCE(SUM(c.vat_value_in_base_currency) FILTER (WHERE c.type = 70 OR LOWER(COALESCE(sc.status_key, sc.status_name, c.type::text)) = 'buying'), 0) AS vat_buying,
    COALESCE(SUM(c.value_before_vat_in_base_currency) FILTER (WHERE c.type = 70 OR LOWER(COALESCE(sc.status_key, sc.status_name, c.type::text)) = 'buying'), 0) AS buying_wo_vat
  FROM public.contract c
  LEFT JOIN public.status_catalog sc ON sc.id = c.type
  WHERE c.deleted_at IS NULL
  GROUP BY c.request
),
payment_agg AS (
  SELECT
    p.request AS request_id,
    COUNT(*) FILTER (WHERE c.type = 69 OR p.payment_type = 71 OR LOWER(COALESCE(sc_p.status_key, sc_c.status_key, '')) = 'selling' OR LOWER(COALESCE(p.payment_type::text, '')) = 'incoming') AS incoming_pm_count,
    COALESCE(SUM(p.total_value_in_base_currency) FILTER (WHERE c.type = 69 OR p.payment_type = 71 OR LOWER(COALESCE(sc_p.status_key, sc_c.status_key, '')) = 'selling' OR LOWER(COALESCE(p.payment_type::text, '')) = 'incoming'), 0) AS incoming_payment,
    COALESCE(SUM(p.total_value_in_base_currency) FILTER (WHERE (c.type = 69 OR p.payment_type = 71 OR LOWER(COALESCE(sc_p.status_key, sc_c.status_key, '')) = 'selling' OR LOWER(COALESCE(p.payment_type::text, '')) = 'incoming') AND LOWER(COALESCE(p.payment_status::text, '')) = 'paid'), 0) AS incoming_payment_paid,
    COALESCE(SUM(p.total_value_in_base_currency) FILTER (WHERE (c.type = 69 OR p.payment_type = 71 OR LOWER(COALESCE(sc_p.status_key, sc_c.status_key, '')) = 'selling' OR LOWER(COALESCE(p.payment_type::text, '')) = 'incoming') AND LOWER(COALESCE(p.payment_status::text, '')) = 'not due yet'), 0) AS incoming_pm_not_due_yet,
    COALESCE(SUM(p.total_value_in_base_currency) FILTER (WHERE (c.type = 69 OR p.payment_type = 71 OR LOWER(COALESCE(sc_p.status_key, sc_c.status_key, '')) = 'selling' OR LOWER(COALESCE(p.payment_type::text, '')) = 'incoming') AND LOWER(COALESCE(p.payment_status::text, '')) = 'pending payment'), 0) AS incoming_pm_pending_pm,

    COUNT(*) FILTER (WHERE c.type = 70 OR p.payment_type = 72 OR LOWER(COALESCE(sc_p.status_key, sc_c.status_key, '')) = 'buying' OR LOWER(COALESCE(p.payment_type::text, '')) = 'outgoing') AS outgoing_pm_count,
    COALESCE(SUM(p.total_value_in_base_currency) FILTER (WHERE c.type = 70 OR p.payment_type = 72 OR LOWER(COALESCE(sc_p.status_key, sc_c.status_key, '')) = 'buying' OR LOWER(COALESCE(p.payment_type::text, '')) = 'outgoing'), 0) AS outgoing_payment,
    COALESCE(SUM(p.total_value_in_base_currency) FILTER (WHERE (c.type = 70 OR p.payment_type = 72 OR LOWER(COALESCE(sc_p.status_key, sc_c.status_key, '')) = 'buying' OR LOWER(COALESCE(p.payment_type::text, '')) = 'outgoing') AND LOWER(COALESCE(p.payment_status::text, '')) = 'paid'), 0) AS outgoing_payment_paid,
    COALESCE(SUM(p.total_value_in_base_currency) FILTER (WHERE (c.type = 70 OR p.payment_type = 72 OR LOWER(COALESCE(sc_p.status_key, sc_c.status_key, '')) = 'buying' OR LOWER(COALESCE(p.payment_type::text, '')) = 'outgoing') AND LOWER(COALESCE(p.payment_status::text, '')) = 'not due yet'), 0) AS outgoing_pm_not_due_yet,
    COALESCE(SUM(p.total_value_in_base_currency) FILTER (WHERE (c.type = 70 OR p.payment_type = 72 OR LOWER(COALESCE(sc_p.status_key, sc_c.status_key, '')) = 'buying' OR LOWER(COALESCE(p.payment_type::text, '')) = 'outgoing') AND LOWER(COALESCE(p.payment_status::text, '')) = 'pending payment'), 0) AS outgoing_pm_pending_pm
  FROM public.payment p
  LEFT JOIN public.contract c ON c.contract_id = p.contract_id
  LEFT JOIN public.status_catalog sc_c ON sc_c.id = c.type
  LEFT JOIN public.status_catalog sc_p ON sc_p.id = p.payment_type
  WHERE p.deleted_at IS NULL
  GROUP BY p.request
),
invoice_agg AS (
  SELECT
    i.request AS request_id,
    COUNT(*) FILTER (WHERE c.type = 69 OR i.invoice_type = '71' OR LOWER(COALESCE(sc_i.status_key, sc_c.status_key, i.invoice_type::text, '')) IN ('selling', 'incoming')) AS selling_invoice_count,
    COALESCE(SUM(i.total_value_in_base_currency) FILTER (WHERE c.type = 69 OR i.invoice_type = '71' OR LOWER(COALESCE(sc_i.status_key, sc_c.status_key, i.invoice_type::text, '')) IN ('selling', 'incoming')), 0) AS selling_invoice_total_value,
    COUNT(*) FILTER (WHERE c.type = 70 OR i.invoice_type = '72' OR LOWER(COALESCE(sc_i.status_key, sc_c.status_key, i.invoice_type::text, '')) IN ('buying', 'outgoing', 'standard')) AS buying_invoice_count,
    COALESCE(SUM(i.total_value_in_base_currency) FILTER (WHERE c.type = 70 OR i.invoice_type = '72' OR LOWER(COALESCE(sc_i.status_key, sc_c.status_key, i.invoice_type::text, '')) IN ('buying', 'outgoing', 'standard')), 0) AS buying_invoice_total_value
  FROM public.invoice i
  LEFT JOIN public.contract c ON c.contract_id = i.contract_id
  LEFT JOIN public.status_catalog sc_c ON sc_c.id = c.type
  LEFT JOIN public.status_catalog sc_i ON sc_i.id::text = i.invoice_type::text
  WHERE i.deleted_at IS NULL
  GROUP BY i.request
),
expense_agg AS (
  SELECT
    ex.id__request AS request_id,
    COALESCE(ex.fy, TO_CHAR(COALESCE(ex.invoice_date, ex.created_at), 'YYYY')) AS exp_fy,
    COALESCE(SUM(ex.total_value_in_base_currency) FILTER (WHERE LOWER(COALESCE(sc_cost.status_key, '')) = 'expense' OR ex.id__expense_cost = 135), 0) AS expense,
    COALESCE(SUM(ex.total_value_in_base_currency) FILTER (WHERE LOWER(COALESCE(sc_cost.status_key, '')) = 'non_expense' OR ex.id__expense_cost = 136), 0) AS non_expense
  FROM public.expense ex
  LEFT JOIN public.status_catalog sc_cost ON sc_cost.id = ex.id__expense_cost
  WHERE ex.deleted_at IS NULL
  GROUP BY ex.id__request, COALESCE(ex.fy, TO_CHAR(COALESCE(ex.invoice_date, ex.created_at), 'YYYY'))
),
asset_agg AS (
  SELECT
    a.request AS request_id,
    COALESCE(SUM(a.purchase_cost), 0) AS asset
  FROM public.asset a
  WHERE a.deleted_at IS NULL
  GROUP BY a.request
),
req_combined AS (
  SELECT
    r.request_id,
    r.request_type,
    UPPER(TRIM(COALESCE(NULLIF(ea.exp_fy, ''), NULLIF(r.fy, ''), TO_CHAR(COALESCE(r.sr_created_date, r.created_date), 'YYYY'), 'UNKNOWN'))) AS raw_fy,
    COALESCE(ca.selling_contract_count, 0) AS selling_contract_count,
    COALESCE(ca.selling, 0) AS selling,
    COALESCE(ca.buying_contract_count, 0) AS buying_contract_count,
    COALESCE(ca.buying, 0) AS buying,
    (COALESCE(ca.selling, 0) - COALESCE(ca.buying, 0)) AS gm,
    COALESCE(ca.vat_selling, 0) AS vat_selling,
    COALESCE(ca.selling_wo_vat, 0) AS selling_wo_vat,
    COALESCE(ca.vat_buying, 0) AS vat_buying,
    COALESCE(ca.buying_wo_vat, 0) AS buying_wo_vat,
    (COALESCE(ca.selling_wo_vat, 0) - COALESCE(ca.buying_wo_vat, 0)) AS gm_wo_vat,
    COALESCE(pa.incoming_pm_count, 0) AS incoming_pm_count,
    COALESCE(pa.incoming_payment, 0) AS incoming_payment,
    COALESCE(pa.incoming_payment_paid, 0) AS incoming_payment_paid,
    COALESCE(pa.incoming_pm_not_due_yet, 0) AS incoming_pm_not_due_yet,
    COALESCE(pa.incoming_pm_pending_pm, 0) AS incoming_pm_pending_pm,
    COALESCE(pa.outgoing_pm_count, 0) AS outgoing_pm_count,
    COALESCE(pa.outgoing_payment, 0) AS outgoing_payment,
    COALESCE(pa.outgoing_payment_paid, 0) AS outgoing_payment_paid,
    COALESCE(pa.outgoing_pm_not_due_yet, 0) AS outgoing_pm_not_due_yet,
    COALESCE(pa.outgoing_pm_pending_pm, 0) AS outgoing_pm_pending_pm,
    COALESCE(ia.selling_invoice_count, 0) AS selling_invoice_count,
    COALESCE(ia.selling_invoice_total_value, 0) AS selling_invoice_total_value,
    COALESCE(ia.buying_invoice_count, 0) AS buying_invoice_count,
    COALESCE(ia.buying_invoice_total_value, 0) AS buying_invoice_total_value,
    COALESCE(ea.expense, 0) AS expense,
    COALESCE(ea.non_expense, 0) AS non_expense,
    COALESCE(aa.asset, 0) AS asset
  FROM public.request r
  LEFT JOIN contract_agg ca ON ca.request_id = r.request_id
  LEFT JOIN payment_agg pa ON pa.request_id = r.request_id
  LEFT JOIN invoice_agg ia ON ia.request_id = r.request_id
  LEFT JOIN expense_agg ea ON ea.request_id = r.request_id
  LEFT JOIN asset_agg aa ON aa.request_id = r.request_id
  WHERE r.deleted_at IS NULL
)
SELECT
  (p.policy_id || '_' || (CASE WHEN rc.raw_fy LIKE 'FY%' THEN rc.raw_fy ELSE 'FY' || rc.raw_fy END)) AS id,
  p.policy_id AS process_id,
  p.policy_name AS process,
  p.policy_type,
  p.description,
  p.policy_lead,
  p.country,
  (CASE WHEN rc.raw_fy LIKE 'FY%' THEN rc.raw_fy ELSE 'FY' || rc.raw_fy END) AS fy,
  COUNT(rc.request_id) AS total_requests,
  SUM(rc.selling_contract_count) AS selling_contract_count,
  SUM(rc.selling) AS selling,
  SUM(rc.buying_contract_count) AS buying_contract_count,
  SUM(rc.buying) AS buying,
  SUM(rc.gm) AS gm,
  SUM(rc.vat_selling) AS vat_selling,
  SUM(rc.selling_wo_vat) AS selling_wo_vat,
  SUM(rc.vat_buying) AS vat_buying,
  SUM(rc.buying_wo_vat) AS buying_wo_vat,
  SUM(rc.gm_wo_vat) AS gm_wo_vat,
  SUM(rc.incoming_pm_count) AS incoming_pm_count,
  SUM(rc.incoming_payment) AS incoming_payment,
  SUM(rc.incoming_payment_paid) AS incoming_payment_paid,
  SUM(rc.incoming_pm_not_due_yet) AS incoming_pm_not_due_yet,
  SUM(rc.incoming_pm_pending_pm) AS incoming_pm_pending_pm,
  SUM(rc.outgoing_pm_count) AS outgoing_pm_count,
  SUM(rc.outgoing_payment) AS outgoing_payment,
  SUM(rc.outgoing_payment_paid) AS outgoing_payment_paid,
  SUM(rc.outgoing_pm_not_due_yet) AS outgoing_pm_not_due_yet,
  SUM(rc.outgoing_pm_pending_pm) AS outgoing_pm_pending_pm,
  SUM(rc.selling_invoice_count) AS selling_invoice_count,
  SUM(rc.selling_invoice_total_value) AS selling_invoice_total_value,
  SUM(rc.buying_invoice_count) AS buying_invoice_count,
  SUM(rc.buying_invoice_total_value) AS buying_invoice_total_value,
  SUM(rc.expense) AS expense,
  SUM(rc.non_expense) AS non_expense,
  SUM(rc.asset) AS asset
FROM public.policy_and_program p
JOIN req_combined rc ON (
  (rc.request_type = p.policy_id OR rc.request_type = p.policy_name)
)
WHERE p.deleted_at IS NULL
GROUP BY
  p.policy_id,
  p.policy_name,
  p.policy_type,
  p.description,
  p.policy_lead,
  p.country,
  (CASE WHEN rc.raw_fy LIKE 'FY%' THEN rc.raw_fy ELSE 'FY' || rc.raw_fy END);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: automation_run_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_run_logs ALTER COLUMN id SET DEFAULT nextval('public.automation_run_logs_id_seq'::regclass);


--
-- Name: cms_tenant_info id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_tenant_info ALTER COLUMN id SET DEFAULT nextval('public.cms_tenant_info_id_seq'::regclass);


--
-- Name: column_permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.column_permissions ALTER COLUMN id SET DEFAULT nextval('public.column_permissions_id_seq'::regclass);


--
-- Name: exception_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exception_rules ALTER COLUMN id SET DEFAULT nextval('public.exception_rules_id_seq'::regclass);


--
-- Name: finance fcid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance ALTER COLUMN fcid SET DEFAULT ('FC-'::text || lpad((nextval('public.finance_fcid_seq'::regclass))::text, 3, '0'::text));


--
-- Name: my_product_and_service id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.my_product_and_service ALTER COLUMN id SET DEFAULT nextval('public.my_product_and_service_id_seq'::regclass);


--
-- Name: permission_exceptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_exceptions ALTER COLUMN id SET DEFAULT nextval('public.permission_exceptions_id_seq'::regclass);


--
-- Name: permission_levels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_levels ALTER COLUMN id SET DEFAULT nextval('public.permission_levels_id_seq'::regclass);


--
-- Name: permission_positions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_positions ALTER COLUMN id SET DEFAULT nextval('public.permission_positions_id_seq'::regclass);


--
-- Name: permission_roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_roles ALTER COLUMN id SET DEFAULT nextval('public.permission_roles_id_seq'::regclass);


--
-- Name: push_subscriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.push_subscriptions_id_seq'::regclass);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (account_id);


--
-- Name: action_rules action_rules_action_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_rules
    ADD CONSTRAINT action_rules_action_id_key UNIQUE (action_id);


--
-- Name: asset asset_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset
    ADD CONSTRAINT asset_pkey PRIMARY KEY (office_asset_id);


--
-- Name: assigned_task assigned_task_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assigned_task
    ADD CONSTRAINT assigned_task_pkey PRIMARY KEY (task_id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: automation_registry automation_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_registry
    ADD CONSTRAINT automation_registry_pkey PRIMARY KEY (automation_id);


--
-- Name: automation_run_logs automation_run_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_run_logs
    ADD CONSTRAINT automation_run_logs_pkey PRIMARY KEY (id);


--
-- Name: cms_tenant_info cms_tenant_info_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_tenant_info
    ADD CONSTRAINT cms_tenant_info_pkey PRIMARY KEY (id);


--
-- Name: cms_tenant_info cms_tenant_info_tenant_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_tenant_info
    ADD CONSTRAINT cms_tenant_info_tenant_domain_key UNIQUE (tenant_domain);


--
-- Name: column_permissions column_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.column_permissions
    ADD CONSTRAINT column_permissions_pkey PRIMARY KEY (id);


--
-- Name: column_permissions column_permissions_table_column_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.column_permissions
    ADD CONSTRAINT column_permissions_table_column_key UNIQUE (table_name, column_name);


--
-- Name: company company_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company
    ADD CONSTRAINT company_pkey PRIMARY KEY (company_id);


--
-- Name: contact contact_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact
    ADD CONSTRAINT contact_pkey PRIMARY KEY (contact_id);


--
-- Name: contract contract_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract
    ADD CONSTRAINT contract_pkey PRIMARY KEY (contract_id);


--
-- Name: department department_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT department_pkey PRIMARY KEY (department_id);


--
-- Name: employee employee_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_email_key UNIQUE (email);


--
-- Name: employee employee_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_email_unique UNIQUE (email);


--
-- Name: employee employee_email_unique_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_email_unique_key UNIQUE (email);


--
-- Name: employee employee_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_pkey PRIMARY KEY (employee_id);


--
-- Name: employee employee_username_unique_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_username_unique_key UNIQUE (username);


--
-- Name: exception_rules exception_rules_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exception_rules
    ADD CONSTRAINT exception_rules_name_key UNIQUE (name);


--
-- Name: exception_rules exception_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exception_rules
    ADD CONSTRAINT exception_rules_pkey PRIMARY KEY (id);


--
-- Name: expense expense_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense
    ADD CONSTRAINT expense_pkey PRIMARY KEY (id);


--
-- Name: finance finance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance
    ADD CONSTRAINT finance_pkey PRIMARY KEY (fcid);


--
-- Name: invoice invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice
    ADD CONSTRAINT invoice_pkey PRIMARY KEY (invoice_id);


--
-- Name: mtr mtr_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mtr
    ADD CONSTRAINT mtr_pkey PRIMARY KEY (transaction_id);


--
-- Name: my_company my_company_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.my_company
    ADD CONSTRAINT my_company_pkey PRIMARY KEY (my_company_id);


--
-- Name: my_location my_location_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.my_location
    ADD CONSTRAINT my_location_pkey PRIMARY KEY (my_location_id);


--
-- Name: my_product_and_service my_product_and_service_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.my_product_and_service
    ADD CONSTRAINT my_product_and_service_pkey PRIMARY KEY (id);


--
-- Name: notification notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_pkey PRIMARY KEY (id);


--
-- Name: operation_program operation_program_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_program
    ADD CONSTRAINT operation_program_pkey PRIMARY KEY (oper_id);


--
-- Name: oppotunity oppotunity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oppotunity
    ADD CONSTRAINT oppotunity_pkey PRIMARY KEY (project_id);


--
-- Name: payment payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_pkey PRIMARY KEY (payment_id);


--
-- Name: permission_exceptions permission_exceptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_exceptions
    ADD CONSTRAINT permission_exceptions_pkey PRIMARY KEY (id);


--
-- Name: permission_levels permission_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_levels
    ADD CONSTRAINT permission_levels_pkey PRIMARY KEY (id);


--
-- Name: permission_positions permission_positions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_positions
    ADD CONSTRAINT permission_positions_pkey PRIMARY KEY (id);


--
-- Name: permission_roles permission_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_roles
    ADD CONSTRAINT permission_roles_pkey PRIMARY KEY (id);


--
-- Name: policy_and_program policy_and_program_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_and_program
    ADD CONSTRAINT policy_and_program_pkey PRIMARY KEY (policy_id);


--
-- Name: project project_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_pkey PRIMARY KEY (project_id);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: comment request_detail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comment
    ADD CONSTRAINT request_detail_pkey PRIMARY KEY (comment_id);


--
-- Name: request request_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request
    ADD CONSTRAINT request_pkey PRIMARY KEY (request_id);


--
-- Name: request_rating request_rating_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_rating
    ADD CONSTRAINT request_rating_pkey PRIMARY KEY (id);


--
-- Name: request_watches request_watches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_watches
    ADD CONSTRAINT request_watches_pkey PRIMARY KEY (id);


--
-- Name: request_watches request_watches_user_email_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_watches
    ADD CONSTRAINT request_watches_user_email_request_id_key UNIQUE (user_employee_id, request_id);


--
-- Name: service service_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service
    ADD CONSTRAINT service_pkey PRIMARY KEY (service_id);


--
-- Name: status_catalog status_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_catalog
    ADD CONSTRAINT status_catalog_pkey PRIMARY KEY (id);


--
-- Name: system_setup system_setup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_setup
    ADD CONSTRAINT system_setup_pkey PRIMARY KEY (key);


--
-- Name: target_table target_table_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.target_table
    ADD CONSTRAINT target_table_pkey PRIMARY KEY (target_table_id);


--
-- Name: task_subtask task_subtask_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_subtask
    ADD CONSTRAINT task_subtask_pkey PRIMARY KEY (subtask_id);


--
-- Name: ticket_comment ticket_comment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comment
    ADD CONSTRAINT ticket_comment_pkey PRIMARY KEY (comment_id);


--
-- Name: ticket ticket_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket
    ADD CONSTRAINT ticket_pkey PRIMARY KEY (ticket_id);


--
-- Name: ticket_type ticket_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_type
    ADD CONSTRAINT ticket_type_pkey PRIMARY KEY (ticket_type_id);


--
-- Name: uploaded_files uploaded_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uploaded_files
    ADD CONSTRAINT uploaded_files_pkey PRIMARY KEY (id);


--
-- Name: idx_asset_purchase_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_purchase_date ON public.asset USING btree (purchase_date DESC NULLS LAST);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_table_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_table_record ON public.audit_logs USING btree (table_name, record_id);


--
-- Name: idx_automation_run_logs_automation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_run_logs_automation_id ON public.automation_run_logs USING btree (automation_id);


--
-- Name: idx_automation_run_logs_run_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_run_logs_run_at ON public.automation_run_logs USING btree (run_at DESC);


--
-- Name: idx_comment_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comment_request ON public.comment USING btree (request);


--
-- Name: idx_contract_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_owner ON public.contract USING btree (contract_owner);


--
-- Name: idx_contract_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contract_request ON public.contract USING btree (request);


--
-- Name: idx_department_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_department_company ON public.department USING btree (company_id);


--
-- Name: idx_employee_app_user_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_app_user_enabled ON public.employee USING btree (app_user_enabled) WHERE (app_user_enabled = true);


--
-- Name: idx_employee_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_company ON public.employee USING btree (company_id);


--
-- Name: idx_employee_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_department ON public.employee USING btree (department_id);


--
-- Name: idx_employee_lower_direct_manager; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_lower_direct_manager ON public.employee USING btree (lower((direct_manager)::text));


--
-- Name: idx_employee_lower_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_lower_email ON public.employee USING btree (lower((email)::text));


--
-- Name: idx_expense_id__request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expense_id__request ON public.expense USING btree (id__request);


--
-- Name: idx_invoice_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_request ON public.invoice USING btree (request);


--
-- Name: idx_mtr_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mtr_account ON public.mtr USING btree (account);


--
-- Name: idx_mtr_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mtr_request ON public.mtr USING btree (request);


--
-- Name: idx_mtr_transaction_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mtr_transaction_date ON public.mtr USING btree (transaction_date DESC NULLS LAST);


--
-- Name: idx_payment_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_due_date ON public.payment USING btree (due_date DESC NULLS LAST);


--
-- Name: idx_payment_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_employee ON public.payment USING btree (employee);


--
-- Name: idx_payment_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_request ON public.payment USING btree (request);


--
-- Name: idx_request_lower_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_lower_id ON public.request USING btree (lower((request_id)::text));


--
-- Name: idx_request_lower_policy_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_lower_policy_lead ON public.request USING btree (lower(policy_lead));


--
-- Name: idx_request_lower_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_lower_requester ON public.request USING btree (lower(requester));


--
-- Name: idx_request_lower_sr_creater; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_lower_sr_creater ON public.request USING btree (lower(sr_creater));


--
-- Name: idx_request_policy_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_policy_lead ON public.request USING btree (policy_lead);


--
-- Name: idx_request_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_requester ON public.request USING btree (requester);


--
-- Name: idx_request_sr_creater; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_sr_creater ON public.request USING btree (sr_creater);


--
-- Name: idx_request_sr_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_sr_owner ON public.request USING gin (sr_owner);


--
-- Name: idx_request_sr_submitted_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_sr_submitted_date ON public.request USING btree (sr_submitted_date DESC NULLS LAST);


--
-- Name: idx_request_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_type ON public.request USING btree (request_type);


--
-- Name: idx_request_watches_request_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_watches_request_id ON public.request_watches USING btree (request_id);


--
-- Name: idx_service_end_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_end_date ON public.service USING btree (end_date DESC NULLS LAST);


--
-- Name: idx_uploaded_files_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uploaded_files_record ON public.uploaded_files USING btree (table_name, record_id);


--
-- Name: idx_uploaded_files_uploader; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uploaded_files_uploader ON public.uploaded_files USING btree (uploaded_by, uploaded_at DESC);


--
-- Name: account trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.account FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: action_rules trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.action_rules FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: asset trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.asset FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: assigned_task trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.assigned_task FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: automation_registry trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.automation_registry FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: automation_run_logs trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.automation_run_logs FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: cms_tenant_info trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.cms_tenant_info FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: column_permissions trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.column_permissions FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: comment trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.comment FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: company trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.company FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: contact trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.contact FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: contract trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.contract FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: customize trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.customize FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: department trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.department FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: employee trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.employee FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: exception_rules trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.exception_rules FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: expense trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.expense FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: finance trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.finance FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: invoice trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.invoice FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: mtr trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.mtr FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: my_company trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.my_company FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: my_location trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.my_location FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: my_product_and_service trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.my_product_and_service FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: notification trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.notification FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: operation_program trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.operation_program FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: oppotunity trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.oppotunity FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: payment trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.payment FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: permission_exceptions trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.permission_exceptions FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: permission_levels trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.permission_levels FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: permission_positions trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.permission_positions FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: permission_roles trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.permission_roles FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: policy_and_program trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.policy_and_program FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: project trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.project FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: request trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.request FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: request_rating trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.request_rating FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: request_watches trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.request_watches FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: service trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.service FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: system_setup trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.system_setup FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: target_table trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.target_table FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: task_subtask trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.task_subtask FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: ticket trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.ticket FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: ticket_comment trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.ticket_comment FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: ticket_type trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.ticket_type FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: uploaded_files trg_audit_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_log BEFORE INSERT OR DELETE OR UPDATE ON public.uploaded_files FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();


--
-- Name: account trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.account FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: action_rules trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.action_rules FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: asset trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.asset FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: assigned_task trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.assigned_task FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: audit_logs trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: automation_registry trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.automation_registry FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: automation_run_logs trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.automation_run_logs FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: cms_tenant_info trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.cms_tenant_info FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: column_permissions trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.column_permissions FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: comment trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.comment FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: company trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.company FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: contact trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.contact FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: contract trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.contract FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: customize trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.customize FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: department trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.department FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: employee trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.employee FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: exception_rules trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.exception_rules FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: expense trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.expense FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: finance trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.finance FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: invoice trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.invoice FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: mtr trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.mtr FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: my_company trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.my_company FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: my_location trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.my_location FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: my_product_and_service trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.my_product_and_service FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: notification trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.notification FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: operation_program trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.operation_program FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: oppotunity trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.oppotunity FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: payment trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.payment FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: permission_exceptions trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.permission_exceptions FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: permission_levels trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.permission_levels FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: permission_positions trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.permission_positions FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: permission_roles trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.permission_roles FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: policy_and_program trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.policy_and_program FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: project trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.project FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: request trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.request FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: request_rating trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.request_rating FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: request_watches trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.request_watches FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: service trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.service FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: system_setup trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.system_setup FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: target_table trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.target_table FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: task_subtask trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.task_subtask FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: ticket trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.ticket FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: ticket_comment trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.ticket_comment FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: ticket_type trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.ticket_type FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: uploaded_files trg_cascade_soft_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON public.uploaded_files FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_trigger();


--
-- Name: contract trg_propagate_contract_request; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_propagate_contract_request AFTER UPDATE OF request ON public.contract FOR EACH ROW EXECUTE FUNCTION public.propagate_contract_request_change();


--
-- Name: request trg_request_submit_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_request_submit_status BEFORE INSERT OR UPDATE OF sr_status ON public.request FOR EACH ROW EXECUTE FUNCTION public.enforce_request_submit_status();


--
-- Name: invoice trg_sync_invoice_request; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_invoice_request BEFORE INSERT OR UPDATE ON public.invoice FOR EACH ROW EXECUTE FUNCTION public.sync_request_and_source_from_contract();


--
-- Name: payment trg_sync_payment_request; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_payment_request BEFORE INSERT OR UPDATE ON public.payment FOR EACH ROW EXECUTE FUNCTION public.sync_request_and_source_from_contract();


--
-- Name: contact contact_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact
    ADD CONSTRAINT contact_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(company_id);


--
-- Name: department department_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT department_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.my_company(my_company_id);


--
-- Name: employee employee_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.my_company(my_company_id);


--
-- Name: employee employee_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(department_id);


--
-- Name: employee employee_direct_manager_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_direct_manager_fkey FOREIGN KEY (direct_manager) REFERENCES public.employee(employee_id) ON DELETE SET NULL;


--
-- Name: employee employee_head_manager_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_head_manager_fkey FOREIGN KEY (head_manager) REFERENCES public.employee(employee_id) ON DELETE SET NULL;


--
-- Name: permission_exceptions permission_exceptions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_exceptions
    ADD CONSTRAINT permission_exceptions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.column_permissions(id) ON DELETE CASCADE;


--
-- Name: permission_levels permission_levels_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_levels
    ADD CONSTRAINT permission_levels_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.column_permissions(id) ON DELETE CASCADE;


--
-- Name: permission_positions permission_positions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_positions
    ADD CONSTRAINT permission_positions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.column_permissions(id) ON DELETE CASCADE;


--
-- Name: permission_roles permission_roles_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_roles
    ADD CONSTRAINT permission_roles_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.column_permissions(id) ON DELETE CASCADE;


--
-- Data for Name: status_catalog; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.status_catalog (id, table_name, column_name, status_key, display_name_vi, display_name_en, color_code) VALUES
  (1, 'request', 'sr_status', 'draft', 'Bản nháp', 'Draft', '#64748b'),
  (2, 'request', 'sr_status', 'pending_approval', 'Chờ duyệt', 'Pending Approval', '#3b82f6'),
  (3, 'request', 'sr_status', 'approved', 'Đã duyệt', 'Approved', '#10b981'),
  (4, 'request', 'sr_status', 'rejected', 'Từ chối', 'Rejected', '#ef4444'),
  (5, 'request', 'sr_status', 'closed', 'Đã đóng', 'Closed', '#64748b'),
  (6, 'request', 'sr_status', 'cancelled', 'Đã hủy', 'Cancelled', '#ef4444'),
  (7, 'request', 'process_status', 'not_started', 'Chưa bắt đầu', 'Not started yet', '#64748b'),
  (8, 'request', 'process_status', 'processing', 'Đang xử lý', 'Processing', '#3b82f6'),
  (9, 'request', 'process_status', 'completed', 'Đã hoàn thành', 'Completed', '#10b981'),
  (10, 'ticket', 'sr_status', 'draft', 'Bản nháp', 'Draft', '#64748b'),
  (11, 'ticket', 'sr_status', 'pending', 'Chờ xử lý', 'Pending', '#3b82f6'),
  (12, 'ticket', 'sr_status', 'in_progress', 'Đang xử lý', 'In Progress', '#3b82f6'),
  (13, 'ticket', 'sr_status', 'completed', 'Đã hoàn thành', 'Completed', '#10b981'),
  (14, 'ticket', 'process_status', 'not_started', 'Chưa bắt đầu', 'Not started yet', '#64748b'),
  (15, 'ticket', 'process_status', 'processing', 'Đang xử lý', 'Processing', '#3b82f6'),
  (16, 'ticket', 'process_status', 'completed', 'Đã hoàn thành', 'Completed', '#10b981'),
  (17, 'employee', 'status', 'active', 'Hoạt động', 'Active', '#10b981'),
  (18, 'employee', 'status', 'inactive', 'Không hoạt động', 'Inactive', '#ef4444'),
  (19, 'account', 'account_status', 'active', 'Hoạt động', 'Active', '#10b981'),
  (20, 'account', 'account_status', 'inactive', 'Không hoạt động', 'Inactive', '#ef4444'),
  (21, 'asset', 'status', 'draft', 'Bản nháp', 'Draft', '#64748b'),
  (22, 'asset', 'status', 'pending', 'Chờ duyệt', 'Pending', '#3b82f6'),
  (23, 'asset', 'status', 'in_progress', 'Đang xử lý', 'In Progress', '#3b82f6'),
  (24, 'asset', 'status', 'approved', 'Đã duyệt', 'Approved', '#10b981'),
  (25, 'asset', 'status', 'completed', 'Đã hoàn thành', 'Completed', '#10b981'),
  (26, 'service', 'status', 'draft', 'Bản nháp', 'Draft', '#64748b'),
  (27, 'service', 'status', 'pending', 'Chờ duyệt', 'Pending', '#3b82f6'),
  (28, 'service', 'status', 'in_progress', 'Đang xử lý', 'In Progress', '#3b82f6'),
  (29, 'service', 'status', 'completed', 'Đã hoàn thành', 'Completed', '#10b981'),
  (30, 'payment', 'payment_status', 'draft', 'Bản nháp', 'Draft', '#64748b'),
  (31, 'payment', 'payment_status', 'ready_for_payment', 'Sẵn sàng thanh toán', 'Ready for payment', '#3b82f6'),
  (32, 'payment', 'payment_status', 'paid', 'Đã thanh toán', 'Paid', '#10b981'),
  (33, 'payment', 'payment_status', 'deleted', 'Đã xóa', 'Deleted', '#ef4444'),
  (34, 'invoice', 'invoice_status', 'draft', 'Bản nháp', 'Draft', '#64748b'),
  (35, 'invoice', 'invoice_status', 'ready_to_issue', 'Sẵn sàng xuất', 'Ready to issue', '#3b82f6'),
  (36, 'invoice', 'invoice_status', 'issued', 'Đã xuất', 'Issued', '#3b82f6'),
  (37, 'invoice', 'invoice_status', 'paid', 'Đã thanh toán', 'Paid', '#10b981'),
  (38, 'invoice', 'invoice_status', 'void', 'Bị hủy', 'Void', '#ef4444'),
  (39, 'invoice', 'invoice_status', 'deleted', 'Đã xóa', 'Deleted', '#ef4444'),
  (40, 'cms_tenant_info', 'billing_status', 'active', 'Hoạt động', 'Active', '#10b981'),
  (41, 'cms_tenant_info', 'billing_status', 'grace', 'Gia hạn thêm', 'Grace', '#ffa500'),
  (42, 'cms_tenant_info', 'billing_status', 'expired', 'Hết hạn', 'Expired', '#ef4444'),
  (43, 'cms_tenant_info', 'billing_status', 'canceled', 'Đã hủy', 'Canceled', '#ef4444'),
  (44, 'cms_tenant_info', 'billing_status', 'inactive', 'Ngừng hoạt động', 'Inactive', '#64748b'),
  (45, 'cms_tenant_info', 'subscription_status', 'active', 'Hoạt động', 'Active', '#10b981'),
  (46, 'cms_tenant_info', 'subscription_status', 'grace', 'Gia hạn thêm', 'Grace', '#ffa500'),
  (47, 'cms_tenant_info', 'subscription_status', 'expired', 'Hết hạn', 'Expired', '#ef4444'),
  (48, 'cms_tenant_info', 'subscription_status', 'canceled', 'Đã hủy', 'Canceled', '#ef4444'),
  (49, 'cms_tenant_info', 'subscription_status', 'inactive', 'Ngừng hoạt động', 'Inactive', '#64748b'),
  (50, 'my_location', 'status', 'active', 'Hoạt động', 'Active', '#10b981'),
  (51, 'my_location', 'status', 'inactive', 'Không hoạt động', 'Inactive', '#ef4444'),
  (52, 'oppotunity', 'status', 'open', 'Mở', 'Open', '#3b82f6'),
  (53, 'oppotunity', 'status', 'closed_won', 'Thành công', 'Closed Won', '#10b981'),
  (54, 'oppotunity', 'status', 'closed_lost', 'Thất bại', 'Closed Lost', '#ef4444'),
  (55, 'mtr', 'status', 'draft', 'Bản nháp', 'Draft', '#64748b'),
  (56, 'mtr', 'status', 'approved', 'Đã duyệt', 'Approved', '#10b981'),
  (57, 'finance', 'status', 'active', 'Hoạt động', 'Active', '#10b981'),
  (58, 'finance', 'status', 'inactive', 'Không hoạt động', 'Inactive', '#ef4444'),
  (60, 'payment', 'payment_type', 'incoming', 'Khoản thu', 'Incoming', '#10b981'),
  (61, 'payment', 'payment_type', 'outgoing', 'Khoản chi', 'Outgoing', '#f59e0b'),
  (62, 'assigned_task', 'status', 'not_started', 'Chưa bắt đầu', 'Not started yet', '#64748b'),
  (63, 'assigned_task', 'status', 'processing', 'Đang xử lý', 'Processing', '#3b82f6'),
  (64, 'assigned_task', 'status', 'completed', 'Hoàn thành', 'Completed', '#10b981'),
  (65, 'task_subtask', 'status', 'pending', 'Chờ xử lý', 'Pending', '#f59e0b'),
  (66, 'task_subtask', 'status', 'completed', 'Hoàn thành', 'Completed', '#10b981'),
  (67, 'my_company', 'status', 'active', 'Hoạt động', 'Active', '#10b981'),
  (68, 'my_company', 'status', 'inactive', 'Ngưng hoạt động', 'Inactive', '#ef4444'),
  (69, 'contract', 'type', 'selling', 'Bán ra', 'Selling', '#10B981'),
  (70, 'contract', 'type', 'buying', 'Mua vào', 'Buying', '#EF4444'),
  (71, 'contract', 'type', 'internal', 'Nội bộ', 'Internal', '#6366F1'),
  (72, 'expense', 'id__expense_type', 'expense', 'Chi phí', 'Expense', '#3b82f6'),
  (73, 'expense', 'id__expense_type', 'non_expense', 'Không phải chi phí', 'Non-Expense', '#64748b'),
  (74, 'expense', 'id__expense_cost', 'operation_cost', 'Chi phí vận hành', 'Operation Cost', '#10b981'),
  (75, 'expense', 'id__expense_cost', 'sales_cost', 'Chi phí bán hàng', 'Sales Cost', '#f59e0b'),
  (76, 'expense', 'id__expense_cost', 'fixed_cost', 'Chi phí cố định', 'Fixed cost', '#6366f1'),
  (77, 'expense', 'id__expense_cost', 'variable_cost', 'Chi phí biến đổi', 'Variable cost', '#ec4899'),
  (78, 'expense', 'id__expense_cost', 'operation_expense', 'Chi phí vận hành', 'Operation expense', '#06b6d4'),
  (79, 'expense', 'id__expense_cost', 'sale_expense', 'Chi phí bán hàng', 'Sale expense', '#8b5cf6'),
  (80, 'expense', 'id__expense_cost', 'others', 'Khác', 'Others', '#94a3b8'),
  (81, 'service', 'service_type', 'subcription', 'Thuê bao', 'Subcription', '#3b82f6'),
  (82, 'service', 'service_type', '1_time_service', 'Dịch vụ 1 lần', '1 Time service', '#10b981'),
  (83, 'service', 'service_type', 'rental_loan', 'Thuê | Mượn', 'Rental | Loan', '#f59e0b'),
  (84, 'service', 'service_type', 'borrow', 'Mượn', 'Borrow', '#8b5cf6'),
  (85, 'service', 'service_type', 'annual_renew', 'Gia hạn hàng năm', 'Annual Renew', '#06b6d4'),
  (117, 'request', 'process_status', 'canceled', 'Đã hủy', 'Canceled', '#ef4444'),
  (118, 'ticket', 'sr_status', 'cancelled', 'Đã hủy', 'Cancelled', '#ef4444'),
  (119, 'ticket', 'process_status', 'cancelled', 'Đã hủy', 'Cancelled', '#ef4444'),
  (120, 'ticket', 'process_status', 'draft', 'Bản nháp', 'Draft', '#64748b')
ON CONFLICT (id) DO UPDATE SET
  table_name = EXCLUDED.table_name,
  column_name = EXCLUDED.column_name,
  status_key = EXCLUDED.status_key,
  display_name_vi = EXCLUDED.display_name_vi,
  display_name_en = EXCLUDED.display_name_en,
  color_code = EXCLUDED.color_code;

SELECT setval('public.status_catalog_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.status_catalog));


--
-- PostgreSQL database dump complete
--

\unrestrict d3DnwQeFfXguxFvbZmQCfYTEgd9Uwe3mYsNiutpzFNqhSSR8tEtnMOMV03WbyJS

