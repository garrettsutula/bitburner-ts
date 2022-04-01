import { NS } from '@ns';
import { GenericObject } from 'models/utility';

function replacer(key: string, value: any) {
  if(value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(value.entries()), // or with spread: value: [...value]
    };
  } else {
    return value;
  }
}

function reviver(key: string, value: any) {
  if(typeof value === 'object' && value !== null) {
    if (value.dataType === 'Map') {
      return new Map(value.value);
    }
  }
  return value;
}

export function readPortJson(ns: NS, port: number): GenericObject | string[] {
  const fileStr = ns.readPort(port);
  try {
    return JSON.parse(fileStr, reviver);
  } catch (e) {
    throw new Error(`JSON Parse Error: ${JSON.stringify(e)}`);
  }
}

export function writePortJson(ns: NS, port: number, data: GenericObject | string[]): Promise<void> {
  return ns.writePort(port, JSON.stringify(data, replacer));
}
