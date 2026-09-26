const express = require('express');
const { Pool } = require('pg');

const router = express.Router();

const cmsPool = new Pool({
  host: process.env.CMS_LOOKUP_DB_HOST || '10.91.1.51',
  port: parseInt(process.env.CMS_LOOKUP_DB_PORT || '30543', 10),
  user: process.env.CMS_LOOKUP_DB_USER || 'teraxadmin',
  password: process.env.CMS_LOOKUP_DB_PASSWORD || 'TeraX123!@#',
  database: process.env.CMS_LOOKUP_DB_NAME || 'cms_terax',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Curated popular countries (ISO codes)
const POPULAR_COUNTRY_CODES = new Set([
  'VN', 'US', 'SG', 'CN', 'JP', 'KR', 'TH', 'MY', 'ID', 'PH',
  'DE', 'GB', 'FR', 'AU', 'IN', 'KH', 'MM', 'LA', 'CA', 'TW'
]);

// Curated popular currencies
const POPULAR_CURRENCIES = new Set([
  'VND', 'USD', 'EUR', 'JPY', 'SGD', 'THB', 'CNY', 'GBP',
  'AUD', 'KRW', 'CAD', 'CHF', 'HKD', 'MYR', 'IDR'
]);

// In-memory cache
const memoryCache = {
  countries: null,
  currencies: null,
  provinces: null, // all provinces
  citiesByProvince: new Map(), // province -> cities
  lastCountryFetch: 0,
  lastCurrencyFetch: 0,
  lastProvinceFetch: 0,
  CACHE_TTL: 1000 * 60 * 60 * 6 // 6 hours
};

async function getCachedCountries() {
  const now = Date.now();
  if (memoryCache.countries && (now - memoryCache.lastCountryFetch < memoryCache.CACHE_TTL)) {
    return memoryCache.countries;
  }

  const result = await cmsPool.query(`
    SELECT
      id::text AS id,
      name,
      code,
      CASE
        WHEN code IS NULL OR BTRIM(code) = '' THEN name
        ELSE code || ' - ' || name
      END AS display_name
    FROM country
    WHERE name IS NOT NULL AND BTRIM(name) <> ''
    ORDER BY name ASC
  `);

  const list = result.rows.map(c => ({
    ...c,
    popular: POPULAR_COUNTRY_CODES.has(String(c.code || '').toUpperCase().trim())
  }));

  // Sort popular countries to top, then alphabetical
  list.sort((a, b) => {
    if (a.popular && !b.popular) return -1;
    if (!a.popular && b.popular) return 1;
    return a.name.localeCompare(b.name);
  });

  memoryCache.countries = list;
  memoryCache.lastCountryFetch = now;
  return list;
}

async function getCachedCurrencies() {
  const now = Date.now();
  if (memoryCache.currencies && (now - memoryCache.lastCurrencyFetch < memoryCache.CACHE_TTL)) {
    return memoryCache.currencies;
  }

  const result = await cmsPool.query(`
    SELECT DISTINCT
      currency_code AS code,
      currency_code AS label
    FROM exchange_rate
    WHERE currency_code IS NOT NULL AND BTRIM(currency_code) <> ''
    ORDER BY currency_code ASC
  `);

  const list = result.rows.map(c => ({
    ...c,
    popular: POPULAR_CURRENCIES.has(String(c.code || '').toUpperCase().trim())
  }));

  // Sort popular currencies to top, then alphabetical
  list.sort((a, b) => {
    if (a.popular && !b.popular) return -1;
    if (!a.popular && b.popular) return 1;
    return a.code.localeCompare(b.code);
  });

  memoryCache.currencies = list;
  memoryCache.lastCurrencyFetch = now;
  return list;
}

async function getCachedProvinces() {
  const now = Date.now();
  if (memoryCache.provinces && (now - memoryCache.lastProvinceFetch < memoryCache.CACHE_TTL)) {
    return memoryCache.provinces;
  }

  const result = await cmsPool.query(`
    SELECT
      p.id::text AS id,
      p.name,
      p.code,
      p.in__country::text AS country_id,
      co.name AS country_name
    FROM province p
    LEFT JOIN country co ON co.id = p.in__country
    WHERE p.name IS NOT NULL AND BTRIM(p.name) <> ''
    ORDER BY p.name ASC
  `);

  memoryCache.provinces = result.rows;
  memoryCache.lastProvinceFetch = now;
  return result.rows;
}

// Warm up cache in background on startup
getCachedCountries().catch(err => console.warn('[CMS Lookups] Cache warmup countries error:', err.message));
getCachedCurrencies().catch(err => console.warn('[CMS Lookups] Cache warmup currencies error:', err.message));
getCachedProvinces().catch(err => console.warn('[CMS Lookups] Cache warmup provinces error:', err.message));

router.get('/countries', async (req, res) => {
  try {
    const list = await getCachedCountries();
    const { search, popular } = req.query;

    let filtered = list;
    if (popular === 'true' || popular === '1') {
      filtered = filtered.filter(c => c.popular);
    }
    if (search && String(search).trim()) {
      const q = String(search).trim().toLowerCase();
      filtered = filtered.filter(c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.code && c.code.toLowerCase().includes(q)) ||
        (c.display_name && c.display_name.toLowerCase().includes(q))
      );
    }

    res.json({ data: filtered });
  } catch (err) {
    console.error('[CMS Lookups] Failed to fetch countries:', err.message);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

router.get('/provinces', async (req, res) => {
  const countryId = req.query.country_id || null;
  const countryName = req.query.country || null;
  const search = req.query.search || null;

  try {
    const allProvinces = await getCachedProvinces();
    let filtered = allProvinces;

    if (countryId) {
      filtered = filtered.filter(p => String(p.country_id) === String(countryId));
    } else if (countryName) {
      const cLower = String(countryName).trim().toLowerCase();
      filtered = filtered.filter(p => p.country_name && p.country_name.trim().toLowerCase() === cLower);
    }

    if (search && String(search).trim()) {
      const q = String(search).trim().toLowerCase();
      filtered = filtered.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.code && p.code.toLowerCase().includes(q))
      );
    }

    res.json({ data: filtered });
  } catch (err) {
    console.error('[CMS Lookups] Failed to fetch provinces:', err.message);
    res.status(500).json({ error: 'Failed to fetch provinces' });
  }
});

router.get('/cities', async (req, res) => {
  const provinceId = req.query.province_id || null;
  const provinceName = req.query.province || null;
  const countryId = req.query.country_id || null;
  const countryName = req.query.country || null;
  const search = req.query.search || null;

  // SAFETY GUARD: Do NOT dump all 140,000 cities if no filters provided
  if (!provinceId && !provinceName && !countryId && !countryName && !search) {
    return res.json({ data: [] });
  }

  // Check in-memory cache for specific province
  const cacheKey = (provinceId ? `pid_${provinceId}` : '') + (provinceName ? `_pname_${provinceName}` : '');
  if (cacheKey && !search && memoryCache.citiesByProvince.has(cacheKey)) {
    return res.json({ data: memoryCache.citiesByProvince.get(cacheKey) });
  }

  try {
    const values = [];
    let where = `WHERE ci.name IS NOT NULL AND BTRIM(ci.name) <> ''`;

    if (provinceId) {
      values.push(String(provinceId));
      where += ` AND ci.id__province::text = $${values.length}`;
    } else if (provinceName) {
      values.push(String(provinceName));
      where += ` AND p.name = $${values.length}`;
    }

    if (countryId) {
      values.push(String(countryId));
      where += ` AND p.in__country::text = $${values.length}`;
    } else if (countryName) {
      values.push(String(countryName));
      where += ` AND co.name = $${values.length}`;
    }

    if (search && String(search).trim()) {
      values.push(`%${String(search).trim()}%`);
      where += ` AND ci.name ILIKE $${values.length}`;
    }

    // Limit to 500 records max per query to protect network & browser
    const result = await cmsPool.query(`
      SELECT
        ci.id::text AS id,
        ci.name,
        ci.id__province::text AS province_id,
        p.name AS province_name,
        p.in__country::text AS country_id,
        co.name AS country_name
      FROM city ci
      LEFT JOIN province p ON p.id = ci.id__province
      LEFT JOIN country co ON co.id = p.in__country
      ${where}
      ORDER BY ci.name ASC
      LIMIT 500
    `, values);

    if (cacheKey && !search) {
      memoryCache.citiesByProvince.set(cacheKey, result.rows);
    }

    res.json({ data: result.rows });
  } catch (err) {
    console.error('[CMS Lookups] Failed to fetch cities:', err.message);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

router.get('/currencies', async (req, res) => {
  try {
    const list = await getCachedCurrencies();
    const { search, popular } = req.query;

    let filtered = list;
    if (popular === 'true' || popular === '1') {
      filtered = filtered.filter(c => c.popular);
    }
    if (search && String(search).trim()) {
      const q = String(search).trim().toLowerCase();
      filtered = filtered.filter(c =>
        (c.code && c.code.toLowerCase().includes(q)) ||
        (c.label && c.label.toLowerCase().includes(q))
      );
    }

    res.json({ data: filtered });
  } catch (err) {
    console.error('[CMS Lookups] Failed to fetch currencies:', err.message);
    res.status(500).json({ error: 'Failed to fetch currencies' });
  }
});

router.getCachedCountries = getCachedCountries;
router.getCachedCurrencies = getCachedCurrencies;
router.getCachedProvinces = getCachedProvinces;

module.exports = router;


