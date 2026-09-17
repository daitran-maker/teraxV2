class TableRegistry {
  constructor() {
    this.handlers = new Map();
    this.fallbackHandler = null;
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
