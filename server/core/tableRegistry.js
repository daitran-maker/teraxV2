class TableRegistry {
  constructor() {
    this.handlers = new Map();
    this.fallbackHandler = null;
    this.listExtensions = new Map();
  }

  /**
   * Register a list extension: lets a module add computed (virtual) columns to the list query
   * of existing tables without touching core code.
   * @param {string|string[]} tableNames
   * @param {{ columns?: string[], wrap: (tableName: string, baseSql: string) => string }} extension
   *   columns: computed column names that can be used for server-side sorting
   *   wrap: returns a FROM-item (aliased as the table name) exposing the extra columns
   */
  registerListExtension(tableNames, extension) {
    const names = Array.isArray(tableNames) ? tableNames : [tableNames];
    for (const name of names) {
      const key = String(name).toLowerCase().trim();
      if (!this.listExtensions.has(key)) this.listExtensions.set(key, []);
      this.listExtensions.get(key).push(extension);
    }
  }

  /** Apply every registered list extension to the base FROM-item of a table. */
  applyListExtension(tableName, baseSql) {
    const exts = this.listExtensions.get(String(tableName || '').toLowerCase().trim()) || [];
    return exts.reduce((sql, ext) => ext.wrap(tableName, sql), baseSql);
  }

  /** Computed column names exposed by list extensions (allowed for sorting). */
  getListExtensionColumns(tableName) {
    const exts = this.listExtensions.get(String(tableName || '').toLowerCase().trim()) || [];
    return exts.flatMap(ext => ext.columns || []);
  }

  /**
   * Register a domain handler for one or more table/view names
   * @param {string|string[]} tableNames 
   * @param {object} handlerInstance 
   */
  register(tableNames, handlerInstance) {
    const names = Array.isArray(tableNames) ? tableNames : [tableNames];
    for (const name of names) {
      this.handlers.set(String(name).toLowerCase().trim(), handlerInstance);
    }
  }

  setFallback(handlerInstance) {
    this.fallbackHandler = handlerInstance;
  }

  /**
   * Resolve appropriate handler for a table name
   * @param {string} tableName 
   * @returns {object|null}
   */
  resolveHandler(tableName) {
    if (!tableName) return this.fallbackHandler;
    const cleanName = String(tableName).toLowerCase().trim();
    return this.handlers.get(cleanName) || this.fallbackHandler;
  }

  hasCustomHandler(tableName) {
    if (!tableName) return false;
    const cleanName = String(tableName).toLowerCase().trim();
    return this.handlers.has(cleanName);
  }
}

module.exports = new TableRegistry();
