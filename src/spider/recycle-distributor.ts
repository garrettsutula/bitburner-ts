import { NS } from '@ns'
import { writeJson } from '/lib/file';

export function recycleDistributor(ns : NS) : Promise<void> {
  return writeJson(ns, '/notification/recycle.notification.txt', {host: 'home', status: 'update'});
}