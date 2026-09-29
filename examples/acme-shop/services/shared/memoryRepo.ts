export class MemoryRepo<T extends { id: string }> {
  protected rows = new Map<string, T>();

  get(id: string): T | undefined {
    return this.rows.get(id);
  }

  save(row: T): T {
    this.rows.set(row.id, row);
    return row;
  }

  delete(id: string): boolean {
    return this.rows.delete(id);
  }

  all(): T[] {
    return [...this.rows.values()];
  }

  find(predicate: (row: T) => boolean): T[] {
    return this.all().filter(predicate);
  }

  clear(): void {
    this.rows.clear();
  }
}
