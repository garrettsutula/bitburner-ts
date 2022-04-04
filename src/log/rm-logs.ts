import { NS } from '@ns'
import { fileURLToPath } from 'url'

export async function main(ns : NS) : Promise<void> {
  ns.ls('home', '/log/servers').forEach((filePath) => ns.rm(filePath));
  ns.ls('home', '/log/player').forEach((filePath) => ns.rm(filePath));
  ns.ls('home', '/log/process').forEach((filePath) => ns.rm(filePath));
  //
}
