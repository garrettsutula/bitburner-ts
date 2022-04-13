/* eslint-disable @typescript-eslint/no-explicit-any */
import { NS } from '@ns';
import { GenericObject } from '/models/utility';

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

export function readJson(ns: NS, filePath: string): GenericObject | string[] {
  const fileStr = ns.read(filePath);
  try {
    return JSON.parse(fileStr, reviver);
  } catch (e) {
    throw new Error(`JSON Parse Error: ${JSON.stringify(e)}`);
  }
}

export function writeJson(ns: NS, filePath: string, fileContents: GenericObject | string[], mode: ('w'|'a') = 'w'): Promise<void> {
  return ns.write(filePath, JSON.stringify(fileContents, replacer), mode);
}

export function appendLog(ns: NS, filePath: string, logEntries:  GenericObject[]): Promise<void> {
  return ns.write(filePath, logEntries.map((logEntry) => JSON.stringify(logEntry)).join('\n'), 'a');
}