import { NS } from '@ns';
import { GenericObject } from 'models/utility';

export function readJson(ns: NS, filePath: string): GenericObject {
  const fileStr = ns.read(filePath);
  try {
    return JSON.parse(fileStr);
  } catch (e) {
    throw new Error(`JSON Parse Error: ${JSON.stringify(e)}`);
  }
}

export function writeJson(ns: NS, filePath: string, fileContents: GenericObject | StringArray): Promise<void> {
  return ns.write(filePath, JSON.stringify(fileContents), 'w');
}
