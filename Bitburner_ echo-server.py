#!/usr/bin/env python3

import asyncio
import pyautogui
import websockets

KEY_INTERVAL = 0
LOCAL_PORT = 59764

async def listen(sock):
	while True:
		keys = await sock.recv()
		# print('Sending \'{}\''.format(keys))
		pyautogui.write(keys, interval=KEY_INTERVAL)

async def main():
	async with websockets.serve(listen, 'localhost', LOCAL_PORT):
		await asyncio.Future()

asyncio.run(main())
