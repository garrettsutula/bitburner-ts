import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  const doc = eval('document');
  (ns as any).bypass(doc);
}