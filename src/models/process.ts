import { NS } from '@ns'

export interface Process {
  host: string;
  script: string;
  args: Array[string | number]
}

export async function main(ns : NS) : Promise<void> {
  //
}
