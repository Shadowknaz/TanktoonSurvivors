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
    [key: string]: any;
  };

  export function defineComponent<T extends ISchema>(schema?: T): any;
  export function defineQuery(components: any[]): any;
  export function enterQuery(query: any): any;
  export function exitQuery(query: any): any;
}
