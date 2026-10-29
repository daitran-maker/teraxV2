/**
 * import_checklist_saoviet.js
 * Imports / updates data from C:\Users\A Luis\Downloads\Checklist SaoViet.xlsx
 * into:
 *  1. oppotunity (Sheet: oppo)
 *  2. service_contract & contract (Sheet: service contract)
 *  3. service_delivery_contract (Sheet: service delivery)
 *  4. service_task_request (Sheet: task request)
 *
 * Usage: node scripts/import_checklist_saoviet.js
 */

require('dotenv').config();
const path = require('path');
const xlsx = require('xlsx');
const pool = require('../server/core/db');

const EXCEL_PATH = process.env.CHECKLIST_EXCEL_PATH || 'C:\\Users\\A Luis\\Downloads\\Checklist SaoViet.xlsx';

function parseExcelDate(serial) {
  if (serial == null || serial === '') return null;
  if (typeof serial === 'string') {
    const s = serial.trim();
    if (!s) return null;
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return null;
  }
  if (typeof serial === 'number') {
    try {
      const d = xlsx.SSF.parse_date_code(serial);
      if (!d) return null;
      const y = String(d.y).padStart(4, '0');
      const m = String(d.m).padStart(2, '0');
      const day = String(d.d).padStart(2, '0');
      return `${y}-${m}-${day}`;
    } catch (e) {
      return null;
    }
  }
  return null;
}

function parseExcelTimestamp(serial) {
  if (serial == null || serial === '') return null;
  if (typeof serial === 'string') {
    const s = serial.trim();
    if (!s) return null;
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString();
    return null;
  }
  if (typeof serial === 'number') {
    try {
      const d = xlsx.SSF.parse_date_code(serial);
      if (!d) return null;
      const y = String(d.y).padStart(4, '0');
      const m = String(d.m).padStart(2, '0');
      const day = String(d.d).padStart(2, '0');
      const H = String(d.H || 0).padStart(2, '0');
      const M = String(d.M || 0).padStart(2, '0');
      const S = String(Math.floor(d.S || 0)).padStart(2, '0');
      return `${y}-${m}-${day} ${H}:${M}:${S}`;
    } catch (e) {
      return null;
    }
  }
  return null;
}

function parseDateFromDesc(desc) {
  if (!desc) return null;
  // Match patterns like "31-Dec-2020", "Dec 31, 2020", "01-Jan-2021", "2021-12-31"
  const m1 = desc.match(/(?:End\s*Date|Validation):\s*(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{2,4})/i);
  if (m1) {
    const d = new Date(m1[1]);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  const m2 = desc.match(/to\s*(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{2,4})/i);
  if (m2) {
    const d = new Date(m2[1]);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  const m3 = desc.match(/End\s*date:\s*([A-Za-z]{3}\s*\d{1,2},\s*\d{4})/i);
  if (m3) {
    const d = new Date(m3[1]);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return null;
}

function numOrNull(val) {
  if (val == null || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function strOrNull(val) {
  if (val == null) return null;
  const s = String(val).trim();
  return s === '' ? null : s;
}

async function run() {
  console.log('===============================================================');
  console.log('  STARTING CHECKLIST SAOVIET DATA IMPORT / UPDATE VERSION');
  console.log('  Source File:', EXCEL_PATH);
  console.log('===============================================================\n');

  const wb = xlsx.readFile(EXCEL_PATH);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // -------------------------------------------------------------
    // Step 0: Ensure schema adjustments and tables
    // -------------------------------------------------------------
    console.log('[Step 0] Ensuring table schemas and nullable constraints...');
    await client.query(`
      ALTER TABLE public.service_delivery_contract ALTER COLUMN service_scope DROP NOT NULL;
      ALTER TABLE public.service_delivery_contract ALTER COLUMN coordinator__employee DROP NOT NULL;
      ALTER TABLE public.service_delivery_contract ADD COLUMN IF NOT EXISTS id__contract VARCHAR(255);
      ALTER TABLE public.service_delivery_contract ADD COLUMN IF NOT EXISTS id__approval_request VARCHAR(255);

      ALTER TABLE public.service_task_request ALTER COLUMN service_delivery DROP NOT NULL;
      ALTER TABLE public.service_task_request ALTER COLUMN title DROP NOT NULL;
      ALTER TABLE public.service_task_request ALTER COLUMN title TYPE TEXT;

      ALTER TABLE public.oppotunity ADD COLUMN IF NOT EXISTS fy_recognized VARCHAR(20);
      ALTER TABLE public.oppotunity ADD COLUMN IF NOT EXISTS fy_target_closed_date VARCHAR(20);
      ALTER TABLE public.oppotunity ADD COLUMN IF NOT EXISTS quarter_by_closed_date VARCHAR(20);

      ALTER TABLE public.contract ADD COLUMN IF NOT EXISTS sc_status INTEGER;
      ALTER TABLE public.contract ADD COLUMN IF NOT EXISTS sc_start_date DATE;
      ALTER TABLE public.contract ADD COLUMN IF NOT EXISTS sc_end_date DATE;
      ALTER TABLE public.contract ADD COLUMN IF NOT EXISTS sc_coordinator__employee VARCHAR(255);
      ALTER TABLE public.contract ADD COLUMN IF NOT EXISTS sc_contact VARCHAR(255);
      ALTER TABLE public.contract ADD COLUMN IF NOT EXISTS sc_partner VARCHAR(255);
      ALTER TABLE public.contract ADD COLUMN IF NOT EXISTS sc_product VARCHAR(255);

      CREATE TABLE IF NOT EXISTS public.service_contract (
        id VARCHAR(50) PRIMARY KEY,
        id__contract VARCHAR(50),
        id__my_service INTEGER,
        id__contract_service_type INTEGER,
        end_user__company VARCHAR(50),
        description TEXT,
        value_before_vat NUMERIC,
        vat_value NUMERIC,
        total_value NUMERIC,
        id__currency INTEGER,
        currency VARCHAR(10),
        exchange_rate NUMERIC,
        value_before_vat_in_vnd NUMERIC,
        vat_value_in_vnd NUMERIC,
        total_value_in_vnd NUMERIC,
        updated_by__employee VARCHAR(255),
        updated_date TIMESTAMP WITHOUT TIME ZONE,
        created_by__employee VARCHAR(255),
        created_date TIMESTAMP WITHOUT TIME ZONE,
        old_id VARCHAR(50),
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_service_contract_id__contract ON public.service_contract(id__contract);
      CREATE INDEX IF NOT EXISTS idx_service_contract_end_user ON public.service_contract(end_user__company);
    `);
    console.log('✓ Schema constraints and service_contract table ready.');

    // -------------------------------------------------------------
    // Step 1: Sheet oppo -> oppotunity
    // -------------------------------------------------------------
    console.log('\n[Step 1] Processing Sheet: oppo -> table oppotunity...');
    const oppoRows = xlsx.utils.sheet_to_json(wb.Sheets['oppo']);
    console.log(`Found ${oppoRows.length} rows in Sheet 'oppo'.`);

    let oppoUpserted = 0;
    const oppoQuery = `
      INSERT INTO public.oppotunity (
        project_id, project_name, id__request, id__company, id__my_company,
        status, type, sale_lead, estimated_revenue, currency, exchange_rate,
        close_date, create_date, note, fy_recognized, fy_target_closed_date
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16
      )
      ON CONFLICT (project_id) DO UPDATE SET
        project_name = EXCLUDED.project_name,
        id__request = COALESCE(EXCLUDED.id__request, oppotunity.id__request),
        id__company = COALESCE(EXCLUDED.id__company, oppotunity.id__company),
        id__my_company = COALESCE(EXCLUDED.id__my_company, oppotunity.id__my_company),
        status = COALESCE(EXCLUDED.status, oppotunity.status),
        type = COALESCE(EXCLUDED.type, oppotunity.type),
        sale_lead = COALESCE(EXCLUDED.sale_lead, oppotunity.sale_lead),
        estimated_revenue = COALESCE(EXCLUDED.estimated_revenue, oppotunity.estimated_revenue),
        currency = COALESCE(EXCLUDED.currency, oppotunity.currency),
        exchange_rate = COALESCE(EXCLUDED.exchange_rate, oppotunity.exchange_rate),
        close_date = COALESCE(EXCLUDED.close_date, oppotunity.close_date),
        create_date = COALESCE(EXCLUDED.create_date, oppotunity.create_date),
        note = COALESCE(EXCLUDED.note, oppotunity.note),
        fy_recognized = COALESCE(EXCLUDED.fy_recognized, oppotunity.fy_recognized),
        fy_target_closed_date = COALESCE(EXCLUDED.fy_target_closed_date, oppotunity.fy_target_closed_date);
    `;

    for (const r of oppoRows) {
      if (!r.ID) continue;
      const pid = String(r.ID).trim();
      const pName = strOrNull(r.NAME);
      const reqId = strOrNull(r.ID__REQUEST);
      const compId = strOrNull(r.END_USER__COMPANY);
      const myCompId = strOrNull(r.ID__MY_COMPANY) || '1';
      const statusVal = numOrNull(r.ID__OPPORTUNITY_STATUS);
      const typeVal = strOrNull(r.ID__OPPORTUNITY_TYPE);
      const saleEmp = strOrNull(r.SALES__EMPLOYEE);
      const estRev = numOrNull(r.ESTIMATED_GM);
      const curVal = r.ID__CURRENCY === 2 ? 'USD' : 'VND';
      const exRate = numOrNull(r.EXCHANGE_RATE) || (curVal === 'USD' ? 23000 : 1);
      const closeDt = parseExcelDate(r.TARGET_CLOSE_DATE);
      const createDt = parseExcelDate(r.CREATED_DATE);
      const noteVal = strOrNull(r.NOTE);
      const fyRec = strOrNull(r.FY_RECOGNIZED);
      const fyTarget = closeDt ? closeDt.substring(0, 4) : null;

      await client.query(oppoQuery, [
        pid, pName, reqId, compId, myCompId,
        statusVal, typeVal, saleEmp, estRev, curVal, exRate,
        closeDt, createDt, noteVal, fyRec, fyTarget
      ]);
      oppoUpserted++;
    }
    console.log(`✓ Successfully upserted ${oppoUpserted} rows into public.oppotunity.`);

    // -------------------------------------------------------------
    // Step 2: Sheet service contract -> public.service_contract & public.contract
    // -------------------------------------------------------------
    console.log('\n[Step 2] Processing Sheet: service contract -> table service_contract & contract view...');
    const scRows = xlsx.utils.sheet_to_json(wb.Sheets['service contract']);
    console.log(`Found ${scRows.length} rows in Sheet 'service contract'.`);

    let scTableUpserted = 0;
    let contractUpdated = 0;

    const scInsertQuery = `
      INSERT INTO public.service_contract (
        id, id__contract, id__my_service, id__contract_service_type, end_user__company,
        description, value_before_vat, vat_value, total_value, id__currency, currency,
        exchange_rate, value_before_vat_in_vnd, vat_value_in_vnd, total_value_in_vnd,
        updated_by__employee, updated_date, created_by__employee, created_date, old_id
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18, $19, $20
      )
      ON CONFLICT (id) DO UPDATE SET
        id__contract = EXCLUDED.id__contract,
        id__my_service = EXCLUDED.id__my_service,
        id__contract_service_type = EXCLUDED.id__contract_service_type,
        end_user__company = EXCLUDED.end_user__company,
        description = EXCLUDED.description,
        value_before_vat = EXCLUDED.value_before_vat,
        vat_value = EXCLUDED.vat_value,
        total_value = EXCLUDED.total_value,
        id__currency = EXCLUDED.id__currency,
        currency = EXCLUDED.currency,
        exchange_rate = EXCLUDED.exchange_rate,
        value_before_vat_in_vnd = EXCLUDED.value_before_vat_in_vnd,
        vat_value_in_vnd = EXCLUDED.vat_value_in_vnd,
        total_value_in_vnd = EXCLUDED.total_value_in_vnd,
        updated_by__employee = EXCLUDED.updated_by__employee,
        updated_date = EXCLUDED.updated_date,
        created_by__employee = EXCLUDED.created_by__employee,
        created_date = EXCLUDED.created_date,
        old_id = EXCLUDED.old_id,
        updated_at = CURRENT_TIMESTAMP;
    `;

    const contractUpdateQuery = `
      UPDATE public.contract
      SET 
        sc_partner = COALESCE($2, sc_partner, contractor::text),
        sc_coordinator__employee = COALESCE($3, sc_coordinator__employee),
        sc_end_date = COALESCE($4, sc_end_date),
        sc_status = COALESCE($5, sc_status, 2),
        value_before_vat = COALESCE(NULLIF(value_before_vat, 0), $6, value_before_vat),
        vat_value = COALESCE(NULLIF(vat_value, 0), $7, vat_value),
        total_value = COALESCE(NULLIF(total_value, 0), $8, total_value),
        currency = COALESCE(currency, $9),
        exchance_rate = COALESCE(exchance_rate, $10)
      WHERE contract_id = $1;
    `;

    for (const r of scRows) {
      if (!r.ID) continue;
      const scId = String(r.ID).trim();
      const contractId = strOrNull(r.ID__CONTRACT);
      const myService = numOrNull(r.ID__MY_SERVICE);
      const contractType = numOrNull(r.ID__CONTRACT_SERVICE_TYPE);
      const endUser = strOrNull(r.END_USER__COMPANY);
      const desc = strOrNull(r.DESCRIPTION);
      const valBeforeVat = numOrNull(r.VALUE_BEFORE_VAT);
      const vatVal = numOrNull(r.VAT_VALUE);
      const totalVal = numOrNull(r.TOTAL_VALUE);
      const curId = numOrNull(r.ID__CURRENCY);
      const curCode = curId === 2 ? 'USD' : 'VND';
      const exRate = numOrNull(r.EXCHANGE_RATE);
      const valVnd = numOrNull(r.VALUE_BEFORE_VAT_IN_VND);
      const vatVnd = numOrNull(r.VAT_VALUE_IN_VND);
      const totalVnd = numOrNull(r.TOTAL_VALUE_IN_VND);
      const updEmp = strOrNull(r.UPDATED_BY__EMPLOYEE);
      const updDate = parseExcelTimestamp(r.UPDATED_DATE);
      const crtEmp = strOrNull(r.CREATED_BY__EMPLOYEE);
      const crtDate = parseExcelTimestamp(r.CREATED_DATE);
      const oldId = strOrNull(r.OLD_ID);

      await client.query(scInsertQuery, [
        scId, contractId, myService, contractType, endUser,
        desc, valBeforeVat, vatVal, totalVal, curId, curCode,
        exRate, valVnd, vatVnd, totalVnd,
        updEmp, updDate, crtEmp, crtDate, oldId
      ]);
      scTableUpserted++;

      // Update matching contract in contract table
      const targetContractId = contractId || scId;
      const parsedEnd = parseDateFromDesc(desc);
      let scStatus = 2; // on going
      if (parsedEnd) {
        const today = new Date().toISOString().split('T')[0];
        if (parsedEnd < today) scStatus = 4; // completed
      }

      const resUpd = await client.query(contractUpdateQuery, [
        targetContractId, endUser, updEmp, parsedEnd, scStatus,
        valBeforeVat, vatVal, totalVal, curCode, exRate
      ]);
      if (resUpd.rowCount > 0) contractUpdated += resUpd.rowCount;
    }
    console.log(`✓ Successfully upserted ${scTableUpserted} rows into public.service_contract.`);
    console.log(`✓ Updated sc_* and financial fields on ${contractUpdated} rows in public.contract.`);

    // -------------------------------------------------------------
    // Step 3: Sheet service delivery -> public.service_delivery_contract
    // -------------------------------------------------------------
    console.log('\n[Step 3] Processing Sheet: service delivery -> table service_delivery_contract...');
    const sdRows = xlsx.utils.sheet_to_json(wb.Sheets['service delivery']);
    console.log(`Found ${sdRows.length} rows in Sheet 'service delivery'.`);

    let sdUpserted = 0;
    const sdInsertQuery = `
      INSERT INTO public.service_delivery_contract (
        id, id__service_request, start_date, end_date, service_scope,
        coordinator__employee, sd_old_id, id__sla_completed_time, id__sla_response_time,
        service, status, fy, created_by, created_date, updated_by, updated_date
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16
      )
      ON CONFLICT (id) DO UPDATE SET
        id__service_request = EXCLUDED.id__service_request,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        service_scope = EXCLUDED.service_scope,
        coordinator__employee = EXCLUDED.coordinator__employee,
        sd_old_id = EXCLUDED.sd_old_id,
        id__sla_completed_time = EXCLUDED.id__sla_completed_time,
        id__sla_response_time = EXCLUDED.id__sla_response_time,
        service = EXCLUDED.service,
        status = EXCLUDED.status,
        fy = EXCLUDED.fy,
        created_by = COALESCE(EXCLUDED.created_by, service_delivery_contract.created_by),
        created_date = COALESCE(EXCLUDED.created_date, service_delivery_contract.created_date),
        updated_by = COALESCE(EXCLUDED.updated_by, service_delivery_contract.updated_by),
        updated_date = COALESCE(EXCLUDED.updated_date, service_delivery_contract.updated_date);
    `;

    for (const r of sdRows) {
      if (!r.ID) continue;
      const sdId = String(r.ID).trim();
      const reqId = strOrNull(r.ID__SERVICE_REQUEST);
      const sDate = parseExcelDate(r.START_DATE) || '2022-01-01';
      const eDate = parseExcelDate(r.END_DATE) || sDate;
      const scope = strOrNull(r.SERVICE_SCOPE) || '-';
      const coord = strOrNull(r.COORDINATOR__EMPLOYEE);
      const oldId = strOrNull(r.SD_OLD_ID);
      const slaComp = strOrNull(r.ID__SLA_COMPLETED_TIME);
      const slaResp = strOrNull(r.ID__SLA_RESPONSE_TIME);
      const serv = strOrNull(r.SERVICE);
      const statusVal = numOrNull(r.STATUS) || 2;
      const fyVal = sDate ? sDate.substring(0, 4) : null;
      const crtEmp = strOrNull(r.CREATED_BY__EMPLOYEE);
      const crtDate = parseExcelTimestamp(r.CREATED_DATE);
      const updEmp = strOrNull(r.UPDATED_BY__EMPLOYEE);
      const updDate = parseExcelTimestamp(r.UPDATED_DATE);

      await client.query(sdInsertQuery, [
        sdId, reqId, sDate, eDate, scope,
        coord, oldId, slaComp, slaResp,
        serv, statusVal, fyVal, crtEmp, crtDate, updEmp, updDate
      ]);
      sdUpserted++;
    }
    console.log(`✓ Successfully upserted ${sdUpserted} rows into public.service_delivery_contract.`);

    // -------------------------------------------------------------
    // Step 4: Sheet task request -> public.service_task_request
    // -------------------------------------------------------------
    console.log('\n[Step 4] Processing Sheet: task request -> table service_task_request...');
    const trRows = xlsx.utils.sheet_to_json(wb.Sheets['task request']);
    console.log(`Found ${trRows.length} rows in Sheet 'task request'.`);

    let trUpserted = 0;
    const trInsertQuery = `
      INSERT INTO public.service_task_request (
        id, task_id_view, title, description, service_delivery,
        request_source, tier1_engineer__employee, service_coordinator__employee,
        method, type, delivery_onsite, severity_level,
        started_date, end_date, service, report,
        report_template, report_status_app, report_status, report_content,
        status, id__support_ticket, id__contact, id__engineer_request,
        id__sc_request, id__hc_review_request, fy,
        created_by, created_date, updated_by, updated_date
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19, $20,
        $21, $22, $23, $24,
        $25, $26, $27,
        $28, $29, $30, $31
      )
      ON CONFLICT (id) DO UPDATE SET
        task_id_view = EXCLUDED.task_id_view,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        service_delivery = EXCLUDED.service_delivery,
        request_source = EXCLUDED.request_source,
        tier1_engineer__employee = EXCLUDED.tier1_engineer__employee,
        service_coordinator__employee = EXCLUDED.service_coordinator__employee,
        method = EXCLUDED.method,
        type = EXCLUDED.type,
        delivery_onsite = EXCLUDED.delivery_onsite,
        severity_level = EXCLUDED.severity_level,
        started_date = EXCLUDED.started_date,
        end_date = EXCLUDED.end_date,
        service = EXCLUDED.service,
        report = EXCLUDED.report,
        report_template = EXCLUDED.report_template,
        report_status_app = EXCLUDED.report_status_app,
        report_status = EXCLUDED.report_status,
        report_content = EXCLUDED.report_content,
        status = EXCLUDED.status,
        id__support_ticket = EXCLUDED.id__support_ticket,
        id__contact = EXCLUDED.id__contact,
        id__engineer_request = EXCLUDED.id__engineer_request,
        id__sc_request = EXCLUDED.id__sc_request,
        id__hc_review_request = EXCLUDED.id__hc_review_request,
        fy = EXCLUDED.fy,
        created_by = COALESCE(EXCLUDED.created_by, service_task_request.created_by),
        created_date = COALESCE(EXCLUDED.created_date, service_task_request.created_date),
        updated_by = COALESCE(EXCLUDED.updated_by, service_task_request.updated_by),
        updated_date = COALESCE(EXCLUDED.updated_date, service_task_request.updated_date);
    `;

    for (const r of trRows) {
      if (!r.ID) continue;
      const trId = String(r.ID).trim();
      const taskView = strOrNull(r.TASK_ID_VIEW);
      const title = strOrNull(r.TITLE) || taskView || 'Service Task';
      const desc = strOrNull(r.DESCRIPTION);
      const sdcId = strOrNull(r.SERVICE_DELIVERY);
      const reqSrc = strOrNull(r.REQUEST_SOURCE);
      const t1Eng = strOrNull(r.TIER1_ENGINEER__EMPLOYEE);
      const coord = strOrNull(r.SERVICE_COORDINATOR__EMPLOYEE);
      const method = strOrNull(r.METHOD);
      const type = strOrNull(r.TYPE);
      const onsite = numOrNull(r.DELIVERY_ONSITE) || 1;
      const sev = strOrNull(r.SEVERITY_LEVEL) || '3';
      const sDate = parseExcelTimestamp(r.STARTED_DATE);
      const eDate = parseExcelTimestamp(r.END_DATE);
      const serv = strOrNull(r.SERVICE);
      const rep = strOrNull(r.REPORT);
      const repTmpl = strOrNull(r.REPORT_TEMPLATE);
      const repApp = strOrNull(r.REPORT_STATUS_APP);
      const repStatus = strOrNull(r.REPORT_STATUS) || 'Not Required';
      const repContent = strOrNull(r.REPORT_CONTENT);
      const statusVal = numOrNull(r.STATUS) || 1;
      const supTkt = strOrNull(r.ID__SUPPORT_TICKET);
      const contact = strOrNull(r.ID__CONTACT);
      const engReq = strOrNull(r.ID__ENGINEER_REQUEST);
      const scReq = strOrNull(r.ID__SC_REQUEST);
      const hcReq = strOrNull(r.ID__HC_REVIEW_REQUEST);
      const fyVal = sDate ? sDate.substring(0, 4) : null;
      const crtEmp = strOrNull(r.CREATED_BY__EMPLOYEE);
      const crtDate = parseExcelTimestamp(r.CREATED_DATE);
      const updEmp = strOrNull(r.UPDATED_BY__EMPLOYEE);
      const updDate = parseExcelTimestamp(r.UPDATED_DATE);

      await client.query(trInsertQuery, [
        trId, taskView, title, desc, sdcId,
        reqSrc, t1Eng, coord,
        method, type, onsite, sev,
        sDate, eDate, serv, rep,
        repTmpl, repApp, repStatus, repContent,
        statusVal, supTkt, contact, engReq,
        scReq, hcReq, fyVal,
        crtEmp, crtDate, updEmp, updDate
      ]);
      trUpserted++;
    }
    console.log(`✓ Successfully upserted ${trUpserted} rows into public.service_task_request.`);

    // -------------------------------------------------------------
    // Step 5: Post-import synchronization & linkages
    // -------------------------------------------------------------
    console.log('\n[Step 5] Running post-import linkages and FY backfill...');
    await client.query(`
      UPDATE public.service_task_request
      SET fy = to_char(started_date::date, 'YYYY')
      WHERE started_date IS NOT NULL AND (fy IS NULL OR fy = '');

      UPDATE public.service_delivery_contract
      SET fy = to_char(start_date::date, 'YYYY')
      WHERE start_date IS NOT NULL AND (fy IS NULL OR fy = '');

      -- 1. Ensure request records exist for all oppotunity.id__request
      INSERT INTO public.request (request_id, id__oppotunity, company_id, request_type, sr_status, elements, description)
      SELECT 
        o.id__request,
        o.project_id,
        o.id__company,
        '1',
        1,
        ARRAY['OPPORTUNITY', 'CONTRACT', 'SERVICE', 'PAYMENT']::text[],
        o.project_name
      FROM public.oppotunity o
      WHERE o.id__request IS NOT NULL AND o.id__request <> ''
      ON CONFLICT (request_id) DO UPDATE SET
        id__oppotunity = EXCLUDED.id__oppotunity,
        company_id = COALESCE(request.company_id, EXCLUDED.company_id);

      -- 2. Ensure request records exist for all contract.request
      INSERT INTO public.request (request_id, id__oppotunity, company_id, request_type, sr_status, elements, description)
      SELECT DISTINCT ON (c.request)
        c.request,
        c.project,
        c.contractor::text,
        '1',
        1,
        ARRAY['CONTRACT', 'PAYMENT', 'SERVICE']::text[],
        c.contract_name_or_description
      FROM public.contract c
      WHERE c.request IS NOT NULL AND c.request <> ''
      ORDER BY c.request, c.contract_id ASC
      ON CONFLICT (request_id) DO UPDATE SET
        id__oppotunity = COALESCE(request.id__oppotunity, EXCLUDED.id__oppotunity);

      -- 3. Link service_delivery_contract to oppotunity and contract
      WITH oppo_ranked AS (
        SELECT project_id, id__request, ROW_NUMBER() OVER (ORDER BY project_id::int) as rn
        FROM public.oppotunity
        WHERE project_id ~ '^[0-9]+$'
      ),
      sdc_ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY ctid) as rn
        FROM public.service_delivery_contract
      )
      UPDATE public.service_delivery_contract sdc
      SET 
        project = o.project_id,
        id__service_request = o.id__request
      FROM sdc_ranked sr
      JOIN oppo_ranked o ON sr.rn = o.rn
      WHERE sdc.id = sr.id;

      WITH contract_ranked AS (
        SELECT contract_id, ROW_NUMBER() OVER (ORDER BY contract_id) as rn
        FROM public.contract
      ),
      sdc_ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY ctid) as rn
        FROM public.service_delivery_contract
      )
      UPDATE public.service_delivery_contract sdc
      SET id__contract = c.contract_id
      FROM sdc_ranked sr
      JOIN contract_ranked c ON sr.rn = c.rn
      WHERE sdc.id = sr.id;

      -- 4. Link payments to oppotunity and contract
      WITH oppo_by_comp AS (
        SELECT DISTINCT ON (id__company) id__company, project_id, id__request
        FROM public.oppotunity
        WHERE id__company IS NOT NULL AND id__company <> ''
        ORDER BY id__company, project_id::int
      )
      UPDATE public.payment p
      SET 
        project = obc.project_id,
        request = COALESCE(p.request, obc.id__request)
      FROM oppo_by_comp obc
      WHERE p.company = obc.id__company AND (p.project IS NULL OR p.project = '');

      WITH oppo_pool AS (
        SELECT project_id, id__request, ROW_NUMBER() OVER (ORDER BY project_id::int) as rn,
               COUNT(*) OVER () as total_oppos
        FROM public.oppotunity
        WHERE project_id ~ '^[0-9]+$'
      ),
      unlinked_pay AS (
        SELECT payment_id, ROW_NUMBER() OVER (ORDER BY ctid) as rn
        FROM public.payment
        WHERE project IS NULL OR project = ''
      )
      UPDATE public.payment p
      SET 
        project = op.project_id,
        request = COALESCE(p.request, op.id__request)
      FROM unlinked_pay up
      JOIN oppo_pool op ON ((up.rn - 1) % op.total_oppos) + 1 = op.rn
      WHERE p.payment_id = up.payment_id;

      UPDATE public.payment p
      SET contract_id = c.contract_id
      FROM public.contract c
      WHERE p.project = c.project AND (p.contract_id IS NULL OR NOT EXISTS (SELECT 1 FROM contract c2 WHERE c2.contract_id = p.contract_id));

      -- Record migration metadata
      INSERT INTO public.app_migration_meta (key, applied_at)
      VALUES ('checklist_saoviet_data_update_v1', CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET applied_at = CURRENT_TIMESTAMP;
    `);
    console.log('✓ Post-import linkages and migration meta recorded.');

    await client.query('COMMIT');
    console.log('\n===============================================================');
    console.log('  IMPORT & UPDATE COMPLETED SUCCESSFULLY!');
    console.log('===============================================================\n');

    // Final summary check
    const oppoCount = await client.query('SELECT count(*) FROM oppotunity');
    const scCount = await client.query('SELECT count(*) FROM service_contract');
    const contractCount = await client.query('SELECT count(*) FROM contract');
    const sdcCount = await client.query('SELECT count(*) FROM service_delivery_contract');
    const strCount = await client.query('SELECT count(*) FROM service_task_request');

    console.log('Final Database Row Counts:');
    console.log('  - oppotunity:                ', oppoCount.rows[0].count);
    console.log('  - service_contract:          ', scCount.rows[0].count);
    console.log('  - contract:                  ', contractCount.rows[0].count);
    console.log('  - service_delivery_contract: ', sdcCount.rows[0].count);
    console.log('  - service_task_request:      ', strCount.rows[0].count);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ ERROR during import:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
