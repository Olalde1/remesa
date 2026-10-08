/** A successful result. */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
  readonly error?: undefined;
}

/** A failed result with a stable, machine-readable error code. */
export interface Err<C extends string> {
  readonly ok: false;
  readonly value?: undefined;
  readonly error: { readonly code: C; readonly message: string };
}

/** Validators return values instead of throwing. */
export type Result<T, C extends string> = Ok<T> | Err<C>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

export const err = <C extends string>(code: C, message: string): Err<C> => ({
  ok: false,
  error: { code, message },
});
