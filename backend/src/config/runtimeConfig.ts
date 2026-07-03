import prisma from '../prisma/client';

export class RuntimeConfig {
  private static cache: Map<string, string> = new Map();
  private static isInitialized = false;

  /**
   * Initializes config from database.
   */
  public static async init() {
    try {
      const dbConfigs = await prisma.systemConfig.findMany();
      this.cache.clear();
      for (const config of dbConfigs) {
        this.cache.set(config.key, config.value);
      }
      this.isInitialized = true;
    } catch (e) {
      console.warn('RuntimeConfig initialization warning: database not seeded or connection pending.');
    }
  }

  /**
   * Retrieves string value from configuration.
   */
  public static get(key: string, defaultValue: string): string {
    if (!this.isInitialized) {
      return defaultValue;
    }
    return this.cache.get(key) ?? defaultValue;
  }

  /**
   * Retrieves numeric value from configuration.
   */
  public static getNumber(key: string, defaultValue: number): number {
    const val = this.get(key, defaultValue.toString());
    const parsed = parseFloat(val);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Retrieves boolean flag from configuration.
   */
  public static getBoolean(key: string, defaultValue: boolean): boolean {
    const val = this.get(key, defaultValue ? 'true' : 'false');
    return val === 'true';
  }

  /**
   * Reloads configs on update.
   */
  public static async reload() {
    await this.init();
  }
}
