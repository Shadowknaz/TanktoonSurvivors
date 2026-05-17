declare module 'bitecs/legacy' {
  export * from 'bitecs';

  export const Types: {
    i8: 'i8';
    ui8: 'ui8';
    i16: 'i16';
    ui16: 'ui16';
    i32: 'i32';
    ui32: 'ui32';
    f32: 'f32';
    f64: 'f64';
    eid: 'eid';
  };

  export type ISchema = {
    [key: string]: 'i8' | 'ui8' | 'i16' | 'ui16' | 'i32' | 'ui32' | 'f32' | 'f64' | 'eid';
  };

  type ArrayTypeFor<T> =
    T extends 'f32' ? Float32Array :
    T extends 'ui8' ? Uint8Array :
    T extends 'ui32' ? Uint32Array :
    T extends 'i8' ? Int8Array :
    T extends 'i16' ? Int16Array :
    T extends 'ui16' ? Uint16Array :
    T extends 'i32' ? Int32Array :
    T extends 'f64' ? Float64Array :
    any;

  export function defineComponent<T extends ISchema>(schema?: T): { [K in keyof T]: ArrayTypeFor<T[K]> };
  export function defineQuery(components: any[]): any;
  export function enterQuery(query: any): any;
  export function exitQuery(query: any): any;
}
