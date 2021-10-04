export interface MessageEvent<T> {
  data: string | T;
  id?: string;
  type?: string;
  retry?: number;
}