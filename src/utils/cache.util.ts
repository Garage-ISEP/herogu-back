/**
 * Cache util that provide a cache map with a ttl
 */
export class CacheMap<K, V> implements Map<K, V> {

  private readonly _map = new Map<K, CacheItem<V>>();
  private readonly _interval: NodeJS.Timeout;
  constructor(private readonly _ttl: number) { 
    this._interval = setInterval(() => this._cleanup(), _ttl);
  }

  public destroy() {
    this._map.clear();
    clearInterval(this._interval);
  }

  public clear(): void {
    this._map.clear();
  }
  public delete(key: K): boolean {
    return this._map.delete(key);
  }
  public forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any): void {
    this._map.forEach((value, key) => callbackfn(value.value, key, this));
  }
  public has(key: K): boolean {
    return this._map.has(key);
  }
  public get size(): number {
    return this._map.size;
  }
  public *entries(): IterableIterator<[K, V]> {
    for (const [key, value] of this._map) {
      yield [key, value.value];
    }
  }

  public get(key: K) {
    return this._map.get(key)?.value;
  }

  public set(key: K, value: V): this {
    this._map.set(key, new CacheItem(value, this._ttl));
    return this;
  }

  public keys(): IterableIterator<K> {
    return this._map.keys();
  }

  public *values(): IterableIterator<V> {
    for (const value of this._map.values()) {
      yield value.value;
    }
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.entries();
  }

  [Symbol.toStringTag] = "CacheMap";

  private _cleanup() {
    for (const [key, value] of this._map) {
      if (value.isExpired()) {
        this._map.delete(key);
      }
    }
  }
}

class CacheItem<V> {
  public readonly expiration: number;

  constructor(public value: V, ttl: number) {
    this.expiration = Date.now() + ttl;
  }

  public isExpired(): boolean {
    return Date.now() > this.expiration;
  }
}