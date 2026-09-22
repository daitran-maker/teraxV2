/**
 * QueryBuilder - Core Modular SQL Query Builder for TeraX v2
 * Handles parameterized WHERE filters, search, pagination, and sorting for dynamic tables.
 */

class QueryBuilder {
  /**
   * Sanitize column / table identifier to prevent SQL injection
   * @param {string} identifier 
   * @returns {string} sanitized identifier
   */
  sanitizeIdentifier(identifier) {
    if (!identifier || typeof identifier !== 'string') return '';
    return identifier.replace(/[^a-zA-Z0-9_]/g, '');
  }

  /**
   * Builds parameterized pagination clauses
   * @param {number|string} page 1-indexed
   * @param {number|string} limit
   * @param {number} startParamIndex 
   */
  buildPagination(page = 1, limit = 50, startParamIndex = 1) {
    const p = Math.max(1, parseInt(page || '1', 10));
    const l = Math.min(500, Math.max(1, parseInt(limit || '50', 10)));
    const offset = (p - 1) * l;

    return {
      sql: `LIMIT $${startParamIndex} OFFSET $${startParamIndex + 1}`,
      params: [l, offset],
      nextParamIndex: startParamIndex + 2
    };
  }

  /**
   * Builds ORDER BY clause safely
   * @param {string} sortBy column name
   * @param {string} sortOrder 'asc' or 'desc'
   * @param {string} defaultSort default order by string
   */
  buildOrderBy(sortBy, sortOrder = 'desc', defaultSort = 'created_date DESC') {
    if (!sortBy) return `ORDER BY ${defaultSort}`;
    const cleanCol = this.sanitizeIdentifier(sortBy);
    if (!cleanCol) return `ORDER BY ${defaultSort}`;
    const cleanDir = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    return `ORDER BY "${cleanCol}" ${cleanDir} NULLS LAST`;
  }

  /**
   * Builds parameterized filter conditions from an object
   * @param {object} filters key-value pairs of column: value
   * @param {number} startParamIndex 
   */
  buildFilters(filters = {}, startParamIndex = 1) {
    const conditions = [];
    const params = [];
    let paramIndex = startParamIndex;

    if (!filters || typeof filters !== 'object') {
      return { conditions, params, nextParamIndex: paramIndex };
    }

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null || value === '') continue;
      const cleanCol = this.sanitizeIdentifier(key);
      if (!cleanCol) continue;

      if (Array.isArray(value)) {
        if (value.length === 0) continue;
        conditions.push(`"${cleanCol}" = ANY($${paramIndex})`);
        params.push(value);
        paramIndex++;
      } else if (typeof value === 'string' && value.includes('%')) {
        conditions.push(`"${cleanCol}"::text ILIKE $${paramIndex}`);
        params.push(value);
        paramIndex++;
      } else {
        conditions.push(`"${cleanCol}" = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    return {
      conditions,
      params,
      nextParamIndex: paramIndex
    };
  }

  /**
   * Builds multi-column text search condition (ILIKE)
   * @param {string} searchKeyword 
   * @param {string[]} targetColumns 
   * @param {number} startParamIndex 
   */
  buildSearch(searchKeyword, targetColumns = [], startParamIndex = 1) {
    if (!searchKeyword || !Array.isArray(targetColumns) || targetColumns.length === 0) {
      return { sql: '', params: [], nextParamIndex: startParamIndex };
    }

    const cleanCols = targetColumns
      .map(c => this.sanitizeIdentifier(c))
      .filter(Boolean);

    if (cleanCols.length === 0) {
      return { sql: '', params: [], nextParamIndex: startParamIndex };
    }

    const likeExprs = cleanCols.map(col => `"${col}"::text ILIKE $${startParamIndex}`);
    return {
      sql: `(${likeExprs.join(' OR ')})`,
      params: [`%${searchKeyword.trim()}%`],
      nextParamIndex: startParamIndex + 1
    };
  }
}

module.exports = new QueryBuilder();
